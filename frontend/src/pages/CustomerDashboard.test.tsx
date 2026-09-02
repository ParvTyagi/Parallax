import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import CustomerDashboard from "./CustomerDashboard";

const web3 = vi.hoisted(() => ({
  account: null as string | null,
  balance: null as string | null,
  taskManager: null,
  connectWallet: vi.fn(),
}));

vi.mock("../contexts/Web3Context", () => ({
  useWeb3: () => web3,
}));

const renderDashboard = () =>
  render(
    <BrowserRouter>
      <CustomerDashboard />
    </BrowserRouter>
  );

const typeInto = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

// Queried by id: the visible label text also appears elsewhere on the page, so
// getByLabelText matches more than one node.
const description = () => document.querySelector("#task-description") as HTMLTextAreaElement;
const budget = () => document.querySelector("#task-budget") as HTMLInputElement;

beforeEach(() => {
  web3.account = null;
  web3.balance = null;
  // The dashboard polls for the connected wallet's tasks on mount.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CustomerDashboard", () => {
  it("renders the dashboard title", () => {
    renderDashboard();
    expect(screen.getByText(/Client Workspace/i)).toBeInTheDocument();
  });

  it("contains a form for task decomposition", () => {
    renderDashboard();
    expect(description()).toBeInTheDocument();
    expect(budget()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect Wallet to Post|Request AI Decomposition/i })
    ).toBeInTheDocument();
  });
});

describe("CustomerDashboard tabs", () => {
  it("exposes the workspace tabs with selection state", () => {
    renderDashboard();
    const tablist = screen.getByRole("tablist", { name: /client workspace/i });
    const tabs = within(tablist).getAllByRole("tab");

    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs[0].id);
  });

  it("moves between tabs with the arrow keys", () => {
    renderDashboard();
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });

    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  });
});

describe("CustomerDashboard create-task validation", () => {
  beforeEach(() => {
    web3.account = "0xabc0000000000000000000000000000000000001";
    web3.balance = "5.0";
  });

  it("explains a zero budget instead of doing nothing", () => {
    // The submit handler used to `return` silently here, so the button looked broken.
    renderDashboard();
    typeInto(description(), "Research the top 5 lending protocols on Monad and compare fees.");
    typeInto(budget(), "0");

    const submit = screen.getByRole("button", { name: /request ai decomposition/i });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(screen.getByRole("alert")).toHaveTextContent(/greater than 0 MON/i);
  });

  it("says what is missing while the form is incomplete", () => {
    renderDashboard();
    expect(screen.getByText(/add a job description first/i)).toBeInTheDocument();

    typeInto(description(), "Research the top 5 lending protocols on Monad and compare fees.");
    expect(screen.getByText(/set a budget in mon/i)).toBeInTheDocument();
  });

  it("confirms nothing is spent yet once the form is valid", () => {
    renderDashboard();
    typeInto(description(), "Research the top 5 lending protocols on Monad and compare fees.");
    typeInto(budget(), "3");

    expect(screen.getByText(/nothing is spent yet/i)).toBeInTheDocument();
  });

  it("projects the per-subtask reward from the budget", () => {
    renderDashboard();
    typeInto(budget(), "15");

    expect(screen.getByText(/3–5 subtasks/)).toHaveTextContent("3.00–5.00 MON each");
  });

  it("warns when the budget exceeds the wallet balance", () => {
    renderDashboard();
    typeInto(budget(), "12");

    expect(screen.getByText(/more than your 5.0 MON balance/i)).toBeInTheDocument();
  });

  it("does not warn when the budget fits the balance", () => {
    renderDashboard();
    typeInto(budget(), "2");

    expect(screen.queryByText(/more than your/i)).not.toBeInTheDocument();
  });

  it("nudges the creator when the brief is too thin to decompose well", () => {
    renderDashboard();
    typeInto(description(), "do research");

    expect(screen.getByText(/this brief is short/i)).toBeInTheDocument();
  });

  it("drops the nudge once the brief carries real scope", () => {
    renderDashboard();
    typeInto(
      description(),
      "Research the top 10 DeFi lending protocols on Monad by TVL, compare their fee " +
        "structures and liquidation parameters, and deliver a summary table with sources."
    );

    expect(screen.queryByText(/this brief is short/i)).not.toBeInTheDocument();
  });
});
