{/* Part 1 Start - Imports and Component Setup */}
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, doc, setDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  Smartphone, 
  RefreshCw, 
  Filter, 
  X,
  Edit,
  Save,
  XCircle
} from 'lucide-react';
import { getCurrentDate } from './phone-selection/utils/phoneUtils';

const PriceManagementForm = () => {
  // State for grouped phone data
  const [phoneData, setPhoneData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for expanded rows and color sections
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // State for editing
  const [editingBasePrice, setEditingBasePrice] = useState(null);
  const [editingColorPrice, setEditingColorPrice] = useState(null);
  const [editFormData, setEditFormData] = useState({
    dealersPrice: '',
    retailPrice: ''
  });
  const [savingPriceId, setSavingPriceId] = useState(null);
  
  // Force re-render state
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    manufacturer: '',
    model: '',
    ram: '',
    storage: ''
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    manufacturers: [],
    models: [],
    rams: [],
    storages: []
  });
  
  // Filtered options based on selections
  const [filteredOptions, setFilteredOptions] = useState({
    models: [],
    rams: [],
    storages: []
  });
{/* Part 1 End - Imports and Component Setup */}

{/* Part 2 Start - Utility Functions */}
  // Utility functions
  const formatPrice = (price) => {
    if (!price && price !== 0) return 'N/A';
    return `₱${price.toLocaleString()}`;
  };

  const formatNumberWithCommas = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parsePrice = (value) => {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/,/g, '')) || 0;
  };

  const calculateMargin = (dealersPrice, retailPrice) => {
    if (!dealersPrice || !retailPrice) return 'N/A';
    const costPrice = typeof dealersPrice === 'string' ? parseFloat(dealersPrice.replace(/[^\d.-]/g, '')) : dealersPrice;
    const sellPrice = typeof retailPrice === 'string' ? parseFloat(retailPrice.replace(/[^\d.-]/g, '')) : retailPrice;
    if (costPrice <= 0) return 'N/A';
    const marginAmount = sellPrice - costPrice;
    const marginPercentage = (marginAmount / costPrice) * 100;
    return `${marginPercentage.toFixed(2)}%`;
  };

  const formatWithGB = (value) => {
    if (!value) return 'N/A';
    if (value.includes('GB') || value.includes('TB') || value.includes('gb') || value.includes('tb')) {
      return value;
    }
    return `${value}GB`;
  };

  // Toggle row expansion
  const toggleRowExpansion = (index) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
  };

  // Helper function to save/update price configurations
  const updatePriceConfiguration = async (manufacturer, model, ram, storage, dealersPrice, retailPrice, color = null) => {
    try {
      let configId;
      if (color) {
        configId = `${manufacturer}_${model}_${ram}_${storage}_${color}`.replace(/\s+/g, '_').toLowerCase();
      } else {
        configId = `${manufacturer}_${model}_${ram}_${storage}`.replace(/\s+/g, '_').toLowerCase();
      }
      
      const dPrice = parseFloat(dealersPrice.toString().replace(/,/g, '')) || 0;
      const rPrice = parseFloat(retailPrice.toString().replace(/,/g, '')) || 0;
      
      await setDoc(doc(db, 'price_configurations', configId), {
        manufacturer,
        model,
        ram,
        storage,
        color,
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
{/* Part 2 End - Utility Functions */}

{/* Part 3 Start - Filter Handling Functions */}
  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      manufacturer: '',
      model: '',
      ram: '',
      storage: ''
    });
    setFilteredOptions({
      models: filterOptions.models,
      rams: filterOptions.rams,
      storages: filterOptions.storages
    });
  };

  // Apply filters to data
  const applyFilters = useCallback(() => {
    if (!phoneData.length) return;
    const filtered = phoneData.filter(item => {
      if (filters.manufacturer && item.manufacturer !== filters.manufacturer) return false;
      if (filters.model && item.model !== filters.model) return false;
      if (filters.ram && item.ram !== filters.ram) return false;
      if (filters.storage && item.storage !== filters.storage) return false;
      return true;
    });
    setFilteredData(filtered);
  }, [phoneData, filters]);

  // Update filtered options based on current selections
  const updateFilteredOptions = useCallback(() => {
    if (!phoneData.length) return;
    
    let filteredModels = filterOptions.models;
    let filteredRams = filterOptions.rams;
    let filteredStorages = filterOptions.storages;
    
    if (filters.manufacturer) {
      filteredModels = [...new Set(
        phoneData
          .filter(item => item.manufacturer === filters.manufacturer)
          .map(item => item.model)
      )].sort();
    }
    
    if (filters.manufacturer || filters.model) {
      let filtered = phoneData;
      if (filters.manufacturer) {
        filtered = filtered.filter(item => item.manufacturer === filters.manufacturer);
      }
      if (filters.model) {
        filtered = filtered.filter(item => item.model === filters.model);
      }
      filteredRams = [...new Set(filtered.map(item => item.ram))].sort();
    }
    
    if (filters.manufacturer || filters.model || filters.ram) {
      let filtered = phoneData;
      if (filters.manufacturer) {
        filtered = filtered.filter(item => item.manufacturer === filters.manufacturer);
      }
      if (filters.model) {
        filtered = filtered.filter(item => item.model === filters.model);
      }
      if (filters.ram) {
        filtered = filtered.filter(item => item.ram === filters.ram);
      }
      filteredStorages = [...new Set(filtered.map(item => item.storage))].sort();
    }
    
    setFilteredOptions({
      models: filteredModels,
      rams: filteredRams,
      storages: filteredStorages
    });
  }, [phoneData, filters, filterOptions]);
{/* Part 3 End - Filter Handling Functions */}

{/* Part 4 Start - Edit Handling Functions */}
  // Handle edit base price
  const handleEditBasePrice = (item, index) => {
    setEditingBasePrice(index);
    setEditingColorPrice(null);
    setEditFormData({
      dealersPrice: formatNumberWithCommas(item.baseDealersPrice.toString()),
      retailPrice: formatNumberWithCommas(item.baseRetailPrice.toString())
    });
  };

  // Handle edit color price
  const handleEditColorPrice = (item, colorData, rowIndex, colorIndex) => {
    setEditingColorPrice(`${rowIndex}_${colorIndex}`);
    setEditingBasePrice(null);
    setEditFormData({
      dealersPrice: formatNumberWithCommas(colorData.dealersPrice.toString()),
      retailPrice: formatNumberWithCommas(colorData.retailPrice.toString())
    });
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingBasePrice(null);
    setEditingColorPrice(null);
    setEditFormData({
      dealersPrice: '',
      retailPrice: ''
    });
  };

  // Handle form input change
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    
    let formattedValue = value;
    if (name === 'dealersPrice' || name === 'retailPrice') {
      const cleanValue = value.replace(/[^\d.]/g, '');
      formattedValue = formatNumberWithCommas(cleanValue);
    }
    
    setEditFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
  };
{/* Part 4 End - Edit Handling Functions */}

