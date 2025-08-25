{/* Part 1 Start - Imports and Component Definition */}
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Calendar, 
  Building2,
  MapPin,
  X,
  CheckCircle,
  Loader
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalStateContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  doc,
  writeBatch,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkDuplicateImeis } from './phone-selection/services/InventoryService';
import { createInventoryId, getCurrentDate } from './phone-selection/utils/phoneUtils';

const StockReceivingForm = () => {
  // Get procurement data from global state
  const { procurementForReceiving, clearProcurementForReceiving, setActiveComponent } = useGlobalState();
{/* Part 1 End - Imports and Component Definition */}

{/* Part 2 Start - State and Data Setup */}
  // Form state
  const [dateDelivered, setDateDelivered] = useState(new Date().toISOString().split('T')[0]);
  const [bulkLocation, setBulkLocation] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  
  // State for group barcodes
  const [groupBarcodes, setGroupBarcodes] = useState({});
  
  // State for barcode edit mode
  const [barcodeEditMode, setBarcodeEditMode] = useState({});
  
  // State for view-only mode
  const [isViewOnly, setIsViewOnly] = useState(false);
  
  // State for validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  
  // State for save process
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Use actual procurement data or dummy data for testing - wrapped in useMemo to prevent recreating on every render
  const procurementData = useMemo(() => {
    const data = procurementForReceiving || {
      id: 'PROC-2024-001',
      reference: 'PO-2024-0156',
      supplierName: 'TechHub Electronics Inc.',
      supplierId: 'SUPP-001',
      purchaseDate: '2024-12-15',
      deliveryStatus: 'pending',
      items: [
        {
          manufacturer: 'Apple',
          model: 'iPhone 15 Pro',
          ram: '8GB',
          storage: '256GB',
          color: 'Natural Titanium',
          quantity: 3,
          dealersPrice: 75000,
          retailPrice: 85000,
          barcode: ''
        },
        {
          manufacturer: 'Samsung',
          model: 'Galaxy S24 Ultra',
          ram: '12GB',
          storage: '512GB',
          color: 'Titanium Gray',
          quantity: 2,
          dealersPrice: 65000,
          retailPrice: 75000,
          barcode: ''
        }
      ]
    };
    console.log('📦 Procurement Data:', data);
    console.log('📦 Procurement Items:', data.items);
    return data;
  }, [procurementForReceiving]);

  // Set view-only mode based on delivery status
  useEffect(() => {
    if (procurementData.deliveryStatus === 'delivered' || procurementData.isReceived === true) {
      setIsViewOnly(true);
      // Also set the delivery date and reference if available
      if (procurementData.dateDelivered) {
        setDateDelivered(procurementData.dateDelivered);
      }
      if (procurementData.deliveryReference) {
        setDeliveryReference(procurementData.deliveryReference);
      }
    }
  }, [procurementData]);

  // Initialize receiving items state
  const [receivingItems, setReceivingItems] = useState([]);
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('🔄 Group Barcodes State Updated:', groupBarcodes);
  }, [groupBarcodes]);
  
  useEffect(() => {
    console.log('🔄 Receiving Items State Updated:', receivingItems);
  }, [receivingItems]);
  
  // Initialize receiving items and fetch barcodes when procurementData changes
  useEffect(() => {
    const initializeItemsWithBarcodes = async () => {
      console.log('🚀 Starting initializeItemsWithBarcodes');
      const isDelivered = procurementData.deliveryStatus === 'delivered' || procurementData.isReceived === true;
      console.log('Is Delivered Status:', isDelivered);
      
      // If in delivered mode, fetch the actual received items from inventory
      if (isDelivered && procurementData.id) {
        console.log('📋 Fetching received items for procurement:', procurementData.id);
        
        try {
          // Query inventory for items from this procurement
          // FIX: First try to query by procurementId, then fallback to date-based query
          const inventoryRef = collection(db, 'inventory');
          
          // First try: Query by procurementId (for new items)
          let q = query(
            inventoryRef,
            where("procurementId", "==", procurementData.id)
          );
          
          let snapshot = await getDocs(q);
          console.log(`📋 Query by procurementId found ${snapshot.size} items`);
          
          // If no items found with procurementId, try fallback query
          if (snapshot.size === 0 && procurementData.dateDelivered) {
            console.log('📋 Trying fallback query by date and supplier...');
            
            // Convert the date to both possible formats for matching
            const deliveryDate = procurementData.dateDelivered;
            const dateUS = new Date(deliveryDate).toLocaleDateString('en-US'); // M/D/YYYY format
            
            // Fallback: Query by supplier and delivery date
            q = query(
              inventoryRef,
              where("supplierId", "==", procurementData.supplierId || ''),
              where("dateAdded", "==", dateUS)
            );
            
            snapshot = await getDocs(q);
            console.log(`📋 Fallback query by date found ${snapshot.size} items`);
            
            // If still no results, try with the original date format
            if (snapshot.size === 0) {
              q = query(
                inventoryRef,
                where("supplierId", "==", procurementData.supplierId || ''),
                where("dateAdded", "==", deliveryDate)
              );
              
              snapshot = await getDocs(q);
              console.log(`📋 Fallback query with original date format found ${snapshot.size} items`);
            }
          }
          
          console.log(`📋 Final result: Found ${snapshot.size} inventory items`);
          
          // Filter items by matching them to procurement items
          const receivedItems = [];
          const groupBarcodeMap = {};
          let rowId = 1;
          
          // Group the inventory items by product specification
          const inventoryByProduct = {};
          snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const productKey = `${item.manufacturer}_${item.model}_${item.ram}_${item.storage}_${item.color}`;
            
            if (!inventoryByProduct[productKey]) {
              inventoryByProduct[productKey] = [];
            }
            inventoryByProduct[productKey].push(item);
          });
          
          // Process each procurement item group
          procurementData.items.forEach((procItem, groupIndex) => {
            const productKey = `${procItem.manufacturer}_${procItem.model}_${procItem.ram}_${procItem.storage}_${procItem.color}`;
            const matchingInventoryItems = inventoryByProduct[productKey] || [];
            
            console.log(`🔍 Processing procurement item ${groupIndex}: ${productKey}`);
            console.log(`   Found ${matchingInventoryItems.length} matching inventory items`);
            
            // Set the barcode for this group
            if (matchingInventoryItems.length > 0 && matchingInventoryItems[0].barcode) {
              groupBarcodeMap[groupIndex] = matchingInventoryItems[0].barcode;
            }
            
            // Add the received items (up to the procurement quantity)
            const itemsToShow = matchingInventoryItems.slice(0, procItem.quantity);
            
            itemsToShow.forEach((invItem) => {
              receivedItems.push({
                id: rowId++,
                groupId: groupIndex,
                ...procItem,
                barcode: invItem.barcode || '',
                imei1: invItem.imei1 || '',
                imei2: invItem.imei2 || '',
                serialNumber: invItem.serialNumber || '',
                location: invItem.location || '',
                status: invItem.status || 'On-Hand'
              });
            });
            
            // If we have fewer received items than procurement quantity, add empty rows
            const remainingQty = procItem.quantity - itemsToShow.length;
            for (let i = 0; i < remainingQty; i++) {
              receivedItems.push({
                id: rowId++,
                groupId: groupIndex,
                ...procItem,
                barcode: groupBarcodeMap[groupIndex] || '',
                imei1: '',
                imei2: '',
                serialNumber: '',
                location: '',
                status: 'On-Hand'
              });
            }
          });
          
          console.log('📦 Final received items:', receivedItems);
          console.log('📦 Final group barcodes:', groupBarcodeMap);
          
          setGroupBarcodes(groupBarcodeMap);
          setReceivingItems(receivedItems);
          
        } catch (error) {
          console.error('❌ Error fetching received items:', error);
          // Fall back to creating empty rows
          await createEmptyRows();
        }
      } else {
        // Not in view mode, create empty rows for receiving
        await createEmptyRows();
      }
    };
    
    // Helper function to create empty rows
    const createEmptyRows = async () => {
      console.log('🔍 Creating empty rows for receiving');
      const rows = [];
      let rowId = 1;
      const newGroupBarcodes = {};
      
      // Process each item group and fetch barcodes
      for (let groupIndex = 0; groupIndex < procurementData.items.length; groupIndex++) {
        const item = procurementData.items[groupIndex];
        console.log(`\n🔍 Processing Group ${groupIndex}:`, item);
        
        // Start with barcode from procurement if available
        let barcode = item.barcode || '';
        console.log(`📊 Initial barcode from procurement: "${barcode}"`);
        
        // If no barcode in procurement, try to fetch from existing inventory
        if (!barcode && item.manufacturer && item.model && item.ram && item.storage && item.color) {
          try {
            console.log(`🔎 Fetching barcode for: ${item.manufacturer} ${item.model} ${item.ram} ${item.storage} ${item.color}`);
            
            const inventoryRef = collection(db, 'inventory');
            const q = query(
              inventoryRef,
              where("manufacturer", "==", item.manufacturer),
              where("model", "==", item.model),
              where("ram", "==", item.ram),
              where("storage", "==", item.storage),
              where("color", "==", item.color),
              limit(1)
            );
            
            console.log('🔍 Query constraints:', {
              manufacturer: item.manufacturer,
              model: item.model,
              ram: item.ram,
              storage: item.storage,
              color: item.color
            });
            
            const snapshot = await getDocs(q);
            console.log(`📋 Query results: ${snapshot.size} documents found`);
            
            if (!snapshot.empty) {
              const existingItem = snapshot.docs[0].data();
              console.log('✅ Found inventory item:', existingItem);
              if (existingItem.barcode) {
                barcode = existingItem.barcode;
                console.log(`✅ Found barcode: "${barcode}"`);
              } else {
                console.log('⚠️ Inventory item has no barcode');
              }
            } else {
              console.log('❌ No matching inventory item found');
            }
          } catch (error) {
            console.error('❌ Error fetching barcode:', error);
          }
        } else if (!barcode) {
          console.log('⚠️ Missing required fields for barcode fetch:', {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            color: item.color
          });
        }
        
        // Store the barcode for this group
        newGroupBarcodes[groupIndex] = barcode;
        console.log(`💾 Storing barcode for group ${groupIndex}: "${barcode}"`);
        
        // Create rows for each quantity
        for (let i = 0; i < item.quantity; i++) {
          rows.push({
            id: rowId++,
            groupId: groupIndex,
            ...item,
            barcode: barcode, // Use the fetched or existing barcode
            // Individual item fields
            imei1: '',
            imei2: '',
            serialNumber: '',
            location: '',
            status: 'On-Hand'
          });
        }
      }
      
      console.log('📦 Final newGroupBarcodes:', newGroupBarcodes);
      console.log('📦 Final rows:', rows);
      
      // Update states with the processed data
      setGroupBarcodes(newGroupBarcodes);
      setReceivingItems(rows);
    };
    
    // Call the async function
    initializeItemsWithBarcodes();
  }, [procurementData.id, procurementData.deliveryStatus, procurementData.isReceived, procurementData.items, procurementData.supplierId, procurementData.supplierName]); // Include all dependencies used inside
  
  // Group items by product model
  const groupedItems = useMemo(() => {
    console.log('🔄 Recalculating groupedItems');
    console.log('Current receivingItems:', receivingItems);
    console.log('Current groupBarcodes:', groupBarcodes);
    
    const groups = receivingItems.reduce((groups, item) => {
      const groupKey = item.groupId;
      if (!groups[groupKey]) {
        const barcode = groupBarcodes[groupKey] || item.barcode || '';
        console.log(`Creating group ${groupKey} with barcode: "${barcode}"`);
        groups[groupKey] = {
          product: {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            color: item.color,
            dealersPrice: item.dealersPrice,
            retailPrice: item.retailPrice,
            barcode: barcode
          },
          items: []
        };
      }
      groups[groupKey].items.push(item);
      return groups;
    }, {});
    
    console.log('📦 Final groupedItems:', groups);
    return groups;
  }, [receivingItems, groupBarcodes]); // Added groupBarcodes as dependency
{/* Part 2 End - State and Data Setup */}

