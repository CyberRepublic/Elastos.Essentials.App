import { StandardCoinName } from "../../coin";
import { MasterWallet } from "../masterwallet";
import { NetworkWallet } from "../NetworkWallet";
import { MainchainSubWallet } from "./mainchain.subwallet";
import { ElastosEVMSubWallet } from "./elastos.evm.subwallet";
import { Network } from "../../networks/network";
import { IDChainSubWallet } from "./idchain.subwallet";
import { GlobalElastosAPIService } from "src/app/services/global.elastosapi.service";

export class ElastosNetworkWallet extends NetworkWallet {
  constructor(masterWallet: MasterWallet, network: Network) {
    super(masterWallet, network);
  }

  protected async prepareStandardSubWallets(): Promise<void> {
    this.subWallets[StandardCoinName.ELA] = new MainchainSubWallet(this.masterWallet);
    this.subWallets[StandardCoinName.ETHSC] = new ElastosEVMSubWallet(this, StandardCoinName.ETHSC);
    this.subWallets[StandardCoinName.IDChain] = new IDChainSubWallet(this);
    this.subWallets[StandardCoinName.ETHDID] = new ElastosEVMSubWallet(this, StandardCoinName.ETHDID);

    await this.masterWallet.walletManager.spvBridge.createSubWallet(this.masterWallet.id, StandardCoinName.ELA);
    await this.masterWallet.walletManager.spvBridge.createSubWallet(this.masterWallet.id, StandardCoinName.IDChain);
    await this.masterWallet.walletManager.spvBridge.createSubWallet(this.masterWallet.id, StandardCoinName.ETHSC);
    await this.masterWallet.walletManager.spvBridge.createSubWallet(this.masterWallet.id, StandardCoinName.ETHDID);
  }

  /**
   * Tells whether this wallet currently has many addresses in use or not.
   */
  public async multipleAddressesInUse(): Promise<boolean> {
    let mainchainSubwallet : MainchainSubWallet = this.subWallets[StandardCoinName.ELA] as MainchainSubWallet;
    let txListsInternal = await mainchainSubwallet.getTransactionByAddress(true, 0);
    if (txListsInternal.length > 1) {
      return true;
    }
    let txListsExternal = await mainchainSubwallet.getTransactionByAddress(false, 0);
    if (txListsExternal.length > 1) {
      return true;
    }

    return false;
  }
}