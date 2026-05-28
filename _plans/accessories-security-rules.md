# Phase 6 — Firebase Security Rules + Polish

## Context

The Accessories Management feature is functionally complete through Phase 5. Phase 6 finishes the rollout by replacing two expiring test-mode rules and running a manual QA pass.

Both current rules are time-bombed catch-alls that will deny all traffic once they expire:

- **Firestore** expires **June 1, 2026** — breaks the entire app (phones and accessories)
- **Storage** expires **June 30, 2026** — breaks all image loads and uploads

Today is **May 18, 2026**, so Firestore is the urgent one (14 days).

**Constraint:** a separate mobile app connects to the same Firestore database and Storage bucket and does **not** use Firebase Authentication. An auth-only rule would lock it out. For now we are removing the expiry date but keeping the rule fully open (no auth required). This matches the current security posture (which is "anyone with the project ID has full access") but removes the time bomb.

The user-vs-admin distinction in this app continues to be enforced **at the UI level** via `userRole` from `AuthContext` and conditional rendering (e.g., admin-only DP column in `InventorySummaryForm` and the matching accessory views). Phase 6 does not change that.

This makes Phase 6 a **rules-only** change. No code changes are required.

> **Security note (read before publishing):** the rules below grant unrestricted read/write access to the database and Storage bucket to anyone with your Firebase project ID. This is the same posture as the current expiring rules. It is a **temporary measure** to keep the mobile app working. The proper long-term fix is to add Firebase Auth to the mobile app and then re-tighten these rules — see the "Future hardening" section.

---

## Step 1 — Replace the Firestore rule

### Console path

Firebase Console → your project → **Firestore Database** → **Rules** tab.

### Replace the entire contents with

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### What changes

| Before | After |
|---|---|
| Anyone can read/write | Anyone can read/write (unchanged) |
| Rule expires June 1, 2026 | No expiry |
| App will break in 14 days | Web app and mobile app continue working past June 1 |

### Click

**Publish** — propagation takes ~1 minute.

---

## Step 2 — Replace the Storage rule

### Console path

Firebase Console → your project → **Storage** → **Rules** tab.

### Replace the entire contents with

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### What changes

| Before | After |
|---|---|
| Anyone with the bucket URL can read/upload/delete | Anyone with the bucket URL can read/upload/delete (unchanged) |
| Rule expires June 30, 2026 | No expiry |
| Image URLs work for anonymous browsers | Image URLs continue to work for anonymous browsers (mobile app keeps working) |

### Click

**Publish** — propagation takes ~1 minute.

### Note on the comment block

The Firebase-generated comment at the top of the Storage rule template hints at the admin-only-write pattern using `firestore.get(...).data.isAdmin`. We're not adopting that for Phase 6 because the equivalent gating is already done in the UI. If you ever want to lock down admin-only writes at the rule level later, that's the snippet to start from.

---

## Step 3 — QA checklist

Run through this after both rules are published. Tests are organized by area so you can stop and recover quickly if something fails.

### A — Auth + smoke tests (do these first)

- [ ] Sign out, then sign back in as an admin user — login succeeds
- [ ] Open the app at the home tab — no console errors
- [ ] Sign out, then sign back in as a regular user — login succeeds
- [ ] Switch tabs (phone list, inventory, prices) — no permission-denied errors

### B — Phone regression (verify Phase 6 didn't break existing flows)

- [ ] Browse phone list — phones load, thumbnails render
- [ ] Open a phone detail modal — image and details display
- [ ] As admin: open Inventory Summary — DP column visible, retail visible
- [ ] As regular user: open Inventory Summary — DP column hidden, retail visible
- [ ] As admin: create or edit a phone procurement — saves successfully
- [ ] As admin: open Supplier ledger view — entries load

### C — Accessory products + images

