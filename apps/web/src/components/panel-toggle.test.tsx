import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelToggle } from "./panel-toggle";

describe("PanelToggle", () => {
  it("exposes the controlled panel and current expanded state", () => {
    const onToggle = vi.fn();
    render(
      <PanelToggle controls="record-inspector" expanded label="inspector" onToggle={onToggle} />,
    );

    const toggle = screen.getByRole("button", { name: "Hide inspector" });
    expect(toggle).toHaveAttribute("aria-controls", "record-inspector");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
