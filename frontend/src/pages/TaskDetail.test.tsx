import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TaskDetail from "./TaskDetail";
import { TASK_MANAGER_ADDRESS } from "../lib/constants";
const wallet = vi.hoisted(() => ({ account: "0xworker", taskManager: { attach: vi.fn(), releasePayout: vi.fn(), disputeTask: vi.fn(), workerBondAmount: vi.fn().mockResolvedValue(10000000000000000n) }, connectWallet: vi.fn(), currencySymbol: "ETH", networkName: "Test network" }));
vi.mock("../contexts/Web3Context", () => ({ useWeb3: () => wallet }));
const baseTask = { reward: "0.1", description: "", acceptanceCriteria: ["Cite primary sources"], deliverableFormat: "Markdown", leaseDuration: 3600 };
const project = { contractAddress: TASK_MANAGER_ADDRESS, taskId: "project-1", objective: "Protocol research", description: "A detailed project brief.", creator: "0xcreator", status: "ACTIVE", subtasks: [
 { ...baseTask, subtaskId: "failed", rangeLabel: "Failed verification", objective: "Provide two prime numbers", state: "VERIFICATION_FAILED", worker: "0xworker", qualityScore: 40, submissionContent: "4, 6", bondAmount: "0.001" },
 { ...baseTask, subtaskId: "open", rangeLabel: "Research", objective: "Research", state: "OPEN" },
 { ...baseTask, subtaskId: "claimed", rangeLabel: "Compare", objective: "Compare five protocols", state: "CLAIMED", worker: "0xworker" },
 { ...baseTask, subtaskId: "submitted", rangeLabel: "Review", objective: "Review the evidence", state: "SUBMITTED", submissionContent: "Submitted findings", submissionCID: "bafytest" },
 { ...baseTask, subtaskId: "verified", rangeLabel: "Deliver", objective: "Deliver the report", state: "VERIFIED", submissionContent: "Final findings", payoutTxHash: "0xpaid" },
] };
beforeEach(() => { wallet.account = "0xworker"; vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => project })); });
afterEach(() => vi.unstubAllGlobals());
const mount = () => render(<MemoryRouter initialEntries={["/task/project-1"]}><Routes><Route path="/task/:taskId" element={<TaskDetail />} /></Routes></MemoryRouter>);
async function openTask(name: RegExp) { const button = await screen.findByRole("button", { name }); fireEvent.click(button); return button; }
describe("Simplified project details", () => {
 it("starts with a compact list and opens only the selected task", async () => {
  mount();
  expect(await screen.findByRole("heading", { name: "Protocol research" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: /^(Research|Compare|Review|Deliver)/ })).not.toBeInTheDocument();
  const first = await openTask(/^Research/);
  expect(first).toHaveAttribute("aria-expanded", "true");
  expect(screen.getAllByRole("region", { name: /^(Research|Compare|Review|Deliver)/ })).toHaveLength(1);
  expect(within(screen.getByRole("region", { name: /^Research/ })).queryByText("Research", { exact: true })).not.toBeInTheDocument();
  const second = await openTask(/^Compare/);
  expect(first).toHaveAttribute("aria-expanded", "false");
  expect(screen.getAllByRole("region", { name: /^(Research|Compare|Review|Deliver)/ })).toHaveLength(1);
  fireEvent.click(second);
  expect(screen.queryByRole("region", { name: /^(Research|Compare|Review|Deliver)/ })).not.toBeInTheDocument();
 });
 it("keeps the claim review available without initiating a transaction", async () => {
  mount(); await openTask(/^Research/);
  fireEvent.click(screen.getByRole("button", { name: "Review & claim" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Required claim bond");
  expect(screen.getByRole("button", { name: /Continue in wallet/ })).toBeInTheDocument();
 });
 it("keeps a worker draft when switching between tasks", async () => {
  mount(); await openTask(/^Compare/);
  fireEvent.change(screen.getByLabelText("Your deliverable"), { target: { value: "My research draft" } });
  await openTask(/^Research/); await openTask(/^Compare/);
  expect(screen.getByLabelText("Your deliverable")).toHaveValue("My research draft");
  expect(screen.getByRole("button", { name: "Submit deliverable" })).toBeEnabled();
 });
 it("shows automatic verification, downloads and payment proof with the relevant task", async () => {
  mount(); await openTask(/^Review/);
  expect(screen.getByText(/orchestrator is checking it against the acceptance criteria/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  await openTask(/^Deliver/);
  expect(screen.getByText("Final findings")).toBeVisible();
  expect(screen.getByRole("link", { name: "View payment" })).toHaveAttribute("href", expect.stringContaining("/tx/0xpaid"));
 });
 it("does not show delayed payout controls on a verified task", async () => {
  mount(); await openTask(/^Deliver/);
  expect(screen.queryByRole("button", { name: "Release payout" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dispute submission" })).not.toBeInTheDocument();
  expect(screen.queryByText(/legacy contract/i)).not.toBeInTheDocument();
 });
});

describe("Worker verification appeals", () => {
 it("allows the submitting worker to appeal failed verification", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  wallet.taskManager.disputeTask.mockResolvedValue({ hash: "0xappeal", wait: vi.fn().mockResolvedValue({}) });
  mount(); await openTask(/^Failed verification/);
  expect(screen.getByRole("button", { name: "Dispute verification" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Dispute verification" }));
  await waitFor(() => expect(wallet.taskManager.disputeTask).toHaveBeenCalledWith("project-1", "failed"));
  expect(await screen.findByText(/awaiting administrator review/i)).toBeInTheDocument();
  vi.restoreAllMocks();
 });
 it("does not let the creator appeal the worker's failed verdict", async () => {
  wallet.account = "0xcreator";
  mount(); await openTask(/^Failed verification/);
  expect(screen.queryByRole("button", { name: "Dispute verification" })).not.toBeInTheDocument();
 });
 it("does not offer a dispute on a successfully paid subtask", async () => {
  mount(); await openTask(/^Deliver/);
  expect(screen.queryByRole("button", { name: /dispute/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Reward paid and bond returned/)).toBeInTheDocument();
 });
});

describe("Active deployment routing", () => {
 it("blocks a project returned from an older contract", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ ...project, contractAddress: "0x1111111111111111111111111111111111111111" }),
  }));
  wallet.taskManager.attach.mockClear();
  mount();
  expect(await screen.findByText(/This project is not on the active contract/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit deliverable" })).not.toBeInTheDocument();
  expect(wallet.taskManager.attach).not.toHaveBeenCalled();
 });
});
