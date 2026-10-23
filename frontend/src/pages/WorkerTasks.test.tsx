import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkerTasks from "./WorkerTasks";
vi.mock("../contexts/Web3Context", () => ({ useWeb3: () => ({ account: null, connectWallet: vi.fn(), currencySymbol: "ETH" }) }));
const task = { subtaskId: "task-1", taskId: "project-1", objective: "Research protocol security", reward: "0.1", state: "OPEN", skills: ["Research"] };
beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [task] })));
afterEach(() => vi.unstubAllGlobals());
const mount = () => render(<MemoryRouter><WorkerTasks /></MemoryRouter>);
describe("Marketplace navigation and recovery", () => {
 it("supports arrow-key tab navigation and exposes the selected panel", async () => {
  mount();
  const available = await screen.findByRole("tab", { name: /Available Tasks/ });
  available.focus();
  fireEvent.keyDown(available, { key: "ArrowRight" });
  const active = screen.getByRole("tab", { name: /Active Claims/ });
  await waitFor(() => expect(active).toHaveFocus());
  await waitFor(() => expect(active).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Connect your wallet");
 });
 it("restores opportunities when a search is cleared", async () => {
  mount();
  const search = await screen.findByRole("searchbox");
  fireEvent.change(search, { target: { value: "no-match" } });
  expect(screen.getByText("No matching tasks")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByRole("heading", { name: "Research protocol security" })).toBeInTheDocument();
 });
 it("shows failed requests as errors and retries them", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  mount();
  expect(await screen.findByRole("heading", { name: "Marketplace unavailable" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Research protocol security" })).toBeInTheDocument();
 });
});