- [ ] As admin: open Acc. Products tab — form renders
- [ ] Add a new test product without an image — saves to `accessory_products`
- [ ] Edit the product, upload an image — file lands in `accessory_images/{sku}/primary.png`, `photoUrl` is set
- [ ] Replace the image — old file overwritten, new URL renders
- [ ] Delete the image — `photoUrl` cleared, Storage object removed
- [ ] Open Acc. Product List — thumbnails render for products that have images
- [ ] Click a product row — detail modal opens, image displays

### D — Accessory pricing + role gating

- [ ] As admin: open Acc. Prices — set DP and retail for two products, markup/profit calculate
- [ ] Sign out, sign in as regular user
- [ ] Verify Acc. Prices tab is hidden (admin-only)
- [ ] As regular user: open Acc. Inventory list — retail price visible, dealer price column hidden
- [ ] As regular user: open Acc. Inventory Summary — retail visible, DP and Margin columns hidden

### E — Accessory inventory + locations

- [ ] As admin: open Acc. Entry, pick a store and product, adjust onHand and onDisplay — saves atomically
- [ ] Verify the inventory doc at `accessory_inventory/{sku}__{locationId}` has the new values
- [ ] Open Acc. Inventory list with All Stores — every (product, store) row appears including zero-stock rows
- [ ] Switch to a specific store — only rows for that store appear
- [ ] Open Acc. Summary — products group correctly, expandable rows show per-store breakdown

### F — Accessory procurement + receiving + ledger

- [ ] As admin: create an accessory procurement (supplier + destination store + 2 items) — saves, ledger entry created
- [ ] Open Acc. Proc. Mgmt — new procurement appears with correct totals
- [ ] Verify the Pending column on Acc. Inventory list now reflects the unreceived quantity
- [ ] Open Stock Receiving for that procurement — pre-populated correctly
- [ ] Receive full quantities — inventory `onHand` increments, procurement marked received
- [ ] Pending column on Acc. Inventory drops back to zero for that procurement
- [ ] Record a payment on a procurement — payment ledger entry created, status flips to paid
- [ ] Open Acc. Ledger — select the supplier, all entries appear with running balance
- [ ] Soft-delete a procurement — ledger entries remain visible with "Deleted" chip

### G — Mobile app (verify the no-auth rule keeps it working)

- [ ] Open the mobile app — connects to Firestore successfully
- [ ] Verify a read flow that previously worked (e.g., browsing phone list or inventory)
- [ ] Verify a write flow that previously worked (whichever flow the mobile app supports)
- [ ] Confirm no permission errors in the mobile app's logs

---

## Step 4 — Cross-cutting verification (do once at the end)

- [ ] Firebase Console → Firestore → confirm no writes hit existing phone collections (`phones`, `inventory`, `procurements`, `supplier_ledger`, `suppliers`, `users`, `phone_images`, `inventory_counts`, `price_configurations`) during any accessory flow
- [ ] Firebase Console → Storage → confirm no writes hit `phone_images/` during any accessory image upload
- [ ] Mark the Phase 6 box on `_plans/accessories-management.md` complete

---

## Rollback plan

If anything breaks after publishing, the previous rule can be restored from Firebase Console → Rules → **History** tab (Firebase keeps a history of every published version). Click the prior version → **Restore**. Propagation takes ~1 minute.

---

## Future hardening (not part of Phase 6, but important)

The rules above are **fully open** — anyone with your Firebase project ID can read or write anything. This is a deliberate temporary state because the mobile app does not use Firebase Auth.

The proper sequence to tighten security later:

1. **Add Firebase Auth to the mobile app** — give it a service account or sign it in as a dedicated user
2. **Switch both rules to authenticated-only** (the original Option 2 we discussed):
   ```javascript
   allow read, write: if request.auth != null;
   ```
3. **Optionally add role-level enforcement** for admin-only collections:
   ```javascript
   function isAdmin() {
     return request.auth != null &&
            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
   }

   match /accessory_pricing/{sku} {
     allow read: if request.auth != null;
     allow write: if isAdmin();
   }
   // ... similar blocks for accessory_procurements, accessory_ledger, etc.
   ```

Step 3 is a larger project because every existing phone collection would also benefit from the same treatment, so it's worth doing project-wide rather than accessory-only.