{/* Part 5 Start - Save Price Functions */}
  // Save base price changes - FORCE RE-RENDER VERSION
  const saveBasePrice = async (item, index) => {
    setSavingPriceId(`base_${index}`);
    
    try {
      const dealersPrice = parsePrice(editFormData.dealersPrice);
      const retailPrice = parsePrice(editFormData.retailPrice);
      
      // Update base configuration
      await updatePriceConfiguration(
        item.manufacturer,
        item.model,
        item.ram,
        item.storage,
        dealersPrice.toString(),
        retailPrice.toString()
      );
      
      // Update ALL colors to use the new base pricing - regardless of whether they have specific configs
      const updatePromises = [];
      for (const colorData of item.colors) {
        updatePromises.push(
          updatePriceConfiguration(
            item.manufacturer,
            item.model,
            item.ram,
            item.storage,
            dealersPrice.toString(),
            retailPrice.toString(),
            colorData.color
          )
        );
      }
      await Promise.all(updatePromises);
      
      // Update ALL existing inventory items for this configuration - all colors
      const inventoryQuery = query(
        collection(db, 'inventory'),
        where("manufacturer", "==", item.manufacturer),
        where("model", "==", item.model),
        where("ram", "==", item.ram),
        where("storage", "==", item.storage)
      );
      
      const inventorySnap = await getDocs(inventoryQuery);
      
      if (!inventorySnap.empty) {
        const batch = writeBatch(db);
        
        // Update ALL inventory items regardless of color
        inventorySnap.docs.forEach(docRef => {
          batch.update(docRef.ref, {
            dealersPrice: dealersPrice,
            retailPrice: retailPrice,
            lastUpdated: getCurrentDate()
          });
        });
        
        await batch.commit();
        console.log(`Updated ${inventorySnap.docs.length} inventory items with new base pricing (ALL colors)`);
      }
      
      // FORCE STATE UPDATE - Create completely new arrays with updated data
      const newPhoneData = [...phoneData];
      newPhoneData[index] = {
        ...newPhoneData[index],
        baseDealersPrice: dealersPrice,
        baseRetailPrice: retailPrice,
        colors: newPhoneData[index].colors.map(color => ({
          ...color,
          dealersPrice: dealersPrice,
          retailPrice: retailPrice,
          configId: color.configId || 'updated'
        }))
      };
      
      // Update phoneData with completely new array
      setPhoneData(newPhoneData);
      
      // Find and update the same item in filteredData
      const newFilteredData = [...filteredData];
      const filteredIndex = newFilteredData.findIndex(phone => 
        phone.manufacturer === item.manufacturer &&
        phone.model === item.model &&
        phone.ram === item.ram &&
        phone.storage === item.storage
      );
      
      if (filteredIndex !== -1) {
        newFilteredData[filteredIndex] = {
          ...newFilteredData[filteredIndex],
          baseDealersPrice: dealersPrice,
          baseRetailPrice: retailPrice,
          colors: newFilteredData[filteredIndex].colors.map(color => ({
            ...color,
            dealersPrice: dealersPrice,
            retailPrice: retailPrice,
            configId: color.configId || 'updated'
          }))
        };
      }
      
      // Update filteredData with completely new array
      setFilteredData(newFilteredData);
      
      // Force component re-render
      setForceUpdate(prev => prev + 1);
      
      // BACKUP: Force DOM update if React doesn't re-render properly
      setTimeout(() => {
        // Find all table rows
        const tableRows = document.querySelectorAll('tbody tr');
        
        // Update the main row (base price row)
        if (tableRows[index]) {
          const mainRow = tableRows[index];
          const dealerCell = mainRow.querySelector('td:nth-child(6)');
          const retailCell = mainRow.querySelector('td:nth-child(7)');
          const marginCell = mainRow.querySelector('td:nth-child(8)');
          
          if (dealerCell && retailCell && marginCell) {
            dealerCell.textContent = formatPrice(dealersPrice);
            retailCell.textContent = formatPrice(retailPrice);
            marginCell.textContent = calculateMargin(dealersPrice, retailPrice);
            console.log('Manually updated main row DOM for row', index);
          }
        }
        
        // Update expanded color rows (if any are expanded)
        if (expandedRows.has(index)) {
          console.log('Updating expanded color rows for base price change...');
          
          // Find all rows after the main row that belong to this phone's colors
          let currentRowIndex = index + 1;
          
          // Look for color rows (they have gray background and indented color names)
          for (let i = 0; i < item.colors.length; i++) {
            const colorRow = tableRows[currentRowIndex + i];
            
            if (colorRow && colorRow.classList.contains('bg-gray-50')) {
              const dealerCell = colorRow.querySelector('td:nth-child(6)');
              const retailCell = colorRow.querySelector('td:nth-child(7)');
              const marginCell = colorRow.querySelector('td:nth-child(8)');
              
              if (dealerCell && retailCell && marginCell) {
                dealerCell.textContent = formatPrice(dealersPrice);
                retailCell.textContent = formatPrice(retailPrice);
                marginCell.textContent = calculateMargin(dealersPrice, retailPrice);
                console.log(`Manually updated color row DOM for ${item.colors[i].color}`);
              }
            }
          }
        }
      }, 100);
      
      // Clear editing state
      handleCancelEdit();
      setSavingPriceId(null);
      
      console.log(`Successfully updated base price for ${item.manufacturer} ${item.model} to ₱${dealersPrice.toLocaleString()} / ₱${retailPrice.toLocaleString()}`);
      console.log('New phoneData:', newPhoneData[index]);
      console.log('New filteredData:', filteredIndex !== -1 ? newFilteredData[filteredIndex] : 'Not in filtered data');
      
      alert(`Base pricing updated successfully! All colors have been updated to the new base price.`);
      
    } catch (error) {
      console.error("Error updating base price:", error);
      alert(`Error updating price: ${error.message}`);
      setSavingPriceId(null);
    }
  };

  // Save color-specific price changes - FORCE RE-RENDER VERSION
  const saveColorPrice = async (item, colorData, rowIndex, colorIndex) => {
    setSavingPriceId(`color_${rowIndex}_${colorIndex}`);
    
    try {
      const dealersPrice = parsePrice(editFormData.dealersPrice);
      const retailPrice = parsePrice(editFormData.retailPrice);
      
      // Update color-specific configuration
      await updatePriceConfiguration(
        item.manufacturer,
        item.model,
        item.ram,
        item.storage,
        dealersPrice.toString(),
        retailPrice.toString(),
        colorData.color
      );
      
      // Update all existing inventory items for THIS SPECIFIC COLOR ONLY
      const inventoryQuery = query(
        collection(db, 'inventory'),
        where("manufacturer", "==", item.manufacturer),
        where("model", "==", item.model),
        where("ram", "==", item.ram),
        where("storage", "==", item.storage),
        where("color", "==", colorData.color)
      );
      
      const inventorySnap = await getDocs(inventoryQuery);
      
      if (!inventorySnap.empty) {
        const batch = writeBatch(db);
        
        inventorySnap.docs.forEach(docRef => {
          batch.update(docRef.ref, {
            dealersPrice: dealersPrice,
            retailPrice: retailPrice,
            lastUpdated: getCurrentDate()
          });
        });
        
        await batch.commit();
        console.log(`Updated ${inventorySnap.docs.length} inventory items for color ${colorData.color}`);
      }
      
      // FORCE STATE UPDATE - Create completely new arrays with updated data
      const newPhoneData = [...phoneData];
      newPhoneData[rowIndex] = {
        ...newPhoneData[rowIndex],
        colors: newPhoneData[rowIndex].colors.map((color, ci) => {
          if (ci === colorIndex) {
            return {
              ...color,
              dealersPrice: dealersPrice,
              retailPrice: retailPrice,
              configId: color.configId || 'updated'
            };
          }
          return { ...color };
        })
      };
      
      // Update phoneData with completely new array
      setPhoneData(newPhoneData);
      
      // Find and update the same item in filteredData
      const newFilteredData = [...filteredData];
      const filteredIndex = newFilteredData.findIndex(phone => 
        phone.manufacturer === item.manufacturer &&
        phone.model === item.model &&
        phone.ram === item.ram &&
        phone.storage === item.storage
      );
      
      if (filteredIndex !== -1) {
        newFilteredData[filteredIndex] = {
          ...newFilteredData[filteredIndex],
          colors: newFilteredData[filteredIndex].colors.map((color, ci) => {
            if (ci === colorIndex) {
              return {
                ...color,
                dealersPrice: dealersPrice,
                retailPrice: retailPrice,
                configId: color.configId || 'updated'
              };
            }
            return { ...color };
          })
        };
      }
      
      // Update filteredData with completely new array
      setFilteredData(newFilteredData);
      
      // Force component re-render
      setForceUpdate(prev => prev + 1);
      
      // BACKUP: Force DOM update for color row if React doesn't re-render properly
      setTimeout(() => {
        // This is more complex for color rows, so let's just log for now
        console.log('Color price updated in state, checking if UI reflects changes...');
      }, 100);
      
      // Clear editing state
      handleCancelEdit();
      setSavingPriceId(null);
      
      console.log(`Successfully updated color price for ${colorData.color} to ₱${dealersPrice.toLocaleString()} / ₱${retailPrice.toLocaleString()}`);
      console.log('Updated color data:', newPhoneData[rowIndex].colors[colorIndex]);
      
      alert(`Color-specific pricing updated successfully! Updated prices for ${colorData.color} only.`);
      
    } catch (error) {
      console.error("Error updating color price:", error);
      alert(`Error updating price: ${error.message}`);
      setSavingPriceId(null);
    }
  };
{/* Part 5 End - Save Price Functions */}

