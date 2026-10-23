import { ethers } from "ethers";
import type { Request } from "express";

/// This is an asserted wallet address, not proof of wallet ownership.
export function requestWallet(req: Request): string | null {
  const address = req.header("x-parallax-wallet");
  if (!address || !ethers.isAddress(address)) return null;
  return ethers.getAddress(address);
}
