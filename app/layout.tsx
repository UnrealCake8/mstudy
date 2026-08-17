import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MStudy", template: "%s · MStudy" },
  description: "Your school life, organised.",
  applicationName: "MStudy",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#146b46",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
