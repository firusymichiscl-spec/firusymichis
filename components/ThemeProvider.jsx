"use client";
import { useEffect } from "react";
import { getThemeVars } from "@/lib/themes";

export default function ThemeProvider({ theme, customColor, children }) {
  useEffect(() => {
    const vars = getThemeVars(theme, customColor);
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (theme === "nocturno") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, customColor]);

  return children;
}
