/* ========== PART 1: DATABASE SCHEMA AND SERVICE STRUCTURE ========== */

// File: src/components/phone-selection/services/supplierService.js

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
/* ========== DATABASE SCHEMA DEFINITIONS START ========== */

/**
 * SUPPLIERS COLLECTION SCHEMA
 * Document ID: Auto-generated
 * Fields:
 * - supplierName: string
 * - bankName: string
 * - bankAccount: string
 * - notes: string
 * - totalOutstanding: number (calculated field - sum of unpaid amounts)
 * - dateCreated: timestamp
 * - lastUpdated: timestamp
 */

/**
 * PROCUREMENTS COLLECTION SCHEMA
 * Document ID: Auto-generated
 * Fields:
 * - supplierId: string (reference to supplier doc)
 * - supplierName: string (denormalized for easy access)
 * - items: array of objects [{
 *     manufacturer: string,
 *     model: string,
 *     ram: string,
 *     storage: string,
 *     color: string,
 *     quantity: number,
 *     dealersPrice: number,
 *     retailPrice: number,
 *     totalPrice: number
 *   }]
 * - totalQuantity: number
 * - grandTotal: number
 * - purchaseDate: string (YYYY-MM-DD format)
 * - isPaid: boolean
 * - isReceived: boolean
 * - datePaid: string (YYYY-MM-DD format, null if unpaid)
 * - dateDelivered: string (YYYY-MM-DD format, null if not delivered)
 * - paymentReference: string
 * - bankName: string
 * - bankAccount: string
 * - accountPayable: string
 * - dateCreated: timestamp
 * - lastUpdated: timestamp
 */

/**
 * SUPPLIER_LEDGER COLLECTION SCHEMA
 * Document ID: Auto-generated
 * Fields:
 * - supplierId: string (reference to supplier doc)
 * - supplierName: string (denormalized)
 * - procurementId: string (reference to procurement doc)
 * - entryType: string ('purchase' | 'payment')
 * - purchaseDate: string (YYYY-MM-DD - for sorting purposes)
 * - entryDate: string (YYYY-MM-DD - actual transaction date)
 * - reference: string (procurement reference or payment reference)
 * - amountDue: number (for purchase entries)
 * - amountPaid: number (for payment entries)
 * - runningBalance: number (calculated balance after this entry)
 * - description: string
 * - dateCreated: timestamp
 * - sortOrder: number (for custom sorting - purchase=1, payment=2)
 */

/* ========== DATABASE SCHEMA DEFINITIONS END ========== */

/* ========== UTILITY FUNCTIONS START ========== */

/**
 * Get current date in YYYY-MM-DD format
 */
const getCurrentDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Generate procurement reference number
 */
const generateProcurementReference = (supplierId, date) => {
  const dateStr = date.replace(/-/g, '');
  const supplierCode = supplierId.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `PROC-${supplierCode}-${dateStr}-${timestamp}`;
};

/**
 * Generate payment reference number
 */
const generatePaymentReference = (procurementId, date) => {
  const dateStr = date.replace(/-/g, '');
  const procCode = procurementId.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `PAY-${procCode}-${dateStr}-${timestamp}`;
};

/* ========== UTILITY FUNCTIONS END ========== */

/* ========== BASIC SUPPLIER CRUD OPERATIONS START ========== */

/**
 * Create a new supplier
 */
