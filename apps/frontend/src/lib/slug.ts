const MAX_SLUG_LENGTH = 50;
const MIN_SLUG_LENGTH = 2;

/**
 * Normalizes a free-form name (e.g. a company name) into a URL/identifier-safe
 * slug: lowercase, hyphen-separated, [a-z0-9-] only, 2-50 chars. Mirrors
 * apps/backend/src/common/utils/slug.ts's slugify() — kept in sync by hand
 * since frontend and backend don't currently share a runtime package.
 * Returns '' if the input has no usable alphanumeric characters at all
 * (e.g. all emoji/punctuation) — callers must handle that explicitly.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return slug.length >= MIN_SLUG_LENGTH ? slug : '';
}
