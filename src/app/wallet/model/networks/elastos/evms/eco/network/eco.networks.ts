import type { ConfigInfo } from "@elastosfoundation/wallet-js-sdk";
import { Logger } from "src/app/logger";
import { GlobalElastosAPIService } from "src/app/services/global.elastosapi.service";
import {
  MAINNET_TEMPLATE,
  TESTNET_TEMPLATE,
} from "src/app/services/global.networks.service";
import { CoinID, ERC20Coin, StandardCoinName } from "src/app/wallet/model/coin";
import { AccountAbstractionMasterWallet } from "src/app/wallet/model/masterwallets/account.abstraction.masterwallet";
import type { LedgerMasterWallet } from "src/app/wallet/model/masterwallets/ledger.masterwallet";
import type {
  MasterWallet,
  StandardMasterWallet,
} from "src/app/wallet/model/masterwallets/masterwallet";
import {
  PrivateKeyType,
  WalletNetworkOptions,
  WalletType,
} from "src/app/wallet/model/masterwallets/wallet.types";
import { NetworkAPIURLType } from "../../../../base/networkapiurltype";
import type { AnyNetworkWallet } from "../../../../base/networkwallets/networkwallet";
import { AASafe } from "../../../../evms/safes/aa.safe";
import { ERC20SubWallet } from "../../../../evms/subwallets/erc20.subwallet";
import { ElastosEVMNetwork } from "../../../network/elastos.evm.network";
import { EcoERC20SubWallet } from "../subwallets/eco.erc20.subwallet";

export abstract class ElastosECONetworkBase extends ElastosEVMNetwork<WalletNetworkOptions> {
  public static NETWORK_KEY = "elastoseco";

  public async newNetworkWallet(
    masterWallet: MasterWallet
  ): Promise<AnyNetworkWallet> {
    switch (masterWallet.type) {
      case WalletType.STANDARD:
        const ElastosECOChainStandardNetworkWallet = (
          await import("../networkwallets/standard/eco.networkwallet")
        ).ElastosECOChainStandardNetworkWallet;
        return new ElastosECOChainStandardNetworkWallet(
          masterWallet as StandardMasterWallet,
          this
        );
      case WalletType.LEDGER:
        const ElastosECOLedgerNetworkWallet = (
          await import("../networkwallets/ledger/eco.networkwallet")
        ).ElastosECOLedgerNetworkWallet;
        return new ElastosECOLedgerNetworkWallet(
          masterWallet as LedgerMasterWallet,
          this
        );
      case WalletType.ACCOUNT_ABSTRACTION:
        const ElastosECOAccountAbstractionNetworkWallet = (
          await import("../../../../evms/networkwallets/aa.networkwallet")
        ).AANetworkWallet;
        return new ElastosECOAccountAbstractionNetworkWallet(
          masterWallet as AccountAbstractionMasterWallet,
          this,
          new AASafe(masterWallet),
          "ECO",
          "Account Abstraction"
        );
      default:
        Logger.warn(
          "wallet",
          "Elastos ECO does not support ",
          masterWallet.type
        );
        return null;
    }
  }

  public async createERC20SubWallet(
    networkWallet: AnyNetworkWallet,
    coinID: CoinID,
    startBackgroundUpdates = true
  ): Promise<ERC20SubWallet> {
    let subWallet = new EcoERC20SubWallet(networkWallet, coinID);
    await subWallet.initialize();
    if (startBackgroundUpdates) void subWallet.startBackgroundUpdates();
    return subWallet;
  }

  public getEVMSPVConfigName(): string {
    return StandardCoinName.ETHECO;
  }

  public supportsERC20Coins() {
    return true;
  }

  public supportsERCNFTs() {
    return true;
  }

  public getDefaultWalletNetworkOptions(): WalletNetworkOptions {
    return {
      network: this.key,
    };
  }

  public supportedPrivateKeyTypes(): PrivateKeyType[] {
    // None by default. If this method is not overriden by the network,
    // the network can't handle any import by private key
    return [PrivateKeyType.EVM];
  }

  public getMainColor(): string {
    return "535353";
  }
}

/**
 * Elastos ECO Chain
 */
export class ElastosECOMainNetNetwork extends ElastosECONetworkBase {
  constructor() {
    super(
      ElastosECONetworkBase.NETWORK_KEY,
      "Elastos ECO Chain",
      "ECO",
      "assets/wallet/networks/elastos-eco.svg",
      MAINNET_TEMPLATE,
      12343
    );
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC)
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForRpc(
          StandardCoinName.ETHECO
        ),
        MAINNET_TEMPLATE
      );
    else if (type === NetworkAPIURLType.ETHERSCAN) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBrowser(
          StandardCoinName.ETHECO
        ),
        MAINNET_TEMPLATE
      );
    } else if (type === NetworkAPIURLType.BLOCK_EXPLORER) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBlockExplorer(
          StandardCoinName.ETHECO
        ),
        MAINNET_TEMPLATE
      );
    } else return null;
  }

  public getBuiltInERC20Coins(): ERC20Coin[] {
    return [];
  }

  public updateSPVNetworkConfig(onGoingConfig: ConfigInfo) {
    onGoingConfig["ETHECO"] = { chainID: "12343", NetworkID: "12343" };
  }

  // When the user manually sets the gas price, it cannot be less than this value.
  // The unit is gwei.
  public getMinGasprice(): number {
    // return 50;
    return 1;
  }
}

export class ElastosECOTestNetNetwork extends ElastosECONetworkBase {
  constructor() {
    super(
      ElastosECONetworkBase.NETWORK_KEY,
      "ECO Testnet",
      "ECO Testnet",
      "assets/wallet/networks/elastos-eco.svg",
      TESTNET_TEMPLATE,
      800007
    );
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC)
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForRpc(
          StandardCoinName.ETHECO
        ),
        TESTNET_TEMPLATE
      );
    else if (type === NetworkAPIURLType.ETHERSCAN) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBrowser(
          StandardCoinName.ETHECO
        ),
        TESTNET_TEMPLATE
      );
    } else if (type === NetworkAPIURLType.BLOCK_EXPLORER) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBlockExplorer(
          StandardCoinName.ETHECO
        ),
        TESTNET_TEMPLATE
      );
    } else return null;
  }

  public getBuiltInERC20Coins(): ERC20Coin[] {
    return [];
  }

  public updateSPVNetworkConfig(onGoingConfig: ConfigInfo) {
    onGoingConfig["ETHECO"] = { chainID: "800007", NetworkID: "800007" };
  }

  // When the user manually sets the gas price, it cannot be less than this value.
  // The unit is gwei.
  public getMinGasprice(): number {
    // return 50;
    return 1;
  }
}
