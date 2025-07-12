{/* Part 1 Start - Imports */}
import { 
    doc, 
    addDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    increment,
    updateDoc 
  } from 'firebase/firestore';
  import { db } from '../../../firebase/config';
  import { createInventoryId, getCurrentDate } from '../utils/phoneUtils';
{/* Part 1 End - Imports */}
      
  {/* Part 2 Start - Update Inventory Counts Function */}
  // Update inventory counts
  export const updateInventory = async (data, isNewPhone = true) => {
    try {
      const { manufacturer, model, ram, storage, color, status } = data;
      
      // Create a unique ID for this inventory item
      const inventoryId = createInventoryId(manufacturer, model, ram, storage, color);
      
      // Reference to the inventory doc
      const inventoryRef = doc(db, 'inventory_counts', inventoryId);
      
      // Run as a transaction to ensure data consistency
      await runTransaction(db, async (transaction) => {
        const inventoryDoc = await transaction.get(inventoryRef);
        
        if (!inventoryDoc.exists()) {
          // This is a new inventory item
          transaction.set(inventoryRef, {
            manufacturer,
            model,
            ram,
            storage,
            color,
            total: 1,
            onHand: status === 'On-Hand' ? 1 : 0,
            onDisplay: status === 'On-Display' ? 1 : 0,
            sold: status === 'Sold' ? 1 : 0,
            reserved: status === 'Reserved' ? 1 : 0,
            defective: status === 'Defective' ? 1 : 0,
            lastUpdated: getCurrentDate()
          });
        } else {
          // Existing inventory item
          const inventoryData = inventoryDoc.data();
          
          // If it's a new phone, increment total and the appropriate status count
          if (isNewPhone) {
            transaction.update(inventoryRef, {
              total: increment(1),
              onHand: status === 'On-Hand' ? increment(1) : inventoryData.onHand,
              onDisplay: status === 'On-Display' ? increment(1) : inventoryData.onDisplay || 0,
              sold: status === 'Sold' ? increment(1) : inventoryData.sold,
              reserved: status === 'Reserved' ? increment(1) : inventoryData.reserved,
              defective: status === 'Defective' ? increment(1) : inventoryData.defective,
              lastUpdated: getCurrentDate()
            });
          } 
          // If it's a status change, we'll handle it separately
        }
      });
      
      return true;
    } catch (error) {
      console.error("Error updating inventory:", error);
      return false;
    }
  };
  {/* Part 2 End - Update Inventory Counts Function */}
  
  {/* Part 3 Start - Add Phone to Inventory Function */}
  // Add a new phone to the inventory
  export const addPhoneToInventory = async (phoneData) => {
    try {
      // First add the phone to the inventory tracking system
      const inventoryUpdated = await updateInventory(phoneData, true);
      
      if (!inventoryUpdated) {
        throw new Error("Failed to update inventory counts");
      }
      
      // Add document to 'inventory' collection for the specific phone
      const docRef = await addDoc(collection(db, 'inventory'), phoneData);
      console.log("Document written with ID: ", docRef.id);
      
      return {
        success: true,
        docId: docRef.id
      };
    } catch (error) {
      console.error("Error adding phone to inventory:", error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  {/* Part 3 End - Add Phone to Inventory Function */}

 {/* Part 4 Start - Update Phone in Inventory Function */}
 // Update an existing phone in the inventory
export const updatePhoneInInventory = async (itemId, phoneData, originalData) => {
  try {
    console.log('Updating phone with data:', phoneData); // ADD THIS LINE
    // First, check if the status changed
    const statusChanged = originalData.status !== phoneData.status;
    
    if (statusChanged) {
      // Update inventory counts for status change
      const oldInventoryId = createInventoryId(
        originalData.manufacturer,
        originalData.model,
        originalData.ram,
        originalData.storage,
        originalData.color
      );
      
      const newInventoryId = createInventoryId(
        phoneData.manufacturer,
        phoneData.model,
        phoneData.ram,
        phoneData.storage,
        phoneData.color
      );
      
      // Run transaction to update counts
      await runTransaction(db, async (transaction) => {
        const oldInventoryRef = doc(db, 'inventory_counts', oldInventoryId);
        const newInventoryRef = doc(db, 'inventory_counts', newInventoryId);
        
        // Get both documents
        const oldInventoryDoc = await transaction.get(oldInventoryRef);
        const newInventoryDoc = await transaction.get(newInventoryRef);
        
        if (oldInventoryDoc.exists()) {
          // Decrement old status count
          const decrementField = 
            originalData.status === 'On-Hand' ? 'onHand' : 
            originalData.status === 'On-Display' ? 'onDisplay' : 
            originalData.status === 'Sold' ? 'sold' : 
            originalData.status === 'Reserved' ? 'reserved' : 
            'defective';
          
          transaction.update(oldInventoryRef, {
            [decrementField]: increment(-1),
            lastUpdated: getCurrentDate()
          });
        }
        
        if (newInventoryDoc.exists()) {
          // Increment new status count
          const incrementField = 
            phoneData.status === 'On-Hand' ? 'onHand' : 
            phoneData.status === 'On-Display' ? 'onDisplay' : 
            phoneData.status === 'Sold' ? 'sold' : 
            phoneData.status === 'Reserved' ? 'reserved' : 
            'defective';
          
          transaction.update(newInventoryRef, {
            [incrementField]: increment(1),
            lastUpdated: getCurrentDate()
          });
        }
      });
    }
    
    // Update the inventory document
    const itemRef = doc(db, 'inventory', itemId);
    await updateDoc(itemRef, phoneData);

    console.log('Phone updated successfully with ID:', itemId); // ADD THIS LINE
    
    return {
      success: true,
      docId: itemId
    };
  } catch (error) {
    console.error("Error updating phone in inventory:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
{/* Part 4 End - Update Phone in Inventory Function */}

{/* Part 5 Start - Check Duplicate IMEIs Function */}
// Check for duplicate IMEIs in the database
export const checkDuplicateImeis = async (imei1, imei2, excludeItemId = null) => {
  try {
    // Only check if IMEIs are not empty
    let hasError = false;
    let imei1Error = '';
    let imei2Error = '';
    
    // First check if IMEI1 and IMEI2 are the same
    if (imei1 && imei2 && imei1 === imei2) {
      imei2Error = 'IMEI 1 and IMEI 2 cannot be the same';
      hasError = true;
    }
    
    // Only query Firebase if necessary and if there are no other errors
    if (!hasError && imei1) {
      const imei1Query = query(
        collection(db, 'inventory'), 
        where("imei1", "==", imei1)
      );
      const imei1Snapshot = await getDocs(imei1Query);
      
      // Check if found document is not the current item being edited
      const foundDocs = imei1Snapshot.docs.filter(doc => doc.id !== excludeItemId);
      if (foundDocs.length > 0) {
        imei1Error = 'This IMEI already exists in inventory';
        hasError = true;
      }
    }
    
    // Only check IMEI2 if it's not empty and there are no other errors
    if (!hasError && imei2) {
      const imei2Query = query(
        collection(db, 'inventory'), 
        where("imei2", "==", imei2)
      );
      const imei2Snapshot = await getDocs(imei2Query);
      
      // Check if found document is not the current item being edited
      const foundDocs = imei2Snapshot.docs.filter(doc => doc.id !== excludeItemId);
      if (foundDocs.length > 0) {
        imei2Error = 'This IMEI already exists in inventory';
        hasError = true;
      }
    }
    
    return {
      isValid: !hasError,
      imei1Error,
      imei2Error
    };
  } catch (error) {
    console.error("Error checking IMEIs:", error);
    return {
      isValid: false,
      imei1Error: 'Error checking IMEI',
      imei2Error: 'Error checking IMEI'
    };
  }
};
{/* Part 5 End - Check Duplicate IMEIs Function */}