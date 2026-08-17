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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

const themeScript = `
(function(){
  try {
    var saved = localStorage.getItem('mstudy-theme');
    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
