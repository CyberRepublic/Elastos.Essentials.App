import { Component, OnInit, ViewChild } from '@angular/core';
import { VotesContentInfo, VotingInfo } from '@elastosfoundation/wallet-js-sdk';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { MenuSheetMenu } from 'src/app/components/menu-sheet/menu-sheet.component';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarIcon, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalTranslationService } from 'src/app/services/global.translation.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { UXService } from 'src/app/voting/services/ux.service';
import { VoteService } from 'src/app/voting/services/vote.service';
import { WalletType } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { ElastosStandardNetworkWallet } from 'src/app/wallet/model/networks/elastos/networkwallets/standard/elastos.networkwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { WalletUIService } from 'src/app/wallet/services/wallet.ui.service';
import { StakeService, VoteType } from '../../services/stake.service';


@Component({
    selector: 'app-home',
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss'],
})
export class StakingHomePage implements OnInit {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

    private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

    public showItems = [];
    public buttonList = [];
    public voteItems = [];

    public detail = false;
    public detailType = 0;
    public showVotesDetails = false;
    public voteType = VoteType.DPoSV2;
    public voteInfo: any;

    public dataFetched = false;
    public signingAndTransacting = false;
    public votesShowArrow = true;

    // Helper
    public WalletUtil = WalletUtil;
    public networkWallet: AnyNetworkWallet = null;

    private activeNetworkWalletSubscription: Subscription = null;

    constructor(
        public uxService: UXService,
        public translate: TranslateService,
        public stakeService: StakeService,
        public theme: GlobalThemeService,
        private globalNav: GlobalNavService,
        private globalNative: GlobalNativeService,
        private voteService: VoteService,
        public popupProvider: GlobalPopupService,
        public currencyService: CurrencyService,
        public walletManager: WalletService,
        private walletUIService: WalletUIService,
    ) {
    }

    ngOnInit() {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.activeNetworkWalletSubscription = this.walletManager.activeNetworkWallet.subscribe(async (activeNetworkWallet) => {
            if (activeNetworkWallet) {
              this.dataFetched = false;
              this.networkWallet = WalletService.instance.activeNetworkWallet.value;

              this.voteService.needFetchData[App.STAKING] = true;
              if (!await this.voteService.setNetworkWallet(this.networkWallet as ElastosStandardNetworkWallet, App.STAKING)) {
                  Logger.warn(App.STAKING, "Do not support this wallet:", this.networkWallet.masterWallet.name);
                  return this.globalNav.navigateHome();
              }

              await this.stakeService.initData();
              this.addShowItems();
              this.addButtonList();
              this.addVoteItems();
              this.votesShowArrow = this.stakeService.votesRight.totalVotesRight > 0;
              this.dataFetched = true;

              void this.updateRewardInfo()
            }
        })
    }

    ngOnDestroy() {
        if (this.activeNetworkWalletSubscription) {
            this.activeNetworkWalletSubscription.unsubscribe();
            this.activeNetworkWalletSubscription = null;
        }
    }

    ionViewWillEnter() {
        this.titleBar.setTitle(this.translate.instant('launcher.app-elastos-staking'));
    }

    addShowItems() {
        this.showItems = [];

        let totalRewardItems = [], availableRewardItems = [];
        if (this.stakeService.nodeRewardInfo) {
            totalRewardItems.push({
                title: this.translate.instant('staking.node-reward'),
                value: this.uxService.toThousands(this.stakeService.nodeRewardInfo.total),
            });
            availableRewardItems.push({
                title: this.translate.instant('staking.node-reward'),
                value: this.uxService.toThousands(this.stakeService.nodeRewardInfo.claimable),
            });
        }
        if (this.stakeService.rewardInfo) {
            totalRewardItems.push({
                title: this.translate.instant('staking.voting-reward'),
                value: this.uxService.toThousands(this.stakeService.rewardInfo.total),
            });
            availableRewardItems.push({
                title: this.translate.instant('staking.voting-reward'),
                value: this.uxService.toThousands(this.stakeService.rewardInfo.claimable),
            });
        }


        this.showItems.push(
            // {
            //     title: this.translate.instant('staking.staked'),
            //     value: this.stakeService.votesRight.maxStaked,
            // },
            {
                title: this.translate.instant('staking.your-rewards'),
                value: this.uxService.toThousands(this.stakeService.totalRewardInfo.total),
                rewardItems: totalRewardItems
            },
            {
                title: this.translate.instant('staking.available-reward'),
                value: this.uxService.toThousands(this.stakeService.totalRewardInfo.claimable),
                rewardItems: availableRewardItems
            },
        );
    }

    async updateRewardInfo() {
        await this.stakeService.getAllRewardInfo();
        this.addShowItems()
    }

    addButtonList() {
        this.buttonList = [];
        this.buttonList.push(
            {
                label: this.translate.instant('staking.stake'),
                icon: 'assets/staking/icons/stake.svg',
                url: '/staking/stake',
            },
            {
                label: this.translate.instant('staking.unstake'),
                icon: 'assets/staking/icons/unstake.svg',
                url: '/staking/unstake',
            },
            {
                label: this.translate.instant('staking.withdraw'),
                icon: 'assets/staking/icons/withdraw.svg',
                url: '/staking/withdraw',
            },
            {
                label: this.translate.instant('staking.unvote'),
                icon: 'assets/staking/icons/unvote.svg',
                url: '/staking/unvote',
            },
        );
    }

