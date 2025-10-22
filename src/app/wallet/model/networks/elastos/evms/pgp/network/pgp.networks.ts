import type { ConfigInfo } from "@elastosfoundation/wallet-js-sdk";
import { Logger } from "src/app/logger";
import { GlobalElastosAPIService } from "src/app/services/global.elastosapi.service";
import { MAINNET_TEMPLATE, TESTNET_TEMPLATE } from "src/app/services/global.networks.service";
import { CoinID, ERC20Coin, StandardCoinName } from "src/app/wallet/model/coin";
import type { LedgerMasterWallet } from "src/app/wallet/model/masterwallets/ledger.masterwallet";
import type { MasterWallet, StandardMasterWallet } from "src/app/wallet/model/masterwallets/masterwallet";
import { PrivateKeyType, WalletNetworkOptions, WalletType } from "src/app/wallet/model/masterwallets/wallet.types";
import { NetworkAPIURLType } from "../../../../base/networkapiurltype";
import type { AnyNetworkWallet } from "../../../../base/networkwallets/networkwallet";
import { ElastosEVMNetwork } from "../../../network/elastos.evm.network";
import { ERC20SubWallet } from "../../../../evms/subwallets/erc20.subwallet";
import { PGPERC20SubWallet } from "../subwallets/pgp.erc20.subwallet";
import { ElastosECOPGPOracleCustomCurrencyProvider } from "../currency/pgp.oracle.custom.currency.provider";

export abstract class ElastosPGPNetworkBase extends ElastosEVMNetwork<WalletNetworkOptions> {
  public static NETWORK_KEY = "elastosecopgp";

  public async newNetworkWallet(masterWallet: MasterWallet): Promise<AnyNetworkWallet> {
    switch (masterWallet.type) {
      case WalletType.STANDARD:
        const ElastosPGPChainStandardNetworkWallet = (await import("../networkwallets/standard/pgp.networkwallet"))
          .ElastosPGPChainStandardNetworkWallet;
        return new ElastosPGPChainStandardNetworkWallet(masterWallet as StandardMasterWallet, this);
      case WalletType.LEDGER:
        const ElastosPGPLedgerNetworkWallet = (await import("../networkwallets/ledger/pgp.networkwallet"))
          .ElastosPGPLedgerNetworkWallet;
        return new ElastosPGPLedgerNetworkWallet(masterWallet as LedgerMasterWallet, this);
      default:
        Logger.warn('wallet', 'PGP does not support ', masterWallet.type);
        return null;
    }
  }

  public async createERC20SubWallet(
      networkWallet: AnyNetworkWallet,
      coinID: CoinID,
      startBackgroundUpdates = true
  ): Promise<ERC20SubWallet> {
    let subWallet = new PGPERC20SubWallet(networkWallet, coinID);
    await subWallet.initialize();
    if (startBackgroundUpdates) void subWallet.startBackgroundUpdates();
    return subWallet;
  }

  public getEVMSPVConfigName(): string {
    return StandardCoinName.ETHECOPGP;
  }

  public supportsERC20Coins() {
    return true;
  }

  public supportsERCNFTs() {
    return true;
  }

  public getDefaultWalletNetworkOptions(): WalletNetworkOptions {
    return {
      network: this.key
    }
  }

  public supportedPrivateKeyTypes(): PrivateKeyType[] {
    // None by default. If this method is not overriden by the network,
    // the network can't handle any import by private key
    return [
      PrivateKeyType.EVM
    ];
  }

  public getMainTokenSymbol(): string {
    return 'PGA';
  }

  public getMainColor(): string {
    return '535353';
  }

  public getELATokenContract() {
    return "0x0000000000000000000000000000000000000065";
  }
}

/**
 * Elastos ECO Chain
 */
