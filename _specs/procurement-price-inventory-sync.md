# Spec for procurement-price-inventory-sync

## Summary

When a phone procurement is created or edited in the Phone Procurement form, the entered dealer's and retail prices overwrite the matching `price_configurations` documents, but existing `inventory` documents are never updated. As a result, units already in stock keep the price they were stamped with at receiving time, and two identical phones (same manufacturer, model, RAM, storage, color) can display different prices depending on which procurement they arrived through.

This feature fixes that gap: whenever a procurement save results in a price change for a configuration, the system must also batch-update all existing inventory items for that configuration that are still available for sale (in-stock or on-display), so their `dealersPrice` and `retailPrice` match the new pricing — mirroring the behavior that already exists in the Price Management form.

## Functional Requirements

- When creating a new procurement, after the price configuration for an item is updated, all existing `inventory` documents matching that item's manufacturer, model, RAM, storage, and color must have their `dealersPrice` and `retailPrice` updated to the newly entered prices.
- When editing an existing procurement, the same inventory sync must occur for every item whose prices are saved.
- Only inventory items whose status marks them as available for sale (in-stock or on-display) are updated. Items with other statuses (e.g. sold, transferred, reserved, defective/returned) must not be modified, so historical sale records keep the prices they were sold at.
- The inventory update must use Firestore batch writes, consistent with the existing pattern in the Price Management form.
- Only the `dealersPrice` and `retailPrice` fields on inventory documents may change. The `lastUpdated` and `dateAdded` fields must not be touched (same rule the Price Management form already follows).
- Prices written to inventory must be numeric values with comma formatting stripped, consistent with how the procurement form already normalizes prices before writing to `price_configurations`.
- The sync should only run when the saved prices actually differ from the current configuration prices, to avoid unnecessary writes when a procurement is saved with unchanged pricing.
- The user should receive feedback in the save confirmation indicating how many existing inventory items were re-priced (per configuration or in total).
- If the inventory sync fails for an item, the failure must be surfaced to the user rather than silently swallowed, and it must not corrupt or roll back the already-saved procurement record.

## Possible Edge Cases

- A procurement contains multiple items for the same model/spec in different colors with different prices — each color's inventory must receive its own color-specific price, not the price of the last item processed.
- A procurement contains duplicate line items for the exact same configuration with different prices — define deterministic behavior (e.g. last line wins) and apply that consistently to both `price_configurations` and inventory.
- No existing inventory matches the configuration (brand-new model) — the sync is a no-op and must not error.
- More inventory documents match than fit in a single Firestore batch (500-write limit) — updates must be chunked.
- Editing an old procurement re-saves outdated prices, which would push stale prices onto current inventory — confirm this is intended behavior or warn the user before applying (see Open Questions).
- Status values in existing inventory data may vary in casing or wording (e.g. "In Stock", "in-stock", "On Display") — the status filter must match the values actually used by the app.
- Prices entered with commas or as strings vs. numbers — inventory must end up with the same normalized numeric type the Price Management form writes.
- The pending stock from the procurement being saved has not been received yet — those units are not in `inventory` and are unaffected; they will be stamped with the new prices at receiving as they are today.

## Acceptance Criteria

- Creating a procurement for an existing configuration with new prices updates both `price_configurations` and every matching in-stock/on-display `inventory` document to the new `dealersPrice` and `retailPrice`.
- Editing a procurement's item prices produces the same inventory sync.
- Sold (and otherwise unavailable) inventory items retain their original prices after a procurement price change.
- Inventory documents updated by the sync keep their original `lastUpdated` and `dateAdded` values.
- After the fix, two units of the same model/spec/color that are both in stock or on display always show identical pricing following a procurement save.
- Saving a procurement whose prices match the current configuration performs no inventory writes.
- The save confirmation message reports the number of inventory items updated.
- A failure during the inventory sync shows an error to the user and leaves the procurement record itself intact.

## Open Questions

- Which exact `status` values count as "available for sale" in the inventory data (e.g. is there a "Reserved" or "In Transit" status, and should either be re-priced)? - In stock and On-display. In Transit or pending items still do not have their IMEI or Serial Number so it does not count until they are received and their status changed.
- When *editing* an old procurement, should the inventory sync always run, or should the user be warned/asked before old prices overwrite newer pricing set by a later procurement or the Price Management form? - yes the inventory sunc always runs.
- Should the base (colorless) `price_configurations` document also continue to be overwritten by every item, given the existing last-color-wins quirk, or should this fix also make the base-config update smarter? - when updating via the procurement management, lets make the default behavior to update the price for all colors and the base model. 
- Should the confirmation report per-configuration counts or a single total of re-priced units? - single total is fine.
