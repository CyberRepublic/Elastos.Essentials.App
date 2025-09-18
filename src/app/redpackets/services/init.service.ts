import { Injectable } from '@angular/core';
import { IdentityEntry } from 'src/app/model/didsessions/identityentry';
import { GlobalLightweightService } from 'src/app/services/global.lightweight.service';
import { GlobalService, GlobalServiceManager } from 'src/app/services/global.service.manager';
import { DIDService } from './did.service';
import { NetworksService } from './networks.service';
import { PacketService } from './packet.service';
import { PaymentService } from './payment.service';

@Injectable({
  providedIn: 'root'
})
export class RedPacketsInitService extends GlobalService {
  constructor(
    private paymentsService: PaymentService,
    private packetService: PacketService,
    private didService: DIDService,
    private networksService: NetworksService,
    private lightweightService: GlobalLightweightService
  ) {
    super();
  }

  public init(): Promise<void> {
    GlobalServiceManager.getInstance().registerService(this);
    this.paymentsService.init();
    void this.networksService.init(); // Don't block the init sequence for this
    return;
  }

  public async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    // Only initialize red packets functionality if not in lightweight mode
    if (!this.lightweightService.getCurrentLightweightMode()) {
      await this.packetService.onUserSignIn();
      await this.didService.onUserSignIn();
    }
  }

  public async onUserSignOut(): Promise<void> {
    await this.didService.onUserSignOut();
    this.packetService.onUserSignOut();
    return;
  }
}
