import { Component, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from "src/app/components/titlebar/titlebar.types";
import { App } from "src/app/model/app.enum";
import { GlobalFirebaseService } from "src/app/services/global.firebase.service";
import { GlobalNavService } from "src/app/services/global.nav.service";
import { GlobalPopupService } from "src/app/services/global.popup.service";
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { VoteService } from "src/app/voting/services/vote.service";
import { CRCouncilService } from "../../services/crcouncil.service";

@Component({
    selector: "app-crmembers",
    templateUrl: "./crmembers.page.html",
    styleUrls: ["./crmembers.page.scss"]
})
export class CRMembersPage implements OnInit {
    @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

    public candidateIndex: number;
    public addingCandidates = false;
    public crMembersFetched = false;
    public secretary: any = null;

    private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

    constructor(
        public crCouncilService: CRCouncilService,
        private globalNav: GlobalNavService,
        public theme: GlobalThemeService,
        public popupProvider: GlobalPopupService,
        public voteService: VoteService,
        public translate: TranslateService
    ) {
        GlobalFirebaseService.instance.logEvent("voting_crmembers_enter");
    }

    ngOnInit() {
    }

    async ionViewWillEnter() {
        //this.titleBar.setBackgroundColor("#732CCE");
        //this.titleBar.setForegroundMode(TitleBarForegroundMode.LIGHT);
        this.titleBar.setTitle(this.translate.instant('crcouncilvoting.council-members'));

        let available = await this.crCouncilService.getCRDepositcoinAvailable();
        if (available > 0) {
            this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, { key: null, iconPath: this.theme.darkMode ? '/assets/crcouncilvoting/icon/darkmode/withdraw.svg' : '/assets/crcouncilvoting/icon/withdraw.svg' });
            this.titleBar.addOnItemClickedListener(this.titleBarIconClickedListener = (icon) => {
                void this.crCouncilService.withdrawCandidate(available, '/crcouncilvoting/crmembers');
            });
        }

        await this.crCouncilService.getCRVotingStage();
        if (!this.crMembersFetched) {
            await this.crCouncilService.fetchCRMembers();
            this.secretary = this.crCouncilService.getSecretary();
            this.crMembersFetched = true;
        }
    }

    ionViewWillLeave() {
        this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
    }

    gotoCandidate() {
        void this.globalNav.navigateTo(App.CRCOUNCIL_VOTING, '/crcouncilvoting/candidates');
    }

    gotoNextCRs() {
        void this.globalNav.navigateTo(App.CRCOUNCIL_VOTING, '/crcouncilvoting/nextcrs');
    }

    async onShowMemberInfo(did: string) {
        this.crCouncilService.selectedMemberDid = did;
        await this.globalNav.navigateTo(App.CRCOUNCIL_VOTING, '/crcouncilvoting/crmember');
    }

    async onShowSecretaryInfo() {
        await this.globalNav.navigateTo(App.CRCOUNCIL_VOTING, '/crcouncilvoting/secretary');
    }
}
