import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { Events } from 'src/app/services/events.service';
import { IdentityEntry } from 'src/app/services/global.didsessions.service';
import { GlobalService, GlobalServiceManager } from 'src/app/services/global.service.manager';
import { BSCNetwork } from '../model/networks/bsc/bsc.network';
import { ElastosNetwork } from '../model/networks/elastos/elastos.network';
import { FusionNetwork } from '../model/networks/fusion/fusion.network';
import { HECONetwork } from '../model/networks/heco/heco.network';
import { Network } from '../model/networks/network';
import { ContactsService } from './contacts.service';
import { CurrencyService } from './currency.service';
import { ETHTransactionService } from './ethtransaction.service';
import { IntentService } from './intent.service';
import { NavService } from './nav.service';
import { WalletNetworkService } from './network.service';
import { WalletPrefsService } from './pref.service';
import { UiService } from './ui.service';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class WalletInitService extends GlobalService {
  private walletServiceInitialized = false;
  private waitForServiceInitialized = false;
  private subscription: Subscription = null;

  constructor(
    private intentService: IntentService,
    private walletManager: WalletService,
    private events: Events,
    private navService: NavService,
    private currencyService: CurrencyService,
    private contactsService: ContactsService,
    private prefs: WalletPrefsService,
    private uiService: UiService,
    private networkService: WalletNetworkService,
    private ethTransactionService: ETHTransactionService,
  ) {
    super();
  }

  public init(): Promise<void> {
    GlobalServiceManager.getInstance().registerService(this);
    return;
  }

  public async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    Logger.log("Wallet", "Wallet service is initializing");

    await this.prefs.init();

    // Networks init + registration
    await this.networkService.init();
    await this.createAndRegisterNetwork(new ElastosNetwork(), true);
    await this.createAndRegisterNetwork(new HECONetwork());
    await this.createAndRegisterNetwork(new BSCNetwork());
    await this.createAndRegisterNetwork(new FusionNetwork());

    // Do not await.
    void this.currencyService.init();
    // Do not await.
    void this.contactsService.init();
    void this.ethTransactionService.init();
    await this.uiService.init();

    // TODO: dirty, rework this
    this.subscription = this.events.subscribe("walletmanager:initialized", () => {
      Logger.log("wallet", "walletmanager:initialized event received");
      this.walletServiceInitialized = true;
    });

    await this.walletManager.init();
    await this.intentService.init();
  }

  public async onUserSignOut(): Promise<void> {
    await this.stop();
  }

  private async createAndRegisterNetwork(network: Network, isDefault = false): Promise<void> {
    await network.init();
    await this.networkService.registerNetwork(network, isDefault);
  }

  public async stop(): Promise<void> {
    Logger.log('wallet', 'init service stopping')
    await this.prefs.stop();
    this.currencyService.stop();
    await this.walletManager.stop();
    await this.intentService.stop();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.walletServiceInitialized = true;
    Logger.log('wallet', 'init service stopped')
  }

  public start() {
    if (this.walletServiceInitialized) {
      this.navService.showStartupScreen();
    } else {
      if (!this.waitForServiceInitialized) {
        this.waitForServiceInitialized = true;
        // Wait until the wallet manager is ready before showing the first screen.
        let subscription = this.events.subscribe("walletmanager:initialized", () => {
          Logger.log("wallet", "walletmanager:initialized event received, showStartupScreen");
          this.navService.showStartupScreen();
          this.waitForServiceInitialized = false;
          subscription.unsubscribe();
        });
      } else {
        Logger.log("wallet", "Wallet service is initializing, The Wallet will be displayed when the service is initialized.");
      }
    }
  }
}
