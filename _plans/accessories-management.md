# Plan: Accessories Management Feature

## Context

The app currently manages phones/tablets/laptops — devices tracked individually by IMEI/serial. The business also sells accessories (chargers, cables, earphones, power banks, printers) which lack per-unit identifiers and must be tracked as **quantity counts per product**. The detailed feature spec is in `_specs/accessories-management.md` (11 FRs, 6 new Firestore collections, 1 new Storage path, ~17 new UI components/modules, 3 new services).

Hard constraint from the user: **do not touch existing Firestore collections or forms**. Build from the ground up. Mirror the phone management architecture as closely as possible so the team can reason about accessories using patterns they already know.

The outcome is a parallel, independent accessories subsystem — product catalog with image upload, pricing (dealer-restricted), quantity-based inventory, procurement with supplier ledger, and stock receiving — wired into the existing context/tab navigation without modifying any phone code paths.

---

## Scope & Phasing (Confirmed: 6 phases)

This is large — ~17 new components/modules, 3 new services, 6 new Firestore collections. Shipping in 6 phases, each independently shippable and reviewable.

| Phase | Deliverable | Why this boundary |
|---|---|---|
| 1 | Foundation: services, utils, context, AuthContext wiring, App.jsx imports (with component stubs) | Everything else depends on these. No UI yet, but context is ready. |
| 2 | Product catalog + categories + image upload | Self-contained; users can start defining products even before pricing/inventory exists. |
| 3 | Pricing management | Depends only on products. Simple flat table, ~1 component. |
| 4 | Inventory (entry + list + summary) | Depends on products. Three views but closely related. |
| 5 | Procurement (create + manage + stock receiving + ledger) | The heaviest phase; depends on products, inventory, suppliers. |
| 6 | Firebase Security Rules + polish | Deploy rules last, after collections exist. |

The plan below is organized by phase. Each phase section lists files to create/modify and key reused utilities.

---

## Architecture Overview (Key Decisions)

- **Document ID = Internal SKU** for `accessory_products` and `accessory_pricing`.
- **`accessory_inventory` uses composite doc IDs** — `${sku}__${locationId}`. Each document represents one product at one store; every store has its own onHand/onDisplay/reserved/defective/sold counters. `sku`, `locationId`, and `locationName` are denormalized on the doc for querying and display.
- **`accessory_locations` is a separate collection** with Firestore auto-generated doc IDs. Seeded with a default "Main Branch" (primary) on first access via a module-level promise guard.
- **Single image per product**, stored inline as `photoUrl` on the product document (unlike phones, which use a separate `phone_images` collection with per-color entries). Storage path: `accessory_images/{internalSku}/primary.png` (fixed filename — replace-on-upload overwrites automatically).
- **Suppliers are read-only**: accessory procurement fetches from existing `suppliers` collection but never writes. Accessory financial state lives entirely in `accessory_ledger` — no updates to `suppliers.totalOutstanding`.
- **`sold` counter** uses `FieldValue.increment()`; the POS/sales flow (built separately) will call into `accessoryInventoryService.recordAccessorySale(sku, quantity, locationId)` to decrement `onHand` and increment `sold` at the selling store.
- **Retail price visible to all users; dealer price admin-only**, enforced via Firestore security rules and component-level guards.
- **Image upload on new-product form**: the user may pick a file before save; it's previewed locally via a blob URL and uploaded to Storage after the product save returns with a canonical SKU.
- **Available for sale formula**: `(onHand + onDisplay) − (reserved + defective)` — reflects that `onHand` and `onDisplay` are disjoint buckets (items are either in back-storage or on the shelf, not both).

---

## Phase 1 — Foundation

### Files to create

**`src/services/accessoryService.js`** — mirrors `src/services/supplierService.js` structure (read its full transaction pattern before writing this). Exports:

