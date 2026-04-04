# Spec for Inventory Summary Word Export

## Summary
Add an "Export" button to the Inventory Summary form (next to the Refresh button) that exports the currently filtered inventory summary data into a Microsoft Word (.doc) document. The export should follow the same approach and visual style as the existing Inventory List export in `InventoryListForm.jsx`, but adapted for the summary's grouped/aggregated data. The document layout should be **landscape** to accommodate all columns.

## Functional Requirements

- Add an "Export" button in the `CardHeader`, positioned after the existing "Refresh" button, using the same styling pattern (white button with blue text, `FileText` icon).
- The button should be disabled when there is no data to export (`filteredData.length === 0`) or while an export is in progress.
- The button label should show "Exporting..." with a disabled state while the export is being generated.
- Only export the rows currently visible after filters are applied (i.e., use `filteredData`, not `inventoryData`).
- Generate an HTML-based `.doc` file (same blob/download approach as `InventoryListForm.jsx`), with the MIME type `application/vnd.ms-word;charset=utf-8`.
- The downloaded file should be named `Inventory_Summary_YYYY-MM-DD.doc`.

### Document Layout and Styling
- **Page orientation:** Landscape (`size: 11in 8.5in` in the `@page` CSS rule) to fit all columns.
- **Page margins:** 0.5in on all sides (consistent with the Inventory List export).
- **Title:** "Inventory Summary Report", centered, using the same blue color (`#34459d`), bold, 21pt font.
- **Header info:** Generated date (formatted as full month name, day, year) and total configurations count.
- **Filter summary:** A line listing the currently applied filters (Manufacturer, Model, RAM, Storage, Color) showing "All" when no filter is selected for that field.
- **Table header row:** Background color `#34459d` with white bold text (matching the Inventory List export).
- **Table rows:** Alternating between white and light gray (`#f0f0f0`) backgrounds, grouped by configuration row.
- **Font:** Arial, 9-10pt for table content (consistent with the Inventory List export).
- **Borders:** 1pt solid `#ddd` on table cells, 1pt solid `#34459d` on header cells.

### Table Columns
The exported table should include these columns for each inventory configuration:
1. **Manufacturer**
2. **Model** (formatted as "Model (RAMxGB+StorageGB)", e.g., "Galaxy S24 (8GB+256GB)")
3. **Colors** (comma-separated list of all colors for that configuration)
4. **DP** (Dealer's Price, formatted with peso sign and commas)
5. **SRP** (Retail Price, formatted with peso sign and commas)
6. **Margin** (percentage, only included if the current user is an admin)
7. **Sold** (current month sold count)
8. **Display** (on-display count)
9. **Stock** (on-hand count)
10. **Available** (total available count)
11. **Pending** (pending procurement count)

### Summary Section in Document
- After the main table, include an "Inventory Value Summary" section (only for admin users) showing:
  - Total Dealer's Value (available units x dealer's price)
  - Total Retail Value (available units x retail price)
  - Potential Profit (retail value minus dealer's value) with margin percentage
  - Total available units count

### Data Ordering
- Rows should be sorted in the same order as displayed on screen: by manufacturer, then model, then RAM (numeric ascending), then storage (numeric ascending).

## Possible Edge Cases
- No data matches the current filters: the Export button should be disabled, preventing empty document generation.
- Configurations with zero counts across all status columns should still be included if they appear in `filteredData` (e.g., items that only have pending procurement counts).
- Price values of 0 or missing should display as "₱0" rather than "N/A" in the export (consistent with how `formatPrice` works in the component).
- Admin vs. non-admin: the Margin column and Inventory Value Summary section should only appear for admin users.
- Very long color lists for a single configuration should wrap naturally within the cell.
- Excluded models info does not need to appear in the export since those models are already filtered out of the data.

## Acceptance Criteria
- Clicking the Export button downloads a `.doc` file that opens correctly in Microsoft Word.
- The document is in landscape orientation.
- The document header, table styling, and color scheme are visually consistent with the Inventory List export.
- Only configurations matching the currently applied filters are included in the export.
- The filter summary in the document accurately reflects which filters were active at export time.
- The Margin column and Inventory Value Summary section only appear when the logged-in user is an admin.
- The Export button is disabled and shows "Exporting..." while the document is being generated.
- The Export button is disabled when there is no data to export.
- Row data matches what is displayed on screen (same counts, same prices, same sort order).

## Open Questions
- Should the color breakdown (per-color counts for sold/display/stock) be included as sub-rows in the export, or only the aggregated totals per configuration? (Recommendation: only aggregated totals to keep the document concise and readable.) only aggregated totals.
- Should the "Sold" column header note that it only includes current month sales, or is the header "Sold" sufficient? the header sold is sufficient.
