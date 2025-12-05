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
import { Vote } from '../model/vote.model';

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
    private walletService: WalletService
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
  private async encodeVoteMemo(userVoteFlag: string, pollId: string, option: number, amount: string): Promise<string> {
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

    // 4. amount - string (UTF-8 encoded)
    const amountBytes = Buffer.from(amount, 'utf8');
    buffer.writeBuffer(amountBytes);

    return buffer.toString('hex');
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
   * Generate vote memo hex string for testing/debugging
   * This method generates the memo without creating a transaction
   */
  async generateVoteMemoForTesting(pollId: string, option: number, amount: string): Promise<string> {
    const pollIdHex = pollId.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
    return await this.encodeVoteMemo(this.USER_VOTE_FLAG, pollIdHex, option, amount);
  }

  /**
   * Submit a vote by creating a transaction with vote data in memo
   * Sends ELA to self with max amount - 1 ELA (to account for fees)
   */
  async submitVote(pollId: string, option: number): Promise<string> {
    try {
      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - pollId:', pollId, 'option:', option);

      // Get mainchain subwallet
      const networkWallet = this.walletService.activeNetworkWallet.value;
      if (!networkWallet) {
        throw new Error('No active network wallet found');
      }

      const mainchainNetwork = this.walletNetworkService.getNetworkByKey('elastos');
      if (!mainchainNetwork) {
        throw new Error('Elastos mainchain network not found');
      }

      const mainchainWallet = await mainchainNetwork.createNetworkWallet(networkWallet.masterWallet, false);
      if (!mainchainWallet) {
        throw new Error('Failed to create mainchain network wallet');
      }

      const mainchainSubWallet = mainchainWallet.getSubWallet(StandardCoinName.ELA) as MainChainSubWallet;
      if (!mainchainSubWallet) {
        throw new Error('Mainchain subwallet not found');
      }

      // Get current balance
      const balance = await mainchainSubWallet.getTotalBalanceByType(true, false); // spendable balance
      if (!balance || balance.isLessThanOrEqualTo(0)) {
        throw new Error('Insufficient balance');
      }

      // Calculate vote amount: max balance - 1 ELA (to account for fees)
      const voteAmount = this.calculateVoteAmount(balance);
      if (!voteAmount) {
        throw new Error('Insufficient balance for voting (need at least 1 ELA + fees)');
      }

      Logger.log(
        App.MAINCHAIN_POLLS,
        'submitVote - balance:',
        balance.toString(),
        'voteAmount:',
        voteAmount.toString()
      );

      // Get self address
      const selfAddress = mainchainSubWallet.getCurrentReceiverAddress();
      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - selfAddress:', selfAddress);

      // Encode vote memo
      const amountString = voteAmount.dividedBy(Config.SELAAsBigNumber).toString(10); // Convert to ELA string
      const pollIdHex = pollId.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);

      const voteMemoHex = await this.encodeVoteMemo(this.USER_VOTE_FLAG, pollIdHex, option, amountString);

      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - voteMemoHex:', voteMemoHex);

      // Create transaction - send to self with vote amount
      const voteAmountELA = voteAmount.dividedBy(Config.SELAAsBigNumber);
      const rawTx = await mainchainSubWallet.createPaymentTransaction(selfAddress, voteAmountELA, voteMemoHex);

      Logger.log(App.MAINCHAIN_POLLS, 'submitVote - rawTx created');

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
}
