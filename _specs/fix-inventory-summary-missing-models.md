# Spec for Fix Inventory Summary Missing Models

## Summary

Some phone models that do **not** have "Exclude this model from Inventory Summary" checked in the Phone Spec Form are still missing from the Inventory Summary Form. Investigation reveals that the `excludeFromSummary` field is saved and read consistently (`PhoneSpecForm.jsx:350` → `InventorySummaryForm.jsx:647`), so the bug is not a field-name mismatch. Instead, additional implicit filtering conditions in `InventorySummaryForm.jsx` silently drop models that have no qualifying inventory or procurement data.

### Root Causes Identified

The inventory summary only displays a model if it has **at least one** of the following:
1. An inventory item with status **'On-Display'** or **'On-Hand'/'Stock'** (`InventorySummaryForm.jsx:724-743`)
2. An inventory item with status **'Sold'** whose `lastUpdated` falls within the **current calendar month** (`InventorySummaryForm.jsx:724-730`, helper at lines 612-631)
3. A procurement with `deliveryStatus === 'pending'` (`InventorySummaryForm.jsx:754`)

If a model has none of the above (e.g., all units were sold in previous months and there are no pending procurements), it is silently excluded from the summary — even though its `excludeFromSummary` flag is `false`. There is no visual indication to the user explaining why the model is absent.

## Functional Requirements

- Models with `excludeFromSummary: false` (or unset) must appear in the Inventory Summary Form regardless of whether they currently have qualifying inventory or procurement data.
- Models that appear with zero stock across all statuses should display zeros (or dashes) rather than being hidden.
- The existing `excludeFromSummary: true` behavior must continue to work — those models should remain hidden.
- No changes to how data is written to Firestore; this is a read/display-side fix only.

## Possible Edge Cases

- A model exists in the `phones` collection but has **never** had any inventory items or procurements — it should still appear with all-zero counts.
- A model has inventory items with unexpected or legacy status values (not 'Sold', 'On-Display', 'On-Hand', or 'Stock') — decide whether these count or are ignored.
- A model's `excludeFromSummary` field is missing/undefined (older records) — should be treated as `false` (not excluded).
- Multiple RAM/storage configurations exist for the same model — each configuration should have its own row even if some configurations have zero stock.
- Large number of models with zero stock could clutter the summary — consider whether a toggle/filter for "show models with zero stock" is useful.

## Acceptance Criteria

- All phone models where `excludeFromSummary` is `false` or unset appear in the Inventory Summary, including those with no current inventory or pending procurements.
- Models with zero units across all statuses show zero values (not omitted).
- Models with `excludeFromSummary: true` remain hidden from the summary.
- Existing sorting behavior (manufacturer → model → RAM → storage) is preserved.
- Filter dropdowns still reflect all visible models and their configurations.

## Open Questions

- Should models with zero stock across all columns be shown by default, or behind a "Show empty models" toggle to reduce clutter? yes provided the exclude this model from inventory summary is not checked for that model
- Should each RAM/storage configuration from the `phones` collection be listed even if no inventory item with that configuration has ever existed? yes
- Are there any legacy status values in the inventory collection that should now be treated as valid statuses? no
