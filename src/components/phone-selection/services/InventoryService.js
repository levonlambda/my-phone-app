import { 
    doc, 
    addDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    increment 
  } from 'firebase/firestore';
  import { db } from '../../../firebase/config';
  import { createInventoryId, getCurrentDate } from '../utils/phoneUtils';
  
  // Check for duplicate IMEIs in the database
  export const checkDuplicateImeis = async (imei1, imei2) => {
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
        
        if (!imei1Snapshot.empty) {
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
        
        if (!imei2Snapshot.empty) {
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