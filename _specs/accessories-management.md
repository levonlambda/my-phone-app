# Spec for Accessories Management

## Summary

Add a complete accessories management system to the app — parallel to, but fully independent from, the existing phone management system. Accessories differ from phones in that they lack unique per-unit identifiers (IMEI, serial number) and are tracked by **quantity per product per store** rather than individual item records. The feature introduces new Firestore collections (`accessory_products`, `accessory_pricing`, `accessory_inventory`, `accessory_categories`, `accessory_locations`, `accessory_procurements`, `accessory_ledger`), a new Firebase Storage path (`accessory_images/`), new service modules, new context state, and a full set of UI components that mirror the phone management workflow: product catalog, per-store inventory tracking, pricing, procurement, stock receiving, and supplier ledger.

No existing Firestore collections, components, or forms are modified. The feature is built from the ground up using the same architectural patterns (context-based navigation, service layer with `{success, data/error}` returns, Firestore transactions for atomic operations, role-based tab visibility).

---

## Functional Requirements

### FR-1: Accessory Product Catalog (`accessory_products` collection)

**Purpose:** Define and manage the master catalog of accessory products the store sells.

- **Add new product:** A form (mirroring `PhoneSpecForm`) allows an admin to create a new accessory product with the following fields:
  - **Internal SKU** (required, unique) — store-assigned identifier, used as the Firestore document ID. Format: `ACC-{CATEGORY_CODE}-{SEQUENCE}` (e.g., `ACC-CHG-0001`). The form should auto-suggest the next available sequence number for the selected category.
  - **Barcode** (optional) — manufacturer's barcode (EAN/UPC). If provided, must be unique across all accessory products (validated on save).
  - **Category** (required) — selected from a managed list stored in `accessory_categories`. Dropdown populated from that collection.
  - **Manufacturer** (required) — brand/manufacturer name. Free-text input with autocomplete from previously entered values.
  - **Model** (required) — the product's name/model identifier. Primary human-readable label.
  - **Tags** (optional) — array of lowercase, free-form keywords for search. Entered as comma-separated values or tag chips.
  - **Description** (optional) — detailed product description.
  - **Active** (required) — boolean, defaults to `true`. Controls visibility in sales/inventory flows.
  - **Product Image** (optional) — a single photo of the product uploaded from within the form (see "Image Upload" below). Stored as a URL in the `photoUrl` field of the product document.

- **Image Upload (integrated into the product form):** The catalog form includes an image upload section, reusing the patterns established by `PhoneImageManagementForm` and `phoneImageService.js`, but scoped to a single image per accessory product (accessories have no color/variant dimension like phones).
  - **Storage:** Images are uploaded to **Firebase Storage** at the path `accessory_images/{internalSku}/{fileName}`, mirroring the phone image storage convention (`phone_images/{phoneDocId}/{fileName}`).
  - **Metadata:** The download URL returned by `getDownloadURL()` is saved as a `photoUrl` field directly on the product's document in `accessory_products`. Unlike phones — which use a separate `phone_images` collection with per-color entries — accessories store the image URL inline on the product document since there is only one image per product.
  - **Upload control:** The form shows an upload area (drag-drop label + hidden file input, styled consistently with `ColorCard` in `PhoneImageManagementForm`). Accepts image files (`accept="image/*"`). File type is validated (`file.type.startsWith('image/')`) and file size is limited to 5MB (same validation rules as the phone image flow).
  - **Live preview after upload:** Once an image is successfully uploaded, it must be displayed in the form immediately (image preview rendered from the `photoUrl`). An "upload in progress" spinner is shown during upload.
  - **Replace image:** If an image already exists, the user can click a "Replace" action to upload a new one. The new file is uploaded to the same storage path (overwriting) or a new filename, and the `photoUrl` field is updated. The previous storage object is deleted after the replacement succeeds.
  - **Delete image:** A delete button (trash icon) lets the admin remove the current image. This deletes the storage object (via `deleteObject(storageRef)`) and clears the `photoUrl` field on the product document. Confirmation dialog before deletion.
  - **Default state (no image yet):** Before any image is uploaded — including on the new-product form before saving — the preview area displays the text **"No Image"** as a placeholder (alongside the upload control).
  - **New-product workflow:** For a brand-new product, image upload can be deferred until after the product document is first saved (because the storage path depends on the Internal SKU). Alternatively, a "temporary SKU" reservation approach can be used. Simpler option: disable the image upload control on the new-product form until the product is saved once, then re-enter edit mode to upload an image. Either approach is acceptable; the implementer may choose based on UX preference, but the chosen behavior should be consistent and clearly communicated in the UI.

