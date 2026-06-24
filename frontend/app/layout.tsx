import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmongSol",
  description: "Fix code. Find the traitor. Win SOL.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="app-world">{children}</div>
      </body>
    </html>
  );
}
