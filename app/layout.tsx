import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { MAdsTransitions } from "@/components/mads-transitions";
import { isFeatureEnabled } from "@/lib/feature-flags";
import "./globals.css";
import "./theme.css";
import "./mplace-brand.css";
import "./school-tools.css";
import "./ipad.css";
import "./student-life.css";
import "./practice-tools.css";

export const metadata: Metadata = {
  title: { default: "MPlace Study", template: "%s · MPlace Study" },
  description:
    "Homework, timetables, notes and Classroom assignments in one organised place.",
  applicationName: "MPlace Study",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1f24" },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mAdsEnabled = isFeatureEnabled("mAds");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {mAdsEnabled ? (
          <script
            src="https://ads.mplace.cc/sdk.js"
            data-site="site_5f427f89c2f9"
            async
          />
        ) : null}
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        {mAdsEnabled ? <MAdsTransitions /> : null}
      </body>
    </html>
  );
}
