import { Component, OnInit, ViewChild } from "@angular/core";
import { IonSelect } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { TitleBarComponent } from "src/app/components/titlebar/titlebar.component";
import { Logger } from "src/app/logger";
import { GlobalEvents } from "src/app/services/global.events.service";
import { GlobalPopupService } from "src/app/services/global.popup.service";
import { GlobalThemeService } from "src/app/services/theming/global.theme.service";
import { MasterWallet } from "src/app/wallet/model/masterwallets/masterwallet";
import { WalletType } from "src/app/wallet/model/masterwallets/wallet.types";
import {
  AccountAbstractionProvider,
  AccountAbstractionProviderChainConfig,
} from "src/app/wallet/model/networks/evms/account-abstraction-provider";
import { AccountAbstractionService } from "src/app/wallet/services/account-abstraction/account-abstraction.service";
import { AuthService } from "src/app/wallet/services/auth.service";
import { EVMService } from "src/app/wallet/services/evm/evm.service";
import { Native } from "src/app/wallet/services/native.service";
import { WalletNetworkService } from "src/app/wallet/services/network.service";
import { WalletService } from "src/app/wallet/services/wallet.service";
import { WalletUIService } from "src/app/wallet/services/wallet.ui.service";
import { WalletCreationService } from "src/app/wallet/services/walletcreation.service";

