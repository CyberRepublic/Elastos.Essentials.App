import { formatNumber } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { VoteContentType, VotesContentInfo, VotingInfo } from '@elastosfoundation/wallet-js-sdk';
import { TranslateService } from '@ngx-translate/core';
import BigNumber from 'bignumber.js';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { Util } from 'src/app/model/util';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { DposStatus, VoteService } from 'src/app/voting/services/vote.service';
import { StakeService } from 'src/app/voting/staking/services/stake.service';
import { Config } from 'src/app/wallet/config/Config';
import { VoteContent, VoteTypeString } from 'src/app/wallet/model/elastos.types';
import { SelectedCandidate } from "../../model/selected.model";
import { CRCouncilService } from '../../services/crcouncil.service';

@Component({
    selector: 'app-vote',
    templateUrl: './vote.page.html',
    styleUrls: ['./vote.page.scss'],
})
export class VotePage implements OnInit, OnDestroy {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

    constructor(
        public crCouncilService: CRCouncilService,
        private storage: GlobalStorageService,
        private globalNative: GlobalNativeService,
        public theme: GlobalThemeService,
        private voteService: VoteService,
        public translate: TranslateService,
        public popupProvider: GlobalPopupService,
        private stakeService: StakeService,
    ) { }

    public castingVote = false;
    public votesCasted = false;
    public totalEla = 0;
    public votedEla = 0;
    private toast: any;
    public signingAndTransacting = false;
    public remainingTime: string;
    public initialComputationDone = false;

    public candidatesVotes: { [cid: string]: number } = {}; // Map of CID -> votes - for ion-input items temporary model (before applying to crCouncilService.selectedCandidates.userVotes)
    public candidatesPercentages: { [cid: string]: number } = {}; // Map of CID -> percentage (0-10000) for 2 decimals precision - for ion-range items

    public testValue = 0;
    public overflow = false;

    async ngOnInit() {
    }

    ngOnDestroy() {
    }

    async ionViewWillEnter() {
        this.initialComputationDone = false;

        //this.titleBar.setBackgroundColor("#732CCE");
        //this.titleBar.setForegroundMode(TitleBarForegroundMode.LIGHT);
        this.titleBar.setTitle(this.translate.instant('crcouncilvoting.my-candidates'));

        await this.stakeService.getVoteRights();
        if (this.stakeService.votesRight.totalVotesRight > 0) {
            this.totalEla = this.stakeService.votesRight.totalVotesRight;
        }
        else {
            let status = await this.voteService.dPoSStatus.value;
            if (status == DposStatus.DPoSV2) {
                this.totalEla = 0;
            }
            else {
                this.totalEla = await this.voteService.getMaxVotes();
            }
        }

        Logger.log('crcouncil', 'My Candidates', this.crCouncilService.selectedCandidates);
        // Initialize candidate percentages with default values
        this.crCouncilService.selectedCandidates.forEach((candidate) => {
            //console.log("candidate.userVotes", candidate.userVotes, Number.isInteger(candidate.userVotes))
            this.candidatesVotes[candidate.cid] = candidate.userVotes ? candidate.userVotes : 0;
            if (isNaN(this.candidatesVotes[candidate.cid])) {
                this.candidatesVotes[candidate.cid] = 0;
            }
            this.updateCandidatePercentVotesMap(candidate, candidate.userVotes);
        });
        this.getVotedCount();

        //console.log("this.candidatesVotes", this.candidatesVotes)

        this.remainingTime = await this.crCouncilService.getRemainingTime();
        Logger.log('crcouncil', 'ELA Balance', this.totalEla);

        this.initialComputationDone = true;
    }

    ionViewDidEnter() {
    }

    ionViewWillLeave() {
        this.castingVote = false;
        this.votesCasted = false;

        if (this.toast) {
            this.toast.dismiss();
        }
    }

    distributeEqually() {
        let votes = Math.floor(this.totalEla / this.crCouncilService.selectedCandidates.length);
        Logger.log('crcouncil', 'Equally distributed votes', votes);
        this.crCouncilService.selectedCandidates.forEach((candidate) => {
            candidate.userVotes = votes;
            this.candidatesVotes[candidate.cid] = votes;
            this.updateCandidatePercentVotesMap(candidate, votes);
        });
        this.getVotedCount();
    }

    fixVotes(votes: string) {
        return parseInt(votes);
    }

