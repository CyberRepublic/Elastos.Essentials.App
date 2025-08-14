import { Injectable } from '@angular/core';
import { AlertController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Logger } from 'src/app/logger';
import { ConfirmationPopupComponent, ConfirmationPopupComponentParams } from '../components/confirmation-popup/confirmation-popup.component';
import { HelpComponent } from '../components/help/help.component';

@Injectable({
    providedIn: 'root'
})
export class GlobalPopupService {
    public alertPopup: any = null;

    constructor(
        public alertCtrl: AlertController,
        private popoverCtrl: PopoverController,
        private translate: TranslateService,
    ) { }

    public ionicAlert(title: string, subTitle?: string, okText?: string): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            this.alertPopup = this.alertCtrl.create({
                header: this.translate.instant(title),
                subHeader: subTitle ? this.translate.instant(subTitle) : '',
                backdropDismiss: false,
                cssClass: 'alert custom-alert',
                mode: 'ios',
                buttons: [
                    {
                        text: okText ? this.translate.instant(okText) : this.translate.instant('common.close'),
                        handler: () => {
                            Logger.log('wallet', 'ionicAlert Ok clicked');
                            this.alertPopup = null;
                            resolve();
                        }
                    }
                ]
            }).then(alert => alert.present());
        });
    }

    // TODO: don't use a promise, use 2 callbacks here, "confirmed" and "cancelled"
    public ionicConfirm(
        title: string,
        message: string,
        okText = "common.confirm",
        cancelText = "common.cancel"
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            this.alertPopup = null;
            this.alertPopup = this.alertCtrl.create({
                header: this.translate.instant(title),
                message: this.translate.instant(message),
                cssClass: 'alert custom-alert',
                backdropDismiss: false,
                mode: 'ios',
                buttons: [
                    {
                        text: this.translate.instant(cancelText),
                        handler: () => {
                            Logger.log('wallet', 'ionicConfirm Disagree clicked');
                            this.alertPopup = null;
                            resolve(false);
                        }
                    },
                    {
                        text: this.translate.instant(okText),
                        handler: () => {
                            Logger.log('wallet', 'Agree clicked');
                            this.alertPopup = null;
                            resolve(true);
                        }
                    }
                ]
            }).then(confirm => confirm.present());
        });
    }

    // TODO: don't use a promise, use 2 callbacks here, "confirmed" and "cancelled"
    public ionicConfirmWithSubTitle(title: string, subTitle: string, message: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.alertPopup = this.alertCtrl.create({
                header: this.translate.instant(title),
                subHeader: subTitle,
                message: this.translate.instant(message),
                cssClass: 'alert custom-alert',
                mode: 'ios',
                buttons: [
                    {
                        text: this.translate.instant('common.cancel'),
                        handler: () => {
                            Logger.log('wallet', 'ionicConfirm Disagree clicked');
                            this.alertPopup = null;
                            resolve(false);
                        }
                    },
                    {
                        text: this.translate.instant('common.confirm'),
                        handler: () => {
                            Logger.log('wallet', 'Agree clicked');
                            this.alertPopup = null;
                            resolve(true);
                        }
                    }
                ]
            }).then(confirm => confirm.present());
        });
    }

    // TODO: don't use a promise, use 2 callbacks here, "confirmed" and "cancelled"
    public ionicPrompt(
        title: string,
        message: string,
        opts?: any,
        okText?: string,
        cancelText?: string
    ): Promise<boolean> {
        opts = opts || {};

        return new Promise((resolve, reject) => {
            let defaultText = opts && opts.defaultText ? opts.defaultText : null;
            let placeholder = opts && opts.placeholder ? opts.placeholder : null;
            let inputType = opts && opts.type ? opts.type : 'text';
            let cssClass = opts.useDanger ? "alertDanger" : null;
            let backdropDismiss = !!opts.backdropDismiss;

            this.alertPopup = this.alertCtrl.create({
                header: title,
                message,
                /*cssClass,
                backdropDismiss,
                inputs: [
                  {
                    value: defaultText,
                    placeholder,
                    type: inputType
                  },
                ],*/
                mode: 'ios',
                buttons: [
                    {
                        text: cancelText ? cancelText : this.translate.instant('common.cancel'),
                        handler: data => {
                            Logger.log('wallet', 'Cancel clicked');
                            this.alertPopup = null;
                            resolve(false);
                        }
                    },
                    {
                        text: okText ? okText : this.translate.instant('common.ok'),
                        handler: data => {
                            Logger.log('wallet', 'Ok clicked');
                            this.alertPopup = null;
                            resolve(true);
                        }
                    }
                ]
            }).then(prompt => {
                void prompt.present();
            });
        });
    }

    /**
     * Advanced confirmation popup with designed UI component.
     * Resolves when the popup is closing. True if confirmed, false if cancelled.
     */
    private confirmationPopup: HTMLIonPopoverElement = null;
    public showConfirmationPopup(title: string, text: string, confirmationButtonText?: string, customIcon?: string): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        return new Promise(async resolve => {
            let componentProps: ConfirmationPopupComponentParams = {
                type: "custom",
                customIcon: customIcon ? customIcon : "/assets/launcher/icons/hive-cross.svg",
                title,
                text,
                confirmationButtonText
            };

            this.confirmationPopup = await this.popoverCtrl.create({
                cssClass: 'contacts-warning-component',
                component: ConfirmationPopupComponent,
                componentProps
            });
            void this.confirmationPopup.onWillDismiss().then((response) => {
                let confirmed = response.data as boolean;
                this.confirmationPopup = null;
                resolve(confirmed);
            });
            await this.confirmationPopup.present();
        });
    }

    private helpPopup: HTMLIonPopoverElement = null;
    public async showHelp(ev: any, helpMessage: string, cssClass = 'wallet-help-component') {
        this.helpPopup = await this.popoverCtrl.create({
            mode: 'ios',
            component: HelpComponent,
            cssClass: cssClass,
            event: ev,
            componentProps: {
                message: helpMessage
            },
            translucent: false
        });
        this.helpPopup.onWillDismiss().then(() => {
            this.helpPopup = null;
        });
        return await this.helpPopup.present();
    }
}
