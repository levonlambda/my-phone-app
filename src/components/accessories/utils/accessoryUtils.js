/* ========== ACCESSORY UTILITIES ========== */
/* Small helpers specific to the accessories feature. */
/* Reusable phone helpers live in src/components/phone-selection/utils/phoneUtils.js */

/**
 * Generate the next available Internal SKU for a given category.
 * Format: ACC-{CATEGORY_CODE}-{sequence zero-padded to 4}
 * Scans existing SKUs that share the same category prefix, finds the highest
 * numeric sequence, and returns the next one (minimum 0001).
 */
export const generateNextSku = (categoryCode, existingSkus = []) => {
  if (!categoryCode) return '';
  const code = String(categoryCode).toUpperCase();
  const prefix = `ACC-${code}-`;

  let maxSeq = 0;
  existingSkus.forEach((sku) => {
    if (typeof sku !== 'string') return;
    if (!sku.startsWith(prefix)) return;
    const remainder = sku.slice(prefix.length);
    const seq = parseInt(remainder, 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
};

/**
 * Validate a SKU string against the expected format.
 * Accepts: ACC-{2-6 uppercase letters}-{4 or more digits}
 */
export const validateSku = (sku) => {
  if (typeof sku !== 'string') return false;
  return /^ACC-[A-Z]{2,6}-\d{4,}$/.test(sku);
};

/**
 * Parse a tags input (string or array) into a clean, deduplicated, lowercase array.
 * Accepts comma- or newline-separated values when a string is provided.
 * Soft limit: 20 tags (silently trimmed).
 */
export const sanitizeTags = (input) => {
  if (input === null || input === undefined || input === '') return [];
  const raw = Array.isArray(input) ? input : String(input).split(/[,\n]/);
  const seen = new Set();
  const result = [];
  raw.forEach((t) => {
    const cleaned = String(t).trim().toLowerCase();
    if (!cleaned) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    if (result.length < 20) {
      result.push(cleaned);
    }
  });
  return result;
};
