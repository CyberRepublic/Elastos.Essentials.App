import { SafeService } from "../../services/safe.service";
import { WalletJSSDKHelper } from "../networks/elastos/wallet.jssdk.helper";
import { EVMNetwork } from "../networks/evms/evm.network";
import { AnyNetwork } from "../networks/network";
import { MasterWallet } from "./masterwallet";
import { SerializedAccountAbstractionMasterWallet } from "./wallet.types";

/**
 * One AA master wallet can work only on ONE chain (network wallet).
 */
export class AccountAbstractionMasterWallet extends MasterWallet {
  public controllerWalletId: string;
  public chainId: number;

  public static newFromSerializedWallet(
    serialized: SerializedAccountAbstractionMasterWallet
  ): AccountAbstractionMasterWallet {
    let masterWallet = new AccountAbstractionMasterWallet();

    // Base type deserialization
    masterWallet.deserialize(serialized);

    return masterWallet;
  }

  public async destroy() {
    // Clean up safe data
    await SafeService.instance.saveAASafe(this.id);

    // Destroy the wallet in the wallet js sdk if it exists
    try {
      await WalletJSSDKHelper.destroyWallet(this.id);
    } catch (e) {
      // Wallet might not exist in JS SDK, ignore error
    }
  }

  protected deserialize(serialized: SerializedAccountAbstractionMasterWallet) {
    super.deserialize(serialized);

    this.controllerWalletId = serialized.controllerMasterWalletId;
    // Remove chainId and isDeployed from here since they're network-specific

    // Load safe data
    void SafeService.instance.loadAASafe(this.id);
  }

  public serialize(): SerializedAccountAbstractionMasterWallet {
    let serialized: SerializedAccountAbstractionMasterWallet =
      {} as SerializedAccountAbstractionMasterWallet;

    super._serialize(serialized as SerializedAccountAbstractionMasterWallet);

    serialized.controllerMasterWalletId = this.controllerWalletId;
    // Remove chainId and isDeployed since they're now in safe

    return serialized;
  }

  public hasMnemonicSupport(): boolean {
    return false; // AA wallets don't have mnemonics, they're controlled by other wallets
  }

  public supportsNetwork(network: AnyNetwork): boolean {
    // AA wallets are only supported on EVM networks
    if (!network.isEVMNetwork()) {
      return false;
    }

    const evmNetwork = network as EVMNetwork;

    if (evmNetwork.getMainChainID() !== this.chainId) {
      return false;
    }

    return true;
  }

  /**
   * Get the controller wallet that manages this AA wallet
   */
  public getControllerWalletId(): string {
    return this.controllerWalletId;
  }

  /**
   * Get the chain ID where this AA wallet exists
   */
  public getChainId(): number {
    return this.chainId;
  }

  /**
   * Get deployed address for a specific network
   */
  public getDeployedAddress(networkKey: string): string | null {
    return SafeService.instance.getAADeployedAddress(this.id, networkKey);
  }

  /**
   * Check if wallet is deployed on a specific network
   */
  public isDeployed(networkKey: string): boolean {
    return SafeService.instance.isAAWalletDeployed(this.id, networkKey);
  }
}
