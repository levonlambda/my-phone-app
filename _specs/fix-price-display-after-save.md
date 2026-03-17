# Spec for Fix Price Display Not Updating After Save

## Summary
In the Price Management form (`PriceManagementForm.jsx`), when a user edits a base or color-specific price and clicks Save, the Firestore write succeeds but the displayed price in the table remains unchanged. The updated price only appears after clicking the Refresh button, which re-fetches all data from Firestore. The local state update after save is not correctly reflected in the rendered table.

## Functional Requirements
- After saving a base price edit, the table row must immediately display the new dealers price, retail price, and recalculated margin without requiring a manual refresh.
- After saving a color-specific price edit, the expanded color row must immediately display the new dealers price, retail price, and recalculated margin without requiring a manual refresh.
- When a base price is saved (which updates all colors to the new base price), all expanded color rows for that configuration must also reflect the updated prices immediately.
- The fix must work correctly both when filters are active and when no filters are applied.

## Possible Edge Cases
- Stale closure: `saveBasePrice` and `saveColorPrice` are async functions with multiple `await` calls. By the time the local state update runs, the `phoneData` and `filteredData` references captured in the closure may be stale if re-renders occurred during the async operations (e.g., from `setSavingPriceId`).
- Effect overwrite: The `applyFilters` effect runs whenever `phoneData` changes. After `setPhoneData` is called in the save function, the effect may re-derive `filteredData` from the old or incorrectly-indexed `phoneData`, overwriting the `filteredData` that was also set in the save function.
- Index mismatch: The `index` parameter passed to `saveBasePrice` comes from `filteredData.map()`, but is used to index into `phoneData` (`newPhoneData[index]`). When filters are active, `filteredData` indices do not correspond to `phoneData` indices, so the wrong item in `phoneData` gets updated. The subsequent `applyFilters` effect then derives `filteredData` from the incorrectly updated `phoneData`.
- Concurrent edits: A user rapidly editing and saving multiple rows could cause overlapping async save operations with stale state references.

## Acceptance Criteria
- After a successful base price save, the main table row immediately shows the updated dealers price, retail price, and margin — no refresh needed.
- After a successful color price save, the expanded color row immediately shows the updated dealers price, retail price, and margin — no refresh needed.
- When a base price is saved and the row is expanded, all color sub-rows reflect the updated base price immediately.
- The fix works correctly when filters are applied (i.e., `filteredData` is a subset of `phoneData`).
- The success alert still appears after save as it does today.
- No regressions to Firestore writes — price_configurations, and inventory documents must still be updated correctly.

## Open Questions
- Should the component re-fetch from Firestore after save (simplest fix, but adds a network round-trip) or should it continue to optimistically update local state (more complex, but faster UX)? just re-fetch from firestore after save.
