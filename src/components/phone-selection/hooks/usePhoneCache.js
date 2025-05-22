import { useState, useCallback } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { formatNumberWithCommas, getCurrentDate } from '../utils/phoneUtils';

export const usePhoneCache = () => {
  const [priceCache, setPriceCache] = useState({});
  
  // Load price cache from existing inventory
  const loadPriceCacheFromInventory = useCallback(async () => {
    try {
      const newPriceCache = {};
     
      // First load price configurations (both base and color-specific)
      const configsRef = collection(db, 'price_configurations');
      const configsSnapshot = await getDocs(configsRef);
     
      configsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.manufacturer && data.model && data.ram && data.storage) {
          let cacheKey;
         
          if (data.color) {
            // Color-specific price
            cacheKey = `${data.manufacturer}_${data.model}_${data.ram}_${data.storage}_${data.color}`;
          } else {
            // Base price
            cacheKey = `${data.manufacturer}_${data.model}_${data.ram}_${data.storage}`;
          }
         
          newPriceCache[cacheKey] = {
            dealersPrice: formatNumberWithCommas(data.dealersPrice.toString()),
            retailPrice: formatNumberWithCommas(data.retailPrice.toString()),
            lastUpdated: data.lastUpdated
          };
        }
      });
     
      // Then load barcodes from inventory
      const inventoryRef = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryRef);
     
      inventorySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.manufacturer && data.model && data.ram && data.storage && data.color && data.barcode) {
          const barcodeKey = `${data.manufacturer}_${data.model}_${data.ram}_${data.storage}_${data.color}`;
         
          // Update existing entry or create new one
          newPriceCache[barcodeKey] = {
            ...newPriceCache[barcodeKey] || {},
            barcode: data.barcode,
            // Only update lastUpdated if this is a new entry
            lastUpdated: newPriceCache[barcodeKey]?.lastUpdated || data.lastUpdated
          };
        }
      });
     
      console.log("Price cache loaded:", Object.keys(newPriceCache).length, "entries");
      setPriceCache(newPriceCache);
    } catch (error) {
      console.error("Error loading price cache:", error);
    }
  }, [setPriceCache]);
  
  // Helper function to save/update price configurations
  const updatePriceConfiguration = async (manufacturer, model, ram, storage, dealersPrice, retailPrice, color = null) => {
    try {
      // Create a unique ID - with or without color
      let configId;
      if (color) {
        // Color-specific pricing
        configId = `${manufacturer}_${model}_${ram}_${storage}_${color}`.replace(/\s+/g, '_').toLowerCase();
      } else {
        // Base pricing for this configuration
        configId = `${manufacturer}_${model}_${ram}_${storage}`.replace(/\s+/g, '_').toLowerCase();
      }
      
      // Remove commas and convert to number
      const dPrice = parseFloat(dealersPrice.toString().replace(/,/g, '')) || 0;
      const rPrice = parseFloat(retailPrice.toString().replace(/,/g, '')) || 0;
      
      await setDoc(doc(db, 'price_configurations', configId), {
        manufacturer,
        model,
        ram,
        storage,
        color, // null for base configuration
        dealersPrice: dPrice,
        retailPrice: rPrice,
        lastUpdated: getCurrentDate()
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error("Error updating price configuration:", error);
      return false;
    }
  };

  return {
    priceCache,
    setPriceCache,
    loadPriceCacheFromInventory,
    updatePriceConfiguration
  };
};

export default usePhoneCache;