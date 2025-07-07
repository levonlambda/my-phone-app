{/* Part 1 Start - Complete File: Imports, State, and Helper Functions */}
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  Smartphone, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  X,
  CircleAlert  // NEW: Added for exclusion info display
} from 'lucide-react';

const InventorySummaryForm = () => {
  // Main state
  const [inventoryData, setInventoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedColorSections, setExpandedColorSections] = useState({});
  
  // NEW: Add state for excluded models info
  const [excludedModelsInfo, setExcludedModelsInfo] = useState([]);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    manufacturer: '',
    model: '',
    ram: '',
    storage: '',
    color: ''
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    manufacturers: [],
    models: [],
    rams: [],
    storages: [],
    colors: []
  });
  
  // Filtered options based on selections
  const [filteredOptions, setFilteredOptions] = useState({
    models: [],
    rams: [],
    storages: [],
    colors: []
  });

  // UPDATED: Add this function to fetch excluded models info for display with useCallback
  const fetchExcludedModelsInfo = useCallback(async () => {
    try {
      const phonesRef = collection(db, 'phones');
      const phonesSnapshot = await getDocs(phonesRef);
      
      const excludedList = [];
      phonesSnapshot.forEach(doc => {
        const phoneData = doc.data();
        if (phoneData.excludeFromSummary === true && phoneData.manufacturer && phoneData.model) {
          excludedList.push({
            manufacturer: phoneData.manufacturer,
            model: phoneData.model
          });
        }
      });
      
      setExcludedModelsInfo(excludedList.sort((a, b) => {
        if (a.manufacturer !== b.manufacturer) {
          return a.manufacturer.localeCompare(b.manufacturer);
        }
        return a.model.localeCompare(b.model);
      }));
    } catch (error) {
      console.error("Error fetching excluded models info:", error);
    }
  }, []);

  // Toggle row expansion (for base configurations)
  const toggleRowExpansion = (index) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
      setExpandedColorSections(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    } else {
      newExpandedRows.add(index);
      setExpandedColorSections(prev => ({
        ...prev,
        [index]: {}
      }));
    }
    setExpandedRows(newExpandedRows);
  };

  // Toggle section expansion for color breakdown
  const toggleColorSectionExpansion = (rowIndex, colorIndex, section) => {
    setExpandedColorSections(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [`${colorIndex}_${section}`]: !prev[rowIndex]?.[`${colorIndex}_${section}`]
      }
    }));
  };

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
      storage: '',
      color: ''
    });
    setFilteredOptions({
      models: filterOptions.models,
      rams: filterOptions.rams,
      storages: filterOptions.storages,
      colors: filterOptions.colors
    });
  };

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price) => {
    if (!price && price !== 0) return 'N/A';
    return `₱${price.toLocaleString()}`;
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
{/* Part 1 End - Complete File: Imports, State, and Helper Functions */}

{/* Part 2 Start - Filter Functions and Updated fetchInventoryData */}
  // Apply filters to data
  const applyFilters = () => {
    if (!inventoryData.length) return;
    const filtered = inventoryData.filter(item => {
      if (filters.manufacturer && item.manufacturer !== filters.manufacturer) return false;
      if (filters.model && item.model !== filters.model) return false;
      if (filters.ram && item.ram !== filters.ram) return false;
      if (filters.storage && item.storage !== filters.storage) return false;
      if (filters.color && !item.colors.some(colorData => colorData.color === filters.color)) return false;
      return true;
    });
    setFilteredData(filtered);
  };
  
  // Update filtered options based on current selections
  const updateFilteredOptions = () => {
    if (!inventoryData.length) return;
    
    let filteredModels = filterOptions.models;
    let filteredRams = filterOptions.rams;
    let filteredStorages = filterOptions.storages;
    let filteredColors = filterOptions.colors;
    
    if (filters.manufacturer) {
      filteredModels = [...new Set(
        inventoryData
          .filter(item => item.manufacturer === filters.manufacturer)
          .map(item => item.model)
      )].sort();
    }
    
    if (filters.manufacturer || filters.model) {
      let filtered = inventoryData;
      if (filters.manufacturer) {
        filtered = filtered.filter(item => item.manufacturer === filters.manufacturer);
      }
      if (filters.model) {
        filtered = filtered.filter(item => item.model === filters.model);
      }
      filteredRams = [...new Set(filtered.map(item => item.ram))].sort();
    }
    
    if (filters.manufacturer || filters.model || filters.ram) {
      let filtered = inventoryData;
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
    
    if (filters.manufacturer || filters.model || filters.ram || filters.storage) {
      let filtered = inventoryData;
      if (filters.manufacturer) {
        filtered = filtered.filter(item => item.manufacturer === filters.manufacturer);
      }
      if (filters.model) {
        filtered = filtered.filter(item => item.model === filters.model);
      }
      if (filters.ram) {
        filtered = filtered.filter(item => item.ram === filters.ram);
      }
      if (filters.storage) {
        filtered = filtered.filter(item => item.storage === filters.storage);
      }
      filteredColors = [...new Set(
        filtered.flatMap(item => item.colors.map(colorData => colorData.color))
      )].sort();
    }
    
    setFilteredOptions({
      models: filteredModels,
      rams: filteredRams,
      storages: filteredStorages,
      colors: filteredColors
    });
  };

  // NEW: Helper function to check if a date is within the current month
  const isWithinCurrentMonth = (dateString) => {
    if (!dateString) return false;
    
    try {
      const itemDate = new Date(dateString);
      const currentDate = new Date();
      
      // Check if dates are valid
      if (isNaN(itemDate.getTime()) || isNaN(currentDate.getTime())) {
        return false;
      }
      
      // Compare year and month
      return itemDate.getFullYear() === currentDate.getFullYear() && 
             itemDate.getMonth() === currentDate.getMonth();
    } catch (error) {
      console.error("Error parsing date:", dateString, error);
      return false;
    }
  };

  // UPDATED: Fetch and process inventory data with exclusion logic, improved sorting, current month sold filter, and useCallback
  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // NEW: First, get the list of excluded models from the phones collection
      const phonesRef = collection(db, 'phones');
      const phonesSnapshot = await getDocs(phonesRef);
      
      const excludedModels = new Set();
      phonesSnapshot.forEach(doc => {
        const phoneData = doc.data();
        // If excludeFromSummary is true, add the manufacturer_model combination to excluded set
        if (phoneData.excludeFromSummary === true && phoneData.manufacturer && phoneData.model) {
          const modelKey = `${phoneData.manufacturer}_${phoneData.model}`;
          excludedModels.add(modelKey);
          console.log(`Excluding model from summary: ${phoneData.manufacturer} ${phoneData.model}`);
        }
      });
      
      console.log(`Found ${excludedModels.size} excluded models:`, Array.from(excludedModels));
      
      // Now fetch inventory data
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      // Group inventory by manufacturer, model, ram, storage (excluding color)
      const groupedData = {};
      const manufacturers = new Set();
      const models = new Set();
      const rams = new Set();
      const storages = new Set();
      const colors = new Set();
      
      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        
        // NEW: Check if this model should be excluded from summary
        const modelKey = `${item.manufacturer}_${item.model}`;
        if (excludedModels.has(modelKey)) {
          console.log(`Skipping excluded model: ${item.manufacturer} ${item.model}`);
          return; // Skip this item
        }
        
        const baseKey = `${item.manufacturer}_${item.model}_${item.ram}_${item.storage}`;
        
        // Add to filter options
        if (item.manufacturer) manufacturers.add(item.manufacturer);
        if (item.model) models.add(item.model);
        if (item.ram) rams.add(item.ram);
        if (item.storage) storages.add(item.storage);
        if (item.color) colors.add(item.color);
        
        if (!groupedData[baseKey]) {
          groupedData[baseKey] = {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            totalSold: 0,
            totalOnDisplay: 0,
            totalOnHand: 0,
            totalAvailable: 0,
            dealersPrice: item.dealersPrice || 0,
            retailPrice: item.retailPrice || 0,
            colors: {}
          };
        }
        
        // Group by color within each base configuration
        if (!groupedData[baseKey].colors[item.color]) {
          groupedData[baseKey].colors[item.color] = {
            color: item.color,
            sold: 0,
            onDisplay: 0,
            onHand: 0,
            available: 0,
            dealersPrice: item.dealersPrice || 0,
            retailPrice: item.retailPrice || 0,
            soldItems: [],
            onDisplayItems: [],
            onHandItems: []
          };
        }
        
        const colorData = groupedData[baseKey].colors[item.color];
        
        // UPDATED: Count and store items based on status with current month filter for sold items
        switch (item.status) {
          case 'Sold':
            // NEW: Only count and include sold items from the current month
            if (isWithinCurrentMonth(item.lastUpdated)) {
              colorData.sold++;
              groupedData[baseKey].totalSold++;
              colorData.soldItems.push(item);
            }
            break;
          case 'On-Display':
            colorData.onDisplay++;
            groupedData[baseKey].totalOnDisplay++;
            colorData.onDisplayItems.push(item);
            break;
          case 'On-Hand':
            colorData.onHand++;
            groupedData[baseKey].totalOnHand++;
            colorData.onHandItems.push(item);
            break;
        }
        
        colorData.available = colorData.onDisplay + colorData.onHand;
      });
      
      // Process grouped data
      Object.values(groupedData).forEach(group => {
        group.totalAvailable = group.totalOnDisplay + group.totalOnHand;
        
        group.colors = Object.values(group.colors).map(colorData => {
          const sortByLastUpdated = (a, b) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
            const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
            return dateA - dateB;
          };
          
          colorData.soldItems.sort(sortByLastUpdated);
          colorData.onDisplayItems.sort(sortByLastUpdated);
          colorData.onHandItems.sort(sortByLastUpdated);
          
          return colorData;
        }).sort((a, b) => a.color.localeCompare(b.color));
      });
      
      // UPDATED: Helper function to extract numeric value from RAM/storage strings
      const extractNumericValue = (value) => {
        if (!value) return 0;
        // Extract the number from strings like "3GB", "128GB", "1TB", etc.
        const match = value.match(/(\d+(?:\.\d+)?)/);
        if (!match) return 0;
        
        const num = parseFloat(match[1]);
        // Convert TB to GB for consistent comparison
        if (value.toLowerCase().includes('tb')) {
          return num * 1024;
        }
        return num;
      };
      
      // UPDATED: Improved sorting logic with numeric comparison for RAM and storage
      const inventoryArray = Object.values(groupedData).sort((a, b) => {
        // 1. Sort by manufacturer (string comparison)
        if (a.manufacturer !== b.manufacturer) {
          return a.manufacturer.localeCompare(b.manufacturer);
        }
        
        // 2. Sort by model (string comparison)
        if (a.model !== b.model) {
          return a.model.localeCompare(b.model);
        }
        
        // 3. Sort by RAM (numeric comparison - smallest to largest)
        const ramA = extractNumericValue(a.ram);
        const ramB = extractNumericValue(b.ram);
        if (ramA !== ramB) {
          return ramA - ramB; // Ascending order (smallest to largest)
        }
        
        // 4. Sort by storage (numeric comparison - smallest to largest)
        const storageA = extractNumericValue(a.storage);
        const storageB = extractNumericValue(b.storage);
        return storageA - storageB; // Ascending order (smallest to largest)
      });
      
      const filterOpts = {
        manufacturers: [...manufacturers].sort(),
        models: [...models].sort(),
        rams: [...rams].sort(),
        storages: [...storages].sort(),
        colors: [...colors].sort()
      };
      setFilterOptions(filterOpts);
      setFilteredOptions({
        models: filterOpts.models,
        rams: filterOpts.rams,
        storages: filterOpts.storages,
        colors: filterOpts.colors
      });
      
      setInventoryData(inventoryArray);
      setFilteredData(inventoryArray);
      setLoading(false);
      
      // NEW: Log summary of excluded models for debugging
      console.log(`Inventory Summary loaded: ${inventoryArray.length} configurations (${excludedModels.size} models excluded)`);
      console.log(`Sold items filtered to current month only`);
      
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      setError(`Error fetching inventory: ${err.message}`);
      setLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any state or props

  // UPDATED: Effects with proper dependencies to fix React Hook warnings
  useEffect(() => {
    fetchInventoryData();
    fetchExcludedModelsInfo();
  }, [fetchInventoryData, fetchExcludedModelsInfo]); // Both functions are now memoized with useCallback
  
  useEffect(() => {
    updateFilteredOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryData, filters]);
  
  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, inventoryData]);
{/* Part 2 End - Filter Functions and Updated fetchInventoryData */}

