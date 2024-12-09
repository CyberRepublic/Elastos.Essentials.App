import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { UXService } from 'src/app/voting/services/ux.service';
import { DPoS2Node } from '../../../model/nodes.model';

@Component({
  selector: 'app-node-slider-search',
  templateUrl: './node-slider.component.html',
  styleUrls: ['./node-slider.component.scss'],
})
export class NodeSliderComponent implements AfterViewInit, OnInit {
  @ViewChild('swiper') private swiperEl!: ElementRef;
  @Input() _nodes: DPoS2Node[] = [];
  @Input() totalVotes: number = 0;
  @Input() nodeIndex: number;
  @Input() node: DPoS2Node;

  public displayedArr: DPoS2Node[] = [];

  private initialSlide = 0;

  constructor(
    public uxService: UXService,
    public theme: GlobalThemeService
  ) {
  }

  ngOnInit() {
    this.displayedArr = this._nodes.slice(0, this.nodeIndex + 2);
    this.initialSlide = this.displayedArr.indexOf(this.node);
  }

  ngAfterViewInit() {
    if (this.initialSlide > 0)
      this.swiperEl?.nativeElement?.swiper?.slideTo(this.initialSlide, 0, false)
  }

  //// Increment nodes array when sliding forward ////
  loadNext() {
    let lastNode: DPoS2Node = this.displayedArr.slice(-1)[0];
    let nextNodeIndex: number = this._nodes.indexOf(lastNode) + 1;
    if (nextNodeIndex) {
      this.displayedArr.push(this._nodes[nextNodeIndex]);
    }
    // Logger.log('dposvoting', 'last node', lastNode);
    // Logger.log('dposvoting', 'next node', this._nodes[nextNodeIndex]);
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

  /* getEla(votes: number): string {
    let ElaVotes: number = Math.ceil(votes / 36);
    return ElaVotes.toLocaleString().split(/\s/).join(',');
  } */
}
