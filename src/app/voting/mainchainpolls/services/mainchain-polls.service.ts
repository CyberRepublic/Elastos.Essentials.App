import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { Buffer } from 'buffer';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { Config } from 'src/app/wallet/config/Config';
import { StandardCoinName } from 'src/app/wallet/model/coin';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { Transfer } from 'src/app/wallet/services/cointransfer.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { VotingDetails } from '../model/voting-details.model';
import { VotingInfo } from '../model/voting-info.model';

@Injectable({
  providedIn: 'root'
})
export class MainchainPollsService {
  // TODO: Set the actual API base URL
  private apiBaseUrl = 'https://api.example.com/mainchain-polls'; // Stub URL

  private readonly USER_VOTE_FLAG = 'uservote';
  private readonly USER_VOTE_FLAG_BYTE_LENGTH = 8; // 8 bytes

  constructor(
    private http: HttpClient,
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
   * API: getPoll
   */
  getPoll(): Promise<string[]> {
    try {
      // TODO: Replace with actual API call
      const url = `${this.apiBaseUrl}/getpoll`;
      Logger.log(App.MAINCHAIN_POLLS, 'getPoll - calling:', url);

      // Stub response - placeholder poll for testing
      const response = {
        ids: ['0x' + '0'.repeat(64)] // Placeholder poll ID (64 hex chars = 32 bytes)
      };

      // TODO: Uncomment when API is ready
      // const response = await this.http.get<{ ids: string[] }>(url).toPromise();

      Logger.log(App.MAINCHAIN_POLLS, 'getPoll - response:', response);
      return Promise.resolve(response.ids || []);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getPoll error:', err);
      return Promise.resolve([]);
    }
  }

  /**
   * Get voting info for multiple polls
   * API: getVotingInfo
   */
  getVotingInfo(ids: string[]): Promise<VotingInfo[]> {
    try {
      // TODO: Replace with actual API call
      const url = `${this.apiBaseUrl}/getVotingInfo`;
      Logger.log(App.MAINCHAIN_POLLS, 'getVotingInfo - calling:', url, 'ids:', ids);

      // Stub response - placeholder poll for testing
      const placeholderPollId = '0x' + '0'.repeat(64);
      const response = {
        votingInfos:
          ids.includes(placeholderPollId) || ids.includes(placeholderPollId.replace('0x', ''))
            ? [
                {
                  id: placeholderPollId.replace('0x', ''),
                  status: 'active',
                  description: 'Test Poll - Mainchain Voting',
                  startTime: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
                  endTime: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days from now
                  choices: [
                    'Approve the proposal to increase the block size limit to 4MB',
                    'Reject the proposal and maintain current block size limit',
                    'Request further discussion and delay the decision',
                    'Approve with modifications to implement gradual increase over 6 months'
                  ]
                } as VotingInfo
              ]
            : ([] as VotingInfo[])
      };

      // TODO: Uncomment when API is ready
      // const response = await this.http.post<{ votingInfos: VotingInfo[] }>(url, { ids }).toPromise();

      Logger.log(App.MAINCHAIN_POLLS, 'getVotingInfo - response:', response);
      return Promise.resolve(response.votingInfos || []);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getVotingInfo error:', err);
      return Promise.resolve([]);
    }
  }

  /**
   * Get voting details including votes
   * API: getVotingDetails
   */
  getVotingDetails(id: string): Promise<VotingDetails | null> {
    try {
      // TODO: Replace with actual API call
      const url = `${this.apiBaseUrl}/getVotingDetails`;
      Logger.log(App.MAINCHAIN_POLLS, 'getVotingDetails - calling:', url, 'id:', id);

      // Stub response - placeholder poll details for testing
      const placeholderPollId = '0x' + '0'.repeat(64);
      const pollIdHex = id.replace(/^0x/i, '');
      const placeholderIdHex = placeholderPollId.replace(/^0x/i, '');

      let response: VotingDetails | null = null;
      if (pollIdHex === placeholderIdHex || pollIdHex === '0'.repeat(64)) {
        response = {
          status: 'active',
          description: 'Test Poll - Mainchain Voting',
          startTime: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
          endTime: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days from now
          choices: [
            'Approve the proposal to increase the block size limit to 4MB',
            'Reject the proposal and maintain current block size limit',
            'Request further discussion and delay the decision',
            'Approve with modifications to implement gradual increase over 6 months'
          ],
          votes: []
        };
      }

      // TODO: Uncomment when API is ready
      // const response = await this.http.post<VotingDetails>(url, { id }).toPromise();

      Logger.log(App.MAINCHAIN_POLLS, 'getVotingDetails - response:', response);
      return Promise.resolve(response);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getVotingDetails error:', err);
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
  async getUserVote(pollId: string, userAddress: string): Promise<{ option: number; amount: string } | null> {
    try {
      const details = await this.getVotingDetails(pollId);
      if (!details || !details.votes) {
        return null;
      }

      const userVote = details.votes.find(vote => vote.voter.toLowerCase() === userAddress.toLowerCase());
      if (!userVote) {
        return null;
      }

      return {
        option: userVote.option,
        amount: userVote.amount
      };
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'getUserVote error:', err);
      return null;
    }
  }
}
