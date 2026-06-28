// Maps the backend crew color names ("green", "red", "blue", "yellow") to a
// vivid Among Sol palette plus the darker shade used for crewmate shadows and
// backpacks. Unknown names fall back to a neutral slate so the UI never breaks.

export interface CrewColor {
  name: string;
  base: string;
  shadow: string;
  glow: string;
  label: string;
}

const palette: Record<string, CrewColor> = {
  red: { name: "red", base: "#ff4655", shadow: "#a81d2c", glow: "#ff8a93", label: "Red" },
  blue: { name: "blue", base: "#3a7bff", shadow: "#1c43a8", glow: "#8fb4ff", label: "Blue" },
  green: { name: "green", base: "#28d96a", shadow: "#12863e", glow: "#86f5b2", label: "Green" },
  yellow: { name: "yellow", base: "#ffd23f", shadow: "#b88600", glow: "#ffe88f", label: "Yellow" },
  cyan: { name: "cyan", base: "#3fe0e0", shadow: "#138a8a", glow: "#9af6f6", label: "Cyan" },
  pink: { name: "pink", base: "#ff86c8", shadow: "#c23d8a", glow: "#ffc2e3", label: "Pink" },
  orange: { name: "orange", base: "#ff9f43", shadow: "#c25e0c", glow: "#ffc88c", label: "Orange" },
  purple: { name: "purple", base: "#a35bff", shadow: "#5e25a8", glow: "#cda3ff", label: "Purple" },
};

const fallback: CrewColor = {
  name: "slate",
  base: "#8a94c2",
  shadow: "#474f78",
  glow: "#c2c9ec",
  label: "Crew",
};

export function crewColor(name: string | undefined): CrewColor {
  if (!name) return fallback;
  return palette[name.toLowerCase()] ?? fallback;
}

export function crewBase(name: string | undefined): string {
  return crewColor(name).base;
}
