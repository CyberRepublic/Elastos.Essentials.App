import { HttpClient } from '@angular/common/http';
import { Component, NgZone, ViewChild } from '@angular/core';
import { Keyboard } from '@awesome-cordova-plugins/keyboard/ngx';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import FastAverageColor from 'fast-average-color';
import { Subscription } from 'rxjs/internal/Subscription';
import {
  BuiltInIcon,
  TitleBarForegroundMode,
  TitleBarIcon,
  TitleBarMenuItem
} from 'src/app/components/titlebar/titlebar.types';
import { App } from 'src/app/model/app.enum';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { NetworkChooserFilter } from 'src/app/wallet/components/network-chooser/network-chooser.component';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import {
  BrowserConnectionType,
  BrowserWalletConnectionsService
} from 'src/app/wallet/services/browser-wallet-connections.service';
import { WalletNetworkUIService } from 'src/app/wallet/services/network.ui.service';
import { BrowserTitleBarComponent } from '../../components/titlebar/titlebar.component';
import { DappBrowserClient, DappBrowserService } from '../../services/dappbrowser.service';

declare let dappBrowser: DappBrowserPlugin.DappBrowser;

@Component({
  selector: 'page-browser',
  templateUrl: 'browser.html',
  styleUrls: ['browser.scss']
})
export class BrowserPage implements DappBrowserClient {
  @ViewChild(BrowserTitleBarComponent, { static: false }) titleBar: BrowserTitleBarComponent;

  public shot: string = null;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;
  private backButtonSub: Subscription;

  private inputStatusSub: Subscription;
  private restoreWebviewTimeout;
  public shouldShowAssistant = false;
  public urlInputAssistantFilter = '';

  constructor(
    public translate: TranslateService,
    private nav: GlobalNavService,
    public theme: GlobalThemeService,
    public httpClient: HttpClient,
    public zone: NgZone,
    public keyboard: Keyboard,
    private platform: Platform,
    private dAppBrowserService: DappBrowserService,
    private walletNetworkUIService: WalletNetworkUIService,
    private browserWalletConnectionsService: BrowserWalletConnectionsService,
    private globalIntentService: GlobalIntentService
  ) {
    this.dAppBrowserService.activeBrowsedAppInfo.subscribe(appInfo => {
      if (appInfo && this.titleBar) {
        this.titleBar.setTitle(appInfo.title ?? null);
        this.titleBar.setUrl(appInfo.url ?? null);
      }
    });
  }

  ionViewWillEnter() {
    this.dAppBrowserService.setClient(this);
    this.titleBar.setCloseMode(true);
    this.titleBar.setBrowserMode(true);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.titleBar.addOnItemClickedListener(
      (this.titleBarIconClickedListener = icon => {
        switch (icon.iconPath) {
          case BuiltInIcon.CLOSE:
            void dappBrowser.close();
            break;
          case BuiltInIcon.BACK:
            void this.onGoBack();
            break;
          case BuiltInIcon.NETWORK:
            dappBrowser.hide();
            void (async () => {
              await this.walletNetworkUIService.chooseActiveNetwork(await this.createNetworkFilter());
              this.dAppBrowserService.showWebView();
            })();
            break;
          case BuiltInIcon.VERTICAL_MENU:
            this.onMenu();
            break;
        }
      })
    );

    this.shot = null;
  }

  /**
   * Creates a network filter that only shows networks supported by the currently connected EVM wallet.
   * If no EVM wallet is connected, shows all networks.
   */
  private async createNetworkFilter(): Promise<NetworkChooserFilter | undefined> {
    const currentUrl = this.dAppBrowserService.url;
    if (!currentUrl) {
      return undefined; // Show all networks if no URL available
    }

    // Check if there's a connected EVM wallet for this dapp
    const connectedWallet = await this.browserWalletConnectionsService.getConnectedWallet(
      currentUrl,
      BrowserConnectionType.EVM
    );

    if (!connectedWallet) {
      return undefined; // Show all networks if no wallet connected
    }

    // Create filter that only shows networks supported by the connected wallet
    const filter: NetworkChooserFilter = (network: AnyNetwork): boolean => {
      return connectedWallet.masterWallet.supportsNetwork(network);
    };

    return filter;
  }

