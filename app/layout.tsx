import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pramazon",
  description:
    "A cancer-only protein research marketplace for AI protein summaries, NIH iCn3D structure preview, and gated sequence review.",
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
      <body>{children}</body>
    </html>
  );
}
