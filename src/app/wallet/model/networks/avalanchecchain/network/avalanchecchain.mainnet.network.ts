import { MAINNET_TEMPLATE } from 'src/app/services/global.networks.service';
import { UniswapCurrencyProvider } from '../../evms/uniswap.currencyprovider';
import { AvalancheMainnetUniswapCurrencyProvider } from '../currency/avalanche.uniswap.currency.provider';
import { avalancheMainnetElkBridgeProvider } from '../earn/bridge.providers';
import { avalancheMainnetElkEarnProvider } from '../earn/earn.providers';
import { avalancheMainnetElkSwapProvider } from '../earn/swap.providers';
import { AvalancheCChainBaseNetwork } from './avalanchecchain.base.network';

export class AvalancheCChainMainNetNetwork extends AvalancheCChainBaseNetwork {
  private uniswapCurrencyProvider: AvalancheMainnetUniswapCurrencyProvider = null;

  constructor() {
    super(
      'avalanchecchain',
      'Avalanche C-Chain',
      'Avalanche C',
      'assets/wallet/networks/avalance.png',
      'AVAX',
      'Avalanche Token',
      MAINNET_TEMPLATE,
      43114,
      [],
      [
        {
          name: 'Avalanchecchain Mainnet RPC',
          url: 'https://api.avax.network/ext/bc/C/rpc'
        }
      ],
      [avalancheMainnetElkEarnProvider],
      [avalancheMainnetElkSwapProvider],
      [avalancheMainnetElkBridgeProvider]
    );

    this.uniswapCurrencyProvider = new AvalancheMainnetUniswapCurrencyProvider(this);
    this.averageBlocktime = 5; // 2;
  }

  public getUniswapCurrencyProvider(): UniswapCurrencyProvider {
    return this.uniswapCurrencyProvider;
  }
}
