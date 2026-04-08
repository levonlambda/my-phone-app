# Plan: Exclude From Summary Column

## Context

The Device Models table (`PhoneListForm.jsx`) currently has 9 columns: Manufacturer, Model, Display, RAM, Storage, CPU/Chipset, Battery, Colors, and Actions. Each phone model has an `excludeFromSummary` boolean field (set via a checkbox in `PhoneSpecForm.jsx`) that controls whether it appears in the Inventory Summary and Price Management views. However, there is no way to see this value from the table — users must open the edit form to check. This plan adds a read-only "Excluded" column to make that status visible at a glance.

## Spec

`_specs/exclude-from-summary-column.md`

## File to Modify

`src/components/PhoneListForm.jsx`

## Changes

### 1. Add "Excluded" column header (table `<thead>`)

Insert a new `<th>` between the "Colors" column and the "Actions" column:

- Header text: **Excluded**
- Not sortable, not clickable
- Width: `w-[7%]`, center-aligned
- Reduce other column widths slightly to make room (total must stay at 100%):
  - Storage: `w-[12%]` → `w-[11%]`
  - CPU/Chipset: `w-[15%]` → `w-[14%]`

### 2. Add "Excluded" column cell (table `<tbody>`)

Insert a new `<td>` in each row, between the Colors cell and the Actions cell:

- Display `phone.excludeFromSummary ? 'True' : 'False'`
- Center-aligned text
- This handles `undefined`/missing values by defaulting to `'False'`

### 3. No other changes

- No changes to data fetching — `excludeFromSummary` is already included in the Firestore document data
- No changes to `PhoneSpecForm.jsx` or any other component
- No new state, no new dependencies

## Verification

1. Run `npm run build` to confirm no compilation errors
2. User visually verifies: models with the checkbox enabled show "True", all others show "False"
3. Confirm table layout looks correct and does not overflow
