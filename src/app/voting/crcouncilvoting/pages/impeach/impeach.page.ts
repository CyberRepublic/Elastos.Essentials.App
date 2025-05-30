import { Component, ViewChild } from '@angular/core';
import { VoteContentType, VotesContentInfo, VotingInfo } from '@elastosfoundation/wallet-js-sdk';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { Util } from 'src/app/model/util';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { DposStatus, VoteService } from 'src/app/voting/services/vote.service';
import { StakeService } from 'src/app/voting/staking/services/stake.service';
import { Config } from 'src/app/wallet/config/Config';
import { VoteContent, VoteTypeString } from 'src/app/wallet/model/elastos.types';
import { WalletType } from 'src/app/wallet/model/masterwallets/wallet.types';
import { CRCouncilService } from '../../services/crcouncil.service';

@Component({
    selector: 'app-impeach',
    templateUrl: './impeach.page.html',
    styleUrls: ['./impeach.page.scss'],
})
export class ImpeachCRMemberPage {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

    public member: any = {};
    public signingAndTransacting = false;
    public maxVotes = 0;
    public amount: number;
    private updatedBalance = false;

    constructor(
        public theme: GlobalThemeService,
        public translate: TranslateService,
        private globalNav: GlobalNavService,
        public crCouncilService: CRCouncilService,
        private voteService: VoteService,
        public popupProvider: GlobalPopupService,
        private globalNative: GlobalNativeService,
        private stakeService: StakeService,
    ) {

    }

    async ionViewWillEnter() {
        this.titleBar.setTitle(this.translate.instant('crcouncilvoting.impeachment'));
        this.member = this.crCouncilService.selectedMember;
        if (!this.updatedBalance) {
            await this.stakeService.getVoteRights();
            if (this.stakeService.votesRight.totalVotesRight > 0) {
                this.maxVotes = this.stakeService.votesRight.totalVotesRight;
            }
            else {
                let status = await this.voteService.dPoSStatus.value;
                if (status == DposStatus.DPoSV2) {
                    this.maxVotes = 0;
                }
                else if (this.voteService.sourceSubwallet.masterWallet.type == WalletType.MULTI_SIG_STANDARD) {
                    // Multi-signature wallets can only vote with staked ELA.
                    this.maxVotes = 0;
                } else {
                    this.maxVotes = await this.voteService.getMaxVotes();
                }
            }
            this.updatedBalance = true;
        }
    }

    cancel() {
        void this.globalNav.navigateBack();
    }

    // async voteImpeachCRMember() {
    //     await this.goTransaction();
    // }

    async goTransaction(): Promise<boolean> {
        switch (this.voteService.sourceSubwallet.masterWallet.type) {
            case WalletType.STANDARD:
            case WalletType.MULTI_SIG_STANDARD:
                break;
            case WalletType.LEDGER:
                await this.popupProvider.ionicAlert('common.warning', 'voting.ledger-reject-voting');
                return;
            case WalletType.MULTI_SIG_EVM_GNOSIS:
                await this.popupProvider.ionicAlert('common.warning', 'voting.multi-sign-reject-voting');
                return;
            default:
                // Should not happen.
                Logger.error(App.CRCOUNCIL_VOTING, 'Not support, pls check the wallet type:', this.voteService.sourceSubwallet.masterWallet.type)
                return;
        }

        this.signingAndTransacting = true;
        try {
            // Request the wallet to publish our vote.
            if (!await this.voteService.checkPendingBalance()) {
                return false;
            }
            if (!this.amount) {
                await this.popupProvider.ionicAlert("common.error", 'voting.vote-invalid');
                return false;
            }
            else if (this.amount > this.maxVotes) {
                await this.popupProvider.ionicAlert("common.error", 'crproposalvoting.greater-than-max-votes');
                return false;
            }
            else if (this.amount <= 0) {
                await this.popupProvider.ionicAlert("common.error", 'crproposalvoting.less-than-equal-zero-votes');
                return false;
            }

            const stakeAmount = Util.accMul(this.amount, Config.SELA).toString();
            if (this.stakeService.votesRight.totalVotesRight > 0) {
                await this.createVoteImpeachTransactionV2(stakeAmount);
            }
            else {
                await this.createVoteImpeachTransaction(stakeAmount);
            }
        }
        catch (e) {
            Logger.log(App.CRCOUNCIL_VOTING, 'goTransaction exception:', e);
        }
        finally {
            this.signingAndTransacting = false;
        }

        return true;
    }

    async createVoteImpeachTransaction(voteAmount: string) {

        Logger.log(App.CRCOUNCIL_VOTING, 'Creating vote transaction with amount', voteAmount);

        let votes = {};
        votes[this.member.cid] = voteAmount; // Vote with everything
        Logger.log(App.CRCOUNCIL_VOTING, "Vote:", votes);

        let crVoteContent: VoteContent = {
            Type: VoteTypeString.CRCImpeachment,
            Candidates: votes
        }

        const voteContent = [crVoteContent];

        try {
            const rawTx = await this.voteService.sourceSubwallet.createVoteTransaction(
                voteContent,
                '', //memo
            );
            Logger.log(App.CRCOUNCIL_VOTING, "rawTx:", rawTx);
            let ret = await this.voteService.signAndSendRawTransaction(rawTx);
            if (ret) {
                this.voteService.toastSuccessfully('crcouncilvoting.impeachment');
            }
        }
        catch (e) {
            await this.voteService.popupErrorMessage(e);
        }
    }

    async createVoteImpeachTransactionV2(voteAmount: string) {
        this.signingAndTransacting = true;
        Logger.log(App.CRCOUNCIL_VOTING, 'Creating vote transaction with amount', voteAmount);
        const voteContents: VotesContentInfo[] = [
            {
                VoteType: VoteContentType.CRCImpeachment,
                VotesInfo: [
                    {
                        Candidate: this.member.cid,
                        Votes: voteAmount,
                        Locktime: 0
                    }
                ]
            }
        ];

        const payload: VotingInfo = {
            Version: 0,
            Contents: voteContents
        };

        Logger.log(App.CRCOUNCIL_VOTING, 'Elastos DAO Impeachment payload', payload);

        try {
            const rawTx = await this.voteService.sourceSubwallet.createDPoSV2VoteTransaction(
                payload,
                '', //memo
            );
            Logger.log(App.CRCOUNCIL_VOTING, "rawTx:", rawTx);
            let ret = await this.voteService.signAndSendRawTransaction(rawTx);
            if (ret) {
                this.voteService.toastSuccessfully('crcouncilvoting.impeachment');
            }
        }
        catch (e) {
            await this.voteService.popupErrorMessage(e);
        }

        this.signingAndTransacting = false;
    }

    click0() {
        this.amount = 0;
    }

    clickMax() {
        this.amount = this.maxVotes;
    }

}



