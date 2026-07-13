import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "lynx",
  description:
    "lynx — notes, links, tasks, and reminders synced across every device.",
  manifest: "/manifest.webmanifest",
  applicationName: "lynx",
  appleWebApp: {
    capable: true,
    title: "lynx",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#e8772e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before first paint to avoid a flash of the wrong theme.
const noFlashScript = `(function(){try{var m=localStorage.getItem('pkm-mode')||'default';var t=m==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;var r=document.documentElement;r.setAttribute('data-theme',t);r.setAttribute('data-accent',localStorage.getItem('pkm-accent')||'orange');var c=localStorage.getItem('pkm-accent-custom');if(c)r.style.setProperty('--accent',c);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
