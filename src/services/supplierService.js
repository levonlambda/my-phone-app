{/* Part 1 Start - Imports and Database Configuration */}
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  runTransaction,
  writeBatch  // ONLY ADDED THIS for batch operations in recalculateSupplierBalance
} from 'firebase/firestore';
import { db } from '../firebase/config';

/* ========== SUPPLIER SERVICE - COMPLETE FILE ========== */
/* This service handles all supplier, procurement, and ledger operations */
{/* Part 1 End - Imports and Database Configuration */}

{/* Part 2 Start - Utility Functions */}
/* ========== UTILITY FUNCTIONS ========== */

/**
 * Get current date in YYYY-MM-DD format
 */
export const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Generate procurement reference number
 */
export const generateProcurementReference = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PROC-${timestamp}-${random}`;
};

/**
 * Generate payment reference number
 */
export const generatePaymentReference = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PAY-${timestamp}-${random}`;
};

/**
 * Format price with commas and two decimal places
 */
const formatPrice = (value) => {
  if (!value && value !== 0) return '0.00';
  const numValue = parseFloat(value.toString().replace(/,/g, ''));
  if (isNaN(numValue)) return '0.00';
  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
{/* Part 2 End - Utility Functions */}

{/* Part 3 Start - Supplier Operations */}
/* ========== SUPPLIER OPERATIONS ========== */

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
      id: docRef.id,
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
 * Update an existing supplier
 */
export const updateSupplier = async (supplierId, supplierData) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    
    await updateDoc(supplierRef, {
      ...supplierData,
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
    const querySnapshot = await getDocs(collection(db, 'suppliers'));
    const suppliers = [];
    
    querySnapshot.forEach((doc) => {
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
    
    if (supplierSnap.exists()) {
      return {
        success: true,
        supplier: {
          id: supplierSnap.id,
          ...supplierSnap.data()
        }
      };
    } else {
      return {
        success: false,
        error: 'Supplier not found'
      };
    }
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
{/* Part 3 End - Supplier Operations */}

{/* Part 4 Start - Procurement Operations */}
/* ========== PROCUREMENT OPERATIONS ========== */

/**
 * Create a new procurement and maintain data consistency
 */
export const createProcurement = async (procurementData, supplierId) => {
  try {
    // Validate inputs
    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }
    
    // Use transaction to ensure data consistency
    const result = await runTransaction(db, async (transaction) => {
      // Get supplier document
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierDoc = await transaction.get(supplierRef);
      
      if (!supplierDoc.exists()) {
        throw new Error('Supplier not found');
      }
      
      const supplierData = supplierDoc.data();
      const currentOutstanding = supplierData.totalOutstanding || 0;
      
      // Generate procurement reference
      const procurementRef = generateProcurementReference();
      
      // Create procurement document
      const procurementDoc = {
        ...procurementData,
        supplierId,
        supplierName: supplierData.supplierName,
        reference: procurementRef,
        isPaid: false,
        dateCreated: Timestamp.now(),
        lastUpdated: Timestamp.now()
      };
      
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
 * Update an existing procurement and maintain data consistency
 * FINAL FIX: Pre-reads ledger entries before transaction to avoid query issues
 * This function handles:
 * - Updating the procurement document
 * - Adjusting supplier outstanding balances
 * - Updating corresponding ledger entries
 * - Handling supplier changes
 */
export const updateProcurement = async (procurementId, updatedProcurementData, newSupplierId) => {
  try {
    // Validate inputs
    if (!procurementId) {
      throw new Error('Procurement ID is required');
    }
    
    console.log('Starting updateProcurement:', { procurementId, newSupplierId });
    
    // =============================
    // 🚨 PRE-READ LEDGER ENTRIES OUTSIDE TRANSACTION
    // =============================
    
    // Get existing ledger entries BEFORE starting transaction
    const ledgerQuery = query(
      collection(db, 'supplier_ledger'),
      where('procurementId', '==', procurementId),
      where('entryType', '==', 'purchase')
    );
    
    const ledgerQuerySnap = await getDocs(ledgerQuery);
    console.log('Found ledger entries:', ledgerQuerySnap.size);
    
    // =============================
    // 🔄 START TRANSACTION
    // =============================
    
    const result = await runTransaction(db, async (transaction) => {
      console.log('Starting transaction...');
      
      // Get procurement document
      const procurementRef = doc(db, 'procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);
      
      if (!procurementSnap.exists()) {
        throw new Error('Procurement not found');
      }
      
      const originalProcurement = procurementSnap.data();
      const originalGrandTotal = originalProcurement.grandTotal || 0;
      const originalSupplierId = originalProcurement.supplierId;
      const newGrandTotal = updatedProcurementData.grandTotal || 0;
      const grandTotalDifference = newGrandTotal - originalGrandTotal;
      
      console.log('Procurement data:', {
        originalGrandTotal,
        newGrandTotal,
        grandTotalDifference,
        originalSupplierId,
        newSupplierId: newSupplierId || originalSupplierId
      });
      
      // Get original supplier document
      const originalSupplierRef = doc(db, 'suppliers', originalSupplierId);
      const originalSupplierSnap = await transaction.get(originalSupplierRef);
      
      if (!originalSupplierSnap.exists()) {
        throw new Error('Original supplier not found');
      }
      
      const originalSupplierData = originalSupplierSnap.data();
      
      // If supplier is changing, get new supplier data
      let newSupplierData = null;
      let newSupplierRef = null;
      
      if (newSupplierId && newSupplierId !== originalSupplierId) {
        newSupplierRef = doc(db, 'suppliers', newSupplierId);
        const newSupplierSnap = await transaction.get(newSupplierRef);
        
        if (!newSupplierSnap.exists()) {
          throw new Error('New supplier not found');
        }
        
        newSupplierData = newSupplierSnap.data();
      }
      
      console.log('Starting writes...');
      
      // Handle supplier change scenario
      if (newSupplierId && newSupplierId !== originalSupplierId) {
        console.log('Supplier changed - handling supplier transfer');
        
        // Remove amount from original supplier's outstanding balance
        const originalNewOutstanding = (originalSupplierData.totalOutstanding || 0) - originalGrandTotal;
        transaction.update(originalSupplierRef, {
          totalOutstanding: Math.max(0, originalNewOutstanding),
          lastUpdated: Timestamp.now()
        });
        
        // Add amount to new supplier's outstanding balance
        const newSupplierNewOutstanding = (newSupplierData.totalOutstanding || 0) + newGrandTotal;
        transaction.update(newSupplierRef, {
          totalOutstanding: newSupplierNewOutstanding,
          lastUpdated: Timestamp.now()
        });
        
        // Update the procurement with new supplier info
        transaction.update(procurementRef, {
          ...updatedProcurementData,
          supplierId: newSupplierId,
          supplierName: newSupplierData.supplierName,
          lastUpdated: Timestamp.now()
        });
        
        // Update original ledger entry to mark it as transferred (using pre-read data)
        if (!ledgerQuerySnap.empty) {
          const originalLedgerDoc = ledgerQuerySnap.docs.find(doc => 
            doc.data().supplierId === originalSupplierId
          );
          
          if (originalLedgerDoc) {
            transaction.update(originalLedgerDoc.ref, {
              description: `${originalLedgerDoc.data().description} - TRANSFERRED TO ${newSupplierData.supplierName}`,
              amountDue: 0, // Zero out the amount since it's transferred
              runningBalance: Math.max(0, originalNewOutstanding),
              lastUpdated: Timestamp.now()
            });
          }
        }
        
        // Create new ledger entry for new supplier
        const newLedgerEntry = {
          supplierId: newSupplierId,
          supplierName: newSupplierData.supplierName,
          procurementId: procurementId,
          entryType: 'purchase',
          purchaseDate: updatedProcurementData.purchaseDate,
          entryDate: updatedProcurementData.purchaseDate,
          reference: originalProcurement.reference || `EDIT-${procurementId.substring(0, 8)}`,
          amountDue: newGrandTotal,
          amountPaid: 0,
          runningBalance: newSupplierNewOutstanding,
          description: `Purchase order - ${updatedProcurementData.items.length} items (TRANSFERRED FROM ${originalSupplierData.supplierName})`,
          sortOrder: 1,
          dateCreated: Timestamp.now()
        };
        
        const newLedgerDocRef = doc(collection(db, 'supplier_ledger'));
        transaction.set(newLedgerDocRef, newLedgerEntry);
        
      } else {
        // Same supplier - just update amounts
        console.log('Same supplier - updating amounts');
        
        // Update supplier outstanding balance with the difference
        const newOutstanding = (originalSupplierData.totalOutstanding || 0) + grandTotalDifference;
        transaction.update(originalSupplierRef, {
          totalOutstanding: Math.max(0, newOutstanding),
          lastUpdated: Timestamp.now()
        });
        
        // Update the procurement document
        transaction.update(procurementRef, {
          ...updatedProcurementData,
          lastUpdated: Timestamp.now()
        });
        
        // Update the corresponding ledger entry (using pre-read data)
        if (!ledgerQuerySnap.empty) {
          const ledgerDoc = ledgerQuerySnap.docs.find(doc => 
            doc.data().supplierId === originalSupplierId
          );
          
          if (ledgerDoc) {
            const updatedDescription = `Purchase order - ${updatedProcurementData.items.length} items${grandTotalDifference !== 0 ? ' (EDITED)' : ''}`;
            
            transaction.update(ledgerDoc.ref, {
              amountDue: newGrandTotal,
              runningBalance: Math.max(0, newOutstanding),
              description: updatedDescription,
              purchaseDate: updatedProcurementData.purchaseDate,
              entryDate: updatedProcurementData.purchaseDate,
              lastUpdated: Timestamp.now()
            });
          }
        }
      }
      
      console.log('All writes completed successfully');
      
      return {
        procurementId: procurementId,
        originalGrandTotal,
        newGrandTotal,
        grandTotalDifference,
        supplierChanged: newSupplierId && newSupplierId !== originalSupplierId
      };
    });
    
    console.log('Transaction completed successfully:', result);
    
    return {
      success: true,
      procurementId: result.procurementId,
      originalGrandTotal: result.originalGrandTotal,
      newGrandTotal: result.newGrandTotal,
      grandTotalDifference: result.grandTotalDifference,
      supplierChanged: result.supplierChanged,
      message: 'Procurement updated successfully with proper balance adjustments'
    };
    
  } catch (error) {
    console.error('Error updating procurement:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete a procurement and maintain data consistency
 * This function handles:
 * - Removing the procurement document
 * - Adjusting supplier outstanding balances (subtracting the amount)
 * - Marking corresponding ledger entries as deleted with original amount preserved
 * - FIXED: Also handles payment ledger entries for paid procurements
 */
export const deleteProcurement = async (procurementId) => {
  try {
    // Validate inputs
    if (!procurementId) {
      throw new Error('Procurement ID is required');
    }
    
    console.log('Starting deleteProcurement:', { procurementId });
    
    // =============================
    // 🚨 PRE-READ LEDGER ENTRIES OUTSIDE TRANSACTION
    // =============================
    
    // Get existing PURCHASE ledger entries BEFORE starting transaction
    const purchaseLedgerQuery = query(
      collection(db, 'supplier_ledger'),
      where('procurementId', '==', procurementId),
      where('entryType', '==', 'purchase')
    );
    
    const purchaseLedgerQuerySnap = await getDocs(purchaseLedgerQuery);
    console.log('Found purchase ledger entries:', purchaseLedgerQuerySnap.size);
    
    // NEW: Get existing PAYMENT ledger entries
    const paymentLedgerQuery = query(
      collection(db, 'supplier_ledger'),
      where('procurementId', '==', procurementId),
      where('entryType', '==', 'payment')
    );
    
    const paymentLedgerQuerySnap = await getDocs(paymentLedgerQuery);
    console.log('Found payment ledger entries:', paymentLedgerQuerySnap.size);
    
    // =============================
    // 🔄 START TRANSACTION
    // =============================
    
    const result = await runTransaction(db, async (transaction) => {
      console.log('Starting transaction for delete...');
      
      // Get procurement document
      const procurementRef = doc(db, 'procurements', procurementId);
      const procurementSnap = await transaction.get(procurementRef);
      
      if (!procurementSnap.exists()) {
        throw new Error('Procurement not found');
      }
      
      const originalProcurement = procurementSnap.data();
      const originalGrandTotal = originalProcurement.grandTotal || 0;
      const supplierId = originalProcurement.supplierId;
      const isPaid = originalProcurement.isPaid || originalProcurement.paymentStatus === 'paid';
      
      console.log('Procurement to delete:', {
        id: procurementId,
        grandTotal: originalGrandTotal,
        supplierId: supplierId,
        reference: originalProcurement.reference,
        isPaid: isPaid
      });
      
      // Get supplier document
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierSnap = await transaction.get(supplierRef);
      
      if (!supplierSnap.exists()) {
        throw new Error('Supplier not found');
      }
      
      const supplierData = supplierSnap.data();
      
      console.log('Starting writes...');
      
      // 1. Delete the procurement document
      transaction.delete(procurementRef);
      
      // 2. Update supplier outstanding balance
      // FIXED: For paid procurements, balance doesn't change because both purchase and payment are removed
      // For unpaid procurements, subtract the purchase amount
      let newOutstanding = supplierData.totalOutstanding || 0;
      
      if (!isPaid) {
        // Only adjust balance for unpaid procurements
        newOutstanding = newOutstanding - originalGrandTotal;
      }
      // For paid procurements, balance remains the same since we're removing both purchase and payment
      
      transaction.update(supplierRef, {
        totalOutstanding: Math.max(0, newOutstanding),
        lastUpdated: Timestamp.now()
      });
      
      // 3. Update the PURCHASE ledger entry with original amount preserved
      if (!purchaseLedgerQuerySnap.empty) {
        const purchaseLedgerDoc = purchaseLedgerQuerySnap.docs.find(doc => 
          doc.data().supplierId === supplierId
        );
        
        if (purchaseLedgerDoc) {
          const ledgerData = purchaseLedgerDoc.data();
          const originalDescription = ledgerData.description || '';
          const originalAmount = ledgerData.amountDue || 0;
          
          // Create enhanced description with original amount preserved
          const updatedDescription = `${originalDescription} - DELETED (Original: ₱${formatPrice(originalAmount.toString())})`;
          
          transaction.update(purchaseLedgerDoc.ref, {
            description: updatedDescription,
            amountDue: 0, // Zero out for balance calculations
            runningBalance: Math.max(0, newOutstanding),
            isDeleted: true, // Mark as deleted for audit purposes
            deletedDate: Timestamp.now(),
            lastUpdated: Timestamp.now()
          });
        }
      }
      
      // 4. NEW: Handle PAYMENT ledger entry if procurement was paid
      if (isPaid && !paymentLedgerQuerySnap.empty) {
        const paymentLedgerDoc = paymentLedgerQuerySnap.docs.find(doc => 
          doc.data().supplierId === supplierId
        );
        
        if (paymentLedgerDoc) {
          const paymentData = paymentLedgerDoc.data();
          const originalPaymentAmount = paymentData.amountPaid || 0;
          const originalPaymentDescription = paymentData.description || '';
          
          // Create enhanced description with original payment amount preserved
          const updatedPaymentDescription = `${originalPaymentDescription} - DELETED (Original Payment: ₱${formatPrice(originalPaymentAmount.toString())})`;
          
          transaction.update(paymentLedgerDoc.ref, {
            description: updatedPaymentDescription,
            amountPaid: 0, // Zero out for balance calculations
            runningBalance: Math.max(0, newOutstanding),
            isDeleted: true, // Mark as deleted for audit purposes
            deletedDate: Timestamp.now(),
            lastUpdated: Timestamp.now()
          });
        }
      }
      
      console.log('All writes completed successfully');
      
      return {
        procurementId: procurementId,
        deletedGrandTotal: originalGrandTotal,
        supplierId: supplierId,
        supplierName: supplierData.supplierName,
        reference: originalProcurement.reference,
        wasPaid: isPaid,
        finalBalance: newOutstanding
      };
    });
    
    console.log('Transaction completed successfully:', result);
    
    return {
      success: true,
      procurementId: result.procurementId,
      grandTotal: result.deletedGrandTotal, // Keep as grandTotal for compatibility with existing code
      supplierId: result.supplierId,
      supplierName: result.supplierName,
      reference: result.reference,
      wasPaid: result.wasPaid,
      finalBalance: result.finalBalance,
      message: result.wasPaid 
        ? 'Paid procurement deleted successfully. Both purchase and payment entries marked as deleted.'
        : 'Unpaid procurement deleted successfully with proper balance adjustments.'
    };
    
  } catch (error) {
    console.error('Error deleting procurement:', error);
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
          generatePaymentReference();
        
        // Create payment ledger entry
        const paymentLedgerEntry = {
          supplierId: procurementDoc.supplierId,
          supplierName: supplierData.supplierName,
          procurementId: procurementId,
          entryType: 'payment',
          paymentDate: paymentData.paymentDate,
          entryDate: paymentData.paymentDate,
          reference: paymentRef,
          amountDue: 0,
          amountPaid: procurementDoc.grandTotal,
          runningBalance: Math.max(0, newOutstanding),
          description: `Payment for ${procurementDoc.reference || procurementId}`,
          sortOrder: 2,
          dateCreated: Timestamp.now()
        };
        
        const paymentLedgerDocRef = doc(collection(db, 'supplier_ledger'));
        transaction.set(paymentLedgerDocRef, paymentLedgerEntry);
      }
      
      return { procurementId };
    });
    
    return {
      success: true,
      procurementId: result.procurementId,
      message: 'Payment status updated successfully'
    };
    
  } catch (error) {
    console.error('Error updating payment status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get procurements by supplier
 */
export const getProcurementsBySupplier = async (supplierId) => {
  try {
    const q = query(
      collection(db, 'procurements'),
      where('supplierId', '==', supplierId),
      orderBy('dateCreated', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const procurements = [];
    
    querySnapshot.forEach((doc) => {
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
{/* Part 4 End - Procurement Operations */}

{/* Part 5 Start - Ledger Operations */}
/* ========== LEDGER OPERATIONS ========== */

/**
 * Get supplier ledger entries
 * Modified to group entries by procurementId so payments always appear below their procurement
 */
export const getSupplierLedger = async (supplierId) => {
  try {
    const q = query(
      collection(db, 'supplier_ledger'),
      where('supplierId', '==', supplierId)
    );
    
    const querySnapshot = await getDocs(q);
    const allEntries = [];
    
    querySnapshot.forEach((doc) => {
      allEntries.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Group entries by procurementId
    const entriesByProcurement = {};
    const standaloneEntries = [];
    
    allEntries.forEach(entry => {
      if (entry.procurementId) {
        if (!entriesByProcurement[entry.procurementId]) {
          entriesByProcurement[entry.procurementId] = [];
        }
        entriesByProcurement[entry.procurementId].push(entry);
      } else {
        // Handle entries without procurementId (if any exist)
        standaloneEntries.push(entry);
      }
    });
    
    // Sort entries within each procurement group by sortOrder
    Object.keys(entriesByProcurement).forEach(procurementId => {
      entriesByProcurement[procurementId].sort((a, b) => {
        // First by sortOrder (purchase=1, payment=2)
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        // Then by date if same sortOrder
        return b.entryDate.localeCompare(a.entryDate);
      });
    });
    
    // Get the procurement entry date and creation time for each group for sorting
    const procurementGroups = Object.keys(entriesByProcurement).map(procurementId => {
      const entries = entriesByProcurement[procurementId];
      const procurementEntry = entries.find(e => e.entryType === 'purchase');
      return {
        procurementId,
        entries,
        // Use dateCreated for true chronological order since entryDate might be same
        dateCreated: procurementEntry ? procurementEntry.dateCreated : entries[0].dateCreated,
        reference: procurementEntry ? procurementEntry.reference : entries[0].reference
      };
    });
    
    // Sort groups by creation time (OLDEST first) - use dateCreated or reference
    procurementGroups.sort((a, b) => {
      // If dateCreated exists and is a Timestamp, use it
      if (a.dateCreated && b.dateCreated && a.dateCreated.seconds && b.dateCreated.seconds) {
        return a.dateCreated.seconds - b.dateCreated.seconds;
      }
      // Otherwise fall back to reference comparison
      return a.reference.localeCompare(b.reference);
    });
    
    // Flatten the sorted groups back into a single array
    const sortedEntries = [];
    procurementGroups.forEach(group => {
      sortedEntries.push(...group.entries);
    });
    
    // Add standalone entries at the end (sorted by date - oldest first)
    standaloneEntries.sort((a, b) => {
      if (a.dateCreated && b.dateCreated && a.dateCreated.seconds && b.dateCreated.seconds) {
        return a.dateCreated.seconds - b.dateCreated.seconds;
      }
      return a.entryDate.localeCompare(b.entryDate);
    });
    sortedEntries.push(...standaloneEntries);
    
    // Calculate running balance based on display order
    let runningBalance = 0;
    sortedEntries.forEach(entry => {
      if (entry.entryType === 'purchase' && !entry.isDeleted) {
        runningBalance += entry.amountDue || 0;
      } else if (entry.entryType === 'payment') {
        runningBalance -= entry.amountPaid || 0;
      }
      entry.runningBalance = Math.max(0, runningBalance);
    });
    
    return {
      success: true,
      ledgerEntries: sortedEntries
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
 * Recalculate supplier balance (utility function for data consistency)
 */
export const recalculateSupplierBalance = async (supplierId) => {
  try {
    // Get all ledger entries in display order (grouped by procurement)
    const ledgerResult = await getSupplierLedger(supplierId);
    
    if (!ledgerResult.success) {
      throw new Error(ledgerResult.error);
    }
    
    let totalDue = 0;
    let totalPaid = 0;
    let runningBalance = 0;
    let entriesUpdated = 0;
    
    // Create a batch for efficient updates
    const batch = writeBatch(db);
    
    // Process entries in display order for correct running balance
    for (const entry of ledgerResult.ledgerEntries) {
      if (entry.entryType === 'purchase' && !entry.isDeleted) {
        totalDue += entry.amountDue || 0;
        runningBalance += entry.amountDue || 0;
      } else if (entry.entryType === 'payment') {
        totalPaid += entry.amountPaid || 0;
        runningBalance -= entry.amountPaid || 0;
      }
      
      // Update running balance if different
      const correctBalance = Math.max(0, runningBalance);
      if (entry.runningBalance !== correctBalance) {
        const entryRef = doc(db, 'supplier_ledger', entry.id);
        batch.update(entryRef, {
          runningBalance: correctBalance,
          lastUpdated: Timestamp.now()
        });
        entriesUpdated++;
      }
    }
    
    // Commit batch updates
    if (entriesUpdated > 0) {
      await batch.commit();
    }
    
    const finalBalance = Math.max(0, runningBalance);
    
    // Update supplier document
    await updateDoc(doc(db, 'suppliers', supplierId), {
      totalOutstanding: finalBalance,
      lastUpdated: Timestamp.now()
    });
    
    return {
      success: true,
      totalDue,
      totalPaid,
      finalBalance,
      entriesUpdated
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
 * Get supplier ledger summary
 */
export const getSupplierLedgerSummary = async (supplierId) => {
  try {
    const ledgerResult = await getSupplierLedger(supplierId);
    
    if (!ledgerResult.success) {
      throw new Error(ledgerResult.error);
    }
    
    const summary = {
      totalDue: 0,
      totalPayments: 0,
      outstandingBalance: 0,
      totalTransactions: ledgerResult.ledgerEntries.length,
      lastPurchaseDate: null,
      lastPaymentDate: null
    };
    
    // Calculate summary from ledger entries
    for (const entry of ledgerResult.ledgerEntries) {
      if (entry.entryType === 'purchase' && !entry.isDeleted) {
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
{/* Part 5 End - Ledger Operations */}

{/* Part 6 Start - Export Statement */}
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
  updateProcurement,
  deleteProcurement, // NEW: Delete function added
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
{/* Part 6 End - Export Statement */}