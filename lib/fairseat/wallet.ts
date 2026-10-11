import { cookies } from "next/headers";
import type { FanWallet } from "./xrpl";

// The fan's testnet wallet lives in an httpOnly cookie, so the browser never sees the seed.
// Testnet only: the account holds faucet XRP and test dollars, nothing of value.
const COOKIE = "fairseat_wallet";

export async function readWallet(): Promise<FanWallet | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const wallet = JSON.parse(raw) as FanWallet;
    return wallet.seed && wallet.address ? wallet : null;
  } catch {
    return null;
  }
}

export async function saveWallet(wallet: FanWallet) {
  (await cookies()).set(COOKIE, JSON.stringify(wallet), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
