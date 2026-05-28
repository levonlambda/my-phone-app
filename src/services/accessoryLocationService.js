/* ========== ACCESSORY LOCATION SERVICE ========== */
/* Handles CRUD for accessory_locations (store branches). */
/* Each "location" represents a physical store/branch. Inventory is tracked */
/* per (sku, locationId) pair in accessory_inventory. */
/* IMPORTANT: This service ONLY writes to accessory_locations. */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

const DEFAULT_LOCATIONS = [
  { name: 'Main Branch', address: '', sortOrder: 10, isPrimary: true }
];

let _seedLocationsPromise = null;

/**
 * Fetch all locations, sorted by sortOrder.
 */
export const getAllLocations = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'accessory_locations'));
    const locations = [];
    snapshot.forEach((d) => locations.push({ id: d.id, ...d.data() }));
    locations.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return { success: true, locations };
  } catch (error) {
    console.error('Error fetching locations:', error);
    return { success: false, error: error.message, locations: [] };
  }
};

/**
 * Fetch only active locations.
 */
export const getActiveLocations = async () => {
  const result = await getAllLocations();
  if (!result.success) return result;
  return { success: true, locations: result.locations.filter((l) => l.active !== false) };
};

/**
 * Find the primary (default) active location, or fall back to the first active one.
 */
export const getPrimaryLocation = async () => {
  const result = await getActiveLocations();
  if (!result.success) return result;
  const primary =
    result.locations.find((l) => l.isPrimary) || result.locations[0] || null;
  return { success: true, location: primary };
};

/**
 * Fetch a single location by ID.
 */
export const getLocationById = async (id) => {
  try {
    const ref = doc(db, 'accessory_locations', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Location not found' };
    return { success: true, location: { id: snap.id, ...snap.data() } };
  } catch (error) {
    console.error('Error fetching location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new location. Name must be unique (case-sensitive exact match).
 */
export const createLocation = async (data) => {
  try {
    const name = (data.name || '').trim();
    if (!name) throw new Error('Location name is required');

    const existingQ = query(
      collection(db, 'accessory_locations'),
      where('name', '==', name)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      return { success: false, error: `Location "${name}" already exists` };
    }

    const docRef = await addDoc(collection(db, 'accessory_locations'), {
      name,
      address: (data.address || '').trim(),
      active: data.active !== undefined ? data.active : true,
      isPrimary: Boolean(data.isPrimary),
      sortOrder: data.sortOrder || 100,
      dateCreated: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });

    return { success: true, id: docRef.id, message: 'Location created successfully' };
  } catch (error) {
    console.error('Error creating location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing location.
 */
export const updateLocation = async (locationId, data) => {
  try {
    const ref = doc(db, 'accessory_locations', locationId);
    const payload = { ...data, lastUpdated: Timestamp.now() };
    if (payload.name !== undefined) payload.name = payload.name.trim();
    if (payload.address !== undefined) payload.address = payload.address.trim();
    await updateDoc(ref, payload);
    return { success: true, message: 'Location updated successfully' };
  } catch (error) {
    console.error('Error updating location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a location. Does NOT cascade — callers should warn the user if
 * inventory docs exist for this location (see countInventoryAtLocation).
 */
export const deleteLocation = async (locationId) => {
  try {
    if (!locationId) throw new Error('Location ID is required');
    await deleteDoc(doc(db, 'accessory_locations', locationId));
    return { success: true, message: 'Location deleted' };
  } catch (error) {
    console.error('Error deleting location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Count how many inventory docs at this location carry non-zero stock.
 * Used to warn the user before deleting a location.
 */
export const countInventoryAtLocation = async (locationId) => {
  try {
    if (!locationId) return { success: true, count: 0 };
    const q = query(
      collection(db, 'accessory_inventory'),
      where('locationId', '==', locationId)
    );
    const snap = await getDocs(q);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      const total =
        (data.onHand || 0) +
        (data.onDisplay || 0) +
        (data.reserved || 0) +
        (data.defective || 0);
      if (total > 0) count++;
    });
    return { success: true, count };
  } catch (error) {
    console.error('Error counting inventory at location:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

/**
 * Seed a default "Main Branch" location if the collection is empty.
 * Race-safe via a module-level promise guard (same pattern as the category seed).
 */
export const seedDefaultLocationIfEmpty = async () => {
  if (_seedLocationsPromise) return _seedLocationsPromise;
  _seedLocationsPromise = (async () => {
    try {
      const snapshot = await getDocs(collection(db, 'accessory_locations'));
      if (!snapshot.empty) {
        return { success: true, seeded: false, message: 'Locations already exist' };
      }
      const batch = writeBatch(db);
      DEFAULT_LOCATIONS.forEach((loc) => {
        const ref = doc(collection(db, 'accessory_locations'));
        batch.set(ref, {
          ...loc,
          active: true,
          dateCreated: Timestamp.now(),
          lastUpdated: Timestamp.now()
        });
      });
      await batch.commit();
      return {
        success: true,
        seeded: true,
        count: DEFAULT_LOCATIONS.length,
        message: 'Default location seeded successfully'
      };
    } catch (error) {
      _seedLocationsPromise = null;
      console.error('Error seeding default location:', error);
      return { success: false, error: error.message };
    }
  })();
  return _seedLocationsPromise;
};

export default {
  getAllLocations,
  getActiveLocations,
  getPrimaryLocation,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  countInventoryAtLocation,
  seedDefaultLocationIfEmpty
};
