# Plan: Fix Inventory Summary Missing Models

## Context

Phone models with `excludeFromSummary: false` (or unset) are missing from the Inventory Summary Form. The root cause is that `InventorySummaryForm.jsx` builds its display data (`groupedData`) solely from the `inventory` and `procurements` collections. If a model has no qualifying inventory items and no pending procurements, it never gets an entry and is silently hidden — even though it shouldn't be excluded.

The `phones` collection is already fetched in the same function (line 640-641) but only used to build the exclusion set. The fix reuses this snapshot to pre-seed `groupedData` with zero-count entries for all non-excluded models and their RAM/storage configurations.

## File to Modify

`src/components/InventorySummaryForm.jsx` — single file change in `fetchInventoryData` (lines 634-905)

## Implementation Steps

### Step 1: Move declarations above the pre-seeding block

Move the `groupedData` object and filter Sets (currently at lines 661-666) to immediately after line 654, before the new pre-seeding code. This is needed because the pre-seeding loop populates both `groupedData` and the filter Sets.

```
Lines to move: 661-666
New location: after line 654 (after the excluded models log)
```

### Step 2: Insert pre-seeding loop after the moved declarations

Insert a new block that iterates the already-fetched `phonesSnapshot` and seeds `groupedData` with zero-count entries. For each non-excluded phone document:

1. Skip if `excludeFromSummary === true` or missing `manufacturer`/`model`
2. Read `storage_extra` (RAM array), `storage` (storage array), and `colors` (color array) from the phone doc
3. Add manufacturer, model, RAM values, storage values, and colors to the filter Sets
4. Generate the Cartesian product of RAM × Storage — for each combination, create a `groupedData[baseKey]` entry with all counts at zero (matching the existing entry structure at lines 689-703)
5. Skip Cartesian product if either RAM or storage array is empty

This block goes between the moved declarations and the existing inventory fetch (`const inventoryRef = collection(db, 'inventory')` at line 657).

### Step 3: No changes to existing inventory/procurement processing

- **Phase 2 (lines 670-744):** The `if (!groupedData[baseKey])` guard at line 689 will find pre-seeded entries and skip creation, then the count-increment code (lines 724-743) updates them correctly. No duplication risk.
- **Phase 3 (lines 746-825):** Same — procurement processing checks `if (groupedData[baseKey])` at line 765 and updates pre-seeded entries. New configurations from procurements still get created at line 788.
- **Phases 4-6 (lines 828-905):** Sorting, filter options, and state setting all operate on the same data structures and need no changes.

## Edge Cases Handled

| Case | Behavior |
|---|---|
| Model with `excludeFromSummary` unset/undefined | Included (strict `=== true` check) |
| Model with no inventory or procurements | Appears with all zeros |
| Model with empty RAM or storage arrays | Skipped for Cartesian product, still added to filter Sets |
| Inventory item for config not in `phones` collection | Created as before by Phase 2 code |
| Pre-seeded entry later updated by inventory data | Guard `if (!groupedData[baseKey])` prevents overwrite; counts accumulate correctly |

## Verification (user-performed)

The user will manually verify the following against the live app:

1. Phone models with `excludeFromSummary: false` (or unset) and zero inventory now appear with all-zero counts
2. Models with `excludeFromSummary: true` remain hidden
3. Models with existing inventory still show correct counts (not doubled)
4. Each RAM/storage combination from the `phones` collection appears as a separate row
5. Filter dropdowns include all models/RAM/storage from the phones collection
6. Sorting order is preserved: manufacturer → model → RAM (ascending) → storage (ascending)
