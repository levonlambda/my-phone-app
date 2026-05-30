# Plan: Stock Receiving Location Dropdown

Spec: `_specs/stock-receiving-location-dropdown.md`
Target file: `src/components/StockReceivingForm.jsx` (only file expected to change)

## Goal

Replace the free-text **"Set all locations to:"** input and the per-row free-text **location** inputs in the Stock Receiving form with dropdowns populated from the store names defined in **Manage Stores (Locations)** (`accessory_locations` collection, read via `accessoryLocationService.js`). The **Apply to All** button keeps its current behavior of copying the bulk selection into every row.

## Confirmed decisions (from spec Open Questions)

1. **Per-row field is in scope** — each line item's `location` becomes the same store-name dropdown. **Apply to All** still overwrites every row with the bulk selection.
2. **Source** — read from `accessory_locations` via `accessoryLocationService.js`. No new collection.
3. **Default selection** — the primary store (`isPrimary`) is pre-selected by default in the bulk dropdown when the form loads.
4. **Stored value** — store the store **name** (string), same as today. Backward compatible; no schema/data change.
5. **Inactive / deleted stores** — for a **saved record** being viewed, if a row's saved location name is not among the active stores, still show that exact name as an option so the value is visible. For **new** receiving entries, only active stores appear.

## Data source

Use `getActiveLocations()` from `src/services/accessoryLocationService.js`:
- Returns `{ success, locations }` already filtered to `active !== false` and sorted by `sortOrder` ascending.
- Each location has `{ id, name, isPrimary, sortOrder, active, ... }`.
- The dropdowns use `location.name` as both the option value and label (names are unique per `createLocation`).
- `getPrimaryLocation()` (or selecting `isPrimary` from the active list) gives the default bulk selection.

This is read-only. No writes to Firestore — consistent with the live-database rule in CLAUDE.md.

## Implementation steps

### 1. Load stores on mount

- Add state near the other state declarations (~`StockReceivingForm.jsx:37`):
  - `activeLocations` (array, default `[]`)
  - `locationsLoading` (bool) and optionally `locationsError` for graceful failure.
- Add a `useEffect` (runs once on mount) that calls `getActiveLocations()` and stores the result in `activeLocations`.
- After load, set the default bulk selection: pick the location where `isPrimary === true`, else leave `bulkLocation` as `''` (placeholder). Update `bulkLocation` (`:37`) accordingly.
- Import `getActiveLocations` from `../services/accessoryLocationService` at the top (`:26`-ish import block).

### 2. Convert the bulk "Set all locations to:" control (`:904–928`)

- Replace the `<input type="text">` bound to `bulkLocation` with a `<select>`:
  - First option: placeholder `Select a store…` with empty value.
  - One option per `activeLocations` entry: `value={loc.name}`, label `{loc.name}`.
  - `value={bulkLocation}`, `onChange` sets `bulkLocation` (same state, unchanged).
  - `disabled={isViewOnly}` (and optionally while `locationsLoading`).
- Keep the **Apply to All** button and `handleBulkLocationSet` (`:417`) as-is. The existing guard `if (!bulkLocation.trim()) return;` already makes the placeholder a no-op.
- Preserve the label, `MapPin` icon, and container classes (`min-w-[240px] max-w-[320px]`).

### 3. Convert the per-row location field (`:1125–1133`)

- Replace the per-row `<input type="text">` bound to `item.location` with a `<select>`:
  - Placeholder option (empty value) shown when the row has no location, keeping the "Required" intent.
  - Options from `activeLocations` (`value`/label = `loc.name`).
  - `value={item.location}`, `onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}` (unchanged handler).
  - `disabled={isViewOnly}`.
  - Keep the red-border error styling and the `fieldErrors[`location-${item.id}`]` message block (`:1134`).
- **Inactive/deleted store handling (decision #5):** build the option list per row so that if `item.location` is a non-empty value not present in `activeLocations`, that saved name is appended as an extra option (so it displays for saved/view records). For new rows this branch never triggers because their value comes from active stores. A small helper that merges `[...activeLocations.map(l => l.name), item.location].filter unique` covers this.

### 4. Defaults for new rows

- New/empty rows continue to initialize `location: ''` (`:240`, `:346`) and show the placeholder until the user selects per-row or presses **Apply to All**.
- Existing required-field validation (`:559–561`, "Location is required") is unchanged, so a row left on the placeholder still fails validation as before.

### 5. Empty / error states

- If `activeLocations` is empty (no stores defined) or the fetch failed:
  - Dropdowns render with only the placeholder (plus any pre-existing saved per-row value).
  - **Apply to All** stays a no-op because `bulkLocation` is empty.
  - Optionally show a small inline hint (e.g. "No stores configured — add stores in Manage Stores") — minor, can be deferred.

## Edge cases checklist (from spec)

- No active stores → placeholder only, Apply to All no-op, form still renders.
- Stores still loading → control disabled/empty, no crash.
- Saved record references a renamed/deleted/inactive store → that name appended as an option so it shows (decision #5).
- Apply to All with placeholder selected → no-op (existing guard).
- Long store names → constrained by existing container max-width; `<select>` truncates natively.
- View-only mode → both dropdowns disabled.

## Out of scope

- No changes to the Manage Stores (Locations) form or `accessoryLocationService.js`.
- No migration of existing free-text `location` values in inventory/records.
- No switch from store name to store ID (explicitly deferred in spec).
- No new Firestore collection or any write to Firestore.

## Verification (manual — user runs the app per project rule)

Per project memory, the app/dev server is not run by Claude (live database, user-only testing). Suggested manual checks for the user:
- Open Stock Receiving for a new procurement: bulk dropdown defaults to the primary store; options match active stores in Manage Stores.
- Press **Apply to All**: every row's location updates to the bulk selection and location errors clear.
- Select different stores per row; save still validates "Location is required" when a row is left blank.
- Open a saved/view-only record whose location was a now-inactive/renamed store: the saved name still displays and controls are disabled.
- Add a new store in Manage Stores, reopen the form: the new store appears as an option.
- `npm run lint` passes; `npm run build` succeeds.

## Risks / notes

- Cross-module read: the phone Stock Receiving form will import from the accessories service layer. Accepted per spec decision #2; if the modules are ever separated, this coupling is the thing to revisit.
- Names are the join key. If two stores could ever share a name it would be ambiguous, but `createLocation` enforces unique names, so this holds.
