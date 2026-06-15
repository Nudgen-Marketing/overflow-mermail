import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clone Mail zkLogin",
  description: "A focused OAuth zkLogin submission demo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
