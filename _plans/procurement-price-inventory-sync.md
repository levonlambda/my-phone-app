# Plan: Procurement Price Inventory Sync

## Context

When a phone procurement is created or edited, `PhoneProcurementForm.jsx` overwrites the matching `price_configurations` documents with the entered prices but never updates existing `inventory` documents. Units already in stock keep the prices stamped on them at receiving time, so two identical phones can show different prices depending on which procurement they arrived through. This plan makes every procurement save also batch-update the `dealersPrice`/`retailPrice` of all existing sellable inventory (status Stock/On-Hand or On-Display) for the affected configurations, mirroring the pattern already proven in `PriceManagementForm.jsx`.

## Spec

`_specs/procurement-price-inventory-sync.md`

## Decisions locked in by the spec's answered Open Questions

- **Sellable statuses:** Stock and On-Display only. In-transit/pending units are not in `inventory` yet and are unaffected.
- **Edit path:** the sync always runs on procurement edit — no warning dialog.
- **Scope per item:** a price change updates the **base (colorless) config, all color configs, and inventory across all colors** of that model/spec — not just the procured item's color. This supersedes the spec's earlier per-color edge-case bullet; for duplicate lines of the same model/spec, last line wins (deterministic, same as today).
- **Confirmation:** a **single total** count of re-priced units, appended to the existing success alert.

## Files to Modify / Create

- **Create:** `src/services/priceSyncService.js` — new service encapsulating the config + inventory sync for one model/spec
- **Modify:** `src/components/PhoneProcurementForm.jsx` — replace the per-item `updatePriceConfiguration` loops in both the create and edit save paths with calls to the new service

## Background Findings

- **Current write path (create):** `PhoneProcurementForm.jsx:950-988` loops over `procurementItems`, normalizes prices by stripping commas, and calls `updatePriceConfiguration` twice per item — base config, then color config. The edit path at `:869-907` is an exact duplicate of the same loop.
- **`updatePriceConfiguration`** lives in `usePhoneCache.js:67-99`: builds a doc ID like `manufacturer_model_ram_storage[_color]` (lowercased, spaces → `_`) and does a merge `setDoc` into `price_configurations` with numeric prices.
- **The proven inventory-update pattern** is in `PriceManagementForm.jsx:346-371` ("base price" flow): query `inventory` by `manufacturer`, `model`, `ram`, `storage` equality (no color filter → all colors), then `writeBatch` updating **only** `dealersPrice` and `retailPrice` — deliberately not `lastUpdated`. Prices are written as numbers.
- **Actual status values stored on inventory docs:** `'On-Hand'` (displayed as "Stock"), `'On-Display'`, `'Sold'`, `'Reserved'`, `'Defective'`. Some legacy docs may store `'Stock'` literally — several components defensively check `status === 'On-Hand' || status === 'Stock'` (`InventoryRow.jsx:102`, `InventorySummaryForm.jsx:829`). The sync must treat `['On-Hand', 'Stock', 'On-Display']` as sellable.
- **Status filtering should happen client-side**, not in the Firestore query. `PriceManagementForm` already queries on the four spec fields with no status clause; adding a `where('status', 'in', ...)` clause would require a new composite index on the live project. Fetch by spec, filter by status in memory, batch-update the survivors.
- **Firestore batch limit is 500 writes** — the update loop must chunk.
- **All color configs for a spec are discoverable by query:** `price_configurations` docs carry `manufacturer`, `model`, `ram`, `storage`, `color` as fields (`usePhoneCache.js:83-92`), so one equality query on the four spec fields returns the base doc (`color: null`) plus every color doc.
- **Service-layer convention:** functions return `{ success, ...data }` / `{ success: false, error }` (per CLAUDE.md), e.g. `supplierService.createProcurement` used at `PhoneProcurementForm.jsx:945`.
- **Live production database** — no dev-server testing; verification is lint/build plus user-performed manual testing.

## Changes

### 1. New service: `src/services/priceSyncService.js`