- **Browse/search products:** A list view (mirroring `PhoneListForm`) displays all accessory products with search and filtering:
  - Filter by category (dropdown).
  - Filter by manufacturer (dropdown, populated from distinct values in the collection).
  - Filter by active/inactive status.
  - Text search across manufacturer, model, tags, and barcode.
  - Each product row shows: **product image thumbnail** (rendered from `photoUrl`, or the text **"No Image"** as the default placeholder when `photoUrl` is empty/missing), SKU, manufacturer, model, category, barcode (if any), active status.
  - Click a product to view its full details in a modal (mirroring `PhoneDetailModal`). The detail modal shows the image at a larger size, or "No Image" if none exists.

- **Edit product:** From the product list or detail modal, an admin can edit any field except the Internal SKU (which is the document ID and immutable after creation). The edit flow uses context state (`accessoryProductToEdit`) to switch the catalog form into edit mode (mirroring how `inventoryItemToEdit` switches `PhoneSelectionForm` into edit mode). The image upload/replace/delete controls are available in edit mode.

- **Deactivate product:** Setting `active` to `false` hides the product from inventory entry and procurement forms but preserves all historical data. The product remains visible in the product list with an "Inactive" badge. The product's image is preserved in storage and remains visible in the product list.

### FR-2: Category Management (`accessory_categories` collection)

**Purpose:** Maintain an extensible list of product categories without code changes.

- Stored in a dedicated `accessory_categories` Firestore collection. Each document has:
  - `name` (string, required) — display name (e.g., "Charger", "Cable").
  - `code` (string, required, unique) — short code used in SKU generation (e.g., "CHG", "CBL").
  - `active` (boolean) — whether the category appears in dropdowns.
  - `sortOrder` (number) — controls display ordering.

- **Seed categories** on first use (if the collection is empty): Printer (PRT), Earphones (EAR), Charger (CHG), Cable (CBL), Power Bank (PBK), Misc (MSC).

- **Add/edit categories:** Admin can add new categories or edit existing ones from a settings panel accessible within the accessory product form. The panel is a simple inline or modal form (not a separate top-level view).

### FR-3: Accessory Pricing (`accessory_pricing` collection)

**Purpose:** Store dealer (cost) and retail prices for each accessory product, with access restricted to authorized roles.

- **Price management view** (mirroring `PriceManagementForm`): A dedicated view lists all accessory products with their dealer and retail prices.
  - Organized as a flat table (unlike phone pricing which has a tree structure for variants — accessories have no variants, so each SKU has exactly one price row).
  - Columns: SKU, manufacturer, model, category, dealer price, retail price, markup %, profit amount.
  - Inline editing: click a price cell to edit, save/cancel buttons appear.
  - Filter/search: by category, manufacturer, text search.
  - Markup and profit are calculated live (using the same formulas as `phoneUtils.calculateMarkup` and `calculateProfit`).

- **Price document:** Created when a product is first added or when pricing is first set. Document ID matches the Internal SKU. Fields: `dealersPrice` (number), `retailPrice` (number).

- **Access control:** Only users with admin role can see the pricing view and dealer prices. Regular users should never see dealer pricing data. Retail price may be shown in inventory views (fetched on demand for authorized users, or denormalized where needed).

### FR-4: Accessory Inventory Management (`accessory_inventory` + `accessory_locations` collections)

**Purpose:** Track stock quantities for each accessory product **at each store (location)**. Each physical store has its own onHand / onDisplay / reserved / defective / sold counters for every product it stocks.

#### Terminology

