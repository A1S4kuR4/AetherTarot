import type { Viewport } from "next";
import type { ReactNode } from "react";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0B0D12",
};

export default function RitualLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
