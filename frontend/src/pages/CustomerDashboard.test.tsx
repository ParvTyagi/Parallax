import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomerDashboard from "./CustomerDashboard";

describe("CustomerDashboard", () => {
  it("renders the dashboard title", () => {
    render(<CustomerDashboard />);
    expect(screen.getByText("Customer Dashboard")).toBeInTheDocument();
  });

  it("contains a form for task decomposition", () => {
    render(<CustomerDashboard />);
    
    const descriptionInput = screen.getByPlaceholderText("Job Description");
    const budgetInput = screen.getByPlaceholderText("Budget (MON)");
    const decomposeButton = screen.getByText("Request AI Decomposition");

    expect(descriptionInput).toBeInTheDocument();
    expect(budgetInput).toBeInTheDocument();
    expect(decomposeButton).toBeInTheDocument();
  });
});