- **Location** (a.k.a. "store", "branch") — a physical retail location. Represented as documents in `accessory_locations` (auto-generated doc IDs).
- **On Hand** — items physically in the store but NOT on display (e.g., in back storage).
- **On Display** — items currently on the display shelf / showroom.
- **Reserved** — items claimed by a customer but not yet picked up.
- **Defective** — items identified as non-sellable.
- **Sold** — running lifetime-sold counter, incremented by the POS / sales flow.
- `On Hand`, `On Display`, `Reserved`, `Defective` are **disjoint buckets** — each unit sits in exactly one at any moment.
- **Available for sale** = `(onHand + onDisplay) − (reserved + defective)`.

#### `accessory_locations` collection

Each document (auto-generated ID) represents a store/branch:
- `name` (string, required, unique) — e.g., "Main Branch", "Tech Hub".
- `address` (string, optional) — human-readable address.
- `active` (boolean) — controls visibility in dropdowns.
- `isPrimary` (boolean) — at most one location should be primary; UI uses it as the default.
- `sortOrder` (number) — display ordering.
- `dateCreated`, `lastUpdated` (timestamps).

On first access the app seeds a single default location named **"Main Branch"** (marked primary) if the collection is empty. Seeding is race-safe via a module-level promise guard.

#### `accessory_inventory` collection — composite doc IDs

One document per **(sku, locationId)** pair. The document ID is the deterministic composite string `${sku}__${locationId}` so direct reads/writes don't require an extra query.

| Field | Type | Required | Description |
|---|---|---|---|
| *(document ID)* | string | — | `${sku}__${locationId}`. |
| `sku` | string | Yes | Denormalized for `where sku == X` queries. |
| `locationId` | string | Yes | Denormalized for `where locationId == X` queries. |
| `locationName` | string | Yes | Denormalized for display. Refreshed on every write. |
| `onHand`, `onDisplay`, `reserved`, `defective`, `sold` | number | Yes | Per-location counts, default 0. |
| `lastUpdated` | timestamp | Yes | Server timestamp on every modification. |

#### Inventory entry / adjustment form

- **Store picker** (always visible) — dropdown of active locations, defaulting to the primary store. User can switch between stores to adjust each one independently.
- **Product lookup** — SKU dropdown or barcode lookup, same as before.
- **Current stock card** — reflects the selected (product, store) pair. Shows the five counts plus a live Available calculation `(onHand + onDisplay) − (reserved + defective)` with before/after projections as the user types adjustments.
- **Adjustments** — four signed-number deltas (`onHand`, `onDisplay`, `reserved`, `defective`). Save uses `FieldValue.increment()` inside a Firestore transaction on the composite doc ID. Rejects if any field would go negative. `sold` is NOT adjustable here.
- **Manage Stores button** — opens the `AccessoryLocationModal` (add / edit / delete stores).

#### Inventory list view

- One row per **(sku, location)** pair.
- Default scope: show every product at the primary store (including zero-stock rows) so admins can easily spot gaps. Switching the Store filter to "All Stores" collapses to showing only actual inventory rows.
- Columns: SKU, manufacturer, model, category, **store**, onHand, onDisplay, reserved, defective, sold, Available, retail price (all roles), dealer price (admin only), actions.
- Filters: store, category, manufacturer, stock status (in-stock / low-stock / out-of-stock), active/inactive, text search (SKU / model / store name).
- Sortable columns including the store column.
- Inline edit per row: quantity fields edited as absolute targets; the UI computes the delta and calls `adjustAccessoryInventory(sku, locationId, delta)`.

#### Inventory summary view

- Hierarchical grouping: **Store → Category → Manufacturer → Product**.
- Each level has aggregate counts.
- Grand totals card across all stores.
- "Include inactive products" toggle.
- Expand-All / Collapse-All controls.

#### Service API (inventory)

- `composeInventoryId(sku, locationId)` — returns the composite doc ID.
- `getAccessoryInventory(sku, locationId)` — single doc read.
- `getAllAccessoryInventory()` — every doc across all SKUs and locations.
- `getInventoryForSku(sku)` — all locations for one SKU.
- `getInventoryForLocation(locationId)` — all SKUs at one location.
- `adjustAccessoryInventory(sku, locationId, adjustments)` — atomic; creates the doc if missing.
- `receiveAccessoryStock(procurementId, receivedItems, dateDelivered, deliveryReference, locationId)` — one procurement is received INTO a single destination location.
- `recordAccessorySale(sku, quantity, locationId)` — for POS integration; decrements `onHand` and increments `sold` at the selling location.

