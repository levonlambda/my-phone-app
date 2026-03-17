# Plan: Fix Price Display Not Updating After Save

## Context
In `PriceManagementForm.jsx`, after editing and saving a base or color-specific price, the Firestore write succeeds but the displayed price in the table doesn't update. The user must click Refresh to see the new value. The root cause is that the manual local state updates in `saveBasePrice` and `saveColorPrice` are unreliable due to stale closures, index mismatches (filteredData index used on phoneData), and the `applyFilters` effect overwriting `filteredData`. The decided approach: re-fetch from Firestore after save instead of manually patching local state.

## File to Modify
- `src/components/PriceManagementForm.jsx`

## Changes

### 1. Add a `skipLoading` parameter to `fetchPhoneData` (line ~549)
Avoid a full-screen loading spinner flash when re-fetching after save. Change the signature to accept an optional parameter:
- `const fetchPhoneData = useCallback(async (skipLoading = false) => {`
- Wrap `setLoading(true)` in: `if (!skipLoading) setLoading(true);`
- The `useEffect` and Refresh button calls remain unchanged (no argument = shows spinner as before).

### 2. Simplify `saveBasePrice` (lines ~371–415)
Replace the manual state update block (creating `newPhoneData`, `newFilteredData`, `setForceUpdate`) with a single call:
```
await fetchPhoneData(true);
```
Keep everything before it (Firestore writes to `price_configurations`, inventory batch update) and after it (`handleCancelEdit()`, `setSavingPriceId(null)`, alert).

### 3. Simplify `saveColorPrice` (lines ~479–529)
Same approach — replace the manual state update block with:
```
await fetchPhoneData(true);
```
Keep the Firestore writes before and the cleanup/alert after.

### 4. Remove `forceUpdate` state (line ~38)
The `forceUpdate` state and `setForceUpdate` calls only existed to work around the stale-state display bug. After this fix:
- Remove `const [forceUpdate, setForceUpdate] = useState(0);` (line 38)
- Remove `forceUpdate` from the table row `key` (line 944) — use the existing key parts without it

## Verification (manual — to be performed by the user only)
**Important:** The database contains live production data. Claude must NOT run the dev server or interact with the app to test. Only the user should perform these verification steps.

1. Run `npm run dev` and open the Price Management form
2. Edit a base price → Save → confirm the table row immediately shows the new price and margin (no refresh needed)
3. Expand a row, edit a color-specific price → Save → confirm the color row immediately shows the new price
4. Apply filters, then edit a price → Save → confirm it updates correctly with filters active

**Claude can run:** `npm run lint` to verify no code issues.
