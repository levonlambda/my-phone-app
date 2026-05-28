/* ========== ACCESSORY INVENTORY SERVICE ========== */
/* Handles quantity-based inventory operations for accessories, scoped per */
/* (sku, locationId) pair. Each store has its own onHand/onDisplay/reserved/ */
/* defective/sold counters for each product. */
/*
 * Document ID format: `{sku}__{locationId}` (composite). The sku and
 * locationId are ALSO stored as fields for where-clause queries.
 * locationName is denormalized for display — refreshed on every write.
 *
 * IMPORTANT: Only writes to accessory_inventory and accessory_procurements.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';

const QUANTITY_FIELDS = ['onHand', 'onDisplay', 'reserved', 'defective'];
const ADJUSTMENTS_COLLECTION = 'accessory_inventory_adjustments';

const buildQuantitySnapshot = (data) => ({
  onHand: data?.onHand || 0,
  onDisplay: data?.onDisplay || 0,
  reserved: data?.reserved || 0,
  defective: data?.defective || 0
});

/**
 * Deterministic composite inventory document ID.
 */
export const composeInventoryId = (sku, locationId) => `${sku}__${locationId}`;

/* ========== READ OPERATIONS ========== */

/**
 * Fetch the inventory document for a single (sku, locationId) pair.
 * Returns { success, inventory } where inventory is null if no doc exists yet.
 */
