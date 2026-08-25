import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fableroom 3D",
  description: "Explore the hand-carved wooden cabinet in an interactive 360-degree 3D viewer with zoom, pan and opening doors.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
