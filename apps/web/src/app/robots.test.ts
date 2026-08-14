import { afterEach, describe, expect, it } from "vitest";
import robots from "./robots";

const originalMode = process.env.SITE_ACCESS_MODE;

afterEach(() => {
  process.env.SITE_ACCESS_MODE = originalMode;
});

describe("crawler policy", () => {
  it.each([undefined, "private", "disabled"])("denies all crawling in %s mode", (mode) => {
    if (mode === undefined) {
      delete process.env.SITE_ACCESS_MODE;
    } else {
      process.env.SITE_ACCESS_MODE = mode;
    }

    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    });
  });

  it("keeps published wiki pages crawlable", () => {
    process.env.SITE_ACCESS_MODE = "published_public";

    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/studio/"],
      },
    });
  });
});