export const getAccessoryInventory = async (sku, locationId) => {
  try {
    if (!sku) throw new Error('SKU is required');
    if (!locationId) throw new Error('Location ID is required');
    const ref = doc(db, 'accessory_inventory', composeInventoryId(sku, locationId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: true, inventory: null };
    return { success: true, inventory: { id: snap.id, ...snap.data() } };
  } catch (error) {
    console.error('Error fetching accessory inventory:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch every inventory document (all SKUs, all locations).
 */
export const getAllAccessoryInventory = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_inventory'));
    const inventory = [];
    snapshot.forEach((d) => inventory.push({ id: d.id, ...d.data() }));
    return { success: true, inventory };
  } catch (error) {
    console.error('Error fetching all accessory inventory:', error);
    return { success: false, error: error.message, inventory: [] };
  }
};

/**
 * Fetch every inventory doc for a specific SKU (all locations).
 */
export const getInventoryForSku = async (sku) => {
  try {
    if (!sku) throw new Error('SKU is required');
    const q = query(collection(db, 'accessory_inventory'), where('sku', '==', sku));
    const snap = await getDocs(q);
    const inventory = [];
    snap.forEach((d) => inventory.push({ id: d.id, ...d.data() }));
    return { success: true, inventory };
  } catch (error) {
    console.error('Error fetching inventory for SKU:', error);
    return { success: false, error: error.message, inventory: [] };
  }
};

/**
 * Fetch every inventory doc at a specific location (all SKUs).
 */
export const getInventoryForLocation = async (locationId) => {
  try {
    if (!locationId) throw new Error('Location ID is required');
    const q = query(
      collection(db, 'accessory_inventory'),
      where('locationId', '==', locationId)
    );
    const snap = await getDocs(q);
    const inventory = [];
    snap.forEach((d) => inventory.push({ id: d.id, ...d.data() }));
    return { success: true, inventory };
  } catch (error) {
    console.error('Error fetching inventory for location:', error);
    return { success: false, error: error.message, inventory: [] };
  }
};

/* ========== ADJUSTMENT OPERATIONS ========== */

/**
 * Atomically adjust inventory counts for a (sku, locationId) pair. Creates
 * the inventory document if it doesn't exist yet (denormalizing locationName
 * from the location doc). Writes an audit record to
 * accessory_inventory_adjustments inside the same transaction so the audit
 * trail can never drift from the inventory state.
 *
 * adjustments shape:
 *   { onHand?: number, onDisplay?: number, reserved?: number, defective?: number }
 *
 * metadata shape (all required):
 *   { reason: string, userId?: string, userEmail?: string }
 *
 * Positive numbers add; negative numbers subtract. The transaction reads the
 * current document first so it can reject the change if any field would go
 * negative. `sold` is intentionally NOT adjustable here — use recordAccessorySale.
 */
export const adjustAccessoryInventory = async (
  sku,
  locationId,
  adjustments = {},
  metadata = {}
) => {
  try {
    if (!sku) throw new Error('SKU is required');
    if (!locationId) throw new Error('Location ID is required');

    const reason = String(metadata.reason || '').trim();
    if (!reason) {
      throw new Error('A reason is required for inventory adjustments');
    }

    const quantityDeltas = {};
    QUANTITY_FIELDS.forEach((field) => {
      if (
        adjustments[field] !== undefined &&
        adjustments[field] !== null &&
        adjustments[field] !== ''
      ) {
        const delta = Number(adjustments[field]);
        if (!Number.isFinite(delta)) {
          throw new Error(`Adjustment for ${field} must be a number`);
        }
        if (delta !== 0) quantityDeltas[field] = delta;
      }
    });

    if (Object.keys(quantityDeltas).length === 0) {
      return { success: true, message: 'No changes to apply' };
    }

    await runTransaction(db, async (transaction) => {
      const invRef = doc(db, 'accessory_inventory', composeInventoryId(sku, locationId));
      const locRef = doc(db, 'accessory_locations', locationId);

      const [invSnap, locSnap] = await Promise.all([
        transaction.get(invRef),
        transaction.get(locRef)
      ]);

      if (!locSnap.exists()) {
        throw new Error('Location not found — it may have been deleted');
      }
      const locationName = locSnap.data().name || '(Unknown)';

      const before = invSnap.exists()
        ? buildQuantitySnapshot(invSnap.data())
        : buildQuantitySnapshot(null);

      const after = { ...before };
      for (const [field, delta] of Object.entries(quantityDeltas)) {
        const next = before[field] + delta;
        if (next < 0) {
          throw new Error(
            `Cannot reduce ${field} below zero (current ${before[field]}, delta ${delta})`
          );
        }
        after[field] = next;
      }

      if (!invSnap.exists()) {
        transaction.set(invRef, {
          sku,
          locationId,
          locationName,
          ...after,
          sold: 0,
          lastUpdated: Timestamp.now()
        });
      } else {
        const updatePayload = {
          locationName, // refresh denormalized name in case location was renamed
          lastUpdated: Timestamp.now()
        };
        for (const [field, delta] of Object.entries(quantityDeltas)) {
          updatePayload[field] = increment(delta);
        }
        transaction.update(invRef, updatePayload);
      }

      const auditRef = doc(collection(db, ADJUSTMENTS_COLLECTION));
      transaction.set(auditRef, {
        sku,
        locationId,
        locationName,
        userId: metadata.userId || null,
        userEmail: metadata.userEmail || null,
        timestamp: Timestamp.now(),
        before,
        after,
        delta: { ...quantityDeltas },
        reason,
        source: metadata.source || 'manual-entry'
      });
    });

    return { success: true, message: 'Inventory adjusted successfully' };
  } catch (error) {
    console.error('Error adjusting accessory inventory:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch every adjustment-history entry across all SKUs and stores, sorted by
 * timestamp desc. Used by the global audit log view. Caps at limitCount so a
 * runaway collection doesn't blow up the client; bump it if needed.
 */
export const getAllAdjustments = async (limitCount = 500) => {
  try {
    const snap = await getDocs(collection(db, ADJUSTMENTS_COLLECTION));
    const entries = [];
    snap.forEach((d) => entries.push({ id: d.id, ...d.data() }));
    entries.sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return tb - ta;
    });
    return { success: true, entries: entries.slice(0, Math.max(1, limitCount)) };
  } catch (error) {
    console.error('Error fetching all adjustments:', error);
    return { success: false, error: error.message, entries: [] };
  }
};

/**
 * Fetch the most recent adjustment-history entries for a (sku, locationId)
 * pair. Filters server-side by sku (single where clause — no composite index
 * required) and refines by locationId client-side, then sorts by timestamp
 * desc and slices to limitCount. Fine for the small data volumes expected
 * at this scale.
 */
export const getAdjustmentHistory = async (sku, locationId, limitCount = 50) => {
  try {
    if (!sku) throw new Error('SKU is required');
    if (!locationId) throw new Error('Location ID is required');
    const q = query(collection(db, ADJUSTMENTS_COLLECTION), where('sku', '==', sku));
    const snap = await getDocs(q);
    const entries = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.locationId === locationId) {
        entries.push({ id: d.id, ...data });
      }
    });
    entries.sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return tb - ta;
    });
    return { success: true, entries: entries.slice(0, Math.max(1, limitCount)) };
  } catch (error) {
    console.error('Error fetching adjustment history:', error);
    return { success: false, error: error.message, entries: [] };
  }
};

/**
 * Receive stock from a procurement INTO a specific location. Atomically:
 *   - increments onHand / onDisplay / defective per SKU as allocated by the
 *     caller (creating the inventory doc if missing)
 *   - marks the procurement isReceived and stores delivery metadata
 *   - stores receivedBreakdown on the procurement so view-only mode can
 *     reproduce the per-bucket split
 *
 * receivedItems shape:
 *   [{ internalSku, onHand?: number, onDisplay?: number, defective?: number }, ...]
 *
 * Items with all zero buckets are skipped.
 */
const RECEIVE_BUCKETS = ['onHand', 'onDisplay', 'defective'];

