/**
 * SAFE SURGICAL FIX SCRIPT
 * This script will fix ONLY the specific corrupted ledger entries
 * You provide the document IDs to fix, and it will update only those entries
 */

import { doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Fix specific corrupted ledger entries by their document IDs
 * @param {Array} fixInstructions - Array of objects: [{ docId: '...', newRunningBalance: 123.45 }]
 */
export const fixSpecificLedgerEntries = async (fixInstructions) => {
  try {
    console.log('🔧 SURGICAL FIX STARTED');
    console.log(`Will update ${fixInstructions.length} specific entries\n`);
    
    // Show what will be updated BEFORE doing it
    console.log('📋 ENTRIES TO BE UPDATED:');
    console.log('='.repeat(80));
    fixInstructions.forEach((instruction, index) => {
      console.log(`${index + 1}. Document ID: ${instruction.docId}`);
      console.log(`   New Running Balance: ₱${instruction.newRunningBalance.toLocaleString()}`);
      console.log('');
    });
    
    // Ask for confirmation
    const confirmed = confirm(
      `You are about to update ${fixInstructions.length} ledger entries.\n\n` +
      `This will set their running balances to the correct values.\n\n` +
      `Check the console for details.\n\n` +
      `Continue?`
    );
    
    if (!confirmed) {
      console.log('❌ Fix cancelled by user');
      return { success: false, message: 'Cancelled by user' };
    }
    
    // Create batch for atomic updates
    const batch = writeBatch(db);
    
    // Update each entry
    fixInstructions.forEach((instruction) => {
      const entryRef = doc(db, 'supplier_ledger', instruction.docId);
      batch.update(entryRef, {
        runningBalance: instruction.newRunningBalance,
        lastUpdated: Timestamp.now()
      });
    });
    
    // Commit the batch
    await batch.commit();
    
    console.log('✅ Successfully updated all entries');
    console.log('🎉 SURGICAL FIX COMPLETED');
    
    return {
      success: true,
      entriesUpdated: fixInstructions.length,
      message: `Successfully updated ${fixInstructions.length} entries`
    };
    
  } catch (error) {
    console.error('Error in surgical fix:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fix the Samsung supplier's total outstanding balance
 * @param {string} supplierId - The supplier document ID
 * @param {number} newBalance - The correct balance
 */
export const fixSupplierBalance = async (supplierId, newBalance) => {
  try {
    console.log('🔧 FIXING SUPPLIER BALANCE');
    console.log(`Supplier ID: ${supplierId}`);
    console.log(`New Balance: ₱${newBalance.toLocaleString()}\n`);
    
    const confirmed = confirm(
      `Update supplier's outstanding balance to ₱${newBalance.toLocaleString()}?\n\n` +
      `This will update the suppliers collection.`
    );
    
    if (!confirmed) {
      console.log('❌ Fix cancelled by user');
      return { success: false, message: 'Cancelled by user' };
    }
    
    const supplierRef = doc(db, 'suppliers', supplierId);
    await updateDoc(supplierRef, {
      totalOutstanding: newBalance,
      lastUpdated: Timestamp.now()
    });
    
    console.log('✅ Supplier balance updated successfully');
    
    return {
      success: true,
      message: `Supplier balance updated to ₱${newBalance.toLocaleString()}`
    };
    
  } catch (error) {
    console.error('Error fixing supplier balance:', error);
    return {
      success: false,
      error: error.message
    };
  }
};