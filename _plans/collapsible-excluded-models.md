# Plan: Collapsible Excluded Models Section

## Context

The excluded models section in the Inventory Summary form is a yellow alert box (lines 1135–1157 of `InventorySummaryForm.jsx`) that lists all models marked with `excludeFromSummary`. As more models get excluded over time, this box grows and pushes the actual summary table further down. Making it collapsible saves vertical space while keeping the count visible at a glance.

## Spec

`_specs/collapsible-excluded-models.md`

## File to Modify

`src/components/InventorySummaryForm.jsx`

## Changes

### 1. Add state for collapse toggle

Add a new `useState` near the other state declarations (around line 32):

```
const [excludedModelsCollapsed, setExcludedModelsCollapsed] = useState(true);
```

Default is `true` (collapsed) per the spec.

### 2. Make the header row clickable and add chevron indicator

Modify the header `div` (line 1137) to be a clickable toggle:

- Add `cursor-pointer` and `onClick` handler that toggles `excludedModelsCollapsed`
- Add `ChevronRight` (when collapsed) or `ChevronDown` (when expanded) icon after the title
- Both icons are already imported from `lucide-react` (lines 10–11)

### 3. Conditionally render the body content

Wrap the description text (lines 1143–1145) and model pills (lines 1146–1155) in a conditional that only renders when `excludedModelsCollapsed` is `false`.

### 4. No other changes

- No new imports needed — `ChevronDown` and `ChevronRight` already imported
- No changes to data fetching or other components

## Verification

1. Run `npm run build` to confirm no compilation errors
2. User verifies: section defaults to collapsed showing only header with count
3. User verifies: clicking header toggles the model list visibility
4. User verifies: chevron icon reflects current state (right = collapsed, down = expanded)
