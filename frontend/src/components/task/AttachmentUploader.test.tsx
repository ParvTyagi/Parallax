import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AttachmentUploader, formatBytes } from "./AttachmentUploader";

/// A fixed mtime, because file identity is name + size + lastModified. Real
/// browsers report the file's own mtime, so re-picking one file off disk yields
/// an identical key; `new File()` would otherwise stamp Date.now() each call and
/// make two constructions of the same file look like different files.
const makeFile = (name: string, body = "col_a,col_b\n1,2\n") =>
  new File([body], name, { type: "text/csv", lastModified: 1700000000000 });

/// The visible "Choose files" target is a <label> wrapping the input, so the
/// input itself is what a test (and a keyboard user) interacts with.
const filePicker = () =>
  document.querySelector('input[type="file"]:not([aria-hidden="true"])') as HTMLInputElement;

const pick = (input: HTMLInputElement, files: File[]) =>
  fireEvent.change(input, { target: { files } });

const renderUploader = () => {
  const onChange = vi.fn();
  const utils = render(<AttachmentUploader attachment={null} onChange={onChange} />);
  return { ...utils, onChange };
};

describe("formatBytes", () => {
  it("scales units and keeps whole bytes unfractioned", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("AttachmentUploader staging", () => {
  it("stages a chosen file and lists it", () => {
    renderUploader();
    pick(filePicker(), [makeFile("data.csv")]);

    expect(screen.getByText("data.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove data\.csv from the upload/i })).toBeInTheDocument();
  });

  it("removes a staged file and returns to the picker", () => {
    renderUploader();
    pick(filePicker(), [makeFile("data.csv")]);

    fireEvent.click(screen.getByRole("button", { name: /remove data\.csv from the upload/i }));

    expect(screen.queryByText("data.csv")).not.toBeInTheDocument();
    expect(screen.getByText(/choose files/i)).toBeInTheDocument();
  });

  it("re-stages the same file after it was removed", () => {
    // A file input keeps its value, so without an explicit reset the second pick
    // fires no change event and the picker looks broken.
    renderUploader();
    pick(filePicker(), [makeFile("data.csv")]);
    fireEvent.click(screen.getByRole("button", { name: /remove data\.csv from the upload/i }));

    pick(filePicker(), [makeFile("data.csv")]);

    expect(screen.getByText("data.csv")).toBeInTheDocument();
  });

  it("clears the input value after each pick so the same file can be re-chosen", () => {
    renderUploader();
    const input = filePicker();
    pick(input, [makeFile("data.csv")]);
    expect(input.value).toBe("");
  });

  it("skips duplicates and says so instead of silently ignoring them", () => {
    renderUploader();
    pick(filePicker(), [makeFile("data.csv")]);

    const addMore = screen.getByRole("button", { name: /add more/i });
    const hidden = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
    expect(addMore).toBeInTheDocument();
    pick(hidden, [makeFile("data.csv")]);

    expect(screen.getByRole("alert")).toHaveTextContent(/already in the list/i);
    expect(screen.getAllByText("data.csv")).toHaveLength(1);
  });

  it("clears every staged file at once", () => {
    renderUploader();
    pick(filePicker(), [makeFile("a.csv"), makeFile("b.csv")]);
    expect(screen.getByText("a.csv")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(screen.queryByText("a.csv")).not.toBeInTheDocument();
    expect(screen.getByText(/choose files/i)).toBeInTheDocument();
  });

  it("accepts files dropped onto the zone", () => {
    const { container } = renderUploader();
    const zone = container.firstChild as HTMLElement;

    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("dropped.csv")] } });

    expect(screen.getByText("dropped.csv")).toBeInTheDocument();
  });
});

describe("AttachmentUploader accessibility", () => {
  it("keeps the file inputs reachable by keyboard", () => {
    renderUploader();
    // display:none would remove them from the tab order entirely.
    for (const input of Array.from(document.querySelectorAll('input[type="file"]'))) {
      expect(input).not.toHaveClass("hidden");
    }
    expect(filePicker()).not.toHaveAttribute("tabindex", "-1");
  });

  it("announces staged state politely", () => {
    renderUploader();
    pick(filePicker(), [makeFile("data.csv")]);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/1 file ready to upload/i);
  });

  it("names the remove control on an uploaded attachment", () => {
    const onChange = vi.fn();
    render(
      <AttachmentUploader
        attachment={{
          cid: "QmAbc",
          filename: "corpus.zip",
          mimetype: "application/zip",
          size: 1024,
          isArchive: true,
          entryCount: 3,
        }}
        onChange={onChange}
      />
    );

    const remove = screen.getByRole("button", { name: /remove attachment corpus\.zip/i });
    fireEvent.click(remove);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("disables the pickers while the parent form is busy", () => {
    render(<AttachmentUploader attachment={null} onChange={vi.fn()} disabled />);
    for (const input of Array.from(document.querySelectorAll('input[type="file"]'))) {
      expect(input).toBeDisabled();
    }
  });

  it("labels each staged row's remove button with the file it removes", () => {
    renderUploader();
    pick(filePicker(), [makeFile("a.csv"), makeFile("b.csv")]);

    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("button", { name: /remove a\.csv/i })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: /remove b\.csv/i })).toBeInTheDocument();
  });
});
