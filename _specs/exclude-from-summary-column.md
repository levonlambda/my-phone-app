# Spec for Exclude From Summary Column

## Summary
Add a new column to the device models table (PhoneListForm) that displays the current value of the "Exclude this model from Inventory Summary" field for each model. The column should show "True" or "False" so users can quickly see which models are excluded without having to open the edit form.

## Functional Requirements
- Add a new column to the device models table in `PhoneListForm.jsx` labeled "Excluded" (or similar concise header)
- The column should display "True" if the model's `excludeFromSummary` field is `true`, and "False" otherwise
- The value should default to "False" for models that do not have the `excludeFromSummary` field set (backwards compatible with older records)
- The column should be placed after the existing "Colors" column and before the "Actions" column
- The column width should be consistent with the existing table layout

## Possible Edge Cases
- Models created before the `excludeFromSummary` field was introduced may have `undefined` or missing values — these should display as "False"
- Table width may need adjustment to accommodate the new column without breaking the layout on smaller screens

## Acceptance Criteria
- The device models table displays a new column showing "True" or "False" for each model's exclude-from-summary status
- Models with `excludeFromSummary: true` show "True"
- Models with `excludeFromSummary: false`, `undefined`, or missing show "False"
- The table layout remains visually consistent and does not overflow or break on standard screen sizes
- No changes to the underlying data or form behavior — this is a read-only display column

## Open Questions
- Should the column header be "Excluded", "Exclude from Summary", or something else? yes Excluded is fine.
- Should this column be sortable or filterable? No need to be sortable or filterable.
