import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ClaimTaskDialog } from "./ClaimTaskDialog";
const task = { subtaskId: "task-1", rangeLabel: "Research report", reward: "0.02", leaseDuration: 3600, deliverableFormat: "Markdown report", acceptanceCriteria: ["Cite three sources"] };
function setup(overrides = {}) {
  const callbacks = { onConfirm: vi.fn(), onClose: vi.fn(), onConnect: vi.fn() };
  render(<ClaimTaskDialog task={task} bond="0.001" currency="ETH" connected busy={false} {...callbacks} {...overrides} />);
  return callbacks;
}
describe("Claim review", () => {
  it("shows the commitment without initiating a transaction", () => {
    const {onConfirm} = setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("60 minutes after claiming")).toBeInTheDocument();
    expect(screen.getByText("Markdown report")).toBeInTheDocument();
    expect(screen.getByText("Required claim bond")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:/continue in wallet/i}));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it("requires the bond to be available before proceeding", () => {
    const {onConfirm} = setup({bond:null});
    expect(screen.getByRole("button",{name:/continue in wallet/i})).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("offers connection separately for a disconnected wallet", () => {
    const {onConnect,onConfirm} = setup({connected:false});
    fireEvent.click(screen.getByRole("button",{name:/connect wallet/i}));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("prevents repeated confirmation while a claim is pending", () => {
    setup({busy:true,message:"Waiting for confirmation"});
    expect(screen.getByRole("button",{name:/claim in progress/i})).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for confirmation");
  });
  it("allows returning to the task without claiming", () => {
    const {onClose,onConfirm} = setup();
    fireEvent.click(screen.getByRole("button",{name:/back to task/i}));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
