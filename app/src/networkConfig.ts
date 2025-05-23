import { getFullnodeUrl } from "@mysten/sui/client";
import {
  DEVNET_DEPEG_SWAP_PACKAGE_ID,
  TESTNET_DEPEG_SWAP_PACKAGE_ID,
  MAINNET_DEPEG_SWAP_PACKAGE_ID,
} from "./constants";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),
      variables: {
        depegSwapPackageId: DEVNET_DEPEG_SWAP_PACKAGE_ID,
      },
    },
    testnet: {
      url: getFullnodeUrl("testnet"),
      variables: {
        depegSwapPackageId: TESTNET_DEPEG_SWAP_PACKAGE_ID,
      },
    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),
      variables: {
        depegSwapPackageId: MAINNET_DEPEG_SWAP_PACKAGE_ID,
      },
    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
