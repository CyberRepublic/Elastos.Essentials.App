import { Component, Input, OnInit } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { Logger } from 'src/app/logger';
import { Transfer } from '../../../../services/cointransfer.service';
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
    void this.checkValue();
  }

  private async checkValue(): Promise<void> {
    // Nothing to check for AA transactions
    await this.createEscTransaction();
  }

  async createEscTransaction() {
    Logger.log('wallet', 'Calling createEscTransaction(): ', this.parentPage.getCoinTransferService().payloadParam);

    this.signingAndTransacting = true;
    const evmSubWallet = this.parentPage.getEvmSubWallet();
    const networkWallet = this.parentPage.getNetworkWallet();
    const coinTransferService = this.parentPage.getCoinTransferService();
    const intentTransfer = this.parentPage.getIntentTransfer();

    // For AA, we don't need gas parameters since fees are covered by paymaster
    const gasPrice = '0'; // Not used in AA
    const gasLimit = '0'; // Not used in AA
    const nonce = await evmSubWallet.getNonce();

    const rawTx = await (evmSubWallet.networkWallet.safe as any).createContractTransaction(
      coinTransferService.payloadParam.to || '',
      coinTransferService.payloadParam.value || '0',
      gasPrice,
      gasLimit,
      nonce,
      coinTransferService.payloadParam.data
    );

    Logger.log('wallet', 'Created AA raw transaction:', rawTx);

    if (rawTx) {
      const transfer = new Transfer();
      Object.assign(transfer, {
        masterWalletId: networkWallet.id,
        subWalletId: evmSubWallet.id,
        payPassword: '',
        action: intentTransfer.action,
        intentId: intentTransfer.intentId
      });

      try {
        const result = await evmSubWallet.signAndSendRawTransaction(rawTx, transfer, false);
        Logger.log('wallet', 'AA transaction result:', result);

        if (result && result.published && result.txid) {
          await this.parentPage.sendIntentResponse(
            {
              txid: result.txid,
              status: 'published'
            },
            intentTransfer.intentId
          );
        } else {
          await this.parentPage.sendIntentResponse({ txid: null, status: 'error' }, intentTransfer.intentId);
        }
      } catch (err) {
        Logger.error('wallet', 'AccountAbstractionComponent createEscTransaction error:', err);
        if (intentTransfer.intentId) {
          await this.parentPage.sendIntentResponse({ txid: null, status: 'error' }, intentTransfer.intentId);
        }
      }
    } else {
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