- Product CRUD: `createAccessoryProduct(data)`, `updateAccessoryProduct(sku, data)`, `getAccessoryProductBySku(sku)`, `getAllAccessoryProducts()`, `getProductByBarcode(barcode)`, `isSkuTaken(sku)`, `isBarcodeTaken(barcode, excludeSku)`
- Category CRUD: `getAllCategories()`, `createCategory(data)`, `updateCategory(id, data)`, `seedDefaultCategoriesIfEmpty()` — seeds Printer (PRT), Earphones (EAR), Charger (CHG), Cable (CBL), Power Bank (PBK), Misc (MSC) only if collection is empty
- Pricing CRUD: `setAccessoryPricing(sku, {dealersPrice, retailPrice})`, `getAccessoryPricing(sku)`, `getAllAccessoryPricing()`
- Procurement CRUD: `createAccessoryProcurement(data)` (uses `runTransaction` to create procurement + purchase ledger entry atomically), `updateAccessoryProcurement(id, data)`, `deleteAccessoryProcurement(id)` (soft-deletes ledger entries), `markAccessoryProcurementPaid(id, paymentData)`, `getAllAccessoryProcurements({year, status})`, `getAccessoryProcurementsBySupplier(supplierId)`
- Ledger: `getAccessoryLedgerBySupplier(supplierId)` (groups by procurementId, calculates running balance — reuse grouping logic from `supplierService.getSupplierLedger`)
- Reference generators: `generateAccessoryProcurementReference()` → `APROC-{timestamp}-{random3}`, `generateAccessoryPaymentReference()` → `APAY-{timestamp}-{random3}`
- All functions return `{ success, data/error, message? }`

**`src/services/accessoryInventoryService.js`** — mirrors `src/components/phone-selection/services/InventoryService.js`. Exports:

- `getAccessoryInventory(sku)`, `getAllAccessoryInventory()`
- `adjustAccessoryInventory(sku, adjustments)` — takes `{onHand?, onDisplay?, reserved?, defective?, location?}`, uses `FieldValue.increment()` inside a transaction, validates no negative results
- `receiveAccessoryStock(procurementId, receivedItems, dateDelivered, deliveryReference)` — transaction: increments `onHand` per item, creates inventory doc if first-time stock, marks procurement received
- `recordAccessorySale(sku, quantity)` — for future POS integration; increments `sold`, decrements `onHand`

**`src/services/accessoryImageService.js`** — simpler than `src/services/Phoneimageservice.js` (note the file is `Phoneimageservice.js` with that exact casing — confirm before importing). Exports:

- `uploadAccessoryImage(sku, file)` → uploads to Storage path `accessory_images/{sku}/primary.{ext}`, gets download URL, updates `photoUrl` on `accessory_products/{sku}`, returns `{success, url}`
- `deleteAccessoryImage(sku)` → clears `photoUrl` first, then deletes Storage object (safe ordering — if Storage fails, doc still consistent). Handles `storage/object-not-found` gracefully.
- `replaceAccessoryImage(sku, newFile)` → upload overwrites at `accessory_images/{sku}/primary.{ext}`, updates `photoUrl` with new URL (fixed-filename approach avoids old-path tracking).
- File validation (type starts with `image/`, size ≤ 5MB) lives client-side in the component, not the service.

**`src/components/accessories/utils/accessoryUtils.js`** — new small utility module. Exports:

- `generateNextSku(categoryCode, existingSkus)` → scans existing SKUs matching `ACC-{code}-`, returns `ACC-{code}-{nextSequence zero-padded to 4}`
- `validateSku(sku)` → regex check `^ACC-[A-Z]{2,6}-\d{4,}$`
- `sanitizeTags(tagsInput)` → splits comma or space, lowercases, trims, dedupes, enforces soft limit of 20

Reuse from existing `src/components/phone-selection/utils/phoneUtils.js`:
- `formatNumberWithCommas`, `parsePrice`, `validatePrice`, `calculateMarkup`, `calculateProfit`, `handleKeyDown`, `getCurrentDate`

