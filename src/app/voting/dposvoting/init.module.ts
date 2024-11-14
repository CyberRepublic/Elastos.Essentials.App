import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { IonicModule, Platform } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';


@NgModule({
  declarations: [
  ],
  imports: [
    HttpClientModule,
    IonicModule,
    IonicStorageModule,
  ],
  bootstrap: [],
  providers: [
    Platform,
    WebView
  ],
  schemas: []
})
export class DPoSVotingInitModule {}