    addVoteItems() {
        this.voteItems = [];
        if (this.stakeService.votesRight.totalVotesRight > 0) {
            this.voteItems.push({
                title: "BPoS",
                type: VoteType.DPoSV2,
                votes: this.uxService.toThousands(this.stakeService.votesRight.votes[VoteType.DPoSV2]),
                ratio: this.uxService.getPercentage(this.stakeService.votesRight.votes[VoteType.DPoSV2], this.stakeService.votesRight.totalVotesRight),
                stakeuntilDate: this.stakeService.votesRight.dpos2LockTimeDate,
                stakeuntilExpiredIn: this.stakeService.votesRight.dpos2LockTimeExpired,
            });
            for (let i = 0; i < 4; i++) {
                var item = {
                    title: this.translate.instant(this.stakeService.votesRight.voteInfos[i].title),
                    type: i,
                    votes: this.uxService.toThousands(this.stakeService.votesRight.votes[i]),
                    ratio: this.uxService.getPercentage(this.stakeService.votesRight.votes[i], this.stakeService.votesRight.totalVotesRight),
                } as any;
                this.voteItems.push(item);
            }
        }
    }

    async unvote() {
        if (!this.stakeService.votesRight.voteInfos || this.stakeService.votesRight.voteInfos.length < 1) {
            this.globalNative.genericToast('dposvoting.no-voting');
            return
        }

        var voteContents: VotesContentInfo[] = [];
        for (let i = 0; i < 4; i++) {
            let voteInfo = this.stakeService.votesRight.voteInfos[i];
            if (voteInfo) {
                let list = voteInfo.list;
                if (list && list.length > 0) {
                    voteContents.push({
                        VoteType: i,
                        VotesInfo: []
                    })
                }
            }
        }

        if (voteContents.length == 0) {
            this.globalNative.genericToast('staking.no-cancellable-votes');
            return;
        }

        if (!await this.popupProvider.ionicConfirm('staking.unvote', 'staking.unvote-message', 'common.ok', 'common.cancel')) {
            return;
        }

        this.signingAndTransacting = true;

        const payload: VotingInfo = {
            Version: 0,
            Contents: voteContents
        };

        Logger.log(App.STAKING, 'unvote payload', payload);

        try {
            if (!await this.voteService.checkWalletAvailableForVote()) {
                return;
            }

            const rawTx = await this.voteService.sourceSubwallet.createDPoSV2VoteTransaction(
                payload,
                '', //memo
            );
            Logger.log(App.STAKING, "rawTx:", rawTx);
            let ret = await this.voteService.signAndSendRawTransaction(rawTx);
            if (ret) {
                this.voteService.toastSuccessfully('staking.unvote');
            }
        }
        catch (e) {
            await this.voteService.popupErrorMessage(e);
        }
        finally {
            this.signingAndTransacting = false;
        }
    }

    clickDetails(event: Event, type: VoteType) {
        if (type == VoteType.DPoSV2) {
            void this.voteService.selectWalletAndNavTo(App.DPOS2, '/dpos2/menu/my-votes');
        }
        else {
            this.voteType = type;
            this.showVotesDetails = true;
            event.stopPropagation();
        }

    }

    async clickButton(url: string) {
        if (url == "/staking/unvote") {
            await this.unvote();
        }
        else if (url == "/staking/unstake" && this.stakeService.votesRight.minRemainVoteRight == 0) {
            if (this.stakeService.votesRight.totalVotesRight != 0) {
                this.globalNative.genericToast('staking.no-remain-stake');
            } else {
                this.globalNative.genericToast('staking.no-stake');
            }
        }
        else if (url == "/staking/withdraw") {
            if (this.stakeService.totalRewardInfo.claimable == 0) {
                this.globalNative.genericToast('staking.no-reward');
            }
            else {
                if (this.stakeService.rewardInfo && this.stakeService.nodeRewardInfo) {
                    this.pickWithdrawType(url);
                } else {
                    let withdrawNodeReward = false;
                    if (this.stakeService.nodeRewardInfo) {
                        withdrawNodeReward = true;
                    }
                    this.goTo(url, { state: { withdrawNodeReward: withdrawNodeReward} });
                }
            }
        }
        else {
            this.goTo(url);
        }

    }

    goTo(url: string, option = undefined) {
        void this.globalNav.navigateTo(App.STAKING, url, option);
    }

    async doRefresh(event) {
        this.voteService.needFetchData[App.STAKING] = true;
        await this.stakeService.initData();

        setTimeout(() => {
            event.target.complete();
        }, 500);
    }

    public pickWithdrawType(url) {
        let menuItems: MenuSheetMenu[] =  [
            {
                title: GlobalTranslationService.instance.translateInstant("staking.node-reward"),
                routeOrAction: () => {
                  this.goTo(url, { state: { withdrawNodeReward: true} });
                }
            },
            {
                title: GlobalTranslationService.instance.translateInstant("staking.voting-reward"),
                routeOrAction: () => {
                  this.goTo(url, { state: { withdrawNodeReward: false} });
                }
            }
        ]

        let menu: MenuSheetMenu = {
            title: GlobalTranslationService.instance.translateInstant("staking.choose-reward-type"),
            items: menuItems
        };

        void this.globalNative.showGenericBottomSheetMenuChooser(menu);
    }

    public getPotentialActiveWallets(): AnyNetworkWallet[] {
        return this.walletManager.getNetworkWalletsList();
    }

    /**
     * Shows the wallet selector component to pick a different wallet
     */
    public pickOtherWallet() {
        void this.walletUIService.chooseActiveWallet(networkWallet => {
            // Choose only among multisig wallets
            if (networkWallet.masterWallet.type == WalletType.LEDGER)
                return false;

            return true;
        });
    }
}
