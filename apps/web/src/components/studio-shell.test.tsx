import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_LEFT_PANEL_COOKIE, STUDIO_RIGHT_PANEL_COOKIE } from "./studio-preferences";
import { StudioShell } from "./studio-shell";

const route = vi.hoisted(() => ({ pathname: "/studio/pokemon/squirtle" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

const member = {
  authUserId: "00000000-0000-4000-8000-000000000007",
  githubLogin: "fixture-maintainer",
  displayName: "Fixture maintainer",
  role: "maintainer" as const,
  fixture: true,
};

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderShell() {
  return render(
    <StudioShell
      member={member}
      initialTheme="light"
      initialLeftCollapsed={false}
      initialRightCollapsed={false}
    >
      <div>Editor workspace</div>
    </StudioShell>,
  );
}

describe("StudioShell", () => {
  beforeEach(() => {
    installMatchMedia(false);
    document.cookie = `${STUDIO_LEFT_PANEL_COOKIE}=; Path=/; Max-Age=0`;
    document.cookie = `${STUDIO_RIGHT_PANEL_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("persists desktop panel preferences and marks the active route", () => {
    const { container } = renderShell();
    const shell = container.querySelector(".studio-shell");
    const sidebar = screen.getByRole("complementary");
    const heading = container.querySelector(".studio-sidebar-heading");

    expect(screen.getByRole("link", { name: "Pokémon" })).toHaveAttribute("aria-current", "page");
    expect(heading).toContainElement(
      within(sidebar).getByRole("button", { name: "Hide navigation" }),
    );
    expect(within(sidebar).getByText("Development studio")).toBeInTheDocument();
    expect(sidebar.querySelector(".studio-brand-mark")).toHaveAttribute("width", "124");

    fireEvent.click(within(sidebar).getByRole("button", { name: "Hide navigation" }));
    expect(shell).toHaveAttribute("data-left-collapsed", "true");
    expect(document.cookie).toContain(`${STUDIO_LEFT_PANEL_COOKIE}=collapsed`);
    expect(within(sidebar).getByRole("button", { name: "Show navigation" })).toBeInTheDocument();
    expect(sidebar.querySelector(".studio-brand-mark")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide inspector" }));
    expect(shell).toHaveAttribute("data-right-collapsed", "true");
    expect(document.cookie).toContain(`${STUDIO_RIGHT_PANEL_COOKIE}=collapsed`);
  });

  it("uses a dismissible navigation drawer at compact widths", async () => {
    installMatchMedia(true);
    const { container } = renderShell();
    const shell = container.querySelector(".studio-shell");
    const launchers = screen.getAllByRole("button", { name: "Show navigation" });
    const toolbarLauncher = launchers.at(-1);
    expect(toolbarLauncher).toBeDefined();

    fireEvent.click(toolbarLauncher!);
    expect(shell).toHaveAttribute("data-mobile-left-open", "true");
    expect(screen.getByRole("button", { name: "Close open panel" })).toBeInTheDocument();

    const sidebar = container.querySelector<HTMLElement>(".studio-sidebar");
    expect(sidebar).not.toBeNull();
    fireEvent.click(within(sidebar!).getByRole("button", { name: "Hide navigation" }));
    expect(shell).toHaveAttribute("data-mobile-left-open", "false");
    expect(toolbarLauncher).toHaveFocus();

    fireEvent.click(toolbarLauncher!);
    expect(shell).toHaveAttribute("data-mobile-left-open", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(shell).toHaveAttribute("data-mobile-left-open", "false");
    expect(toolbarLauncher).toHaveFocus();

    const inspectorLauncher = container.querySelector<HTMLButtonElement>(
      ".studio-inspector-toggle",
    );
    expect(inspectorLauncher).not.toBeNull();
    fireEvent.click(inspectorLauncher!);
    expect(shell).toHaveAttribute("data-mobile-right-open", "true");

    const inspectorClose = container.querySelector<HTMLButtonElement>(
      ".studio-mobile-inspector-close",
    );
    expect(inspectorClose).not.toBeNull();
    fireEvent.click(inspectorClose!);
    expect(shell).toHaveAttribute("data-mobile-right-open", "false");
    expect(inspectorLauncher).toHaveFocus();

    fireEvent.click(inspectorLauncher!);
    fireEvent.click(screen.getByRole("button", { name: "Close open panel" }));
    await waitFor(() => expect(inspectorLauncher).toHaveFocus());
  });
});
