import { Component, Input, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { Logger } from 'src/app/logger';
import { AccountAbstractionNetworkWallet } from 'src/app/wallet/model/networks/evms/networkwallets/account-abstraction.networkwallet';
import { UiService } from '../../../../services/ui.service';
import { EscTransactionPage } from '../esctransaction.page';

@Component({
  selector: 'app-account-abstraction',
  templateUrl: './account-abstraction.component.html',
  styleUrls: ['./account-abstraction.component.scss']
})
export class AccountAbstractionComponent implements OnInit {
  @Input() balance: BigNumber;
  @Input() uiService: UiService;
  @Input() parentPage: EscTransactionPage;

  // Transaction cost calculation (simplified for AA)
  public totalTransactionCost: any;
  public signingAndTransacting = false;

  constructor() {}

  ngOnInit() {
    this.calculateTransactionCost();
  }

  private calculateTransactionCost() {
    const coinTransferService = this.parentPage.getCoinTransferService();
    const evmSubWallet = this.parentPage.getEvmSubWallet();

    let weiToDisplayCurrencyRatio = new BigNumber('1000000000000000000');

    // For AA, we only consider the value, fees are covered by paymaster
    let currencyValue = new BigNumber(coinTransferService.payloadParam.value || 0).dividedBy(weiToDisplayCurrencyRatio);

    this.totalTransactionCost = {
      totalAsBigNumber: currencyValue,
      total: currencyValue?.toFixed(),
      valueAsBigNumber: currencyValue,
      value: currencyValue?.toFixed(),
      feesAsBigNumber: new BigNumber(0),
      fees: '0',
      currencyFee: '0'
    };
  }

  public balanceIsEnough(): boolean {
    return this.totalTransactionCost.totalAsBigNumber.lte(this.balance);
  }

  // ELA, HT, etc
  public getCurrencyInUse(): string {
    return this.parentPage.getEvmSubWallet().getDisplayTokenName();
  }

  // CNY, USD, etc
  public getNativeCurrencyInUse(): string {
    return 'USD'; // Placeholder for AA
  }

  public goTransaction(): void {
    void this.sendAccountAbstractionTransaction();
  }

  /**
   * Stubbed method for Account Abstraction transactions
   * This replaces createEscTransaction for AA wallets
   */
  async sendAccountAbstractionTransaction() {
    Logger.log(
      'wallet',
      'Calling sendAccountAbstractionTransaction(): ',
      this.parentPage.getCoinTransferService().payloadParam
    );

    this.signingAndTransacting = true;
    const intentTransfer = this.parentPage.getIntentTransfer();

    try {
      const networkWallet = this.parentPage.getNetworkWallet() as AccountAbstractionNetworkWallet;
      await networkWallet.signAndSendRawTx({
        to: this.parentPage.getCoinTransferService().payloadParam.to,
        value: this.parentPage.getCoinTransferService().payloadParam.value || '0',
        data: this.parentPage.getCoinTransferService().payloadParam.data
      });

      // Simulate success for now
      await this.parentPage.sendIntentResponse(
        {
          txid: 'aa_transaction_' + Date.now(),
          status: 'published'
        },
        intentTransfer.intentId
      );
    } catch (err) {
      Logger.error('wallet', 'AccountAbstractionComponent sendAccountAbstractionTransaction error:', err);
      if (intentTransfer.intentId) {
        await this.parentPage.sendIntentResponse({ txid: null, status: 'error' }, intentTransfer.intentId);
      }
    }

    this.signingAndTransacting = false;
  }

  async cancelOperation() {
    await this.parentPage.cancelOperation();
  }
}
