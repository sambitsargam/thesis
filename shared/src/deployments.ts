import type {Address} from "viem";

/** Addresses written by `script/DeployThesis.s.sol`, one record per chain. */
export interface Deployment {
  chainId: number;
  factory: Address;
  router: Address;
  quoteToken: Address;
  agent: Address;
  demoBasket: Address;
  okxDexRouter: Address;
  okxTokenApprove: Address;
}

export const DEPLOYMENTS: Record<number, Deployment> = {
  196: {
    chainId: 196,
    factory: "0xB8b2d90DB14aa4D3964bC1c6a6821c2739f1254e",
    router: "0x2f0e2561283b0953B87C0069590DdE6fDD2766d9",
    quoteToken: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    agent: "0xC026A091ce15C1958b91812e854266dcB3d4bAa0",
    demoBasket: "0x728896dBB0Dd3c75313e2238AB4F3Fb3Daf5d1BB",
    okxDexRouter: "0x7c5bEE2a8091C3ef39072f64F18Fac913060AEaF",
    okxTokenApprove: "0x8b773D83bc66Be128c60e07E17C8901f7a64F000"
  }
};

export function deploymentFor(chainId: number): Deployment {
  const deployment = DEPLOYMENTS[chainId];
  if (!deployment) throw new Error(`No Thesis deployment recorded for chain ${chainId}`);
  return deployment;
}
