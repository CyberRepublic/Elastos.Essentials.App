import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Logger } from 'src/app/logger';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { DPosNode } from '../../../model/nodes.model';
import { NodesService } from '../../../services/nodes.service';

@Component({
  selector: 'app-node-slider-vote',
  templateUrl: './node-slider.component.html',
  styleUrls: ['./node-slider.component.scss'],
})
export class NodeSliderComponent implements AfterViewInit, OnInit {

  @ViewChild('swiper') private swiperEl!: ElementRef;

  @Input() _nodes: DPosNode[] = [];
  @Input() totalVotes = 0;
  @Input() nodeIndex: number;
  @Input() node: DPosNode;

  public displayedNodes: DPosNode[] = [];

  private initialSlide = 0;

  constructor(
    public nodesService: NodesService,
    public theme: GlobalThemeService
  ) {
  }

  ngOnInit() {
    this.displayedNodes = this._nodes.slice(this.nodeIndex > 0 ? this.nodeIndex - 1 : 0, this.nodeIndex + 2);
    this.initialSlide = this.displayedNodes.indexOf(this.node);
  }

  ngAfterViewInit() {
    if (this.initialSlide > 0)
      this.swiperEl?.nativeElement?.swiper?.slideTo(this.initialSlide, 0, false)
}

  //// Increment nodes array when sliding forward ////
  loadNext() {
    let lastNode: DPosNode = this.displayedNodes.slice(-1)[0];
    let nextNodeIndex: number = this._nodes.indexOf(lastNode) + 1;
    if (this._nodes[nextNodeIndex]) {
      this.displayedNodes.push(this._nodes[nextNodeIndex]);
    } else {
      return;
    }
    Logger.log('dposvoting', 'last node', lastNode);
    Logger.log('dposvoting', 'next node', this._nodes[nextNodeIndex]);
  }

  loadPrev() {
    let firstNode: DPosNode = this.displayedNodes[0];
    let prevNodeIndex: number = this._nodes.indexOf(firstNode) - 1;
    if (this._nodes[prevNodeIndex]) {
      this.displayedNodes.unshift(this._nodes[prevNodeIndex]);
      this.swiperEl?.nativeElement?.swiper?.slideTo(1, 0);
    }
  }

  //// Define Values ////
  getVotes(votes: string): string {
    const fixedVotes = parseInt(votes);
    return fixedVotes.toLocaleString().split(/\s/).join(',');
  }

  getVotePercent(votes: string): string {
    const votePercent: number = parseFloat(votes) / this.totalVotes * 100;
    return votePercent.toFixed(2);
  }

  getRewards(yearlyRewards: string): string {
    if (yearlyRewards) {
      const dailyRewards: number = parseFloat(yearlyRewards) / 365;
      return dailyRewards.toFixed(2);
    } else {
      return '...';
    }
  }
}

