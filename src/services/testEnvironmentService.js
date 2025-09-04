// testEnvironmentService.js - Test Environment Setup for Archive System
// Phase 2: Testing Infrastructure
// Creates and manages test collections for safe testing

import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';

class TestEnvironmentService {
  constructor() {
    this.testCollections = {
      inventory: 'inventory_test',
      archives: 'inventory_archives_test'
    };
    this.setupInProgress = false;
  }

  // Setup test environment by copying production data
  async setupTestEnvironment() {
    if (this.setupInProgress) {
      throw new Error('Test environment setup already in progress');
    }

    this.setupInProgress = true;
    const startTime = Date.now();
    
    try {
      console.log('🚀 Setting up test environment...');
      
      // Step 1: Copy inventory collection to inventory_test
      const copiedCount = await this.copyCollection('inventory', this.testCollections.inventory);
      
      // Step 2: Verify the copy
      const verificationResult = await this.verifyTestCollection();
      
      // Step 3: Initialize empty archives test collection
      await this.initializeArchivesTestCollection();
      
      const duration = Date.now() - startTime;
      
      console.log('✅ Test environment setup complete!');
      console.log(`⏱️ Setup took ${duration}ms`);
      console.log(`📊 Copied ${copiedCount} items to test collection`);
      
      return {
        success: true,
        duration,
        itemsCopied: copiedCount,
        verification: verificationResult,
        testCollections: this.testCollections
      };
      
    } catch (error) {
      console.error('❌ Test environment setup failed:', error);
      throw error;
    } finally {
      this.setupInProgress = false;
    }
  }

