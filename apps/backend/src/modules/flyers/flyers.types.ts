/** Number of catalog items per page — matches the legacy flyerai catalog
 *  builder's grid options exactly (near-square auto layout). */
export const GRID_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type GridOption = (typeof GRID_OPTIONS)[number];
export const DEFAULT_GRID: GridOption = 6;

/** Columns per row for a given grid size — mirrors flyerai's
 *  `Math.ceil(Math.sqrt(gridSize))` near-square layout exactly. */
export function gridColumns(grid: number): number {
  return Math.ceil(Math.sqrt(grid));
}

/** Fixed print page size, matching flyerai's catalog builder exactly. */
export const PAGE_WIDTH_MM = 150;
export const PAGE_HEIGHT_MM = 180;

/** Hard cap on paginated pages — matches flyerai's MAX_CATALOG_PAGES. */
export const MAX_PAGES = 10;

/**
 * Server-side shape for Flyer.designData — presentation/editor configuration
 * only (layout, branding). Deliberately does NOT mirror full Product
 * records: product placement/pricing lives in FlyerProduct, keyed by
 * productId, so the editor looks products up rather than duplicating their
 * data into this blob.
 *
 * Mirrors the legacy flyerai catalog builder's actual data model (a single
 * item-count-per-page grid, not per-row column arrays; per-flyer branding
 * with no company-level inheritance — confirmed empirically, flyerai has no
 * fallback link from Company.brandColors into a flyer's own branding).
 */
export interface FlyerDesignData {
  layout?: {
    grid?: GridOption;
  };
  branding?: {
    colors?: {
      primary?: string;
      secondary?: string;
    };
    logoUrl?: string;
    backgroundUrl?: string;
  };
  [key: string]: unknown;
}

/** Generous but bounded — the full designData blob, not counting flyer
 *  images/logos (those live in Asset storage and are referenced by id). */
export const MAX_DESIGN_DATA_BYTES = 256 * 1024;
