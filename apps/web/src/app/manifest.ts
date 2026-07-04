import type { MetadataRoute } from "next";

import { PAPER, PRIMARY } from "@/lib/design-tokens";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PRIMARY,
    icons: [
      {
        src: "/logo-mark.png",
        sizes: "100x100",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-mark.png",
        sizes: "100x100",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
