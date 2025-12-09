import { Injectable } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { Buffer } from 'buffer';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalJsonRPCService } from 'src/app/services/global.jsonrpc.service';
import { Config } from 'src/app/wallet/config/Config';
import { StandardCoinName } from 'src/app/wallet/model/coin';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { Transfer } from 'src/app/wallet/services/cointransfer.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { PollDetails } from '../model/poll-details.model';
import { Poll } from '../model/poll.model';
import { StoredVoteInfo } from '../model/stored-vote-info.model';
import { Vote } from '../model/vote.model';
import { LocalStorage } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class MainchainPollsService {
  private apiBaseUrl = 'https://ela-node-test.eadd.co/';

  private readonly USER_VOTE_FLAG = 'pollvote';
  private readonly USER_VOTE_FLAG_BYTE_LENGTH = 8; // 8 bytes

  constructor(
    private globalJsonRPCService: GlobalJsonRPCService,
    private walletNetworkService: WalletNetworkService,
    private walletService: WalletService,
    private localStorage: LocalStorage
  ) {}

  /**
   * Calculates the vote amount from available balance (balance - 1 ELA for fees)
   * @param balance - Available balance in sELA (smallest unit)
   * @returns Vote amount in sELA (smallest unit), or null if insufficient balance
   */
  calculateVoteAmount(balance: BigNumber): BigNumber | null {
    if (!balance || balance.isLessThanOrEqualTo(0)) {
      return null;
    }

    const oneELA = new BigNumber(1).multipliedBy(Config.SELAAsBigNumber);
    const voteAmount = balance.minus(oneELA);

    if (voteAmount.isLessThanOrEqualTo(0)) {
      return null;
    }

    return voteAmount;
  }

  /**
   * Encodes vote data into binary memo format for Elastos mainchain transactions
   *
   * @param userVoteFlag - Fixed-length string matching InitiateVoting Flag
   * @param pollId - uint256 hash of voting information (32 bytes, hex string)
   * @param option - uint32 option index (0, 1, 2, 3...)
   * @param amount - string representation of ELA amount (must match transferred amount)
   * @returns Hex string ready to be passed as memo to SDK
   */
  private async encodeVoteMemo(userVoteFlag: string, pollId: string, option: number, amount: string): Promise<Buffer> {
    // Use dynamic import for SmartBuffer like other files in codebase
    const { SmartBuffer } = await import('smart-buffer');
    const buffer = new SmartBuffer();

    // 1. userVoteFlag - Fixed-length string (as UTF-8 bytes)
    const flagBytes = Buffer.from(userVoteFlag, 'utf8');
    // Pad or truncate to exact byte length
    const paddedFlag = Buffer.alloc(this.USER_VOTE_FLAG_BYTE_LENGTH);
    flagBytes.copy(paddedFlag, 0, 0, Math.min(flagBytes.length, this.USER_VOTE_FLAG_BYTE_LENGTH));
    buffer.writeBuffer(paddedFlag);

    // 2. id - uint256 (32 bytes, big-endian for hash)
    const pollIdHex = pollId.replace(/^0x/i, ''); // Remove 0x if present
    if (pollIdHex.length !== 64) {
      throw new Error(`Poll ID must be exactly 64 hex characters (32 bytes), got ${pollIdHex.length} chars`);
    }
    const idBuffer = Buffer.from(pollIdHex, 'hex');
    buffer.writeBuffer(idBuffer);

    // 3. option - uint32 (4 bytes, little-endian)
    buffer.writeUInt32LE(option);

    // 4. amount length (1 byte) + amount - string (UTF-8 encoded)
    buffer.writeUInt8(amount.length);
    buffer.writeString(amount);

    return buffer.toBuffer();
  }

  /**
   * Get list of poll IDs
   * API: getpolls
   */
  async getPolls(): Promise<string[]> {
    try {
      const url = this.apiBaseUrl;
      const param = {
        jsonrpc: '2.0',
        method: 'getpolls',
        params: [],
        id: '1'
      };

      Logger.log(App.MAINCHAIN_POLLS, 'getpolls - calling:', url, 'with params:', param);

      const response = await this.globalJsonRPCService.httpPost(url, param, 'mainchain-polls');

      Logger.log(App.MAINCHAIN_POLLS, 'getpolls - response:', response);
      return Promise.resolve(response?.ids || []);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getpolls error:', err);
      return Promise.resolve([]);
    }
  }

  /**
   * Get poll info for multiple polls
   * API: getPollInfo
   */
  async getPollInfo(ids: string[]): Promise<Poll[]> {
    try {
      const url = this.apiBaseUrl;
      const param = {
        jsonrpc: '2.0',
        method: 'getpollinfo',
        params: { ids },
        id: '1'
      };

      Logger.log(App.MAINCHAIN_POLLS, 'getPollInfo - calling:', url, 'ids:', ids);

      const polls = await this.globalJsonRPCService.httpPost<Poll[]>(url, param, 'mainchain-polls');

      Logger.log(App.MAINCHAIN_POLLS, 'getPollInfo - polls:', polls);

      // Sort polls by start date ascending
      if (polls && polls.length > 0) {
        polls.sort((a, b) => a.startTime - b.startTime);
      }

      return polls;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getPollInfo error:', err);
      return Promise.resolve([]);
    }
  }

  /**
   * Get poll details including votes
   * API: getPollDetails
   */
  async getPollDetails(id: string): Promise<PollDetails | null> {
    try {
      const url = this.apiBaseUrl;
      const param = {
        jsonrpc: '2.0',
        method: 'getpolldetails',
        params: { id }
      };

      Logger.log(App.MAINCHAIN_POLLS, 'getPollDetails - calling:', url, 'id:', id);

      const response = await this.globalJsonRPCService.httpPost(url, param, 'mainchain-polls');

      Logger.log(App.MAINCHAIN_POLLS, 'getPollDetails - response:', response);
      return Promise.resolve(response || null);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getPollDetails error:', err);
      return Promise.resolve(null);
    }
  }

  /**
   * Submit a vote by creating a transaction with vote data in memo
   * @param pollId - Poll ID
   * @param option - Selected choice index
   * @param voteAmount - Vote amount in sELA (smallest unit), already calculated
   */
  async submitVote(pollId: string, option: number, voteAmount: BigNumber): Promise<string> {
    try {
      Logger.log(
        App.MAINCHAIN_POLLS,
        'submitVote - pollId:',
        pollId,
        'option:',
        option,
        'voteAmount:',
        voteAmount.toString()
      );

      // Get mainchain subwallet
      const networkWallet = this.walletService.activeNetworkWallet.value;
      if (!networkWallet) {
        throw new Error('No active network wallet found');
      }

      // Get standard subwallets (includes ELA mainchain)
      const mainchainSubWallet = networkWallet.getSubWallet('ELA') as MainChainSubWallet;
      if (!mainchainSubWallet) {
        throw new Error('Mainchain subwallet not found');
      }

      // Get self address
      const selfAddress = mainchainSubWallet.getCurrentReceiverAddress();
      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - selfAddress:', selfAddress);

      // Encode vote memo
      const amountString = voteAmount.dividedBy(Config.SELAAsBigNumber).toString(10); // Convert to ELA string
      const pollIdHex = pollId.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);

      const voteMemo = await this.encodeVoteMemo(this.USER_VOTE_FLAG, pollIdHex, option, amountString);

      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - voteMemoHex:', voteMemo);

      // Create transaction - send to self with vote amount
      const voteAmountELA = voteAmount.dividedBy(Config.SELAAsBigNumber);
      const rawTx = await mainchainSubWallet.createPaymentTransaction(selfAddress, voteAmountELA, voteMemo);

      if (!rawTx) {
        throw new Error('Failed to create payment transaction');
      }

      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - rawTx created:', rawTx);

      // Sign and send
      const transfer = new Transfer();
      transfer.masterWalletId = networkWallet.masterWallet.id;
      transfer.subWalletId = StandardCoinName.ELA;

      const result = await mainchainSubWallet.signAndSendRawTransaction(
        rawTx,
        transfer,
        true, // navigateHomeAfterCompletion
        true, // forcePasswordPrompt
        true // visualFeedback
      );

      if (!result.published || !result.txid) {
        throw new Error(result.status === 'cancelled' ? 'Transaction cancelled' : 'Failed to publish transaction');
      }

      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - transaction published:', result.txid);
      return result.txid;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'submitVote error:', err);
      throw err;
    }
  }

  /**
   * Get user's vote for a specific poll
   */
  async getUserVote(pollId: string, userAddress: string): Promise<Vote | null> {
    try {
      const details = await this.getPollDetails(pollId);
      if (!details || !details.votes) {
        return null;
      }

      return details.votes.find(vote => vote.voter.toLowerCase() === userAddress.toLowerCase());
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getUserVote error:', err);
      return null;
    }
  }

  /**
   * Save vote information to local storage
   */
  async saveVoteToLocalStorage(pollId: string, option: number, voteAmount: BigNumber): Promise<void> {
    try {
      const storedVoteInfo: StoredVoteInfo = {
        pollId,
        voteAmount: voteAmount.toString(),
        voteTimestamp: Math.floor(Date.now() / 1000), // Unix timestamp
        option
      };
      await this.localStorage.saveVote(storedVoteInfo);
      Logger.log(App.MAINCHAIN_POLLS, 'Vote saved to local storage:', pollId);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error saving vote to local storage:', err);
      // Don't throw - this is not critical, vote was already submitted
    }
  }

  /**
   * Get stored vote information from local storage
   */
  async getStoredVote(pollId: string): Promise<StoredVoteInfo | null> {
    return await this.localStorage.getVote(pollId);
  }

  /**
   * Check if user has voted on a poll (either from API or local storage)
   */
  async hasVoted(pollId: string, userAddress: string): Promise<boolean> {
    // Check API first
    const apiVote = await this.getUserVote(pollId, userAddress);
    if (apiVote) {
      return true;
    }
    // Check local storage
    const storedVote = await this.getStoredVote(pollId);
    return storedVote !== null;
  }
}
