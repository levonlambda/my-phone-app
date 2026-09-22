# Plan: Inventory Quick Edit Location

Spec: `_specs/inventory-quick-edit-location.md`
Branch: `feature-update-location-in-inventory-list`

Files expected to change:
- `src/components/InventoryListForm.jsx` — pass the already-loaded store list and admin flag down to the table
- `src/components/inventory/InventoryTable.jsx` — accept new props, forward them to the edit row, stop preserving the original location on save
- `src/components/inventory/InventoryEditForm.jsx` — render the Location dropdown in the quick-edit row

No service, context, or Firestore rule changes. No new collection. Reads only from `accessory_locations`; the only write remains the existing single-item `updateDoc` on the user's explicit Save.

## Goal

When an **admin** clicks **Quick edit** on an Inventory List row, the Location cell becomes a dropdown of active Manage Stores locations (same source and order as the Stock Receiving form's "Set all locations to:" dropdown). Saving writes the selected store **name** to the item's `location` field. Non-admin users keep the current read-only behavior.

## Confirmed decisions (from spec Open Questions)

1. **No audit record** — plain field update on the `inventory` document. No `stock_transfers` or `ledger` entry.
2. **No blanking** — once a store exists, the dropdown does not offer an empty option; a store must always be selected. A placeholder only appears when the item currently has no location, and it is not re-selectable once a store is chosen.
3. **Scope** — Inventory List quick-edit row only. Inventory Summary and Edit full details are untouched.
4. **Admin only** — the dropdown appears only when `userRole === 'admin'`. Regular users see the read-only location text in the edit row exactly as today, and their save continues to preserve the original location.

## Data source

`InventoryListForm.jsx` already loads active stores on mount into `filterOptions.locations` (`:62–69`, effect at `:157–176`) using `getActiveLocations()` from `src/services/accessoryLocationService.js`. That list is:
- filtered to `active !== false`
- sorted by `sortOrder` ascending
- shaped `{ id, name, isPrimary, sortOrder, active, ... }`

Reuse that list. Do not add another fetch in the table or edit row (spec requirement: load once per view). The dropdown uses `location.name` as both value and label, matching how `InventoryFilters.jsx` (`:290–292`) and the Stock Receiving form already do it.

## Implementation steps

### 1. `InventoryListForm.jsx` — pass data down

- `isAdmin` already exists (`:14–15`) and `filterOptions.locations` is already populated.
- At the `<InventoryTable>` render (`:1333–1344`), add two props:
  - `locations={filterOptions.locations}`
  - `canEditLocation={isAdmin}`
- No other changes to this file.

### 2. `InventoryTable.jsx` — accept, forward, and save

- Add `locations` (default `[]`) and `canEditLocation` (default `false`) to the destructured props (`:15–24`) and to `propTypes` (`:505–514`).
- Forward both to `<InventoryEditForm>` (`:469–477`).
- `handleEditClick` (`:58–80`) already seeds `editFormData.location` from `item.location`; leave it.
- `handleEditInputChange` (`:180`) is generic (`[name]: value`), so a `<select name="location">` needs no new handler.
- In `handleSaveEdit` (`:190`), change line `:208` from preserving `originalItem.location` to:
  - if `canEditLocation`: `editFormData.location`, falling back to `originalItem.location || ''` if the form value is somehow empty, so a save never blanks a location (decision #2 and spec "no accidental blanking")
  - else: `originalItem.location || ''` (unchanged behavior for non-admins)
- The local-state updates (`:259–289`) spread `updateData`, so the new location flows into `allItems`, then through `applyFilters` into `inventoryItems`. No change needed there; sorting and the location filter pick up the new value on the next render.
- The `inventory_counts` status transaction (`:222–256`) is untouched.

### 3. `InventoryEditForm.jsx` — the dropdown

- Add `locations` and `canEditLocation` props (with propTypes; defaults `[]` / `false`).
- Replace the read-only Location cell (`:131–134`) with:
  - **If `canEditLocation` is false:** keep the existing read-only `<td>` showing `editFormData.location || 'N/A'`.
  - **If `canEditLocation` is true:** a `<select name="location" value={editFormData.location} onChange={handleEditInputChange}>` styled like the Supplier select in the same row (`w-full p-1 border rounded`).
- Option list, built inline from `locations`:
  - one `<option>` per active store, `value` and label both `loc.name`, in the order received (already `sortOrder`)
  - if `editFormData.location` is non-empty and not found among the active names, add an extra option with that exact value so the true saved value is displayed and selectable (renamed, deactivated, deleted, or legacy free-text store)
  - if `editFormData.location` is empty, show a `disabled` placeholder option with empty value ("Select a store...") so the control renders sensibly but cannot be re-chosen once a real store is picked (decision #2)
- If `locations` is empty (no stores or fetch failed), the select still renders with only the current value / placeholder, and Save leaves the location unchanged. No crash.
- Cancel is unchanged: `handleCancelEdit` (`:162`) discards `editFormData`, so nothing is persisted.

### 4. No changes to `InventoryRow.jsx`

The display row (`:88–90`) already shows `item.location || 'N/A'` and will reflect the saved value from state.

## Edge cases checklist (from spec)

- No active stores → select shows only current value/placeholder; Save keeps location as-is.
- Store list still loading when edit row opens → same as above; when it arrives, the select re-renders with options.
- Current location not in active list → shown as an extra option, pre-selected.
- Store renamed/deactivated while row open → Save writes the selected name; refreshed on next view load.
- Active location filter no longer matches after save → item drops out of the filtered list via `applyFilters`; expected.
- Second row opened while one is editing → existing reset in `handleEditClick` re-seeds `editFormData.location`.
- Status + location changed in one save → both in `updateData`; transaction unaffected.
- Non-admin user → read-only cell, original location preserved on save (decision #4).
- Archived items → no quick-edit button, nothing to do.

## Out of scope

- Edit full details form, Inventory Summary form, Manage Stores form, `accessoryLocationService.js`.
- Storing a store ID instead of name.
- Stock transfer / ledger logging.
- Any migration of existing `location` values.

## Verification (manual — user runs the app per project rule)

Claude does not run the dev server (live database). Suggested checks for the user, as admin:
- Quick edit a row: Location cell is a dropdown pre-selected to the item's current store, options match Manage Stores active list order.
- Change store, Save: row shows new store; Firestore item `location` updated; other fields intact.
- Change store, Cancel: row shows original store.
- Save without touching the dropdown: location unchanged.
- Change status and location together: both persist, counts adjust as before.
- Quick edit an item whose location is an inactive/renamed store: that name appears and is pre-selected.
- Filter by location, then move an item out of that location: it disappears from the filtered list.
- Log in as a regular user: Location cell in quick edit is read-only text, save preserves location.
- `npm run lint` passes; `npm run build` succeeds.

## Risks / notes

- The store list lives in `filterOptions` state, which is meant for filters. Passing it through as `locations` is the smallest change; if the list is ever needed by more children, lift it to its own state variable.
- Names are the join key, consistent with every other consumer. `createLocation` enforces unique names, so this holds.
- Removing the `originalItem.location` preservation for admins is the one behavioral change to an existing write path; the fallback in step 2 guards against blanking.
