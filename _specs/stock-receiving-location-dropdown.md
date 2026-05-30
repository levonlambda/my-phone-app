# Spec for stock-receiving-location-dropdown

## Summary

The Stock Receiving form (`src/components/StockReceivingForm.jsx`) currently exposes a free-text **"Set all locations to:"** field. A user types an arbitrary location string and clicks **Apply to All**, which copies that text into the `location` field of every line item in the receiving batch.

Because the input is free text, users can introduce typos and inconsistent location names (e.g. "Stockroom A" vs "stockroom a" vs "Main"), which fragments inventory data across non-matching location strings.

This feature replaces the free-text **"Set all locations to:"** input with a **dropdown** whose options are the existing store names managed in the **Manage Stores (Locations)** form (`src/components/accessories/AccessoryLocationModal.jsx`). Those store names are stored in the `accessory_locations` Firestore collection and read through `accessoryLocationService.js` (`getActiveLocations` / `getAllLocations`). Selecting a store from the dropdown and applying it sets every line item's location to a consistent, canonical store name.

## Functional Requirements

- Replace the free-text input for **"Set all locations to:"** in the Stock Receiving form with a dropdown (select) control.
- The dropdown's options are the **store names** defined in the Manage Stores (Locations) form, sourced from the `accessory_locations` collection via the existing location service.
- Only **active** stores should appear as selectable options (consistent with how other forms consume locations via `getActiveLocations`).
- Options should be presented in the same sort order used elsewhere (by the store's `sortOrder`, ascending).
- The dropdown should include a neutral placeholder option (e.g. "Select a store…") that is shown when no store is chosen.
- The **Apply to All** button keeps its current behavior: when a store is selected and the button is pressed, every line item's `location` field is set to the selected store name, and any existing per-row location validation errors are cleared.
- If a primary/default store exists, it may be pre-selected in the dropdown as a convenience (see Open Questions).
- The dropdown and button must respect the form's existing `isViewOnly` (read-only) state — both disabled when the form is view-only.
- The visual styling, label, `MapPin` icon, and overall layout of the bulk-location section should remain consistent with the current form.

## Possible Edge Cases

- **No stores defined:** The `accessory_locations` collection is empty or returns no active stores. The dropdown should degrade gracefully (e.g. show only the placeholder, with Apply to All disabled or a no-op) rather than break.
- **Stores fail to load:** The location fetch returns an error or is still loading when the form renders. The dropdown should not crash and should ideally indicate a loading/empty state.
- **Existing line items reference a location not in the store list:** When viewing/editing a previously saved receiving record whose `location` values don't match any current store name (e.g. a store was renamed or deleted). The bulk dropdown selection is independent of per-row values, so this mainly affects whether per-row fields stay consistent (see Open Questions on the per-row field).
- **Store renamed or deleted after selection:** A store the user selected no longer exists when they apply. Applying should still write the currently selected name; stale options should refresh when stores are reloaded.
- **Apply to All pressed with no store selected (placeholder active):** Should be a no-op (mirroring the current guard that ignores an empty value).
- **Long store names:** Dropdown should not overflow or break the layout within the existing `min-w-[240px] max-w-[320px]` container.
- **View-only mode:** The control must be disabled and not allow changes.

## Acceptance Criteria

- The **"Set all locations to:"** control in the Stock Receiving form is a dropdown, not a free-text input.
- The dropdown lists the active store names from the Manage Stores (Locations) form, in `sortOrder`.
- Selecting a store and clicking **Apply to All** sets every line item's location to the selected store name and clears related per-row location errors.
- A placeholder option is shown when nothing is selected, and Apply to All does nothing while the placeholder is active.
- When there are no active stores, the form still renders without errors and the control behaves sensibly.
- The dropdown and Apply to All button are disabled in view-only mode.
- No changes are made to any live Firestore data as part of this feature; it only **reads** existing store names. (Per CLAUDE.md, the database is live production data.)
- Layout, label, and icon remain visually consistent with the current design.

## Open Questions

- **Per-row location field:** Each line item also has its own free-text `location` input. Should that per-row field also be converted to the same store-name dropdown for full consistency, or is only the bulk "Set all locations to" field in scope for this change? - Each line item should also be converted to the same store-name dropdown but pressing the Apply to ALl button will automatically set the location to whatever the Set all locations to: field is set on.
- **Cross-module source of truth:** Store names currently live in the **accessories** module (`accessory_locations` collection / `accessoryLocationService.js`), while the Stock Receiving form is in the phone module. Is it acceptable for the phone Stock Receiving form to read from `accessory_locations`, or should there be a shared/renamed "stores" source used by both modules? - yes its fine to read from accessory_locations
- **Default selection:** Should the primary store (`isPrimary`) be pre-selected by default when the form loads, or should the dropdown start on the placeholder? - yes the primary store should be pre-selected by default.
- **Store value stored:** Should the line item store the store **name** (current behavior, free text) or a store **ID/reference**? Storing the name keeps it backward-compatible with existing records; storing an ID would be more robust against renames but is a larger change. - for now just store the name to make it backward compatible.
- **Inactive stores on existing records:** If a saved record references a store that is now inactive or deleted, how should that be surfaced (if at all) in this form? - show the saved record references store name even if that name is inactive. this only applies to a saved record references, for new stock receiving entries it should only show the active store locations.
