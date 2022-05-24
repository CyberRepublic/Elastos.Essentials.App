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

import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { GlobalThemeService } from 'src/app/services/global.theme.service';
import { Native } from '../../services/native.service';
import { AddWalletComponent } from './components/add-wallet/add-wallet.component';

type Action = () => Promise<void>;

type SettingsEntry = {
    routeOrAction: string | Action;
    title: string;
    subtitle: string;
    icon: string;
    iconDarkmode: string;
    type: string
}

@Component({
    selector: 'app-settings',
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
    @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

    public masterWalletId = "1";
    public masterWalletType = "";
    public readonly = "";
    public currentLanguageName = "";
    public isShowDeposit = false;
    public fee = 0;
    public walletInfo = {};
    public password = "";
    public available = 0;
    public settings: SettingsEntry[] = [
        {
            routeOrAction: () => this.addWallet(),
            title: this.translate.instant("wallet.settings-add-wallet"),
            subtitle: this.translate.instant("wallet.settings-add-wallet-subtitle"),
            icon: '/assets/wallet/settings/wallet.svg',
            iconDarkmode: '/assets/wallet/settings/darkmode/wallet.svg',
            type: 'launcher'
        },
        {
            routeOrAction: "/wallet/wallet-manager",
            title: this.translate.instant("wallet.settings-my-wallets"),
            subtitle: this.translate.instant("wallet.settings-my-wallets-subtitle"),
            icon: '/assets/wallet/settings/wallet.svg',
            iconDarkmode: '/assets/wallet/settings/darkmode/wallet.svg',
            type: 'wallet-manager'
        },
        {
            routeOrAction: "/wallet/settings/currency-select",
            title: this.translate.instant("wallet.settings-currency"),
            subtitle: this.translate.instant("wallet.settings-currency-subtitle"),
            icon: '/assets/wallet/settings/currency.svg',
            iconDarkmode: '/assets/wallet/settings/darkmode/currency.svg',
            type: 'currency-select'
        },
        {
            routeOrAction: "/wallet/settings/manage-networks",
            title: this.translate.instant("wallet.settings-manage-networks"),
            subtitle: this.translate.instant("wallet.settings-manage-networks-subtitle"),
            icon: '/assets/wallet/settings/custom-networks.svg',
            iconDarkmode: '/assets/wallet/settings/darkmode/custom-networks.svg',
            type: 'manage-networks'
        },
    ];

    constructor(
        public theme: GlobalThemeService,
        private translate: TranslateService,
        private native: Native,
        private modalCtrl: ModalController
    ) {
    }

    ngOnInit() {
    }

    ionViewWillEnter() {
        this.titleBar.setTitle(this.translate.instant("wallet.settings-title"));
    }

    public go(item: SettingsEntry) {
        if (typeof item.routeOrAction === "string") {
            if (item.type === 'launcher')
                this.native.go(item.routeOrAction, { from: 'settings' })
            else
                this.native.go(item.routeOrAction);
        }
        else {
            void item.routeOrAction();
        }
    }

    private async addWallet(): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: AddWalletComponent,
            componentProps: {
                networkKey: "elastos"
            },
            backdropDismiss: true, // Closeable
            cssClass: !this.theme.darkMode ? "switch-network-component switch-network-component-base" : 'switch-network-component-dark switch-network-component-base'
        });

        void modal.onDidDismiss().then((response: { data?: boolean }) => {
            //resolve(!!response.data); // true or undefined
        });

        void modal.present();
    }
}
