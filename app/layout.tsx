import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decide — Can't decide? Let fate do it.",
  description:
    "The ultimate random decision engine. Beautiful, interactive, and playful ways to make any choice.",
  applicationName: "Decide",
  keywords: [
    "decision",
    "random",
    "coin flip",
    "dice",
    "spin wheel",
    "picker",
    "generator",
  ],
  authors: [{ name: "Decide" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#04051f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <div id="app-root" className="relative min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
