"use client";

import { MoonIcon, SunIcon } from "@/components/icons";

const THEME_STORAGE_KEY = "pliegoluz-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";

    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // El tema sigue activo durante la sesión aunque el navegador bloquee el almacenamiento.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar entre modo claro y oscuro"
      className="theme-toggle inline-flex h-12 items-center justify-center rounded-full border px-5 text-sm font-semibold transition"
    >
      <span className="theme-when-dark items-center gap-2"><SunIcon className="size-4" />Modo claro</span>
      <span className="theme-when-light items-center gap-2"><MoonIcon className="size-4" />Modo oscuro</span>
    </button>
  );
}