Export one async function, `syncModelPricing(manufacturer, model, ram, storage, dealersPrice, retailPrice)`, returning `{ success, updatedInventoryCount, skipped }` on success and `{ success: false, error }` on failure. Behavior:

1. **Normalize prices** to numbers (strip commas, `parseFloat`, default 0) — same normalization as `updatePriceConfiguration`.
2. **Fetch all existing config docs** for the spec: query `price_configurations` where the four spec fields match. This returns the base doc and every color doc that exists.
3. **Skip-if-unchanged check:** if every fetched config doc already holds exactly the new `dealersPrice` and `retailPrice`, return `{ success: true, updatedInventoryCount: 0, skipped: true }` without writing anything (satisfies the "no unnecessary writes" requirement).
4. **Update configs:** merge-write the new prices (with `lastUpdated`) to the base config doc and every existing color config doc, using the same deterministic doc-ID scheme as `updatePriceConfiguration`. Create the base doc if it doesn't exist yet. (The procured item's own color config is guaranteed separately — see change 2.)
5. **Sync inventory:** query `inventory` on the four spec fields (all colors), filter the results client-side to `status ∈ {'On-Hand', 'Stock', 'On-Display'}`, and batch-update only `dealersPrice` and `retailPrice` (as numbers) in chunks of ≤500. Do **not** write `lastUpdated` or `dateAdded`. An empty match set is a successful no-op.
6. Return the total number of inventory docs updated.

### 2. `PhoneProcurementForm.jsx` — replace both per-item loops

In both the **create** path (`:950-988`) and the **edit** path (`:869-907`):

- **Dedupe first:** reduce `procurementItems` to unique model/spec keys (`manufacturer|model|ram|storage`), keeping the **last** line's prices for each key. This makes duplicate-line behavior deterministic and prevents redundant queries when one procurement has several colors of the same model.
- For each unique spec, call `updatePriceConfiguration(..., item.color)` for the procured item's color (so a first-ever color still gets its config doc created — the service only updates colors that already exist), then call `priceSyncService.syncModelPricing(...)` with that spec's final prices.
- Accumulate `updatedInventoryCount` across all specs, and collect any per-spec errors instead of only `console.error`-ing them.
- **Success alert:** append one line to the existing create and edit alerts, e.g. `"Existing inventory re-priced: N item(s)"` (single total per the spec decision).
- **Error surfacing:** if any spec's sync failed, append a warning line to the alert naming the affected model(s) and stating that the procurement itself was saved but those inventory prices were not synced. The procurement save result is never rolled back.
- Remove the now-redundant direct base-config `updatePriceConfiguration` calls from the loops (the service handles base + all colors).

### 3. No other changes

- `StockReceivingForm.jsx` is untouched — pending units keep being stamped at receiving from the procurement's prices, which now match the configs.
- `PriceManagementForm.jsx` is untouched; it remains the manual back-fill tool and its behavior is the model for this sync.
- No Firestore indexes, no schema changes, no changes to `supplierService.createProcurement`/`updateProcurement`.

## Verification

1. `npm run lint` and `npm run build` succeed with no new warnings or errors.
2. **User-performed manual testing** (live DB — per project rules, Claude never runs the app or touches data; the user tests with real, low-risk entries they are prepared to make):
   - Create a procurement for an existing model/spec with a changed dealer's and retail price → the success alert reports the number of re-priced units; the Inventory list shows every Stock and On-Display unit of that model (all colors) at the new prices; Price Management shows the base and all color configs at the new price.
   - Confirm a Sold unit of the same model kept its old prices, and that re-priced units kept their original `lastUpdated`/`dateAdded` dates in the inventory table.
   - Edit an existing procurement's item price → same sync occurs, alert reports the count.
   - Save a procurement with prices identical to the current configuration → alert reports 0 re-priced items (no writes).
   - Create a procurement containing two colors of the same model on separate lines → both colors' inventory and configs end at the last line's price (documented last-line-wins).
   - Procure a brand-new model with no existing inventory → save succeeds, alert reports 0 re-priced items.
