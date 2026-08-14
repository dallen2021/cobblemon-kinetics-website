import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STUDIO_THEME_COOKIE } from "./studio-preferences";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = `${STUDIO_THEME_COOKIE}=; Path=/; Max-Age=0`;
});

describe("ThemeToggle", () => {
  it("announces the selected theme and persists a dark preference", () => {
    render(<ThemeToggle initialTheme="light" />);

    const light = screen.getByRole("button", { name: "Light" });
    const dark = screen.getByRole("button", { name: "Dark" });
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(dark);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(light).toHaveAttribute("aria-pressed", "false");
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(document.cookie).toContain(`${STUDIO_THEME_COOKIE}=dark`);
  });
});