{/* Part 6 Start - Data Fetching Function */}
  // Fetch and process phone data
  const fetchPhoneData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch from price_configurations collection
      const configsRef = collection(db, 'price_configurations');
      const configsSnapshot = await getDocs(configsRef);
      
      // Fetch from inventory collection to get color information
      const inventoryRef = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryRef);
      
      // Group price configurations by base configuration (without color)
      const groupedData = {};
      const manufacturers = new Set();
      const models = new Set();
      const rams = new Set();
      const storages = new Set();
      
      // Process price configurations
      configsSnapshot.forEach(doc => {
        const config = { id: doc.id, ...doc.data() };
        
        if (config.manufacturer && config.model && config.ram && config.storage) {
          const baseKey = `${config.manufacturer}_${config.model}_${config.ram}_${config.storage}`;
          
          // Add to filter options
          manufacturers.add(config.manufacturer);
          models.add(config.model);
          rams.add(config.ram);
          storages.add(config.storage);
          
          if (!groupedData[baseKey]) {
            groupedData[baseKey] = {
              manufacturer: config.manufacturer,
              model: config.model,
              ram: config.ram,
              storage: config.storage,
              baseDealersPrice: 0,
              baseRetailPrice: 0,
              colors: {}
            };
          }
          
          if (config.color) {
            // Color-specific pricing
            groupedData[baseKey].colors[config.color] = {
              color: config.color,
              dealersPrice: config.dealersPrice || 0,
              retailPrice: config.retailPrice || 0,
              configId: config.id,
              lastUpdated: config.lastUpdated
            };
          } else {
            // Base pricing
            groupedData[baseKey].baseDealersPrice = config.dealersPrice || 0;
            groupedData[baseKey].baseRetailPrice = config.retailPrice || 0;
            groupedData[baseKey].baseConfigId = config.id;
            groupedData[baseKey].lastUpdated = config.lastUpdated;
          }
        }
      });
      
      // Get all available colors from inventory for each base configuration
      const inventoryColors = {};
      inventorySnapshot.forEach(doc => {
        const item = doc.data();
        if (item.manufacturer && item.model && item.ram && item.storage && item.color) {
          const baseKey = `${item.manufacturer}_${item.model}_${item.ram}_${item.storage}`;
          if (!inventoryColors[baseKey]) {
            inventoryColors[baseKey] = new Set();
          }
          inventoryColors[baseKey].add(item.color);
        }
      });
      
      // Ensure all colors have entries (even if no specific pricing exists)
      Object.keys(groupedData).forEach(baseKey => {
        const colors = inventoryColors[baseKey] || new Set();
        colors.forEach(color => {
          if (!groupedData[baseKey].colors[color]) {
            // Use base pricing if no color-specific pricing exists
            groupedData[baseKey].colors[color] = {
              color: color,
              dealersPrice: groupedData[baseKey].baseDealersPrice,
              retailPrice: groupedData[baseKey].baseRetailPrice,
              configId: null, // No specific config for this color yet
              lastUpdated: groupedData[baseKey].lastUpdated
            };
          }
        });
      });
      
      // Convert to array and sort colors
      Object.values(groupedData).forEach(group => {
        group.colors = Object.values(group.colors).sort((a, b) => a.color.localeCompare(b.color));
      });
      
      const phoneArray = Object.values(groupedData).sort((a, b) => {
        if (a.manufacturer !== b.manufacturer) {
          return a.manufacturer.localeCompare(b.manufacturer);
        }
        if (a.model !== b.model) {
          return a.model.localeCompare(b.model);
        }
        if (a.ram !== b.ram) {
          return a.ram.localeCompare(b.ram);
        }
        return a.storage.localeCompare(b.storage);
      });
      
      const filterOpts = {
        manufacturers: [...manufacturers].sort(),
        models: [...models].sort(),
        rams: [...rams].sort(),
        storages: [...storages].sort()
      };
      
      setFilterOptions(filterOpts);
      setFilteredOptions({
        models: filterOpts.models,
        rams: filterOpts.rams,
        storages: filterOpts.storages
      });
      
      setPhoneData(phoneArray);
      setFilteredData(phoneArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching phone data:", err);
      setError(`Error fetching phone data: ${err.message}`);
      setLoading(false);
    }
  }, []);
{/* Part 6 End - Data Fetching Function */}

