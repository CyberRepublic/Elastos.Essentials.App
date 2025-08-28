import { Component, Input, Output, EventEmitter } from '@angular/core';
import BigNumber from 'bignumber.js';
import { UiService } from '../../../../services/ui.service';

@Component({
  selector: 'app-standard-account',
  templateUrl: './standard-account.component.html',
  styleUrls: ['./standard-account.component.scss']
})
export class StandardAccountComponent {
  @Input() balance: BigNumber;
  @Input() gasPriceGwei: number;
  @Input() gasLimitDisplay: string;
  @Input() showEditGasPrice: boolean;
  @Input() uiService: UiService;
  @Input() totalTransactionCost: any;
  @Input() getCurrencyInUse: () => string;
  @Input() getNativeCurrencyInUse: () => string;
  
  @Output() editGasPriceEvent = new EventEmitter<void>();
  @Output() updateGaspriceEvent = new EventEmitter<any>();
  @Output() updateGasLimitEvent = new EventEmitter<any>();

  constructor() {}

  editGasPrice(): void {
    this.editGasPriceEvent.emit();
  }

  updateGasprice(event: any): void {
    this.updateGaspriceEvent.emit(event);
  }

  updateGasLimit(event: any): void {
    this.updateGasLimitEvent.emit(event);
  }
}
