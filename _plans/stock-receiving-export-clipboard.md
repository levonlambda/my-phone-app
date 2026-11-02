# Plan: Stock Receiving Export to Clipboard

Spec: `_specs/stock-receiving-export-clipboard.md`
Branch: `feature-stock-receiving-export-clipboard`

Files expected to change:
- `src/components/StockReceivingForm.jsx` — add a Copy button to the header (view-only mode only), a memoized clipboard-text builder, a click handler, and transient "Copied" / error feedback state

No service, context, Firestore, or security-rule changes. No new collection. The feature reads only from component state that is already loaded; it performs no writes of any kind.

## Goal

When the Stock Receiving form is opened in **view-only mode**, a **Copy** button appears immediately to the left of the red **Close** button in the card header. Clicking it writes a plain-text list to the clipboard: one block per unique **manufacturer + model + RAM + storage** combination (color ignored and merged), with a heading line followed by one bare identifier per unit (IMEI1, or Serial Number when IMEI1 is empty). Blocks are separated by a blank line. The button briefly shows "Copied" on success and a short error on failure.

## Confirmed decisions (from spec Open Questions)

1. **Heading includes manufacturer** — e.g. `Apple iPhone 15 Pro 8GB / 256GB`. Unit count is **not** appended (spec left it open; omit to keep output paste-friendly, can be added later if asked).
2. **Bare identifier values** — no `IMEI:` / `SN:` prefix.
3. **Skip units with neither identifier** — emit no line for them. If a group ends up with zero lines after skipping, omit the whole group.
4. **No IMEI2** — only IMEI1 or Serial Number.
5. **No procurement header** — output contains only the grouped identifiers.
6. **Button label is "Copy"** — with a clipboard icon.

## Data source

The form already holds every received unit in `receivingItems` state (`:148`), populated for view-only mode from the `inventory` collection in the load effect (`:226–280`). Each item has `manufacturer`, `model`, `ram`, `storage`, `color`, `imei1`, `serialNumber`, and a `groupId`. The existing `groupedItems` memo (`:400–430`) groups by `groupId`, which is derived from a key that **includes color** (`:226`, `:236`), so it cannot be reused directly for the export. A separate grouping keyed on manufacturer + model + RAM + storage is required.

Order requirement: groups appear in the order their first unit appears in `receivingItems`, and units within a group keep their `receivingItems` order. Since `receivingItems` is built group-by-group in the same order the on-screen sections render, iterating it once in order and inserting groups on first sight satisfies "on-screen order".

## Implementation steps

### 1. Imports

- Add `Clipboard` (or `Copy`) and `Check` to the `lucide-react` import list (`:4–12`). `Check` is for the transient "Copied" state; `CheckCircle` is already imported and could also serve, but a plain `Check` matches the small button size better.

### 2. Clipboard text builder (memo)

- Add a `useMemo` named `exportText`, dependent on `[receivingItems]`, placed after `groupedItems` (`:430`).
- Logic:
  - Iterate `receivingItems` in order.
  - For each item compute a key from manufacturer, model, RAM, and storage joined with a separator (color deliberately excluded).
  - Compute the identifier: trimmed `imei1`; if empty, trimmed `serialNumber`. If still empty, skip the item (decision #3).
  - Use a `Map` (preserves insertion order) from key to `{ heading, lines: [] }`, creating the entry on first sight with heading `Manufacturer Model RAM / Storage` (trimmed to tolerate a missing manufacturer).
  - Push the identifier onto `lines`.
  - After the loop, drop any entry with zero lines, then render each group as the heading followed by one line per identifier, and separate groups with a single blank line.
- Returns an empty string when there is nothing to export.

### 3. Feedback state and handler

- Add state: `copyStatus` with values `'idle' | 'copied' | 'error'`, initial `'idle'`.
- Add a `useEffect` that, when `copyStatus` is not `'idle'`, starts a timeout of about 2000 ms to reset to `'idle'`, and clears the timer on cleanup. Cleanup on each status change handles the "rapid repeated clicks" edge case: each click restarts the timer rather than stacking them.
- Add `handleCopyExport` (async), placed next to `handleCancel` (`:849`):
  - If `exportText` is empty, set `copyStatus` to `'error'` and return (covers the "no items" edge case without disabling the button, so the user still gets feedback).
  - Guard: if `navigator.clipboard` or its `writeText` is unavailable, set `'error'` and return.
  - Await `navigator.clipboard.writeText(exportText)`; on success set `'copied'`; in the catch block set `'error'`.
  - No Firestore calls, no changes to `receivingItems` or any other form state.

### 4. Header button (view-only only)

- In the header (`:875–885`) wrap the existing red Close/Cancel button and the new button in a `div` with `flex items-center gap-2` so the two sit side by side on the right; the Copy button comes **first** so it renders to the left of Close.
- Render the Copy button only when `isViewOnly` is true:
  - `type="button"`, `onClick={handleCopyExport}`, `title="Copy grouped IMEI / serial list to clipboard"`.
  - Same size classes as the Close button (`px-4 py-2 rounded flex items-center text-sm`) so header height is unchanged. Use a neutral color that reads well on the dark-blue header, e.g. `bg-white text-[rgb(52,69,157)] hover:bg-gray-100`, matching the header palette already used in the form.
  - Content switches on `copyStatus`:
    - `'idle'` → clipboard icon + "Copy"
    - `'copied'` → check icon + "Copied"
    - `'error'` → X icon + "Copy failed"
  - Fixed minimum width (e.g. `min-w-[110px] justify-center`) so the label change does not shift the Close button.
- The Close button's markup, `onClick={handleCancel}`, and label logic are left exactly as they are.
- In create/edit mode nothing new renders; header behavior is identical to today.

### 5. No other surface changes

- The bottom-of-form Cancel/Close button (`:1243`) is untouched; the spec places the Copy button in the header only.
- `groupedItems`, the items table, barcode editing, validation, and save logic are untouched.

## Edge-case handling (mapped to spec)

- **Neither IMEI1 nor Serial Number** → unit skipped; empty groups dropped (step 2).
- **Mixed colors** → merged via color-free key (step 2).
- **No items** → `exportText` is empty; click yields the "Copy failed" feedback (step 3).
- **Clipboard API blocked/unavailable** → guard plus catch set `'error'`; form keeps working (step 3).
- **Whitespace** → identifiers trimmed (step 2).
- **Duplicates** → not deduplicated; each unit emits its own line (step 2).
- **Long lists** → single string, no truncation.
- **Create/edit mode** → button gated on `isViewOnly` only (step 4).
- **Rapid clicks** → timer reset on each status change (step 3).

## Verification (manual, by the user — do not run the app)

The dev server will not be started by Claude (live database). After implementing, run `npm run lint` and `npm run build` to confirm the file compiles. The user then verifies:

1. Open Procurement Management and view a received procurement. Header shows **Copy** to the left of the red **Close**.
2. Open a new/edit stock receiving; no Copy button in the header.
3. Click Copy, paste into Notepad: blocks headed `Manufacturer Model RAM / Storage`, one bare IMEI1 or serial per line, blank line between blocks, same-model-different-color units merged into one block.
4. Button reads "Copied" for about two seconds, then returns to "Copy".
5. Header height and Close button position unchanged in both modes.

## Out of scope

- Exporting from the accessory stock receiving form (`src/components/accessories/AccessoryStockReceivingForm.jsx`).
- Including IMEI2, unit counts, prices, or procurement metadata.
- Any file download (Word/CSV); this is clipboard-only.
