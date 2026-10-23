import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CustomerDashboard from "./CustomerDashboard";
import { ETH_CHAIN_ID } from "../lib/constants";

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(), getTransactionReceipt: vi.fn(), getNetwork: vi.fn(), syncTaskTx: vi.fn(),
}));
vi.mock("../contexts/Web3Context", () => ({
  useWeb3: () => ({
    account: "0xabc0000000000000000000000000000000000001", balance: "5",
    taskManager: { createTask: mocks.createTask },
    provider: { getNetwork: mocks.getNetwork, getTransactionReceipt: mocks.getTransactionReceipt },
    connectWallet: vi.fn(), currencySymbol: "ETH", networkName: "Ethereum Sepolia",
  }),
}));
vi.mock("../lib/utils", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/utils")>(), syncTaskTx: mocks.syncTaskTx,
}));
const fetchMock = vi.fn();
const receipt = { hash: "0xsubmitted", status: 1 };
const plan = {
  masterTask: "Provide two prime numbers", masterTaskCID: "master-cid",
  masterObjective: "Provide exactly two prime numbers", successCriteria: ["Two prime numbers"],
  subtasks: [{
    rangeLabel: "Prime numbers", descriptionCID: "subtask-cid",
    objective: "Provide two prime numbers", acceptanceCriteria: ["Exactly two prime numbers"],
    reward: 0.03, leaseDuration: 7200,
  }],
};
const response = (value: unknown, ok = true) => Promise.resolve({ ok, json: async () => value });
const callsTo = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path));
async function generatePlan() {
  render(<BrowserRouter><CustomerDashboard /></BrowserRouter>);
  fireEvent.change(document.querySelector("#task-description")!, { target: { value: plan.masterTask } });
  fireEvent.change(document.querySelector("#task-budget")!, { target: { value: "0.03" } });
  fireEvent.click(screen.getByRole("button", { name: /request ai decomposition/i }));
  await screen.findByRole("dialog");
}
function confirmPlan() {
  fireEvent.click(screen.getByRole("button", { name: /confirm & fund project/i }));
}
async function expectCompleted() {
  await waitFor(() => expect(screen.queryByRole("button", { name: /review saved plan/i })).not.toBeInTheDocument());
  expect(screen.getByRole("tab", { name: /my projects/i })).toHaveAttribute("aria-selected", "true");
  expect(callsTo("/api/decompose")).toHaveLength(1);
}
beforeEach(() => {
  mocks.createTask.mockReset();
  mocks.getTransactionReceipt.mockReset();
  mocks.getNetwork.mockReset().mockResolvedValue({ chainId: BigInt(ETH_CHAIN_ID) });
  mocks.syncTaskTx.mockReset().mockResolvedValue(true);
  fetchMock.mockReset().mockImplementation((url: string) => {
    if (url.endsWith("/api/ipfs/upload")) return response({ cid: "brief-cid" });
    if (url.endsWith("/api/decompose")) return response(plan);
    if (url.endsWith("/api/decompose/respec")) return response({ cid: "edited-cid" });
    return response([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Retrying task funding", () => {
  it("retries wallet rejection with the reviewed plan and already pinned edits", async () => {
    mocks.createTask.mockRejectedValueOnce(new Error("User rejected the request"))
      .mockResolvedValueOnce({ hash: receipt.hash, wait: vi.fn().mockResolvedValue(receipt) });
    await generatePlan();
    fireEvent.change(screen.getByLabelText(/objective.*worker must produce/i), {
      target: { value: "Provide exactly two different prime numbers" },
    });
    confirmPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Retry transaction" }));
    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(2));
    await expectCompleted();
    expect(callsTo("/api/decompose/respec")).toHaveLength(1);
    expect(mocks.createTask.mock.calls[1]).toEqual(mocks.createTask.mock.calls[0]);
    expect(mocks.createTask.mock.calls[1][1][0].description).toBe("edited-cid");
  });
  it("preserves edits when the review is closed and reopened", async () => {
    await generatePlan();
    fireEvent.change(screen.getByLabelText(/objective.*worker must produce/i), {
      target: { value: "Edited objective to preserve" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Review saved plan" }));
    expect(screen.getByLabelText(/objective.*worker must produce/i)).toHaveValue("Edited objective to preserve");
    expect(callsTo("/api/decompose")).toHaveLength(1);
  });
  it("checks a submitted transaction after a timeout without sending another payment", async () => {
    mocks.createTask.mockResolvedValue({ hash: receipt.hash, wait: vi.fn().mockRejectedValue(new Error("RPC timeout")) });
    mocks.getTransactionReceipt.mockResolvedValueOnce(null).mockResolvedValueOnce(receipt);
    await generatePlan();
    confirmPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Check transaction status" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not confirmed yet"));
    expect(screen.getByRole("button", { name: /request ai decomposition/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Retry transaction" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check transaction status" }));
    await waitFor(() => expect(mocks.syncTaskTx).toHaveBeenCalledWith(receipt.hash));
    await expectCompleted();
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
  });
  it("permits another funding attempt after a confirmed revert", async () => {
    mocks.createTask.mockResolvedValueOnce({
      hash: receipt.hash,
      wait: vi.fn().mockRejectedValue(Object.assign(new Error("Execution reverted"), {
        receipt: { ...receipt, status: 0 },
      })),
    }).mockResolvedValueOnce({ hash: "0xretry", wait: vi.fn().mockResolvedValue({ hash: "0xretry", status: 1 }) });
    await generatePlan();
    confirmPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Retry transaction" }));
    await waitFor(() => expect(mocks.syncTaskTx).toHaveBeenCalledWith("0xretry"));
    await expectCompleted();
    expect(mocks.createTask).toHaveBeenCalledTimes(2);
  });
  it("retries indexing without paying again after successful funding", async () => {
    mocks.createTask.mockResolvedValue({ hash: receipt.hash, wait: vi.fn().mockResolvedValue(receipt) });
    mocks.syncTaskTx.mockRejectedValueOnce(new Error("Indexer unavailable")).mockResolvedValueOnce(true);
    await generatePlan();
    confirmPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Update project list" }));
    await waitFor(() => expect(mocks.syncTaskTx).toHaveBeenCalledTimes(2));
    await expectCompleted();
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
  });
  it("uses the replacement hash when the wallet speeds up a transaction", async () => {
    mocks.createTask.mockResolvedValue({
      hash: receipt.hash, wait: vi.fn().mockRejectedValue({
        code: "TRANSACTION_REPLACED", cancelled: false, receipt: { hash: "0xfaster", status: 1 },
      }),
    });
    await generatePlan();
    confirmPlan();
    await waitFor(() => expect(mocks.syncTaskTx).toHaveBeenCalledWith("0xfaster"));
    await expectCompleted();
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
  });
  it("retains edits if pinning fails before the wallet request", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/ipfs/upload")) return response({ cid: "brief-cid" });
      if (url.endsWith("/api/decompose")) return response(plan);
      if (url.endsWith("/api/decompose/respec")) return response({ error: "Pinning unavailable" }, false);
      return response([]);
    });
    await generatePlan();
    fireEvent.change(screen.getByLabelText(/objective.*worker must produce/i), {
      target: { value: "Edited objective after pin failure" },
    });
    confirmPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Review saved plan" }));
    expect(screen.getByLabelText(/objective.*worker must produce/i)).toHaveValue("Edited objective after pin failure");
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(callsTo("/api/decompose")).toHaveLength(1);
  });
});
