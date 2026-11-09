/**
 * Production integrations, disabled until configured. None of them is connected in
 * this build: the demo never claims a chain, token or image model is live.
 */
import { createPublicClient, http, parseAbi } from "viem";
import type { EventDao } from "./types";

export class NotConfigured extends Error {
  constructor(public what: string) {
    super(`${what} is not configured`);
  }
}

const STAKING_ABI = parseAbi([
  "function stakedBalance(address account) view returns (uint256)",
  "function lockedUntil(address account) view returns (uint64)",
]);

/**
 * Reads the stake from an audited staking contract. Requires DAO_RPC_URL and
 * DAO_STAKING_AUDITED=true (set only after an independent audit report is on file).
 */
export async function verifyOnchainStake(dao: EventDao, address: `0x${string}`) {
  const rpc = process.env.DAO_RPC_URL;
  if (!rpc) throw new NotConfigured("DAO_RPC_URL");
  if (process.env.DAO_STAKING_AUDITED !== "true") throw new NotConfigured("Audited staking contract (DAO_STAKING_AUDITED)");
  const client = createPublicClient({ transport: http(rpc) });
  const chainId = await client.getChainId();
  if (chainId !== dao.config.chainId) throw new Error("CHAIN_ID_MISMATCH");
  const [raw, until] = await Promise.all([
    client.readContract({ address: dao.config.stakingContract, abi: STAKING_ABI, functionName: "stakedBalance", args: [address] }),
    client.readContract({ address: dao.config.stakingContract, abi: STAKING_ABI, functionName: "lockedUntil", args: [address] }),
  ]);
  return { amount: Number(raw / 10n ** 18n), lockedUntil: Number(until) * 1000 };
}

/** Image-edit model for stage concepts (photo + stage-zone mask + prompt). */
export function imageModelConfigured() {
  return !!process.env.STAGE_AI_PROVIDER && !!process.env.STAGE_AI_API_KEY;
}
