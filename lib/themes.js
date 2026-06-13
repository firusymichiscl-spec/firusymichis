export const THEMES = {
  clasico:    { primary: "#FF6B35", secondary: "#2EC4B6", accent: "#FFD166" },
  canino:     { primary: "#7C5C3B", secondary: "#C49A6C", accent: "#F0DEC8" },
  felino:     { primary: "#534AB7", secondary: "#AFA9EC", accent: "#EEEDFE" },
  nocturno:   { primary: "#E94560", secondary: "#0F3460", accent: "#1a1a2e" },
  primavera:  { primary: "#D4537E", secondary: "#F4C0D1", accent: "#FFF0F5" },
  bosque:     { primary: "#2D6A4F", secondary: "#74C69D", accent: "#D8F3DC" },
  conejito:   { primary: "#BA7517", secondary: "#EF9F27", accent: "#FAEEDA" },
  oceano:     { primary: "#185FA5", secondary: "#85B7EB", accent: "#E6F1FB" },
};

export const CUSTOM_COLORS = [
  "#E53E3E", "#DD6B20", "#D69E2E", "#38A169",
  "#319795", "#3182CE", "#805AD5", "#D53F8C",
  "#718096", "#2D3748",
];

export function getThemeVars(theme, customColor) {
  if (theme === "custom" && customColor) {
    return {
      "--color-primary": customColor,
      "--color-secondary": customColor + "99",
      "--color-accent": customColor + "22",
    };
  }
  const t = THEMES[theme] || THEMES.clasico;
  return {
    "--color-primary": t.primary,
    "--color-secondary": t.secondary,
    "--color-accent": t.accent,
  };
}