### FR-5: Accessory Procurement (`accessory_procurements` collection)

**Purpose:** Create purchase orders for accessory stock from suppliers.

- **Procurement form** (mirroring `PhoneProcurementForm`):
  - **Purchase date** (required) — date of the order.
  - **Supplier selection** (required) — dropdown populated from the existing `suppliers` collection (read-only access to shared supplier data). Displays supplier name; stores supplier ID and supplier name (denormalized).
  - **Items table** — multi-row entry:
    - Select accessory product (search/dropdown from `accessory_products`, only active products).
    - Quantity (required, positive integer).
    - Dealer price per unit (pre-populated from `accessory_pricing` if available, editable).
    - Row total (quantity × dealer price, calculated).
  - **Grand total** — sum of all row totals.
  - **Payment fields** (optional at creation): payment reference, bank name, bank account, account payable.
  - **Status fields:** `isPaid` (boolean, default false), `isReceived` (boolean, default false).
  - **Reference number:** Auto-generated on save using the pattern `APROC-{timestamp}-{3-digit-random}`.

- **Procurement document structure:**
  - `supplierId`, `supplierName` (denormalized), `reference`, `purchaseDate`.
  - `items` array: each item has `internalSku`, `manufacturer`, `model`, `category`, `quantity`, `dealersPrice`, `totalPrice`.
  - `grandTotal`, `isPaid`, `isReceived`, `datePaid`, `paymentReference`, `bankName`, `bankAccount`, `accountPayable`.
  - `dateCreated`, `lastUpdated` (timestamps).

- **Save operation:** Uses a Firestore transaction to atomically:
  1. Create the procurement document.
  2. Create a ledger entry (purchase type) in `accessory_ledger`.

### FR-6: Accessory Procurement Management (uses `accessory_procurements` collection)

**Purpose:** View, search, and manage existing accessory procurement orders.

- **Procurement list view** (mirroring `ProcurementManagementForm`):
  - List of all accessory procurements with: reference, supplier name, purchase date, grand total, payment status, delivery status.
  - Search by reference number, supplier name, or item names.
  - Filter by payment status (all / paid / unpaid).
  - Filter by year (dropdown, current year default).
  - Sort by date (newest first by default).

- **Action buttons per procurement** (mirroring phone procurement modes):
  - **View** — opens procurement in read-only mode (all fields locked).
  - **Edit** — opens procurement form in edit mode (same component, different mode via context state `accessoryProcurementMode`).
  - **Payment** — opens procurement with only payment fields editable. On save, marks `isPaid = true`, sets `datePaid`, creates a payment ledger entry in `accessory_ledger`.
  - **Receive** — switches to the accessory stock receiving form.

- **Delete procurement:** Marks associated ledger entries as deleted (soft delete with `isDeleted` flag). Does NOT hard-delete. Preserves audit trail.

### FR-7: Accessory Stock Receiving (uses `accessory_procurements` + `accessory_inventory`)

**Purpose:** Receive physical accessory stock from a procurement order and update inventory counts.

- **Stock receiving form** (mirroring `StockReceivingForm`):
  - Pre-populated from the selected procurement: supplier info, item list with expected quantities.
  - **Per-item entry:**
    - Quantity received (pre-filled with ordered quantity, editable — may receive partial).
    - Location (optional, can set a bulk location for all items).
  - **Date delivered** (required).
  - **Delivery reference** (optional).

- **Save operation:** Uses a Firestore transaction to atomically:
  1. For each item received: increment `onHand` in the corresponding `accessory_inventory` document using `FieldValue.increment(quantityReceived)`. Create the inventory document if it doesn't exist yet (first-time stock for that SKU).
  2. Mark the procurement as received (`isReceived = true`).
  3. Update `lastUpdated` on all affected inventory documents.

