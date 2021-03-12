import { Injectable, NgZone } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { PopupProvider } from './popup.service';
import { UiService } from './ui.service';
import { Events } from './events.service';
import { CoinService } from './coin.service';
import { ContactsService } from './contacts.service';
import { CurrencyService } from './currency.service';
import { ERC20CoinService } from './erc20coin.service';
import { IntentService } from './intent.service';
import { NavService } from './nav.service';
import { WalletManager } from './wallet.service';
import { LocalStorage } from './storage.service';
import { Logger } from 'src/app/logger';
import { GlobalDIDSessionsService } from 'src/app/services/global.didsessions.service';

@Injectable({
  providedIn: 'root'
})
export class WalletInitService {
  constructor(
    private intentService: IntentService,
    public localStorage: LocalStorage,
    public walletManager: WalletManager,
    public events: Events,
    public zone: NgZone,
    public translate: TranslateService,
    private navService: NavService,
    private currencyService: CurrencyService,
    public popupProvider: PopupProvider,
    public modalCtrl: ModalController,
    private coinService: CoinService,
    private contactsService: ContactsService,
    private erc20CoinService: ERC20CoinService,
    private uiService: UiService,
    private didSessions: GlobalDIDSessionsService
  ) {}

  public async init(): Promise<void> {
    this.didSessions.signedInIdentityListener.subscribe(async (signedInIdentity)=>{
      if (signedInIdentity) {
        Logger.log("Wallet", "Wallet service is initializing");

        await this.coinService.init();
        await this.currencyService.init();
        await this.contactsService.init();
        await this.uiService.init();
        await this.erc20CoinService.init();

        // Wait until the wallet manager is ready before showing the first screen.
        // TODO: rework
        this.events.subscribe("walletmanager:initialized", () => {
            Logger.log("wallet", "walletmanager:initialized event received");
        });

        await this.walletManager.init();
        await this.intentService.init();
      }
    });
  }

  public start() {
    this.navService.showStartupScreen();
  }
}
