// exportInventory.js - Backup Utility for Inventory Collection
// Phase 2: Backup & Testing Infrastructure
// This service exports the entire inventory collection to JSON with timestamp
// CRITICAL: Must be used before any write operations in Phase 3

import { db } from '../firebase/config';
import { collection, getDocs, Timestamp } from 'firebase/firestore';

class ExportInventoryService {
  constructor() {
    this.exportInProgress = false;
  }

  // Convert Firestore Timestamp to readable date
  convertTimestamp(value) {
    if (value instanceof Timestamp) {
      return {
        _type: 'timestamp',
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
        dateString: value.toDate().toISOString()
      };
    }
    return value;
  }

  // Recursively process document data to handle special types
  processDocumentData(data) {
    const processed = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Timestamp) {
        processed[key] = this.convertTimestamp(value);
      } else if (value instanceof Date) {
        processed[key] = {
          _type: 'date',
          dateString: value.toISOString()
        };
      } else if (Array.isArray(value)) {
        processed[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? this.processDocumentData(item) 
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        processed[key] = this.processDocumentData(value);
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }

  // Main export function for inventory collection
  async exportInventory(options = {}) {
    if (this.exportInProgress) {
      throw new Error('Export already in progress');
    }

    this.exportInProgress = true;
    const startTime = Date.now();
    
    try {
      console.log('🔵 Starting inventory backup...');
      
      // Get all documents from inventory collection
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      console.log(`📊 Found ${snapshot.size} inventory items to backup`);
      
      // Process all documents
      const items = [];
      let processedCount = 0;
      
      snapshot.forEach(doc => {
        const data = this.processDocumentData(doc.data());
        items.push({
          id: doc.id,
          ...data
        });
        processedCount++;
        
        // Log progress every 100 items
        if (processedCount % 100 === 0) {
          console.log(`⏳ Processed ${processedCount}/${snapshot.size} items...`);
        }
      });
      
      // Calculate statistics
      const stats = {
        totalItems: items.length,
        byStatus: {},
        byManufacturer: {},
        totalValue: 0,
        oldestItem: null,
        newestItem: null
      };
      
      items.forEach(item => {
        // Count by status
        if (item.status) {
          stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
        }
        
        // Count by manufacturer
        if (item.manufacturer) {
          stats.byManufacturer[item.manufacturer] = 
            (stats.byManufacturer[item.manufacturer] || 0) + 1;
        }
        
        // Calculate total value
        if (item.retailPrice) {
          stats.totalValue += parseFloat(item.retailPrice) || 0;
        }
        
        // Track date ranges
        if (item.dateAdded) {
          const itemDate = new Date(item.dateAdded);
          if (!stats.oldestItem || itemDate < new Date(stats.oldestItem)) {
            stats.oldestItem = item.dateAdded;
          }
          if (!stats.newestItem || itemDate > new Date(stats.newestItem)) {
            stats.newestItem = item.dateAdded;
          }
        }
      });
      
      // Create backup object
      const backup = {
        metadata: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          createdBy: 'exportInventory.js',
          collection: 'inventory',
          documentCount: items.length,
          exportDuration: Date.now() - startTime,
          checksum: this.generateChecksum(items),
          statistics: stats
        },
        data: items
      };
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, -5); // Remove milliseconds and Z
      const filename = `inventory_backup_${timestamp}.json`;
      
      // Trigger download if not in test mode
      if (!options.testMode) {
        this.downloadJSON(backup, filename);
      }
      
      console.log('✅ Backup completed successfully!');
      console.log(`📁 Filename: ${filename}`);
      console.log(`📊 Statistics:`, stats);
      
      return {
        success: true,
        filename,
        metadata: backup.metadata,
        data: options.includeData ? backup.data : null
      };
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    } finally {
      this.exportInProgress = false;
    }
  }

  // Generate a simple checksum for data integrity
  generateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  // Download JSON file to user's computer
  downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Verify backup integrity
  async verifyBackup(backupData) {
    try {
      console.log('🔍 Verifying backup integrity...');
      
      // Check structure
      if (!backupData.metadata || !backupData.data) {
        throw new Error('Invalid backup structure');
      }
      
      // Verify checksum
      const calculatedChecksum = this.generateChecksum(backupData.data);
      if (calculatedChecksum !== backupData.metadata.checksum) {
        throw new Error('Checksum mismatch - backup may be corrupted');
      }
      
      // Verify document count
      if (backupData.data.length !== backupData.metadata.documentCount) {
        throw new Error('Document count mismatch');
      }
      
      console.log('✅ Backup verification passed');
      return {
        valid: true,
        documentCount: backupData.data.length,
        checksum: calculatedChecksum
      };
      
    } catch (error) {
      console.error('❌ Backup verification failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Compare backup with current database
  async compareBackupWithDatabase(backupData) {
    try {
      console.log('🔍 Starting backup comparison with current database...');
      
      // Validate backup structure
      if (!backupData || !backupData.data || !Array.isArray(backupData.data)) {
        throw new Error('Invalid backup format');
      }
      
      // Fetch current database state
      const inventoryRef = collection(db, 'inventory');
      const currentSnapshot = await getDocs(inventoryRef);
      
      // Create maps for efficient comparison
      const backupMap = new Map();
      const currentMap = new Map();
      
      // Build backup map
      backupData.data.forEach(item => {
        backupMap.set(item.id, item);
      });
      
      // Build current database map
      currentSnapshot.forEach(doc => {
        const data = this.processDocumentData(doc.data());
        currentMap.set(doc.id, { id: doc.id, ...data });
      });
      
      // Comparison results
      const comparison = {
        timestamp: new Date().toISOString(),
        backupDate: backupData.metadata?.createdAt || 'Unknown',
        status: 'UNKNOWN',
        counts: {
          backup: backupMap.size,
          current: currentMap.size,
          matching: 0,      // Items that are truly identical (not modified)
          modified: 0,      // Items that exist in both but have changes
          added: 0,         // Items in current but not in backup
          deleted: 0        // Items in backup but not in current
        },
        details: {
          matching: [],
          modified: [],
          added: [],
          deleted: []
        },
        fieldMismatches: []
      };
      
      // Check items in backup against current database
      for (const [id, backupItem] of backupMap) {
        const currentItem = currentMap.get(id);
        
        if (!currentItem) {
          // Item exists in backup but not in current database (was deleted)
          comparison.counts.deleted++;
          comparison.details.deleted.push({
            id,
            model: backupItem.model,
            status: backupItem.status
          });
        } else {
          // Compare field by field
          const fieldsMatch = this.compareItems(backupItem, currentItem);
          
          if (fieldsMatch.identical) {
            // Item is truly identical (not modified)
            comparison.counts.matching++;
            comparison.details.matching.push(id);
          } else {
            // Item exists but has been modified
            comparison.counts.modified++;
            comparison.details.modified.push({
              id,
              model: currentItem.model,
              differences: fieldsMatch.differences
            });
            
            // Track field-level mismatches
            fieldsMatch.differences.forEach(diff => {
              const existing = comparison.fieldMismatches.find(f => f.field === diff.field);
              if (existing) {
                existing.count++;
              } else {
                comparison.fieldMismatches.push({ field: diff.field, count: 1 });
              }
            });
          }
        }
      }
      
      // Check for new items (in current but not in backup)
      for (const [id, currentItem] of currentMap) {
        if (!backupMap.has(id)) {
          comparison.counts.added++;
          comparison.details.added.push({
            id,
            model: currentItem.model,
            status: currentItem.status,
            dateAdded: currentItem.dateAdded
          });
        }
      }
      
      // Determine overall status
      if (comparison.counts.matching === comparison.counts.backup && 
          comparison.counts.backup === comparison.counts.current &&
          comparison.counts.modified === 0) {
        comparison.status = 'PERFECT_MATCH';
        comparison.message = '✅ Backup perfectly matches current database';
      } else if (comparison.counts.deleted > 0 || comparison.counts.added > 0) {
        comparison.status = 'STRUCTURAL_CHANGES';
        comparison.message = `⚠️ Database structure has changed: ${comparison.counts.added} added, ${comparison.counts.deleted} deleted`;
      } else if (comparison.counts.modified > 0) {
        comparison.status = 'DATA_CHANGES';
        comparison.message = `⚠️ ${comparison.counts.modified} items have been modified since backup`;
      }
      
      // FIXED: Calculate integrity score based on truly identical items
      // Integrity score should reflect the percentage of items that are completely unchanged
      const totalItems = Math.max(comparison.counts.backup, comparison.counts.current);
      if (totalItems > 0) {
        // Only items that are truly identical (not modified) count toward integrity
        const identicalItems = comparison.counts.matching; // This is now truly identical items only
        // Use toFixed(1) to show one decimal place instead of rounding to whole number
        const score = (identicalItems / totalItems) * 100;
        comparison.integrityScore = parseFloat(score.toFixed(1));
      } else {
        comparison.integrityScore = 0;
      }
      
      console.log('📊 Comparison complete:', comparison.message);
      console.log(`🎯 Integrity Score: ${comparison.integrityScore}%`);
      console.log(`📊 Details: ${comparison.counts.matching} identical, ${comparison.counts.modified} modified, ${comparison.counts.added} added, ${comparison.counts.deleted} deleted`);
      
      return comparison;
      
    } catch (error) {
      console.error('❌ Comparison failed:', error);
      throw error;
    }
  }
  
  // Compare two items field by field
  compareItems(item1, item2) {
    const differences = [];
    const ignoredFields = ['_type', 'seconds', 'nanoseconds', 'dateString']; // Timestamp conversion fields
    
    // Get all unique keys from both items
    const allKeys = new Set([...Object.keys(item1), ...Object.keys(item2)]);
    
    for (const key of allKeys) {
      if (ignoredFields.includes(key)) continue;
      
      const val1 = item1[key];
      const val2 = item2[key];
      
      // Handle special cases
      if (this.isTimestamp(val1) && this.isTimestamp(val2)) {
        // Compare timestamps by their date string
        if (val1.dateString !== val2.dateString) {
          differences.push({
            field: key,
            backup: val1.dateString,
            current: val2.dateString
          });
        }
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push({
          field: key,
          backup: val1,
          current: val2
        });
      }
    }
    
    return {
      identical: differences.length === 0,
      differences
    };
  }
  
  // Check if value is a timestamp object
  isTimestamp(value) {
    return value && typeof value === 'object' && value._type === 'timestamp';
  }
  
  // Load and verify a backup file
  async loadAndVerifyBackup(file) {
    try {
      console.log('📂 Loading backup file...');
      
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      // Verify backup structure
      const verification = await this.verifyBackup(backupData);
      if (!verification.valid) {
        throw new Error(`Invalid backup: ${verification.error}`);
      }
      
      // Compare with current database
      const comparison = await this.compareBackupWithDatabase(backupData);
      
      return {
        backup: backupData,
        verification,
        comparison
      };
      
    } catch (error) {
      console.error('❌ Failed to load and verify backup:', error);
      throw error;
    }
  }

  // Generate a detailed comparison report
  generateComparisonReport(comparison) {
    const report = [];
    
    // Use supplier names from comparison if available
    const supplierNames = comparison.supplierNames || {};
    
    report.push('=== BACKUP COMPARISON REPORT ===');
    report.push(`Generated: ${comparison.timestamp}`);
    report.push(`Backup Created: ${comparison.backupDate}`);
    report.push(`Status: ${comparison.status}`);
    report.push(`Integrity Score: ${comparison.integrityScore}%`);
    report.push('');
    
    report.push('=== SUMMARY ===');
    report.push(`Items in Backup: ${comparison.counts.backup}`);
    report.push(`Items in Current DB: ${comparison.counts.current}`);
    report.push(`Truly Identical Items: ${comparison.counts.matching}`);
    report.push(`Modified Items: ${comparison.counts.modified}`);
    report.push(`New Items: ${comparison.counts.added}`);
    report.push(`Deleted Items: ${comparison.counts.deleted}`);
    report.push('');
    
    if (comparison.counts.modified > 0) {
      report.push('=== MODIFIED ITEMS ===');
      comparison.details.modified.slice(0, 10).forEach(item => {
        report.push(`- ${item.id} (${item.model})`);
        item.differences.forEach(diff => {
          let backupValue = diff.backup;
          let currentValue = diff.current;
          
          // Resolve supplier IDs to names
          if (diff.field === 'supplier' || diff.field === 'supplierId') {
            // Check if currentValue is a supplier ID (20+ char alphanumeric)
            if (typeof currentValue === 'string' && currentValue.length >= 20 && /^[a-zA-Z0-9]+$/.test(currentValue)) {
              if (supplierNames[currentValue]) {
                currentValue = supplierNames[currentValue];
              } else {
                currentValue = `Unknown Supplier (${currentValue.substring(0, 8)}...)`;
              }
            }
            
            // Check if backupValue is a supplier ID
            if (typeof backupValue === 'string' && backupValue.length >= 20 && /^[a-zA-Z0-9]+$/.test(backupValue)) {
              if (supplierNames[backupValue]) {
                backupValue = supplierNames[backupValue];
              } else {
                backupValue = `Unknown Supplier (${backupValue.substring(0, 8)}...)`;
              }
            }
          }
          
          // Clean up undefined values
          if (backupValue === 'undefined' || backupValue === undefined || backupValue === null || backupValue === '') {
            backupValue = '(not set)';
          }
          if (currentValue === 'undefined' || currentValue === undefined || currentValue === null || currentValue === '') {
            currentValue = '(not set)';
          }
          
          report.push(`  * ${diff.field}: "${backupValue}" → "${currentValue}"`);
        });
      });
      if (comparison.counts.modified > 10) {
        report.push(`... and ${comparison.counts.modified - 10} more`);
      }
      report.push('');
    }
    
    if (comparison.counts.added > 0) {
      report.push('=== NEW ITEMS (not in backup) ===');
      comparison.details.added.slice(0, 10).forEach(item => {
        report.push(`- ${item.id} (${item.model}) - Added: ${item.dateAdded || 'Unknown'}`);
      });
      if (comparison.counts.added > 10) {
        report.push(`... and ${comparison.counts.added - 10} more`);
      }
      report.push('');
    }
    
    if (comparison.counts.deleted > 0) {
      report.push('=== DELETED ITEMS (only in backup) ===');
      comparison.details.deleted.slice(0, 10).forEach(item => {
        report.push(`- ${item.id} (${item.model})`);
      });
      if (comparison.counts.deleted > 10) {
        report.push(`... and ${comparison.counts.deleted - 10} more`);
      }
      report.push('');
    }
    
    if (comparison.fieldMismatches.length > 0) {
      report.push('=== FIELD CHANGE FREQUENCY ===');
      comparison.fieldMismatches
        .sort((a, b) => b.count - a.count)
        .forEach(field => {
          report.push(`- ${field.field}: ${field.count} changes`);
        });
    }
    
    return report.join('\n');
  }
  
  // Export comparison report as text file
  downloadComparisonReport(comparison) {
    const report = this.generateComparisonReport(comparison);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_comparison_${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Export specific items (for testing)
  async exportSelectedItems(itemIds) {
    try {
      console.log(`🔵 Exporting ${itemIds.length} selected items...`);
      
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      const selectedItems = [];
      snapshot.forEach(doc => {
        if (itemIds.includes(doc.id)) {
          const data = this.processDocumentData(doc.data());
          selectedItems.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      const backup = {
        metadata: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          type: 'partial',
          selectedCount: selectedItems.length,
          requestedCount: itemIds.length
        },
        data: selectedItems
      };
      
      return backup;
      
    } catch (error) {
      console.error('❌ Selected export failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const exportInventoryService = new ExportInventoryService();
export default exportInventoryService;