Reuse `cn()` from `src/lib/utils.js`.

### Files to modify

**`src/context/GlobalStateContext.jsx`** — add five state pairs + helper methods, parallel to the procurement pattern (lines 17-113 of the existing file):

- `accessoryProductToEdit` / `editAccessoryProduct(product)` (sets state + `setActiveComponent('acc-products')`) / `clearAccessoryProductToEdit()`
- `accessoryInventoryItemToEdit` / `editAccessoryInventoryItem(item)` (switches to `'acc-entry'`) / `clearAccessoryInventoryItemToEdit()`
- `accessoryProcurementToEdit` + `accessoryProcurementMode` ('edit' | 'view' | 'payment') — plus `editAccessoryProcurement()`, `viewAccessoryProcurement()`, `paymentAccessoryProcurement()`, all switching to `'acc-procurement'`
- `accessoryProcurementForReceiving` / `receiveAccessoryProcurement()` (switches to `'acc-stock-receiving'`) / `clearAccessoryProcurementForReceiving()`

Export all through the context `value` object. No existing fields change.

**`src/context/AuthContext.jsx`** — append 10 entries to the `allComponents` array (around line 122 of existing file):

```
{ key: 'acc-products',          label: 'Acc. Products',      requiredRole: 'user'  },
{ key: 'acc-product-list',      label: 'Acc. Product List',  requiredRole: 'admin' },
{ key: 'acc-entry',             label: 'Acc. Entry',         requiredRole: 'admin' },
{ key: 'acc-inventory',         label: 'Acc. Inventory',     requiredRole: 'admin' },
{ key: 'acc-summary',           label: 'Acc. Summary',       requiredRole: 'user'  },
{ key: 'acc-prices',            label: 'Acc. Prices',        requiredRole: 'admin' },
{ key: 'acc-procurement',       label: 'Acc. Procurement',   requiredRole: 'admin' },
{ key: 'acc-procurement-mgmt',  label: 'Acc. Proc. Mgmt',    requiredRole: 'admin' },
{ key: 'acc-stock-receiving',   label: 'Acc. Receiving',     requiredRole: 'admin' },
{ key: 'acc-ledger',            label: 'Acc. Ledger',        requiredRole: 'admin' },
```

No changes to the `hasPermission` function needed.

**`src/App.jsx`** — three changes:

1. Add 10 new component imports at the top (placeholder imports until later phases land; stub each unbuilt component as a simple "Coming soon" card so the app still builds after Phase 1)
2. Add 10 entries to the `componentPermissions` map (lines 70-85 of existing file), matching the AuthContext role requirements
3. Add 10 conditional renders in the content area (lines 166-179 of existing file): `{activeComponent === 'acc-products' && <AccessoryProductForm />}` etc.

### Phase 1 exit criteria

- App builds and runs without regression
- New tabs appear in the header (visibility matches role)
- Clicking a new tab renders a "Coming soon" placeholder component
- No reads/writes to any accessory collection yet
- Services exist and are import-safe; can be smoke-tested via console

---

## Phase 2 — Product Catalog + Categories + Image Upload (FR-1, FR-2, FR-11)

### Files to create

**`src/components/accessories/AccessoryProductForm.jsx`** — replaces the Phase 1 stub. Mirrors the Card/CardHeader/CardContent structure + `rgb(52,69,157)` theming from `PhoneSpecForm.jsx`. Sections:

