import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  purpose: string;
};

type AppManifest = {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
  screenshots: { src: string; sizes: string; form_factor: string }[];
};

function publicPath(url: string): string {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

function pngSize(url: string): { width: number; height: number } {
  const png = readFileSync(publicPath(url));
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("PWA assets", () => {
  const manifest = JSON.parse(readFileSync(publicPath("/app.webmanifest"), "utf8")) as AppManifest;

  test("declares a stable standalone application identity", () => {
    expect(manifest).toMatchObject({
      id: "/app",
      name: "En passant",
      short_name: "En passant",
      start_url: "/app",
      scope: "/",
      display: "standalone",
      theme_color: "#09090b",
      background_color: "#09090b",
    });
  });

  test("ships install and maskable icons at their declared sizes", () => {
    expect(manifest.icons.map(({ sizes, purpose }) => ({ sizes, purpose }))).toEqual([
      { sizes: "192x192", purpose: "any" },
      { sizes: "512x512", purpose: "any" },
      { sizes: "512x512", purpose: "maskable" },
    ]);

    for (const icon of manifest.icons) {
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(pngSize(icon.src)).toEqual({ width, height });
    }
    expect(pngSize("/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });

  test("ships both wide and narrow richer-install screenshots", () => {
    expect(manifest.screenshots.map((screenshot) => screenshot.form_factor)).toEqual([
      "wide",
      "narrow",
    ]);
    for (const screenshot of manifest.screenshots) {
      const [width, height] = screenshot.sizes.split("x").map(Number);
      expect(pngSize(screenshot.src)).toEqual({ width, height });
    }
  });

  test("links the manifest and local install metadata without remote fonts", () => {
    const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('rel="manifest" href="/app.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
    expect(html).toContain('name="theme-color" content="#09090b"');
    expect(html).not.toContain("fonts.googleapis.com");
  });

  test("serves revalidated manifest metadata with its standard media type", () => {
    const headers = readFileSync(publicPath("/_headers"), "utf8");
    expect(headers).toContain("/app.webmanifest\n  Content-Type: application/manifest+json");
    expect(headers).toContain("Cache-Control: public, max-age=0, must-revalidate");
  });
});