export class ElastosPGPMainNetNetwork extends ElastosPGPNetworkBase {
  constructor() {
    super(
      ElastosPGPNetworkBase.NETWORK_KEY,
      "PGP Chain",
      "PGP",
      "assets/wallet/networks/pgp.png",
      MAINNET_TEMPLATE,
      12343,
      [
        {
          name: 'Official Elastos Node',
          url: 'https://api.elastos.io/eco'
        }
      ]
    );

    this.builtInCoins = [
      new ERC20Coin(this, "ELA", "ELA", "0x0000000000000000000000000000000000000065", 8, false, true),
      // new ERC20Coin(this, 'USDT', 'PGA-USDT', '0x1C4E7cd89ea67339d4A5ed2780703180a19757d7', 18, false, true),
      // new ERC20Coin(this, 'BTCD', 'BTC Dollar', '0x45ec25a63e010BFb84629242f40DDa187f83833E', 18, false, true),
      // new ERC20Coin(this, 'FIST', 'FIST on ECO', '0x67d8183f13043Be52F64FB434F1AA5e5d1C58775', 18, false, true),
      // new ERC20Coin(this, 'PGA', 'PanGu Asset', '0x8152557DD7d8dBFa2E85EaE473f8B897a5b6CCA9', 18, false, true)
    ];

    this.customCurrencyProviders.push(new ElastosECOPGPOracleCustomCurrencyProvider(this));
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC)
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForRpc(StandardCoinName.ETHECOPGP),
        MAINNET_TEMPLATE);
    else if (type === NetworkAPIURLType.ETHERSCAN) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBrowser(StandardCoinName.ETHECOPGP),
        MAINNET_TEMPLATE);
    } else if (type === NetworkAPIURLType.BLOCK_EXPLORER) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBlockExplorer(StandardCoinName.ETHECOPGP),
        MAINNET_TEMPLATE);
    } else
      return null;
  }

  public updateSPVNetworkConfig(onGoingConfig: ConfigInfo) {
    onGoingConfig['ETHECOPGP'] = { chainID: '12343', NetworkID: '12343' };
  }

  // When the user manually sets the gas price, it cannot be less than this value.
  // The unit is gwei.
  public getMinGasprice(): number {
    return 1;
  }
}

export class ElastosPGPTestNetNetwork extends ElastosPGPNetworkBase {
  constructor() {
    super(
      ElastosPGPNetworkBase.NETWORK_KEY,
      "PGP Testnet",
      "PGP Testnet",
      "assets/wallet/networks/pgp.png",
      TESTNET_TEMPLATE,
      12345,
      [
        {
          name: 'Elastos ECO Chain Testnet RPC',
          url: GlobalElastosAPIService.instance.getApiUrl(
            GlobalElastosAPIService.instance.getApiUrlTypeForRpc(StandardCoinName.ETHECOPGP),
            TESTNET_TEMPLATE
          )
        }
      ]
    );

    this.builtInCoins = [
      new ERC20Coin(this, "ELA", "ELA", "0x0000000000000000000000000000000000000065", 8, false, true),
    ];
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC)
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForRpc(StandardCoinName.ETHECOPGP),
        TESTNET_TEMPLATE);
    else if (type === NetworkAPIURLType.ETHERSCAN) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBrowser(StandardCoinName.ETHECOPGP),
        TESTNET_TEMPLATE);
    } else if (type === NetworkAPIURLType.BLOCK_EXPLORER) {
      return GlobalElastosAPIService.instance.getApiUrl(
        GlobalElastosAPIService.instance.getApiUrlTypeForBlockExplorer(StandardCoinName.ETHECOPGP),
        TESTNET_TEMPLATE);
    } else
      return null;
  }

  public updateSPVNetworkConfig(onGoingConfig: ConfigInfo) {
    onGoingConfig['ETHECOPGP'] = { chainID: '12345', NetworkID: '12345' };
  }

  // When the user manually sets the gas price, it cannot be less than this value.
  // The unit is gwei.
  public getMinGasprice(): number {
    return 1;
  }
}
