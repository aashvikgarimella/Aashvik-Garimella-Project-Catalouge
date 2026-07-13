import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. Notes:
// - script-src needs 'unsafe-inline' for the theme no-flash snippet in layout.tsx,
//   plus 'unsafe-eval' in dev for HMR.
// - img-src allows any https host: link-preview og:images legitimately come from anywhere.
// - connect-src: browser talks to Supabase (auth, PostgREST, storage uploads).
// - media-src: video attachments play from Supabase signed URLs.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  `media-src 'self' blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