    /****************** Cast Votes *******************/
    async cast() {
        let votedCandidates = {};
        let votedCandidatesV2 = [];
        this.crCouncilService.selectedCandidates.map((candidate) => {
            if (candidate.userVotes && candidate.userVotes > 0) {
                // let userVotes = candidate.userVotes * 100000000;
                let userVotes = Util.accMul(candidate.userVotes, Config.SELA);

                if (this.stakeService.votesRight.totalVotesRight > 0) {
                    let _vote = {
                        Candidate: candidate.cid,
                        Votes: userVotes.toFixed(0),
                        Locktime: 0
                    };
                    votedCandidatesV2.push(_vote);
                }
                else {
                    let _candidate = { [candidate.cid]: userVotes.toFixed(0) } //SELA, can't with fractions
                    votedCandidates = { ...votedCandidates, ..._candidate }
                }
            } else {
                candidate.userVotes = 0;
            }
        });

        if (votedCandidatesV2.length === 0 && Object.keys(votedCandidates).length === 0) {
            void this.globalNative.genericToast('crcouncilvoting.pledge-some-ELA-to-candidates');
        }
        else if (this.votedEla > this.totalEla) {
            void this.globalNative.genericToast('crcouncilvoting.not-allow-pledge-more-than-own');
        }
        else {
            Logger.log('crcouncil', votedCandidates);
            await this.crCouncilService.setSelectedCandidates(this.crCouncilService.selectedCandidates)
            this.castingVote = true;
            this.votesCasted = false;
            if (this.stakeService.votesRight.totalVotesRight > 0) {
                await this.createVoteCRTransactionV2(votedCandidatesV2)
            }
            else {
                await this.createVoteCRTransaction(votedCandidates);
            }
        }
    }

    /****************** Misc *******************/
    setInputDefault(event) {
        Logger.log('crcouncil', event);
    }

    getElaRemainder() {
        this.votedEla = 0;
        this.crCouncilService.selectedCandidates.map((can) => {
            this.votedEla += can.userVotes;
        });
        let remainder = this.totalEla - this.votedEla;
        return remainder.toFixed(2);
    }

    /**
     * Percentage of user's votes distribution for this given candidate, in a formatted way.
     * eg: 3.52 (%)
     */
    public getDisplayableVotePercentage(candidate: SelectedCandidate) {
        if (this.totalEla === 0)
            return "0.00";

        return formatNumber(candidate.userVotes * 100 / this.totalEla, "en", "0.2-2");
    }

    /**
     * Returns the number of ELA currently distributed to candidates for voting
     */
    public getDistributedEla(): number {
        return this.crCouncilService.selectedCandidates.reduce((prev, c) => prev + parseInt(c.userVotes as any), 0) || 0;
    }

    public onInputFocus(event, candidate: SelectedCandidate) {
        this.candidatesVotes[candidate.cid] = null; // Clear input field for convenient typing
    }

    // Event triggered when the text input loses the focus. At this time we can recompute the
    // distribution.
    public onInputBlur(event, candidate: SelectedCandidate) {
        //console.log("onInputBlur", candidate)

        let targetValue = parseFloat(this.candidatesVotes[candidate.cid] as any) || 0;

        // Can't spend more than what we have
        targetValue = Math.min(targetValue, this.totalEla);

        this.recomputeVotes(candidate, targetValue, false);
    }

    // Event triggered by ngModelChange (called only for the ion-range touched by user), and not
    // by ionChange (because ionChange is called when programatically updating ion-range value tooand we
    // don't want this).
    public onSliderChanged(value: number, candidate: SelectedCandidate) {
        //console.log("onSliderChanged", value, this.candidatesPercentages, candidate.cid)

        // Progress bar is between 0-10000 (<-> 0-100.00%), this is a percentage of total ELA voting power
        let newCandidateValue = Math.round(new BigNumber(this.totalEla).multipliedBy(value).dividedBy(10000).toNumber());
        if (newCandidateValue > this.totalEla) newCandidateValue = this.totalEla;
        this.recomputeVotes(candidate, newCandidateValue, true);
    }

    /**
     * Based on the given number of votes, recompute the progress bar position for a usercandidate
     */
    private updateCandidatePercentVotesMap(candidate: SelectedCandidate, votes: number) {
        this.candidatesPercentages[candidate.cid] = new BigNumber(votes).multipliedBy(10000).dividedBy(this.totalEla).toNumber();
        //console.log("Updating progress percentage", votes, candidate.cid, this.candidatesPercentages[candidate.cid])
    }

