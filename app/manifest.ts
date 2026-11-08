import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tracker",
    short_name: "Tracker",
    description: "Personal habit, task, goal and mood tracker",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f6f6f4",
    theme_color: "#2a78d6",
    orientation: "portrait",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "Dashboard", url: "/dashboard" },
      { name: "Journal", url: "/journal" },
    ],
  };
}