{/* Part 7 Start - Effects and Loading/Error States */}
  // Effects
  useEffect(() => {
    fetchPhoneData();
  }, [fetchPhoneData]);
  
  useEffect(() => {
    updateFilteredOptions();
  }, [updateFilteredOptions]);
  
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white">Price Management</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading phone pricing data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-red-600 py-3">
            <CardTitle className="text-2xl text-white">Error</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={fetchPhoneData}
              className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
{/* Part 7 End - Effects and Loading/Error States */}

{/* Part 8 Start - Main Render - Header and Filters */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Price Management</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 ${showFilters ? 'bg-white/20 text-white' : 'bg-white text-[rgb(52,69,157)]'} px-4 py-2 rounded text-base font-medium`}
            >
              <Filter className="h-5 w-5 mr-1" />
              <span>Filters</span>
            </button>
            <button
              onClick={fetchPhoneData}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <RefreshCw className="h-5 w-5 mr-1" />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 px-4 py-4 border-b">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">Filters</h3>
              <button 
                onClick={clearFilters}
                className="text-gray-500 hover:text-red-500 flex items-center"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <select name="manufacturer" value={filters.manufacturer} onChange={handleFilterChange} className="w-full p-2 border rounded">
                  <option value="">All Manufacturers</option>
                  {filterOptions.manufacturers.map(manufacturer => (
                    <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select name="model" value={filters.model} onChange={handleFilterChange} className="w-full p-2 border rounded">
                  <option value="">All Models</option>
                  {filteredOptions.models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RAM</label>
                <select name="ram" value={filters.ram} onChange={handleFilterChange} className="w-full p-2 border rounded">
                  <option value="">All RAM</option>
                  {filteredOptions.rams.map(ram => (
                    <option key={ram} value={ram}>{ram}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage</label>
                <select name="storage" value={filters.storage} onChange={handleFilterChange} className="w-full p-2 border rounded">
                  <option value="">All Storage</option>
                  {filteredOptions.storages.map(storage => (
                    <option key={storage} value={storage}>{storage}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Active filters summary */}
            {Object.values(filters).some(filter => filter !== '') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => 
                  value && (
                    <div key={key} className="bg-gray-200 rounded-full px-3 py-1 text-sm flex items-center">
                      <span className="font-medium capitalize">{key}:</span>
                      <span className="ml-1">{value}</span>
                      <button 
                        onClick={() => setFilters(prev => ({ ...prev, [key]: '' }))}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
{/* Part 8 End - Main Render - Header and Filters */}

{/* Part 9 Start - Main Table Content and Empty State */}
        <CardContent className="p-4">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No pricing data found</h3>
              {Object.values(filters).some(f => f) ? (
                <>
                  <p className="text-gray-500 mb-4">No items match your current filters.</p>
                  <button onClick={clearFilters} className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md">
                    Clear Filters
                  </button>
                </>
              ) : (
                <p className="text-gray-500">There are no price configurations in the database.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main table */}
              <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <th className="px-3 py-3 text-left">Manufacturer</th>
                      <th className="px-3 py-3 text-left">Model</th>
                      <th className="px-3 py-3 text-left">RAM</th>
                      <th className="px-3 py-3 text-left">Storage</th>
                      <th className="px-3 py-3 text-left">Colors</th>
                      <th className="pl-0 pr-1 py-3 text-right">{"Dealer's Price"}</th>
                      <th className="px-1 py-3 text-right">Retail Price</th>
                      <th className="px-1 py-3 text-right">Margin</th>
                      <th className="px-1 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((item, index) => (
                      <React.Fragment key={`${item.manufacturer}_${item.model}_${item.ram}_${item.storage}_${forceUpdate}_${index}`}>
                        {/* Main row - show actual colors instead of "Multiple Colors" */}
                        <tr 
                          className={`hover:bg-gray-100 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          onClick={() => toggleRowExpansion(index)}
                        >
                          <td className="px-3 py-3 text-sm">{item.manufacturer}</td>
                          <td className="px-3 py-3 text-sm font-medium">{item.model}</td>
                          <td className="px-3 py-3 text-sm">{formatWithGB(item.ram)}</td>
                          <td className="px-3 py-3 text-sm">{formatWithGB(item.storage)}</td>
                          <td className="px-3 py-3 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {item.colors.slice(0, 3).map((colorData, colorIndex) => (
                                <span 
                                  key={colorIndex} 
                                  className="inline-block px-2 py-1 text-xs bg-gray-100 rounded"
                                >
                                  {colorData.color}
                                </span>
                              ))}
                              {item.colors.length > 3 && (
                                <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                  +{item.colors.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="pl-0 pr-1 py-3 text-sm text-right">
                            {editingBasePrice === index ? (
                              <input
                                type="text"
                                name="dealersPrice"
                                value={editFormData.dealersPrice}
                                onChange={handleEditInputChange}
                                className="w-20 p-1 border rounded text-right"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              formatPrice(item.baseDealersPrice)
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm text-right">
                            {editingBasePrice === index ? (
                              <input
                                type="text"
                                name="retailPrice"
                                value={editFormData.retailPrice}
                                onChange={handleEditInputChange}
                                className="w-20 p-1 border rounded text-right"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              formatPrice(item.baseRetailPrice)
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm text-right font-medium">
                            {editingBasePrice === index 
                              ? calculateMargin(editFormData.dealersPrice, editFormData.retailPrice)
                              : calculateMargin(item.baseDealersPrice, item.baseRetailPrice)
                            }
                          </td>
                          <td className="px-1 py-3 text-sm text-center">
                            {editingBasePrice === index ? (
                              <div className="flex justify-center space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveBasePrice(item, index);
                                  }}
                                  disabled={savingPriceId === `base_${index}`}
                                  className="p-1 text-green-600 hover:text-green-800"
                                  title="Save changes"
                                >
                                  {savingPriceId === `base_${index}` ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEdit();
                                  }}
                                  className="p-1 text-red-600 hover:text-red-800"
                                  title="Cancel edit"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditBasePrice(item, index);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Edit base price"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
{/* Part 9 End - Main Table Content and Empty State */}

{/* Part 10 Start - Expanded Color Breakdown Rows and Component End */}
                        {/* Expanded color breakdown - EACH COLOR GETS ITS OWN SIMPLE ROW */}
                        {expandedRows.has(index) && 
                          item.colors.map((colorData, colorIndex) => (
                            <tr key={`color-${index}-${colorIndex}`} className="bg-gray-50">
                              <td className="px-3 py-3 text-sm text-gray-600">
                                <span className="ml-4">{colorData.color}</span>
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600">-</td>
                              <td className="px-3 py-3 text-sm text-gray-600">-</td>
                              <td className="px-3 py-3 text-sm text-gray-600">-</td>
                              <td className="px-3 py-3 text-sm">
                                {colorData.dealersPrice !== item.baseDealersPrice || 
                                 colorData.retailPrice !== item.baseRetailPrice ? (
                                  <span className="text-xs text-white bg-orange-500 px-2 py-1 rounded">
                                    Custom Price
                                  </span>
                                ) : null}
                              </td>
                              <td className="pl-0 pr-1 py-3 text-sm text-right">
                                {editingColorPrice === `${index}_${colorIndex}` ? (
                                  <input
                                    type="text"
                                    name="dealersPrice"
                                    value={editFormData.dealersPrice}
                                    onChange={handleEditInputChange}
                                    className="w-20 p-1 border rounded text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  formatPrice(colorData.dealersPrice)
                                )}
                              </td>
                              <td className="px-1 py-3 text-sm text-right">
                                {editingColorPrice === `${index}_${colorIndex}` ? (
                                  <input
                                    type="text"
                                    name="retailPrice"
                                    value={editFormData.retailPrice}
                                    onChange={handleEditInputChange}
                                    className="w-20 p-1 border rounded text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  formatPrice(colorData.retailPrice)
                                )}
                              </td>
                              <td className="px-1 py-3 text-sm text-right font-medium">
                                {editingColorPrice === `${index}_${colorIndex}` 
                                  ? calculateMargin(editFormData.dealersPrice, editFormData.retailPrice)
                                  : calculateMargin(colorData.dealersPrice, colorData.retailPrice)
                                }
                              </td>
                              <td className="px-1 py-3 text-sm text-center">
                                {editingColorPrice === `${index}_${colorIndex}` ? (
                                  <div className="flex justify-center space-x-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveColorPrice(item, colorData, index, colorIndex);
                                      }}
                                      disabled={savingPriceId === `color_${index}_${colorIndex}`}
                                      className="p-1 text-green-600 hover:text-green-800"
                                      title="Save changes"
                                    >
                                      {savingPriceId === `color_${index}_${colorIndex}` ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                      className="p-1 text-red-600 hover:text-red-800"
                                      title="Cancel edit"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditColorPrice(item, colorData, index, colorIndex);
                                    }}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                    title="Edit color price"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        }
                      </React.Fragment>
                    ))}
                    </tbody>
                </table>
              </div>

              {/* Summary footer */}
              <div className="text-center text-gray-600">
                {Object.values(filters).some(f => f) 
                  ? `Showing ${filteredData.length} of ${phoneData.length} price configurations (filtered)`
                  : `Showing ${filteredData.length} price configurations`}
                {expandedRows.size > 0 && ` • ${expandedRows.size} rows expanded`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceManagementForm;
{/* Part 10 End - Expanded Color Breakdown Rows and Component End */}