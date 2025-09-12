// archiveService.js - Archive Service with Write Functionality (Phase 3)
// This service now includes both read-only preview AND actual archive capabilities
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp, 
  doc,
  writeBatch,
  runTransaction
} from 'firebase/firestore';

class ArchiveService {
  constructor() {
    // Phase 3: Changed to allow actual archive operations
    this.isDryRunMode = false; // Now allows actual write operations
    this.archiveInProgress = false;
  }

  // Calculate how many days since a date
  getDaysSince(dateValue) {
    if (!dateValue) return 0;
    
    let compareDate;
    if (dateValue instanceof Timestamp) {
      compareDate = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      compareDate = dateValue;
    } else if (typeof dateValue === 'string') {
      compareDate = new Date(dateValue);
    } else {
      return 0;
    }

    const now = new Date();
    const diffTime = Math.abs(now - compareDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  
  setTestMode(enabled) {
    this.useTestCollections = enabled;
    console.log(`Archive Service: ${enabled ? 'TEST MODE' : 'PRODUCTION MODE'} activated`);
  }

  getCollectionNames() {
    if (this.useTestCollections) {
      return {
        inventory: 'inventory_test',
        archives: 'inventory_archives_test'
      };
    }
    return {
      inventory: 'inventory',
      archives: 'inventory_archives'
    };
  }

  // Get all items eligible for archiving (READ ONLY)
  async getEligibleItems() {
    try {
      // USE THE CORRECT COLLECTION BASED ON TEST MODE
      const collections = this.getCollectionNames();
      console.log('🔍 Fetching eligible items for archive preview...');
      console.log(`📂 Using collection: ${collections.inventory} (${this.useTestCollections ? 'TEST MODE' : 'LIVE MODE'})`);
      
      // Query for sold items only - FROM THE CORRECT COLLECTION
      const inventoryRef = collection(db, collections.inventory);
      console.log(`Querying ${collections.inventory} collection for sold items...`);
      
      const soldQuery = query(inventoryRef, where('status', '==', 'Sold'));
      const querySnapshot = await getDocs(soldQuery);
      
      console.log(`Found ${querySnapshot.size} sold items in ${collections.inventory}`);
      
      const eligibleItems = [];
      const ineligibleItems = [];
      
      querySnapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() };
        const daysSince = this.getDaysSince(item.lastUpdated);
        
        console.log(`Item ${item.id}: ${item.model}, Days since update: ${daysSince}, lastUpdated: ${item.lastUpdated}`);
        
        if (daysSince > 60) {
          eligibleItems.push({
            ...item,
            daysSinceUpdate: daysSince,
            estimatedSize: this.estimateItemSize(item)
          });
        } else {
          ineligibleItems.push({
            ...item,
            daysSinceUpdate: daysSince,
            reason: `Only ${daysSince} days old (needs 60+ days)`
          });
        }
      });

      console.log(`✅ Found ${eligibleItems.length} eligible items in ${collections.inventory}`);
      console.log(`ℹ️ Found ${ineligibleItems.length} ineligible sold items in ${collections.inventory}`);
      
      if (eligibleItems.length > 0) {
        console.log('Sample eligible item:', eligibleItems[0]);
      }
      if (ineligibleItems.length > 0) {
        console.log('Sample ineligible item:', ineligibleItems[0]);
      }
      
      return {
        eligible: eligibleItems,
        ineligible: ineligibleItems
      };
    } catch (error) {
      console.error('Error fetching eligible items:', error);
      console.error('Error details:', error.message, error.code);
      throw error;
    }
  }

  // Estimate document size in bytes
  estimateItemSize(item) {
    // Convert item to JSON string to estimate size
    const jsonString = JSON.stringify(item);
    // Rough estimate: each character is 1 byte, plus some overhead
    return jsonString.length;
  }

  // Calculate statistics for items (READ ONLY)
  calculateArchiveStats(items) {
    if (!items || items.length === 0) {
      return {
        itemCount: 0,
        totalValue: 0,
        totalCost: 0,
        totalMargin: 0,
        averagePrice: 0,
        estimatedBatches: 0,
        totalSizeKB: 0,
        oldestItem: null,
        newestItem: null
      };
    }

    const stats = {
      itemCount: items.length,
      totalValue: 0,
      totalCost: 0,
      totalMargin: 0,
      averagePrice: 0,
      estimatedBatches: 0,
      totalSizeKB: 0,
      oldestItem: null,
      newestItem: null,
      itemsByAge: {
        '60-90 days': 0,
        '90-120 days': 0,
        '120-180 days': 0,
        '180+ days': 0
      }
    };

    let totalSize = 0;
    let oldestDays = 0;
    let newestDays = Infinity;

    items.forEach(item => {
      // Calculate financial stats
      stats.totalValue += item.retailPrice || 0;
      stats.totalCost += item.dealersPrice || 0;
      
      // Calculate size
      const itemSize = item.estimatedSize || this.estimateItemSize(item);
      totalSize += itemSize;
      
      // Track age ranges
      const days = item.daysSinceUpdate || this.getDaysSince(item.lastUpdated);
      
      if (days >= 60 && days < 90) stats.itemsByAge['60-90 days']++;
      else if (days >= 90 && days < 120) stats.itemsByAge['90-120 days']++;
      else if (days >= 120 && days < 180) stats.itemsByAge['120-180 days']++;
      else if (days >= 180) stats.itemsByAge['180+ days']++;
      
      // Track oldest and newest
      if (days > oldestDays) {
        oldestDays = days;
        stats.oldestItem = { ...item, daysSinceUpdate: days };
      }
      if (days < newestDays) {
        newestDays = days;
        stats.newestItem = { ...item, daysSinceUpdate: days };
      }
    });

    stats.totalMargin = stats.totalValue - stats.totalCost;
    stats.averagePrice = stats.itemCount > 0 ? Math.round(stats.totalValue / stats.itemCount) : 0;
    stats.totalSizeKB = Math.round(totalSize / 1024);
    
    // Estimate batches needed (700KB per batch safety limit)
    stats.estimatedBatches = Math.ceil(stats.totalSizeKB / 700);

    return stats;
  }

  // Simulate batch creation (READ ONLY - no actual creation)
  simulateBatchCreation(items) {
    const batches = [];
    let currentBatch = [];
    let currentBatchSize = 0;
    const maxBatchSize = 700 * 1024; // 700KB limit

    items.forEach(item => {
      const itemSize = item.estimatedSize || this.estimateItemSize(item);
      
      if (currentBatchSize + itemSize > maxBatchSize && currentBatch.length > 0) {
        // Current batch would exceed size, start new batch
        batches.push({
          items: [...currentBatch],
          itemCount: currentBatch.length,
          sizeKB: Math.round(currentBatchSize / 1024),
          wouldBeDocumentId: `2025_01_batch_${batches.length + 1}`
        });
        
        currentBatch = [item];
        currentBatchSize = itemSize;
      } else {
        currentBatch.push(item);
        currentBatchSize += itemSize;
      }
    });

    // Add remaining items as last batch
    if (currentBatch.length > 0) {
      batches.push({
        items: [...currentBatch],
        itemCount: currentBatch.length,
        sizeKB: Math.round(currentBatchSize / 1024),
        wouldBeDocumentId: `2025_01_batch_${batches.length + 1}`
      });
    }

    return batches;
  }

  // Preview what would happen if we archived (READ ONLY)
  previewArchive(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) {
      return {
        success: false,
        message: 'No items selected',
        details: null
      };
    }

    // Validate all items are eligible
    const validationErrors = [];
    selectedItems.forEach(item => {
      if (item.status !== 'Sold') {
        validationErrors.push(`Item ${item.id} is not sold (status: ${item.status})`);
      }
      const daysSince = this.getDaysSince(item.lastUpdated);
      if (daysSince <= 60) {
        validationErrors.push(`Item ${item.id} is only ${daysSince} days old`);
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        details: null
      };
    }

    // Simulate batch creation
    const batches = this.simulateBatchCreation(selectedItems);
    const stats = this.calculateArchiveStats(selectedItems);

    return {
      success: true,
      message: 'Archive preview generated successfully',
      details: {
        itemCount: selectedItems.length,
        batchCount: batches.length,
        totalSizeKB: stats.totalSizeKB,
        totalValue: stats.totalValue,
        totalMargin: stats.totalMargin,
        batches: batches.map(batch => ({
          documentId: batch.wouldBeDocumentId,
          itemCount: batch.itemCount,
          sizeKB: batch.sizeKB,
          withinLimit: batch.sizeKB < 700
        })),
        warning: stats.totalSizeKB > 700 * batches.length * 0.8 
          ? 'Some batches are close to size limit. Consider archiving fewer items at once.'
          : null
      }
    };
  }

  // ==================== PHASE 3: WRITE FUNCTIONALITY ====================

  // Generate batch document ID with timestamp
  generateBatchDocumentId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    return `${year}_${month}_batch_${timestamp}`;
  }

  // Validate items before archiving
  validateItemsForArchive(items) {
    const errors = [];
    const validItems = [];
    
    items.forEach(item => {
      const itemErrors = [];
      
      // Check status
      if (item.status !== 'Sold') {
        itemErrors.push(`Not sold (status: ${item.status})`);
      }
      
      // Check age
      const daysSince = this.getDaysSince(item.lastUpdated);
      if (daysSince <= 60) {
        itemErrors.push(`Only ${daysSince} days old (needs > 60 days)`);
      }
      
      // Check required fields
      if (!item.id) {
        itemErrors.push('Missing document ID');
      }
      
      if (itemErrors.length > 0) {
        errors.push({
          itemId: item.id || 'unknown',
          model: item.model || 'unknown',
          errors: itemErrors
        });
      } else {
        validItems.push(item);
      }
    });
    
    return { validItems, errors };
  }

  // Create archive batch documents
  async createArchiveBatch(items, userId = 'system') {
    try {
      const batches = [];
      let currentBatch = [];
      let currentBatchSize = 0;
      const maxBatchSize = 700 * 1024; // 700KB limit
      
      // Group items into batches
      for (const item of items) {
        const itemSize = this.estimateItemSize(item);
        
        if (currentBatchSize + itemSize > maxBatchSize && currentBatch.length > 0) {
          // Save current batch
          batches.push([...currentBatch]);
          currentBatch = [item];
          currentBatchSize = itemSize;
        } else {
          currentBatch.push(item);
          currentBatchSize += itemSize;
        }
      }
      
      // Add remaining items
      if (currentBatch.length > 0) {
        batches.push([...currentBatch]);
      }
      
      // Create batch documents
      const createdBatches = [];
      for (let i = 0; i < batches.length; i++) {
        const batchItems = batches[i];
        const batchId = this.generateBatchDocumentId() + `_${i + 1}`;
        
        const batchDoc = {
          metadata: {
            batchNumber: i + 1,
            itemCount: batchItems.length,
            totalValue: batchItems.reduce((sum, item) => sum + (item.retailPrice || 0), 0),
            totalCost: batchItems.reduce((sum, item) => sum + (item.dealersPrice || 0), 0),
            archivedAt: Timestamp.now(),
            archivedBy: userId,
            documentIds: batchItems.map(item => item.id)
          },
          items: batchItems
        };
        
        createdBatches.push({ id: batchId, ...batchDoc });
      }
      
      return createdBatches;
    } catch (error) {
      console.error('Error creating archive batches:', error);
      throw error;
    }
  }

  // Main archive function with transaction safety
  async archiveItems(selectedItems, userId = 'system', options = {}) {
    if (this.archiveInProgress) {
      throw new Error('Archive operation already in progress');
    }
    
    if (!selectedItems || selectedItems.length === 0) {
      throw new Error('No items selected for archiving');
    }
    
    // SAFETY CHECK - Log which collections will be used
    const collections = this.getCollectionNames();
    console.log('🚨 SAFETY CHECK - Archive Operation Will Use:');
    console.log(`📥 Reading from: ${collections.inventory}`);
    console.log(`📤 Writing to: ${collections.archives}`);
    console.log(`Mode: ${this.useTestCollections ? 'TEST MODE ✅' : '⚠️ LIVE MODE ⚠️'}`);
    
    // EXTRA SAFETY - Confirm if in LIVE mode
    if (!this.useTestCollections && !options.confirmedLiveMode) {
      const confirmLive = window.confirm(
        '⚠️ WARNING: You are in LIVE MODE!\n\n' +
        `This will DELETE items from the LIVE inventory collection.\n` +
        `From: ${collections.inventory} (PRODUCTION)\n` +
        `To: ${collections.archives} (PRODUCTION)\n\n` +
        'Are you ABSOLUTELY SURE you want to archive LIVE data?'
      );
      
      if (!confirmLive) {
        console.log('✅ Archive cancelled - Live mode operation aborted for safety');
        return {
          success: false,
          message: 'Archive cancelled - Live mode operation aborted',
          cancelled: true
        };
      }
    }
    
    this.archiveInProgress = true;
    const startTime = Date.now();
    
    // USE THE OPTIONS PARAMETER HERE
    const config = {
      testMode: options.testMode || false,
      batchPrefix: options.batchPrefix || new Date().getFullYear() + '_' + String(new Date().getMonth() + 1).padStart(2, '0'),
      maxBatchSize: options.maxBatchSize || 700 * 1024,
      verbose: options.verbose !== false, // Default to true
      ...options
    };
    
    try {
      // Use config.verbose instead of always logging
      if (config.verbose) {
        console.log('🚀 Starting archive operation...');
        console.log(`Processing ${selectedItems.length} items`);
        console.log(`Collections being used: ${JSON.stringify(collections)}`);
        if (config.testMode) {
          console.log('⚠️ Running in TEST MODE - no actual changes will be made');
        }
      }
      
      // Validate items
      const { validItems, errors } = this.validateItemsForArchive(selectedItems);
      
      if (validItems.length === 0) {
        throw new Error('No valid items to archive. All items failed validation.');
      }
      
      if (errors.length > 0 && config.verbose) {
        console.warn('⚠️ Some items failed validation:', errors);
      }
      
      // Create archive batches
      const batches = await this.createArchiveBatch(validItems, userId);
      
      if (config.verbose) {
        console.log(`📦 Created ${batches.length} archive batches`);
      }
      
      // If in test mode, return early without making changes
      if (config.testMode) {
        console.log('✅ TEST MODE: Archive operation validated successfully');
        return {
          success: true,
          message: `TEST MODE: Would archive ${validItems.length} items`,
          testMode: true,
          details: {
            itemsArchived: validItems.length,
            batchesCreated: batches.length,
            batchIds: batches.map(b => b.id),
            deletedItemIds: validItems.map(item => item.id),
            validationErrors: errors,
            duration: Date.now() - startTime
          }
        };
      }
      
      // Use transaction for atomic operation
      const result = await runTransaction(db, async (transaction) => {
        const writtenBatches = [];
        const deletedItems = [];
        
        // LOG before writing
        console.log(`✍️ Writing batches to: ${collections.archives}`);
        
        // Write archive batches - USE CORRECT COLLECTION
        for (const batch of batches) {
          const archiveRef = doc(db, collections.archives, batch.id);
          console.log(`  - Creating batch in ${collections.archives}:`, batch.id);
          transaction.set(archiveRef, {
            metadata: batch.metadata,
            items: batch.items
          });
          writtenBatches.push(batch.id);
        }
        
        // LOG before deleting
        console.log(`🗑️ Deleting items from: ${collections.inventory}`);
        
        // Delete from inventory - USE CORRECT COLLECTION
        for (const item of validItems) {
          const inventoryRef = doc(db, collections.inventory, item.id);
          console.log(`  - Deleting from ${collections.inventory}:`, item.id);
          transaction.delete(inventoryRef);
          deletedItems.push(item.id);
        }
        
        return { writtenBatches, deletedItems };
      });
      
      const duration = Date.now() - startTime;
      
      if (config.verbose) {
        console.log('✅ Archive operation completed successfully!');
        console.log(`📊 Archived ${result.deletedItems.length} items in ${result.writtenBatches.length} batches`);
        console.log(`⏱️ Operation took ${duration}ms`);
        console.log(`📂 Items moved from ${collections.inventory} to ${collections.archives}`);
      }
      
      return {
        success: true,
        message: `Successfully archived ${result.deletedItems.length} items`,
        details: {
          itemsArchived: result.deletedItems.length,
          batchesCreated: result.writtenBatches.length,
          batchIds: result.writtenBatches,
          deletedItemIds: result.deletedItems,
          validationErrors: errors,
          duration: duration,
          collections: collections // Include which collections were used
        }
      };
      
    } catch (error) {
      console.error('❌ Archive operation failed:', error);
      throw error;
    } finally {
      this.archiveInProgress = false;
    }
  }

  // Delete items from inventory (used after successful archive write)
  async deleteFromInventory(itemIds) {
    try {
      console.log(`🗑️ Deleting ${itemIds.length} items from inventory...`);
      
      const batch = writeBatch(db);
      let deletedCount = 0;
      
      for (const itemId of itemIds) {
        const docRef = doc(db, 'inventory', itemId);
        batch.delete(docRef);
        deletedCount++;
        
        // Commit batch every 500 operations (Firestore limit)
        if (deletedCount % 500 === 0) {
          await batch.commit();
          console.log(`Deleted ${deletedCount} items...`);
        }
      }
      
      // Commit remaining
      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }
      
      console.log(`✅ Successfully deleted ${deletedCount} items from inventory`);
      return { deletedCount };
      
    } catch (error) {
      console.error('Error deleting from inventory:', error);
      throw error;
    }
  }

  // Validate and execute archive operation with safety checks
  async validateAndExecute(items, userId = 'system', options = {}) {
    try {
      // First do a preview
      const preview = this.previewArchive(items);
      
      if (!preview.success) {
        throw new Error(`Validation failed: ${preview.message}`);
      }
      
      // Check for warnings
      if (preview.details.warning && !options.ignoreWarnings) {
        const proceed = window.confirm(
          `Warning: ${preview.details.warning}\n\nDo you want to proceed anyway?`
        );
        if (!proceed) {
          return {
            success: false,
            message: 'Archive cancelled by user',
            cancelled: true
          };
        }
      }
      
      // Final confirmation
      if (!options.skipConfirmation) {
        const confirm = window.confirm(
          `You are about to archive ${items.length} items permanently.\n\n` +
          `This will:\n` +
          `- Move items to archive collection\n` +
          `- Remove them from active inventory\n` +
          `- Create ${preview.details.batchCount} archive batch(es)\n\n` +
          `This action cannot be easily undone. Continue?`
        );
        
        if (!confirm) {
          return {
            success: false,
            message: 'Archive cancelled by user',
            cancelled: true
          };
        }
      }
      
      // Execute archive
      return await this.archiveItems(items, userId, options);
      
    } catch (error) {
      console.error('Validation and execution failed:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Test archive operation (for testing on test collections)
  async testArchiveOperation(items, testCollectionName = 'inventory_test') {
    console.log('🧪 Running test archive operation...');
    console.log(`Using test collection: ${testCollectionName}`);
    
    try {
      // Create test batches (without writing)
      const batches = await this.createArchiveBatch(items);
      
      console.log('✅ Test validation passed');
      console.log(`Would create ${batches.length} batches`);
      console.log('Batch details:', batches.map(b => ({
        id: b.id,
        itemCount: b.metadata.itemCount,
        sizeKB: Math.round(this.estimateItemSize(b) / 1024)
      })));
      
      return {
        success: true,
        message: 'Test archive operation successful',
        batches: batches.length,
        items: items.length
      };
      
    } catch (error) {
      console.error('Test archive failed:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }
}

// Export singleton instance
const archiveService = new ArchiveService();
export default archiveService;