### FR-8: Accessory Supplier Ledger (`accessory_ledger` collection)

**Purpose:** Track financial transactions (purchases and payments) related to accessory procurement, independently from the phone ledger.

- **Ledger entry structure:**
  - `supplierId`, `supplierName` (denormalized).
  - `procurementId` (reference to `accessory_procurements` document).
  - `entryType`: `"purchase"` or `"payment"`.
  - `reference` (procurement or payment reference number).
  - `entryDate`, `purchaseDate`.
  - `amountDue` (positive for purchases, 0 for payments).
  - `amountPaid` (0 for purchases, positive for payments).
  - `description` (human-readable summary).
  - `sortOrder` (1 for purchase, 2 for payment — for consistent ordering within a procurement group).
  - `isDeleted` (boolean, for soft deletes).
  - `dateCreated`, `lastUpdated`.

- **Ledger view:** Accessible within the supplier management area or as a filtered view. Groups entries by procurement, shows running balance, sorted by date. Mirrors the phone ledger display in `SupplierManagementForm`.

- **Important:** This ledger is independent from the existing phone supplier ledger. Accessory procurement does NOT update the supplier's `totalOutstanding` field in the existing `suppliers` collection. Accessory-specific supplier balances are calculated from `accessory_ledger` entries alone.

### FR-9: Navigation and Context Integration

- **New tabs** added to the app header for accessory views:
  - "Acc. Products" — accessory product catalog form (add/edit). Permission: `user` (mirrors `form` for phones).
  - "Acc. Product List" — product browse/search view. Permission: `admin`.
  - "Acc. Inventory" — inventory list with inline editing. Permission: `admin`.
  - "Acc. Entry" — inventory entry/adjustment form. Permission: `admin`.
  - "Acc. Summary" — inventory summary dashboard. Permission: `user`.
  - "Acc. Prices" — pricing management. Permission: `admin`.
  - "Acc. Procurement" — create procurement order. Permission: `admin`.
  - "Acc. Proc. Mgmt" — manage procurement orders. Permission: `admin`.
  - "Acc. Receiving" — stock receiving (typically accessed via procurement management, but also available as a tab). Permission: `admin`.

- **Context state additions** (in `GlobalStateProvider`):
  - `accessoryProductToEdit` / `editAccessoryProduct()` / `clearAccessoryProductToEdit()` — for product catalog editing.
  - `accessoryInventoryItemToEdit` / `editAccessoryInventoryItem()` / `clearAccessoryInventoryItemToEdit()` — for inventory editing (switches to entry form).
  - `accessoryProcurementToEdit` / `accessoryProcurementMode` / `editAccessoryProcurement()` / `viewAccessoryProcurement()` / `paymentAccessoryProcurement()` — for procurement modes (edit/view/payment).
  - `accessoryProcurementForReceiving` / `receiveAccessoryProcurement()` / `clearAccessoryProcurementForReceiving()` — for stock receiving flow.
  - `isViewingAccessoryProcurement` — read-only flag.

- **Active component keys:** `acc-products`, `acc-product-list`, `acc-inventory`, `acc-entry`, `acc-summary`, `acc-prices`, `acc-procurement`, `acc-procurement-mgmt`, `acc-stock-receiving`.

### FR-10: Service Layer

- **`src/services/accessoryService.js`** — mirrors `supplierService.js`. Handles:
  - Product CRUD (add, update, get all, get by ID, search by barcode).
  - Category CRUD (add, update, get all, seed defaults).
  - Pricing CRUD (set/update prices, get price by SKU, get all prices).
  - Procurement CRUD (create, update, delete, mark paid, get all, get by supplier, filter by year/status).
  - Ledger operations (create entries, get ledger by supplier, calculate running balance, group by procurement).
  - All functions return `{ success, data/error }` shape.
  - Uses transactions for multi-document writes (procurement creation, payment recording).
  - Queries outside transactions where needed (mirroring the phone procurement pattern).
  - Reference generation: `generateAccessoryProcurementReference()` and `generateAccessoryPaymentReference()`.

