/*
 * Every brand image path in one place. All of them are drawn by referensi/tools/make-brand.mjs (no owner artwork yet:
 * the owner asked for generated art first). Replace a file at the same path, or change a path here, without touching components.
 */
export const ASSETS = {
  /** Square mark on its dark plate (header, footer, avatars). */
  mark: "/brand/mark.webp",
  /** Large emblem card for the hero and the risk band. */
  emblem: "/brand/emblem.webp",
  /** Wide banner, 1500x500 (X header, token page). */
  banner: "/brand/banner.webp",
  /** Square PNG served by Next from src/app/icon.png (structured data needs a PNG logo). */
  icon: "/icon.png",
  logoPng: "/icon.png",
  /** Share card served from src/app/opengraph-image.jpg; twitter-image.jpg is the same image. */
  og: "/opengraph-image.jpg",
} as const;
