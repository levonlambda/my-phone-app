# Plan: Export Price Configuration to Word

## Context
The Price Management form currently has no way to export pricing data. Users need to generate Word documents of filtered price configurations for sharing or printing. The Inventory List form already has a working Word export (`handleWordExport` in `InventoryListForm.jsx`) that uses an HTML-to-Word blob approach. This plan adds the same capability to Price Management, with consistent document styling.

## File to Modify
- `src/components/PriceManagementForm.jsx`

## Existing Patterns to Reuse
- **Export technique**: `InventoryListForm.jsx` lines 627–1007 — HTML string with Word XML namespaces, `@page` styles, blob creation with MIME type `application/vnd.ms-word`, auto-download via temporary anchor element.
- **Styling constants**: Header blue `#34459d`, alternating rows white/`#f0f0f0`, font Arial 10pt body / 9pt cells, table `border-collapse: collapse`, `1pt solid #ddd` cell borders, `1pt solid #34459d` header borders.
- **Existing utilities in PriceManagementForm.jsx**: `formatPrice()` (line ~96), `calculateMargin()` (line ~111), `formatWithGB()` (line ~121), `filters` state, `filteredData` state.
- **Icon**: `FileText` from `lucide-react` (already imported in InventoryListForm, needs to be added to PriceManagementForm imports).

## Changes

### 1. Add `FileText` to imports (line ~11)
Add `FileText` to the existing `lucide-react` import statement.

### 2. Add export state (after existing state declarations, around line ~35)
Add: `const [isExporting, setIsExporting] = useState(false);`

### 3. Add `handleWordExport` function (after the existing save functions, before `fetchPhoneData`)
Create a function that:
- Guards against empty `filteredData` (alert and return early).
- Sets `isExporting` to `true`.
- Builds a filter summary string from the current `filters` state (manufacturer, model, RAM, storage — showing "All" for unset filters).
- Constructs an HTML string with Word XML namespaces and styles matching the Inventory List export:
  - `@page` with 0.5in margins
  - Title: "Price Configuration Report"
  - Header info: generated date, total configurations count
  - Filter summary line
  - Table with columns: Manufacturer, Model, RAM, Storage, Colors, Dealer's Price, Retail Price, Margin
  - Column widths proportioned for the data (e.g., 12% / 16% / 8% / 8% / 20% / 12% / 12% / 12%)
  - Header row: `#34459d` background, white text
  - Body rows: alternating white / `#f0f0f0`
- For each item in `filteredData`, outputs one row:
  - Manufacturer, Model, RAM (via `formatWithGB`), Storage (via `formatWithGB`)
  - Colors: comma-separated list from `item.colors.map(c => c.color).join(', ')`, or "N/A" if empty
  - Dealer's Price: `formatPrice(item.baseDealersPrice)`
  - Retail Price: `formatPrice(item.baseRetailPrice)`
  - Margin: `calculateMargin(item.baseDealersPrice, item.baseRetailPrice)`
- Creates a Blob with MIME type `application/vnd.ms-word;charset=utf-8`.
- Creates a temporary anchor, sets `href` to object URL, `download` to `Price_Configuration_<YYYY-MM-DD>.doc`, clicks it, then cleans up.
- Sets `isExporting` to `false` in a finally block.
- Wraps everything in try/catch with an error alert.

### 4. Add Export button to header (after the Refresh button, around line ~800)
Insert a button styled identically to the existing Filters/Refresh buttons:
- `FileText` icon + "Export" text (or "Exporting..." when `isExporting` is true)
- Disabled when `isExporting || filteredData.length === 0`
- Gray styling when disabled, white bg with blue text when enabled
- `onClick` calls `handleWordExport`

Position: immediately after the Refresh button (consistent with Export button placement in the Inventory List form).

## Verification (manual — to be performed by the user only)
**Important:** The database contains live production data. Claude must NOT run the dev server or interact with the app to test. Only the user should perform these verification steps.

1. Open Price Management form — confirm the Export button appears before the Filters button
2. With data loaded, click Export — confirm a `.doc` file downloads
3. Open the document — confirm it has the blue header, alternating row colors, and all columns
4. Apply filters, then export — confirm only filtered data appears in the document
5. Verify edge cases: zero prices show "N/A" margin, configurations with no colors show "N/A"

**Claude can run:** `npm run lint` to verify no code issues.