export const receiveAccessoryStock = async (
  procurementId,
  receivedItems,
  dateDelivered,
  deliveryReference = '',
  locationId
) => {
  try {
    if (!procurementId) throw new Error('Procurement ID is required');
    if (!locationId) throw new Error('Destination location ID is required');
    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      throw new Error('receivedItems must be a non-empty array');
    }

    // Normalize each line into an object with numeric onHand/onDisplay/defective
    // and a total. Reject negatives and non-finite values up front.
    const normalized = receivedItems.map((item) => {
      if (!item.internalSku) throw new Error('Each received item must have an internalSku');
      const buckets = {};
      let total = 0;
      RECEIVE_BUCKETS.forEach((b) => {
        const raw = item[b];
        if (raw === undefined || raw === null || raw === '') {
          buckets[b] = 0;
        } else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error(`Invalid ${b} quantity for SKU ${item.internalSku}`);
          }
          buckets[b] = n;
        }
        total += buckets[b];
      });
      return { internalSku: item.internalSku, ...buckets, total };
    });

    await runTransaction(db, async (transaction) => {
      const procurementRef = doc(db, 'accessory_procurements', procurementId);
      const locRef = doc(db, 'accessory_locations', locationId);

      // All reads must come before any writes in a transaction
      const invRefs = normalized.map((item) =>
        doc(db, 'accessory_inventory', composeInventoryId(item.internalSku, locationId))
      );
      const [procurementSnap, locSnap, ...invSnaps] = await Promise.all([
        transaction.get(procurementRef),
        transaction.get(locRef),
        ...invRefs.map((r) => transaction.get(r))
      ]);

      if (!procurementSnap.exists()) throw new Error('Accessory procurement not found');
      if (!locSnap.exists()) throw new Error('Destination location not found');
      const locationName = locSnap.data().name || '(Unknown)';

      normalized.forEach((item, idx) => {
        if (item.total === 0) return;
        const invRef = invRefs[idx];
        const invSnap = invSnaps[idx];

        if (!invSnap.exists()) {
          transaction.set(invRef, {
            sku: item.internalSku,
            locationId,
            locationName,
            onHand: item.onHand,
            onDisplay: item.onDisplay,
            reserved: 0,
            defective: item.defective,
            sold: 0,
            lastUpdated: Timestamp.now()
          });
        } else {
          const updatePayload = {
            locationName,
            lastUpdated: Timestamp.now()
          };
          RECEIVE_BUCKETS.forEach((b) => {
            if (item[b] > 0) updatePayload[b] = increment(item[b]);
          });
          transaction.update(invRef, updatePayload);
        }
      });

      transaction.update(procurementRef, {
        isReceived: true,
        dateDelivered: dateDelivered || new Date().toISOString().split('T')[0],
        deliveryReference: deliveryReference || '',
        deliveryLocationId: locationId,
        deliveryLocationName: locationName,
        receivedBreakdown: normalized.map(({ internalSku, onHand, onDisplay, defective }) => ({
          internalSku,
          onHand,
          onDisplay,
          defective
        })),
        lastUpdated: Timestamp.now()
      });
    });

    return { success: true, message: 'Stock received successfully' };
  } catch (error) {
    console.error('Error receiving accessory stock:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Record a sale at a specific location. Atomic: onHand -= qty; sold += qty.
 * Rejects if onHand at that location would go negative.
 */
export const recordAccessorySale = async (sku, quantity, locationId) => {
  try {
    if (!sku) throw new Error('SKU is required');
    if (!locationId) throw new Error('Location ID is required');
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Sale quantity must be a positive number');
    }

    await runTransaction(db, async (transaction) => {
      const invRef = doc(db, 'accessory_inventory', composeInventoryId(sku, locationId));
      const snap = await transaction.get(invRef);
      if (!snap.exists()) {
        throw new Error('No inventory for this product at the selected location');
      }
      const current = snap.data();
      const currentOnHand = current.onHand || 0;
      if (currentOnHand < qty) {
        throw new Error(
          `Insufficient stock at ${current.locationName || 'this location'}: onHand=${currentOnHand}, requested=${qty}`
        );
      }
      transaction.update(invRef, {
        onHand: increment(-qty),
        sold: increment(qty),
        lastUpdated: Timestamp.now()
      });
    });

    return { success: true, message: 'Sale recorded successfully' };
  } catch (error) {
    console.error('Error recording accessory sale:', error);
    return { success: false, error: error.message };
  }
};

/* ========== EXPORT STATEMENT ========== */

export default {
  composeInventoryId,
  getAccessoryInventory,
  getAllAccessoryInventory,
  getInventoryForSku,
  getInventoryForLocation,
  adjustAccessoryInventory,
  getAdjustmentHistory,
  getAllAdjustments,
  receiveAccessoryStock,
  recordAccessorySale
};
