import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { BuiltInIcon, TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { SessionRequestParams } from 'src/app/model/walletconnect/types';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { GlobalWalletConnectService } from 'src/app/services/walletconnect/global.walletconnect.service';
import { WalletConnectV1Service } from 'src/app/services/walletconnect/walletconnect.v1.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { DeveloperService } from '../../../services/developer.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.page.html',
  styleUrls: ['./connect.page.scss'],
})
export class WalletConnectConnectPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public sessionRequest: {
    connectorKey: string,
    request: SessionRequestParams
  };
  public ethAccounts: string[] = [];
  private backSubscription: Subscription = null;
  private activeNetworkWalletSubscription: Subscription = null;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  constructor(
    public settings: SettingsService,
    public theme: GlobalThemeService,
    public developer: DeveloperService,
    public translate: TranslateService,
    private route: ActivatedRoute,
    private walletConnect: GlobalWalletConnectService,
    private walletConnectV1: WalletConnectV1Service,
    private walletManager: WalletService,
    private nav: GlobalNavService,
    private platform: Platform,
    private native: GlobalNativeService
  ) { }

  ngOnInit() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.route.queryParams.subscribe(params => {
      this.sessionRequest = params as any;

      // Use only the active master wallet.
      this.ethAccounts = [];

      // Sometimes it is necessary to wait for the wallet to initialize.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.activeNetworkWalletSubscription = this.walletManager.activeNetworkWallet.subscribe(async (activeWallet) => {
        if (activeWallet) {
            let subwallet = activeWallet.getMainEvmSubWallet();
            if (subwallet) // Can be null, if the active network is not EVM
                this.ethAccounts.push(await subwallet.getCurrentReceiverAddress());
        }
      })
    });
  }

  ngOnDestroy() {
    if (this.activeNetworkWalletSubscription) {
        this.activeNetworkWalletSubscription.unsubscribe();
        this.activeNetworkWalletSubscription = null;
    }
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('settings.wallet-connect-request'));
    this.titleBar.setNavigationMode(null);
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_LEFT, { key: null, iconPath: BuiltInIcon.CLOSE }); // Replace essentials logo with close icon
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.titleBar.addOnItemClickedListener(this.titleBarIconClickedListener = async (icon) => {
      // Close
      await this.walletConnectV1.rejectSession(this.sessionRequest.connectorKey, "User cancelled");
      void this.titleBar.globalNav.exitCurrentContext();
    });

    // Catch android back key to reject the session
    this.backSubscription = this.platform.backButton.subscribeWithPriority(0, async (processNext) => {
      await this.walletConnectV1.rejectSession(this.sessionRequest.connectorKey, "User cancelled");
      processNext();
    });
  }

  ionViewWillLeave() {
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
    if (this.backSubscription) {
      this.backSubscription.unsubscribe();
      this.backSubscription = null;
    }
  }

  async openSession() {
    try {
        await this.walletConnectV1.acceptSessionRequest(this.sessionRequest.connectorKey, this.ethAccounts);
        // Because for now we don't close Essentials after handling wallet connect requests, we simply
        // inform users to manually "alt tab" to return to the app they are coming from.
        this.native.genericToast("settings.wallet-connect-popup", 2000);
    }
    catch (e) {
        Logger.warn('walletconnect', 'acceptSessionRequest failed:', e)
        this.native.genericToast("settings.wallet-connect-request-error4", 5000);
    }

    await this.nav.exitCurrentContext();
  }
}
