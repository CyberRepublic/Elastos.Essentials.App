/*
 * Copyright (c) 2021 Elastos Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import BigNumber from 'bignumber.js';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import {
  BuiltInIcon,
  TitleBarIcon,
  TitleBarIconSlot,
  TitleBarMenuItem
} from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { Config } from 'src/app/wallet/config/Config';
import { WalletType } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { IdentityTransactionBuilder } from 'src/app/wallet/model/networks/elastos/evms/eid/tx-builders/identity.txbuilder';
import { ElastosEVMSubWallet } from 'src/app/wallet/model/networks/elastos/evms/subwallets/standard/elastos.evm.subwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { CoinTransferService, IntentTransfer, Transfer } from '../../../services/cointransfer.service';
import { Native } from '../../../services/native.service';
import { WalletService } from '../../../services/wallet.service';

@Component({
  selector: 'app-didtransaction',
  templateUrl: './didtransaction.page.html',
  styleUrls: ['./didtransaction.page.scss']
})
export class DidTransactionPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  public networkWallet: AnyNetworkWallet;
  private sourceSubwallet: ElastosEVMSubWallet;
  private identityTxBuilder: IdentityTransactionBuilder;
  private intentTransfer: IntentTransfer;
  private subWalletId: string; // IDChain

  private alreadySentIntentResponse = false;

  public gasPrice = '';
  public gasPriceGwei = '';
  public gasLimit = '';
  public fee: BigNumber = null; // WEI
  public feeDisplay = ''; // ELA

  public showEditGasPrice = false;

  public currentNetworkName = '';

  // Titlebar
  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  constructor(
    public walletManager: WalletService,
    public globalPopupService: GlobalPopupService,
    private coinTransferService: CoinTransferService,
    private globalIntentService: GlobalIntentService,
    public native: Native,
    public zone: NgZone,
    private translate: TranslateService,
    public theme: GlobalThemeService
  ) {
    void this.init();
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.didtransaction-title'));
    this.titleBar.setNavigationMode(null);
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_LEFT, {
      key: 'close',
      iconPath: BuiltInIcon.CLOSE
    });
    this.titleBar.addOnItemClickedListener(
      (this.titleBarIconClickedListener = icon => {
        if (icon.key === 'close') {
          void this.cancelOperation();
        }
      })
    );
  }

  ionViewDidEnter() {
    switch (this.networkWallet && this.networkWallet.masterWallet.type) {
      case WalletType.MULTI_SIG_EVM_GNOSIS:
      case WalletType.MULTI_SIG_STANDARD:
        // TODO: reject esctransaction if multi sign (show error popup)
        void this.cancelOperation();
        break;
      default:
        break;
    }
  }

  ngOnDestroy() {
    if (!this.alreadySentIntentResponse) {
      void this.cancelOperation(false);
    }
  }

  init() {
    this.subWalletId = this.coinTransferService.subWalletId;
    this.intentTransfer = this.coinTransferService.intentTransfer;
    this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(this.coinTransferService.masterWalletId);
    if (this.networkWallet) {
      this.sourceSubwallet = this.networkWallet.getSubWallet(this.subWalletId) as ElastosEVMSubWallet;
      this.identityTxBuilder = new IdentityTransactionBuilder(this.sourceSubwallet.networkWallet);

      void this.estimateGas();
    } else {
      this.currentNetworkName = WalletNetworkService.instance.activeNetwork.value.name;
    }
  }

  /**
   * Cancel the vote operation. Closes the screen and goes back to the calling application after
   * sending the intent response.
   */
  async cancelOperation(navigateBack = true) {
    await this.sendIntentResponse({ txid: null, status: 'cancelled' }, this.intentTransfer.intentId, navigateBack);
  }

  private async sendIntentResponse(result, intentId, navigateBack = true) {
    this.alreadySentIntentResponse = true;
    await this.globalIntentService.sendIntentResponse(result, intentId, navigateBack);
  }

  public editGasPrice() {
    this.showEditGasPrice = !this.showEditGasPrice;
  }

  async estimateGas() {
    this.gasPrice = await this.identityTxBuilder.getGasPrice();
    this.gasLimit = await this.identityTxBuilder.estimateGas(JSON.stringify(this.coinTransferService.didrequest));
    await this.updateGasInfo();
  }

  public async updateGasprice(event) {
    if (!this.gasPriceGwei) return;

    this.gasPrice = new BigNumber(this.gasPriceGwei).multipliedBy(Config.GWEI).toString();
    await this.updateGasInfo();
  }

  public async updateGasLimit(event) {
    if (!this.gasLimit) return;

    await this.updateGasInfo();
  }

  private updateGasInfo() {
    this.gasPriceGwei = new BigNumber(this.gasPrice).dividedBy(Config.GWEI).toFixed(1);

    this.fee = new BigNumber(this.gasLimit)
      .multipliedBy(new BigNumber(this.gasPrice))
      .dividedBy(this.sourceSubwallet.tokenAmountMulipleTimes);
    let nativeFee =
      WalletUtil.getAmountWithoutScientificNotation(this.fee, 8) +
      ' ' +
      WalletNetworkService.instance.activeNetwork.value.getMainTokenSymbol();
    let currencyFee =
      this.sourceSubwallet.getAmountInExternalCurrency(this.fee).toString() +
      ' ' +
      CurrencyService.instance.selectedCurrency.symbol;
    this.feeDisplay = `${nativeFee} (~ ${currencyFee})`;
  }

  goTransaction() {
    if (this.networkWallet && this.feeDisplay) void this.checkValue();
  }

  async checkValue() {
    const isAvailableBalanceEnough = await this.sourceSubwallet.isAvailableBalanceEnough(this.fee);
    if (!isAvailableBalanceEnough) {
      await this.globalPopupService.ionicAlert('common.warning', 'wallet.text-did-balance-not-enough');
      void this.cancelOperation();
      return;
    }
    void this.createIDTransaction();
  }

  async createIDTransaction() {
    Logger.log('wallet', 'Calling createIdTransaction()');
    await this.native.showLoading(this.translate.instant('common.please-wait'));

    try {
      const rawTx = await this.identityTxBuilder.createIDTransaction(
        JSON.stringify(this.coinTransferService.didrequest),
        this.gasPrice,
        this.gasLimit
      );
      await this.native.hideLoading();
      if (rawTx) {
        Logger.log('wallet', 'Created raw DID transaction');
        const transfer = new Transfer();
        Object.assign(transfer, {
          masterWalletId: this.networkWallet.id,
          subWalletId: this.subWalletId,
          //rawTransaction: rawTx,
          payPassword: '',
          action: this.intentTransfer.action,
          intentId: this.intentTransfer.intentId
        });

        const result = await this.sourceSubwallet.signAndSendRawTransaction(rawTx, transfer);
        if (result.published === false) {
          if (result.message && result.message.includes('oversized data')) {
            // DID payload over size
            await this.globalPopupService.ionicAlert('wallet.transaction-fail', 'wallet.did-oversize');
          }
        }

        await this.sendIntentResponse(result, transfer.intentId);
      } else {
        await this.sendIntentResponse({ txid: null, status: 'error' }, this.intentTransfer.intentId);
      }
    } catch (e) {
      await this.native.hideLoading();
      await this.globalPopupService.ionicAlert('wallet.transaction-fail', 'Unknown error, possibly a network issue');
      await this.sendIntentResponse({ txid: null, status: 'error' }, this.intentTransfer.intentId);
    }
  }
}
