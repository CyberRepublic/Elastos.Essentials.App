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
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { WalletNetworkService } from "src/app/wallet/services/network.service";
import { WalletCreationService } from "src/app/wallet/services/walletcreation.service";

@Component({
  selector: "app-aa-create",
  templateUrl: "./aa-create.page.html",
  styleUrls: ["./aa-create.page.scss"],
})
export class AACreatePage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild("chainSelect", { static: false }) chainSelect: IonSelect;
  @ViewChild("implementationSelect", { static: false })
  implementationSelect: IonSelect;

  public wallet = {
    name: "", // Will be set from wallet creation service
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
    private aaRegistry: AAAccountRegistryService,
    private evmService: EVMService,
    private walletNetworkService: WalletNetworkService,
    private walletCreationService: WalletCreationService
  ) {
    this.initData();
  }

  ngOnInit() {
    this.titleBar.setTitle(this.translate.instant("wallet.aa.create.title"));
    // Get wallet name from wallet creation service
    this.wallet.name = this.walletCreationService.name;
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
      
      // Auto-detect contract address for this chain
      this.autoDetectContractAddress(chainId);
    }
  }

  public onImplementationChanged(event: any) {
    const factoryAddress = event.detail.value;
    this.wallet.implementation =
      this.aaRegistry.getImplementationByFactory(factoryAddress);
    
    // Auto-detect if account is deployed
    if (this.wallet.implementation && this.wallet.aaContractAddress) {
      void this.autoDetectAccountDeployment();
    }
  }

  public onDeployedChanged(event: any) {
    this.wallet.isDeployed = event.detail.checked;
  }

  /**
   * Auto-detect the contract address for the selected chain
   */
  private autoDetectContractAddress(chainId: number) {
    // For now, use a hardcoded address for ECO chain (12343)
    // TODO: Implement proper contract address detection logic
    if (chainId === 12343) {
      this.wallet.aaContractAddress = "0x0000000000000000000000000000000000000000"; // TODO: Set actual ECO AA contract address
    } else {
      this.wallet.aaContractAddress = "";
    }
  }

  /**
   * Auto-detect if the AA account is already deployed
   */
  private async autoDetectAccountDeployment() {
    if (!this.wallet.aaContractAddress || !this.wallet.chainId) {
      return;
    }

    try {
      // Get the network for the selected chain
      const network = this.walletNetworkService.getNetworkByChainId(this.wallet.chainId);
      if (!network) {
        Logger.warn("wallet", "Network not found for chain ID:", this.wallet.chainId);
        return;
      }

      // Check if the contract address has code (indicating it's deployed)
      const isDeployed = await this.evmService.isContractAddress(network, this.wallet.aaContractAddress);
      this.wallet.isDeployed = isDeployed;
      
      Logger.log("wallet", "Auto-detected account deployment status:", isDeployed);
    } catch (error) {
      Logger.error("wallet", "Failed to auto-detect account deployment:", error);
      // Keep the current isDeployed value if detection fails
    }
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

  public getControllerWalletName(walletId: string): string {
    const wallet = this.controllerWallets.find((w) => w.id === walletId);
    return wallet ? wallet.name : walletId;
  }
}