  // Copy collection from source to destination
  async copyCollection(sourceCollection, destCollection) {
    try {
      console.log(`📋 Copying ${sourceCollection} to ${destCollection}...`);
      
      // Get all documents from source
      const sourceRef = collection(db, sourceCollection);
      const snapshot = await getDocs(sourceRef);
      
      console.log(`Found ${snapshot.size} documents to copy`);
      
      // Use batched writes for efficiency
      const batchSize = 500; // Firestore batch limit
      let batch = writeBatch(db);
      let operationCount = 0;
      let totalCopied = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const destDocRef = doc(db, destCollection, docSnapshot.id);
        batch.set(destDocRef, docSnapshot.data());
        operationCount++;
        
        // Commit batch when limit reached
        if (operationCount === batchSize) {
          await batch.commit();
          totalCopied += operationCount;
          console.log(`⏳ Copied ${totalCopied}/${snapshot.size} documents...`);
          
          // Start new batch
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
      
      // Commit remaining operations
      if (operationCount > 0) {
        await batch.commit();
        totalCopied += operationCount;
      }
      
      console.log(`✅ Successfully copied ${totalCopied} documents`);
      return totalCopied;
      
    } catch (error) {
      console.error(`❌ Error copying collection:`, error);
      throw error;
    }
  }

  // Verify test collection integrity
  async verifyTestCollection() {
    try {
      console.log('🔍 Verifying test collection...');
      
      // Get counts from both collections
      const prodRef = collection(db, 'inventory');
      const testRef = collection(db, this.testCollections.inventory);
      
      const prodSnapshot = await getDocs(prodRef);
      const testSnapshot = await getDocs(testRef);
      
      const verification = {
        productionCount: prodSnapshot.size,
        testCount: testSnapshot.size,
        match: prodSnapshot.size === testSnapshot.size
      };
      
      // Sample verification - check a few random documents
      const sampleSize = Math.min(10, prodSnapshot.size);
      const sampleDocs = [];
      const prodDocs = prodSnapshot.docs;
      
      for (let i = 0; i < sampleSize; i++) {
        const randomIndex = Math.floor(Math.random() * prodDocs.length);
        const prodDoc = prodDocs[randomIndex];
        
        // Find corresponding test document
        const testDoc = testSnapshot.docs.find(d => d.id === prodDoc.id);
        
        if (testDoc) {
          const match = JSON.stringify(prodDoc.data()) === JSON.stringify(testDoc.data());
          sampleDocs.push({
            id: prodDoc.id,
            match
          });
        }
      }
      
      verification.sampleVerification = sampleDocs;
      verification.sampleMatch = sampleDocs.every(d => d.match);
      
      console.log('📊 Verification results:', verification);
      return verification;
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }

  // Initialize empty archives test collection
  async initializeArchivesTestCollection() {
    try {
      console.log('📦 Initializing archives test collection...');
      
      // Create a placeholder document to ensure collection exists
      const placeholderRef = doc(db, this.testCollections.archives, '_placeholder');
      await setDoc(placeholderRef, {
        created: Timestamp.now(),
        type: 'placeholder',
        message: 'This collection is ready for archive testing'
      });
      
      // Immediately delete the placeholder
      await deleteDoc(placeholderRef);
      
      console.log('✅ Archives test collection initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize archives collection:', error);
      throw error;
    }
  }

  // Clean up test collections (use with caution!)
  async cleanupTestEnvironment() {
    const confirmation = window.confirm(
      'Are you sure you want to delete all test collections? This action cannot be undone.'
    );
    
    if (!confirmation) {
      console.log('❌ Cleanup cancelled by user');
      return { cancelled: true };
    }
    
    try {
      console.log('🧹 Cleaning up test environment...');
      
      let deletedCount = 0;
      
      // Delete all documents in test collections
      for (const collectionName of Object.values(this.testCollections)) {
        console.log(`Deleting ${collectionName}...`);
        const deleted = await this.deleteCollection(collectionName);
        deletedCount += deleted;
      }
      
      console.log(`✅ Cleanup complete. Deleted ${deletedCount} documents`);
      return {
        success: true,
        deletedCount
      };
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  // Delete all documents in a collection
  async deleteCollection(collectionName) {
    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      // Use batched deletes
      const batchSize = 500;
      let batch = writeBatch(db);
      let operationCount = 0;
      let totalDeleted = 0;
      
      for (const docSnapshot of snapshot.docs) {
        batch.delete(docSnapshot.ref);
        operationCount++;
        
        if (operationCount === batchSize) {
          await batch.commit();
          totalDeleted += operationCount;
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
      
      // Commit remaining operations
      if (operationCount > 0) {
        await batch.commit();
        totalDeleted += operationCount;
      }
      
      return totalDeleted;
      
    } catch (error) {
      console.error(`❌ Error deleting collection ${collectionName}:`, error);
      throw error;
    }
  }

  // Get test collection statistics
  async getTestStatistics() {
    try {
      console.log('📊 Gathering test environment statistics...');
      
      const stats = {};
      
      for (const [statsKey, collectionName] of Object.entries(this.testCollections)) {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        stats[statsKey] = {
          collection: collectionName,
          documentCount: snapshot.size,
          estimatedSize: this.estimateCollectionSize(snapshot)
        };
        
        // Get status breakdown for inventory test
        if (statsKey === 'inventory') {
          const statusBreakdown = {};
          snapshot.forEach(doc => {
            const status = doc.data().status || 'Unknown';
            statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
          });
          stats[statsKey].statusBreakdown = statusBreakdown;
        }
      }
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
      throw error;
    }
  }

  // Estimate collection size in KB
  estimateCollectionSize(snapshot) {
    let totalSize = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const jsonString = JSON.stringify(data);
      totalSize += jsonString.length;
    });
    
    return Math.round(totalSize / 1024); // Convert to KB
  }

  // Test archive operation on test collection
  async testArchiveOperation(itemIds) {
    try {
      console.log('🧪 Testing archive operation...');
      console.log(`Archiving ${itemIds.length} items in test environment`);
      
      // This is a placeholder for testing archive operations
      // Actual implementation will be in Phase 3
      
      const result = {
        success: true,
        itemsProcessed: itemIds.length,
        testCollection: this.testCollections.archives,
        message: 'Test archive operation simulated successfully'
      };
      
      console.log('✅ Test operation complete:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Test operation failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const testEnvironmentService = new TestEnvironmentService();
export default testEnvironmentService;