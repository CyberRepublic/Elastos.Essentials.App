import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import type { AnyNetwork } from 'src/app/wallet/model/networks/network';
import { BuiltinNetworkOverride, WalletNetworkService } from 'src/app/wallet/services/network.service';

export type EditBuiltinNetworkRoutingParams = {
  networkKey: string; // Key of the builtin network to edit
};

@Component({
  selector: 'app-edit-builtin-network',
  templateUrl: './edit-builtin-network.page.html',
  styleUrls: ['./edit-builtin-network.page.scss']
})
export class EditBuiltinNetworkPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  // Model
  public network: AnyNetwork = null;
  public networkOverride: BuiltinNetworkOverride = null;

  // Edited values (bound to UI)
  public editedName = '';
  public editedRpcUrl = '';

  constructor(
    public theme: GlobalThemeService,
    public translate: TranslateService,
    public networkService: WalletNetworkService,
    private router: Router,
    private native: GlobalNativeService,
    private globalNav: GlobalNavService,
    private http: HttpClient,
    public globalPopupService: GlobalPopupService,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.init();
  }

  ngOnDestroy() {
    void this.native.hideLoading(); // Maybe RPC request timeout
  }

  private init() {
    const navigation = this.router.getCurrentNavigation();
    this.zone.run(() => {
      const params = navigation.extras.state as EditBuiltinNetworkRoutingParams;

      // Get the builtin network
      this.network = this.networkService.getNetworkByKey(params.networkKey);
      if (!this.network) {
        this.native.errToast('Network not found');
        void this.globalNav.navigateBack();
        return;
      }

      // Get existing override or create empty one
      this.networkOverride = this.networkService.getBuiltinNetworkOverride(params.networkKey) || {
        networkKey: params.networkKey
      };

      // Initialize edited values with current effective values
      this.editedName = this.network.getEffectiveName();
      this.editedRpcUrl = this.network.getRPCUrl();
    });
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.edit-builtin-network-title'));
  }

  cancel() {
    void this.globalNav.navigateBack();
  }

  public canSave(): boolean {
    return this.editedName.trim() !== '' && this.editedRpcUrl.trim() !== '';
  }

  public async saveChanges(): Promise<void> {
    // First, check that the RPC URL is accessible
    let rpcUrlIsReachable = false;
    try {
      await this.native.showLoading('wallet.checking-rpc-url');

      const httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      };

      // Some servers return "{}" when the request body is "{}".
      // So it is better to call eth_blockNumber.
      let testCallResult = await this.http
        .post(
          this.editedRpcUrl,
          JSON.stringify({ method: 'eth_blockNumber', jsonrpc: '2.0', id: 'test01' }),
          httpOptions
        )
        .toPromise();
      if (testCallResult && 'jsonrpc' in testCallResult) rpcUrlIsReachable = true;
    } catch (err) {
    } finally {
      await this.native.hideLoading();
    }

    if (!rpcUrlIsReachable) {
      this.native.errToast('wallet.wrong-rpc-url');
      return;
    }

    // Check if values have changed from defaults
    const defaultName = this.network.getDefaultName();
    const defaultRpcUrl = this.network.getDefaultRPCUrl();

    const nameChanged = this.editedName.trim() !== defaultName;
    const rpcUrlChanged = this.editedRpcUrl.trim() !== defaultRpcUrl;

    if (nameChanged || rpcUrlChanged) {
      // Save the override
      const override: BuiltinNetworkOverride = {
        networkKey: this.network.key,
        ...(nameChanged && { name: this.editedName.trim() }),
        ...(rpcUrlChanged && { rpcUrl: this.editedRpcUrl.trim() })
      };
      await this.networkService.setBuiltinNetworkOverride(this.network.key, override);
    } else {
      // Remove any existing override since values match defaults
      await this.networkService.removeBuiltinNetworkOverride(this.network.key);
    }

    void this.globalNav.navigateBack();
  }

  public hasNameOverride(): boolean {
    return this.network && this.editedName.trim() !== this.network.getEffectiveName();
  }

  public hasRpcUrlOverride(): boolean {
    return this.network && this.editedRpcUrl.trim() !== this.network.getRPCUrl();
  }

  public resetName(): void {
    if (this.network) {
      this.editedName = this.network.getDefaultName();
    }
  }

  public resetRpcUrl(): void {
    if (this.network) {
      this.editedRpcUrl = this.network.getDefaultRPCUrl();
    }
  }

  public getChainId(): string {
    if (!this.network) {
      return 'N/A';
    }

    if (this.network.isEVMNetwork()) {
      return (this.network as any).getMainChainID()?.toString() || 'N/A';
    }
    return 'N/A';
  }
}
