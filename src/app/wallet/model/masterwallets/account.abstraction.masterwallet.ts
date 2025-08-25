import { WalletJSSDKHelper } from "../networks/elastos/wallet.jssdk.helper";
import { AnyNetwork } from "../networks/network";
import { MasterWallet } from "./masterwallet";
import { SerializedAccountAbstractionMasterWallet } from "./wallet.types";

export class AccountAbstractionMasterWallet extends MasterWallet {
  public controllerWalletId: string;
  public aaContractAddress: string;
  public chainId: number;
  public factoryAddress: string;
  public entryPointAddress: string;
  public implementationAddress: string;
  public isDeployed: boolean;

  public static newFromSerializedWallet(
    serialized: SerializedAccountAbstractionMasterWallet
  ): AccountAbstractionMasterWallet {
    let masterWallet = new AccountAbstractionMasterWallet();

    // Base type deserialization
    masterWallet.deserialize(serialized);

    return masterWallet;
  }

  public async destroy() {
    // Destroy the wallet in the wallet js sdk if it exists
    try {
      await WalletJSSDKHelper.destroyWallet(this.id);
    } catch (e) {
      // Wallet might not exist in JS SDK, ignore error
    }
  }

  protected deserialize(serialized: SerializedAccountAbstractionMasterWallet) {
    super.deserialize(serialized);

    this.controllerWalletId = serialized.controllerWalletId;
    this.aaContractAddress = serialized.aaContractAddress;
    this.chainId = serialized.chainId;
    this.factoryAddress = serialized.factoryAddress;
    this.entryPointAddress = serialized.entryPointAddress;
    this.implementationAddress = serialized.implementationAddress;
    this.isDeployed = serialized.isDeployed;
  }

  public serialize(): SerializedAccountAbstractionMasterWallet {
    let serialized: SerializedAccountAbstractionMasterWallet =
      {} as SerializedAccountAbstractionMasterWallet;

    super._serialize(serialized as SerializedAccountAbstractionMasterWallet);

    serialized.controllerWalletId = this.controllerWalletId;
    serialized.aaContractAddress = this.aaContractAddress;
    serialized.chainId = this.chainId;
    serialized.factoryAddress = this.factoryAddress;
    serialized.entryPointAddress = this.entryPointAddress;
    serialized.implementationAddress = this.implementationAddress;
    serialized.isDeployed = this.isDeployed;

    return serialized;
  }

  public hasMnemonicSupport(): boolean {
    return false; // AA wallets don't have mnemonics, they're controlled by other wallets
  }

  public supportsNetwork(network: AnyNetwork): boolean {
    // AA wallets are only supported on EVM networks
    if (
      network.key === "ethereum" ||
      network.key === "bsc" ||
      network.key === "polygon" ||
      network.key === "arbitrum" ||
      network.key === "optimism" ||
      network.key === "avalanche" ||
      network.key === "fantom" ||
      network.key === "cronos" ||
      network.key === "fuse" ||
      network.key === "gnosis" ||
      network.key === "evmos" ||
      network.key === "celo" ||
      network.key === "bttc" ||
      network.key === "kava" ||
      network.key === "telos" ||
      network.key === "iotex" ||
      network.key === "fusion" ||
      network.key === "elastos"
    ) {
      return true;
    }
    return false;
  }

  /**
   * Get the controller wallet that manages this AA wallet
   */
  public getControllerWalletId(): string {
    return this.controllerWalletId;
  }

  /**
   * Get the AA contract address
   */
  public getAAContractAddress(): string {
    return this.aaContractAddress;
  }

  /**
   * Get the chain ID where this AA wallet exists
   */
  public getChainId(): number {
    return this.chainId;
  }

  /**
   * Check if this AA wallet is deployed on-chain
   */
  public isWalletDeployed(): boolean {
    return this.isDeployed;
  }
}
