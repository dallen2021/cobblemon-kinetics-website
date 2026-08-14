export type StudioTheme = "light" | "dark";

export const STUDIO_THEME_COOKIE = "cobblemon-kinetics-theme";
export const STUDIO_LEFT_PANEL_COOKIE = "cobblemon-kinetics-left-panel";
export const STUDIO_RIGHT_PANEL_COOKIE = "cobblemon-kinetics-right-panel";

export function parseStudioTheme(value: string | null | undefined): StudioTheme {
  return value === "dark" ? "dark" : "light";
}

export function parsePanelCollapsed(value: string | null | undefined): boolean {
  return value === "collapsed";
}
