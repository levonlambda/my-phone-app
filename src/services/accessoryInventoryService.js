/* ========== ACCESSORY INVENTORY SERVICE ========== */
/* Handles quantity-based inventory operations for accessories. */
/* Mirrors the structure of src/components/phone-selection/services/InventoryService.js */
/* but uses a simpler single-document-per-product model (no per-unit tracking). */
/* IMPORTANT: Only writes to accessory_inventory and accessory_procurements. */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';

const QUANTITY_FIELDS = ['onHand', 'onDisplay', 'reserved', 'defective'];

/* ========== READ OPERATIONS ========== */

/**
 * Fetch the inventory document for a single SKU.
 * Returns { success, inventory } where inventory is null if no doc exists.
 */
export const getAccessoryInventory = async (sku) => {
  try {
    if (!sku) throw new Error('SKU is required');
    const ref = doc(db, 'accessory_inventory', sku);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { success: true, inventory: null };
    }
    return {
      success: true,
      inventory: { id: snap.id, ...snap.data() }
    };
  } catch (error) {
    console.error('Error fetching accessory inventory:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch every inventory document.
 */
export const getAllAccessoryInventory = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_inventory'));
    const inventory = [];
    snapshot.forEach((d) => {
      inventory.push({ id: d.id, ...d.data() });
    });
    return { success: true, inventory };
  } catch (error) {
    console.error('Error fetching all accessory inventory:', error);
    return { success: false, error: error.message, inventory: [] };
  }
};

/* ========== ADJUSTMENT OPERATIONS ========== */

/**
 * Atomically adjust inventory counts for a SKU. Creates the inventory
 * document if it doesn't exist yet.
 *
 * adjustments shape:
 *   { onHand?: number, onDisplay?: number, reserved?: number, defective?: number,
 *     location?: string }
 *
 * Positive numbers add; negative numbers subtract. The transaction reads the
 * current document first so it can reject the change if any field would go
 * negative. `sold` is intentionally NOT adjustable here — use recordAccessorySale.
 */
export const adjustAccessoryInventory = async (sku, adjustments = {}) => {
  try {
    if (!sku) throw new Error('SKU is required');

    const quantityDeltas = {};
    QUANTITY_FIELDS.forEach((field) => {
      if (adjustments[field] !== undefined && adjustments[field] !== null && adjustments[field] !== '') {
        const delta = Number(adjustments[field]);
        if (!Number.isFinite(delta)) {
          throw new Error(`Adjustment for ${field} must be a number`);
        }
        if (delta !== 0) {
          quantityDeltas[field] = delta;
        }
      }
    });

    const nextLocation = adjustments.location;
    const hasLocationUpdate = nextLocation !== undefined && nextLocation !== null;
    const hasQuantityChange = Object.keys(quantityDeltas).length > 0;

    if (!hasQuantityChange && !hasLocationUpdate) {
      return { success: true, message: 'No changes to apply' };
    }

    await runTransaction(db, async (transaction) => {
      const invRef = doc(db, 'accessory_inventory', sku);
      const snap = await transaction.get(invRef);

      if (!snap.exists()) {
        // Creating a new inventory doc — all starting values are 0, deltas must
        // therefore be non-negative.
        const newDoc = {
          onHand: 0,
          onDisplay: 0,
          reserved: 0,
          defective: 0,
          sold: 0,
          location: nextLocation || '',
          lastUpdated: Timestamp.now()
        };
        for (const [field, delta] of Object.entries(quantityDeltas)) {
          const next = newDoc[field] + delta;
          if (next < 0) {
            throw new Error(`Cannot set ${field} below zero (attempted ${next})`);
          }
          newDoc[field] = next;
        }
        transaction.set(invRef, newDoc);
      } else {
        const current = snap.data();

        // Validate no field would go negative
        for (const [field, delta] of Object.entries(quantityDeltas)) {
          const nextValue = (current[field] || 0) + delta;
          if (nextValue < 0) {
            throw new Error(`Cannot reduce ${field} below zero (current ${current[field] || 0}, delta ${delta})`);
          }
        }

        const updatePayload = { lastUpdated: Timestamp.now() };
        for (const [field, delta] of Object.entries(quantityDeltas)) {
          updatePayload[field] = increment(delta);
        }
        if (hasLocationUpdate) {
          updatePayload.location = nextLocation;
        }
        transaction.update(invRef, updatePayload);
      }
    });

    return { success: true, message: 'Inventory adjusted successfully' };
  } catch (error) {
    console.error('Error adjusting accessory inventory:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Receive stock from a procurement. Atomically:
 *   - increments onHand for each received SKU (creating the inventory doc if missing)
 *   - optionally sets location (bulk value, applied when provided)
 *   - marks the procurement isReceived and stores delivery metadata
 *
 * receivedItems shape: [{ internalSku, quantity, location? }, ...]
 */
export const receiveAccessoryStock = async (procurementId, receivedItems, dateDelivered, deliveryReference = '') => {
  try {
    if (!procurementId) throw new Error('Procurement ID is required');
    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      throw new Error('receivedItems must be a non-empty array');
    }

    // Validate quantities up front
    receivedItems.forEach((item) => {
      if (!item.internalSku) throw new Error('Each received item must have an internalSku');
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new Error(`Invalid received quantity for SKU ${item.internalSku}`);
      }
    });

    await runTransaction(db, async (transaction) => {
      const procurementRef = doc(db, 'accessory_procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);
      if (!procurementSnap.exists()) {
        throw new Error('Accessory procurement not found');
      }

      // Read all inventory docs first (Firestore transactions: reads before writes)
      const invRefs = receivedItems.map((item) => doc(db, 'accessory_inventory', item.internalSku));
      const invSnaps = await Promise.all(invRefs.map((r) => transaction.get(r)));

      // Apply writes
      receivedItems.forEach((item, idx) => {
        const qty = Number(item.quantity);
        if (qty === 0) return;
        const invRef = invRefs[idx];
        const invSnap = invSnaps[idx];

        if (!invSnap.exists()) {
          transaction.set(invRef, {
            onHand: qty,
            onDisplay: 0,
            reserved: 0,
            defective: 0,
            sold: 0,
            location: item.location || '',
            lastUpdated: Timestamp.now()
          });
        } else {
          const updatePayload = {
            onHand: increment(qty),
            lastUpdated: Timestamp.now()
          };
          if (item.location !== undefined && item.location !== null && item.location !== '') {
            updatePayload.location = item.location;
          }
          transaction.update(invRef, updatePayload);
        }
      });

      transaction.update(procurementRef, {
        isReceived: true,
        dateDelivered: dateDelivered || new Date().toISOString().split('T')[0],
        deliveryReference: deliveryReference || '',
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
 * Record a sale: decrement onHand, increment sold. Atomic. Intended for the
 * POS / sales feature to call — rejected if onHand would go negative.
 */
export const recordAccessorySale = async (sku, quantity) => {
  try {
    if (!sku) throw new Error('SKU is required');
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Sale quantity must be a positive number');
    }

    await runTransaction(db, async (transaction) => {
      const invRef = doc(db, 'accessory_inventory', sku);
      const snap = await transaction.get(invRef);
      if (!snap.exists()) {
        throw new Error('Inventory record not found for this product');
      }
      const current = snap.data();
      const currentOnHand = current.onHand || 0;
      if (currentOnHand < qty) {
        throw new Error(`Insufficient stock: onHand=${currentOnHand}, requested=${qty}`);
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
  getAccessoryInventory,
  getAllAccessoryInventory,
  adjustAccessoryInventory,
  receiveAccessoryStock,
  recordAccessorySale
};
