import type { MetadataRoute } from "next";
import { getSiteAccessMode } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (getSiteAccessMode() !== "published_public") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/studio/"],
    },
  };
}
