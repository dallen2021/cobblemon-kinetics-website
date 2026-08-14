import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureSquirtleDraft } from "@/data/fixture";
import { saveSquirtleDraft } from "@/server/studio-actions";
import { SquirtleEditor } from "./squirtle-editor";

vi.mock("@/server/studio-actions", () => ({
  saveSquirtleDraft: vi.fn(),
  approveSquirtleDraft: vi.fn(),
  createSquirtlePublicationBatch: vi.fn(),
}));

const saveMock = vi.mocked(saveSquirtleDraft);

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

beforeEach(() => {
  saveMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SquirtleEditor", () => {
  it("renders the assignment, private boundary, and revision", () => {
    render(<SquirtleEditor initialRecord={fixtureSquirtleDraft} fixtureMode />);
    expect(screen.getByRole("heading", { name: "Squirtle" })).toBeVisible();
    expect(screen.getByText("Hydro Coupler")).toBeVisible();
    expect(screen.getByText(/Excluded from publication bundles/)).toBeVisible();
    expect(screen.getByText(/^Worker record · Revision 12$/)).toBeVisible();
    expect(screen.getByText("007")).toBeInTheDocument();
  });

  it("queues the latest edit and never overlaps autosave requests", async () => {
    vi.useFakeTimers();
    const first = deferred<Awaited<ReturnType<typeof saveSquirtleDraft>>>();
    saveMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(async (input) => ({
        ok: true,
        record: {
          ...fixtureSquirtleDraft,
          revision: 14,
          efficiency: input.efficiency,
          revisions: [
            {
              revision: 14,
              actor: "Fixture maintainer",
              at: "2026-08-14T18:00:00.000Z",
              summary: "Autosaved editor fields.",
            },
          ],
        },
      }));

    render(<SquirtleEditor initialRecord={fixtureSquirtleDraft} fixtureMode />);
    const efficiency = screen.getByLabelText(/Efficiency multiplier/);
    fireEvent.change(efficiency, { target: { value: "1.25" } });
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0]?.[0].expectedRevision).toBe(12);

    fireEvent.change(efficiency, { target: { value: "1.3" } });
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(saveMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({
        ok: true,
        record: {
          ...fixtureSquirtleDraft,
          revision: 13,
          efficiency: 1.25,
          revisions: [
            {
              revision: 13,
              actor: "Fixture maintainer",
              at: "2026-08-14T17:30:00.000Z",
              summary: "Autosaved editor fields.",
            },
          ],
        },
      });
      await first.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock.mock.calls[1]?.[0]).toMatchObject({
      expectedRevision: 13,
      efficiency: 1.3,
    });
  });
});
