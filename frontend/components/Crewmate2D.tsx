import { crewColor } from "@/lib/colors";

interface Crewmate2DProps {
  color: string;
  size?: number;
  className?: string;
  dimmed?: boolean;
  facing?: "left" | "right";
}

// A crisp vector crewmate used for avatars and lists. Colored from the shared
// crew palette so it always matches the 3D stage.
export default function Crewmate2D({
  color,
  size = 48,
  className,
  dimmed = false,
  facing = "right",
}: Crewmate2DProps) {
  const crew = crewColor(color);
  const flip = facing === "left" ? "scale(-1,1) translate(-100,0)" : undefined;

  return (
    <svg
      viewBox="0 0 100 124"
      width={size}
      height={size * 1.24}
      className={className}
      style={{ opacity: dimmed ? 0.45 : 1, overflow: "visible" }}
      role="img"
      aria-label={`${crew.label} crewmate`}
    >
      <g transform={flip}>
        <rect x="9" y="46" width="22" height="44" rx="11" fill={crew.shadow} />
        <rect x="33" y="90" width="15" height="26" rx="7.5" fill={crew.base} />
        <rect x="52" y="90" width="15" height="26" rx="7.5" fill={crew.base} />
        <path
          d="M26 54 C26 26 76 26 76 54 L76 92 C76 104 66 110 58 110 L42 110 C32 110 26 104 26 92 Z"
          fill={crew.base}
        />
        <path
          d="M26 54 C26 40 30 30 40 27 C30 34 30 48 30 60 L30 92 C30 100 34 105 41 108 C32 108 26 102 26 92 Z"
          fill={crew.shadow}
          opacity="0.45"
        />
        <ellipse cx="57" cy="50" rx="21" ry="13.5" fill="#7fc6ff" />
        <ellipse cx="57" cy="50" rx="17.5" ry="10.5" fill="#bfe9ff" />
        <ellipse cx="50" cy="45" rx="4.5" ry="2.8" fill="#ffffff" opacity="0.95" />
      </g>
    </svg>
  );
}