- **`src/services/accessoryInventoryService.js`** — mirrors `InventoryService.js`. Handles:
  - Inventory adjustments (increment/decrement quantities using `FieldValue.increment()`).
  - Create inventory document for first-time products.
  - Stock receiving (bulk increment from procurement).
  - Get inventory by SKU, get all inventory.
  - All atomic operations use Firestore transactions.

- **`src/services/accessoryImageService.js`** — mirrors `phoneImageService.js` but simplified for the single-image-per-product model. Handles:
  - `uploadAccessoryImage(internalSku, file)` — uploads to Firebase Storage at `accessory_images/{internalSku}/{fileName}`, gets the download URL, and updates the `photoUrl` field on the product document in `accessory_products`.
  - `deleteAccessoryImage(internalSku)` — deletes the storage object and clears the `photoUrl` field.
  - `replaceAccessoryImage(internalSku, newFile)` — uploads the new file, updates `photoUrl`, then deletes the previous storage object.
  - All functions return `{ success, data/error }` shape.
  - File validation (image type, max 5MB) is performed client-side before calling the service, matching the phone image flow.

### FR-11: SKU Generation

- When creating a new product, the form must auto-suggest the next available SKU:
  1. User selects a category (e.g., "Charger" with code "CHG").
  2. System queries `accessory_products` for all documents where `internalSku` starts with `ACC-CHG-`.
  3. Finds the highest sequence number and suggests `ACC-CHG-{next}` (zero-padded to 4 digits).
  4. User can accept the suggestion or manually enter a different SKU (must still be unique).
  5. On save, validate uniqueness by attempting to read the document at that ID — if it exists, reject with an error.

---

## Possible Edge Cases

- **Barcode collision:** Two different products assigned the same barcode. Validate barcode uniqueness on product save (query `accessory_products` where `barcode == value` excluding current document).
- **SKU collision:** Attempted creation of a product with an SKU that already exists. Check document existence before writing.
- **Negative inventory:** An adjustment tries to bring onHand, onDisplay, reserved, or defective below zero. Validate on the client before submitting; the service layer should also reject negative results.
- **Concurrent stock adjustments:** Two users adjusting the same product's inventory simultaneously. Mitigated by using `FieldValue.increment()` which is atomic — but the client-displayed "current" values may be stale. Show a timestamp of when data was last fetched.
- **Partial receiving:** A procurement has 5 items but only 3 are delivered. The form must allow entering received quantities per item that are less than ordered. The procurement should still be markable as received (partial receipt is still a receipt).
- **Product deactivation with existing stock:** Deactivating a product that still has onHand > 0. Allow it but show a warning. The product disappears from procurement/entry forms but the inventory record and stock remain visible in the inventory list.
- **Price not set:** A product exists in `accessory_products` but has no corresponding `accessory_pricing` document. The inventory and product list views should handle this gracefully (show "N/A" or "—" for price fields). The procurement form should allow manual price entry even if no price doc exists.
- **Category deletion/deactivation with existing products:** Deactivating a category that has active products. Allow deactivation but show a warning with the count of affected products. Existing products keep their category value; the category simply stops appearing in the "add new product" dropdown.
- **Barcode scan resolves to inactive product:** Show the product info but display a clear "Inactive" warning and block adding to procurement or inventory entry.
- **Sold counter drift:** The `sold` counter in `accessory_inventory` may drift from the actual sales transaction count over time. This is acceptable per the spec — reconciliation is a future concern.
- **Empty inventory document:** A product is created but never stocked (no `accessory_inventory` document exists). The inventory list should either show zero counts or omit the product. The summary view should handle missing inventory docs gracefully.
- **Supplier referenced in procurement is deleted/renamed in `suppliers` collection:** Since supplier name is denormalized into procurement and ledger docs, existing records remain readable even if the supplier is later modified. New procurements would pick up the updated name.
- **Large tag arrays:** A product with many tags could slow `array-contains` queries. Set a reasonable soft limit (e.g., 20 tags) with a client-side warning.
- **Image upload failures:** Network failure during upload leaves the storage object partially written or the `photoUrl` field not updated. The service should catch errors, clean up any partial upload, and return a clear error message to the form. On failure, the UI should leave the previous image (if any) intact.
- **Image upload before product is saved:** The storage path depends on the Internal SKU, which only becomes canonical after the first save. New-product form either defers image upload until after first save (recommended) or uses a temporary/holding path. If deferred, the form should clearly indicate that image upload is available after the first save.
- **Invalid image file:** User selects a non-image file or a file over 5MB. Client-side validation rejects with a clear error before any upload attempt.
- **Product deleted with image still in storage:** If a product is ever hard-deleted, the storage object should be cleaned up as well. (Current spec uses soft-deactivation via `active = false`, so hard deletes are not in scope, but image cleanup should be tied to any future hard-delete flow.)
- **Stale `photoUrl` after storage deletion:** Storage deletion and `photoUrl` field clearing must happen atomically where possible. If the storage delete succeeds but the Firestore update fails (or vice versa), the product could show a broken image. Service should clear `photoUrl` first, then delete storage — if storage deletion fails, the orphaned object can be cleaned up later without breaking the UI.