- Identifiers section: Internal SKU (auto-suggested from `generateNextSku()` when category is selected, editable), Barcode (optional, uniqueness validated on save via `isBarcodeTaken`)
- Core fields: Category dropdown (populated from `getAllCategories()`), Manufacturer (free text with autocomplete from prior values — use a simple datalist), Model, Tags (comma-separated input → `sanitizeTags()`), Description (textarea), Active toggle
- Image section: renders new `<AccessoryImageUploader />` subcomponent. On new-product form (no saved doc yet), image section is disabled with a "Save the product first, then upload an image" message. On edit, shows current image preview (or "No Image" placeholder) + upload/replace/delete controls. Validates type `image/*` and size ≤5MB client-side before calling `uploadAccessoryImage`.
- Category management: small "Manage Categories" button that opens `<AccessoryCategoryModal />` — an inline modal (NOT a top-level view) for adding/editing categories. Refreshes the category dropdown after close.
- Submit: calls `createAccessoryProduct()` or `updateAccessoryProduct()` depending on `accessoryProductToEdit` from context
- Uses `alert()` for success/failure (matches `PhoneSpecForm` convention)

**`src/components/accessories/AccessoryCategoryModal.jsx`** — modal component, opened from the product form. Lists existing categories, allows add/edit (name + code), toggle active. Calls `seedDefaultCategoriesIfEmpty()` on mount. Not a navigation tab.

**`src/components/accessories/AccessoryImageUploader.jsx`** — small reusable image upload widget. Props: `sku`, `currentPhotoUrl`, `onChange(newUrl)`. Renders preview or "No Image" placeholder. Hidden file input with upload button, replace button, delete button (with `window.confirm`). Styling mirrors the `ColorCard` image section in `PhoneImageManagementForm.jsx`.

**`src/components/accessories/AccessoryProductListForm.jsx`** — browse view, mirrors `PhoneListForm.jsx` layout. Table columns: thumbnail (from `photoUrl` or the text "No Image"), SKU, manufacturer, model, category, barcode, active badge. Filters: category (dropdown), manufacturer (dropdown from distinct values), active status (all/active/inactive), free-text search across manufacturer/model/tags/barcode. Click row → opens `<AccessoryProductDetailModal />`. Edit button per row → `editAccessoryProduct()` from context.

**`src/components/accessories/AccessoryProductDetailModal.jsx`** — mirrors `PhoneDetailModal.jsx`. Full product view with larger image, all fields, and Edit button.

### Files to modify

None beyond Phase 1 wiring (the stubs in App.jsx become real imports).

### Phase 2 exit criteria

- Admin can add a new accessory product (no image)
- Admin re-enters edit mode and uploads an image — preview appears immediately
- Admin can replace and delete images — Storage objects are cleaned up
- Admin can browse, filter, and search the product list
- Thumbnails render correctly; "No Image" placeholder shows for products without images
- SKU auto-suggest works per category; SKU and barcode uniqueness validation rejects duplicates
- Categories can be added/edited via the inline modal

---

## Phase 3 — Pricing Management (FR-3)

### Files to create

**`src/components/accessories/AccessoryPriceManagementForm.jsx`** — mirrors `PriceManagementForm.jsx` but flat (no tree — accessories have no variants). Table columns: SKU, manufacturer, model, category, dealer price, retail price, markup %, profit.

- Data source: joins `getAllAccessoryProducts()` with `getAllAccessoryPricing()` by SKU
- Inline edit pattern from `PriceManagementForm` (see its `editingBasePrice` state, lines ~29, 132-140): click Edit → row becomes input fields → Save calls `setAccessoryPricing(sku, ...)` → re-fetch
- Filter: category, manufacturer, free-text search
- Markup/profit calculated live via reused `calculateMarkup`, `calculateProfit` from `phoneUtils.js`
- Access control: component returns "Access Denied" if `userRole !== 'admin'` (belt-and-suspenders — the tab is already admin-only)

### Phase 3 exit criteria

- Admin sees a price table for every product (rows exist for products even without pricing — editable in place)
- Inline edits save to `accessory_pricing` and re-render markup/profit
- Non-admin users do not see this tab at all

---

## Phase 4 — Inventory (FR-4)

### Files to create

**`src/components/accessories/AccessoryInventoryEntryForm.jsx`** — mirrors `PhoneSelectionForm.jsx` for the lookup + adjust flow. Flow:

