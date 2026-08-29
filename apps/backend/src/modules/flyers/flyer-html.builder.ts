import { DEFAULT_GRID, GridOption, MAX_PAGES, PAGE_HEIGHT_MM, PAGE_WIDTH_MM, gridColumns } from './flyers.types';

export interface FlyerHtmlItem {
  sku: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  displayPrice: number;
  originalPrice?: number | null;
  currency: string;
}

export interface FlyerHtmlBranding {
  colors?: { primary?: string; secondary?: string };
  logoUrl?: string;
  backgroundUrl?: string;
}

export interface BuildFlyerHtmlParams {
  title: string;
  items: FlyerHtmlItem[];
  grid?: GridOption;
  branding?: FlyerHtmlBranding;
}

export interface BuildFlyerHtmlResult {
  html: string;
  pageCount: number;
  overflowCount: number;
}

/** Only ever embed http(s) URLs that came from our own asset storage — never
 *  interpolate a raw user-supplied URL scheme (blocks `javascript:`/`data:`
 *  injection via a crafted logoUrl/backgroundUrl/imageUrl). */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return escapeHtml(url);
  } catch {
    return null;
  }
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function formatPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${escapeHtml(currency)}`;
}

function paginate<T>(items: T[], pageSize: number, maxPages: number): { pages: T[][]; overflowCount: number } {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
    if (pages.length >= maxPages) break;
  }
  const shown = Math.min(items.length, pageSize * maxPages);
  return { pages, overflowCount: Math.max(0, items.length - shown) };
}

function renderItem(item: FlyerHtmlItem): string {
  const image = safeUrl(item.imageUrl);
  const hasDiscount = item.originalPrice != null && item.originalPrice > item.displayPrice;
  return `
    <div class="item">
      <div class="item-image">${image ? `<img src="${image}" alt="${escapeHtml(item.name)}" />` : '<div class="item-image-placeholder"></div>'}</div>
      <div class="item-names">
        ${item.nameAr ? `<div class="name-ar">${escapeHtml(item.nameAr)}</div>` : ''}
        <div class="name-en">${escapeHtml(item.name)}</div>
      </div>
      <div class="item-prices">
        ${hasDiscount ? `<span class="price-original">${formatPrice(item.originalPrice as number, item.currency)}</span>` : ''}
        <span class="price-current">${formatPrice(item.displayPrice, item.currency)}</span>
      </div>
    </div>`;
}

function renderPage(pageItems: FlyerHtmlItem[], title: string, columns: number, branding: FlyerHtmlBranding | undefined, pageNumber: number, pageCount: number): string {
  const logo = safeUrl(branding?.logoUrl);
  const background = safeUrl(branding?.backgroundUrl);
  return `
  <section class="page" style="${background ? `background-image:url('${background}');` : ''}grid-template-columns: repeat(${columns}, 1fr);">
    <header class="page-header">
      ${logo ? `<img class="logo" src="${logo}" alt="logo" />` : ''}
      <h1>${escapeHtml(title)}</h1>
    </header>
    <div class="grid">
      ${pageItems.map(renderItem).join('')}
    </div>
    <footer class="page-footer">${pageNumber} / ${pageCount}</footer>
  </section>`;
}

/**
 * Canonical Flyer renderer — the SAME html this function produces backs both
 * the browser preview (served as an iframe srcdoc) and the PDF export
 * (rendered by headless Chromium), so preview and export can never diverge.
 * Page size (150mm x 180mm) and near-square grid columns
 * (ceil(sqrt(grid))) intentionally match the legacy flyerai catalog builder.
 */
export function buildFlyerHtml({ title, items, grid, branding }: BuildFlyerHtmlParams): BuildFlyerHtmlResult {
  const resolvedGrid = grid ?? DEFAULT_GRID;
  const columns = gridColumns(resolvedGrid);
  const { pages, overflowCount } = paginate(items, resolvedGrid, MAX_PAGES);
  const pageCount = Math.max(pages.length, 1);
  const primary = branding?.colors?.primary && /^#[0-9a-fA-F]{3,8}$/.test(branding.colors.primary) ? branding.colors.primary : '#111827';
  const secondary = branding?.colors?.secondary && /^#[0-9a-fA-F]{3,8}$/.test(branding.colors.secondary) ? branding.colors.secondary : '#dc2626';

  const pagesHtml = (pages.length > 0 ? pages : [[]])
    .map((pageItems, idx) => renderPage(pageItems, title, columns, branding, idx + 1, pageCount))
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${PAGE_WIDTH_MM}mm ${PAGE_HEIGHT_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, "Segoe UI", sans-serif; background: #e5e7eb; }
  .page {
    width: ${PAGE_WIDTH_MM}mm;
    height: ${PAGE_HEIGHT_MM}mm;
    margin: 0 auto 8mm auto;
    background: #ffffff;
    background-size: cover;
    background-position: center;
    display: flex;
    flex-direction: column;
    padding: 6mm;
    page-break-after: always;
    overflow: hidden;
  }
  .page-header { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid ${primary}; padding-bottom: 3mm; margin-bottom: 3mm; }
  .page-header .logo { max-height: 12mm; max-width: 30mm; object-fit: contain; }
  .page-header h1 { font-size: 14pt; color: ${primary}; margin: 0; }
  .grid { flex: 1; display: grid; gap: 3mm; align-content: start; }
  .item { border: 1px solid #e5e7eb; border-radius: 2mm; padding: 2mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .item-image { width: 100%; height: 22mm; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5mm; }
  .item-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .item-image-placeholder { width: 90%; height: 90%; background: #f3f4f6; border-radius: 1mm; }
  .item-names { font-size: 7pt; line-height: 1.2; }
  .name-ar { direction: rtl; font-weight: bold; }
  .name-en { color: #4b5563; }
  .item-prices { margin-top: 1.5mm; }
  .price-original { text-decoration: line-through; color: #9ca3af; font-size: 6.5pt; margin-inline-end: 1.5mm; }
  .price-current { color: ${secondary}; font-weight: bold; font-size: 9pt; }
  .page-footer { text-align: center; font-size: 6pt; color: #9ca3af; padding-top: 2mm; }
  @media print { body { background: none; } .page { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;

  return { html, pageCount, overflowCount };
}
