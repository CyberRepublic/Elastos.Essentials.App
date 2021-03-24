import { Component, NgZone, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DIDService } from '../../../services/did.service';
import { Profile } from '../../../model/profile.model';
import { UXService } from '../../../services/ux.service';
import { AuthService } from '../../../services/auth.service';
import { VerifiableCredential } from '../../../model/verifiablecredential.model';
import { TranslateService } from '@ngx-translate/core';
import { ProfileService } from '../../../services/profile.service';
import { ExpirationService, ExpiredItem } from '../../../services/expiration.service';
import { DIDDocument } from '../../../model/diddocument.model';
import { BasicCredentialsService } from '../../../services/basiccredentials.service';
import { DIDSyncService } from '../../../services/didsync.service';
import { DID } from '../../../model/did.model';
import { AlertController, PopoverController } from '@ionic/angular';
import { SuccessComponent } from '../../../components/success/success.component';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { ThemeService } from 'src/app/didsessions/services/theme.service';
import { TitleBarNavigationMode } from 'src/app/components/titlebar/titlebar.types';
import { CredAccessIdentityIntent } from '../../../model/identity.intents';
import { IntentReceiverService } from '../../../services/intentreceiver.service';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { isNullOrUndefined } from 'util';
import { Logger } from 'src/app/logger';

declare let didManager: DIDPlugin.DIDManager;

type RequestDapp = {
  appPackageId: string,
  intentId: number,
  action: string,
  claims: any,
  customization: {
    primarycolorlightmode: string,
    primarycolordarkmode: string
  },
  nonce: any,
  realm: any,
  originalJwtRequest: any,
  jwtExpirationDays: any
}

type IssuerDisplayEntry  = {
  did: string,
  name: string,
  avatar: string
}

type IssuerInfo = {
  displayItem : IssuerDisplayEntry,
  isExpired: boolean,
  canBeDelivered: boolean,
  errorMessage: string
}

type ClaimRequest = {
  name: string,
  value: string,
  credential: DIDPlugin.VerifiableCredential, // credential related to this claim request
  canBeDelivered: boolean,  // Whether the requested claim can be delivered to caller or not. Almost similar to "credential" being null, except for "did"
  issuer: IssuerInfo, //Issuer details to display when credential is validated and/or requested
  isExpired: boolean,
  selected: boolean,
  reason: string // Additional usage info string provided by the caller
}

/**
 * Request example:
   {
      appPackageId: "org.mycompany.myapp",
      intentId: 1,
      action: "intent",
      nonce: "xxx",
      realm: "xxx",
      claims: {
        "email": true,
        "name": false,
        "gender": {
          required: false
        },
        "birthDate": true,
        "nation": true,
        "otherInexistingField":false,
        "diploma": {
          "required": false,
          "reason": "If provided, will be shown to end user"
        }
      },
      customization: null,
      originalJwtRequest: null,
      jwtExpirationDays: 1
    }
 */
@Component({
  selector: 'page-credentialaccessrequest',
  templateUrl: 'credentialaccessrequest.html',
  styleUrls: ['credentialaccessrequest.scss']
})
export class CredentialAccessRequestPage {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public receivedIntent: CredAccessIdentityIntent = null;
  // TODO public requestDappInfo: EssentialsIntentPlugin.AppInfo = null;
  public requestDappIcon: string = null;
  public requestDappName: string = null;
  public requestDappColor: string = '#565bdb';

  public profile = new Profile(); // Empty profile waiting to get the real one.
  public credentials: VerifiableCredential[] = [];
  public did: DID = null;

  public publishStatusFetched = false;
  public didNeedsToBePublished = false;
  public publishedDidRequested = false;
  public publishingDidRequired = false;

  public mandatoryItems: ClaimRequest[] = [];
  public optionalItems: ClaimRequest[] = [];

  public denyReason: string = '';
  public canDeliver: boolean = true;

  public showSpinner = false;
  public popup: any = null;

