"use client";

import { useState } from "react";
import { STUDIO_THEME_COOKIE, type StudioTheme } from "@/components/studio-preferences";

function persistTheme(theme: StudioTheme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${STUDIO_THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ThemeToggle({ initialTheme }: { initialTheme: StudioTheme }) {
  const [theme, setTheme] = useState(initialTheme);

  function chooseTheme(nextTheme: StudioTheme): void {
    setTheme(nextTheme);
    persistTheme(nextTheme);
  }

  return (
    <div className="studio-theme-toggle" role="group" aria-label="Color theme">
      <button type="button" aria-pressed={theme === "light"} onClick={() => chooseTheme("light")}>
        Light
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => chooseTheme("dark")}>
        Dark
      </button>
    </div>
  );
}
