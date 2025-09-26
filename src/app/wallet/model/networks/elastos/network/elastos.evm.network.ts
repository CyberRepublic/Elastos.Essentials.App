import type { ConfigInfo } from '@elastosfoundation/wallet-js-sdk';
import { CoinID } from '../../../coin';
import { BridgeProvider } from '../../../earn/bridgeprovider';
import { EarnProvider } from '../../../earn/earnprovider';
import { SwapProvider } from '../../../earn/swapprovider';
import { WalletNetworkOptions } from '../../../masterwallets/wallet.types';
import { RPCUrlProvider } from '../../../rpc-url-provider';
import { AnyNetworkWallet } from '../../base/networkwallets/networkwallet';
import { EVMNetwork } from '../../evms/evm.network';
import { ERC1155Provider } from '../../evms/nfts/erc1155.provider';
import { ERC721Provider } from '../../evms/nfts/erc721.provider';
import { ERC20SubWallet } from '../../evms/subwallets/erc20.subwallet';
import { ElastosEscERC20SubWallet } from '../evms/esc/subwallets/elastos.esc.erc20.subwallet';

export abstract class ElastosEVMNetwork<WalletNetworkOptionsType extends WalletNetworkOptions> extends EVMNetwork {
  constructor(
    key: string,
    displayName: string,
    shortDisplayName: string,
    logo: string,
    networkTemplate: string,
    chainID: number,
    rpcUrlProviders?: RPCUrlProvider[],
    earnProviders?: EarnProvider[],
    swapProviders?: SwapProvider[],
    bridgeProviders?: BridgeProvider[],
    erc1155Providers?: ERC1155Provider[],
    erc721Providers?: ERC721Provider[]
  ) {
    super(
      key,
      displayName,
      shortDisplayName,
      logo,
      'ELA',
      'ELA',
      networkTemplate,
      chainID,
      [], // builtInCoins
      rpcUrlProviders,
      earnProviders,
      swapProviders,
      bridgeProviders,
      erc1155Providers,
      erc721Providers
    );
  }

  public async createERC20SubWallet(
    networkWallet: AnyNetworkWallet,
    coinID: CoinID,
    startBackgroundUpdates = true
  ): Promise<ERC20SubWallet> {
    let subWallet = new ElastosEscERC20SubWallet(networkWallet, coinID);
    await subWallet.initialize();
    if (startBackgroundUpdates) void subWallet.startBackgroundUpdates();
    return subWallet;
  }

  // TODO: MOVE TO ESC
  /* public getMainEvmRpcApiUrl(): string {
    return GlobalElastosAPIService.instance.getApiUrl(GlobalElastosAPIService.instance.getApiUrlTypeForRpc(StandardCoinName.ETHSC));
  }

  // TODO: MOVE TO ESC
  public getMainEvmAccountApiUrl(): string {
    return GlobalElastosAPIService.instance.getApiUrl(GlobalElastosAPIService.instance.getApiUrlTypeForBrowser(StandardCoinName.ETHSC));
  } */

  public getMainTokenSymbol(): string {
    return this.mainTokenSymbol;
  }

  //public abstract getMainChainID(): number;

  public abstract updateSPVNetworkConfig(onGoingConfig: ConfigInfo);
}
