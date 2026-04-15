# Spec for Procurement Year Filter

## Summary
Add a year filter input to the Procurement Management form's search/filter bar. The field sits between the existing search input and the status dropdown. It defaults to the current year, filters procurement entries by their `purchaseDate` year, and composes with the existing search and status filters. Clearing the field shows all entries regardless of year.

## Functional Requirements
- Add a year input field in the filter bar, positioned between the search-by-supplier/reference/date input and the status dropdown
- The field defaults to the current year (e.g. `2026`) on initial load
- Accepting a valid four-digit year filters `filteredProcurements` to only entries whose `purchaseDate` falls within that year
- When the field is cleared (empty string), the year filter is inactive and all entries are shown regardless of year
- The year filter combines with the existing search term and status filters (all three apply simultaneously)
- The summary section and entry count should reflect the combined filtered results, consistent with how search and status filters already work

## Possible Edge Cases
- Procurement entries with missing or malformed `purchaseDate` values should not match any specific year filter but should appear when the year field is blank (show-all mode)
- Non-numeric or partial input (e.g. `20`, `abcd`) should not crash the filter; only a valid four-digit year should actively filter results
- If no entries match the selected year, display the existing empty-state message ("No entries match your filters")

## Acceptance Criteria
- On page load, the year field displays the current year and only that year's procurements are shown
- Typing a different valid year (e.g. `2025`) updates the list to show only procurements from that year
- Clearing the year field shows all procurements regardless of year
- The year filter works in combination with the search input and status dropdown
- The procurement summary cards and entry count update to reflect the filtered results
- The field is visually consistent with the existing search and status filter controls

## Open Questions
- Should the year field be a free-text input or a dropdown populated from years that have procurement data? Dropdown (but should allow it to be blank or show an ALL option which shows all entries regardless of year)
- Should there be any validation feedback if the user types an invalid year?  yes validate the year field