1. Product lookup panel: select by SKU dropdown OR type/paste barcode → calls `getProductByBarcode()` → resolves SKU → fetches product + inventory doc
2. Current stock card: displays onHand, onDisplay, reserved, defective, sold (read-only), location
3. Adjustment inputs: four signed-number fields (positive to add, negative to subtract). Client validates no field will go negative post-adjustment.
4. Location input: optional update
5. Save: calls `adjustAccessoryInventory(sku, adjustments)` — uses `FieldValue.increment()` atomically. `sold` is NOT adjustable here.
6. Edit mode: if `accessoryInventoryItemToEdit` is set in context, pre-selects that product on mount

**`src/components/accessories/AccessoryInventoryListForm.jsx`** — mirrors `InventoryListForm.jsx` + `InventoryTable.jsx`. Columns: SKU, manufacturer, model, category, onHand, onDisplay, reserved, defective, sold, available (`onHand - reserved - defective`), location, retail price (visible to all roles), dealer price (admin only). Features:

- Data join: `getAllAccessoryInventory()` + `getAllAccessoryProducts()` + `getAllAccessoryPricing()` (pricing filtered based on role)
- Filters: category, manufacturer, stock status (in-stock / out-of-stock / low-stock with configurable threshold), text search
- Sortable columns (reuse pattern from `InventoryTable`)
- Inline edit per row: mirrors `InventoryEditForm.jsx` — editable fields are quantities + location only (product metadata is immutable here)

**`src/components/accessories/AccessoryInventorySummaryForm.jsx`** — mirrors `InventorySummaryForm.jsx`. Grouping tree: Category → Manufacturer → individual products. Each group node shows aggregate onHand/onDisplay/reserved/defective/sold. Expandable. Excludes inactive products by default with a toggle to include them.

### Phase 4 exit criteria

- Admin can look up a product, view current quantities, adjust quantities atomically
- Barcode lookup resolves to the correct product; scanning an inactive product shows an "Inactive" warning and blocks further action
- Inventory list filters/sorts/inline-edits behave like the phone inventory list
- Retail price visible to regular users in the list; dealer price never leaks to non-admin
- Summary dashboard groups correctly and aggregates per group

---

## Phase 5 — Procurement + Stock Receiving + Ledger (FR-5, FR-6, FR-7, FR-8)

### Files to create

**`src/components/accessories/AccessoryProcurementForm.jsx`** — mirrors `PhoneProcurementForm.jsx`. Single component handles create/edit/view/payment via `accessoryProcurementMode` from context.

- Supplier dropdown: populated from **existing** `suppliers` collection via `getAllSuppliers()` in `supplierService.js` (read-only — DO NOT modify supplier balances)
- Items table: rows with product search (only active products), quantity, dealer price (pre-populated from `accessory_pricing` if present), row total. Grand total computed live.
- Reference auto-generated on save via `generateAccessoryProcurementReference()`
- Save: calls `createAccessoryProcurement()` → transaction creates procurement doc + purchase ledger entry atomically
- Edit mode: loads procurement, allows full modification
- View mode: all fields locked
- Payment mode: only payment fields editable; save calls `markAccessoryProcurementPaid()` which creates the payment ledger entry

**`src/components/accessories/AccessoryProcurementManagementForm.jsx`** — mirrors `ProcurementManagementForm.jsx`. List of all accessory procurements with search (reference/supplier/item names), payment status filter, year filter. Action buttons per row: View, Edit, Payment, Receive, Delete. Each calls the appropriate context helper.

**`src/components/accessories/AccessoryStockReceivingForm.jsx`** — mirrors `StockReceivingForm.jsx`. Pre-populated from `accessoryProcurementForReceiving`. Per-item received quantity (defaulting to ordered qty, editable for partial), bulk location input, date delivered, delivery reference. Save calls `receiveAccessoryStock()` — transaction increments `onHand` per item, creates inventory doc on first stock, marks procurement received.