{/* Part 3 Start - Handler Functions */}
  // Handle individual field changes
  const handleItemChange = (itemId, field, value) => {
    setReceivingItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
    
    // Clear error for this field when user types
    if (fieldErrors[`${field}-${itemId}`]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${field}-${itemId}`];
        return newErrors;
      });
    }
  };

  // Handle bulk location set
  const handleBulkLocationSet = () => {
    if (!bulkLocation.trim()) return;
    
    setReceivingItems(prevItems =>
      prevItems.map(item => ({ ...item, location: bulkLocation }))
    );
    
    // Clear all location errors
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith('location-')) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  // Handle barcode change for a group
  const handleGroupBarcodeChange = (groupId, value) => {
    setGroupBarcodes(prev => ({
      ...prev,
      [groupId]: value.toUpperCase()
    }));
    
    // Update all items in the group with the new barcode
    setReceivingItems(prevItems =>
      prevItems.map(item =>
        item.groupId === groupId ? { ...item, barcode: value.toUpperCase() } : item
      )
    );
    
    // Clear barcode errors for this group
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`barcode-group-${groupId}`];
      return newErrors;
    });
  };

  // Toggle barcode edit mode
  const toggleBarcodeEditMode = (groupId) => {
    setBarcodeEditMode(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Handle Enter key navigation
  const handleKeyDown = (e, groupKey, itemIndex, fieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const group = groupedItems[groupKey];
      const totalItemsInGroup = group.items.length;
      
      // Define field order for navigation
      const fieldOrder = ['imei1', 'imei2', 'serialNumber'];
      const currentFieldIndex = fieldOrder.indexOf(fieldName);
      
      let nextField = null;
      let nextItemIndex = itemIndex;
      
      // Determine next field and item
      if (currentFieldIndex < fieldOrder.length - 1) {
        // Move to next field in same row
        nextField = fieldOrder[currentFieldIndex + 1];
      } else if (itemIndex < totalItemsInGroup - 1) {
        // Move to first field of next row
        nextField = fieldOrder[0];
        nextItemIndex = itemIndex + 1;
      }
      
      // Focus on the next input if found
      if (nextField) {
        const nextInput = document.querySelector(
          `input[data-group="${groupKey}"][data-item="${nextItemIndex}"][data-field="${nextField}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };
  
  // Check for duplicate serial numbers
  const checkDuplicateSerialNumbers = async (serialNumber) => {
    if (!serialNumber) return { isValid: true };
    
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, where("serialNumber", "==", serialNumber));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return {
          isValid: false,
          error: 'This serial number already exists in inventory'
        };
      }
      
      return { isValid: true };
    } catch (error) {
      console.error("Error checking serial number:", error);
      return {
        isValid: false,
        error: 'Error checking serial number'
      };
    }
  };
  
  // Validate form
  const validateForm = async () => {
    const errors = {};
    let hasErrors = false;
    
    // Check reference field
    if (!deliveryReference.trim()) {
      errors['reference'] = 'Delivery reference is required';
      hasErrors = true;
    }
    
    // Check each item
    for (const item of receivingItems) {
      // CHANGED: Check IMEI1 OR Serial Number (at least one is required)
      if (!item.imei1 && !item.serialNumber) {
        errors[`imei1-${item.id}`] = 'Either IMEI1 or Serial Number is required';
        hasErrors = true;
      } else if (item.imei1 && item.imei1.length !== 15) {
        // CHANGED: Only validate IMEI1 length if it's provided
        errors[`imei1-${item.id}`] = 'IMEI1 must be exactly 15 digits';
        hasErrors = true;
      }
      
      // Check IMEI2
      if (item.imei2 && item.imei2.length !== 15) {
        errors[`imei2-${item.id}`] = 'IMEI2 must be exactly 15 digits';
        hasErrors = true;
      }
      
      // Check location
      if (!item.location) {
        errors[`location-${item.id}`] = 'Location is required';
        hasErrors = true;
      }
      
      // Check barcode for group
      const groupBarcode = groupBarcodes[item.groupId];
      if (!groupBarcode) {
        errors[`barcode-group-${item.groupId}`] = 'Barcode is required';
        hasErrors = true;
      }
    }
    
    // Check for duplicate IMEIs and serial numbers
    if (!hasErrors) {
      for (const item of receivingItems) {
        // CHANGED: Only check IMEI duplicates if IMEI1 is provided
        if (item.imei1) {
          const imeiCheck = await checkDuplicateImeis(item.imei1, item.imei2);
          if (!imeiCheck.isValid) {
            if (imeiCheck.imei1Error) {
              errors[`imei1-${item.id}`] = imeiCheck.imei1Error;
              hasErrors = true;
            }
            if (imeiCheck.imei2Error) {
              errors[`imei2-${item.id}`] = imeiCheck.imei2Error;
              hasErrors = true;
            }
          }
        }
        
        // Check serial number duplicates
        if (item.serialNumber) {
          const serialCheck = await checkDuplicateSerialNumbers(item.serialNumber);
          if (!serialCheck.isValid) {
            errors[`serialNumber-${item.id}`] = serialCheck.error;
            hasErrors = true;
          }
        }
      }
    }
    
    return { errors, hasErrors };
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Start validation
    setIsValidating(true);
    setFieldErrors({});
    
    // Validate form
    const { errors, hasErrors } = await validateForm();
    
    if (hasErrors) {
      setFieldErrors(errors);
      setIsValidating(false);
      // Scroll to first error
      const firstErrorField = document.querySelector('.border-red-500');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
      return;
    }
    
    // If validation passed, show confirmation dialog
    setIsValidating(false);
    setShowConfirmDialog(true);
  };

  // Confirm and save
  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    setIsSaving(true);
    setSaveProgress('Preparing to save items...');

    try {
      const batch = writeBatch(db);
      let itemsSaved = 0;

      // Debug log to check supplier data
      console.log('🔍 Procurement supplier data:', {
        supplierName: procurementData.supplierName,
        supplierId: procurementData.supplierId
      });

      // 1. Add items to inventory collection
      setSaveProgress('Adding items to inventory...');
      
      for (const item of receivingItems) {
        const inventoryData = {
          manufacturer: item.manufacturer,
          model: item.model,
          ram: item.ram,
          storage: item.storage,
          color: item.color,
          dealersPrice: item.dealersPrice,
          retailPrice: item.retailPrice,
          imei1: item.imei1 || '', // CHANGED: Allow empty IMEI1
          imei2: item.imei2 || '',
          serialNumber: item.serialNumber || '',
          barcode: groupBarcodes[item.groupId] || '',
          location: item.location,
          status: item.status,
          // FIX: Save supplierId in supplier field to match inventory edit form expectation
          supplier: procurementData.supplierId || '',  // The edit form expects supplier ID here
          supplierId: procurementData.supplierId || '',
          // FIX: Add procurementId to link items to specific procurement
          procurementId: procurementData.id || '',
          // FIX: Convert date format to M/D/YYYY to match inventory edit form
          lastUpdated: new Date(dateDelivered).toLocaleDateString('en-US'),
          dateAdded: new Date(dateDelivered).toLocaleDateString('en-US')
        };

        // Debug log first item to verify supplier is being saved
        if (itemsSaved === 0) {
          console.log('📦 First inventory item being saved:', {
            supplier: inventoryData.supplier,
            supplierId: inventoryData.supplierId
          });
        }

        const docRef = doc(collection(db, 'inventory'));
        batch.set(docRef, inventoryData);
        itemsSaved++;
      }

      // 2. Update inventory_counts collection
      setSaveProgress('Updating inventory counts...');
      
      // Group items by product configuration for count updates
      const countUpdates = {};
      receivingItems.forEach(item => {
        const inventoryId = createInventoryId(
          item.manufacturer,
          item.model,
          item.ram,
          item.storage,
          item.color
        );
        
        if (!countUpdates[inventoryId]) {
          countUpdates[inventoryId] = {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            color: item.color,
            counts: {
              'On-Hand': 0,
              'On-Display': 0,
              Sold: 0,
              Reserved: 0,
              Defective: 0
            }
          };
        }
        
        countUpdates[inventoryId].counts[item.status]++;
      });

      // Update counts using transactions for each product configuration
      for (const [inventoryId, data] of Object.entries(countUpdates)) {
        await runTransaction(db, async (transaction) => {
          const inventoryRef = doc(db, 'inventory_counts', inventoryId);
          const inventoryDoc = await transaction.get(inventoryRef);
          
          if (!inventoryDoc.exists()) {
            // Create new inventory count document
            transaction.set(inventoryRef, {
              manufacturer: data.manufacturer,
              model: data.model,
              ram: data.ram,
              storage: data.storage,
              color: data.color,
              total: data.counts['On-Hand'] + data.counts['On-Display'] + data.counts.Sold + 
                     data.counts.Reserved + data.counts.Defective,
              onHand: data.counts['On-Hand'],
              onDisplay: data.counts['On-Display'],
              sold: data.counts.Sold,
              reserved: data.counts.Reserved,
              defective: data.counts.Defective,
              lastUpdated: getCurrentDate()
            });
          } else {
            // Update existing counts
            transaction.update(inventoryRef, {
              total: increment(data.counts['On-Hand'] + data.counts['On-Display'] + 
                            data.counts.Sold + data.counts.Reserved + data.counts.Defective),
              onHand: increment(data.counts['On-Hand']),
              onDisplay: increment(data.counts['On-Display']),
              sold: increment(data.counts.Sold),
              reserved: increment(data.counts.Reserved),
              defective: increment(data.counts.Defective),
              lastUpdated: getCurrentDate()
            });
          }
        });
      }

      // 3. Update procurement record
      setSaveProgress('Updating procurement record...');
      const procurementRef = doc(db, 'procurements', procurementData.id);
      batch.update(procurementRef, {
        deliveryStatus: 'delivered',
        dateDelivered: dateDelivered,
        deliveryReference: deliveryReference
      });

      // 4. Create ledger entry for delivery
      if (procurementData.supplierId) {
        setSaveProgress('Creating delivery ledger entry...');
        const ledgerData = {
          supplierId: procurementData.supplierId,
          supplierName: procurementData.supplierName,
          procurementId: procurementData.id,
          entryType: 'delivery',
          description: `Stock received - ${receivingItems.length} units`,
          reference: deliveryReference,
          entryDate: dateDelivered,
          createdAt: new Date().toISOString(),
          isDeleted: false
        };

        const ledgerRef = doc(collection(db, 'supplier_ledger'));
        batch.set(ledgerRef, ledgerData);
      }

      // Commit all batch operations
      setSaveProgress('Finalizing save...');
      await batch.commit();

      // Show success
      setSaveProgress(`Successfully added ${itemsSaved} items to inventory!`);
      setSaveSuccess(true);

      // Wait a moment then close
      setTimeout(() => {
        clearProcurementForReceiving();
        setActiveComponent('procurementmgmt');
      }, 2000);

    } catch (error) {
      console.error('Error saving items:', error);
      alert(`Error saving items: ${error.message}`);
      setIsSaving(false);
      setSaveProgress('');
    }
  };

  // Handle cancel - return to procurement management
  const handleCancel = () => {
    console.log('Cancelling stock receiving');
    clearProcurementForReceiving();
    setActiveComponent('procurementmgmt');
  };

  // Format price with commas
  const formatPrice = (value) => {
    if (!value) return '0.00';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
{/* Part 3 End - Handler Functions */}

{/* Part 4 Start - Form Header */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Stock Receiving {isViewOnly && '(View Only)'}
            </CardTitle>
            
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center text-sm"
              title="Cancel and return to procurement management"
            >
              <X className="h-4 w-4 mr-1" />
              {isViewOnly ? 'Close' : 'Cancel'}
            </button>
          </div>
        </CardHeader>

        <CardContent className="bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Procurement Info Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex flex-wrap gap-4">
                {/* Date Delivered */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[150px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Date Delivered:
                  </label>
                  <input
                    type="date"
                    value={dateDelivered}
                    onChange={(e) => setDateDelivered(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                    required
                    disabled={isViewOnly}
                  />
                </div>

                {/* Reference - Now Editable and Repositioned */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[160px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Reference:
                  </label>
                  <div>
                    <input
                      type="text"
                      value={deliveryReference}
                      onChange={(e) => {
                        setDeliveryReference(e.target.value);
                        // Clear reference error when user types
                        if (fieldErrors['reference']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['reference'];
                            return newErrors;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded text-sm ${fieldErrors['reference'] ? 'border-red-500' : ''}`}
                      placeholder="Delivery Receipt #"
                      disabled={isViewOnly}
                    />
                    {fieldErrors['reference'] && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors['reference']}</p>
                    )}
                  </div>
                </div>

                {/* Bulk Location */}
                <div className="space-y-2 flex-1 min-w-[240px] max-w-[320px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Set all locations to:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bulkLocation}
                      onChange={(e) => setBulkLocation(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded text-sm"
                      placeholder="e.g. Stockroom A"
                      disabled={isViewOnly}
                    />
                    <button
                      type="button"
                      onClick={handleBulkLocationSet}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                      disabled={isViewOnly}
                    >
                      Apply to All
                    </button>
                  </div>
                </div>

                {/* Supplier */}
                <div className="space-y-2 flex-1 min-w-[180px] max-w-[220px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Supplier:
                  </label>
                  <input
                    type="text"
                    value={procurementData.supplierName}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Purchase Date */}
                <div className="space-y-2 flex-1 min-w-[100px] max-w-[130px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Purchase Date:
                  </label>
                  <input
                    type="text"
                    value={procurementData.purchaseDate}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Procurement Reference */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[150px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Procurement Ref:
                  </label>
                  <input
                    type="text"
                    value={procurementData.reference || procurementData.id}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>
              </div>
            </div>
{/* Part 4 End - Form Header */}

{/* Part 5 Start - Items Table */}
            {/* Receiving Items Table */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                {isViewOnly ? 'Received Items' : 'Items to Receive'}
              </h3>
              
              {/* Items grouped by product */}
              {Object.entries(groupedItems).map(([groupKey, group]) => (
                <div key={groupKey} className="border rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-x-6">
                      <span className="text-base font-semibold">{group.product.manufacturer}</span>
                      <span className="text-base font-semibold">•</span>
                      <span className="text-base font-semibold">({group.items.length} {group.items.length === 1 ? 'pc' : 'pcs'})</span>
                      <span className="text-base font-semibold">•</span>
                      <span className="text-base font-semibold">{group.product.model}</span>
                      <span className="text-base font-semibold">•</span>
                      <span className="text-base font-semibold">{group.product.ram} / {group.product.storage}</span>
                      <span className="text-base font-semibold">•</span>
                      <span className="text-base font-semibold">{group.product.color}</span>
                      <span className="text-base font-semibold">•</span>
                      <span className="text-base font-semibold">Retail Price: ₱{formatPrice(group.product.retailPrice)}</span>
                    </div>
                    
                    {/* Barcode Edit - Button First, Field Second */}
                    <div className="flex items-center gap-2">
                      {barcodeEditMode[groupKey] ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleBarcodeEditMode(groupKey)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            disabled={isViewOnly}
                          >
                            Save
                          </button>
                          <input
                            type="text"
                            value={groupBarcodes[groupKey] || ''}
                            onChange={(e) => handleGroupBarcodeChange(groupKey, e.target.value)}
                            className={`px-2 py-1 border rounded text-sm w-32 ${fieldErrors[`barcode-group-${groupKey}`] ? 'border-red-500' : ''}`}
                            placeholder="Enter barcode"
                            disabled={isViewOnly}
                          />
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleBarcodeEditMode(groupKey)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            disabled={isViewOnly}
                          >
                            Barcode
                          </button>
                          <div className="flex flex-col">
                            <div className={`px-2 py-1 border rounded text-sm font-mono min-w-[8rem] ${
                              !groupBarcodes[groupKey] 
                                ? 'border-red-500 text-red-600 bg-red-50' 
                                : 'border-gray-300 bg-gray-100'
                            }`}>
                              {groupBarcodes[groupKey] || 'NO BARCODE'}
                            </div>
                            {fieldErrors[`barcode-group-${groupKey}`] && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors[`barcode-group-${groupKey}`]}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-y">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">#</th>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">IMEI 1</th>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">IMEI 2</th>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Serial Number</th>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Location</th>
                          <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, index) => (
                          <tr key={item.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                            <td className="px-3 py-3 text-sm">{index + 1}</td>
                            <td className="px-3 py-3">
                              <div>
                                <input
                                  type="text"
                                  value={item.imei1}
                                  onChange={(e) => handleItemChange(item.id, 'imei1', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'imei1')}
                                  data-group={groupKey}
                                  data-item={index}
                                  data-field="imei1"
                                  className={`w-full px-2 py-1.5 border rounded text-sm ${fieldErrors[`imei1-${item.id}`] ? 'border-red-500' : ''}`}
                                  placeholder="15-digit IMEI"
                                  maxLength={15}                                  
                                  disabled={isViewOnly}
                                />
                                {fieldErrors[`imei1-${item.id}`] && (
                                  <p className="text-red-500 text-xs mt-1">{fieldErrors[`imei1-${item.id}`]}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>
                                <input
                                  type="text"
                                  value={item.imei2}
                                  onChange={(e) => handleItemChange(item.id, 'imei2', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'imei2')}
                                  data-group={groupKey}
                                  data-item={index}
                                  data-field="imei2"
                                  className={`w-full px-2 py-1.5 border rounded text-sm ${fieldErrors[`imei2-${item.id}`] ? 'border-red-500' : ''}`}
                                  placeholder="Optional"
                                  maxLength={15}
                                  disabled={isViewOnly}
                                />
                                {fieldErrors[`imei2-${item.id}`] && (
                                  <p className="text-red-500 text-xs mt-1">{fieldErrors[`imei2-${item.id}`]}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>
                                <input
                                  type="text"
                                  value={item.serialNumber}
                                  onChange={(e) => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'serialNumber')}
                                  data-group={groupKey}
                                  data-item={index}
                                  data-field="serialNumber"
                                  className={`w-full px-2 py-1.5 border rounded text-sm ${fieldErrors[`serialNumber-${item.id}`] ? 'border-red-500' : ''}`}
                                  placeholder="Optional"
                                  disabled={isViewOnly}
                                />
                                {fieldErrors[`serialNumber-${item.id}`] && (
                                  <p className="text-red-500 text-xs mt-1">{fieldErrors[`serialNumber-${item.id}`]}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
                                  className={`w-full px-2 py-1.5 border rounded text-sm ${fieldErrors[`location-${item.id}`] ? 'border-red-500' : ''}`}
                                  placeholder="Required"
                                  required
                                  disabled={isViewOnly}
                                />
                                {fieldErrors[`location-${item.id}`] && (
                                  <p className="text-red-500 text-xs mt-1">{fieldErrors[`location-${item.id}`]}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={item.status}
                                onChange={(e) => handleItemChange(item.id, 'status', e.target.value)}
                                className={`w-full px-2 py-1.5 border rounded text-sm ${
                                  item.status === 'On-Hand' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  item.status === 'On-Display' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                  item.status === 'Sold' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                  item.status === 'Reserved' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                  item.status === 'Defective' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-white'
                                }`}
                                required
                                disabled={isViewOnly}
                              >
                                <option value="On-Hand">On-Hand</option>
                                <option value="On-Display">On-Display</option>
                                <option value="Sold">Sold</option>
                                <option value="Reserved">Reserved</option>
                                <option value="Defective">Defective</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
{/* Part 5 End - Items Table */}

{/* Part 6 Start - Form Submission and Export */}
            {/* Submit Buttons */}
            {!isViewOnly && (
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isValidating || isSaving}
                  className={`px-6 py-2.5 rounded text-sm font-medium ${
                    isValidating || isSaving
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                  }`}
                >
                  {isValidating ? 'Validating...' : `Receive Items (${receivingItems.length} units)`}
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Stock Receiving
            </h3>
            <p className="text-gray-600 mb-6">
              You are about to add {receivingItems.length} items to inventory. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              {!saveSuccess ? (
                <>
                  <Loader className="h-8 w-8 animate-spin text-[rgb(52,69,157)] mb-4" />
                  <p className="text-gray-700 font-medium">{saveProgress}</p>
                </>
              ) : (
                <>
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-gray-700 font-medium">{saveProgress}</p>
                  <p className="text-sm text-gray-500 mt-2">Returning to procurement management...</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockReceivingForm;
{/* Part 6 End - Form Submission and Export */}