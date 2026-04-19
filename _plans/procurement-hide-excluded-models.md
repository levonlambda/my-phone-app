# Plan: Procurement Hide Excluded Models

## Context

The Phone Procurement form lets staff pick a manufacturer and then choose a device model from a dropdown when entering a procurement line. Today that dropdown lists every model under the manufacturer regardless of the model's `excludeFromSummary` flag. Since excluded models are intentionally hidden from the Inventory Summary and Price Management views, they shouldn't be procurable either — listing them invites staff to enter procurements for models that aren't being tracked. This plan is a small, surgical fix to filter the procurement model dropdown so it never offers excluded models.

## Spec

`_specs/procurement-hide-excluded-models.md`

## File to Modify

`src/components/PhoneProcurementForm.jsx`

## Background Findings

- The Phone Procurement form does **not** use the shared `usePhoneOptions` hook. It has its own inline `fetchModels` function at `PhoneProcurementForm.jsx:357-385` that queries `collection(db, 'phones')` filtered by `manufacturer` (lines 364-367) and then iterates the matching documents to build a deduplicated, sorted array of model names (lines 371-378).
- The Firestore documents that come back from this query already carry the `excludeFromSummary` boolean field (it lives on each `phones` document, written by `PhoneSpecForm.jsx:350`). So the fix can be done inline in the existing iteration — no extra query, no extra fetch.
- The fix can stay strictly local to `PhoneProcurementForm.jsx`. Other consumers that need the full list (`PhoneSelectionForm` via `usePhoneOptions`, `PhoneListForm` via its own direct query) will continue to work unchanged because the procurement form has its own dedicated fetcher.
- The existing filter pattern used elsewhere in the codebase (e.g. `InventorySummaryForm.jsx:75`, `PriceManagementForm.jsx:78`) is `phoneData.excludeFromSummary === true`. The fix should use the same expression for consistency.
- The model dropdown JSX lives at `PhoneProcurementForm.jsx:1285-1301` and renders `models.map(...)`. No JSX changes are required — filtering at the data layer is sufficient.

## Changes

### 1. Filter excluded models inside `fetchModels`

In `fetchModels` (around lines 371-376 in `PhoneProcurementForm.jsx`), where the snapshot iteration currently extracts every `data.model` into a Set, add a guard so that documents whose `excludeFromSummary` is `true` are skipped before being added to the Set.

- Use the exact expression `data.excludeFromSummary === true` for consistency with the rest of the codebase
- Skip the document entirely when that condition is met (don't add the model name to the Set)
- All other behavior — alphabetical sort, deduplication, error handling — stays the same

### 2. No other changes

- No JSX changes — the dropdown already iterates whatever `models` contains
- No changes to `usePhoneOptions`, `usePhoneCache`, `PhoneSelectionForm`, or `PhoneListForm` — the fix is intentionally scoped to the procurement form's own fetcher so other surfaces that legitimately need the full list are unaffected
- No new state, no new fetch, no extra Firestore reads — the existing query already returns the field we need
- No empty-state message when every model under a manufacturer is excluded — per the spec, the dropdown stays silently empty
- No migration of in-progress procurements — the filter only governs what new selections the picker offers; an already-selected model in an in-progress entry remains valid

## Verification

1. `npm run lint` and `npm run build` succeed without new warnings or errors
2. User opens the Phone Procurement form and confirms:
   - Picking a manufacturer that has at least one model with the "Exclude this model from Inventory Summary" checkbox enabled in the Phone Spec form: that model is **not** in the model dropdown
   - All other (non-excluded) models for that manufacturer still appear
   - Toggling the exclude flag off in the Phone Spec form makes the model reappear in the procurement dropdown on the next manufacturer change / form load
   - A manufacturer where every model is excluded shows an empty dropdown without errors
3. User opens the Phone Selection (inventory entry) form and the Phone List (specs management) view and confirms the full model list — including excluded models — still appears in both, since neither uses the procurement form's fetcher
