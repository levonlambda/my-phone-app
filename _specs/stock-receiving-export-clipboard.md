# Spec for stock-receiving-export-clipboard

## Summary

The Stock Receiving form (`src/components/StockReceivingForm.jsx`) can be opened in **view-only mode** to review a previously received procurement. In that mode the header shows the title "Stock Receiving (View Only)" and a single red **Close** button on the right.

This feature adds an **Export** button to that header, positioned directly beside the red Close button, that is visible **only in view-only mode**. Clicking it copies a plain-text summary of the received items to the user's clipboard so it can be pasted into a chat message, email, or document.

The summary groups received units by **model + RAM + storage**. Color is intentionally ignored, so units of the same model/RAM/storage in different colors are merged into one group. Under each group heading, the export lists each unit's **IMEI1**, or its **Serial Number** when the unit has no IMEI1.

## Functional Requirements

- Add an **Export** button to the Stock Receiving form header, placed immediately beside (to the left of) the existing red Close button, in the same header row.
- The Export button is rendered **only when the form is in view-only mode**. It must not appear while creating or editing a stock receiving entry.
- The button should carry a clipboard/copy style icon and a short label (e.g. "Export" or "Copy"), sized and styled to sit visually alongside the Close button without changing the header height or layout.
- Clicking the button builds a plain-text summary of the currently displayed received items and writes it to the system clipboard.
- **Grouping:** units are grouped by the combination of model, RAM, and storage. Color is **not** part of the grouping key, so differently colored units of the same model/RAM/storage appear under a single group.
- **Group heading:** each group is introduced by a heading line that identifies the model, RAM, and storage (e.g. "iPhone 15 Pro 8GB / 256GB"). Including the manufacturer in the heading is an open question below.
- **Group contents:** under each heading, one line per unit containing the unit's IMEI1. If a unit has no IMEI1, its Serial Number is used instead.
- Units within a group are listed in the same order they appear in the on-screen table, and groups appear in the same order as the on-screen group sections (first appearance of each model/RAM/storage combination).
- A blank line separates groups so the pasted output is readable.
- After a successful copy, the user receives brief visual confirmation (e.g. a toast or the button label temporarily changing to "Copied"). The confirmation should clear on its own.
- If the clipboard write fails, the user is shown a short error message and nothing else changes.
- The export is **read-only**. It must not write to Firestore or alter any form state beyond the transient confirmation feedback.

## Possible Edge Cases

- **Unit has neither IMEI1 nor Serial Number:** older or malformed records may be missing both. The line should fall back to a clear placeholder (e.g. "(no identifier)") rather than an empty line, or be omitted (see Open Questions).
- **Mixed colors in one group:** two colors of the same model/RAM/storage are received. Their units must be merged into one group with a single heading and a combined unit count.
- **No items received:** the viewed procurement has zero units. The button should either be disabled or copy a short "no items" message rather than an empty string.
- **Clipboard API unavailable or blocked:** some browsers deny clipboard writes outside a secure context or without a user gesture. The failure path must surface an error without crashing the form.
- **Whitespace in identifiers:** IMEI1 or Serial Number values with leading/trailing spaces should be trimmed in the output.
- **Duplicate identifiers:** if two units share the same IMEI1 or Serial Number (data error), both lines are still emitted; the export does not deduplicate.
- **Long lists:** a procurement with many units should still copy as a single text block without truncation.
- **Create/edit mode:** the button must remain hidden even if the user partially fills the form; its visibility depends solely on view-only mode.
- **Rapid repeated clicks:** multiple quick clicks should not produce overlapping or stuck confirmation states.

## Acceptance Criteria

- In view-only mode, an Export button appears in the header directly beside the red Close button.
- In create/edit mode, no Export button is rendered.
- Clicking Export places plain text on the clipboard that can be pasted into any text field.
- The pasted text contains one group per unique model + RAM + storage combination, with color ignored and same-color-agnostic units merged.
- Each group has a heading identifying model, RAM, and storage, followed by one line per unit.
- Each unit line shows the IMEI1, or the Serial Number when IMEI1 is empty.
- Groups are separated by a blank line and appear in on-screen order.
- The user sees a brief confirmation after a successful copy, and a short error if the copy fails.
- The feature performs no writes to Firestore, Authentication, or Cloud Storage (per CLAUDE.md, the database is live production data).
- Header layout, title, and Close button behavior are unchanged.

## Open Questions

- **Heading format:** Should the group heading include the manufacturer (e.g. "Apple iPhone 15 Pro 8GB / 256GB") or just model + RAM + storage? Should the unit count be appended (e.g. "(3 pcs)")? - include the manufacturer
- **Identifier labeling:** Should each unit line be the bare value (e.g. "356938035643809"), or prefixed to indicate type (e.g. "IMEI: …" / "SN: …")? Bare values are easier to paste into other systems; prefixes make mixed lists clearer. - bare values
- **Missing both identifiers:** For a unit with no IMEI1 and no Serial Number, should the export emit a placeholder line, skip the unit, or include a note in the heading? - skip the unit. there should not be any unit without an IMEI1 and no Serial Number, one of them should exist.
- **Include IMEI2:** The form also captures IMEI2. Should it be excluded entirely (current assumption) or appended after IMEI1? - no need for IMEI2
- **Procurement context lines:** Should the export begin with a short header (supplier, date delivered, procurement reference) before the groups, or contain only the grouped identifiers? - no need for header
- **Button label:** "Export", "Copy", or "Copy IMEIs"? The request says Export; a clipboard icon with "Export" label is the current assumption. - rename it with copy.
