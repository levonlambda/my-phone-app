# Plan: Collapsible Excluded Models in Price Management

## Context

The excluded models section in `PriceManagementForm.jsx` (lines 1006–1030) is a yellow alert box listing models excluded from price management. As more models get excluded, this box grows and pushes the table down. This applies the same collapsible pattern already implemented in `InventorySummaryForm.jsx`.

## Spec

`_specs/collapsible-excluded-price-mgmt.md`

## File to Modify

`src/components/PriceManagementForm.jsx`

## Changes

### 1. Add `ChevronRight` and `ChevronDown` to the lucide-react import (line 6)

These icons are not currently imported in this file (unlike InventorySummaryForm where they already existed). Add them to the existing import block.

### 2. Add collapse state (after line 40)

Add: `const [excludedModelsCollapsed, setExcludedModelsCollapsed] = useState(true);`

Default is `true` (collapsed).

### 3. Update the excluded models section (lines 1009–1029)

- Make the header div clickable with `cursor-pointer`, `select-none`, and an `onClick` handler toggling `excludedModelsCollapsed`
- Add chevron icon after the title (`ChevronRight` when collapsed, `ChevronDown` when expanded)
- Wrap the description text and model pills in a conditional `{!excludedModelsCollapsed && (...)}` block

This matches the exact pattern already in `InventorySummaryForm.jsx`.

## Verification

1. Run `npm run build` to confirm no compilation errors
2. User verifies: section defaults to collapsed, showing only header with count and chevron-right
3. User verifies: clicking header toggles model list visibility
4. User verifies: behavior matches the Inventory Summary form's collapsible section