export const createSupplier = async (supplierData) => {
  try {
    const supplierDoc = {
      ...supplierData,
      totalOutstanding: 0,
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'suppliers'), supplierDoc);
    
    return {
      success: true,
      supplierId: docRef.id,
      message: 'Supplier created successfully'
    };
  } catch (error) {
    console.error('Error creating supplier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update supplier information
 */
export const updateSupplier = async (supplierId, updateData) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    
    await updateDoc(supplierRef, {
      ...updateData,
      lastUpdated: Timestamp.now()
    });
    
    return {
      success: true,
      message: 'Supplier updated successfully'
    };
  } catch (error) {
    console.error('Error updating supplier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all suppliers
 */
export const getAllSuppliers = async () => {
  try {
    const suppliersRef = collection(db, 'suppliers');
    const q = query(suppliersRef, orderBy('supplierName', 'asc'));
    const snapshot = await getDocs(q);
    
    const suppliers = [];
    snapshot.forEach(doc => {
      suppliers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      suppliers
    };
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return {
      success: false,
      error: error.message,
      suppliers: []
    };
  }
};

/**
 * Get supplier by ID
 */
export const getSupplierById = async (supplierId) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    const supplierSnap = await getDoc(supplierRef);
    
    if (!supplierSnap.exists()) {
      return {
        success: false,
        error: 'Supplier not found'
      };
    }
    
    return {
      success: true,
      supplier: {
        id: supplierSnap.id,
        ...supplierSnap.data()
      }
    };
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/* ========== BASIC SUPPLIER CRUD OPERATIONS END ========== */

/* ========== PROCUREMENT SERVICE FUNCTIONS START ========== */

/**
 * Create a new procurement and update supplier balance
 */
export const createProcurement = async (procurementData, supplierId) => {
  try {
    // Use transaction to ensure data consistency
    const result = await runTransaction(db, async (transaction) => {
      // Get supplier document
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierSnap = await transaction.get(supplierRef);
      
      if (!supplierSnap.exists()) {
        throw new Error('Supplier not found');
      }
      
      const supplierData = supplierSnap.data();
      const currentOutstanding = supplierData.totalOutstanding || 0;
      
      // Generate procurement reference
      const procurementRef = generateProcurementReference(supplierId, procurementData.purchaseDate);
      
      // Create procurement document
      const procurementDoc = {
        ...procurementData,
        supplierId,
        supplierName: supplierData.supplierName,
        reference: procurementRef,
        dateCreated: Timestamp.now(),
        lastUpdated: Timestamp.now()
      };
      
      // Add procurement to collection
      const procurementDocRef = doc(collection(db, 'procurements'));
      transaction.set(procurementDocRef, procurementDoc);
      
      // Update supplier outstanding balance
      const newOutstanding = currentOutstanding + procurementData.grandTotal;
      transaction.update(supplierRef, {
        totalOutstanding: newOutstanding,
        lastUpdated: Timestamp.now()
      });
      
      // Create ledger entry for the purchase
      const ledgerEntry = {
        supplierId,
        supplierName: supplierData.supplierName,
        procurementId: procurementDocRef.id,
        entryType: 'purchase',
        purchaseDate: procurementData.purchaseDate,
        entryDate: procurementData.purchaseDate,
        reference: procurementRef,
        amountDue: procurementData.grandTotal,
        amountPaid: 0,
        runningBalance: newOutstanding,
        description: `Purchase order - ${procurementData.items.length} items`,
        sortOrder: 1,
        dateCreated: Timestamp.now()
      };
      
      const ledgerDocRef = doc(collection(db, 'supplier_ledger'));
      transaction.set(ledgerDocRef, ledgerEntry);
      
      return {
        procurementId: procurementDocRef.id,
        reference: procurementRef
      };
    });
    
    return {
      success: true,
      procurementId: result.procurementId,
      reference: result.reference,
      message: 'Procurement created successfully'
    };
    
  } catch (error) {
    console.error('Error creating procurement:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update procurement payment status
 */
export const updateProcurementPaymentStatus = async (procurementId, paymentData) => {
  try {
    // Use transaction to ensure data consistency
    const result = await runTransaction(db, async (transaction) => {
      // Get procurement document
      const procurementRef = doc(db, 'procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);
      
      if (!procurementSnap.exists()) {
        throw new Error('Procurement not found');
      }
      
      const procurementDoc = procurementSnap.data();
      
      // Get supplier document
      const supplierRef = doc(db, 'suppliers', procurementDoc.supplierId);
      const supplierSnap = await transaction.get(supplierRef);
      
      if (!supplierSnap.exists()) {
        throw new Error('Supplier not found');
      }
      
      const supplierData = supplierSnap.data();
      
      // Update procurement payment status
      transaction.update(procurementRef, {
        ...paymentData,
        lastUpdated: Timestamp.now()
      });
      
      // If marking as paid, create payment ledger entry and update balance
      if (paymentData.isPaid && !procurementDoc.isPaid) {
        // Update supplier outstanding balance
        const newOutstanding = (supplierData.totalOutstanding || 0) - procurementDoc.grandTotal;
        transaction.update(supplierRef, {
          totalOutstanding: Math.max(0, newOutstanding), // Ensure balance doesn't go negative
          lastUpdated: Timestamp.now()
        });
        
        // Generate payment reference
        const paymentRef = paymentData.paymentReference || 
          generatePaymentReference(procurementId, paymentData.datePaid);
        
        // Create payment ledger entry
        const paymentLedgerEntry = {
          supplierId: procurementDoc.supplierId,
          supplierName: procurementDoc.supplierName,
          procurementId: procurementId,
          entryType: 'payment',
          purchaseDate: procurementDoc.purchaseDate, // Keep original purchase date for sorting
          entryDate: paymentData.datePaid,
          reference: paymentRef,
          amountDue: 0,
          amountPaid: procurementDoc.grandTotal,
          runningBalance: Math.max(0, newOutstanding),
          description: `Payment for procurement ${procurementDoc.reference}`,
          sortOrder: 2, // Payment entries come after purchase entries
          dateCreated: Timestamp.now()
        };
        
        const paymentLedgerRef = doc(collection(db, 'supplier_ledger'));
        transaction.set(paymentLedgerRef, paymentLedgerEntry);
        
        return { paymentReference: paymentRef };
      }
      
      return {};
    });
    
    return {
      success: true,
      message: 'Procurement payment status updated successfully',
      ...result
    };
    
  } catch (error) {
    console.error('Error updating procurement payment status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all procurements for a supplier
 */
export const getProcurementsBySupplier = async (supplierId) => {
  try {
    const procurementsRef = collection(db, 'procurements');
    const q = query(
      procurementsRef, 
      where('supplierId', '==', supplierId),
      orderBy('purchaseDate', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const procurements = [];
    snapshot.forEach(doc => {
      procurements.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      procurements
    };
  } catch (error) {
    console.error('Error fetching procurements:', error);
    return {
      success: false,
      error: error.message,
      procurements: []
    };
  }
};

/* ========== PROCUREMENT SERVICE FUNCTIONS END ========== */

/* ========== LEDGER SERVICE FUNCTIONS START ========== */

/**
 * Get supplier ledger with custom sorting
 * Purchases are sorted by date, with payments appearing directly below their corresponding purchase
 */
export const getSupplierLedger = async (supplierId) => {
  try {
    const ledgerRef = collection(db, 'supplier_ledger');
    const q = query(
      ledgerRef,
      where('supplierId', '==', supplierId),
      orderBy('purchaseDate', 'asc'),
      orderBy('sortOrder', 'asc'),
      orderBy('dateCreated', 'asc')
    );
    
    const snapshot = await getDocs(q);
    
    const ledgerEntries = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      ledgerEntries.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to readable dates if needed
        dateCreated: data.dateCreated?.toDate?.() || data.dateCreated,
        displayDate: data.entryType === 'purchase' ? data.purchaseDate : data.entryDate
      });
    });
    
    return {
      success: true,
      ledgerEntries
    };
  } catch (error) {
    console.error('Error fetching supplier ledger:', error);
    return {
      success: false,
      error: error.message,
      ledgerEntries: []
    };
  }
};

/**
 * Recalculate running balances for a supplier's ledger
 * This should be called if there are any inconsistencies in the ledger
 */
export const recalculateSupplierBalance = async (supplierId) => {
  try {
    // Get all ledger entries for this supplier
    const ledgerResult = await getSupplierLedger(supplierId);
    if (!ledgerResult.success) {
      throw new Error(ledgerResult.error);
    }
    
    let runningBalance = 0;
    const updates = [];
    
    // Process entries in chronological order
    for (const entry of ledgerResult.ledgerEntries) {
      if (entry.entryType === 'purchase') {
        runningBalance += entry.amountDue;
      } else if (entry.entryType === 'payment') {
        runningBalance -= entry.amountPaid;
      }
      
      // Store update for this entry if balance has changed
      if (entry.runningBalance !== runningBalance) {
        updates.push({
          id: entry.id,
          newBalance: runningBalance
        });
      }
    }
    
    // Apply updates in transaction
    if (updates.length > 0) {
      await runTransaction(db, async (transaction) => {
        // Update ledger entries
        for (const update of updates) {
          const entryRef = doc(db, 'supplier_ledger', update.id);
          transaction.update(entryRef, {
            runningBalance: update.newBalance
          });
        }
        
        // Update supplier's total outstanding
        const supplierRef = doc(db, 'suppliers', supplierId);
        transaction.update(supplierRef, {
          totalOutstanding: Math.max(0, runningBalance),
          lastUpdated: Timestamp.now()
        });
      });
    }
    
    return {
      success: true,
      message: 'Supplier balance recalculated successfully',
      finalBalance: runningBalance,
      entriesUpdated: updates.length
    };
    
  } catch (error) {
    console.error('Error recalculating supplier balance:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get ledger summary for a supplier
 */
export const getSupplierLedgerSummary = async (supplierId) => {
  try {
    const ledgerResult = await getSupplierLedger(supplierId);
    if (!ledgerResult.success) {
      return ledgerResult;
    }
    
    const summary = {
      totalPurchases: 0,
      totalPayments: 0,
      totalDue: 0,
      outstandingBalance: 0,
      lastPurchaseDate: null,
      lastPaymentDate: null
    };
    
    for (const entry of ledgerResult.ledgerEntries) {
      if (entry.entryType === 'purchase') {
        summary.totalPurchases += entry.amountDue;
        summary.totalDue += entry.amountDue;
        if (!summary.lastPurchaseDate || entry.purchaseDate > summary.lastPurchaseDate) {
          summary.lastPurchaseDate = entry.purchaseDate;
        }
      } else if (entry.entryType === 'payment') {
        summary.totalPayments += entry.amountPaid;
        if (!summary.lastPaymentDate || entry.entryDate > summary.lastPaymentDate) {
          summary.lastPaymentDate = entry.entryDate;
        }
      }
    }
    
    summary.outstandingBalance = summary.totalDue - summary.totalPayments;
    
    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Error generating ledger summary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/* ========== LEDGER SERVICE FUNCTIONS END ========== */

/* ========== EXPORT ALL SERVICES ========== */

// Export all functions as a default object for easy importing
export default {
  // Supplier operations
  createSupplier,
  updateSupplier,
  getAllSuppliers,
  getSupplierById,
  
  // Procurement operations
  createProcurement,
  updateProcurementPaymentStatus,
  getProcurementsBySupplier,
  
  // Ledger operations
  getSupplierLedger,
  recalculateSupplierBalance,
  getSupplierLedgerSummary,
  
  // Utility functions
  getCurrentDate,
  generateProcurementReference,
  generatePaymentReference
};

/* ========== END OF SUPPLIER SERVICE FILE ========== */