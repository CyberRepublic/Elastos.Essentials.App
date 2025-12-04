import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, RefresherCustomEvent } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { PollStatus } from '../../model/poll-status.enum';
import { Poll } from '../../model/poll.model';
import { MainchainPollsService } from '../../services/mainchain-polls.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;
  @ViewChild('content', { static: false }) content: IonContent;

  public polls: Poll[] = [];
  public pollsFetched = false;
  public loading = false;

  constructor(
    public theme: GlobalThemeService,
    private pollsService: MainchainPollsService,
    private router: Router,
    private globalNav: GlobalNavService,
    public translate: TranslateService
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    void this.init();
  }

  async init() {
    this.titleBar.setTitle(this.translate.instant('mainchainpolls.title'));
    await this.fetchPolls();
  }

  async fetchPolls() {
    try {
      this.loading = true;
      Logger.log(App.MAINCHAIN_POLLS, 'Fetching polls...');

      // Get poll IDs
      const pollIds = await this.pollsService.getPoll();
      Logger.log(App.MAINCHAIN_POLLS, 'Poll IDs:', pollIds);

      if (pollIds.length === 0) {
        this.polls = [];
        this.pollsFetched = true;
        this.loading = false;
        return;
      }

      // Get voting info for all polls
      const votingInfos = await this.pollsService.getVotingInfo(pollIds);
      Logger.log(App.MAINCHAIN_POLLS, 'Voting infos:', votingInfos);

      // Convert to Poll model
      this.polls = votingInfos.map(info => ({
        id: info.id,
        status: this.mapStatus(info.status),
        description: info.description,
        startTime: info.startTime,
        endTime: info.endTime,
        choices: info.choices
      }));

      this.pollsFetched = true;
      this.loading = false;
    } catch (err) {
      Logger.error(App.MAINCHAIN_POLLS, 'fetchPolls error:', err);
      this.loading = false;
      this.pollsFetched = true;
    }
  }

  async doRefresh(event: RefresherCustomEvent) {
    this.pollsFetched = false;
    await this.fetchPolls();
    void event.target.complete();
  }

  selectPoll(poll: Poll) {
    void this.globalNav.navigateTo(App.MAINCHAIN_POLLS, `/mainchainpolls/poll/${poll.id}`);
  }

  private mapStatus(status: string): PollStatus {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active' || statusLower === 'ongoing') {
      return PollStatus.ACTIVE;
    } else if (statusLower === 'ended' || statusLower === 'finished') {
      return PollStatus.ENDED;
    } else {
      return PollStatus.UPCOMING;
    }
  }

  getStatusClass(status: PollStatus): string {
    switch (status) {
      case PollStatus.ACTIVE:
        return 'active';
      case PollStatus.ENDED:
        return 'ended';
      case PollStatus.UPCOMING:
        return 'upcoming';
      default:
        return '';
    }
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }
}