  constructor(
    private zone: NgZone,
    private sanitizer: DomSanitizer,
    public appServices: UXService,
    public didService: DIDService,
    private uxService: UXService,
    private authService: AuthService,
    private basicCredentialService: BasicCredentialsService,
    private translate: TranslateService,
    private profileService: ProfileService,
    private expirationService: ExpirationService,
    private didSyncService: DIDSyncService,
    public theme: ThemeService,
    private alertCtrl: AlertController,
    private popoverCtrl: PopoverController,
    private globalIntentService: GlobalIntentService,
    private intentService: IntentReceiverService
  ) {
  }

  ionViewWillEnter() {
    this.titleBar.setNavigationMode(TitleBarNavigationMode.CLOSE);
    this.titleBar.setTitle(' ');

    this.mandatoryItems = [];
    this.optionalItems = [];

    this.zone.run(async () => {
      this.profile = this.didService.getActiveDidStore().getActiveDid().getBasicProfile();
      this.credentials = this.didService.getActiveDidStore().getActiveDid().credentials;
      this.did = this.didService.getActiveDidStore().getActiveDid();
      this.didNeedsToBePublished = await this.didSyncService.checkIfDIDDocumentNeedsToBePublished(this.did);
      this.publishStatusFetched = true;
      Logger.log('Identity', 'Publish status fetched?', this.publishStatusFetched);
      Logger.log('Identity', 'Did needs to be published?', this.didNeedsToBePublished);

      this.receivedIntent = this.intentService.getReceivedIntent();

      await this.getRequestedTheme();
      await this.requiresPublishing();
      await this.organizeRequestedClaims();

      Logger.log('Identity', "Request Dapp color", this.requestDappColor);
      Logger.log('Identity', "Mandatory claims:", this.mandatoryItems);
      Logger.log('Identity', "Optional claims:", this.optionalItems);
    });
  }

  ionViewWillLeave() {
  }

  getRequestedTheme(): Promise<void> {
    Logger.log('Identity', 'Creating credentialaccessrequest page layout');
    return new Promise((resolve) => {
      const customization = this.receivedIntent.params.customization
      if(customization) {
        if(
          customization.hasOwnProperty('primarycolorlightmode') &&
          customization.hasOwnProperty('primarycolordarkmode')
        ) {
          !this.theme.darkMode ?
            this.requestDappColor = customization.primarycolorlightmode :
            this.requestDappColor = customization.primarycolordarkmode
        }
      }

      /* TODO
      this.globalIntentService.getAppInfo(this.requestDapp.appPackageId, (appInfo) => {
        this.requestDappInfo = appInfo;
        this.requestDappName = appInfo.name;
        this.requestDappIcon = appInfo.icons[0].src;
      });
      */

      resolve();
    });
  }

  requiresPublishing() {
    return new Promise((resolve) => {
      // Intent service marks value as true if intent does not specify 'publisheddid' params
      const publisheddidParams = this.receivedIntent.params.publisheddid;
      Logger.log('publisheddid params', this.receivedIntent.params.publisheddid);

      if(publisheddidParams) {
        if(this.publishStatusFetched && !this.didNeedsToBePublished) {
          this.publishingDidRequired = false;
        } else {
          this.alertDidNeedsPublishing();
          this.publishingDidRequired = true;
        }
      } else {
        // Request does not require published did
        this.publishingDidRequired = false;
      }

      resolve();
    });
  }

