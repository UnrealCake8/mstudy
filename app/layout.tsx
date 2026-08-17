import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MStudy",
  description: "Your school life, organised.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
