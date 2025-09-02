import { GlobalElastosAPIService } from 'src/app/services/global.elastosapi.service';
import { CoinID, StandardCoinName } from '../../../../../coin';
import { AnyNetworkWallet } from '../../../../base/networkwallets/networkwallet';
import { ERC20SubWallet } from '../../../../evms/subwallets/erc20.subwallet';

/**
 * Subwallet for Elastos-ERC20 tokens.
 */
export class ElastosEscERC20SubWallet extends ERC20SubWallet {
  constructor(networkWallet: AnyNetworkWallet, coinID: CoinID) {
    let rpcApiUrl = GlobalElastosAPIService.instance.getApiUrlForChainCode(StandardCoinName.ETHSC);
    super(networkWallet, coinID, rpcApiUrl, 'Elastos-ERC20 token');

    this.spvConfigEVMCode = StandardCoinName.ETHSC;
  }

  public getMainIcon(): string {
    return 'assets/wallet/networks/elastos-esc.png';
  }

  public getSecondaryIcon(): string {
    return null;
    //return "assets/wallet/coins/eth-purple.svg";
  }

  public getDisplayableERC20TokenInfo(): string {
    return ''; // GlobalLanguageService.instance.translate('wallet.ela-erc20'); // "Elastos ERC20 token" is confusing.
  }

  public supportInternalTransactions() {
    return false;
  }
}
