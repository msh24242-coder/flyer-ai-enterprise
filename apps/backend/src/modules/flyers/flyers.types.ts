/**
 * Server-side shape for Flyer.designData — presentation/editor configuration
 * only (layout, branding, header/footer visibility). Deliberately does NOT
 * mirror full Product records: product placement/pricing lives in
 * FlyerProduct, keyed by productId, so the editor (Phase 3) looks products
 * up rather than duplicating their data into this blob.
 *
 * Kept loose (index signature) rather than strictly closed: the editor's
 * exact shape isn't finalized yet (Phase 3), and this type exists now only
 * to give the DTO/service something concrete to validate size/structure
 * against without prematurely locking in a schema that Phase 3 would then
 * have to migrate away from.
 */
export interface FlyerDesignData {
  layout?: number[];
  branding?: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    logoAssetId?: string;
  };
  header?: {
    title?: string;
    showLogo?: boolean;
  };
  footer?: {
    showBranches?: boolean;
    showSocial?: boolean;
    showDate?: boolean;
  };
  priceStyle?: string;
  [key: string]: unknown;
}

/** Generous but bounded — the full designData blob, not counting flyer
 *  images/logos (those live in Asset storage and are referenced by id). */
export const MAX_DESIGN_DATA_BYTES = 256 * 1024;