{/* Part 3 Start - Loading and Error States */}
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white">Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading inventory data...</p>
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
              onClick={fetchInventoryData}
              className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Inventory Summary</CardTitle>
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
              onClick={fetchInventoryData}
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
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <select name="color" value={filters.color} onChange={handleFilterChange} className="w-full p-2 border rounded">
                  <option value="">All Colors</option>
                  {filteredOptions.colors.map(color => (
                    <option key={color} value={color}>{color}</option>
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

        {/* NEW: Add Excluded Models Info Display */}
        <CardContent className="p-4">
          {excludedModelsInfo.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CircleAlert className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-yellow-800">
                  Excluded Models ({excludedModelsInfo.length})
                </h4>
              </div>
              <div className="text-sm text-yellow-700">
                The following models are excluded from this summary:
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {excludedModelsInfo.map((model, index) => (
                  <span 
                    key={index}
                    className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                  >
                    {model.manufacturer} {model.model}
                  </span>
                ))}
              </div>
            </div>
          )}
{/* Part 3 End - Loading and Error States */}

{/* Part 4 Start - Main Table Content */}
          {filteredData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No inventory data found</h3>
              {Object.values(filters).some(f => f) ? (
                <>
                  <p className="text-gray-500 mb-4">No items match your current filters.</p>
                  <button onClick={clearFilters} className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md">
                    Clear Filters
                  </button>
                </>
              ) : (
                <p className="text-gray-500">There are no inventory items in the database.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Inventory list */}
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
                      <th className="pl-12 pr-1 py-3 text-center">Sold</th>
                      <th className="px-1 py-3 text-center">Display</th>
                      <th className="px-1 py-3 text-center">Stock</th>
                      <th className="px-1 py-3 text-center">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((item, index) => (
                      <React.Fragment key={index}>
                        {/* Main row */}
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
                                <span className="inline-block px-2 py-1 text-xs bg-gray-200 rounded">
                                  +{item.colors.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="pl-0 pr-1 py-3 text-sm text-right">{formatPrice(item.dealersPrice)}</td>
                          <td className="px-1 py-3 text-sm text-right">{formatPrice(item.retailPrice)}</td>
                          <td className="px-1 py-3 text-sm text-right font-medium">
                            {calculateMargin(item.dealersPrice, item.retailPrice)}
                          </td>
                          <td className="pl-12 pr-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              {item.totalSold}
                            </span>
                          </td>
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                              {item.totalOnDisplay}
                            </span>
                          </td>
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {item.totalOnHand}
                            </span>
                          </td>
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              {item.totalAvailable}
                            </span>
                          </td>
                        </tr> {/* Part 5 Start - Expanded Color Breakdown Section */}
                        
                        {/* Expanded color breakdown */}
                        {expandedRows.has(index) && (
                          <tr>
                            <td colSpan="12" className="px-0 py-0 border-b border-gray-200">
                              <div className="px-4 pb-4 pt-2 bg-gray-100">
                                <div className="space-y-4">
                                  <h4 className="font-semibold text-gray-700 mb-3">
                                    Color Breakdown ({item.colors.length} colors)
                                  </h4>
                                  
                                  {item.colors.map((colorData, colorIndex) => (
                                    <div key={colorIndex} className="border border-gray-200 rounded-lg bg-white">
                                      {/* Color header */}
                                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-4">
                                            <h5 className="font-bold text-lg text-gray-800">{colorData.color}</h5>
                                            <div className="flex gap-4 text-sm">
                                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                                Sold: {colorData.sold}
                                              </span>
                                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                                Display: {colorData.onDisplay}
                                              </span>
                                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                Stock: {colorData.onHand}
                                              </span>
                                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                                Available: {colorData.available}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {formatPrice(colorData.retailPrice)} • {calculateMargin(colorData.dealersPrice, colorData.retailPrice)} margin
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Color details sections */}
                                      <div className="p-4 space-y-3">
                                        {/* Sold Items */}
                                        {colorData.soldItems.length > 0 && (
                                          <div>
                                            <div 
                                              className="flex items-center justify-between cursor-pointer bg-purple-50 p-2 rounded-t border border-purple-200"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleColorSectionExpansion(index, colorIndex, 'sold');
                                              }}
                                            >
                                              <h6 className="font-semibold text-purple-700">
                                                Sold Units ({colorData.sold})
                                              </h6>
                                              {expandedColorSections[index]?.[`${colorIndex}_sold`] ? (
                                                <ChevronDown className="h-4 w-4 text-purple-500" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-purple-500" />
                                              )}
                                            </div>
                                            
                                            {expandedColorSections[index]?.[`${colorIndex}_sold`] && (
                                              <div className="overflow-x-auto border border-t-0 border-purple-200 rounded-b">
                                                <table className="min-w-full">
                                                  <thead className="bg-purple-50">
                                                    <tr className="text-xs text-purple-800">
                                                      <th className="py-2 px-3 text-left border-b">IMEI1</th>
                                                      <th className="py-2 px-3 text-left border-b">IMEI2</th>
                                                      <th className="py-2 px-3 text-left border-b">Barcode</th>
                                                      <th className="py-2 px-3 text-right border-b">Retail Price</th>
                                                      <th className="py-2 px-3 text-left border-b">Last Updated</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white">
                                                    {colorData.soldItems.map((soldItem, soldIndex) => (
                                                      <tr key={soldIndex} className={soldIndex % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                                                        <td className="py-2 px-3 text-xs">{soldItem.imei1 || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs">{soldItem.imei2 || '-'}</td>
                                                        <td className="py-2 px-3 text-xs">{soldItem.barcode || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs text-right">{formatPrice(soldItem.retailPrice)}</td>
                                                        <td className="py-2 px-3 text-xs">{formatDate(soldItem.lastUpdated)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* On Display Items */}
                                        {colorData.onDisplayItems.length > 0 && (
                                          <div>
                                            <div 
                                              className="flex items-center justify-between cursor-pointer bg-yellow-50 p-2 rounded-t border border-yellow-200"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleColorSectionExpansion(index, colorIndex, 'display');
                                              }}
                                            >
                                              <h6 className="font-semibold text-yellow-700">
                                                Display Units ({colorData.onDisplay})
                                              </h6>
                                              {expandedColorSections[index]?.[`${colorIndex}_display`] ? (
                                                <ChevronDown className="h-4 w-4 text-yellow-500" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-yellow-500" />
                                              )}
                                            </div>
                                            
                                            {expandedColorSections[index]?.[`${colorIndex}_display`] && (
                                              <div className="overflow-x-auto border border-t-0 border-yellow-200 rounded-b">
                                                <table className="min-w-full">
                                                  <thead className="bg-yellow-50">
                                                    <tr className="text-xs text-yellow-800">
                                                      <th className="py-2 px-3 text-left border-b">IMEI1</th>
                                                      <th className="py-2 px-3 text-left border-b">IMEI2</th>
                                                      <th className="py-2 px-3 text-left border-b">Barcode</th>
                                                      <th className="py-2 px-3 text-right border-b">Retail Price</th>
                                                      <th className="py-2 px-3 text-left border-b">Last Updated</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white">
                                                    {colorData.onDisplayItems.map((displayItem, displayIndex) => (
                                                      <tr key={displayIndex} className={displayIndex % 2 === 0 ? 'bg-white' : 'bg-yellow-50'}>
                                                        <td className="py-2 px-3 text-xs">{displayItem.imei1 || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs">{displayItem.imei2 || '-'}</td>
                                                        <td className="py-2 px-3 text-xs">{displayItem.barcode || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs text-right">{formatPrice(displayItem.retailPrice)}</td>
                                                        <td className="py-2 px-3 text-xs">{formatDate(displayItem.lastUpdated)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* On Hand Items */}
                                        {colorData.onHandItems.length > 0 && (
                                          <div>
                                            <div 
                                              className="flex items-center justify-between cursor-pointer bg-blue-50 p-2 rounded-t border border-blue-200"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleColorSectionExpansion(index, colorIndex, 'stock');
                                              }}
                                            >
                                              <h6 className="font-semibold text-blue-700">
                                                Stock Units ({colorData.onHand})
                                              </h6>
                                              {expandedColorSections[index]?.[`${colorIndex}_stock`] ? (
                                                <ChevronDown className="h-4 w-4 text-blue-500" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-blue-500" />
                                              )}
                                            </div>
                                            
                                            {expandedColorSections[index]?.[`${colorIndex}_stock`] && (
                                              <div className="overflow-x-auto border border-t-0 border-blue-200 rounded-b">
                                                <table className="min-w-full">
                                                  <thead className="bg-blue-50">
                                                    <tr className="text-xs text-blue-800">
                                                      <th className="py-2 px-3 text-left border-b">IMEI1</th>
                                                      <th className="py-2 px-3 text-left border-b">IMEI2</th>
                                                      <th className="py-2 px-3 text-left border-b">Barcode</th>
                                                      <th className="py-2 px-3 text-right border-b">Retail Price</th>
                                                      <th className="py-2 px-3 text-left border-b">Last Updated</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white">
                                                    {colorData.onHandItems.map((handItem, handIndex) => (
                                                      <tr key={handIndex} className={handIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                                        <td className="py-2 px-3 text-xs">{handItem.imei1 || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs">{handItem.imei2 || '-'}</td>
                                                        <td className="py-2 px-3 text-xs">{handItem.barcode || 'N/A'}</td>
                                                        <td className="py-2 px-3 text-xs text-right">{formatPrice(handItem.retailPrice)}</td>
                                                        <td className="py-2 px-3 text-xs">{formatDate(handItem.lastUpdated)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Empty states */}
                                        {colorData.soldItems.length === 0 && colorData.onDisplayItems.length === 0 && colorData.onHandItems.length === 0 && (
                                          <div className="text-center py-4 text-gray-500">
                                            No detailed information available for this color
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
{/* Part 5 End - Expanded Color Breakdown Section */}

{/* Part 6 Start - Inventory Value Summary and Footer */}
              {/* Inventory Value Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Inventory Value Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">{"Total Dealer's Value"}</p>
                        <p className="text-xs text-gray-500">{"(Available units × Dealer's price)"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">
                          {(() => {
                            const totalDealerValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.dealersPrice);
                            }, 0);
                            return formatPrice(totalDealerValue);
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {filteredData.reduce((total, item) => total + item.totalAvailable, 0)} units
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Total Retail Value</p>
                        <p className="text-xs text-gray-500">{"(Available units × Retail price)"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          {(() => {
                            const totalRetailValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.retailPrice);
                            }, 0);
                            return formatPrice(totalRetailValue);
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {filteredData.reduce((total, item) => total + item.totalAvailable, 0)} units
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Potential Profit</p>
                        <p className="text-xs text-gray-500">{"(Retail value - Dealer's value)"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-purple-600">
                          {(() => {
                            const totalDealerValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.dealersPrice);
                            }, 0);
                            const totalRetailValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.retailPrice);
                            }, 0);
                            const potentialProfit = totalRetailValue - totalDealerValue;
                            return formatPrice(potentialProfit);
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(() => {
                            const totalDealerValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.dealersPrice);
                            }, 0);
                            const totalRetailValue = filteredData.reduce((total, item) => {
                              return total + (item.totalAvailable * item.retailPrice);
                            }, 0);
                            const marginPercentage = totalDealerValue > 0 ? 
                              ((totalRetailValue - totalDealerValue) / totalDealerValue * 100) : 0;
                            return `${marginPercentage.toFixed(3)}% margin`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary footer */}
              <div className="text-center text-gray-600">
                {Object.values(filters).some(f => f) 
                  ? `Showing ${filteredData.length} of ${inventoryData.length} inventory configurations (filtered)`
                  : `Showing ${filteredData.length} inventory configurations`}
                {expandedRows.size > 0 && ` • ${expandedRows.size} rows expanded`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventorySummaryForm;
{/* Part 6 End - Inventory Value Summary and Footer */}