  /**
   * From the raw list of claims requested by the caller, we create our internal model
   * ready for UI.
   */
  async organizeRequestedClaims() {
    // Manually append the mandatory item "Your DID".
    this.addDIDToMandatoryItems();

    const did: string = this.didService.getActiveDidStore().getActiveDid().getDIDString();

    // Split into mandatory and optional items
    for (let key of Object.keys(this.receivedIntent.params.claims)) {
      const claim = this.receivedIntent.params.claims[key];
      const claimIsRequired = this.claimIsRequired(claim);

      // TODO: For now we consider that 1 claim = 1 credential = 1 info inside. In the future we may
      // have several info inside one credential, so even if the caller requests only one field from such
      // credential we will have to display the WHOLE fields inside the credential on this credacess screen
      // so that users know which infos are really going to be shared (credentials can't be split).

      // Retrieve current value from active store credentials
      let relatedCredential = this.findCredential(key);
      if (!relatedCredential) {
        Logger.warn('identity', "No credential found for requested claim:", key);
      }

      let credentialValue: string = null;
      if (relatedCredential)
        credentialValue = this.getBasicProfileCredentialValue(relatedCredential.pluginVerifiableCredential);

      // Don't display optional items that user doesn't have.
      if (!relatedCredential && !claimIsRequired)
        continue;

      let claimValue = this.credentialValueAsString(credentialValue);

      let hasRelatedCredential: boolean = (relatedCredential != null);

      let issuerInfo: IssuerInfo = {
        canBeDelivered : hasRelatedCredential,
        isExpired : false,
        displayItem: null,
        errorMessage: ""
      };

      let isExpired: boolean = false;

      if (hasRelatedCredential) {
        let credentialTypes: string[] = relatedCredential.pluginVerifiableCredential.getTypes();

        //Check if this credential is expired when validated
        if (!credentialTypes.includes("SelfProclaimedCredential"))  {
          let expirationInfo : ExpiredItem = this.expirationService.verifyCredentialExpiration(did, relatedCredential.pluginVerifiableCredential, 0);
          isExpired = expirationInfo.daysToExpire <= 0;
        }

        // Check if accepts self proclaimed credentials are accepted or
        // In case of validated credential, if credential issuer match with claim request
        if (!this.acceptsSelfProclaimedCredentials(claim.iss)) {
          if (credentialTypes.includes("SelfProclaimedCredential"))  {
            issuerInfo.canBeDelivered = false;
            issuerInfo.errorMessage = "Credential issuer is required";
          } else {
            let issuerDid: string = relatedCredential.pluginVerifiableCredential.getIssuer()
            let issuerExpirationInfo : ExpiredItem = this.expirationService.verifyCredentialExpiration(did, relatedCredential.pluginVerifiableCredential, 0);
            let issuerisExpired: boolean = issuerExpirationInfo.daysToExpire <= 0;
            let issuerIsAccepted: boolean = this.acceptsIssuer(claim.iss, issuerDid);
            issuerInfo.displayItem = await this.profileService.getIssuerDisplayEntryFromID(issuerDid)
            issuerInfo.isExpired = issuerisExpired
            issuerInfo.canBeDelivered = issuerIsAccepted && !issuerisExpired

            if (issuerisExpired)
            {
                issuerInfo.errorMessage = "Credential issuer DID is expired"
            }

            if (!issuerIsAccepted)
            {
              issuerInfo.errorMessage = "Credential issuer is not the same requested"
            }
          }
        }
      }

      let claimRequest: ClaimRequest = {
        name: key,
        value: claimValue,
        credential: (relatedCredential?relatedCredential.pluginVerifiableCredential:null),
        canBeDelivered: hasRelatedCredential,
        issuer: issuerInfo,
        selected: true,
        isExpired: isExpired,
        reason: ""
      };

      if (claimIsRequired) {
        this.mandatoryItems.push(claimRequest);

        // If at least one mandatory item is missing, we cannot complete the intent request.
        if (!hasRelatedCredential || !issuerInfo.canBeDelivered)
          this.canDeliver = false;
      } else {
        this.optionalItems.push(claimRequest);
      }
    }
  }

  /**
   * Some credentials are complex objects, not string. We want to returne a string representation for easier
   * display.
   */
  private credentialValueAsString(credentialValue: any): string {
    if (typeof credentialValue === "string")
      return credentialValue as string;
    else
      return this.translate.instant("cant-be-displayed");
  }

  addDIDToMandatoryItems() {
    let did: string = this.did.getDIDString();
    let didDocument : DIDDocument = this.did.getDIDDocument();
    let expiredState: ExpiredItem = this.expirationService.verifyDIDExpiration(did, didDocument , 0);
    Logger.log('Identity', "expiredState", expiredState)

    let claimRequest: ClaimRequest = {
      name: "did",
      value: did,
      credential: null,
      canBeDelivered: true,
      issuer: {
        canBeDelivered: true,
        displayItem: null,
        errorMessage: "",
        isExpired: false
      },
      isExpired: (expiredState.daysToExpire <= 0),
      selected: true,
      reason: ""
    };

    this.mandatoryItems.push(claimRequest);
  }

