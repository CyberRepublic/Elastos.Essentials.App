import { Component, OnInit, ViewChild } from "@angular/core";
import { IonInput, IonSelect } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { TitleBarComponent } from "src/app/components/titlebar/titlebar.component";
import { Logger } from "src/app/logger";
import { GlobalEvents } from "src/app/services/global.events.service";
import { GlobalPopupService } from "src/app/services/global.popup.service";
import { GlobalThemeService } from "src/app/services/theming/global.theme.service";
import { MasterWallet } from "src/app/wallet/model/masterwallets/masterwallet";
import { WalletType } from "src/app/wallet/model/masterwallets/wallet.types";
import {
  AAAccountRegistryService,
  AAChainConfig,
  AAImplementation,
} from "src/app/wallet/services/aa/aa.account.registry.service";
import { AuthService } from "src/app/wallet/services/auth.service";
import { Native } from "src/app/wallet/services/native.service";
import { WalletService } from "src/app/wallet/services/wallet.service";
import { WalletUIService } from "src/app/wallet/services/wallet.ui.service";

@Component({
  selector: "app-aa-create",
  templateUrl: "./aa-create.page.html",
  styleUrls: ["./aa-create.page.scss"],
})
export class AACreatePage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild("walletNameInput", { static: false }) walletNameInput: IonInput;
  @ViewChild("chainSelect", { static: false }) chainSelect: IonSelect;
  @ViewChild("implementationSelect", { static: false })
  implementationSelect: IonSelect;

  public wallet = {
    name: "",
    controllerWalletId: "",
    chainId: null,
    implementation: null as AAImplementation | null,
    aaContractAddress: "",
    isDeployed: false,
  };

  public availableChains: AAChainConfig[] = [];
  public availableImplementations: AAImplementation[] = [];
  public controllerWallets: MasterWallet[] = [];
  public selectedChain: AAChainConfig | null = null;

  public walletIsCreating = false;

  constructor(
    private translate: TranslateService,
    private theme: GlobalThemeService,
    private walletService: WalletService,
    private walletUIService: WalletUIService,
    private authService: AuthService,
    private native: Native,
    private events: GlobalEvents,
    private globalPopupService: GlobalPopupService,
    private aaRegistry: AAAccountRegistryService
  ) {
    this.initData();
  }

  ngOnInit() {
    this.titleBar.setTitle(this.translate.instant("wallet.aa.create.title"));
  }

  private initData() {
    // Get available chains
    this.availableChains = this.aaRegistry.getSupportedChains();

    // Get available implementations
    this.availableImplementations =
      this.aaRegistry.getAvailableImplementations();

    // Get controller wallets (standard and ledger wallets that can control AA wallets)
    this.controllerWallets = this.walletService
      .getMasterWalletsList()
      .filter(
        (wallet) =>
          wallet.type === WalletType.STANDARD ||
          wallet.type === WalletType.LEDGER
      );
  }

  public onChainChanged(event: any) {
    const chainId = parseInt(event.detail.value);
    this.selectedChain = this.aaRegistry.getChainConfig(chainId);

    if (this.selectedChain) {
      // Filter implementations for this chain
      this.availableImplementations =
        this.aaRegistry.getImplementationsForChain(chainId);

      // Reset implementation selection
      this.wallet.implementation = null;
    }
  }

  public onImplementationChanged(event: any) {
    const factoryAddress = event.detail.value;
    this.wallet.implementation =
      this.aaRegistry.getImplementationByFactory(factoryAddress);
  }

  public onContractAddressChanged(event: any) {
    this.wallet.aaContractAddress = event.detail.value;
  }

  public onDeployedChanged(event: any) {
    this.wallet.isDeployed = event.detail.checked;
  }

  public allInputsValid(): boolean {
    return !!(
      this.wallet.name &&
      this.wallet.controllerWalletId &&
      this.wallet.chainId &&
      this.wallet.implementation &&
      this.wallet.aaContractAddress
    );
  }

  public async createWallet() {
    if (!this.allInputsValid()) {
      this.native.toast(
        this.translate.instant("wallet.aa.create.validation-error")
      );
      return;
    }

    if (this.walletIsCreating) {
      return;
    }

    this.walletIsCreating = true;

    try {
      const walletId = this.walletService.createMasterWalletID();

      // Create wallet password
      const payPassword = await this.authService.createAndSaveWalletPassword(
        walletId
      );
      if (!payPassword) {
        this.walletIsCreating = false;
        return;
      }

      await this.native.showLoading(
        this.translate.instant("common.please-wait")
      );

      // Create the AA wallet
      await this.walletService.newAccountAbstractionWallet(
        walletId,
        this.wallet.name,
        this.wallet.controllerWalletId,
        this.wallet.aaContractAddress,
        this.wallet.chainId,
        this.wallet.implementation.factoryAddress,
        this.wallet.implementation.entryPointAddress,
        this.wallet.implementation.implementationAddress,
        this.wallet.isDeployed
      );

      await this.native.hideLoading();

      // Navigate to wallet home
      this.native.setRootRouter("/wallet/wallet-home");

      // Notify wallet creation
      this.events.publish("masterwalletcount:changed", {
        action: "add",
        walletId: walletId,
      });
    } catch (error) {
      Logger.error("wallet", "AA wallet creation error:", error);
      await this.native.hideLoading();

      await this.globalPopupService.ionicAlert(
        "common.error",
        error.message || this.translate.instant("wallet.aa.create.error")
      );
    } finally {
      this.walletIsCreating = false;
    }
  }

  public getSelectedChainName(): string {
    if (!this.selectedChain) return "";
    return this.selectedChain.chainName;
  }

  public getSelectedImplementationName(): string {
    if (!this.wallet.implementation) return "";
    return this.wallet.implementation.name;
  }

  public getControllerWalletName(walletId: string): string {
    const wallet = this.controllerWallets.find((w) => w.id === walletId);
    return wallet ? wallet.name : walletId;
  }
}
