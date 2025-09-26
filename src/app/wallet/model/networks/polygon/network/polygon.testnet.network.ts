import { TESTNET_TEMPLATE } from 'src/app/services/global.networks.service';
import { PolygonBaseNetwork } from './polygon.base.network';

export class PolygonTestNetNetwork extends PolygonBaseNetwork {
  constructor() {
    super(
      'polygon',
      'Polygon Mumbai (Goërli)',
      'Polygon Mumbai',
      'assets/wallet/networks/polygon.png',
      'MATIC',
      'Polygon Coin',
      TESTNET_TEMPLATE,
      80001,
      [],
      [
        {
          name: 'Polygon Mumbai RPC',
          url: 'https://rpc-mumbai.maticvigil.com/'
        }
      ]
    );

    this.averageBlocktime = 5;
  }
}