  async alertDidNeedsPublishing() {
    const alert = await this.alertCtrl.create({
      mode: 'ios',
      header: this.translate.instant('credaccess-alert-publish-required-title'),
      message: this.translate.instant('credaccess-alert-publish-required-msg'),
      backdropDismiss: false,
      buttons: [
       {
          text: this.translate.instant('credaccess-alert-publish-required-btn'),
          handler: () => {
            this.zone.run(() => {
              this.globalIntentService.sendIntentResponse(
                { jwt: null },
                this.receivedIntent.intentId
              );
            });
          }
        }
      ]
    });
    alert.present()
  }

  /**
   * NOTE: For now we assume that the credential name (fragment) is the same as the requested claim value.
   * But this may not be tue in the future: we would have to search inside credential properties one by one.
   *
   * key format: "my-key" (credential fragment)
   */
  findCredential(key: string): VerifiableCredential {
    return this.credentials.find((c)=>{
      return c.pluginVerifiableCredential.getFragment() == key;
    })
  }

  /**
   * NOTE: For now we assume that the credential name (fragment) is the same as the requested claim value.
   * But this may not be tue in the future: we would have to search inside credential properties one by one.
   */
  getBasicProfileCredentialValue(credential: DIDPlugin.VerifiableCredential): any {
    return credential.getSubject()[credential.getFragment()];
  }

  /**
   * Check if a raw claim provided by the caller is required or not. The "required" attribute
   * can be in various locations.
   */
  claimIsRequired(claimValue: any): boolean {
    if (claimValue instanceof Object) {
      return claimValue.required || false;
    }
    else {
      return claimValue; // Claim value itself is already a boolean
    }
  }

  /**
   * Check if self proclaimed credentials are accepted
   */
  acceptsSelfProclaimedCredentials(iss: any): boolean {
    let response: boolean = true
    if (!isNullOrUndefined(iss) && iss instanceof Object){
      response =  iss["selfproclaimed"];
    }

    Logger.log('Identity', "acceptsSelfProclaimedCredentials", iss, response)

    return response;
  }

   /**
   * Check if credential issuer match with requested
   */
  acceptsIssuer(iss: any, issuerDid: string): boolean {
    Logger.log('Identity', "acceptsIssuer", iss, issuerDid)

    if (isNullOrUndefined(iss)) return true;

    let issuersAccepted: string[] = iss["did"] || []

    return issuersAccepted.includes(issuerDid);
  }

  claimReason(claimValue: any): string {
    if (claimValue instanceof Object) {
      return claimValue.reason || null;
    }

    return null;
  }

  /**
   * Build a list of credentials ready to be packaged into a presentation, according to selections
   * done by user (some optional items could have been removed).
   */
  buildDeliverableCredentialsList() {
    let selectedCredentials: DIDPlugin.VerifiableCredential[] = [];

    // Add all mandatory credential inconditionally
    for (let i in this.mandatoryItems) {
      let item = this.mandatoryItems[i];

      if (item.credential) // Skip DID
        selectedCredentials.push(item.credential);
    }

    // Add selected optional credentials only
    for (let i in this.optionalItems) {
      let item = this.optionalItems[i];
      if (item.selected)
        selectedCredentials.push(item.credential);
    }

    Logger.log('Identity', JSON.parse(JSON.stringify(selectedCredentials)));

    return selectedCredentials;
  }

