import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BigNumber } from 'bignumber.js';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { Config } from 'src/app/wallet/config/Config';
import { StandardCoinName } from 'src/app/wallet/model/coin';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { PollDetails } from '../../model/poll-details.model';
import { PollStatus } from '../../model/poll-status.enum';
import { StoredVoteInfo } from '../../model/stored-vote-info.model';
import { Vote } from '../../model/vote.model';
import { MainchainPollsService } from '../../services/mainchain-polls.service';

@Component({
  selector: 'app-poll-detail',
  templateUrl: './poll-detail.page.html',
  styleUrls: ['./poll-detail.page.scss']
})
export class PollDetailPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public pollId: string;
  public pollDetails: PollDetails | null = null;
  public loading = false;
  public loadingWalletInfo = false;
  public voting = false;

  // Wallet info
  public walletAddress = '';
  public walletBalance: BigNumber | null = null;
  public availableBalance: BigNumber | null = null; // Balance - 1 ELA for fees
  public userVote: Vote | null = null;
  public storedVote: StoredVoteInfo | null = null; // Vote from local storage

  public selectedChoice: number | null = null;

  constructor(
    public theme: GlobalThemeService,
    private pollsService: MainchainPollsService,
    private route: ActivatedRoute,
    public translate: TranslateService,
    private walletNetworkService: WalletNetworkService,
    private walletService: WalletService,
    private popupService: GlobalPopupService,
    private globalNative: GlobalNativeService
  ) {
    this.pollId = this.route.snapshot.params.id;
  }

  ngOnInit() {}

  async ionViewWillEnter() {
    await this.init();
  }

  async init() {
    this.titleBar.setTitle(this.translate.instant('mainchainpolls.poll-detail'));
    await this.loadPollDetails();
    await this.loadWalletInfo();
  }

  async loadPollDetails() {
    try {
      this.loading = true;
      this.pollDetails = await this.pollsService.getPollDetails(this.pollId);
      this.loading = false;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'loadPollDetails error:', err);
      this.loading = false;
    }
  }

  async loadWalletInfo() {
    try {
      this.loadingWalletInfo = true;
      const networkWallet = this.walletService.activeNetworkWallet.value;
      if (!networkWallet) {
        Logger.warn(App.MAINCHAIN_POLLS, 'No active network wallet');
        this.loadingWalletInfo = false;
        return;
      }

      const mainchainNetwork = this.walletNetworkService.getNetworkByKey('elastos');
      if (!mainchainNetwork) {
        Logger.warn(App.MAINCHAIN_POLLS, 'Elastos mainchain network not found');
        this.loadingWalletInfo = false;
        return;
      }

      const mainchainWallet = await mainchainNetwork.createNetworkWallet(networkWallet.masterWallet, false);
      if (!mainchainWallet) {
        Logger.warn(App.MAINCHAIN_POLLS, 'Failed to create mainchain wallet');
        this.loadingWalletInfo = false;
        return;
      }

      const mainchainSubWallet = mainchainWallet.getSubWallet(StandardCoinName.ELA) as MainChainSubWallet;
      if (!mainchainSubWallet) {
        Logger.warn(App.MAINCHAIN_POLLS, 'Mainchain subwallet not found');
        this.loadingWalletInfo = false;
        return;
      }

      // Get address
      this.walletAddress = mainchainSubWallet.getCurrentReceiverAddress();
      Logger.log(App.MAINCHAIN_POLLS, 'Wallet address:', this.walletAddress);

      // Get balance
      this.walletBalance = await mainchainSubWallet.getTotalBalanceByType(true, false);
      if (this.walletBalance) {
        this.availableBalance = this.walletBalance;
        if (this.availableBalance.isLessThanOrEqualTo(0)) {
          this.availableBalance = new BigNumber(0);
        }
      }

      // Load stored vote from local storage (sandboxed per wallet address)
      if (this.pollId && this.walletAddress) {
        this.storedVote = await this.pollsService.getStoredVote(this.pollId, this.walletAddress);
      }

      // Load user vote from API if exists
      if (this.pollId && this.walletAddress) {
        this.userVote = await this.pollsService.getUserVote(this.pollId, this.walletAddress);
      }
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'loadWalletInfo error:', err);
    } finally {
      this.loadingWalletInfo = false;
    }
  }

  selectChoice(choiceIndex: number) {
    if (this.hasAlreadyVoted()) {
      // Already voted
      return;
    }
    this.selectedChoice = choiceIndex;
  }

  async vote() {
    if (this.selectedChoice === null || this.selectedChoice === undefined) {
      await this.popupService.ionicAlert('mainchainpolls.select-choice', 'mainchainpolls.select-choice-message');
      return;
    }

    // Check minimum balance requirement (need more than 1 ELA)
    const oneELA = new BigNumber(1).multipliedBy(Config.SELAAsBigNumber);
    if (!this.walletBalance || this.walletBalance.isLessThanOrEqualTo(oneELA)) {
      this.globalNative.genericToast('mainchainpolls.insufficient-balance-toast', 3000);
      return;
    }

    if (!this.availableBalance || this.availableBalance.isLessThanOrEqualTo(0)) {
      this.globalNative.genericToast('mainchainpolls.insufficient-balance-toast', 3000);
      return;
    }

    // Show confirmation
    const confirmed = await this.showVoteConfirmation();
    if (!confirmed) {
      return;
    }

    try {
      this.voting = true;
      Logger.log(App.MAINCHAIN_POLLS, 'Submitting vote - pollId:', this.pollId, 'choice:', this.selectedChoice);

      // Calculate vote amount
      const voteAmount = this.pollsService.calculateVoteAmount(this.availableBalance);
      if (!voteAmount) {
        throw new Error('Insufficient balance for voting');
      }

      const txId = await this.pollsService.submitVote(this.pollId, this.selectedChoice, voteAmount);
      Logger.log(App.MAINCHAIN_POLLS, 'Vote submitted, txId:', txId);

      // Save vote to local storage (sandboxed per wallet address)
      if (this.pollDetails && this.walletAddress) {
        await this.pollsService.saveVoteToLocalStorage(
          this.pollId,
          this.selectedChoice,
          voteAmount,
          this.walletAddress
        );
      }

      const successMessage = this.translate.instant('mainchainpolls.vote-success-message', { txId });
      await this.popupService.ionicAlert('mainchainpolls.vote-success', successMessage);

      // Reload poll details and wallet info
      await this.loadPollDetails();
      await this.loadWalletInfo();
      this.selectedChoice = null;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Vote error:', err);
      await this.popupService.ionicAlert(
        'mainchainpolls.vote-error',
        err.message || 'mainchainpolls.vote-error-message'
      );
    } finally {
      this.voting = false;
    }
  }

  private async showVoteConfirmation(): Promise<boolean> {
    // Calculate actual vote amount using shared service method
    const voteAmount = this.pollsService.calculateVoteAmount(this.availableBalance);
    if (!voteAmount) {
      // This shouldn't happen as we check canVote() before showing confirmation
      return false;
    }
    const voteAmountString = voteAmount.dividedBy(Config.SELAAsBigNumber).toFixed(3);

    const confirmed = await this.popupService.showConfirmationPopup(
      this.translate.instant('mainchainpolls.confirm-vote'),
      this.translate.instant('mainchainpolls.confirm-vote-message', {
        amount: voteAmountString
      }),
      this.translate.instant('common.confirm'),
      '' // No icon
    );

    return confirmed;
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  formatBalance(balance: BigNumber | null): string {
    if (!balance) {
      return '0';
    }
    return balance.dividedBy(Config.SELAAsBigNumber).toFixed(3);
  }

  formatVoteAmount(amount: string): string {
    if (!amount) {
      return '0';
    }
    try {
      // Amount is already in ELA units (from API or normalized from stored vote)
      const amountBN = new BigNumber(amount);
      return amountBN.toFixed(2);
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'Error formatting vote amount:', err);
      return amount;
    }
  }

  getStatusClass(status: PollStatus | string): string {
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;
    if (normalizedStatus === 'voting') {
      return 'active';
    } else if (normalizedStatus === 'finished') {
      return 'ended';
    } else {
      return 'upcoming';
    }
  }

  isPollActive(pollDetails: PollDetails | null): boolean {
    if (!pollDetails) {
      return false;
    }
    const status: PollStatus = pollDetails.status;
    return status === 'voting';
  }

  isPollNotActive(pollDetails: PollDetails | null): boolean {
    if (!pollDetails) {
      return false;
    }
    return !this.isPollActive(pollDetails);
  }

  getPollInactiveMessage(pollDetails: PollDetails | null): string {
    if (!pollDetails) {
      return '';
    }
    const status: PollStatus = pollDetails.status;
    if (status === 'finished') {
      return this.translate.instant('mainchainpolls.poll-finished');
    } else if (status === 'upcoming') {
      return this.translate.instant('mainchainpolls.poll-not-started');
    }
    return this.translate.instant('mainchainpolls.poll-not-active');
  }

  getPollInactiveStatusClass(pollDetails: PollDetails | null): string {
    if (!pollDetails) {
      return '';
    }
    const status: PollStatus = pollDetails.status;
    if (status === 'finished') {
      return 'finished';
    } else if (status === 'upcoming') {
      return 'upcoming';
    }
    return '';
  }

  getPollInactiveClasses(pollDetails: PollDetails | null): string {
    const baseClass = 'cannot-vote-info';
    const statusClass = this.getPollInactiveStatusClass(pollDetails);
    return statusClass ? `${baseClass} ${statusClass}` : baseClass;
  }

  canVote(): boolean {
    if (!this.pollDetails) {
      return false;
    }
    if (this.hasAlreadyVoted()) {
      return false; // Already voted
    }
    if (!this.isPollActive(this.pollDetails)) {
      return false; // Poll not active
    }
    if (!this.availableBalance || this.availableBalance.isLessThanOrEqualTo(0)) {
      return false; // Insufficient balance
    }
    return true;
  }

  /**
   * Check if user has already voted (either from API or local storage)
   */
  hasAlreadyVoted(): boolean {
    return !!this.userVote || !!this.storedVote;
  }

  /**
   * Get the vote information to display (prefer API vote over stored vote)
   */
  getDisplayVote(): Vote | null {
    if (this.userVote) {
      return this.userVote;
    }
    if (this.storedVote) {
      // Convert StoredVoteInfo to Vote object for display
      // Stored vote amount is in sELA, convert to ELA for consistency with API votes
      const voteAmountELA = new BigNumber(this.storedVote.voteAmount).dividedBy(Config.SELAAsBigNumber).toString(10);
      return {
        voter: this.walletAddress || '',
        amount: voteAmountELA,
        choice: this.storedVote.option
      };
    }
    return null;
  }

  /**
   * Get vote option/choice index
   */
  getVoteOption(): number | null {
    const displayVote = this.getDisplayVote();
    if (!displayVote) {
      return null;
    }
    return displayVote.choice;
  }

  /**
   * Calculate poll results by aggregating votes by choice
   */
  getPollResults(): Array<{
    choiceIndex: number;
    choiceTitle: string;
    voteAmount: BigNumber;
    percentage: number;
    voteCount: number;
  }> {
    if (!this.pollDetails || !this.pollDetails.votes || this.pollDetails.votes.length === 0) {
      return [];
    }

    // Aggregate votes by choice
    const votesByChoice: Map<number, { totalAmount: BigNumber; count: number }> = new Map();

    this.pollDetails.votes.forEach(vote => {
      const choiceIndex = vote.choice;
      // Vote amount from API is already in ELA units (not sELA)
      const voteAmount = new BigNumber(vote.amount);

      if (votesByChoice.has(choiceIndex)) {
        const existing = votesByChoice.get(choiceIndex);
        if (existing) {
          existing.totalAmount = existing.totalAmount.plus(voteAmount);
          existing.count += 1;
        }
      } else {
        votesByChoice.set(choiceIndex, {
          totalAmount: voteAmount,
          count: 1
        });
      }
    });

    // Calculate total votes
    let totalVotes = new BigNumber(0);
    votesByChoice.forEach(value => {
      totalVotes = totalVotes.plus(value.totalAmount);
    });

    // Build results array
    const results: Array<{
      choiceIndex: number;
      choiceTitle: string;
      voteAmount: BigNumber;
      percentage: number;
      voteCount: number;
    }> = [];

    this.pollDetails.choices.forEach((choiceTitle, index) => {
      const voteData = votesByChoice.get(index);
      const voteAmount = voteData ? voteData.totalAmount : new BigNumber(0);
      const voteCount = voteData ? voteData.count : 0;
      const percentage = totalVotes.isGreaterThan(0)
        ? voteAmount.dividedBy(totalVotes).multipliedBy(100).toNumber()
        : 0;

      results.push({
        choiceIndex: index,
        choiceTitle,
        voteAmount,
        percentage,
        voteCount
      });
    });

    // Sort by vote amount descending
    results.sort((a, b) => b.voteAmount.comparedTo(a.voteAmount));

    return results;
  }

  /**
   * Get total votes amount
   */
  getTotalVotesAmount(): BigNumber {
    if (!this.pollDetails || !this.pollDetails.votes || this.pollDetails.votes.length === 0) {
      return new BigNumber(0);
    }

    let total = new BigNumber(0);
    // Vote amounts from API are already in ELA units (not sELA)
    this.pollDetails.votes.forEach(vote => {
      total = total.plus(new BigNumber(vote.amount));
    });

    return total;
  }

  /**
   * Format percentage for display
   */
  formatPercentage(percentage: number): string {
    return percentage.toFixed(2);
  }
}
