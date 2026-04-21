/* ========== ACCESSORY SERVICE ========== */
/* Handles all accessory product, category, pricing, procurement, and ledger operations. */
/* Mirrors the structure of supplierService.js. */
/* IMPORTANT: This service ONLY writes to the following collections: */
/*   - accessory_products */
/*   - accessory_categories */
/*   - accessory_pricing */
/*   - accessory_procurements */
/*   - accessory_ledger */
/* Existing collections (phones, inventory, suppliers, procurements, supplier_ledger, */
/* price_configurations, phone_images, users) are NEVER touched here. */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

/* ========== UTILITY FUNCTIONS ========== */

/**
 * Get current date in YYYY-MM-DD format (matches supplierService convention).
 */
export const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Generate accessory procurement reference number.
 */
export const generateAccessoryProcurementReference = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APROC-${timestamp}-${random}`;
};

/**
 * Generate accessory payment reference number.
 */
export const generateAccessoryPaymentReference = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APAY-${timestamp}-${random}`;
};

/* ========== PRODUCT OPERATIONS (accessory_products collection) ========== */

/**
 * Create a new accessory product. The document ID is the Internal SKU.
 * Fails if the SKU or barcode already exists.
 */
export const createAccessoryProduct = async (productData) => {
  try {
    const { internalSku, barcode } = productData;

    if (!internalSku) {
      throw new Error('Internal SKU is required');
    }

    // Check SKU uniqueness
    const skuTaken = await isSkuTaken(internalSku);
    if (skuTaken) {
      return { success: false, error: `SKU "${internalSku}" already exists` };
    }

    // Check barcode uniqueness if provided
    if (barcode) {
      const barcodeTaken = await isBarcodeTaken(barcode);
      if (barcodeTaken) {
        return { success: false, error: `Barcode "${barcode}" already exists on another product` };
      }
    }

    const productDoc = {
      ...productData,
      internalSku,
      active: productData.active !== undefined ? productData.active : true,
      photoUrl: productData.photoUrl || '',
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };

    const docRef = doc(db, 'accessory_products', internalSku);
    await setDoc(docRef, productDoc);

    return {
      success: true,
      id: internalSku,
      message: 'Accessory product created successfully'
    };
  } catch (error) {
    console.error('Error creating accessory product:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing accessory product. The Internal SKU (doc ID) is immutable.
 */
export const updateAccessoryProduct = async (sku, productData) => {
  try {
    if (!sku) throw new Error('SKU is required');

    // If barcode is changing, validate uniqueness against other docs
    if (productData.barcode) {
      const barcodeTaken = await isBarcodeTaken(productData.barcode, sku);
      if (barcodeTaken) {
        return { success: false, error: `Barcode "${productData.barcode}" already exists on another product` };
      }
    }

    const productRef = doc(db, 'accessory_products', sku);

    // Strip out the SKU field if included — doc ID is immutable
    const updateData = { ...productData };
    delete updateData.internalSku;

    await updateDoc(productRef, {
      ...updateData,
      lastUpdated: Timestamp.now()
    });

    return { success: true, message: 'Accessory product updated successfully' };
  } catch (error) {
    console.error('Error updating accessory product:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch a single accessory product by its Internal SKU.
 */
export const getAccessoryProductBySku = async (sku) => {
  try {
    const productRef = doc(db, 'accessory_products', sku);
    const snap = await getDoc(productRef);

    if (!snap.exists()) {
      return { success: false, error: 'Product not found' };
    }

    return {
      success: true,
      product: { id: snap.id, ...snap.data() }
    };
  } catch (error) {
    console.error('Error fetching accessory product:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch all accessory products.
 */
export const getAllAccessoryProducts = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_products'));
    const products = [];
    snapshot.forEach((d) => {
      products.push({ id: d.id, ...d.data() });
    });

    return { success: true, products };
  } catch (error) {
    console.error('Error fetching accessory products:', error);
    return { success: false, error: error.message, products: [] };
  }
};

/**
 * Fetch a single accessory product by its barcode (POS lookup).
 * Returns { success, product } where product is null if not found.
 */
export const getProductByBarcode = async (barcode) => {
  try {
    if (!barcode) {
      return { success: false, error: 'Barcode is required', product: null };
    }

    const q = query(
      collection(db, 'accessory_products'),
      where('barcode', '==', barcode)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, product: null };
    }

    const doc0 = snapshot.docs[0];
    return {
      success: true,
      product: { id: doc0.id, ...doc0.data() }
    };
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    return { success: false, error: error.message, product: null };
  }
};

/**
 * Check if a SKU (document ID) is already in use.
 */
export const isSkuTaken = async (sku) => {
  if (!sku) return false;
  const snap = await getDoc(doc(db, 'accessory_products', sku));
  return snap.exists();
};

/**
 * Check if a barcode exists on any OTHER accessory product.
 * Pass excludeSku to skip the product being edited.
 */
export const isBarcodeTaken = async (barcode, excludeSku = null) => {
  if (!barcode) return false;
  const q = query(
    collection(db, 'accessory_products'),
    where('barcode', '==', barcode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;
  return snapshot.docs.some((d) => d.id !== excludeSku);
};

/* ========== CATEGORY OPERATIONS (accessory_categories collection) ========== */

const DEFAULT_CATEGORIES = [
  { name: 'Printer', code: 'PRT', sortOrder: 10 },
  { name: 'Earphones', code: 'EAR', sortOrder: 20 },
  { name: 'Charger', code: 'CHG', sortOrder: 30 },
  { name: 'Cable', code: 'CBL', sortOrder: 40 },
  { name: 'Power Bank', code: 'PBK', sortOrder: 50 },
  { name: 'Misc', code: 'MSC', sortOrder: 60 }
];

/**
 * Fetch all accessory categories, sorted by sortOrder. Deduplicates by code
 * in memory so any legacy docs that share a code appear only once.
 */
export const getAllCategories = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_categories'));
    const byCode = new Map();
    snapshot.forEach((d) => {
      const data = d.data();
      const code = (data.code || '').toUpperCase();
      if (!code) return;
      if (!byCode.has(code)) {
        byCode.set(code, { id: d.id, ...data });
      }
    });
    const categories = Array.from(byCode.values());
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return { success: true, categories };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { success: false, error: error.message, categories: [] };
  }
};

/**
 * Create a new accessory category with a Firestore auto-generated doc ID.
 * The category code must be unique (enforced by a pre-check against the
 * code field; race-safe in practice because creating categories is a
 * rare, user-initiated action).
 */
export const createCategory = async (categoryData) => {
  try {
    const { name, code } = categoryData;
    if (!name || !code) {
      throw new Error('Category name and code are required');
    }

    const codeUpper = code.toUpperCase();
    const existingQ = query(
      collection(db, 'accessory_categories'),
      where('code', '==', codeUpper)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      return { success: false, error: `Category code "${codeUpper}" is already in use` };
    }

    const docRef = await addDoc(collection(db, 'accessory_categories'), {
      name,
      code: codeUpper,
      active: categoryData.active !== undefined ? categoryData.active : true,
      sortOrder: categoryData.sortOrder || 100,
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });

    return { success: true, id: docRef.id, message: 'Category created successfully' };
  } catch (error) {
    console.error('Error creating category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing category. The code is immutable (it's referenced by
 * every SKU that uses this category) and is silently stripped from the
 * payload if present.
 */
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const categoryRef = doc(db, 'accessory_categories', categoryId);
    const updatePayload = { ...categoryData, lastUpdated: Timestamp.now() };
    delete updatePayload.code; // code is immutable — SKUs already reference it
    await updateDoc(categoryRef, updatePayload);
    return { success: true, message: 'Category updated successfully' };
  } catch (error) {
    console.error('Error updating category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a category. Does NOT cascade-delete products in the category —
 * callers should warn the user about any products that will be orphaned.
 */
export const deleteCategory = async (categoryId) => {
  try {
    if (!categoryId) throw new Error('Category ID is required');
    await deleteDoc(doc(db, 'accessory_categories', categoryId));
    return { success: true, message: 'Category deleted' };
  } catch (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Count how many products reference a given category by name. Used by the
 * category modal's delete flow to warn about orphaning products.
 */
export const countProductsInCategory = async (categoryName) => {
  try {
    if (!categoryName) return { success: true, count: 0 };
    const q = query(
      collection(db, 'accessory_products'),
      where('category', '==', categoryName)
    );
    const snap = await getDocs(q);
    return { success: true, count: snap.size };
  } catch (error) {
    console.error('Error counting products in category:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

// Module-level guard: coalesces concurrent seed calls (e.g. React StrictMode
// double-invoke of effects) into a single promise so only one seed write runs.
let _seedPromise = null;

/**
 * Seed the default set of categories if they don't already exist.
 * Race-safe: a module-level promise guard coalesces concurrent calls within
 * a single page load, and the per-code existence check skips any default
 * that's already present. Categories use Firestore auto-generated doc IDs.
 */
export const seedDefaultCategoriesIfEmpty = async () => {
  if (_seedPromise) return _seedPromise;
  _seedPromise = (async () => {
    try {
      const checks = await Promise.all(
        DEFAULT_CATEGORIES.map(async (cat) => {
          const q = query(
            collection(db, 'accessory_categories'),
            where('code', '==', cat.code)
          );
          const snap = await getDocs(q);
          return { cat, exists: !snap.empty };
        })
      );
      const missing = checks.filter((c) => !c.exists);
      if (missing.length === 0) {
        return { success: true, seeded: false, message: 'Default categories already exist' };
      }

      const batch = writeBatch(db);
      missing.forEach(({ cat }) => {
        const ref = doc(collection(db, 'accessory_categories'));
        batch.set(ref, {
          ...cat,
          active: true,
          dateCreated: Timestamp.now(),
          lastUpdated: Timestamp.now()
        });
      });
      await batch.commit();

      return {
        success: true,
        seeded: true,
        count: missing.length,
        message: 'Default categories seeded successfully'
      };
    } catch (error) {
      // Clear the guard so a future call can retry after a failure
      _seedPromise = null;
      console.error('Error seeding default categories:', error);
      return { success: false, error: error.message };
    }
  })();
  return _seedPromise;
};

/* ========== PRICING OPERATIONS (accessory_pricing collection) ========== */

/**
 * Set or update pricing for a product. Document ID = SKU.
 */
export const setAccessoryPricing = async (sku, pricing) => {
  try {
    if (!sku) throw new Error('SKU is required');
    const { dealersPrice, retailPrice } = pricing;

    const pricingRef = doc(db, 'accessory_pricing', sku);
    await setDoc(pricingRef, {
      dealersPrice: parseFloat(dealersPrice) || 0,
      retailPrice: parseFloat(retailPrice) || 0,
      lastUpdated: Timestamp.now()
    }, { merge: true });

    return { success: true, message: 'Pricing updated successfully' };
  } catch (error) {
    console.error('Error setting accessory pricing:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch pricing for a single SKU.
 */
export const getAccessoryPricing = async (sku) => {
  try {
    const pricingRef = doc(db, 'accessory_pricing', sku);
    const snap = await getDoc(pricingRef);
    if (!snap.exists()) {
      return { success: true, pricing: null };
    }
    return { success: true, pricing: { id: snap.id, ...snap.data() } };
  } catch (error) {
    console.error('Error fetching accessory pricing:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch all accessory pricing documents.
 */
export const getAllAccessoryPricing = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_pricing'));
    const pricing = [];
    snapshot.forEach((d) => {
      pricing.push({ id: d.id, ...d.data() });
    });
    return { success: true, pricing };
  } catch (error) {
    console.error('Error fetching all accessory pricing:', error);
    return { success: false, error: error.message, pricing: [] };
  }
};

/* ========== PROCUREMENT OPERATIONS (accessory_procurements + accessory_ledger) ========== */

/**
 * Create a new accessory procurement. Atomically writes the procurement doc
 * and a corresponding 'purchase' ledger entry. Does NOT touch the existing
 * suppliers collection — accessory-specific balances live in accessory_ledger only.
 */
export const createAccessoryProcurement = async (procurementData) => {
  try {
    if (!procurementData.supplierId) {
      throw new Error('Supplier ID is required');
    }

    const reference = generateAccessoryProcurementReference();
    const batch = writeBatch(db);

    const procurementRef = doc(collection(db, 'accessory_procurements'));
    const procurementDoc = {
      ...procurementData,
      reference,
      isPaid: false,
      isReceived: false,
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };
    batch.set(procurementRef, procurementDoc);

    const ledgerRef = doc(collection(db, 'accessory_ledger'));
    const ledgerEntry = {
      supplierId: procurementData.supplierId,
      supplierName: procurementData.supplierName || '',
      procurementId: procurementRef.id,
      entryType: 'purchase',
      reference,
      purchaseDate: procurementData.purchaseDate,
      entryDate: procurementData.purchaseDate,
      amountDue: procurementData.grandTotal || 0,
      amountPaid: 0,
      description: `Accessory purchase - ${(procurementData.items || []).length} item(s)`,
      sortOrder: 1,
      isDeleted: false,
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };
    batch.set(ledgerRef, ledgerEntry);

    await batch.commit();

    return {
      success: true,
      procurementId: procurementRef.id,
      reference,
      message: 'Accessory procurement created successfully'
    };
  } catch (error) {
    console.error('Error creating accessory procurement:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing accessory procurement. Also syncs the corresponding
 * purchase ledger entry's amountDue and description.
 */
export const updateAccessoryProcurement = async (procurementId, updatedData) => {
  try {
    if (!procurementId) throw new Error('Procurement ID is required');

    // Pre-read the purchase ledger entry(s) OUTSIDE the transaction
    const ledgerQuery = query(
      collection(db, 'accessory_ledger'),
      where('procurementId', '==', procurementId),
      where('entryType', '==', 'purchase')
    );
    const ledgerSnap = await getDocs(ledgerQuery);

    await runTransaction(db, async (transaction) => {
      const procurementRef = doc(db, 'accessory_procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);

      if (!procurementSnap.exists()) {
        throw new Error('Accessory procurement not found');
      }

      transaction.update(procurementRef, {
        ...updatedData,
        lastUpdated: Timestamp.now()
      });

      if (!ledgerSnap.empty) {
        const ledgerDoc = ledgerSnap.docs[0];
        const newGrandTotal = updatedData.grandTotal || 0;
        const originalGrandTotal = ledgerDoc.data().amountDue || 0;
        const edited = newGrandTotal !== originalGrandTotal;
        transaction.update(ledgerDoc.ref, {
          amountDue: newGrandTotal,
          purchaseDate: updatedData.purchaseDate || ledgerDoc.data().purchaseDate,
          entryDate: updatedData.purchaseDate || ledgerDoc.data().entryDate,
          supplierId: updatedData.supplierId || ledgerDoc.data().supplierId,
          supplierName: updatedData.supplierName || ledgerDoc.data().supplierName,
          description: `Accessory purchase - ${(updatedData.items || []).length} item(s)${edited ? ' (EDITED)' : ''}`,
          lastUpdated: Timestamp.now()
        });
      }
    });

    return { success: true, message: 'Accessory procurement updated successfully' };
  } catch (error) {
    console.error('Error updating accessory procurement:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Soft-delete an accessory procurement: the procurement document itself is
 * deleted, and any associated ledger entries are marked isDeleted (preserving
 * audit trail). Mirrors the approach of supplierService.deleteProcurement.
 */
export const deleteAccessoryProcurement = async (procurementId) => {
  try {
    if (!procurementId) throw new Error('Procurement ID is required');

    // Pre-read ALL ledger entries (purchase + payment) for this procurement
    const ledgerQuery = query(
      collection(db, 'accessory_ledger'),
      where('procurementId', '==', procurementId)
    );
    const ledgerSnap = await getDocs(ledgerQuery);

    await runTransaction(db, async (transaction) => {
      const procurementRef = doc(db, 'accessory_procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);

      if (!procurementSnap.exists()) {
        throw new Error('Accessory procurement not found');
      }

      transaction.delete(procurementRef);

      ledgerSnap.docs.forEach((ledgerDoc) => {
        const ledgerData = ledgerDoc.data();
        const originalAmountDue = ledgerData.amountDue || 0;
        const originalAmountPaid = ledgerData.amountPaid || 0;
        const originalDescription = ledgerData.description || '';
        transaction.update(ledgerDoc.ref, {
          description: `${originalDescription} - DELETED (Original Due: ${originalAmountDue}, Paid: ${originalAmountPaid})`,
          amountDue: 0,
          amountPaid: 0,
          isDeleted: true,
          deletedDate: Timestamp.now(),
          lastUpdated: Timestamp.now()
        });
      });
    });

    return { success: true, message: 'Accessory procurement deleted successfully' };
  } catch (error) {
    console.error('Error deleting accessory procurement:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark an accessory procurement as paid. Creates a matching payment ledger entry.
 */
export const markAccessoryProcurementPaid = async (procurementId, paymentData) => {
  try {
    if (!procurementId) throw new Error('Procurement ID is required');

    await runTransaction(db, async (transaction) => {
      const procurementRef = doc(db, 'accessory_procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);

      if (!procurementSnap.exists()) {
        throw new Error('Accessory procurement not found');
      }

      const procurement = procurementSnap.data();
      if (procurement.isPaid) {
        throw new Error('Procurement is already marked as paid');
      }

      const paymentReference = paymentData.paymentReference || generateAccessoryPaymentReference();

      transaction.update(procurementRef, {
        isPaid: true,
        datePaid: paymentData.datePaid || getCurrentDate(),
        paymentReference,
        bankName: paymentData.bankName || '',
        bankAccount: paymentData.bankAccount || '',
        accountPayable: paymentData.accountPayable || '',
        lastUpdated: Timestamp.now()
      });

      const paymentLedgerRef = doc(collection(db, 'accessory_ledger'));
      transaction.set(paymentLedgerRef, {
        supplierId: procurement.supplierId,
        supplierName: procurement.supplierName || '',
        procurementId,
        entryType: 'payment',
        reference: paymentReference,
        purchaseDate: procurement.purchaseDate,
        entryDate: paymentData.datePaid || getCurrentDate(),
        amountDue: 0,
        amountPaid: procurement.grandTotal || 0,
        description: `Payment for ${procurement.reference || procurementId}`,
        sortOrder: 2,
        isDeleted: false,
        dateCreated: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });
    });

    return { success: true, message: 'Payment recorded successfully' };
  } catch (error) {
    console.error('Error marking accessory procurement paid:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch accessory procurements, with optional year and status filters.
 * year: number (e.g., 2026) — filters on dateCreated (fallback to purchaseDate)
 * status: 'all' | 'paid' | 'unpaid'
 */
export const getAllAccessoryProcurements = async ({ year = null, status = 'all' } = {}) => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_procurements'));
    let procurements = [];
    snapshot.forEach((d) => {
      procurements.push({ id: d.id, ...d.data() });
    });

    if (year) {
      procurements = procurements.filter((p) => {
        const source = p.purchaseDate || '';
        const yr = source.split('-')[0];
        return String(yr) === String(year);
      });
    }

    if (status === 'paid') {
      procurements = procurements.filter((p) => p.isPaid);
    } else if (status === 'unpaid') {
      procurements = procurements.filter((p) => !p.isPaid);
    }

    // Newest first by dateCreated if available
    procurements.sort((a, b) => {
      const aSec = a.dateCreated?.seconds || 0;
      const bSec = b.dateCreated?.seconds || 0;
      return bSec - aSec;
    });

    return { success: true, procurements };
  } catch (error) {
    console.error('Error fetching accessory procurements:', error);
    return { success: false, error: error.message, procurements: [] };
  }
};

/**
 * Fetch accessory procurements for a specific supplier.
 */
export const getAccessoryProcurementsBySupplier = async (supplierId) => {
  try {
    if (!supplierId) throw new Error('Supplier ID is required');

    const q = query(
      collection(db, 'accessory_procurements'),
      where('supplierId', '==', supplierId),
      orderBy('dateCreated', 'desc')
    );
    const snapshot = await getDocs(q);
    const procurements = [];
    snapshot.forEach((d) => {
      procurements.push({ id: d.id, ...d.data() });
    });
    return { success: true, procurements };
  } catch (error) {
    console.error('Error fetching accessory procurements by supplier:', error);
    return { success: false, error: error.message, procurements: [] };
  }
};

/* ========== LEDGER OPERATIONS (accessory_ledger collection) ========== */

/**
 * Get the accessory ledger entries for a supplier, grouped by procurement
 * and with running balances calculated. Mirrors getSupplierLedger().
 */
export const getAccessoryLedgerBySupplier = async (supplierId) => {
  try {
    if (!supplierId) throw new Error('Supplier ID is required');

    const q = query(
      collection(db, 'accessory_ledger'),
      where('supplierId', '==', supplierId)
    );
    const snapshot = await getDocs(q);
    const allEntries = [];
    snapshot.forEach((d) => {
      allEntries.push({ id: d.id, ...d.data() });
    });

    // Group by procurementId
    const entriesByProcurement = {};
    const standalone = [];
    allEntries.forEach((entry) => {
      if (entry.procurementId) {
        if (!entriesByProcurement[entry.procurementId]) {
          entriesByProcurement[entry.procurementId] = [];
        }
        entriesByProcurement[entry.procurementId].push(entry);
      } else {
        standalone.push(entry);
      }
    });

    // Within each group: purchase (sortOrder=1) before payment (sortOrder=2)
    Object.keys(entriesByProcurement).forEach((pid) => {
      entriesByProcurement[pid].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (b.entryDate || '').localeCompare(a.entryDate || '');
      });
    });

    // Sort groups chronologically by the purchase entry's dateCreated
    const groups = Object.keys(entriesByProcurement).map((pid) => {
      const entries = entriesByProcurement[pid];
      const purchase = entries.find((e) => e.entryType === 'purchase');
      return {
        procurementId: pid,
        entries,
        dateCreated: purchase ? purchase.dateCreated : entries[0].dateCreated,
        reference: purchase ? purchase.reference : entries[0].reference
      };
    });
    groups.sort((a, b) => {
      const aSec = a.dateCreated?.seconds || 0;
      const bSec = b.dateCreated?.seconds || 0;
      return aSec - bSec;
    });

    const sortedEntries = [];
    groups.forEach((g) => sortedEntries.push(...g.entries));

    standalone.sort((a, b) => {
      const aSec = a.dateCreated?.seconds || 0;
      const bSec = b.dateCreated?.seconds || 0;
      return aSec - bSec;
    });
    sortedEntries.push(...standalone);

    // Calculate running balance in display order
    let runningBalance = 0;
    sortedEntries.forEach((entry) => {
      if (entry.entryType === 'purchase' && !entry.isDeleted) {
        runningBalance += entry.amountDue || 0;
      } else if (entry.entryType === 'payment' && !entry.isDeleted) {
        runningBalance -= entry.amountPaid || 0;
      }
      entry.runningBalance = Math.max(0, runningBalance);
    });

    return { success: true, ledgerEntries: sortedEntries };
  } catch (error) {
    console.error('Error fetching accessory ledger:', error);
    return { success: false, error: error.message, ledgerEntries: [] };
  }
};

/* ========== EXPORT STATEMENT ========== */

export default {
  // Product operations
  createAccessoryProduct,
  updateAccessoryProduct,
  getAccessoryProductBySku,
  getAllAccessoryProducts,
  getProductByBarcode,
  isSkuTaken,
  isBarcodeTaken,

  // Category operations
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  countProductsInCategory,
  seedDefaultCategoriesIfEmpty,

  // Pricing operations
  setAccessoryPricing,
  getAccessoryPricing,
  getAllAccessoryPricing,

  // Procurement operations
  createAccessoryProcurement,
  updateAccessoryProcurement,
  deleteAccessoryProcurement,
  markAccessoryProcurementPaid,
  getAllAccessoryProcurements,
  getAccessoryProcurementsBySupplier,

  // Ledger operations
  getAccessoryLedgerBySupplier,

  // Utility functions
  getCurrentDate,
  generateAccessoryProcurementReference,
  generateAccessoryPaymentReference
};