  async acceptRequest() {
    this.showSpinner = true;

    setTimeout(() => {
      let selectedCredentials = this.buildDeliverableCredentialsList();

      // Create and send the verifiable presentation that embeds the selected credentials
      AuthService.instance.checkPasswordThenExecute(async ()=>{
        let presentation = null;
        let currentDidString: string = this.didService.getActiveDid().getDIDString();
        presentation = await this.didService.getActiveDid().createVerifiablePresentationFromCredentials(selectedCredentials, this.authService.getCurrentUserPassword(), this.receivedIntent.params.nonce, this.receivedIntent.params.realm);
        Logger.log('Identity', "Created presentation:", presentation);

        let payload = {
          type: "credaccess",
          did:currentDidString,
          presentation: presentation,
        };

        // Return the original JWT token in case this intent was called by an external url (elastos scheme definition)
        // TODO: Currently adding elastos://credaccess/ in front of the JWT because of CR website requirement. But we should cleanup this and pass only the JWT itself
        if (this.receivedIntent.originalJwtRequest) {
          Logger.log('Identity', 'Intent is called by external intent', this.receivedIntent.originalJwtRequest);
          payload["req"] = "elastos://credaccess/"+this.receivedIntent.originalJwtRequest;

          let parsedJwt = await didManager.parseJWT(false, this.receivedIntent.originalJwtRequest);
          if (parsedJwt) {
            if (parsedJwt.payload["iss"]) {
              // If we had a ISS (jwt issuer) field in the JWT request, we return this as our AUD for the response
              // accoding the the elastos scheme
              payload["aud"] = parsedJwt.payload["iss"];
            }
          }
        }

        const jwtToken = await this.didService.getActiveDid().getDIDDocument().createJWT(
          payload,
          this.receivedIntent.jwtExpirationDays,
          this.authService.getCurrentUserPassword()
        );

        Logger.log('Identity', "Sending credaccess intent response for intent id "+ this.receivedIntent.intentId);
        try {
          if (this.receivedIntent.originalJwtRequest) {
            setTimeout(async () => {
              await this.appServices.sendIntentResponse("credaccess", {jwt: jwtToken}, this.receivedIntent.intentId);
              this.showSpinner = false;
            }, 1000);

          } else {
            await this.appServices.sendIntentResponse("credaccess", {jwt: jwtToken}, this.receivedIntent.intentId);
            this.showSpinner = false;
          }
        }
        catch (e) {
          await this.popup.ionicAlert("Response error", "Sorry, we were unable to return the right information to the calling app. "+e);
          this.showSpinner = false;
        }
      }, () => {
        // Cancelled
        this.showSpinner = false;
      });
    }, 100);
  }

  async rejectRequest() {
    await this.appServices.sendIntentResponse("credaccess", { did:null, presentation: null }, this.receivedIntent.intentId);
  }

  async showSuccess(jwtToken) {
    this.popup = await this.popoverCtrl.create({
        backdropDismiss: false,
        mode: 'ios',
        cssClass: 'successComponent',
        component: SuccessComponent,
    });
/*     this.popup.onWillDismiss().then(async () => {
      await this.appServices.sendIntentResponse("credaccess", {jwt: jwtToken}, this.requestDapp.intentId);
    }); */
    return await this.popup.present();
}

  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getDappIcon() {
    if(this.requestDappIcon) {
      return this.sanitize(this.requestDappIcon);
    } else {
      return 'assets/identity/icon/elastos-icon.svg'
    }
  }

  getDappName() {
    if(this.requestDappName) {
      return this.requestDappName;
    } else {
      return this.receivedIntent.params.appPackageId;
    }
  }

  getIntro() {
    if(!this.canDeliver) {
      return this.translate.instant('credaccess-missing');
    } else if (this.publishingDidRequired) {
      return this.translate.instant('credaccess-publish-required');
    } else {
      return this.translate.instant('credaccess-intro');
    }
  }

  getCredIcon(item: ClaimRequest): any {
    if(item.name === 'avatar') {
      if(!item.credential || !item.credential.getSubject() || !item.credential.getSubject()["avatar"]){
        return this.translate.instant('missing');
      }

      const subject = item.credential.getSubject();
      const avatar = subject["avatar"];
      return `data:${avatar["content-type"]};${avatar["type"]},${avatar["data"]}`;
    } else {
      const imgName = item.name === "did" ? "finger-print" : item.name;
      const theme = this.theme.darkMode ? "dark" : "light";
      return `/assets/identity/smallIcons/nofill/${imgName}.svg`;
    }
  }

  getItemValueDisplay(item: ClaimRequest) {
    if(!item.canBeDelivered) {
      return this.translate.instant('missing');
    } else if (item.canBeDelivered && !item.issuer.canBeDelivered) {
      return this.translate.instant(item.issuer.errorMessage)
    } else {
      return item.value;
    }
  }
}
