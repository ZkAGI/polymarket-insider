import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polymarket Tracker",
  description:
    "Track and analyze whale trades and insider activity on Polymarket prediction markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
