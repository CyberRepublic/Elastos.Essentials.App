import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { SharedComponentsModule } from 'src/app/components/sharedcomponents.module';
import { MnemonicPassCheckComponent } from './mnemonicpasscheck/mnemonicpasscheck.component';
import { OptionsComponent } from './options/options.component';
import { WarningComponent } from './warning/warning.component';

@NgModule({
  declarations: [
    MnemonicPassCheckComponent,
    OptionsComponent,
    WarningComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedComponentsModule,
    InlineSVGModule,
    TranslateModule
  ],
  exports: [
    MnemonicPassCheckComponent,
    OptionsComponent,
    WarningComponent
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ComponentsModule { }
