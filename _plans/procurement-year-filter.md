# Plan: Procurement Year Filter

## Context

The Procurement Management form (`ProcurementManagementForm.jsx`) currently supports two filters: a free-text search (matching supplier name, reference, purchase date substring, and procurement ID) and a status dropdown (all / paid / unpaid / delivered / pending). As the procurement history grows, users need a way to scope the view to a single year so that the list and summary cards focus on the period they care about. This plan adds a year filter dropdown that defaults to the current year, coexists with the existing filters, and can be set to "All Years" to show every entry.

## Spec

`_specs/procurement-year-filter.md`

## File to Modify

`src/components/ProcurementManagementForm.jsx`

## Background Findings

- `purchaseDate` is stored as a `YYYY-MM-DD` string on each procurement document (confirmed by `supplierService.js` passing it through untouched, by Firestore `orderBy('purchaseDate', 'desc')` working correctly at line 99, and by the existing `procurement.purchaseDate?.includes(searchTerm)` substring match at line 142). This means the year can be extracted cheaply with `purchaseDate.slice(0, 4)`.
- Filter state lives in local component state: `searchTerm` (line 36) and `statusFilter` (line 37).
- Filter computation runs in a single `useEffect` at lines 134-166, depending on `[procurements, searchTerm, statusFilter]`, writing to `filteredProcurements` via `setFilteredProcurements`.
- Filter bar JSX lives at lines 319-360. The search input block ends around line 334, and the status filter block starts around line 337. This is the insertion point for the new field.
- The entries count display at lines 368-372 conditionally shows "filtered" text when `searchTerm || statusFilter !== 'all'`.
- All four summary cards (lines 374-480) already compute off `filteredProcurements`, so no changes are needed there — they will automatically reflect the year filter.
- There is no existing year-extraction helper in `src/lib/utils.js` or `src/components/phone-selection/utils/phoneUtils.js`, so a small local helper is fine.

## Changes

### 1. Add `yearFilter` state

Next to `searchTerm` and `statusFilter` (around lines 36-37), add a new state variable:

- Name: `yearFilter`
- Initial value: the current year as a string, e.g. `String(new Date().getFullYear())`
- The sentinel value `'all'` will represent "All Years" (show every entry regardless of year)

### 2. Compute the list of year options

- Make the starting year be 2025 because this is the first year the program was run, then show the years between 2025 up to the current year.

### 3. Update the filter `useEffect`

In the effect at lines 134-166:

- Add `yearFilter` to the dependency array.
- After the existing status filter block, add a new block:
  - If `yearFilter !== 'all'`, keep only procurements whose `purchaseDate` starts with `yearFilter` (`purchaseDate?.slice(0, 4) === yearFilter`).
  - Entries with a missing or malformed `purchaseDate` are excluded when a specific year is selected (they reappear when the user switches to "All Years"), consistent with the spec's edge-case handling.

### 4. Render the year dropdown in the filter bar

Insert a new container between the search input block (closes ~line 334) and the status filter block (starts ~line 337):

- Wrapper: `<div className="w-full md:w-40">` (slightly narrower than the status filter since the content is just a 4-digit year)
- `<select>` with classes matching the existing status filter exactly: `w-full p-2 border rounded-lg text-sm`
- `value={yearFilter}`, `onChange={(e) => setYearFilter(e.target.value)}`
- First option: `<option value="all">All Years</option>`
- Remaining options: the memoized year list from step 2, rendered as `<option key={year} value={year}>{year}</option>`

This keeps the field visually consistent with the status dropdown and honors the spec's requirement that it sit between the search input and the status filter.

### 5. Update the entries count "filtered" indicator

In the count display at lines 368-372, expand the filtered-mode condition so a non-"all" year filter also triggers the `"X of Y entries (filtered)"` label:

- Change the condition from `searchTerm || statusFilter !== 'all'` to also include `yearFilter !== 'all'`.

### 6. No changes required elsewhere

- Summary cards (lines 374-480) already read from `filteredProcurements` and will automatically update.
- Empty-state message (lines 493-505) already handles "no entries match your filters" correctly for any combination of filters.
- No changes to services, Firestore queries, or context providers.

## Validation Considerations (from spec open questions)

- Since the field is a dropdown rather than free text, invalid input is structurally impossible — the user can only pick a known year, `"all"`, or whatever default is pre-selected. No additional numeric validation layer is needed.
- The default value (`String(new Date().getFullYear())`) is guaranteed to be in the options list by step 2, so the dropdown always has a valid selected state on first render, even before `procurements` finishes loading.

## Verification

1. `npm run lint` and `npm run build` succeed without new warnings or errors.
2. User opens Procurement Management and confirms:
   - On load, the year dropdown shows the current year (2026) and the list is scoped to that year's procurements.
   - Changing the year to a prior year (e.g. 2025) updates both the entries list and all four summary cards.
   - Selecting "All Years" shows every procurement and the count label drops the "(filtered)" suffix (unless another filter is active).
   - Combining year + search term + status dropdown narrows the list correctly (all three filters compose).
   - The empty-state message appears when a year has no matching entries.
