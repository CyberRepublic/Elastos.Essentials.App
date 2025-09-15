import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { EVMNetwork } from 'src/app/wallet/model/networks/evms/evm.network';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { Config } from '../../../../config/Config';
import { CoinType, StandardCoinName } from '../../../../model/coin';
import { AnySubWallet } from '../../../../model/networks/base/subwallets/subwallet';
import { CoinTransferService } from '../../../../services/cointransfer.service';
import { CurrencyService } from '../../../../services/currency.service';
import { Native } from '../../../../services/native.service';
import { UiService } from '../../../../services/ui.service';
import { WalletService } from '../../../../services/wallet.service';

// The multi-sign wallet doesn't support sidechain, we directly return the specified information.
// User need to select the destination Network.
export type NetworkInfo = {
  id: string;
  chainId: number;
  friendName: string;
  logo: string;
  tokenSymbol: string;
};

@Component({
  selector: 'app-coin-select',
  templateUrl: './coin-select.page.html',
  styleUrls: ['./coin-select.page.scss']
})
export class CoinSelectPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  public networkWallet: AnyNetworkWallet;
  // Available subwallets to transfer to
  public subWallets: AnySubWallet[] = [];
  // Available networks for multi-sin wallet cross transfer.
  public destNetworks: NetworkInfo[] = [];

  // Helpers
  private SELA = Config.SELA;
  public CoinType = CoinType;

  constructor(
    public route: ActivatedRoute,
    public native: Native,
    private walletManager: WalletService,
    private coinTransferService: CoinTransferService,
    public theme: GlobalThemeService,
    private translate: TranslateService,
    public currencyService: CurrencyService,
    public uiService: UiService
  ) {
    void this.init();
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.coin-select-title'));
  }

  async init() {
    this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(this.coinTransferService.masterWalletId);

    // Filter out the subwallet being transferred from
    if (this.coinTransferService.subWalletId !== 'ELA') {
      // TODO: remove it, subWalletId should alway be ELA.
      this.subWallets = [this.networkWallet.getSubWallet('ELA')];
    } else {
      this.subWallets = await this.getELASideChainSubwallets();
      if (this.subWallets.length === 0) {
        this.initELASideChainNetworks();
      }
    }
  }

  onItem(wallet: AnySubWallet) {
    // Define subwallets to transfer to and from
    this.coinTransferService.toSubWalletId = wallet.id;

    this.native.go('/wallet/coin-transfer');
  }

  onSelect(item: NetworkInfo) {
    // Define destination network to transfer to and from
    this.coinTransferService.toSubWalletId = item.id;
    this.coinTransferService.networkInfo = item;

    this.native.go('/wallet/coin-transfer');
  }

  // for cross chain transaction.
  async getELASideChainSubwallets() {
    let subwallets: AnySubWallet[] = [];

    let idChain = WalletNetworkService.instance.getNetworkByKey('elastosidchain');
    let idNetworkWallet = await idChain.createNetworkWallet(this.networkWallet.masterWallet, false);
    if (idNetworkWallet) {
      let idsubwallet = idNetworkWallet.getSubWallet(StandardCoinName.ETHDID);
      subwallets.push(idsubwallet);
    }

    let escChain = WalletNetworkService.instance.getNetworkByKey('elastossmartchain');
    let escNetworkWallet = await escChain.createNetworkWallet(this.networkWallet.masterWallet, false);
    if (escNetworkWallet) {
      let escsubwallet = escNetworkWallet.getSubWallet(StandardCoinName.ETHSC);
      subwallets.push(escsubwallet);
    }

    let ecoChain = WalletNetworkService.instance.getNetworkByKey('elastoseco');
    let ecoNetworkWallet = await ecoChain.createNetworkWallet(this.networkWallet.masterWallet, false);
    if (ecoNetworkWallet) {
      let ecosubwallet = ecoNetworkWallet.getSubWallet(StandardCoinName.ETHECO);
      subwallets.push(ecosubwallet);
    }
    return subwallets;
  }

  // For multi-sign wallet cross chain transaction.
  initELASideChainNetworks() {
    let idChain = WalletNetworkService.instance.getNetworkByKey('elastosidchain');
    this.destNetworks.push({
      id: StandardCoinName.ETHDID,
      chainId: (<EVMNetwork>idChain).getMainChainID(),
      friendName: 'Identity Chain',
      logo: idChain.logo,
      tokenSymbol: idChain.getMainTokenSymbol()
    });
    let escChain = WalletNetworkService.instance.getNetworkByKey('elastossmartchain');
    this.destNetworks.push({
      id: StandardCoinName.ETHSC,
      chainId: (<EVMNetwork>escChain).getMainChainID(),
      friendName: 'Smart Chain',
      logo: escChain.logo,
      tokenSymbol: escChain.getMainTokenSymbol()
    });
    let ecoChain = WalletNetworkService.instance.getNetworkByKey('elastoseco');
    this.destNetworks.push({
      id: StandardCoinName.ETHECO,
      chainId: (<EVMNetwork>ecoChain).getMainChainID(),
      friendName: 'ECO SideChain',
      logo: ecoChain.logo,
      tokenSymbol: ecoChain.getMainTokenSymbol()
    });
  }
}
