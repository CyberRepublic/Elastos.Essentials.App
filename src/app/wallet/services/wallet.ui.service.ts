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

import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Logger } from 'src/app/logger';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { LedgerSignComponent, LedgerSignComponentOptions } from '../components/ledger-sign/ledger-sign.component';
import {
  WalletChooserComponent,
  WalletChooserComponentOptions,
  WalletChooserFilter
} from '../components/wallet-chooser/wallet-chooser.component';
import { MasterWallet } from '../model/masterwallets/masterwallet';
import { Safe } from '../model/safes/safe';
import { WalletService } from './wallet.service';

export type PriorityNetworkChangeCallback = (newNetwork) => Promise<void>;

@Injectable({
  providedIn: 'root'
})
export class WalletUIService {
  public static instance: WalletUIService = null;

  constructor(
    private modalCtrl: ModalController,
    private walletService: WalletService,
    private theme: GlobalThemeService
  ) {
    WalletUIService.instance = this;
  }

  /**
   * Lets user pick a wallet in the list of all available wallets.
   * Promise resolves after the wallet is chosen, or on cancellation
   */
  async chooseActiveWallet(filter?: WalletChooserFilter): Promise<boolean> {
    let options: WalletChooserComponentOptions = {
      currentNetworkWallet: this.walletService.activeNetworkWallet.value,
      filter,
      showActiveWallet: true
    };

    let modal = await this.modalCtrl.create({
      component: WalletChooserComponent,
      componentProps: options
    });

    return new Promise(resolve => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, require-await
      modal.onWillDismiss().then(async params => {
        Logger.log('wallet', 'New wallet selected:', params);
        if (params.data && params.data.selectedMasterWalletId) {
          let wallet = this.walletService.getNetworkWalletFromMasterWalletId(params.data.selectedMasterWalletId);

          let masterWallet: MasterWallet;
          if (!wallet) masterWallet = this.walletService.getMasterWallet(params.data.selectedMasterWalletId);

          void this.walletService.setActiveNetworkWallet(wallet, masterWallet);
          resolve(true);
        } else resolve(false);
      });
      void modal.present();
    });
  }

  /**
   * Lets the user choose a wallet from the list but without further action.
   * The selected wallet does not become the active wallet.
   *
   * @param filter Optional filter for wallets
   * @param showCurrentWallet Whether to highlight the current wallet
   * @param masterWalletMode If true, pick master wallets directly instead of network wallets
   * @param showBalances If true, display wallet balances (only applies when masterWalletMode is false)
   */
  async pickWallet(
    filter?: WalletChooserFilter,
    showCurrentWallet = false,
    masterWalletMode = false,
    showBalances?: boolean
  ): Promise<MasterWallet> {
    let options: WalletChooserComponentOptions = {
      currentNetworkWallet: showCurrentWallet ? this.walletService.activeNetworkWallet.value : null,
      filter,
      showActiveWallet: false,
      masterWalletMode,
      showBalances
    };

    let modal = await this.modalCtrl.create({
      component: WalletChooserComponent,
      componentProps: options
    });

    return new Promise(resolve => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, require-await
      modal.onWillDismiss().then(async params => {
        Logger.log('wallet', 'Wallet selected:', params);
        if (params.data && params.data.selectedMasterWalletId) {
          return this.walletService.getMasterWallet(params.data.selectedMasterWalletId);
        } else {
          resolve(null);
        }
      });
      void modal.present();
    });
  }

  /**
   * @dependson Import LedgerSignComponentModule
   */
  async connectLedgerAndSignTransaction(deviceId: string, safe: Safe): Promise<boolean> {
    let options: LedgerSignComponentOptions = {
      deviceId: deviceId,
      safe: safe
    };

    let modal = await this.modalCtrl.create({
      component: LedgerSignComponent,
      componentProps: options,
      backdropDismiss: false
    });

    return new Promise(resolve => {
      void modal.onWillDismiss().then(params => {
        if (params.data) {
          resolve(params.data);
        } else resolve(null);
      });
      void modal.present();
    });
  }
}
