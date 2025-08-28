// archiveService.js - Read-Only Archive Preview Service
// This service ONLY reads data, never modifies anything
import { db } from '../firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

class ArchiveService {
  constructor() {
    this.isDryRunMode = true; // ALWAYS in dry-run mode for safety
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

  // Get all items eligible for archiving (READ ONLY)
  async getEligibleItems() {
    try {
      console.log('🔍 Fetching eligible items for archive preview...');
      
      // Query for sold items only
      const inventoryRef = collection(db, 'inventory');
      console.log('Querying inventory collection for sold items...');
      
      const soldQuery = query(inventoryRef, where('status', '==', 'Sold'));
      const querySnapshot = await getDocs(soldQuery);
      
      console.log(`Found ${querySnapshot.size} sold items in total`);
      
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

      console.log(`✅ Found ${eligibleItems.length} eligible items`);
      console.log(`ℹ️ Found ${ineligibleItems.length} ineligible sold items`);
      
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
}

// Export singleton instance
const archiveService = new ArchiveService();
export default archiveService;