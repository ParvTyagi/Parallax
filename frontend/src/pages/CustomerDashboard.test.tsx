import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import CustomerDashboard from "./CustomerDashboard";

describe("CustomerDashboard", () => {
  it("renders the dashboard title", () => {
    render(
      <BrowserRouter>
        <CustomerDashboard />
      </BrowserRouter>
    );
    expect(screen.getByText(/Client Workspace/i)).toBeInTheDocument();
  });

  it("contains a form for task decomposition", () => {
    render(
      <BrowserRouter>
        <CustomerDashboard />
      </BrowserRouter>
    );

    const descriptionInput = screen.getByPlaceholderText(/Research the top 10 DeFi protocols/i);
    const budgetInput = screen.getByPlaceholderText("0.00");
    const submitButton = screen.getByRole("button", {
      name: /Connect Wallet to Post|Request AI Decomposition/i,
    });

    expect(descriptionInput).toBeInTheDocument();
    expect(budgetInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });
});



