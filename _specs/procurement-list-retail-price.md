# Spec for Procurement List Retail Price

## Summary
In the Phone Procurement form, the "Add phone to procurement" section already captures both a dealer's price and a retail price per line item, but the Procurement List table below only shows the dealer's price. This leaves staff unable to verify what retail price was entered for each line without re-opening the item. This spec adds a Retail Price column to the Procurement List table without increasing the form's overall width — the extra column is accommodated by narrowing the Manufacturer and Quantity columns.

## Functional Requirements
- Add a new Retail Price column to the Procurement List table in the Phone Procurement form
- Display the retail price for each line item using the same currency/number formatting already used for the dealer's price column
- The form's total width must remain unchanged — only internal column widths change
- The Manufacturer column width is reduced to make room
- The Quantity column width is reduced to make room
- All existing columns continue to display the same data they do today

## Possible Edge Cases
- Line items created before retail price was a first-class field may have a missing or `undefined` retail price; the column should render a safe fallback (e.g. empty, `0.00`, or a dash) consistent with how dealer price currently handles missing values
- Narrowing the Manufacturer column must not break on long manufacturer names — text should wrap or truncate gracefully, matching the existing behavior of other text columns
- Narrowing the Quantity column must still fit realistic quantity values (e.g. up to four digits) without clipping
- If the Procurement List contains no line items, the new column header should still render correctly alongside the existing headers

## Acceptance Criteria
- The Procurement List table shows a Retail Price column that displays the retail price entered in the Add-phone-to-procurement section for every line item
- The form's outer width is identical to the pre-change layout on both desktop and the responsive breakpoints the form already supports
- The Manufacturer and Quantity columns are visibly narrower than before, and the reclaimed space is used by the Retail Price column
- No existing column is hidden or removed
- Formatting of the new Retail Price values matches the existing dealer-price column (same currency symbol, decimal places, thousands separator)
- Adding, editing, or removing a line item updates the Retail Price column in real time, just like the other columns

## Open Questions
- Where in the column order should the Retail Price column sit — immediately to the right of the existing Dealer's Price column, or somewhere else? yes, place it between dealers price and total price
- What label should the new column header use — "Retail Price", "Retail", or something else to match the app's voice? Use Retail Price
- For legacy rows with a missing retail price, should the cell show a blank, a dash, or `0.00`? yes show 0.00

