import { NgModule } from '@angular/core';
import { WalletModule } from '../wallet/module';

@NgModule({
  declarations: [],
  imports: [
    WalletModule // Because the wallet service uses WalletModule dependencies
  ],
  bootstrap: [],
  providers: [],
  schemas: []
})
export class VotingModule { }
