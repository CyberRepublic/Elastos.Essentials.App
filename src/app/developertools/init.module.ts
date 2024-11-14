import { NgModule } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IonicModule, Platform } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  declarations: [
  ],
  imports: [
    IonicStorageModule,
    IonicModule,
    TranslateModule
  ],
  bootstrap: [],
  providers: [
    Platform,
    Clipboard
  ]
})
export class DeveloperToolsInitModule {}
