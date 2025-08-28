import { Component, Input } from '@angular/core';
import BigNumber from 'bignumber.js';
import { UiService } from '../../../../services/ui.service';

@Component({
  selector: 'app-account-abstraction',
  templateUrl: './account-abstraction.component.html',
  styleUrls: ['./account-abstraction.component.scss']
})
export class AccountAbstractionComponent {
  @Input() balance: BigNumber;
  @Input() uiService: UiService;
  @Input() totalTransactionCost: any;
  @Input() getCurrencyInUse: () => string;

  constructor() {}
}