  ionViewDidEnter() {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10000, () => {
      void this.onGoBack();
    });
    this.dAppBrowserService.showWebView();

    this.inputStatusSub = this.titleBar.inputStatus.subscribe(editing => {
      if (editing) {
        this.dAppBrowserService.hideActiveBrowser();
        this.shouldShowAssistant = true;
      } else {
        // Give some time to the url assistant to catch and send the click on a url to us, before remove the component from UI
        this.restoreWebviewTimeout = setTimeout(() => {
          this.shouldShowAssistant = false;
          this.dAppBrowserService.showWebView();
        }, 500);
      }
    });
  }

  ionViewWillLeave() {
    clearTimeout(this.restoreWebviewTimeout);
    this.shouldShowAssistant = false;

    this.inputStatusSub.unsubscribe();

    void this.zone.run(async () => {
      this.shot = await dappBrowser.getWebViewShot();
    });

    dappBrowser.hide();

    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
      this.backButtonSub = null;
    }
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
  }

  ngOnDestroy() {
    // The user may return to the launcher page through other pages.
    void dappBrowser.close();
  }

  onLoadStart() {
    // Reset title bar colors to default to override possibly previous colors set by a previous
    // html page theme.
    this.titleBar.resetColors();
  }

  onHtmlHead?: (head: Document) => void;

  onExit(mode?: string) {
    switch (mode) {
      case 'goToLauncher':
        this.dAppBrowserService.setClient(null);
        void this.nav.goToLauncher();
        break;
      case 'reload':
        break;
      default:
        this.dAppBrowserService.setClient(null);
        if (this.nav.canGoBack()) void this.nav.navigateBack();
    }
  }

  async onUrlConfirmed(url: string) {
    let domain = this.dAppBrowserService.getDomain(url);
    if (await this.dAppBrowserService.checkScamDomain(domain)) {
      void this.zone.run(async () => {
        //this.shot = await dappBrowser.getWebViewShot();
        await dappBrowser.hide();

        let ret = await this.dAppBrowserService.showScamWarning(domain);
        if (ret) {
          void dappBrowser.close();
        } else {
          void dappBrowser.show();
          //void this.dAppBrowserService.open(url, null, null, false);
        }
      });
    }
  }

  // URL being typed, not yet confirmed
  onUrlTyped(urlOrKeywords: string) {
    this.urlInputAssistantFilter = urlOrKeywords;
  }

  /* public onUrlInput(url: string) {
        void dappBrowser.loadUrl(url);
    } */

  public onRecentAppPicked(url: string) {
    // Reload a url, but don't navigate because we are already in the browser screen
    this.shot = null;
    this.shouldShowAssistant = false;
    void this.dAppBrowserService.open(url, null, null, false);
  }

  onGoToLauncher() {
    void dappBrowser.close('goToLauncher');
  }

  async onGoBack() {
    let canGoBack = await dappBrowser.canGoBack();
    if (canGoBack) {
      void dappBrowser.goBack();
    } else {
      void dappBrowser.close();
    }
  }

  onMenu() {
    void this.nav.navigateTo(App.DAPP_BROWSER, '/dappbrowser/menu');
  }

  onCustomScheme(url: string) {
    if (url.startsWith('wc:')) {
      void this.globalIntentService.sendIntent('rawurl', { url: url });
    }
  }

  async onThemeColor?(themeColor: string) {
    if (themeColor) {
      // Detect the dapp theme main color to make the title bar text/icons dark or light colors
      const fac = new FastAverageColor();
      try {
        let r = parseInt(themeColor.slice(1, 3), 16);
        let g = parseInt(themeColor.slice(3, 5), 16);
        let b = parseInt(themeColor.slice(5, 7), 16);

        let color = await fac.prepareResult([r, g, b, 1]);

        this.zone.run(() => {
          if (color.isDark) this.titleBar.setForegroundMode(TitleBarForegroundMode.LIGHT);
          else this.titleBar.setForegroundMode(TitleBarForegroundMode.DARK);

          // Set the title bar background color to match the dapp theme
          this.titleBar.setBackgroundColor(themeColor);
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
}
