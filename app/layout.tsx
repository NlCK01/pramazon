import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix Triage",
  description:
    "A veterinary genomics research console for evidence retrieval, NVIDIA BioNeMo model routing, and gated sequence review.",
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
