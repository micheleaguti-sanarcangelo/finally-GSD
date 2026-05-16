import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinAlly",
  description: "AI Trading Workstation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#0d1117]">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
