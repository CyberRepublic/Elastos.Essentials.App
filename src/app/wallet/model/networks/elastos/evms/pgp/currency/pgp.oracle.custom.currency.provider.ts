import { BigNumber } from 'bignumber.js';
import { Logger } from 'src/app/logger';
import { EVMService } from 'src/app/wallet/services/evm/evm.service';
import type Web3 from 'web3';
import { ERC20Coin } from '../../../../../coin';
import { CustomCurrencyProvider } from '../../../../evms/custom.currencyprovider';
import { EVMNetwork } from '../../../../evms/evm.network';
import { AnyNetwork } from '../../../../network';
import { ElastosPGPNetworkBase } from '../network/pgp.networks';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';

export class ElastosECOPGPOracleCustomCurrencyProvider implements CustomCurrencyProvider {
  private priceOracelContract = '0xFDABE9B3375A0B169d0967a18197c45Bda3820D7';

  constructor(private network: AnyNetwork) {}

  protected getWeb3(): Promise<Web3> {
    return EVMService.instance.getWeb3(this.network as EVMNetwork);
  }

  public async getTokenPrice(coin: ERC20Coin): Promise<number> {
    // TODO: This is a temporary solution to get the price of the ela token on the pgp sidechain.
    let elaTokenAddress = (this.network as ElastosPGPNetworkBase).getELATokenContract();
    if (coin.getContractAddress() === elaTokenAddress) {
      let elaNetwork = WalletNetworkService.instance.getNetworkByKey('elastos')
      return CurrencyService.instance.getMainTokenValue(new BigNumber(1), elaNetwork, 'USD').toNumber();
    }

    const ecoPriceOracleAbi = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'token',
            type: 'address'
          }
        ],
        name: 'getprice',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256'
          }
        ],
        stateMutability: 'view',
        type: 'function'
      }
    ];
    const priceContract = new (await this.getWeb3()).eth.Contract(ecoPriceOracleAbi as any, this.priceOracelContract);
    try {
      let value = await priceContract.methods.getprice(coin.getContractAddress()).call();
      let price = 0;
      if (value) {
        let tokenAmountMulipleTimes = new BigNumber(10).pow(18);
        price = new BigNumber(value).dividedBy(tokenAmountMulipleTimes).toNumber();
      }
      return price;
    } catch (e) {
      Logger.warn('wallet', 'ElastosECOPGPOracleCustomCurrencyProvider getTokenPrice exception', e);
      return null;
    }
  }
}
