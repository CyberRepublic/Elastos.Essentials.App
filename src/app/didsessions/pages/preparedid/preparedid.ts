import { Component, ViewChild, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { IdentityService } from '../../services/identity.service';
import { IonSlides, Platform } from '@ionic/angular';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarForegroundMode, TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem, TitleBarNavigationMode } from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { WalletManager } from 'src/app/wallet/services/wallet.service';
import { sleep } from 'src/app/helpers/sleep.helper';
import { DIDPublicationStatus, GlobalPublicationService } from 'src/app/services/global.publication.service';
import { GlobalHiveService } from 'src/app/services/global.hive.service';
import { GlobalDIDSessionsService } from 'src/app/services/global.didsessions.service';

declare let didManager: DIDPlugin.DIDManager;

// Minimal duration during which a slide remains shown before going to the next one.
const MIN_SLIDE_SHOW_DURATION_MS = 4000;

@Component({
    selector: 'page-preparedid',
    templateUrl: 'preparedid.html',
    styleUrls: ['preparedid.scss']
})
export class PrepareDIDPage {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild(IonSlides, { static: false }) slide: IonSlides;

  private PUBLISH_DID_SLIDE_INDEX = 0;
  private SIGN_IN_SLIDE_INDEX = 1;
  private HIVE_SETUP_SLIDE_INDEX = 2;
  private DEFAULT_WALLET_SLIDE_INDEX = 3;
  public ALL_DONE_SLIDE_INDEX = 4;

  private nextStepId: number;

  // PROCESS
  public mnemonic: string;
  public mnemonicList: string[] = [];
  // User's published DID Document extracted during the preparation process, if any
  private publishedDID: DIDPlugin.DIDDocument = null;
  // Vault address extracted during the preparation process, if any
  private vaultAddress: string = null;
  private walletStepCompleted = false;

  // UI
  public slideIndex = 0;
  public slideOpts = {
    initialSlide: 0,
    speed: 400,
    init: false,
    allowTouchMove: false
  };
  public hidden = true;

  // Errors
  public publishError: string = null;
  public signInError: string = null;
  public hiveError: string = null;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  constructor(
    public router: Router,
    public translate: TranslateService,
    private identityService: IdentityService,
    private platform: Platform,
    private walletService: WalletManager,
    private globalHiveService: GlobalHiveService,
    private globalPublicationService: GlobalPublicationService
  ) {
      Logger.log('didsessions', "Entering PrepareDID page");
      const navigation = this.router.getCurrentNavigation();
      if(navigation.extras.state && navigation.extras.state.enterEvent) {
        this.nextStepId = navigation.extras.state.enterEvent.stepId;
        Logger.log('didsessions', 'PrepareDIDPage - nextStepId', this.nextStepId);
      }
  }

  async ionViewWillEnter() {
    await this.onSlideChanged();

    this.titleBar.setTheme('#f8f8ff', TitleBarForegroundMode.DARK);
    this.titleBar.setNavigationMode(null);
    // Disable the Elastos icon
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_LEFT, null);

    // Dirty hack because on iOS we are currently unable to understand why the
    // ion-slides width is sometimes wrong when an app starts. Waiting a few
    // seconds (DOM fully rendered once...?) seems to solve this problem.
    if (this.platform.platforms().indexOf('ios') >= 0) {
      setTimeout(() => {
        this.showSlider();
      }, 300)
    } else {
      this.showSlider();
    }

    this.resetErrors();

    let nextSlideIndex = -1;
    let operationSuccessful = false;
    do {
      nextSlideIndex = await this.computeNextSlideIndex(nextSlideIndex);
      Logger.log("didsessions", "Next slide index will be:", nextSlideIndex);
      await this.slide.slideTo(nextSlideIndex);

      switch (nextSlideIndex) {
        case this.PUBLISH_DID_SLIDE_INDEX:
          operationSuccessful = await this.publishIdentity();
          break;
        case this.SIGN_IN_SLIDE_INDEX:
          // Enter the real user context (sign in) to make sure following operations such as creating
          // a wallet run in the user context.
          operationSuccessful = await this.signIn();
          Logger.log("didsessions", "Sign in completed", GlobalDIDSessionsService.signedInDIDString);
          break;
        case this.HIVE_SETUP_SLIDE_INDEX:
          operationSuccessful = await this.setupHiveStorage(this.vaultAddress);
          break;
        case this.DEFAULT_WALLET_SLIDE_INDEX:
          // Note: we don't check if there is an error during wallet creation. This is not a blocking error,
          // we can continue.
          await this.createWalletFromIdentity();
          break;
        default:
          // Do nothing.
      }
    }
    while (nextSlideIndex !== this.ALL_DONE_SLIDE_INDEX && operationSuccessful);