**`src/components/accessories/AccessoryLedgerView.jsx`** — a dedicated view (not integrated into `SupplierManagementForm` — keeping it fully separate as decided in the spec). Supplier dropdown at top; selecting a supplier loads their accessory ledger via `getAccessoryLedgerBySupplier()`. Displays entries grouped by procurement, with running balance. Reuse the ledger rendering pattern from `SupplierManagementForm.jsx`.

### Phase 5 exit criteria

- Admin creates a procurement, procurement + ledger entries are written atomically
- Procurement list supports all filter combinations
- Payment recording marks paid + creates payment ledger entry
- Stock receiving updates inventory quantities atomically and marks procurement received
- Deleting a procurement soft-deletes its ledger entries (ledger view still shows them as deleted for audit)
- Supplier ledger view correctly groups and shows running balances
- Zero writes to `suppliers` collection

---

## Phase 6 — Firebase Security Rules + Polish

### Files to modify

**Firestore security rules** (wherever they live in the project — likely `firestore.rules` at the project root, or managed in the Firebase console; confirm before editing):

Add blocks for the six new collections, roughly mirroring the spec:

- `accessory_products`, `accessory_categories`, `accessory_inventory`: read = any authenticated user; write = admin
- `accessory_pricing`: write = admin only; read = admin for full doc, authenticated for retail-price-only (if feasible; otherwise restrict entire collection to admin and denormalize retail price to `accessory_products`)
- `accessory_procurements`, `accessory_ledger`: read + write = admin

**Storage rules** for `accessory_images/`: read = any authenticated user; write = admin.

### Polish tasks

- Regression pass: existing phone workflows behave unchanged
- Final check against every acceptance criterion in `_specs/accessories-management.md`

---

## Critical Files (Quick Reference)

### Files to create (grouped by phase)

Phase 1:
- `src/services/accessoryService.js`
- `src/services/accessoryInventoryService.js` (note: Phase 4 rewrote this for per-location inventory with composite doc IDs)
- `src/services/accessoryImageService.js`
- `src/components/accessories/utils/accessoryUtils.js`

Phase 2:
- `src/components/accessories/AccessoryProductForm.jsx`
- `src/components/accessories/AccessoryCategoryModal.jsx`
- `src/components/accessories/AccessoryImageUploader.jsx`
- `src/components/accessories/AccessoryProductListForm.jsx`
- `src/components/accessories/AccessoryProductDetailModal.jsx`

Phase 3:
- `src/components/accessories/AccessoryPriceManagementForm.jsx`

Phase 4:
- `src/components/accessories/AccessoryInventoryEntryForm.jsx`
- `src/components/accessories/AccessoryInventoryListForm.jsx`
- `src/components/accessories/AccessoryInventorySummaryForm.jsx`
- `src/components/accessories/AccessoryLocationModal.jsx` (Manage Stores)
- `src/services/accessoryLocationService.js` (location CRUD + default seed)

Phase 5:
- `src/components/accessories/AccessoryProcurementForm.jsx`
- `src/components/accessories/AccessoryProcurementManagementForm.jsx`
- `src/components/accessories/AccessoryStockReceivingForm.jsx`
- `src/components/accessories/AccessoryLedgerView.jsx`

### Files to modify (Phase 1 only; no further modifications after)

- `src/App.jsx` — imports, `componentPermissions` map, conditional renders
- `src/context/AuthContext.jsx` — `allComponents` array entries
- `src/context/GlobalStateContext.jsx` — new state pairs + helpers
- Firestore security rules file (Phase 6)

### Reused utilities (import, do not rewrite)

- `src/components/phone-selection/utils/phoneUtils.js` → `formatNumberWithCommas`, `parsePrice`, `validatePrice`, `calculateMarkup`, `calculateProfit`, `handleKeyDown`, `getCurrentDate`
- `src/lib/utils.js` → `cn()`
- `src/firebase/config.js` → `db`, `auth`, `storage`
- `src/services/supplierService.js` → `getAllSuppliers()` (read-only use in procurement form)