---

## Acceptance Criteria

### Product Catalog
- [ ] Admin can create a new accessory product with all required fields (SKU, category, manufacturer, model) and optional fields (barcode, tags, description).
- [ ] Internal SKU is auto-suggested based on selected category and next available sequence number.
- [ ] Barcode uniqueness is validated on save; duplicate barcodes are rejected with a clear error.
- [ ] SKU uniqueness is validated on save; duplicate SKUs are rejected with a clear error.
- [ ] Admin can browse and search accessory products by category, manufacturer, active status, and free text.
- [ ] Admin can edit any product field except Internal SKU.
- [ ] Admin can deactivate a product; it disappears from entry/procurement dropdowns but remains in the product list with an "Inactive" badge.
- [ ] Product detail modal shows all fields including tags, description, and the product image (or "No Image" placeholder).
- [ ] Admin can upload a product image from within the catalog form; the image is stored in Firebase Storage at `accessory_images/{internalSku}/{fileName}` and the URL is saved to the product's `photoUrl` field.
- [ ] Uploaded images are validated client-side (must be an image type, max 5MB) before upload.
- [ ] Once an image is uploaded, it is visible in the catalog form as a preview immediately.
- [ ] Admin can replace or delete an existing product image from the catalog form.
- [ ] Product list rows show a thumbnail of the product image, or the text "No Image" as the default placeholder when no image is set.
- [ ] The accessory product form does NOT create a separate image management view — image upload is integrated directly into the catalog form.

### Categories
- [ ] On first use, the six seed categories are auto-created in `accessory_categories`.
- [ ] Admin can add new categories with a name and code.
- [ ] Admin can edit or deactivate existing categories.
- [ ] Category dropdown in the product form is populated from `accessory_categories`.

### Pricing
- [ ] Admin can view all accessory products with their dealer and retail prices in a table.
- [ ] Admin can inline-edit dealer and retail prices; changes are saved to `accessory_pricing`.
- [ ] Markup percentage and profit amount are calculated and displayed live.
- [ ] Regular users cannot access the pricing view or see dealer prices anywhere in the app.

### Inventory
- [ ] Admin can select a product (by SKU, barcode scan, or dropdown) in the inventory entry form and see current stock levels.
- [ ] Admin can adjust onHand, onDisplay, reserved, and defective quantities; adjustments that would result in negative values are rejected.
- [ ] Adjustments use atomic `FieldValue.increment()` operations.
- [ ] Inventory list view shows all stocked products with quantities, available count, and location.
- [ ] Inventory list supports filtering by category, manufacturer, stock status, and text search.
- [ ] Inventory list supports column sorting.
- [ ] Inventory list supports inline editing of quantity fields and location.
- [ ] Inventory summary view groups products by category and manufacturer with aggregate counts.
- [ ] Inactive products are excluded from the summary by default.

