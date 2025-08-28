import { AccountAbstractionService } from "src/app/wallet/services/account-abstraction/account-abstraction.service";
import { WalletService } from "src/app/wallet/services/wallet.service";
import { Transfer } from "../../../../services/cointransfer.service";
import { SafeService } from "../../../../services/safe.service";
import { AccountAbstractionMasterWallet } from "../../../masterwallets/account.abstraction.masterwallet";
import { Safe } from "../../../safes/safe";
import { SignTransactionResult } from "../../../safes/safe.types";
import { AnyNetworkWallet } from "../../base/networkwallets/networkwallet";
import { AnySubWallet } from "../../base/subwallets/subwallet";
import { AccountAbstractionProvider } from "../account-abstraction-provider";
import { EVMNetwork } from "../evm.network";

/**
 * Safe specialized for Account Abstraction wallets
 */
export class AASafe extends Safe {
  private safeService = SafeService.instance;
  private aaProvider: AccountAbstractionProvider;
  private aaAddress: string;

  constructor(protected masterWallet: AccountAbstractionMasterWallet) {
    super(masterWallet);
  }

  public async initialize(networkWallet: AnyNetworkWallet): Promise<void> {
    await super.initialize(networkWallet);

    this.aaProvider = AccountAbstractionService.instance.getProviderById(
      this.masterWallet.getAAProviderId()
    );

    if (!this.aaProvider) {
      throw new Error(
        `Cannot create safe, account abstraction provider with id ${this.masterWallet.getAAProviderId()} was not found.`
      );
    }

    const network = networkWallet.network as EVMNetwork;

    const controllerWallet = WalletService.instance.getMasterWallet(
      this.masterWallet.getControllerWalletId()
    );

    if (!controllerWallet) {
      throw new Error(
        `Cannot create safe, controller wallet with id ${this.masterWallet.getControllerWalletId()} was not found.`
      );
    }

    const controllerNetworkWallet = await network.createNetworkWallet(
      controllerWallet,
      false
    );

    const controllerAccount = controllerNetworkWallet.getAddresses()[0].address;

    this.aaAddress = await this.aaProvider.getAccountAddress(
      controllerAccount,
      network.getMainChainID()
    );

    if (!this.aaAddress) {
      throw new Error(
        `Cannot create safe, account abstraction address was not found.`
      );
    }
  }

  public getAddresses(
    startIndex: number,
    count: number,
    internalAddresses: boolean,
    usage: any
  ): string[] {
    if (startIndex === 0) {
      return [this.aaAddress];
    } else {
      return [];
    }
  }

  public signTransaction(
    subWallet: AnySubWallet,
    rawTx: any,
    transfer: Transfer,
    forcePasswordPrompt?: boolean,
    visualFeedback?: boolean
  ): Promise<SignTransactionResult> {
    // AA wallets don't sign transactions directly
    // They use the controller wallet for signing
    throw new Error(
      "AA wallets don't sign transactions directly. Use the controller wallet."
    );
  }
}
