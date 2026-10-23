import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

async function loadNetwork() {
  vi.stubEnv("VITE_MONAD_CHAIN_ID", "0x279f");
  vi.stubEnv("VITE_ETH_CHAIN_ID", "0xaa36a7");
  return import("./Web3Context");
}

describe("Monad wallet network", () => {
  it("prefers Monad configuration over a stale Ethereum setting", async () => {
    const request = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("ethereum", { request });
    const { ensureMonadNetwork, TARGET_CHAIN_ID } = await loadNetwork();
    expect(TARGET_CHAIN_ID).toBe("0x279f");
    await ensureMonadNetwork();
    expect(request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x279f" }] });
  });

  it("adds Monad testnet with MON when the wallet does not know the chain", async () => {
    const request = vi.fn().mockRejectedValueOnce({ code: 4902 }).mockResolvedValueOnce(null);
    vi.stubGlobal("ethereum", { request });
    const { ensureMonadNetwork } = await loadNetwork();
    await ensureMonadNetwork();
    expect(request).toHaveBeenLastCalledWith({ method: "wallet_addEthereumChain", params: [expect.objectContaining({
      chainId: "0x279f", chainName: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    })] });
  });

  it("propagates rejected switching so callers cannot continue on the wrong chain", async () => {
    const rejection = { code: 4001, message: "User rejected request" };
    vi.stubGlobal("ethereum", { request: vi.fn().mockRejectedValue(rejection) });
    const { ensureMonadNetwork } = await loadNetwork();
    await expect(ensureMonadNetwork()).rejects.toEqual(rejection);
  });
});
