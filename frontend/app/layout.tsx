import type { Metadata, Viewport } from "next";
import "./globals.css";
import AudioControls from "@/components/AudioControls";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description =
  "AmongSol is a real-time multiplayer social-deduction coding game. Repair Rust and Solana contracts together, expose the impostor sabotaging the code, and win the on-chain SOL pot.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AmongSol - On-chain social deduction",
    template: "%s | AmongSol",
  },
  description,
  applicationName: "AmongSol",
  keywords: ["AmongSol", "Solana", "social deduction", "coding game", "Rust", "Anchor", "web3 game", "on-chain"],
  authors: [{ name: "AmongSol" }],
  openGraph: {
    type: "website",
    siteName: "AmongSol",
    title: "AmongSol - On-chain social deduction",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "AmongSol - On-chain social deduction",
    description,
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#04060f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
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
