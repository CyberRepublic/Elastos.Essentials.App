import { Component, NgZone, ViewChild } from '@angular/core';
import { Keyboard } from '@awesome-cordova-plugins/keyboard/ngx';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { Util } from 'src/app/model/util';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { ProposalDetails } from 'src/app/voting/crproposalvoting/model/proposal-details';
import { VoteService } from 'src/app/voting/services/vote.service';
import { CRCommand, CRCommandType, CROperationsService } from '../../../services/croperations.service';
import { DraftService } from '../../../services/draft.service';
import { ProposalService } from '../../../services/proposal.service';

type UpdateMilestoneCommand = CRCommand & {
    data: {
        messageHash: string,
        messageData: string,
        newownerpubkey: string,
        ownerpubkey: string,
        proposalHash: string,
        proposaltrackingtype: string,
        stage: number,
        userdid: string
    },
}

@Component({
    selector: 'page-update-milestone',
    templateUrl: 'updatemilestone.html',
    styleUrls: ['./updatemilestone.scss']
})
export class UpdatMilestonePage {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

    private originalRequestJWT: string;
    public onGoingCommand: UpdateMilestoneCommand;
    public signingAndSendingProposalResponse = false;
    public proposalDetail: ProposalDetails;
    public proposalDetailFetched = false;
    public isKeyboardHide = true;
    public content = "";

    constructor(
        private proposalService: ProposalService,
        private crOperations: CROperationsService,
        public translate: TranslateService,
        private globalNav: GlobalNavService,
        private voteService: VoteService,
        public theme: GlobalThemeService,
        private globalNative: GlobalNativeService,
        public zone: NgZone,
        public keyboard: Keyboard,
        private draftService: DraftService,
    ) {

    }

    async ionViewWillEnter() {
        this.titleBar.setTitle(this.translate.instant('crproposalvoting.update-milestone'));
        if (this.proposalDetail) {
            return;
        }
        this.proposalDetailFetched = false;

        this.onGoingCommand = this.crOperations.onGoingCommand as UpdateMilestoneCommand;
        Logger.log(App.CRPROPOSAL_VOTING, "UpdateMilestoneCommand", this.onGoingCommand);

        this.proposalDetail = await this.crOperations.getCurrentProposal();
        this.proposalDetailFetched = true;

        if (this.proposalDetail) {
            this.keyboard.onKeyboardWillShow().subscribe(() => {
                this.zone.run(() => {
                    this.isKeyboardHide = false;
                });
            });

            this.keyboard.onKeyboardWillHide().subscribe(() => {
                this.zone.run(() => {
                    this.isKeyboardHide = true;
                });
            });

            this.originalRequestJWT = this.crOperations.originalRequestJWT;
            this.onGoingCommand.data.newownerpubkey = this.onGoingCommand.data.newownerpubkey || "";
            this.onGoingCommand.data.ownerPublicKey = await Util.getSelfPublicKey();
        }
    }

    ionViewWillLeave() {
        void this.crOperations.sendIntentResponse();
    }

    cancel() {
        void this.globalNav.navigateBack();
    }

    async signAndUpdateMilestone() {
        this.signingAndSendingProposalResponse = true;

        try {
            if (this.onGoingCommand.type == CRCommandType.ProposalDetailPage) {
                //Check opinion value
                if (!this.content || this.content == "") {
                    let blankMsg = this.translate.instant('crproposalvoting.opinion')
                        + this.translate.instant('common.text-input-is-blank');
                    this.globalNative.genericToast(blankMsg);
                    return;
                }

                //Handle opinion
                let data = { content: this.content }
                let ret = await this.draftService.getDraft("message.json", data);
                this.onGoingCommand.data.messageHash = ret.hash;
                this.onGoingCommand.data.messageData = ret.data;
                Logger.log(App.CRPROPOSAL_VOTING, "getDraft", ret, data);
            }

            // Create the suggestion/proposal digest - ask the SPVSDK to do this with a silent intent.
            let digest = await this.getMilestoneDigest();

            let signedJWT = await this.signMilestoneDigestAsJWT(digest);
            if (!signedJWT) {
                // Operation cancelled, cancel the operation silently.
                return;
            }

            await this.proposalService.postUpdateMilestoneCommandResponse(signedJWT, this.onGoingCommand.callbackurl);
            this.crOperations.handleSuccessReturn();

            void this.crOperations.sendIntentResponse();
        }
        catch (e) {
            await this.crOperations.popupErrorMessage(e);
        }
        finally {
            this.signingAndSendingProposalResponse = false;
        }
    }

    private async getMilestoneDigest(): Promise<string> {
        let payload = this.getMilestonePayload(this.onGoingCommand);
        Logger.log(App.CRPROPOSAL_VOTING, "milestone payload", payload);
        let digest = await this.voteService.sourceSubwallet.proposalTrackingOwnerDigest(payload);
        // let ret = Util.reverseHexToBE(digest);

        Logger.log(App.CRPROPOSAL_VOTING, "Got milestone digest.", digest);
        return digest;
    }

    private async signMilestoneDigestAsJWT(suggestionDigest: string): Promise<string> {
        Logger.log(App.CRSUGGESTION, "Sending intent to sign the suggestion digest", suggestionDigest);

        var data: any;
        if (this.onGoingCommand.type == CRCommandType.ProposalDetailPage) {
            data = {
                data: suggestionDigest,
                payload: {
                    command: this.onGoingCommand.command,
                    proposalHash: this.onGoingCommand.data.proposalHash,
                    stage: this.onGoingCommand.data.stage,
                    messageHash: this.onGoingCommand.data.messageHash,
                    messageData: this.onGoingCommand.data.messageData,
                },
            }
        }
        else {
            data = {
                data: suggestionDigest,
                signatureFieldName: "data",
                jwtExtra: {
                    type: "signature",
                    command: this.onGoingCommand.command,
                    req: "elastos://crproposal/" + this.originalRequestJWT
                }
            }
        }

        let result = await this.crOperations.sendSignDigestIntent(data);

        Logger.log(App.CRSUGGESTION, "Got signed digest.", result);

        if (!result || !result.responseJWT) {
            // Operation cancelled by user
            return null;
        }

        return result.responseJWT;
    }

    private getMilestonePayload(command: UpdateMilestoneCommand): any {
        let payload = {
            ProposalHash: command.data.proposalHash,
            MessageHash: command.data.messageHash,
            MessageData: command.data.messageData,
            Stage: command.data.stage,
            OwnerPublicKey: command.data.ownerPublicKey,
            NewOwnerPublicKey: command.data.newownerpubkey,
        };
        return payload;
    }

    private async exitIntentWithSuccess() {
        await this.crOperations.sendIntentResponse();
    }

    private async exitIntentWithError() {
        await this.crOperations.sendIntentResponse();
    }
}