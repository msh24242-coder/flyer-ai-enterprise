const MAX_SLUG_LENGTH = 50;
const MIN_SLUG_LENGTH = 2;

/**
 * Normalizes a free-form name (e.g. a company name) into a URL/identifier-safe
 * slug: lowercase, hyphen-separated, [a-z0-9-] only, 2-50 chars.
 * Returns '' if the input has no usable alphanumeric characters at all
 * (e.g. all emoji/punctuation) — callers must handle that case explicitly
 * rather than silently persisting an empty or placeholder slug.
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

/**
 * Builds the Nth variant of a base slug for uniqueness retries, e.g.
 * buildSlugVariant('sh-marketing', 2) -> 'sh-marketing-2'. Truncates the
 * base so the result never exceeds the 50-char limit RegisterDto enforces.
 */
export function buildSlugVariant(baseSlug: string, attempt: number): string {
  if (attempt <= 1) return baseSlug;
  const suffix = `-${attempt}`;
  const maxBaseLength = MAX_SLUG_LENGTH - suffix.length;
  const truncatedBase = baseSlug.length > maxBaseLength ? baseSlug.slice(0, maxBaseLength) : baseSlug;
  return `${truncatedBase}${suffix}`;
}