    private recomputeVotes(modifiedCandidate: SelectedCandidate, targetVoteValue: number, triggeredByIonRangeChange: boolean) {
        let prevCandidateValue = modifiedCandidate.userVotes;
        let diffEla = targetVoteValue - prevCandidateValue;

        //console.log("diffEla", diffEla, this.candidatesVotes[modifiedCandidate.cid], modifiedCandidate.userVotes, prevCandidateValue, targetVoteValue)

        if (diffEla < 0) {
            // User has decreased the candidate votes, we recompute only the current candidate
            modifiedCandidate.userVotes += diffEla; // Decreases as diffEla is negative
            this.candidatesVotes[modifiedCandidate.cid] = modifiedCandidate.userVotes;

            if (!triggeredByIonRangeChange) // Update progress only if not triggered by ion-range to avoid double update
                this.updateCandidatePercentVotesMap(modifiedCandidate, modifiedCandidate.userVotes);
        }
        else {
            // User has increased the candidate votes. If the currently distributed ELA + the new

            let distributedEla = this.getDistributedEla(); // Distributed ELA before this reallocation
            //console.log("distributedEla", distributedEla)
            let overflowELA = Math.max(0, (distributedEla + diffEla) - this.totalEla);

            modifiedCandidate.userVotes = targetVoteValue;
            this.candidatesVotes[modifiedCandidate.cid] = modifiedCandidate.userVotes;

            if (!triggeredByIonRangeChange) // Update progress only if not triggered by ion-range to avoid double update
                this.updateCandidatePercentVotesMap(modifiedCandidate, modifiedCandidate.userVotes);

            // Take out overflowELA from each other candidate
            // Process in several loop because some candidates can't remove the equally distributed "removedAmount"
            // and their is a rest to continue to deduce from non 0 candidates in several steps.
            let reallyRemovedAmount = 0;
            do {
                let splitInto = this.numberOfNonZeroVotesCandidates(modifiedCandidate); // Distribute among all selected candidates minus the currently modified candidate
                let removedAmount = Math.ceil(overflowELA / splitInto); // Remove the same number of votes from each other candidate
                //console.log("split into", splitInto, "overflowELA", overflowELA, "removedAmount", removedAmount, "reallyRemovedAmount", reallyRemovedAmount);
                for (let c of this.crCouncilService.selectedCandidates) {
                    if (c.cid === modifiedCandidate.cid || c.userVotes == 0)
                        continue;

                    //console.log("distrib", c.cid, "votes before", c.userVotes, "removedAmount", removedAmount)

                    let removedVotes = Math.min(c.userVotes, removedAmount);
                    c.userVotes -= removedVotes;
                    this.candidatesVotes[c.cid] = c.userVotes;
                    this.updateCandidatePercentVotesMap(c, c.userVotes);

                    reallyRemovedAmount += removedVotes;
                }
            }
            while (reallyRemovedAmount < overflowELA);
        }
        this.getVotedCount();
    }

    /**
     * Number of candidates with at least 1 vote.
     */
    private numberOfNonZeroVotesCandidates(excludedCandidate: SelectedCandidate): number {
        let count = 0;
        this.crCouncilService.selectedCandidates.map(c => {
            if (c.cid !== excludedCandidate.cid && c.userVotes > 0)
                count++;
        });
        return count;
    }

    async createVoteCRTransaction(votes: any) {
        this.signingAndTransacting = true;
        Logger.log('wallet', 'Creating vote transaction with votes', votes);

        let crVoteContent: VoteContent = {
            Type: VoteTypeString.CRC,
            Candidates: votes
        }

        try {
            const voteContent = [crVoteContent];
            await this.globalNative.showLoading(this.translate.instant('common.please-wait'));
            const rawTx = await this.voteService.sourceSubwallet.createVoteTransaction(
                voteContent,
                '', //memo
            );
            await this.globalNative.hideLoading();
            Logger.log('wallet', "rawTx:", rawTx);

            let ret = await this.voteService.signAndSendRawTransaction(rawTx, App.CRCOUNCIL_VOTING, "/crcouncilvoting/candidates");
            if (ret) {
                this.voteService.toastSuccessfully('voting.vote');
            }
        }
        catch (e) {
            await this.globalNative.hideLoading();
            await this.voteService.popupErrorMessage(e);
        }

        this.castingVote = false;
        this.signingAndTransacting = false;
    }

    async createVoteCRTransactionV2(votes: any) {
        this.signingAndTransacting = true;
        Logger.log('wallet', 'Creating vote transaction with votes', votes);

        let voteContentInfo: VotesContentInfo = {
            VoteType: VoteContentType.CRC,
            VotesInfo: votes
        };

        const payload: VotingInfo = {
            Version: 0,
            Contents: [voteContentInfo],
        };

        try {
            await this.globalNative.showLoading(this.translate.instant('common.please-wait'));

            if (!await this.voteService.checkWalletAvailableForVote()) {
                return;
            }

            const rawTx = await this.voteService.sourceSubwallet.createDPoSV2VoteTransaction(
                payload,
                '', //memo
            );
            await this.globalNative.hideLoading();
            Logger.log('wallet', "rawTx:", rawTx);

            let ret = await this.voteService.signAndSendRawTransaction(rawTx, App.CRCOUNCIL_VOTING, "/crcouncilvoting/candidates");
            if (ret) {
                this.voteService.toastSuccessfully('voting.vote');
            }
        }
        catch (e) {
            await this.voteService.popupErrorMessage(e);
        }
        finally {
            await this.globalNative.hideLoading();
            this.castingVote = false;
            this.signingAndTransacting = false;
        }
    }

    public getVotedCount() {
        var count = 0;
        this.crCouncilService.selectedCandidates.forEach((candidate) => {
            if (isNaN(this.candidatesVotes[candidate.cid])) {
                this.candidatesVotes[candidate.cid] = 0;
            }
            count += this.candidatesVotes[candidate.cid];
        });
        this.overflow = count > this.totalEla || this.totalEla == 0;
        this.votedEla = count;
    }
}
