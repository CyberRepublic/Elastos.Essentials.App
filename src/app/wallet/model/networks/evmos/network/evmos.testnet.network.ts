import { TESTNET_TEMPLATE } from "src/app/services/global.networks.service";
import { EvmosBaseNetwork } from "./evmos.base.network";

export class EvmosTestNetNetwork extends EvmosBaseNetwork {
  constructor() {
    super("evmos",
      "Evmos Testnet",
      "Evmos Testnet",
      "assets/wallet/networks/evmos.png",
      "EVMOS",
      "Evmos Token",
      TESTNET_TEMPLATE,
      9000,
      [],
      [
        {
          name: 'Evmos Testnet RPC',
          url: 'https://evmos-testnet.lava.build'
        }
      ]
    );

    this.averageBlocktime = 5;
  }
}
