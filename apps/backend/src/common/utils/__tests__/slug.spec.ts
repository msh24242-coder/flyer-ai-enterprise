import { slugify, buildSlugVariant } from '../slug';

describe('slugify', () => {
  it('converts a simple two-word name', () => {
    expect(slugify('SH Marketing')).toBe('sh-marketing');
  });

  it('converts a longer multi-word name', () => {
    expect(slugify('ABC Retail Qatar')).toBe('abc-retail-qatar');
  });

  it('converts another multi-word name', () => {
    expect(slugify('SPAR Qatar')).toBe('spar-qatar');
  });

  it('collapses multiple consecutive spaces into a single hyphen', () => {
    expect(slugify('Acme    Inc')).toBe('acme-inc');
  });

  it('collapses mixed whitespace/hyphen separators', () => {
    expect(slugify('Acme - Inc')).toBe('acme-inc');
  });

  it('strips symbols and punctuation, collapsing them into hyphens', () => {
    expect(slugify("Bob's Bagels & Co.")).toBe('bob-s-bagels-co');
  });

  it('lowercases uppercase letters', () => {
    expect(slugify('ACME CORP')).toBe('acme-corp');
  });

  it('trims leading and trailing whitespace before slugifying', () => {
    expect(slugify('  Acme Corp  ')).toBe('acme-corp');
  });

  it('truncates long names to 50 characters without a trailing hyphen', () => {
    const longName = 'A'.repeat(60) + ' Marketing Solutions International Holdings';
    const slug = slugify(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.startsWith('a'.repeat(50).slice(0, 10))).toBe(true);
  });

  it('returns an empty string for a name with no usable characters', () => {
    expect(slugify('🎉🎊')).toBe('');
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('returns an empty string when the only alphanumeric content is a single character', () => {
    expect(slugify('A')).toBe('');
  });

  it('allows numbers in the name', () => {
    expect(slugify('7-Eleven Franchise 2024')).toBe('7-eleven-franchise-2024');
  });
});

describe('buildSlugVariant', () => {
  it('returns the base slug unchanged for attempt 1', () => {
    expect(buildSlugVariant('sh-marketing', 1)).toBe('sh-marketing');
  });

  it('appends -2 for the second attempt', () => {
    expect(buildSlugVariant('sh-marketing', 2)).toBe('sh-marketing-2');
  });

  it('appends -3 for the third attempt', () => {
    expect(buildSlugVariant('sh-marketing', 3)).toBe('sh-marketing-3');
  });

  it('truncates the base slug so the variant never exceeds 50 characters', () => {
    const base = 'a'.repeat(50);
    const variant = buildSlugVariant(base, 2);
    expect(variant.length).toBeLessThanOrEqual(50);
    expect(variant.endsWith('-2')).toBe(true);
  });
});