### Procurement
- [ ] Admin can create an accessory procurement order with supplier, date, and multi-item table.
- [ ] Items are selected from active accessory products; dealer price is pre-populated from `accessory_pricing` if available.
- [ ] Row totals and grand total are calculated automatically.
- [ ] Reference number is auto-generated on save in `APROC-{timestamp}-{random}` format.
- [ ] Save creates both the procurement document and a purchase-type ledger entry atomically.
- [ ] Admin can view, edit, record payment for, and receive stock from existing procurements.
- [ ] Procurement list supports search, status filter, and year filter.
- [ ] Payment recording creates a payment-type ledger entry and marks procurement as paid.
- [ ] Procurement delete soft-deletes associated ledger entries.

### Stock Receiving
- [ ] Receiving form pre-populates with procurement items and expected quantities.
- [ ] Admin can adjust received quantities per item (for partial receipts).
- [ ] Admin can set a bulk location for all items.
- [ ] Save atomically increments `onHand` in each item's `accessory_inventory` document and marks the procurement as received.
- [ ] Inventory documents are created for products being stocked for the first time.

### Ledger
- [ ] Accessory ledger entries are created for purchases and payments.
- [ ] Ledger view groups entries by procurement and shows running balance per supplier.
- [ ] Ledger is completely independent from the existing phone supplier ledger.
- [ ] Deleting a procurement soft-deletes its ledger entries (preserves audit trail).

### Navigation & Permissions
- [ ] All accessory views are accessible via new tabs in the app header.
- [ ] Tab visibility respects role-based permissions (admin vs user).
- [ ] Edit/view/payment/receive flows correctly set context state and switch active component.
- [ ] No existing phone management tabs, forms, or views are modified.

### Data Isolation
- [ ] All accessory data lives in new Firestore collections: `accessory_products`, `accessory_pricing`, `accessory_inventory`, `accessory_categories`, `accessory_locations`, `accessory_procurements`, `accessory_ledger`.
- [ ] All accessory images are stored in a new Firebase Storage path: `accessory_images/{internalSku}/`.
- [ ] No writes to any existing Firestore collection (`phones`, `inventory`, `inventory_counts`, `price_configurations`, `procurements`, `ledger`, `suppliers`, `users`, `phone_images`).
- [ ] No writes to the existing `phone_images/` Firebase Storage path.
- [ ] Suppliers collection is read-only (used to populate supplier dropdowns in procurement forms).

---

## Open Questions

All original open questions have been resolved. Decisions captured below:

- **Tab grouping — deferred.** The initial build adds all accessory tabs as a flat list alongside existing tabs. A grouped/nested header (e.g., "Phones" vs. "Accessories" groups or dropdowns) will be revisited in a later iteration once the UI becomes crowded in practice.
- **Supplier ledger — kept separate.** The accessory ledger (`accessory_ledger`) remains independent from the phone supplier ledger. No consolidated view is built in this iteration. Accessory procurement does NOT touch the existing `suppliers.totalOutstanding` field.
- **Retail price visibility — shown to all users in inventory views; dealer price restricted to admin.** The inventory list and summary views display retail price to regular users. Dealer price and the dedicated pricing management view are admin-only. The `accessory_pricing` collection's Firebase security rules should permit read access for retail price queries (or the retail price can be denormalized into a safe field where necessary — whichever the implementer prefers, as long as dealer price never reaches non-admin clients).
- **Barcode scanning — manual entry only.** The app does not currently have barcode scanning capability, and it is not in scope for this feature. Barcode lookup in the inventory entry form and at POS is via manual text input matching against the `barcode` field in `accessory_products`.
- **Sales recording — out of scope for this spec.** A separate POS / sales feature exists (or is being built separately) and will integrate with `accessory_inventory` by decrementing `onHand` and incrementing `sold` using `FieldValue.increment()`. This spec defines the inventory contract that the POS flow will consume but does not implement the POS flow itself.
- **Stock transfer — not in scope.** Investigation of the codebase found that `stock_transfers` is listed in `CLAUDE.md` as a "Key Firestore Collection" but there is **no actual implementation** anywhere in the source code referencing `stock_transfers`, `stockTransfers`, or a `StockTransfer` symbol. It appears to be a planned-but-unbuilt collection on the phone side. Since no phone stock-transfer functionality exists to mirror, accessory stock transfers are explicitly **out of scope** for this build and can be added in a future iteration if/when phone stock transfers are implemented.