### Existing components to read before mirroring

- `src/components/PhoneSpecForm.jsx` → template for `AccessoryProductForm`
- `src/components/phone-list/PhoneDetailModal.jsx` → template for `AccessoryProductDetailModal`
- `src/components/PhoneImageManagementForm.jsx` + `src/services/Phoneimageservice.js` → templates for image uploader + service
- `src/components/PriceManagementForm.jsx` → template for price form
- `src/components/InventoryListForm.jsx` + `src/components/inventory/InventoryTable.jsx` + `src/components/inventory/InventoryEditForm.jsx` → template for inventory list
- `src/components/InventorySummaryForm.jsx` → template for summary
- `src/components/PhoneProcurementForm.jsx` → template for procurement form
- `src/components/ProcurementManagementForm.jsx` → template for procurement management
- `src/components/StockReceivingForm.jsx` → template for stock receiving
- `src/components/SupplierManagementForm.jsx` → template for ledger view
- `src/services/supplierService.js` → template for `accessoryService.js` (especially `createProcurement` transaction pattern)
- `src/components/phone-selection/services/InventoryService.js` → template for `accessoryInventoryService.js`

---

## Verification Plan

Testing is entirely manual — no test framework is configured. **Division of responsibility:** I write code only. The user runs all manual QA against their Firebase environment. I will never call reads or writes against any Firestore collection or Storage path during the build, and will not run the dev server.

At the end of each phase I will:
- Confirm `npm run build` and `npm run lint` succeed locally (static checks only — no runtime app start, no network calls)
- Provide the user with a concrete QA checklist for that phase (what to click, what to verify in Firebase console)
- Wait for user feedback before starting the next phase

### Per-phase QA checklists (for the user to run)

**Phase 1**
- `npm run build` succeeds with zero errors
- `npm run lint` passes
- `npm run dev` boots; existing phone tabs still work identically
- New "Acc. *" tabs are visible (filtered by role); clicking each renders a placeholder

**Phase 2**
- Add two test products (one with image, one without); verify Firestore docs, Storage object, `photoUrl` field
- Edit a product; replace image; verify old Storage object is replaced
- Delete image; verify `photoUrl` cleared and Storage object removed
- Deactivate a product; verify it disappears from entry/procurement dropdowns (tested after Phase 4/5)
- Try duplicate SKU → rejected; duplicate barcode → rejected; empty required field → rejected

**Phase 3**
- Set prices for test products; verify `accessory_pricing` docs; verify markup/profit render correctly
- Log in as a `user` role; verify pricing tab is not visible

**Phase 4**
- From entry form, add initial stock to two products (including first-time stock to verify inventory doc creation)
- Adjust quantities; verify atomic increments in Firestore
- Try to drive onHand negative → rejected client-side
- Verify inventory list filters and sorts; inline edit a quantity
- Verify summary dashboard grouping and aggregates match manual math

**Phase 5**
- Create a procurement with two items; verify procurement doc + one purchase ledger entry
- Record payment; verify payment ledger entry + `isPaid = true`
- Receive stock (partial on one item); verify inventory onHand incremented, procurement `isReceived = true`
- Delete a procurement; verify ledger entries soft-deleted (still present with `isDeleted: true`)
- Verify `suppliers` collection never modified during any of the above (watch Firebase console)

**Phase 6**
- Deploy security rules; verify non-admin cannot read `accessory_pricing` dealer data
- Regression pass: run through full phone workflows (add phone, receive procurement, edit prices, etc.) — all must behave unchanged

### Cross-cutting verification (to confirm at end of build)

- Existing `phones`, `inventory`, `inventory_counts`, `price_configurations`, `procurements`, `supplier_ledger`, `suppliers`, `users`, `phone_images` collections receive ZERO writes during any accessory flow
- Existing `phone_images/` Storage path receives zero writes