@Component({
  selector: "app-aa-create",
  templateUrl: "./aa-create.page.html",
  styleUrls: ["./aa-create.page.scss"],
})
export class AACreatePage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild("chainSelect", { static: false }) chainSelect: IonSelect;
  @ViewChild("providerSelect", { static: false })
  providerSelect: IonSelect;

  public wallet = {
    name: "", // Will be set from wallet creation service
    controllerWalletId: "",
    chainId: null,
    provider: null as AccountAbstractionProvider | null,
    providerName: "", // Store the provider name for display
    aaContractAddress: "",
  };

  public availableChains: AccountAbstractionProviderChainConfig[] = [];
  public availableProviders: AccountAbstractionProvider[] = [];
  public filteredProviders: AccountAbstractionProvider[] = []; // Providers filtered by chain
  public controllerWallets: MasterWallet[] = [];
  public selectedChain: AccountAbstractionProviderChainConfig | null = null;
  public isFetchingAddress = false;

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
    private accountAbstractionService: AccountAbstractionService,
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
    // Get all available providers
    this.availableProviders = this.accountAbstractionService.getProviders();
    Logger.log("wallet", "All available providers:", this.availableProviders);

    // Initialize filtered providers (empty initially)
    this.filteredProviders = [];

    // Get all unique chains from all providers
    const allChains = new Map<number, AccountAbstractionProviderChainConfig>();
    this.availableProviders.forEach((provider) => {
      provider.supportedChains.forEach((chainConfig) => {
        if (!allChains.has(chainConfig.chainId)) {
          allChains.set(chainConfig.chainId, chainConfig);
        }
      });
    });
    this.availableChains = Array.from(allChains.values());
    Logger.log("wallet", "Available chains:", this.availableChains);

    // Get controller wallets (standard and ledger wallets that can control AA wallets)
    this.controllerWallets = this.walletService
      .getMasterWalletsList()
      .filter(
        (wallet) =>
          wallet.type === WalletType.STANDARD ||
          wallet.type === WalletType.LEDGER
      );
    Logger.log("wallet", "Controller wallets:", this.controllerWallets);
  }

  public onChainChanged(event: any) {
    const chainId = parseInt(event.detail.value);
    Logger.log("wallet", "Chain changed to:", chainId);

    this.selectedChain =
      this.availableChains.find((chain) => chain.chainId === chainId) || null;

    if (this.selectedChain) {
      // Filter providers for this chain
      this.filteredProviders =
        this.accountAbstractionService.getProvidersForChain(chainId);

      Logger.log(
        "wallet",
        "Available providers for chain:",
        this.filteredProviders
      );

      // Reset provider selection and contract address
      this.wallet.provider = null;
      this.wallet.providerName = ""; // Reset provider name
      this.wallet.aaContractAddress = "";

      Logger.log(
        "wallet",
        "Reset provider selection. Provider name:",
        this.wallet.providerName
      );
    }
  }

  public onProviderChanged(event: any) {
    const providerName = event.detail.value;
    Logger.log("wallet", "Provider changed to:", providerName);

    // Set the provider name first
    this.wallet.providerName = providerName;

    // Then get the provider object
    this.wallet.provider =
      this.accountAbstractionService.getProviderByName(providerName);

    Logger.log("wallet", "Provider object:", this.wallet.provider);
    Logger.log("wallet", "Provider name:", this.wallet.providerName);

    // Now that we have a provider, we can compute the account address
    if (this.wallet.provider && this.wallet.controllerWalletId) {
      void this.computeAccountAddress();
    }
  }

  public onControllerWalletChanged(event: any) {
    const controllerWalletId = event.detail.value;
    this.wallet.controllerWalletId = controllerWalletId;

    // Reset contract address when controller wallet changes
    this.wallet.aaContractAddress = "";
    this.wallet.providerName = ""; // Reset provider name
    this.wallet.provider = null; // Reset provider object

    // If we have a provider selected, compute the new address
    if (this.wallet.provider && this.wallet.controllerWalletId) {
      void this.computeAccountAddress();
    }
  }

  /**
   * Compute the account address using the selected provider
   */
  private async computeAccountAddress() {
    if (
      !this.wallet.provider ||
      !this.wallet.controllerWalletId ||
      !this.wallet.chainId
    ) {
      return;
    }

    this.isFetchingAddress = true;

    try {
      // Get the EVM network by chain ID
      const network = this.walletNetworkService.getNetworkByChainId(
        this.wallet.chainId
      );
      if (!network) {
        throw new Error(
          `Network not found for chain ID: ${this.wallet.chainId}`
        );
      }

      // Get the master wallet
      const masterWallet = this.walletService.getMasterWallet(
        this.wallet.controllerWalletId
      );
      if (!masterWallet) {
        throw new Error(
          `Master wallet not found: ${this.wallet.controllerWalletId}`
        );
      }

      // Create a network wallet instance
      const networkWallet = await network.createNetworkWallet(
        masterWallet,
        false
      );
      if (!networkWallet) {
        throw new Error(
          `Failed to create network wallet for chain ID: ${this.wallet.chainId}`
        );
      }

      // Get the EOA account address from the network wallet
      const addresses = networkWallet.getAddresses();
      if (!addresses || addresses.length === 0) {
        throw new Error(`No addresses found in network wallet`);
      }

      // Get the first address (main EOA address)
      const eoaAddress = addresses[0].address;
      Logger.log("wallet", "Retrieved EOA address:", eoaAddress);

      // Use the provider to compute the AA account address
      this.wallet.aaContractAddress =
        await this.wallet.provider.getAccountAddress(
          eoaAddress,
          this.wallet.chainId
        );
    } catch (error) {
      Logger.error("wallet", "Failed to compute account address:", error);
      this.wallet.aaContractAddress = "";
    } finally {
      this.isFetchingAddress = false;
    }
  }

  /**
   * Get the display name for a chain
   */
  public getChainDisplayName(chainId: number): string {
    const network = this.walletNetworkService.getNetworkByChainId(chainId);
    return network ? network.name : `Chain ${chainId}`;
  }

  public allInputsValid(): boolean {
    return !!(
      this.wallet.name &&
      this.wallet.controllerWalletId &&
      this.wallet.chainId &&
      this.wallet.providerName &&
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

      // Create the AA wallet (always assume not deployed for now)
      await this.walletService.newAccountAbstractionWallet(
        walletId,
        this.wallet.name,
        this.wallet.controllerWalletId,
        this.wallet.chainId,
        false // Always assume not deployed
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
