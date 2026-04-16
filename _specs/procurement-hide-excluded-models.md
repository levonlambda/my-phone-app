# Spec for Procurement Hide Excluded Models

## Summary
In the Phone Procurement form, after a manufacturer is selected, the device model dropdown currently lists every model belonging to that manufacturer. Models that have the "Exclude this model from Inventory Summary" toggle enabled (`excludeFromSummary === true`) should not appear in this list, since they are intentionally excluded from inventory and pricing surfaces. This is a bug fix to bring the procurement model picker into line with the rest of the app, which already filters these models out of the Inventory Summary and Price Management views.

## Functional Requirements
- After selecting a manufacturer in the Phone Procurement form, the model dropdown must only include models whose `excludeFromSummary` field is not `true`
- Models with `excludeFromSummary` set to `false`, missing, `null`, or `undefined` continue to appear in the dropdown (default behavior — only an explicit opt-out hides a model)
- The filter applies on every manufacturer change, not just initial load
- No other procurement form behavior changes — the rest of the form (specs, pricing, inventory entry) is unaffected
- The existing toggle in the Phone Spec form remains the single source of truth for which models are excluded; no new UI is required

## Possible Edge Cases
- A manufacturer where every model is excluded should result in an empty model dropdown (no fallback to showing excluded models)
- If a model is excluded *after* the user has already selected it in an in-progress procurement, the existing in-progress entry should not be invalidated — the filter only governs what appears in the picker
- Models loaded from a cache (e.g. `usePhoneCache`) must apply the filter consistently with freshly fetched data
- The fix must not affect other places that legitimately need the full model list (Phone List, Phone Spec edit form), only the procurement model picker

## Acceptance Criteria
- Selecting a manufacturer in the Phone Procurement form shows only models where `excludeFromSummary !== true`
- Toggling a model's "Exclude this model from Inventory Summary" field on in the Phone Spec form removes it from the procurement model dropdown on the next render
- Toggling that field off restores the model to the procurement model dropdown
- A manufacturer with all models excluded shows an empty dropdown without errors
- The Inventory Summary, Price Management, and Phone List views continue to behave exactly as before

## Open Questions
- Should the empty-dropdown case display a helpful message (e.g. "All models for this manufacturer are excluded from inventory") or remain silently empty? remain silently empty
