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
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ecsign, stripHexPrefix, toRpcSig } from 'ethereumjs-util';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import {
  BuiltInIcon,
  TitleBarIcon,
  TitleBarIconSlot,
  TitleBarMenuItem
} from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { StandardMasterWallet } from 'src/app/wallet/model/masterwallets/masterwallet';
import { WalletType } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnyMainCoinEVMSubWallet } from 'src/app/wallet/model/networks/evms/subwallets/evm.subwallet';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import { AuthService } from 'src/app/wallet/services/auth.service';
import { ERC20CoinService } from 'src/app/wallet/services/evm/erc20coin.service';
import { EVMService } from 'src/app/wallet/services/evm/evm.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { CoinTransferService } from '../../../services/cointransfer.service';
import { Native } from '../../../services/native.service';
import { UiService } from '../../../services/ui.service';
import { WalletService } from '../../../services/wallet.service';

/**
 * This operation is dangerous and is deprecated, but we handle it for backward compatibility
 * with some dApps.
 */
@Component({
  selector: 'app-ethsign',
  templateUrl: './ethsign.page.html',
  styleUrls: ['./ethsign.page.scss']
})
export class EthSignPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  public targetNetwork: AnyNetwork = null;
  private networkWallet: AnyNetworkWallet = null;
  public evmSubWallet: AnyMainCoinEVMSubWallet = null;

  private receivedIntent: EssentialsIntentPlugin.ReceivedIntent;
  private payloadToBeSigned: string;

  private alreadySentIntentResponse = false;

  public currentNetworkName = '';

  // Titlebar
  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  constructor(
    public walletManager: WalletService,
    private coinTransferService: CoinTransferService,
    private globalIntentService: GlobalIntentService,
    public native: Native,
    public zone: NgZone,
    private translate: TranslateService,
    public theme: GlobalThemeService,
    private authService: AuthService,
    private erc20service: ERC20CoinService, // Keep it to initialize the service for the ETHTransactionInfoParser
    public uiService: UiService,
    private router: Router,
    private ethTransactionService: EVMService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras && navigation.extras.state) {
      this.receivedIntent = navigation.extras.state as EssentialsIntentPlugin.ReceivedIntent;
      if (this.receivedIntent.params) {
        this.payloadToBeSigned = this.receivedIntent.params.data;
      }
    }
  }

  ngOnInit() {
    void this.init();
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.signtypeddata-title'));
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

  async init() {
    Logger.log(
      'wallet',
      'ETH Sign params',
      this.coinTransferService.masterWalletId,
      this.coinTransferService.sendTransactionChainId
    );

    // If there is a provided chain ID, use that chain id network (eg: wallet connect v2).
    // Otherwise, use the active network
    if (this.coinTransferService.sendTransactionChainId) {
      this.targetNetwork = WalletNetworkService.instance.getNetworkByChainId(
        this.coinTransferService.sendTransactionChainId
      );
    } else {
      this.targetNetwork = WalletNetworkService.instance.activeNetwork.value;
    }

    // Early return if target network is not available
    if (!this.targetNetwork) {
      Logger.warn('wallet', 'ETH Sign: target network not found');
      return;
    }

    this.currentNetworkName = this.targetNetwork.name;

    // Determine which network and wallet to use based on available parameters
    let targetNetwork = this.targetNetwork; // Default to target network from chain ID
    let masterWalletId = this.coinTransferService.masterWalletId;

    // If no specific master wallet ID is provided, use the active wallet's master wallet
    if (!masterWalletId) {
      let activeNetworkWallet = this.walletManager.getActiveNetworkWallet();
      if (activeNetworkWallet) {
        masterWalletId = activeNetworkWallet.masterWallet.id;
      }
    }

    // If no specific chain ID is provided, use the active network
    if (!this.coinTransferService.sendTransactionChainId) {
      targetNetwork = WalletNetworkService.instance.activeNetwork.value;
    }

    // Create network wallet with the determined network and master wallet
    if (masterWalletId) {
      let masterWallet = this.walletManager.getMasterWallet(masterWalletId);
      if (!masterWallet) {
        Logger.warn('wallet', 'ETH Sign: master wallet not found for ID:', masterWalletId);
        return;
      }
      this.networkWallet = await targetNetwork.createNetworkWallet(masterWallet, false);
    } else {
      // Ultimate fallback to active network wallet
      let activeNetworkWallet = this.walletManager.getActiveNetworkWallet();
      if (!activeNetworkWallet) {
        Logger.warn('wallet', 'ETH Sign: network wallet not found');
        return;
      }
      this.networkWallet = activeNetworkWallet;
    }

    this.evmSubWallet = this.networkWallet.getMainEvmSubWallet(); // Use the active network main EVM subwallet. This is ETHSC for elastos.
    if (!this.evmSubWallet) {
      Logger.warn('wallet', 'ETH Sign: EVM subwallet not found');
      return;
    }

    // No message ? Just exit immediatelly
    if (!this.payloadToBeSigned) {
      await this.cancelOperation();
    }
  }

  /**
   * Cancel the operation. Closes the screen and goes back to the calling application after
   * sending the intent response.
   */
  async cancelOperation(navigateBack = true) {
    await this.sendIntentResponse({ data: null }, this.receivedIntent.intentId, navigateBack);
  }

  private async sendIntentResponse(result, intentId, navigateBack = true) {
    this.alreadySentIntentResponse = true;
    await this.globalIntentService.sendIntentResponse(result, intentId, navigateBack);
  }

  async confirmSign(): Promise<void> {
    const payPassword = await this.authService.getWalletPassword(this.networkWallet.masterWallet.id, true, true);
    if (payPassword === null) {
      // cancelled by user
      await this.cancelOperation();
      return;
    }

    let privateKeyHexNoprefix = await (
      await (this.networkWallet.masterWallet as StandardMasterWallet).getPrivateKey(payPassword)
    ).replace('0x', '');

    let privateKey = Buffer.from(privateKeyHexNoprefix, 'hex');

    // Implementation taken from Metamask unsafe signing:
    // https://github.com/MetaMask/eth-simple-keyring/blob/main/index.js
    try {
      const message = stripHexPrefix(this.payloadToBeSigned);
      const msgSig = ecsign(Buffer.from(message, 'hex'), privateKey);
      const rawMsgSig = toRpcSig(msgSig.v, msgSig.r, msgSig.s);

      void this.sendIntentResponse(
        {
          signedData: rawMsgSig
        },
        this.receivedIntent.intentId
      );
    } catch (e) {
      // Sign method can throw exception in case some provided content has an invalid format
      // i.e.: array value, with "address" type. In such case, we fail silently.
      Logger.warn('wallet', 'eth_sign intent error:', e);
      await this.sendIntentResponse({ data: null }, this.receivedIntent.intentId);
    }
  }
}
