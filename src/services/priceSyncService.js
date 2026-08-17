import { collection, getDocs, query, where, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCurrentDate } from '../components/phone-selection/utils/phoneUtils';

// Inventory statuses considered sellable and therefore re-priced by the sync.
// 'On-Hand' is displayed as "Stock" in the UI; some legacy docs store 'Stock' literally.
const SELLABLE_STATUSES = ['On-Hand', 'Stock', 'On-Display'];

// Firestore allows at most 500 writes per batch
const BATCH_LIMIT = 500;

const normalizePrice = (value) => {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString().replace(/,/g, '')) || 0;
};

// Same deterministic doc ID scheme as usePhoneCache's updatePriceConfiguration
const buildConfigId = (manufacturer, model, ram, storage, color = null) => {
  const parts = color
    ? `${manufacturer}_${model}_${ram}_${storage}_${color}`
    : `${manufacturer}_${model}_${ram}_${storage}`;
  return parts.replace(/\s+/g, '_').toLowerCase();
};

/**
 * Sync pricing for one model/spec across the base price configuration,
 * all existing color configurations, and all sellable inventory (all colors).
 *
 * Skips all writes when every existing configuration already holds the new
 * prices. Never touches inventory lastUpdated/dateAdded, and never modifies
 * items whose status is not sellable (Sold, Reserved, Defective, etc.).
 */
export const syncModelPricing = async (manufacturer, model, ram, storage, dealersPrice, retailPrice) => {
  try {
    const dPrice = normalizePrice(dealersPrice);
    const rPrice = normalizePrice(retailPrice);

    // Fetch base + all color config docs for this spec
    const configsQuery = query(
      collection(db, 'price_configurations'),
      where('manufacturer', '==', manufacturer),
      where('model', '==', model),
      where('ram', '==', ram),
      where('storage', '==', storage)
    );
    const configsSnap = await getDocs(configsQuery);

    const configsUnchanged =
      !configsSnap.empty &&
      configsSnap.docs.every((d) => {
        const data = d.data();
        return data.dealersPrice === dPrice && data.retailPrice === rPrice;
      });

    if (configsUnchanged) {
      return { success: true, updatedInventoryCount: 0, skipped: true };
    }

    // Update the base config (creating it if missing) and every existing color config
    const configWrites = [];
    const seenConfigIds = new Set();

    const baseId = buildConfigId(manufacturer, model, ram, storage);
    seenConfigIds.add(baseId);
    configWrites.push(
      setDoc(doc(db, 'price_configurations', baseId), {
        manufacturer,
        model,
        ram,
        storage,
        color: null,
        dealersPrice: dPrice,
        retailPrice: rPrice,
        lastUpdated: getCurrentDate()
      }, { merge: true })
    );

    configsSnap.docs.forEach((d) => {
      const data = d.data();
      if (!data.color) return; // base doc already handled above
      const colorId = buildConfigId(manufacturer, model, ram, storage, data.color);
      if (seenConfigIds.has(colorId)) return;
      seenConfigIds.add(colorId);
      configWrites.push(
        setDoc(doc(db, 'price_configurations', colorId), {
          manufacturer,
          model,
          ram,
          storage,
          color: data.color,
          dealersPrice: dPrice,
          retailPrice: rPrice,
          lastUpdated: getCurrentDate()
        }, { merge: true })
      );
    });

    await Promise.all(configWrites);

    // Sync all sellable inventory for this spec (all colors).
    // Status is filtered client-side to avoid needing a new composite index.
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('manufacturer', '==', manufacturer),
      where('model', '==', model),
      where('ram', '==', ram),
      where('storage', '==', storage)
    );
    const inventorySnap = await getDocs(inventoryQuery);

    const sellableDocs = inventorySnap.docs.filter((d) =>
      SELLABLE_STATUSES.includes(d.data().status)
    );

    for (let i = 0; i < sellableDocs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      sellableDocs.slice(i, i + BATCH_LIMIT).forEach((d) => {
        batch.update(d.ref, {
          dealersPrice: dPrice,
          retailPrice: rPrice
          // Deliberately NOT updating lastUpdated/dateAdded — same rule as PriceManagementForm
        });
      });
      await batch.commit();
    }

    return { success: true, updatedInventoryCount: sellableDocs.length, skipped: false };
  } catch (error) {
    console.error('Error syncing model pricing:', error);
    return { success: false, error: error.message };
  }
};

export default { syncModelPricing };
