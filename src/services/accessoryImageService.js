/* ========== ACCESSORY IMAGE SERVICE ========== */
/* Handles image uploads to Firebase Storage and photoUrl field updates on */
/* accessory_products documents. Mirrors the patterns of Phoneimageservice.js */
/* but uses a single-image-per-product model (accessories have no variants). */
/*
 * Storage path convention: accessory_images/{internalSku}/primary.png
 * The extension is fixed ('.png') so replace-on-upload overwrites automatically,
 * avoiding orphan files. Firebase Storage sets content-type from the File.type
 * property regardless of the stored filename.
 */

import {
  doc,
  getDoc,
  updateDoc,
  Timestamp
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
 * Fixed storage path for a product's primary image. See file header.
 */
const getStoragePath = (sku) => `accessory_images/${sku}/primary.png`;

/* ========== STORAGE OPERATIONS ========== */

/**
 * Upload an image file to Firebase Storage at the product's fixed image path.
 * Returns the download URL on success.
 */
export const uploadImageToStorage = async (sku, file) => {
  try {
    const storagePath = getStoragePath(sku);
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { success: true, url, path: storagePath };
  } catch (error) {
    console.error('Error uploading accessory image to storage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete the primary image object from Firebase Storage for a SKU.
 * Treats 'storage/object-not-found' as success.
 */
export const deleteImageFromStorage = async (sku) => {
  try {
    const storagePath = getStoragePath(sku);
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return { success: true, message: 'Image deleted from storage' };
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      return { success: true, message: 'Image did not exist' };
    }
    console.error('Error deleting accessory image from storage:', error);
    return { success: false, error: error.message };
  }
};

/* ========== COMBINED OPERATIONS ========== */

/**
 * Upload an image for an accessory product. Requires the product document
 * to already exist (storage path depends on the canonical SKU). Writes the
 * resulting download URL to photoUrl on accessory_products/{sku}.
 */
export const uploadAccessoryImage = async (sku, file) => {
  try {
    if (!sku) throw new Error('SKU is required');
    if (!file) throw new Error('File is required');

    // Ensure the product document exists first
    const productRef = doc(db, 'accessory_products', sku);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      return {
        success: false,
        error: 'Product must be saved before an image can be uploaded'
      };
    }

    const uploadResult = await uploadImageToStorage(sku, file);
    if (!uploadResult.success) {
      return uploadResult;
    }

    await updateDoc(productRef, {
      photoUrl: uploadResult.url,
      lastUpdated: Timestamp.now()
    });

    return {
      success: true,
      url: uploadResult.url,
      message: 'Image uploaded successfully'
    };
  } catch (error) {
    console.error('Error in uploadAccessoryImage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Replace an existing product image. With the fixed-filename convention,
 * a fresh upload to the same path overwrites the old object automatically,
 * so this is functionally identical to uploadAccessoryImage. Kept as a
 * separate export for caller clarity.
 */
export const replaceAccessoryImage = async (sku, newFile) => {
  return uploadAccessoryImage(sku, newFile);
};

/**
 * Delete the product's primary image. Clears photoUrl on the product
 * document FIRST (so the UI can't render a broken reference), then removes
 * the storage object. A 'storage/object-not-found' error at the storage
 * step is tolerated — the Firestore update has already taken effect.
 */
export const deleteAccessoryImage = async (sku) => {
  try {
    if (!sku) throw new Error('SKU is required');

    const productRef = doc(db, 'accessory_products', sku);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      return { success: false, error: 'Product not found' };
    }

    // Clear photoUrl first — UI stays consistent even if storage delete fails
    await updateDoc(productRef, {
      photoUrl: '',
      lastUpdated: Timestamp.now()
    });

    const storageResult = await deleteImageFromStorage(sku);
    if (!storageResult.success) {
      return {
        success: true,
        warning: `photoUrl cleared but storage deletion failed: ${storageResult.error}`,
        message: 'Image reference removed from product'
      };
    }

    return { success: true, message: 'Image deleted successfully' };
  } catch (error) {
    console.error('Error in deleteAccessoryImage:', error);
    return { success: false, error: error.message };
  }
};

/* ========== EXPORT STATEMENT ========== */

export default {
  uploadImageToStorage,
  deleteImageFromStorage,
  uploadAccessoryImage,
  replaceAccessoryImage,
  deleteAccessoryImage
};
