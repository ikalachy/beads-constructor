/**
 * Reads colors/catalog-preciosa-ornela-com-2026-05-01.csv — one JSON object per CSV row,
 * samples hex from each distinct photoUrl (cached), writes colors/preciosa-colors.json
 * and public/preciosa-colors.json when public/ exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, 'catalog-preciosa-ornela-com-2026-05-01.csv');

const CONCURRENCY = 14;
const RESIZE = 48;

function toHex(n) {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function averageHexFromRgba(data, channels) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += channels) {
    const rr = data[i];
    const gg = data[i + 1];
    const bb = data[i + 2];
    const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
    if (lum > 250 && rr > 248 && gg > 248 && bb > 248) continue;
    r += rr;
    g += gg;
    b += bb;
    n++;
  }
  if (n === 0) {
    for (let i = 0; i < data.length; i += channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n));
}

async function hexFromPhotoUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf)
    .resize(RESIZE, RESIZE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return averageHexFromRgba(data, info.channels);
}

/** @type {Map<string, Promise<string>>} */
const hexByUrl = new Map();

function hexFromPhotoUrlCached(url) {
  let p = hexByUrl.get(url);
  if (!p) {
    p = hexFromPhotoUrl(url).catch((e) => {
      console.warn(`Photo ${url.slice(0, 72)}…: ${e.message}`);
      return '#808080';
    });
    hexByUrl.set(url, p);
  }
  return p;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function rowId(row, fallbackIndex) {
  const id = String(row.web_scraper_order ?? '').trim();
  return id || `row-${fallbackIndex}`;
}

function photoUrlFromRow(row) {
  let u = String(row.photo ?? '').trim().split(/\s/)[0];
  if (u.startsWith('http')) return u;
  const firstImageLine = String(row.image ?? '')
    .split(/\n/)[0]
    ?.trim();
  if (firstImageLine?.startsWith('http')) return firstImageLine;
  return '';
}

function loadCatalogRows() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('Missing catalog CSV in colors/');
    process.exit(1);
  }
  const content = fs.readFileSync(CSV_PATH);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  const list = [];
  let skipped = 0;
  records.forEach((row, index) => {
    const code = String(row.Color_Number ?? '')
      .trim()
      .replace(/\s+/g, '');
    const photoUrl = photoUrlFromRow(row);
    if (!code || !photoUrl.startsWith('http')) {
      skipped++;
      return;
    }
    const productUrl = String(row.item_page_link ?? '').trim();
    list.push({
      id: rowId(row, index),
      code,
      name: String(row.Color_Description ?? '').trim() || code,
      finish: String(row.Natural_Finished ?? '').trim() || 'unknown',
      family: String(row.whole_article_number ?? '').trim() || 'unknown',
      photoUrl,
      productUrl: productUrl.startsWith('http') ? productUrl : '',
    });
  });

  console.log(`Catalog rows: ${records.length} → JSON entries: ${list.length} (skipped ${skipped})`);
  console.log(`Distinct photo URLs (hex fetches): ${new Set(list.map((e) => e.photoUrl)).size}`);
  return list;
}

const list = loadCatalogRows();

const withHex = await mapPool(list, CONCURRENCY, async (entry, idx) => {
  const hex = await hexFromPhotoUrlCached(entry.photoUrl);
  if ((idx + 1) % 400 === 0 || idx === 0) console.log(`… ${idx + 1}/${list.length}`);
  return { ...entry, hex };
});

const outColors = path.join(__dirname, 'preciosa-colors.json');
fs.writeFileSync(outColors, JSON.stringify(withHex, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outColors} (${withHex.length} entries)`);

const repoRoot = path.join(__dirname, '..');
const outPublic = path.join(repoRoot, 'public', 'preciosa-colors.json');
if (fs.existsSync(path.join(repoRoot, 'public'))) {
  fs.writeFileSync(outPublic, JSON.stringify(withHex, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPublic} (${withHex.length} entries)`);
}
