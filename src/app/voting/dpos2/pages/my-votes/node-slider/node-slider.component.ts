import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { RenewalVotesContentInfo, VotingInfo } from '@elastosfoundation/wallet-js-sdk/typings/transactions/payload/Voting';
import { IonSlides } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { UXService } from 'src/app/voting/services/ux.service';
import { VoteService } from 'src/app/voting/services/vote.service';
import { DPoS2Node } from '../../../model/nodes.model';
import { DPoS2Service } from '../../../services/dpos2.service';

@Component({
    selector: 'app-node-slider-update',
    templateUrl: './node-slider.component.html',
    styleUrls: ['./node-slider.component.scss'],
})
export class NodeSliderComponent implements OnInit {

    @ViewChild('slider', { static: false }) slider: IonSlides;

    @Output() buttonClick = new EventEmitter<number>();

    @Input() _nodes = [];
    @Input() totalVotes = 0;
    @Input() nodeIndex: number;
    @Input() node: DPoS2Node;

    public displayedNodes: DPoS2Node[] = [];
    public stakeDays = 0;

    slideOpts = {
        initialSlide: 1,
        speed: 400,
        centeredSlides: true,
        slidesPerView: 1.2
    };

    constructor(
        public uxService: UXService,
        public dpos2Service: DPoS2Service,
        public theme: GlobalThemeService,
        public translate: TranslateService,
        private globalNative: GlobalNativeService,
        public voteService: VoteService,
    ) {
    }

    ngOnInit() {
        this.displayedNodes = this._nodes.slice(0, this.nodeIndex + 2);
        this.slideOpts.initialSlide = this.displayedNodes.indexOf(this.node);
    }

    //// Increment nodes array when sliding forward ////
    loadNext() {
        let lastNode: DPoS2Node = this.displayedNodes.slice(-1)[0];
        let nextNodeIndex: number = this._nodes.indexOf(lastNode) + 1;
        if (this._nodes[nextNodeIndex]) {
            this.displayedNodes.push(this._nodes[nextNodeIndex]);
        } else {
            return;
        }
        Logger.log('dposvoting', 'last node', lastNode);
        Logger.log('dposvoting', 'next node', this._nodes[nextNodeIndex]);
    }

    //// Define Values ////
    getVotes(votes: string): string {
        const fixedVotes = parseInt(votes);
        return fixedVotes.toLocaleString().split(/\s/).join(',');
    }

    cancel() {
        this.buttonClick.emit(-1);
    }

    async update(node: any) {
        if (node.inputStakeDays < node.lockDays) {
            let formatWrong = this.translate.instant('dposvoting.stakedays-input-err', {days: node.lockDays});
            this.globalNative.genericToast(formatWrong);
        }
        else {
            await this.createTransaction(node);
        }
    }

    async createTransaction(node: any) {
        await this.globalNative.showLoading(this.translate.instant('common.please-wait'));

        try {
            let currentHeight = await this.voteService.getCurrentHeight();
            let stakeUntil = currentHeight + node.inputStakeDays * 720;

            let voteContentInfo: RenewalVotesContentInfo = {
                ReferKey: node.referkey,
                VoteInfo:
                    {
                        Candidate: node.candidate,
                        Votes: node.votes,
                        Locktime: stakeUntil
                    }
            };

            const payload: VotingInfo = {
                Version: 1,
                RenewalVotesContent: [voteContentInfo]
            };


            const rawTx = await this.voteService.sourceSubwallet.createDPoSV2VoteTransaction(
                payload,
                '', //memo
            );

            Logger.log(App.DPOS_VOTING, "rawTx:", rawTx);

            let ret = await this.voteService.signAndSendRawTransaction(rawTx, App.DPOS_VOTING, "/dpos2/menu/my-votes");
            if (ret) {
                node.lockDays = node.inputStakeDays;
                this.voteService.toastSuccessfully('dposvoting.update-vote');
            }

        }
        catch (e) {

            await this.voteService.popupErrorMessage(e);
        }
        await this.globalNative.hideLoading();
    }

}
