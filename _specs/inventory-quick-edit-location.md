# Spec for inventory-quick-edit-location

## Summary

The Inventory List form (`src/components/InventoryListForm.jsx`) lets a user click the **Quick edit** (pencil) button on a row to edit the item inline via `src/components/inventory/InventoryEditForm.jsx`. In that inline edit row, most fields become editable inputs, but the **Location** column is rendered as read-only text, and the save handler in `src/components/inventory/InventoryTable.jsx` deliberately copies the original item's location back into the update so it can never change.

Today the only way to move a phone to a different store is through the **Edit full details** form. This feature makes **Location** editable directly inside the quick-edit row as a dropdown.

The dropdown's options come from the same source as the **"Set all locations to:"** dropdown in the Stock Receiving form (`src/components/StockReceivingForm.jsx`): the **Manage Stores** locations stored in the `accessory_locations` Firestore collection, read through the existing `getActiveLocations` helper in `src/services/accessoryLocationService.js`. The displayed and saved value is the store's `name` field, which matches how `location` is already stored on inventory records and how the Inventory List's location filter works.

## Functional Requirements

- In the quick-edit row, replace the read-only Location text with a **dropdown (select)** control, styled consistently with the existing Supplier and Status dropdowns in the same row.
- The dropdown options are the **active** store names from `accessory_locations`, loaded via `getActiveLocations`, presented in the same `sortOrder` used by the Stock Receiving form and the Inventory List location filter.
- The dropdown pre-selects the item's **current** location when the quick-edit row opens.
- If the item's current location is not among the active store names (store renamed, deactivated, deleted, or legacy free-text value), that current value must still appear as a selectable option so the row displays the true saved value and the user can leave it unchanged.
- If the item has no location, the dropdown shows a neutral placeholder (e.g. "N/A" / "Select a store…") matching the existing "N/A" display convention.
- The saved value is the store **name** (string), not a store ID, to stay backward-compatible with existing inventory records, the location filter, the Inventory Summary, and the Stock Receiving form.
- On **Save**, the quick-edit update writes the selected location to the inventory item, along with the other edited fields and the existing `lastUpdated` behavior. The current "preserve original location" behavior in the save handler is removed.
- On **Cancel**, no location change is persisted and the row returns to its normal display showing the original location.
- After a successful save, the row (and any active location filter / sort) reflects the new location without requiring a page reload, consistent with how other quick-edited fields update local state.
- The location list should be loaded once per Inventory List view (reusing the list already loaded for the location filter where practical) rather than re-fetched for every row that enters edit mode.
- Archived items remain read-only; the quick-edit button is not shown for them, so no location change is possible on archived records.
- The **Edit full details** form is out of scope and keeps its current behavior.

## Possible Edge Cases

- **No active stores defined:** The dropdown should still render (placeholder plus the item's current value, if any) and Save should not fail.
- **Store list fails to load or is still loading:** The quick-edit row must not crash. The item's current location remains selected and can still be saved unchanged.
- **Current location not in the active list:** Covered above; the stale value is shown as an option. Once the user switches to an active store and saves, the stale option no longer needs to appear on later edits of that item.
- **Store deactivated/renamed while the edit row is open:** Save writes whatever name the user selected; a later reload shows the refreshed list.
- **Location filter active while editing:** If the user changes an item's location to one that no longer matches the active filter, the item may disappear from the filtered list after save. This should be expected behavior and not an error.
- **Quick-edit row opened for a second item while one is already open:** Existing behavior of resetting the edit state applies; the location dropdown must populate from the newly selected item.
- **Sorting by Location column:** After a save that changes location, the row should sort into its new position on the next render.
- **Status change and location change in the same save:** Both must persist; the existing `inventory_counts` status transaction must continue to work unchanged.
- **Long store names:** The dropdown should not break the existing table column widths.

## Acceptance Criteria

- Clicking **Quick edit** on an inventory row shows a Location dropdown in place of the read-only location text.
- The dropdown lists the active Manage Stores locations by name, in the same order as the Stock Receiving form's "Set all locations to:" dropdown.
- The item's current location is pre-selected, even when it is not an active store.
- Choosing a different store and clicking **Save** updates the item's `location` in Firestore and in the on-screen list.
- Clicking **Cancel** discards the location change.
- Saving without touching the dropdown leaves the location unchanged (no accidental blanking).
- Other quick-edit fields (manufacturer, model, RAM, storage, color, IMEI, serial number, supplier, status) continue to save exactly as before, including the status-count transaction.
- The Inventory List location filter continues to work with the newly saved values.
- The feature only **reads** from `accessory_locations`; it never creates, edits, or deletes store records. Inventory writes are limited to the user's explicit Save action on a single item, consistent with the existing quick-edit behavior (per CLAUDE.md, the database is live production data).
- `npm run lint` passes.

## Open Questions

- **Audit / transfer record:** Should changing a phone's location through quick edit also record a stock transfer or ledger entry, or is a plain field update sufficient (as it is today in the Edit full details form)? - for now no need to record a stock transfer or ledger entry. its a plain field update.
- **Blanking a location:** Should the user be allowed to clear the location back to empty/"N/A" from the quick-edit dropdown, or must a store always be selected once one exists? - no a store must always be selected once one exist
- **Inventory Summary form:** The Inventory Summary form also loads locations from `accessory_locations`. Should its per-item editing (if any) get the same dropdown treatment, or is this change limited to the Inventory List quick-edit row?  this change is limited to the inventory list quick edit row.
- **Role restriction:** Should changing location be available to both `user` and `admin` roles, matching the rest of quick edit, or admin only? -admin only
