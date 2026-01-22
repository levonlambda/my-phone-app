/* ========== PHONE IMAGE SERVICE ========== */
/* This service handles image uploads to Firebase Storage and phone_images collection */
/* IMPORTANT: This service ONLY interacts with phone_images collection and Firebase Storage */
/* The phones collection is READ-ONLY - we only fetch data from it */

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../firebase/config';

/* ========== UTILITY FUNCTIONS ========== */

/**
 * Sanitize color name for storage path
 * Converts to lowercase and replaces spaces with underscores
 */
const sanitizeColorName = (colorName) => {
  return colorName.toLowerCase().replace(/ /g, '_');
};

/**
 * Generate storage file name
 */
const getStorageFileName = (colorName, isHighRes) => {
  const sanitizedColor = sanitizeColorName(colorName);
  const resolution = isHighRes ? 'high' : 'low';
  return `${sanitizedColor}_${resolution}.png`;
};

/**
 * Generate full storage path
 */
const getStoragePath = (phoneDocId, colorName, isHighRes) => {
  const fileName = getStorageFileName(colorName, isHighRes);
  return `phone_images/${phoneDocId}/${fileName}`;
};

/* ========== READ OPERATIONS (phones collection - READ ONLY) ========== */

/**
 * Fetch all unique manufacturers from phones collection
 * READ-ONLY operation on phones collection
 */
export const fetchManufacturers = async () => {
  try {
    const phonesRef = collection(db, 'phones');
    const snapshot = await getDocs(phonesRef);
    
    const uniqueManufacturers = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.manufacturer) {
        uniqueManufacturers.add(data.manufacturer);
      }
    });
    
    return {
      success: true,
      data: Array.from(uniqueManufacturers).sort()
    };
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fetch models for a specific manufacturer from phones collection
 * READ-ONLY operation on phones collection
 * Returns array of objects with model name and docId
 */
