import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { UXService } from 'src/app/voting/services/ux.service';
import { DPoS2Node } from '../../../model/nodes.model';

@Component({
  selector: 'app-node-slider-list',
  templateUrl: './node-slider.component.html',
  styleUrls: ['./node-slider.component.scss'],
})
export class NodeSliderComponent implements AfterViewInit, OnInit {

  @ViewChild('swiper') private swiperEl!: ElementRef;

  @Input() _nodes: DPoS2Node[] = [];
  @Input() totalVotes = 0;
  @Input() nodeIndex: number;
  @Input() node: DPoS2Node;

  public displayedNodes: DPoS2Node[] = [];

  private initialSlide = 0;

  constructor(
    public uxService: UXService,
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
    let lastNode: DPoS2Node = this.displayedNodes.slice(-1)[0];
    let nextNodeIndex: number = this._nodes.indexOf(lastNode) + 1;
    if (this._nodes[nextNodeIndex]) {
      this.displayedNodes.push(this._nodes[nextNodeIndex]);
    }
  }

  loadPrev() {
    let firstNode: DPoS2Node = this.displayedNodes[0];
    let prevNodeIndex: number = this._nodes.indexOf(firstNode) - 1;
    if (this._nodes[prevNodeIndex]) {
      this.displayedNodes.unshift(this._nodes[prevNodeIndex]);
      this.swiperEl?.nativeElement?.swiper?.slideTo(1, 0);
    }
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

