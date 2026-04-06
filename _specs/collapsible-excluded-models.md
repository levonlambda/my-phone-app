# Spec for Collapsible Excluded Models Section

## Summary
In the Inventory Summary form, the excluded models section (yellow alert box) grows larger as more models are excluded over time, consuming significant vertical space. Make this section collapsible so users can click to expand or collapse the list of excluded models.

## Functional Requirements
- The excluded models section in `InventorySummaryForm.jsx` should be collapsible/expandable by clicking on the header area
- The header area (icon, "Excluded Models (count)" title) should remain always visible when collapsed, acting as the click target to toggle
- When collapsed, the description text and the model pills/badges should be hidden
- When expanded, the section should display exactly as it does today (description text + model pills)
- The default state should be collapsed to save space
- A visual indicator (e.g., chevron icon) should hint that the section is clickable and show the current expand/collapse state

## Possible Edge Cases
- If there are no excluded models, the section is already hidden entirely — no change needed for this case
- The toggle state does not need to persist across page refreshes or navigation — local component state is sufficient

## Acceptance Criteria
- Clicking the excluded models header toggles between showing and hiding the model list
- The header with the icon, title, and count remains visible in both states
- A visual cue (chevron or similar) indicates the section is expandable/collapsible and reflects the current state
- The section defaults to collapsed on initial load
- Expanding and collapsing is smooth and does not cause layout jumps in the surrounding content

## Open Questions
- None
