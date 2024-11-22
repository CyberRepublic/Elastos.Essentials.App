import { Component, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { Util } from 'src/app/model/util';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { ProposalDetails } from 'src/app/voting/crproposalvoting/model/proposal-details';
import { ProposalService } from 'src/app/voting/crproposalvoting/services/proposal.service';
import { VoteService } from 'src/app/voting/services/vote.service';
import { Config } from 'src/app/wallet/config/Config';
import { CRCommand, CROperationsService } from '../../../services/croperations.service';

type WithdrawCommand = CRCommand & {
    data: {
        amount: number,
        ownerpublickey: string,
        proposalhash: string,
        recipient: string,
        userdid: string,
    },
}
@Component({
    selector: 'page-withdraw',
    templateUrl: 'withdraw.html',
    styleUrls: ['./withdraw.scss']
})
export class WithdrawPage {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

    public onGoingCommand: WithdrawCommand;
    public signingAndSendingProposalResponse = false;
    public proposalDetail: ProposalDetails;
    public proposalDetailFetched = false;
    public Config = Config;
    public amount = 0;

    constructor(
        private crOperations: CROperationsService,
        public translate: TranslateService,
        private voteService: VoteService,
        private proposalService: ProposalService,
        public theme: GlobalThemeService,
        private globalNav: GlobalNavService,
    ) {

    }

    async ionViewWillEnter() {
        this.titleBar.setTitle(this.translate.instant('crproposalvoting.withdraw'));
        if (this.proposalDetail) {
            return;
        }
        this.proposalDetailFetched = false;

        this.onGoingCommand = this.crOperations.onGoingCommand as WithdrawCommand;
        Logger.log(App.CRPROPOSAL_VOTING, "WithdrawCommand", this.onGoingCommand);

        this.proposalDetail = await this.crOperations.getCurrentProposal();
        this.proposalDetailFetched = true;

        if (this.proposalDetail) {
            this.onGoingCommand.data.ownerPublicKey = await Util.getSelfPublicKey();

            this.amount = await this.proposalService.fetchWithdraws(this.proposalDetail.proposalHash) * Config.SELA;
            this.amount = Math.round(this.amount);
        }
    }

    ionViewWillLeave() {
        void this.crOperations.sendIntentResponse();
    }

    cancel() {
        void this.globalNav.navigateBack();
    }

    async signAndWithdraw() {

        this.signingAndSendingProposalResponse = true;

        try {
            if (!await this.voteService.checkWalletAvailableForVote()) {
                return;
            }

            //Get payload
            var payload = this.getWithdrawPayload(this.onGoingCommand);
            Logger.log(App.CRPROPOSAL_VOTING, "Got payload.", payload);

            //Get digest
            var digest = await this.voteService.sourceSubwallet.proposalWithdrawDigest(payload);
            // digest = Util.reverseHexToBE(digest);
            Logger.log(App.CRPROPOSAL_VOTING, "Got proposal digest.", digest);

            //Get did sign digest
            let ret = await this.crOperations.sendSignDigestIntent({
                data: digest,
            });

            if (!ret) {
                // Operation cancelled, cancel the operation silently.
                return;
            }

            Logger.log(App.CRPROPOSAL_VOTING, "Got signed digest.", ret);
            //Create transaction and send
            payload.Signature = ret.result.signature;
            const rawTx = await this.voteService.sourceSubwallet.createProposalWithdrawTransaction(payload, '');
            await this.crOperations.signAndSendRawTransaction(rawTx);

            void this.crOperations.sendIntentResponse();
        }
        catch (e) {
            await this.crOperations.popupErrorMessage(e);
        }
        finally {
            this.signingAndSendingProposalResponse = false;
        }
    }

    private getWithdrawPayload(command: WithdrawCommand): any {
        let payload = {
            ProposalHash: command.data.proposalHash,
            OwnerPublicKey: command.data.ownerPublicKey,
            Recipient: command.data.recipient,
            Amount: this.amount.toString(),
        };
        return payload;
    }
}