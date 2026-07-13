import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lynx",
    short_name: "lynx",
    description:
      "lynx — notes, links, tasks, and reminders synced across every device.",
    start_url: "/notes",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1e7",
    theme_color: "#e8772e",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
