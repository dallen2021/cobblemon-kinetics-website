import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EfficiencyGauge, ItemSlot, StatusLamp, TypeChip } from "./ui";

describe("workshop primitives", () => {
  it("keeps statuses readable without color", () => {
    render(<StatusLamp tone="green" label="Authenticated" />);
    expect(screen.getByText("Authenticated")).toBeVisible();
  });

  it("labels type and machine information", () => {
    const { container } = render(
      <>
        <TypeChip type="Water" />
        <ItemSlot label="Hydro Coupler" registryId="cobblemon_kinetics:hydro_coupler" />
      </>,
    );
    expect(screen.getByText("Water")).toBeVisible();
    expect(screen.getByText("Hydro Coupler")).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });

  it("describes the efficiency value", () => {
    render(<EfficiencyGauge value={1.25} />);
    expect(screen.getByText("Efficiency multiplier 1.25")).toBeInTheDocument();
  });
});
