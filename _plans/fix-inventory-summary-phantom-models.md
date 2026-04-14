# Plan: Fix Inventory Summary Phantom Models

## Context

The Inventory Summary form displays phone models that don't exist in the `phones` collection (Phone List). These "phantom" entries likely result from direct database edits or model reassignment on archived items. The fix ensures only models with a matching `phones` document appear in the summary.

Spec: `_specs/fix-inventory-summary-phantom-models.md`

## File to modify

`src/components/InventorySummaryForm.jsx` — the `fetchInventoryData` function (starts at line 635)

## Implementation

### Step 1: Build a `validModels` set from the existing phones query (lines 644–653)

The phones collection is already fully fetched at line 642. Merge into the existing `phonesSnapshot.forEach` loop to build both `excludedModels` and `validModels` in one pass:

```
const validModels = new Set();
// Inside the existing phonesSnapshot.forEach:
if (phoneData.manufacturer && phoneData.model) {
  validModels.add(`${phoneData.manufacturer}_${phoneData.model}`);
}
```

No additional Firestore queries needed.

### Step 2: Add phantom model check at the three filtering points

At each location where `excludedModels.has(modelKey)` is checked, add a second condition for `!validModels.has(modelKey)`:

1. **Price configurations** (line 675): After `if (excludedModels.has(modelKey)) return;`, add:
   ```
   if (!validModels.has(modelKey)) {
     console.log(`Skipping phantom model from price config: ${config.manufacturer} ${config.model}`);
     return;
   }
   ```

2. **Inventory items** (line 713): After the existing `excludedModels` check, add:
   ```
   if (!validModels.has(modelKey)) {
     console.log(`Skipping phantom model from inventory: ${item.manufacturer} ${item.model}`);
     return;
   }
   ```

3. **Procurements** (line 796): After the existing `excludedModels` check, add:
   ```
   if (!validModels.has(modelKey)) {
     console.log(`Skipping phantom model from procurement: ${item.manufacturer} ${item.model}`);
     return;
   }
   ```

## Verification

- Run `npm run build` to confirm no compilation errors.
- User manually tests the Inventory Summary form to confirm phantom models are gone and valid models still display correctly.
