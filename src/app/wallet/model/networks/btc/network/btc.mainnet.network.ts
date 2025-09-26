import { MAINNET_TEMPLATE } from 'src/app/services/global.networks.service';
import { ERC20Coin } from '../../../coin';
import { NetworkAPIURLType } from '../../base/networkapiurltype';
import { UniswapCurrencyProvider } from '../../evms/uniswap.currencyprovider';
import { BTCAPI, BTCApiType } from './btc.api';
import { BTCNetworkBase } from './btc.base.network';

export class BTCMainNetNetwork extends BTCNetworkBase {
  constructor() {
    super(
      'BTC',
      MAINNET_TEMPLATE,
      [
        {
          name: 'BTC RPC',
          url: 'https://btc.nownodes.io'
        },
        {
          name: 'PublicNode',
          url: 'https://bitcoin-rpc.publicnode.com'
        },
        {
          name: 'BlastAPI',
          url: 'https://bitcoin-mainnet.public.blastapi.io'
        }
      ],
      [],
      [],
      []
    );
  }

  public getAPIUrlOfType(type: NetworkAPIURLType): string {
    if (type === NetworkAPIURLType.RPC) return BTCAPI.getApiUrl(BTCApiType.NODE, MAINNET_TEMPLATE);
    else if (type === NetworkAPIURLType.BLOCK_EXPLORER)
      return BTCAPI.getApiUrl(BTCApiType.BLOCK_EXPLORER, MAINNET_TEMPLATE);
    else if (type === NetworkAPIURLType.NOWNODE_EXPLORER)
      return BTCAPI.getApiUrl(BTCApiType.EXPLORER, MAINNET_TEMPLATE);
    else throw new Error(`BTCNetwork: getAPIUrlOfType() has no entry for url type ${type.toString()}`);
  }

  public getUniswapCurrencyProvider(): UniswapCurrencyProvider {
    return null;
  }

  public getBuiltInERC20Coins(): ERC20Coin[] {
    return [];
  }
}
