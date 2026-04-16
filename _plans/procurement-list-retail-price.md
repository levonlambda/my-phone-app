# Plan: Procurement List Retail Price Column

## Context

The Phone Procurement form already captures a retail price for each line item (the input is wired up at `PhoneProcurementForm.jsx:1408-1422` and `addItemToTable` persists it as `retailPrice` on each item at line 745). But the Procurement List table below the input section only surfaces the dealer's price and the total price — staff can't see what retail price was entered for each row without re-opening the item. This plan adds a new Retail Price column between Dealer's Price and Total Price, reusing the existing `retailPrice` field and `formatPrice` helper. The form's outer width must stay the same; the new column is accommodated by explicitly narrowing the Manufacturer and Qty columns.

## Spec

`_specs/procurement-list-retail-price.md`

## File to Modify

`src/components/PhoneProcurementForm.jsx`

## Background Findings

- **The data is already there.** Each item in `procurementItems` already carries a `retailPrice` field (written at `PhoneProcurementForm.jsx:745` in `addItemToTable`). No state, no service, no Firestore, and no input changes are needed — only the table's render path.
- **The table currently has no explicit column widths.** The `<table>` at `PhoneProcurementForm.jsx:1500` uses `w-full border-collapse` and lets the browser auto-distribute. None of the `<th>` elements (`lines 1503-1510`) declare `w-[...]`, `<colgroup>`, or inline widths. That means to "reduce Manufacturer and Qty" as the spec asks, widths need to be introduced explicitly.
- **Existing column order** (8 columns → 9 after the change): Manufacturer, Model, RAM, Storage, Color, Qty, Dealer's Price, **Retail Price (new)**, Total Price.
- **The price formatter to reuse** is `formatPrice` at `PhoneProcurementForm.jsx:100-108`. It strips commas, parses to a float, and calls `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. It's already used by the Dealer's Price cell at line 1569 and the Total Price cell at line 1572. The new Retail Price cell should use it identically for visual consistency.
- **`formatPrice` returns `''` for missing/invalid values.** The spec requires missing retail price to render as `0.00`. Achieve this with `formatPrice(item.retailPrice) || '0.00'`.
- **Empty-list state is a separate branch** at `PhoneProcurementForm.jsx:1493-1497`: when `procurementItems.length === 0`, a placeholder `<div>` renders instead of the table. Adding a column cannot break that path — no changes needed there.
- **`_plans/exclude-from-summary-column.md`** sets a precedent for adjusting column widths via explicit `w-[X%]` utilities on `<th>` elements. The same approach fits here.

## Changes

### 1. Add explicit column widths to the existing `<th>` elements

At `PhoneProcurementForm.jsx:1503-1510`, add a `w-[X%]` utility class to each `<th>` so that column widths are under explicit control and the new Retail Price column has guaranteed space. Target widths (total = 100%):

| Column          | Width    | Notes                                                      |
|-----------------|----------|------------------------------------------------------------|
| Manufacturer    | `w-[11%]`| Narrowed, per spec                                         |
| Model           | `w-[17%]`| Widest text column                                         |
| RAM             | `w-[7%]` | Short values like `8GB`                                    |
| Storage         | `w-[8%]` | Short values like `128GB`                                  |
| Color           | `w-[10%]`| Existing text/inline behavior                              |
| Qty             | `w-[10%]`| Narrowed, per spec — must still fit the +/- buttons        |
| Dealer's Price  | `w-[11%]`| Right-aligned `font-mono` money                            |
| **Retail Price**| `w-[12%]`| **NEW** — right-aligned `font-mono` money                  |
| Total Price     | `w-[14%]`| Right-aligned `font-mono font-medium` money (widest amount)|

These are starting values; minor ±1% tuning is acceptable at implementation time if long manufacturer names or quantity controls visibly clip. The goal: Manufacturer and Qty are visibly narrower than before, the new column fits cleanly, and no existing column loses content.

### 2. Insert the Retail Price header

After the existing Dealer's Price `<th>` at `PhoneProcurementForm.jsx:1509` and before the Total Price `<th>` at line 1510, add a new header `<th>` with:
- Label: **Retail Price**
- Classes matching the Dealer's Price header exactly, plus the width from the table above: `border px-3 py-3 text-right font-semibold w-[12%]`

### 3. Insert the Retail Price data cell

After the existing Dealer's Price `<td>` at `PhoneProcurementForm.jsx:1568-1570` and before the Total Price `<td>` at lines 1571-1573, add a new `<td>` inside the row template that:
- Matches the Dealer's Price cell's classes exactly: `border px-3 py-2 text-right font-mono`
- Renders the peso sign followed by `formatPrice(item.retailPrice) || '0.00'`
- Does not use `font-medium` (that's reserved for the Total Price cell for emphasis, matching current behavior)

### 4. No other changes

- No changes to `addItemToTable` (`lines 730-758`) — `retailPrice` is already being written to every new line item
- No changes to the retail price input (`lines 1408-1422`) — the field is already captured
- No changes to `formatPrice`, the empty-list placeholder, the grand total, or any Firestore/service code
- No changes to column responsiveness: the table already wraps in an `overflow-x-auto` container if the parent provides one, which is unaffected by these edits

## Verification

1. `npm run lint` and `npm run build` succeed without new warnings or errors.
2. User opens the Phone Procurement form and confirms:
   - Adding a line item with a retail price (e.g. `₱18,500.00`) shows that value in the new Retail Price column between Dealer's Price and Total Price.
   - Adding a line item with the retail price left blank shows `₱0.00` in the new column.
   - The Manufacturer and Qty columns are visibly narrower than before; the form's outer width is unchanged.
   - No existing column is hidden or clips its content (including long manufacturer names and quantity +/- controls).
   - The Retail Price numbers are right-aligned and use the same currency/number formatting (peso sign, commas, two decimals) as the Dealer's Price and Total Price columns.
   - The empty-list placeholder ("No items in procurement list") still renders correctly when no items have been added.
