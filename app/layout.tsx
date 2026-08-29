import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { MAdsTransitions } from "@/components/mads-transitions";
import "./globals.css";
import "./theme.css";
import "./mplace-brand.css";
import "./school-tools.css";
import "./ipad.css";

export const metadata: Metadata = {
  title: { default: "MPlace Study", template: "%s · MPlace Study" },
  description: "MPlace Study keeps school life organised with homework, notes, timetables, Classroom, and study tools.",
  applicationName: "MPlace Study",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script src="https://ads.mplace.cc/sdk.js" data-site="site_5f427f89c2f9" async />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <MAdsTransitions />
      </body>
    </html>
  );
}
