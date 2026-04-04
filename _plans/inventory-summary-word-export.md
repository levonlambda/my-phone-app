# Plan: Inventory Summary Word Export

## Context
The Inventory Summary form (`InventorySummaryForm.jsx`) currently has no export capability. Users need to generate Word documents of the filtered inventory summary data for sharing or printing. The Inventory List form already has a working Word export (`handleWordExport` in `InventoryListForm.jsx`) that uses an HTML-to-Word blob approach. This plan adds the same capability to Inventory Summary, with consistent document styling and a landscape page orientation to fit all columns.

Spec: `_specs/inventory-summary-word-export.md`

## File to Modify
- `src/components/InventorySummaryForm.jsx`

## Existing Patterns to Reuse
- **Export technique**: `InventoryListForm.jsx` lines 627–1007 — HTML string with Word XML namespaces (`urn:schemas-microsoft-com:office:office`, `urn:schemas-microsoft-com:office:word`), `@page` styles, blob creation with MIME type `application/vnd.ms-word;charset=utf-8`, auto-download via temporary anchor element.
- **Styling constants**: Header blue `#34459d`, alternating rows white/`#f0f0f0`, font Arial 10pt body / 9pt cells, table `border-collapse: collapse`, `1pt solid #ddd` cell borders, `1pt solid #34459d` header borders.
- **Existing utilities in InventorySummaryForm.jsx**: `formatPrice()` (line 206), `calculateMargin()` (line 211), `formatWithGB()` (line 221), `filters` state, `filteredData` state, `isAdmin` flag.
- **Icon**: `FileText` from `lucide-react` (needs to be added to InventorySummaryForm imports).

## Changes

### 1. Add `FileText` to imports (line 7–15)
Add `FileText` to the existing `lucide-react` import statement alongside the other icons.

### 2. Add export state (after existing state declarations, around line 32)
Add: `const [isExporting, setIsExporting] = useState(false);`

### 3. Add `handleWordExport` function (after `fetchExcludedModelsInfo`, before `toggleRowExpansion`, around line 88)
Create a function that:
- Guards against empty `filteredData` (alert and return early).
- Sets `isExporting` to `true`.
- Builds a filter summary string from the current `filters` state (manufacturer, model, RAM, storage, color — showing "All" for unset filters).
- Constructs an HTML string with Word XML namespaces and styles matching the Inventory List export:
  - `@page` with **landscape** orientation: `size: 11in 8.5in` and 0.5in margins
  - `w:WordDocument` XML block with Print view and 100% zoom
  - Title: **"Inventory Summary Report"**, centered, `#34459d` color, bold, 21pt
  - Header info: generated date (full month name format), total configurations count
  - Filter summary line listing all active filters
  - Table with `table-layout: fixed` and `colgroup` for column widths
  - **Columns** (with proportional widths adjusted for landscape):
    1. Manufacturer (~12%)
    2. Model (~20%, formatted as "Model (RAMxGB+StorageGB)" using `formatWithGB`)
    3. Colors (~15%, comma-separated from `item.colors.map(c => c.color).join(', ')`)
    4. DP (~10%, using `formatPrice(item.dealersPrice)`)
    5. SRP (~10%, using `formatPrice(item.retailPrice)`)
    6. Margin (~8%, using `calculateMargin`, **admin only** — conditionally include column)
    7. Sold (~5%, `item.totalSold`)
    8. Display (~5%, `item.totalOnDisplay`)
    9. Stock (~5%, `item.totalOnHand`)
    10. Available (~5%, `item.totalAvailable`)
    11. Pending (~5%, `item.totalPending`)
  - Header row: `#34459d` background, white bold text
  - Body rows: alternating white / `#f0f0f0` per row index
- **Admin-only Inventory Value Summary section** after the main table:
  - A styled summary block showing:
    - Total Dealer's Value: `filteredData.reduce((t, i) => t + (i.totalAvailable * i.dealersPrice), 0)`
    - Total Retail Value: `filteredData.reduce((t, i) => t + (i.totalAvailable * i.retailPrice), 0)`
    - Potential Profit: retail value minus dealer's value, with margin percentage
    - Total available units count
  - Rendered as a simple styled table or paragraph block below the main table
- Creates a Blob with MIME type `application/vnd.ms-word;charset=utf-8`.
- Creates a temporary anchor, sets `href` to object URL, `download` to `Inventory_Summary_<YYYY-MM-DD>.doc`, clicks it, then cleans up.
- Sets `isExporting` to `false` in a finally block.
- Wraps everything in try/catch with an error alert.

### 4. Add Export button to header (after the Refresh button, around line 691)
Insert a button styled identically to the existing Filters/Refresh buttons:
- `FileText` icon + "Export" text (or "Exporting..." when `isExporting` is true)
- Disabled when `isExporting || filteredData.length === 0`
- Gray styling when disabled (`bg-gray-400 text-gray-200 cursor-not-allowed`), white bg with blue text when enabled
- `onClick` calls `handleWordExport`

Position: immediately after the Refresh button `</button>` closing tag (around line 691).

## Data Notes
- `filteredData` items have this shape: `{ manufacturer, model, ram, storage, colors: [{ color, sold, onDisplay, onHand, available, pending, ... }], dealersPrice, retailPrice, totalSold, totalOnDisplay, totalOnHand, totalAvailable, totalPending }`
- Data is already sorted by manufacturer → model → RAM (numeric) → storage (numeric) in `fetchInventoryData`.
- The `filteredData` array already excludes models marked with `excludeFromSummary` — no extra filtering needed for the export.
- Sold counts are already filtered to current month only — the export reflects this without additional logic.

## Verification (manual — to be performed by the user only)
**Important:** The database contains live production data. Claude must NOT run the dev server or interact with the app to test. Only the user should perform these verification steps.

1. Open Inventory Summary form — confirm the Export button appears after the Refresh button.
2. With data loaded, click Export — confirm a `.doc` file downloads with the name `Inventory_Summary_YYYY-MM-DD.doc`.
3. Open the document in Word — confirm landscape orientation, blue header, alternating row colors, and all columns present.
4. Apply filters, then export — confirm only filtered configurations appear in the document.
5. Check the filter summary line in the document reflects the active filters.
6. As an admin: confirm the Margin column and Inventory Value Summary section appear.
7. As a non-admin: confirm the Margin column and Inventory Value Summary section are absent.
8. Verify edge case: export with no data — button should be disabled.

**Claude can run:** `npm run lint` to verify no code issues.
