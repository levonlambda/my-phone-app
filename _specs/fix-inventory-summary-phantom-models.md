# Spec for Fix Inventory Summary Phantom Models

## Summary
The Inventory Summary form currently displays phone models that do not exist in the Phone List form (`phones` collection). This results in "phantom" entries appearing in the summary — models that have inventory or pricing data but no corresponding phone definition. The root cause needs investigation, but likely candidates include: direct database edits changing an inventory item's model field, or re-assigning a model on an already-archived item. The fix should ensure the Inventory Summary only includes items whose model exists in the `phones` collection.

## Functional Requirements
- The Inventory Summary form must cross-reference every model it aggregates (from `inventory`, `price_configurations`, and `procurements`) against the `phones` collection.
- Any inventory item, price configuration, or procurement whose `manufacturer` + `model` combination does not match an existing document in the `phones` collection must be excluded from the summary display.
- The existing `excludeFromSummary` filtering should continue to work as-is alongside this new validation.

## Possible Edge Cases
- An item whose model was valid at entry time but whose phone definition was later deleted or renamed.
- Items where the `manufacturer` matches a phone entry but the `model` field differs due to a direct database edit (e.g., typo, case mismatch).
- Price configurations that reference models no longer in the `phones` collection.
- Procurement items referencing models that have since been removed from the phone list.
- Models that exist in `phones` but with a slightly different string format (e.g., trailing spaces, different casing) — the matching logic should account for this.

## Acceptance Criteria
- The Inventory Summary form only displays rows for models that have a matching entry in the `phones` collection.
- Phantom models (those without a matching phone definition) no longer appear in the summary.
- Existing items that belong to valid phone models continue to display correctly with no data loss.
- The `excludeFromSummary` flag continues to function as before.

## Open Questions
- What is the confirmed root cause of phantom models appearing? (Needs investigation — suspected causes: direct database edits to inventory item model fields, or model reassignment on archived items.)
- Should we log or surface a warning somewhere (e.g., console, admin notification) when orphaned inventory items are detected, to help identify data inconsistencies? you can write a console message for debugging purposes
- Should there be a cleanup step or admin tool to reconcile orphaned inventory records with the phone list? no need. just hide the phantom models in inventory summary form
