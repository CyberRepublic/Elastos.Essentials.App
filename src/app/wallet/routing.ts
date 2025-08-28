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

import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

const routes: Routes = [
  // Global
  {
    path: "settings",
    loadChildren: () =>
      import("./pages/settings/module").then((m) => m.SettingsModule),
  },
  {
    path: "wallet-asset",
    loadChildren: () =>
      import("./pages/wallet/wallet-asset/module").then(
        (m) => m.WalletAssetModule
      ),
  },
  {
    path: "wallet-home",
    loadChildren: () =>
      import("./pages/wallet/wallet-home/module").then(
        (m) => m.WalletHomeModule
      ),
  },
  {
    path: "wallet-create",
    loadChildren: () =>
      import("./pages/wallet/wallet-create/module").then(
        (m) => m.WalletCreateModule
      ),
  },
  {
    path: "wallet-import",
    loadChildren: () =>
      import("./pages/wallet/wallet-import/module").then(
        (m) => m.WalletImportModule
      ),
  },
  {
    path: "wallet-import-privatekey",
    loadChildren: () =>
      import("./pages/wallet/wallet-import-privatekey/module").then(
        (m) => m.WalletImportByPrivateKeyModule
      ),
  },
  {
    path: "wallet-keystore-export",
    loadChildren: () =>
      import("./pages/wallet/wallet-keystore-export/module").then(
        (m) => m.KeystoreExportModule
      ),
  },
  {
    path: "wallet-manager",
    loadChildren: () =>
      import("./pages/wallet/wallet-manager/module").then(
        (m) => m.WalletManagerModule
      ),
  },
  {
    path: "wallet-create-name",
    loadChildren: () =>
      import("./pages/wallet/wallet-create-name/module").then(
        (m) => m.WalletCreateNameModule
      ),
  },
  {
    path: "wallet-edit-name",
    loadChildren: () =>
      import("./pages/wallet/wallet-edit-name/module").then(
        (m) => m.WalletEditNameModule
      ),
  },
  {
    path: "wallet-settings",
    loadChildren: () =>
      import("./pages/wallet/wallet-settings/module").then(
        (m) => m.WalletSettingsModule
      ),
  },
  {
    path: "mnemonic",
    loadChildren: () =>
      import("./pages/wallet/mnemonic/module").then((m) => m.MnemonicModule),
  },
  {
    path: "wallet-tron-resource",
    loadChildren: () =>
      import("./pages/wallet/tron/module").then((m) => m.TronResourceModule),
  },

  // Settings
  {
    path: "wallet-color",
    loadChildren: () =>
      import("./pages/wallet/wallet-color/module").then(
        (m) => m.WalletColorModule
      ),
  },
  {
    path: "wallet-ext-pub-keys",
    loadChildren: () =>
      import("./pages/wallet/wallet-multisig-pub-keys/module").then(
        (m) => m.MultiSigPubKeysModule
      ),
  },

  // Coin
  {
    path: "coin",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-home/module").then(
        (m) => m.CoinHomeModule
      ),
  },
  {
    path: "coin-address",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-address/module").then(
        (m) => m.CoinAddressModule
      ),
  },
  {
    path: "coin-list",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-list/module").then(
        (m) => m.CoinListModule
      ),
  },
  {
    path: "coin-select",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-select/module").then(
        (m) => m.CoinSelectModule
      ),
  },
  {
    path: "coin-receive",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-receive/module").then(
        (m) => m.CoinReceiveModule
      ),
  },
  {
    path: "coin-tx-info",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-tx-info/module").then(
        (m) => m.CoinTxInfoModule
      ),
  },
  {
    path: "coin-transfer",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-transfer/module").then(
        (m) => m.CoinTransferModule
      ),
  },
  {
    path: "coin-add-erc20",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-add-erc20/module").then(
        (m) => m.CoinAddERC20Module
      ),
  },
  {
    path: "coin-erc20-details",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-erc20-details/module").then(
        (m) => m.CoinERC20DetailsModule
      ),
  },
  {
    path: "coin-nft-home",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-nft-home/module").then(
        (m) => m.CoinNFTHomeModule
      ),
  },
  {
    path: "coin-nft-details",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-nft-details/module").then(
        (m) => m.CoinNFTDetailsModule
      ),
  },
  {
    path: "coin-earn",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-earn/module").then(
        (m) => m.CoinEarnModule
      ),
  },
  {
    path: "coin-swap",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-swap/module").then(
        (m) => m.CoinSwapModule
      ),
  },
  {
    path: "coin-bridge",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-bridge/module").then(
        (m) => m.CoinBridgeModule
      ),
  },
  {
    path: "coin-bpos-nft",
    loadChildren: () =>
      import("./pages/wallet/coin/coin-bpos-nft/module").then(
        (m) => m.CoinBPoSNFTModule
      ),
  },

  // Intents
  {
    path: "intents",
    loadChildren: () =>
      import("./pages/intents/module").then((m) => m.IntentsModule),
  },

  // Multisig
  {
    path: "multisig",
    loadChildren: () =>
      import("./pages/wallet/multisig/module").then((m) => m.MultiSigModule),
  },

  // AA Wallet
  {
    path: "account-abstraction",
    loadChildren: () =>
      import("./pages/wallet/account-abstraction/module").then(
        (m) => m.AccountAbstractionModule
      ),
  },

  // Ledger
  {
    path: "ledger",
    loadChildren: () =>
      import("./pages/wallet/ledger/module").then((m) => m.LedgerModule),
  },
  // { path: 'ledgertest', loadChildren: () => import('./pages/wallet/ledgertest/module').then(m => m.LedgerTestModule) },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletRoutingModule {}
