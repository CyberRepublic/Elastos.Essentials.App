import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from 'src/app/components/sharedcomponents.module';
import { WalletChooserComponent } from './wallet-chooser.component';

@NgModule({
  declarations: [
    WalletChooserComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    SharedComponentsModule
  ],
  exports: [
    WalletChooserComponent
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WalletChooserComponentModule { }
