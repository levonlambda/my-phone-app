import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

const InventoryFilters = ({ 
  filters, 
  pendingFilters, 
  filterOptions, 
  handleFilterChange,
  allItems
}) => {
  // State for filtered options based on selections
  const [filteredModels, setFilteredModels] = useState([]);
  const [filteredRams, setFilteredRams] = useState([]);
  const [filteredStorages, setFilteredStorages] = useState([]);
  const [filteredColors, setFilteredColors] = useState([]);
  
  // Loading states
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingRams, setIsLoadingRams] = useState(false);
  const [isLoadingStorages, setIsLoadingStorages] = useState(false);
  const [isLoadingColors, setIsLoadingColors] = useState(false);

  // Load models for selected manufacturer from database
  const loadModelsForManufacturer = async (manufacturer) => {
    if (!manufacturer) return;
    
    setIsLoadingModels(true);
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, where("manufacturer", "==", manufacturer));
      const snapshot = await getDocs(q);
      
      // Extract unique models
      const models = [...new Set(
        snapshot.docs.map(doc => doc.data().model)
      )].filter(Boolean).sort();
      
      setFilteredModels(models);
    } catch (error) {
      console.error("Error loading models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load RAM options based on manufacturer and model
  const loadRamOptions = async (manufacturer, model) => {
    if (!manufacturer || !model) return;
    
    setIsLoadingRams(true);
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(
        inventoryRef, 
        where("manufacturer", "==", manufacturer),
        where("model", "==", model)
      );
      const snapshot = await getDocs(q);
      
      // Extract unique RAM options
      const rams = [...new Set(
        snapshot.docs.map(doc => doc.data().ram)
      )].filter(Boolean).sort();
      
      setFilteredRams(rams);
    } catch (error) {
      console.error("Error loading RAM options:", error);
    } finally {
      setIsLoadingRams(false);
    }
  };

  // Load storage options based on manufacturer, model, and RAM
  const loadStorageOptions = async (manufacturer, model, ram) => {
    if (!manufacturer || !model) return;
    
    setIsLoadingStorages(true);
    try {
      let q;
      const inventoryRef = collection(db, 'inventory');
      
      if (ram) {
        // If RAM is selected, include it in the query
        q = query(
          inventoryRef, 
          where("manufacturer", "==", manufacturer),
          where("model", "==", model),
          where("ram", "==", ram)
        );
      } else {
        // If RAM is not selected, just filter by manufacturer and model
        q = query(
          inventoryRef, 
          where("manufacturer", "==", manufacturer),
          where("model", "==", model)
        );
      }
      
      const snapshot = await getDocs(q);
      
      // Extract unique storage options
      const storages = [...new Set(
        snapshot.docs.map(doc => doc.data().storage)
      )].filter(Boolean).sort();
      
      setFilteredStorages(storages);
    } catch (error) {
      console.error("Error loading storage options:", error);
    } finally {
      setIsLoadingStorages(false);
    }
  };

  // Load color options based on manufacturer, model, RAM, and storage
  const loadColorOptions = async (manufacturer, model, ram, storage) => {
    if (!manufacturer || !model) return;
    
    setIsLoadingColors(true);
    try {
      let q;
      const inventoryRef = collection(db, 'inventory');
      
      // Build query based on selected filters
      const constraints = [
        where("manufacturer", "==", manufacturer),
        where("model", "==", model)
      ];
      
      if (ram) {
        constraints.push(where("ram", "==", ram));
      }
      
      if (storage) {
        constraints.push(where("storage", "==", storage));
      }
      
      q = query(inventoryRef, ...constraints);
      const snapshot = await getDocs(q);
      
      // Extract unique color options
      const colors = [...new Set(
        snapshot.docs.map(doc => doc.data().color)
      )].filter(Boolean).sort();
      
      setFilteredColors(colors);
    } catch (error) {
      console.error("Error loading color options:", error);
    } finally {
      setIsLoadingColors(false);
    }
  };

  // Update models when manufacturer changes
  useEffect(() => {
    if (filters.manufacturer) {
      if (allItems && allItems.length > 0) {
        // If allItems is populated, filter models from it
        const modelsForManufacturer = [...new Set(
          allItems
            .filter(item => item.manufacturer === filters.manufacturer)
            .map(item => item.model)
        )].sort();
        
        // Only update if we found models
        if (modelsForManufacturer.length > 0) {
          setFilteredModels(modelsForManufacturer);
        } else {
          // If no models found in allItems, load from database
          loadModelsForManufacturer(filters.manufacturer);
        }
      } else {
        // If allItems is not available, load from database
        loadModelsForManufacturer(filters.manufacturer);
      }
    } else {
      // If no manufacturer is selected, show all models
      setFilteredModels(filterOptions.models);
    }
  }, [filters.manufacturer, allItems, filterOptions.models]);

  // Update RAM options when manufacturer and model change
  useEffect(() => {
    if (filters.manufacturer && filters.model) {
      if (allItems && allItems.length > 0) {
        // If allItems is populated, filter RAM options from it
        const ramsForModel = [...new Set(
          allItems
            .filter(item => 
              item.manufacturer === filters.manufacturer && 
              item.model === filters.model
            )
            .map(item => item.ram)
        )].sort();
        
        // Only update if we found RAM options
        if (ramsForModel.length > 0) {
          setFilteredRams(ramsForModel);
        } else {
          // If no RAM options found in allItems, load from database
          loadRamOptions(filters.manufacturer, filters.model);
        }
      } else {
        // If allItems is not available, load from database
        loadRamOptions(filters.manufacturer, filters.model);
      }
    } else {
      // If no manufacturer or model is selected, show all RAM options
      setFilteredRams(filterOptions.rams);
    }
  }, [filters.manufacturer, filters.model, allItems, filterOptions.rams]);

  // Update Storage options when manufacturer, model, and RAM change
  useEffect(() => {
    if (filters.manufacturer && filters.model) {
      if (allItems && allItems.length > 0) {
        // Filter items by current selections
        let filteredItems = allItems.filter(item => 
          item.manufacturer === filters.manufacturer && 
          item.model === filters.model
        );
        
        // If RAM is selected, filter by that too
        if (filters.ram) {
          filteredItems = filteredItems.filter(item => item.ram === filters.ram);
        }
        
        // Extract unique storage options
        const storagesForSelection = [...new Set(
          filteredItems.map(item => item.storage)
        )].sort();
        
        // Only update if we found storage options
        if (storagesForSelection.length > 0) {
          setFilteredStorages(storagesForSelection);
        } else {
          // If no storage options found in allItems, load from database
          loadStorageOptions(filters.manufacturer, filters.model, filters.ram);
        }
      } else {
        // If allItems is not available, load from database
        loadStorageOptions(filters.manufacturer, filters.model, filters.ram);
      }
    } else {
      // If no manufacturer or model is selected, show all storage options
      setFilteredStorages(filterOptions.storages);
    }
  }, [filters.manufacturer, filters.model, filters.ram, allItems, filterOptions.storages]);

  // Update Color options when manufacturer, model, RAM, and storage change
  useEffect(() => {
    if (filters.manufacturer && filters.model) {
      if (allItems && allItems.length > 0) {
        // Filter items by current selections
        let filteredItems = allItems.filter(item => 
          item.manufacturer === filters.manufacturer && 
          item.model === filters.model
        );
        
        // Apply additional filters if selected
        if (filters.ram) {
          filteredItems = filteredItems.filter(item => item.ram === filters.ram);
        }
        
        if (filters.storage) {
          filteredItems = filteredItems.filter(item => item.storage === filters.storage);
        }
        
        // Extract unique color options
        const colorsForSelection = [...new Set(
          filteredItems.map(item => item.color)
        )].sort();
        
        // Only update if we found color options
        if (colorsForSelection.length > 0) {
          setFilteredColors(colorsForSelection);
        } else {
          // If no color options found in allItems, load from database
          loadColorOptions(filters.manufacturer, filters.model, filters.ram, filters.storage);
        }
      } else {
        // If allItems is not available, load from database
        loadColorOptions(filters.manufacturer, filters.model, filters.ram, filters.storage);
      }
    } else {
      // If no manufacturer or model is selected, show all color options
      setFilteredColors(filterOptions.colors);
    }
  }, [
    filters.manufacturer, 
    filters.model, 
    filters.ram, 
    filters.storage, 
    allItems, 
    filterOptions.colors
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Manufacturer filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Manufacturer
        </label>
        <select
          name="manufacturer"
          value={filters.manufacturer}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
        >
          <option value="">All Manufacturers</option>
          {filterOptions.manufacturers.map(manufacturer => (
            <option key={manufacturer} value={manufacturer}>
              {manufacturer}
            </option>
          ))}
        </select>
      </div>
      
      {/* Model filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          name="model"
          value={filters.model}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
          disabled={!filters.manufacturer || isLoadingModels}
        >
          <option value="">All Models</option>
          {isLoadingModels ? (
            <option value="" disabled>Loading models...</option>
          ) : (
            filteredModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))
          )}
        </select>
        {isLoadingModels && (
          <p className="text-xs text-gray-500 mt-1">Loading models...</p>
        )}
        {!filters.manufacturer && (
          <p className="text-xs text-gray-500 mt-1">Select a manufacturer first</p>
        )}
      </div>
      
      {/* Status filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
        >
          <option value="">All Statuses</option>
          {filterOptions.statuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      
      {/* RAM filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          RAM
        </label>
        <select
          name="ram"
          value={filters.ram}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
          disabled={!filters.manufacturer || !filters.model || isLoadingRams}
        >
          <option value="">All RAM</option>
          {isLoadingRams ? (
            <option value="" disabled>Loading RAM options...</option>
          ) : (
            filteredRams.map(ram => (
              <option key={ram} value={ram}>
                {ram}
              </option>
            ))
          )}
        </select>
        {isLoadingRams && (
          <p className="text-xs text-gray-500 mt-1">Loading RAM options...</p>
        )}
        {(!filters.manufacturer || !filters.model) && (
          <p className="text-xs text-gray-500 mt-1">Select manufacturer and model first</p>
        )}
      </div>
      
      {/* Storage filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Storage
        </label>
        <select
          name="storage"
          value={filters.storage}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
          disabled={!filters.manufacturer || !filters.model || isLoadingStorages}
        >
          <option value="">All Storage</option>
          {isLoadingStorages ? (
            <option value="" disabled>Loading storage options...</option>
          ) : (
            filteredStorages.map(storage => (
              <option key={storage} value={storage}>
                {storage}
              </option>
            ))
          )}
        </select>
        {isLoadingStorages && (
          <p className="text-xs text-gray-500 mt-1">Loading storage options...</p>
        )}
        {(!filters.manufacturer || !filters.model) && (
          <p className="text-xs text-gray-500 mt-1">Select manufacturer and model first</p>
        )}
      </div>
      
      {/* Color filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Color
        </label>
        <select
          name="color"
          value={filters.color}
          onChange={handleFilterChange}
          className="w-full p-2 border rounded"
          disabled={!filters.manufacturer || !filters.model || isLoadingColors}
        >
          <option value="">All Colors</option>
          {isLoadingColors ? (
            <option value="" disabled>Loading color options...</option>
          ) : (
            filteredColors.map(color => (
              <option key={color} value={color}>
                {color}
              </option>
            ))
          )}
        </select>
        {isLoadingColors && (
          <p className="text-xs text-gray-500 mt-1">Loading color options...</p>
        )}
        {(!filters.manufacturer || !filters.model) && (
          <p className="text-xs text-gray-500 mt-1">Select manufacturer and model first</p>
        )}
      </div>
      
      {/* IMEI1 filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          IMEI1
        </label>
        <input
          type="text"
          name="imei1"
          value={pendingFilters.imei1}
          onChange={handleFilterChange}
          placeholder="Search IMEI"
          className="w-full p-2 border rounded"
        />
      </div>
      
      {/* Barcode filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Barcode
        </label>
        <input
          type="text"
          name="barcode"
          value={pendingFilters.barcode}
          onChange={handleFilterChange}
          placeholder="Search barcode"
          className="w-full p-2 border rounded"
        />
      </div>
      
      {/* Price range */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Price
          </label>
          <input
            type="text"
            name="minPrice"
            value={pendingFilters.minPrice}
            onChange={handleFilterChange}
            placeholder="0"
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Price
          </label>
          <input
            type="text"
            name="maxPrice"
            value={pendingFilters.maxPrice}
            onChange={handleFilterChange}
            placeholder="999,999"
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
    </div>
  );
};

InventoryFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  pendingFilters: PropTypes.object.isRequired,
  filterOptions: PropTypes.object.isRequired,
  handleFilterChange: PropTypes.func.isRequired,
  allItems: PropTypes.array.isRequired
};

export default InventoryFilters;