    Logger.log("didsessions", "Slide computation loop ended", nextSlideIndex, operationSuccessful);
  }

  ionViewWillLeave() {
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
  }

  showSlider() {
    Logger.log('didsessions', "Showing slider");
    this.hidden = false
    void this.slide.getSwiper().then((swiper) => {
      swiper.init();
      void this.slide.slideTo(0);
    });
  }

  public async onSlideChanged() {
    this.slideIndex = await this.slide.getActiveIndex();
    this.slideIndex !== this.ALL_DONE_SLIDE_INDEX ?
      this.titleBar.setTitle(this.translate.instant('didsessions.getting-ready')) :
      this.titleBar.setTitle(this.translate.instant('didsessions.ready'));
  }

  nextSlide() {
    void this.slide.slideNext();
  }

  prevSlide() {
    void this.slide.slidePrev();
  }

  private resetErrors() {
    this.publishError = null;
    this.signInError = null;
    this.hiveError = null;

    this.walletStepCompleted = false;
  }

  /**
   * Depending on things that need to be done for this DID, the next slide to show is computed here.
   */
  private async computeNextSlideIndex(currentSlideIndex: number): Promise<number> {
    if (currentSlideIndex <= this.PUBLISH_DID_SLIDE_INDEX && await this.needToPublishIdentity()) {
      return this.PUBLISH_DID_SLIDE_INDEX;
    }
    else if (currentSlideIndex <= this.SIGN_IN_SLIDE_INDEX && GlobalDIDSessionsService.signedInDIDString === null) {
      return this.SIGN_IN_SLIDE_INDEX;
    }
    /* TMP HIVE NOT READY FOR 2.0 else if (currentSlideIndex <= this.HIVE_SETUP_SLIDE_INDEX && !await this.isHiveVaultReady()) {
      return this.HIVE_SETUP_SLIDE_INDEX;
    }*/
    if (currentSlideIndex < this.DEFAULT_WALLET_SLIDE_INDEX && !(await this.defaultWalletExists())) {
      return this.DEFAULT_WALLET_SLIDE_INDEX;
    }
    else {
      return this.ALL_DONE_SLIDE_INDEX;
    }
  }

  private async needToPublishIdentity(): Promise<boolean> {
    this.publishedDID = await this.fetchPublishedDID();
    return (this.publishedDID == null || !this.publishedIdentityHasHiveVault(this.publishedDID));
  }

  private fetchPublishedDID(): Promise<DIDPlugin.DIDDocument> {
    Logger.log("didsessions", "Checking if identity is published");
    return new Promise<DIDPlugin.DIDDocument>((resolve, reject) =>{
      didManager.resolveDidDocument(this.identityService.identityBeingCreated.did.getDIDString(), true, (doc) => {
        Logger.log("didsessions", "Resolved identity:", doc);
        resolve(doc);
      }, (err) => reject(err));
    });
  }

  /**
   * Check if user's published DID already contains a hive vault or not. If not, we'll have to add one and
   * publish the did again.
   */
  private publishedIdentityHasHiveVault(doc: DIDPlugin.DIDDocument | null): boolean {
    if (!doc)
      return false;

    return this.globalHiveService.documentHasVault(doc);
  }

  private async isHiveVaultReady(): Promise<boolean> {
    Logger.log("didsessions", "Checking if hive vault is ready");
    // To know if the vault is ready we need a hive client instance and then check what getvault() returns.
    // retrieveVaultLinkStatus() does that for us.
    let vaultStatus = await this.globalHiveService.retrieveVaultLinkStatus();
    Logger.log("didsessions", "Hive vault status:", vaultStatus);
    return (vaultStatus && vaultStatus.publishedInfo !== null && vaultStatus.publishedInfo.vaultAddress != null);
  }

  private async appendHiveInfoToDID(): Promise<string> {
    Logger.log("didsessions", "Adding hive vault information to local DID");
    let didDocument = await this.identityService.getCreatedDIDDocument();
    this.vaultAddress = await this.globalHiveService.addRandomHiveToDIDDocument(didDocument, this.identityService.identityBeingCreated.storePass);
    return this.vaultAddress;
  }

  private defaultWalletExists(): Promise<boolean> {
    // For now, always returns a simulated value without really checking because we don't have a API for that in the wallet sdk.
    return Promise.resolve(this.walletStepCompleted);
  }

  private async publishIdentity(): Promise<boolean> {
    Logger.log("didsessions", "Publishing identity");

    // Add a random hive vault provider to the DID Document before publishing it (to avoid
    // publishing again right after), only if there is no vault configured yet.
    if (!this.publishedIdentityHasHiveVault(this.publishedDID)) {
      this.vaultAddress = await this.appendHiveInfoToDID();
    }

    try {
      await Promise.all([
        sleep(MIN_SLIDE_SHOW_DURATION_MS),
        this.publishIdentityReal()
      ]);

      // Resolve the published DID to make sure everything is all right
      if (await this.needToPublishIdentity()) {
        Logger.warn("didsessions", "Identity is supposed to be published and ready but cannot be resolved");
        this.publishError = "Sorry, your identity could not be published for now";
        return false;
      }

      return true;
    }
    catch(e) {
      Logger.warn("didsessions", "Publish identity error in prepare did:", e);
      this.publishError = "Failed to publish identity: " + e;
      return false;
    }
  }

  private publishIdentityReal(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return new Promise<boolean>((resolve) => {
      void this.globalPublicationService.resetStatus().then(() => {
        let publicationStatusSub = this.globalPublicationService.publicationStatus.subscribe((status)=>{
          if (status.status == DIDPublicationStatus.PUBLISHED_AND_CONFIRMED) {
            Logger.log("didsessions", "Identity publication success");
            publicationStatusSub.unsubscribe();
            resolve(true);
          }
          else if (status.status == DIDPublicationStatus.FAILED_TO_PUBLISH) {
            Logger.log("didsessions", "Identity publication failure");
            publicationStatusSub.unsubscribe();
            resolve(false);
          }
        });

        void this.globalPublicationService.publishDIDFromStore(
          this.identityService.identityBeingCreated.didStore.getId(),
          this.identityService.identityBeingCreated.storePass,
          this.identityService.identityBeingCreated.did.getDIDString());
      });
    });
  }

  private async signIn(): Promise<boolean> {
    Logger.log("didsessions", "Signing in");
    try {
      await Promise.all([
        sleep(MIN_SLIDE_SHOW_DURATION_MS),
        this.identityService.signIn(this.identityService.identityBeingCreated.didSessionsEntry)
      ]);
      return true;
    }
    catch(e) {
      Logger.warn("didsessions", "Sign in error in prepare did:", e);
      this.signInError = "Failed to sign in: " + e;
      return false;
    }
  }

  private async setupHiveStorage(vaultAddress: string): Promise<boolean> {
    Logger.log("didsessions", "Setting up hive storage");
    try {
      await Promise.all([
        sleep(MIN_SLIDE_SHOW_DURATION_MS),
        // TMP CANT USE IF DID NOT PUBLISHED FOR NOW this.globalHiveService.prepareHiveVault(vaultAddress)
      ]);
      return false; // TMP
    }
    catch(e) {
      Logger.warn("didsessions", "Hive storage error in prepare did:", e);
      this.hiveError = "Failed to setup the hive storage: " + e;
      return false;
    }
  }

  private async createWalletFromIdentity(): Promise<void> {
    Logger.log("didsessions", "Creating a default wallet with the same mnemonic as the identity");
    await Promise.all([
      sleep(MIN_SLIDE_SHOW_DURATION_MS),
      this.walletService.createWalletFromNewIdentity(
        this.identityService.identityBeingCreated.name, this.identityService.identityBeingCreated.mnemonic,
        this.identityService.identityBeingCreated.mnemonicPassphrase
      )
    ]);

    this.walletStepCompleted = true;
  }

  finalizePreparation() {
    Logger.log('didsessions', "Exiting the DID preparation screen, next step:", this.nextStepId);
    void this.identityService.runNextStep(this.nextStepId);
  }

  cancelPreparation() {
    void this.identityService.cancelIdentiyCreation();
  }
}
