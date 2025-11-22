/**
 * SAFE DIAGNOSTIC SCRIPT - READ ONLY
 * This script will identify the corrupted ledger entries for Samsung supplier
 * IT DOES NOT MODIFY ANY DATA
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export const diagnoseSamsungLedger = async () => {
  try {
    console.log('🔍 DIAGNOSTIC SCAN STARTED - Samsung (Oro Graphic Inc)');
    console.log('This is READ-ONLY and will not modify any data\n');
    
    // Find Samsung supplier ID
    const suppliersQuery = query(
      collection(db, 'suppliers'),
      where('supplierName', '==', 'Samsung (Oro Graphic Inc)')
    );
    
    const suppliersSnapshot = await getDocs(suppliersQuery);
    
    if (suppliersSnapshot.empty) {
      console.log('❌ Samsung supplier not found');
      return { success: false, error: 'Supplier not found' };
    }
    
    const samsungSupplier = suppliersSnapshot.docs[0];
    const supplierId = samsungSupplier.id;
    const supplierData = samsungSupplier.data();
    
    console.log('✅ Found Samsung supplier:');
    console.log(`   ID: ${supplierId}`);
    console.log(`   Current Outstanding Balance: ₱${supplierData.totalOutstanding}`);
    console.log('');
    
    // Get ALL ledger entries for Samsung
    const ledgerQuery = query(
      collection(db, 'supplier_ledger'),
      where('supplierId', '==', supplierId)
    );
    
    const ledgerSnapshot = await getDocs(ledgerQuery);
    
    console.log(`📊 Found ${ledgerSnapshot.size} ledger entries\n`);
    
    const entries = [];
    const corruptedEntries = [];
    
    ledgerSnapshot.forEach((doc) => {
      const data = doc.data();
      const entry = {
        id: doc.id,
        ...data
      };
      entries.push(entry);
      
      // Check for corrupted values
      const runningBalance = entry.runningBalance || 0;
      const amountDue = entry.amountDue || 0;
      const amountPaid = entry.amountPaid || 0;
      
      // Flag if running balance is abnormally large
      if (runningBalance > 1000000000) { // 1 billion
        corruptedEntries.push({
          id: doc.id,
          date: entry.entryDate,
          type: entry.entryType,
          reference: entry.reference,
          procurementId: entry.procurementId,
          description: entry.description,
          amountDue,
          amountPaid,
          runningBalance,
          isDeleted: entry.isDeleted || false
        });
      }
    });
    
    // Sort entries by date
    entries.sort((a, b) => {
      const dateA = a.entryDate || '';
      const dateB = b.entryDate || '';
      return dateA.localeCompare(dateB);
    });
    
    console.log('📋 ALL LEDGER ENTRIES (in chronological order):');
    console.log('='.repeat(100));
    
    let calculatedBalance = 0;
    entries.forEach((entry, index) => {
      if (entry.entryType === 'purchase' && !entry.isDeleted) {
        calculatedBalance += entry.amountDue || 0;
      } else if (entry.entryType === 'payment') {
        calculatedBalance -= entry.amountPaid || 0;
      }
      
      const storedBalance = entry.runningBalance || 0;
      const isCorrupted = storedBalance > 1000000000;
      const isWrong = Math.abs(storedBalance - calculatedBalance) > 0.01;
      
      console.log(`\n${index + 1}. ${entry.entryDate} | ${entry.entryType.toUpperCase()} | ${entry.reference}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Procurement ID: ${entry.procurementId || 'N/A'}`);
      console.log(`   Document ID: ${entry.id}`);
      
      if (entry.entryType === 'purchase') {
        console.log(`   Amount Due: ₱${(entry.amountDue || 0).toLocaleString()}`);
      } else if (entry.entryType === 'payment') {
        console.log(`   Amount Paid: ₱${(entry.amountPaid || 0).toLocaleString()}`);
      }
      
      console.log(`   Stored Running Balance: ₱${storedBalance.toLocaleString()}`);
      console.log(`   Calculated Should Be: ₱${calculatedBalance.toLocaleString()}`);
      
      if (isCorrupted) {
        console.log(`   ⚠️  CORRUPTED VALUE DETECTED!`);
      } else if (isWrong) {
        console.log(`   ⚠️  INCORRECT (off by ₱${Math.abs(storedBalance - calculatedBalance).toLocaleString()})`);
      } else {
        console.log(`   ✅ Correct`);
      }
      
      if (entry.isDeleted) {
        console.log(`   🗑️  DELETED ENTRY`);
      }
    });
    
    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Entries: ${entries.length}`);
    console.log(`   Corrupted Entries: ${corruptedEntries.length}`);
    console.log(`   Calculated Final Balance: ₱${calculatedBalance.toLocaleString()}`);
    console.log(`   Stored Supplier Balance: ₱${supplierData.totalOutstanding.toLocaleString()}`);
    
    if (corruptedEntries.length > 0) {
      console.log('\n🚨 CORRUPTED ENTRIES FOUND:');
      console.log('='.repeat(100));
      corruptedEntries.forEach((entry, index) => {
        console.log(`\n${index + 1}. Document ID: ${entry.id}`);
        console.log(`   Date: ${entry.date}`);
        console.log(`   Type: ${entry.type}`);
        console.log(`   Reference: ${entry.reference}`);
        console.log(`   Procurement ID: ${entry.procurementId}`);
        console.log(`   Description: ${entry.description}`);
        console.log(`   Amount Due: ₱${(entry.amountDue || 0).toLocaleString()}`);
        console.log(`   Amount Paid: ₱${(entry.amountPaid || 0).toLocaleString()}`);
        console.log(`   CORRUPTED Running Balance: ₱${entry.runningBalance.toLocaleString()}`);
        console.log(`   Is Deleted: ${entry.isDeleted}`);
      });
    }
    
    return {
      success: true,
      supplierId,
      totalEntries: entries.length,
      corruptedEntries,
      calculatedFinalBalance: calculatedBalance,
      storedBalance: supplierData.totalOutstanding,
      allEntries: entries
    };
    
  } catch (error) {
    console.error('Error in diagnostic:', error);
    return {
      success: false,
      error: error.message
    };
  }
};