export const fetchModelsForManufacturer = async (manufacturer) => {
  try {
    const phonesRef = collection(db, 'phones');
    const q = query(phonesRef, where('manufacturer', '==', manufacturer));
    const snapshot = await getDocs(q);
    
    const models = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.model) {
        models.push({
          model: data.model,
          docId: doc.id,
          colors: Array.isArray(data.colors) ? data.colors : []
        });
      }
    });
    
    // Sort by model name
    models.sort((a, b) => a.model.localeCompare(b.model));
    
    return {
      success: true,
      data: models
    };
  } catch (error) {
    console.error('Error fetching models:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fetch phone details by document ID from phones collection
 * READ-ONLY operation on phones collection
 */
export const fetchPhoneById = async (phoneDocId) => {
  try {
    const phoneRef = doc(db, 'phones', phoneDocId);
    const phoneSnap = await getDoc(phoneRef);
    
    if (phoneSnap.exists()) {
      return {
        success: true,
        data: {
          docId: phoneSnap.id,
          ...phoneSnap.data()
        }
      };
    } else {
      return {
        success: false,
        error: 'Phone not found'
      };
    }
  } catch (error) {
    console.error('Error fetching phone:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/* ========== PHONE_IMAGES COLLECTION OPERATIONS ========== */

/**
 * Fetch phone images document from phone_images collection
 */
export const fetchPhoneImagesDocument = async (phoneDocId) => {
  try {
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        success: true,
        exists: true,
        data: docSnap.data()
      };
    } else {
      return {
        success: true,
        exists: false,
        data: null
      };
    }
  } catch (error) {
    console.error('Error fetching phone images document:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create or update phone_images document
 */
export const createOrUpdatePhoneImagesDocument = async (phoneDocId, manufacturer, model, colors) => {
  try {
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, check if we need to add new colors
      const existingData = docSnap.data();
      const existingColors = existingData.colors || {};
      
      // Add any new colors that don't exist
      let updated = false;
      const updatedColors = { ...existingColors };
      
      colors.forEach(color => {
        if (!updatedColors[color]) {
          updatedColors[color] = {
            highRes: '',
            lowRes: '',
            hexColor: ''
          };
          updated = true;
        }
      });
      
      if (updated) {
        await updateDoc(docRef, { colors: updatedColors });
      }
      
      return {
        success: true,
        message: updated ? 'Document updated with new colors' : 'Document already up to date'
      };
    } else {
      // Create new document
      const colorMap = {};
      colors.forEach(color => {
        colorMap[color] = {
          highRes: '',
          lowRes: '',
          hexColor: ''
        };
      });
      
      await setDoc(docRef, {
        phoneDocId: phoneDocId,
        manufacturer: manufacturer,
        model: model,
        colors: colorMap
      });
      
      return {
        success: true,
        message: 'Document created successfully'
      };
    }
  } catch (error) {
    console.error('Error creating/updating phone images document:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/* ========== STORAGE UPLOAD OPERATIONS ========== */

/**
 * Upload image to Firebase Storage
 */
export const uploadImageToStorage = async (phoneDocId, colorName, isHighRes, file) => {
  try {
    const storagePath = getStoragePath(phoneDocId, colorName, isHighRes);
    const storageRef = ref(storage, storagePath);
    
    // Upload the file
    await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadUrl = await getDownloadURL(storageRef);
    
    return {
      success: true,
      url: downloadUrl,
      path: storagePath
    };
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete image from Firebase Storage
 */
export const deleteImageFromStorage = async (phoneDocId, colorName, isHighRes) => {
  try {
    const storagePath = getStoragePath(phoneDocId, colorName, isHighRes);
    const storageRef = ref(storage, storagePath);
    
    await deleteObject(storageRef);
    
    return {
      success: true,
      message: 'Image deleted successfully'
    };
  } catch (error) {
    // If the file doesn't exist, that's okay
    if (error.code === 'storage/object-not-found') {
      return {
        success: true,
        message: 'Image did not exist'
      };
    }
    console.error('Error deleting image from storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/* ========== COMBINED OPERATIONS ========== */

/**
 * Upload image and update Firestore document
 * This is the main function to use for uploading images
 */
export const uploadPhoneImage = async (phoneDocId, colorName, isHighRes, file, manufacturer, model) => {
  try {
    // Step 1: Upload to Storage
    const uploadResult = await uploadImageToStorage(phoneDocId, colorName, isHighRes, file);
    
    if (!uploadResult.success) {
      return uploadResult;
    }
    
    // Step 2: Update Firestore
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    const fieldPath = isHighRes 
      ? `colors.${colorName}.highRes` 
      : `colors.${colorName}.lowRes`;
    
    if (docSnap.exists()) {
      // Update existing document
      await updateDoc(docRef, { [fieldPath]: uploadResult.url });
    } else {
      // Create new document
      await setDoc(docRef, {
        phoneDocId: phoneDocId,
        manufacturer: manufacturer,
        model: model,
        colors: {
          [colorName]: {
            highRes: isHighRes ? uploadResult.url : '',
            lowRes: isHighRes ? '' : uploadResult.url,
            hexColor: ''
          }
        }
      });
    }
    
    return {
      success: true,
      url: uploadResult.url,
      message: `${isHighRes ? 'High-res' : 'Low-res'} image uploaded successfully`
    };
  } catch (error) {
    console.error('Error in uploadPhoneImage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update hex color for a specific color variant
 */
export const updateHexColor = async (phoneDocId, colorName, hexColor, manufacturer, model) => {
  try {
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    const fieldPath = `colors.${colorName}.hexColor`;
    
    if (docSnap.exists()) {
      // Update existing document
      await updateDoc(docRef, { [fieldPath]: hexColor });
    } else {
      // Create new document with hex color
      await setDoc(docRef, {
        phoneDocId: phoneDocId,
        manufacturer: manufacturer,
        model: model,
        colors: {
          [colorName]: {
            highRes: '',
            lowRes: '',
            hexColor: hexColor
          }
        }
      });
    }
    
    return {
      success: true,
      message: 'Hex color updated successfully'
    };
  } catch (error) {
    console.error('Error updating hex color:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete image and update Firestore document
 */
export const deletePhoneImage = async (phoneDocId, colorName, isHighRes) => {
  try {
    // Step 1: Delete from Storage
    const deleteResult = await deleteImageFromStorage(phoneDocId, colorName, isHighRes);
    
    if (!deleteResult.success) {
      return deleteResult;
    }
    
    // Step 2: Update Firestore to remove URL
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const fieldPath = isHighRes 
        ? `colors.${colorName}.highRes` 
        : `colors.${colorName}.lowRes`;
      
      await updateDoc(docRef, { [fieldPath]: '' });
    }
    
    return {
      success: true,
      message: 'Image deleted successfully'
    };
  } catch (error) {
    console.error('Error in deletePhoneImage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Save all color data for a phone (batch save)
 */
export const saveAllColorData = async (phoneDocId, manufacturer, model, colorsData) => {
  try {
    const docRef = doc(db, 'phone_images', phoneDocId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update colors object
      await updateDoc(docRef, { colors: colorsData });
    } else {
      // Create new document
      await setDoc(docRef, {
        phoneDocId: phoneDocId,
        manufacturer: manufacturer,
        model: model,
        colors: colorsData
      });
    }
    
    return {
      success: true,
      message: 'All color data saved successfully'
    };
  } catch (error) {
    console.error('Error saving all color data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  fetchManufacturers,
  fetchModelsForManufacturer,
  fetchPhoneById,
  fetchPhoneImagesDocument,
  createOrUpdatePhoneImagesDocument,
  uploadImageToStorage,
  deleteImageFromStorage,
  uploadPhoneImage,
  updateHexColor,
  deletePhoneImage,
  saveAllColorData
};