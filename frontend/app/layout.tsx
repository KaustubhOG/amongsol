import type { Metadata } from "next";
import "./globals.css";
import AudioControls from "@/components/AudioControls";

export const metadata: Metadata = {
  title: "AmongSol",
  description: "Fix the contract. Find the impostor. Win the pot.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="starfield" aria-hidden>
          <span className="layer-1" />
          <span className="layer-2" />
          <span className="layer-3" />
        </div>
        <div className="app-world">{children}</div>
        <AudioControls />
      </body>
    </html>
  );
}
