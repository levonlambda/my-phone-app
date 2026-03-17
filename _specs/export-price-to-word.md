# Spec for Export Price Configuration to Word

## Summary
Add an "Export" button to the Price Management form header (positioned before the Filters button) that exports the currently displayed/filtered price configurations into a Microsoft Word document. The document format should be consistent with the existing Inventory List export — same blue header (`#34459d`), alternating white/light gray row backgrounds, and similar layout conventions.

## Functional Requirements
- Add an "Export" button with a `FileText` icon after the Refresh button in the Price Management form header bar (consistent with the Export button placement in the Inventory List form).
- The button should be disabled when there is no data to export (i.e., `filteredData` is empty) or while an export is in progress.
- While exporting, the button text should change to "Exporting..." to indicate progress.
- Clicking the button exports only the currently displayed data (`filteredData`), respecting any active filters (manufacturer, model, RAM, storage).
- The exported Word document should contain a table with the following columns: Manufacturer, Model, RAM, Storage, Colors, Dealer's Price, Retail Price, and Margin.
- Each row in the table represents one base price configuration (one manufacturer + model + RAM + storage combination).
- The Colors column should list all available colors for that configuration (e.g., comma-separated).
- Dealer's Price and Retail Price should be formatted with the peso sign and comma separators (e.g., `₱12,500`).
- Margin should be displayed as a percentage (e.g., `15.00%`).
- The document should include a header section with the title "Price Configuration Report", the generated date, the total number of configurations, and a summary of any active filters.
- The table header row should use the brand blue background (`#34459d`) with white text.
- Table body rows should alternate between white and light gray (`#f0f0f0`) backgrounds.
- The generated file should download automatically as a `.doc` file using the HTML-to-Word blob approach (same technique used in the Inventory List export).
- The filename should follow the pattern: `Price_Configuration_<YYYY-MM-DD>.doc`.

## Possible Edge Cases
- No data loaded yet or all items filtered out — the Export button should be disabled.
- A configuration has no colors — the Colors column should show "N/A" or be empty.
- Dealer's price or retail price is zero — margin calculation should display "N/A" rather than `Infinity%` or `NaN%`.
- Very large datasets — the export should still complete without freezing the UI.

## Acceptance Criteria
- The Export button appears in the header bar after the Refresh button, styled consistently with the other header buttons and matching the Inventory List form layout.
- Clicking Export generates and downloads a `.doc` file containing only the currently filtered price configurations.
- The document table includes all required columns: Manufacturer, Model, RAM, Storage, Colors, Dealer's Price, Retail Price, Margin.
- The document styling matches the Inventory List export: blue header, alternating row colors, consistent fonts and spacing.
- The button is disabled and shows "Exporting..." during export, and re-enables after completion.
- The button is disabled when there is no data to export.
- Filter summary is included in the document header section.

## Open Questions
- Should expanded color-specific pricing (where a color has a custom price different from the base) be shown as separate sub-rows in the export, or should only the base configuration row be exported? only the base configuration row should be exported. 
