import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
  ],
  imports: [
    HttpClientModule,
    IonicModule,
    IonicStorageModule.forRoot(),
    TranslateModule
 ],
  bootstrap: [],
  providers: [
    Clipboard,
  ],
  schemas: []
})
export class ContactsInitModule {}
