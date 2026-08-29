import { buildFlyerHtml, FlyerHtmlItem } from '../flyer-html.builder';

function item(overrides: Partial<FlyerHtmlItem> = {}): FlyerHtmlItem {
  return {
    sku: 'SKU-1',
    name: 'Widget',
    nameAr: 'ودجيت',
    imageUrl: 'https://backend.test/api/v1/uploads/co-1/widget.png',
    displayPrice: 9.99,
    originalPrice: 12.99,
    currency: 'QAR',
    ...overrides,
  };
}

describe('buildFlyerHtml', () => {
  it('renders one page when items fit within the grid size', () => {
    const { html, pageCount, overflowCount } = buildFlyerHtml({ title: 'Weekly Offers', grid: 4, items: [item(), item({ sku: 'SKU-2' })] });
    expect(pageCount).toBe(1);
    expect(overflowCount).toBe(0);
    expect(html).toContain('Weekly Offers');
    expect((html.match(/class="item"/g) ?? []).length).toBe(2);
  });

  it('paginates into multiple pages once items exceed one grid page', () => {
    const items = Array.from({ length: 9 }, (_, i) => item({ sku: `SKU-${i}` }));
    const { pageCount, overflowCount } = buildFlyerHtml({ title: 'T', grid: 4, items });
    expect(pageCount).toBe(3); // 9 items / 4 per page = 3 pages
    expect(overflowCount).toBe(0);
  });

  it('caps at MAX_PAGES and reports overflow instead of silently growing forever', () => {
    const items = Array.from({ length: 1000 }, (_, i) => item({ sku: `SKU-${i}` }));
    const { pageCount, overflowCount } = buildFlyerHtml({ title: 'T', grid: 4, items });
    expect(pageCount).toBe(10);
    expect(overflowCount).toBe(1000 - 4 * 10);
  });

  it('derives near-square columns from the grid size (ceil(sqrt(grid)))', () => {
    const { html } = buildFlyerHtml({ title: 'T', grid: 9, items: [item()] });
    expect(html).toContain('repeat(3, 1fr)');
  });

  it('escapes HTML-significant characters in user-controlled text', () => {
    const { html } = buildFlyerHtml({
      title: '<script>alert(1)</script>',
      grid: 4,
      items: [item({ name: '"><img onerror=alert(1)>' })],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img onerror=alert(1)>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops a javascript: URL rather than embedding it as an image src', () => {
    const { html } = buildFlyerHtml({ title: 'T', grid: 4, items: [item({ imageUrl: 'javascript:alert(1)' })] });
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).toContain('item-image-placeholder');
  });

  it('falls back to safe default colors when branding colors are not valid hex', () => {
    const { html } = buildFlyerHtml({
      title: 'T',
      grid: 4,
      items: [item()],
      branding: { colors: { primary: 'not-a-color; } body { display:none', secondary: '#111' } },
    });
    expect(html).toContain('#111827'); // default primary, malicious value rejected
    expect(html).toContain('#111'); // valid secondary hex accepted
  });

  it('shows the original price struck through only when it is actually higher than the display price', () => {
    const { html: withDiscount } = buildFlyerHtml({ title: 'T', grid: 4, items: [item({ displayPrice: 9.99, originalPrice: 12.99 })] });
    expect(withDiscount).toContain('price-original');

    const { html: withoutDiscount } = buildFlyerHtml({ title: 'T', grid: 4, items: [item({ displayPrice: 9.99, originalPrice: null })] });
    expect(withoutDiscount).not.toContain('<span class="price-original"');
  });
});
