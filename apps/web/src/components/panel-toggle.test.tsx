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

  it("renders an accessible caret-only navigation control", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <PanelToggle
        appearance="caret"
        controls="studio-navigation"
        expanded
        label="navigation"
        onToggle={onToggle}
      />,
    );

    const collapse = screen.getByRole("button", { name: "Hide navigation" });
    expect(collapse).toHaveAttribute("aria-controls", "studio-navigation");
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(collapse).toHaveAttribute("data-direction", "collapse");
    expect(collapse).toHaveAttribute("title", "Hide navigation");
    expect(collapse).not.toHaveTextContent("Hide");
    expect(collapse.querySelector(".panel-toggle-arrow")).toHaveAttribute("aria-hidden", "true");

    rerender(
      <PanelToggle
        appearance="caret"
        controls="studio-navigation"
        expanded={false}
        label="navigation"
        onToggle={onToggle}
      />,
    );
    expect(screen.getByRole("button", { name: "Show navigation" })).toHaveAttribute(
      "data-direction",
      "expand",
    );
  });
});
