import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Smartphone, RefreshCw, ChevronDown, ChevronRight, Filter, X } from 'lucide-react';

const InventorySummaryForm = () => {
  // Original state
  const [inventoryData, setInventoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState({});
  
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

  // Toggle row expansion
  const toggleRowExpansion = (index) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
      // When a row is collapsed, also reset its expanded sections
      setExpandedSections(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    } else {
      newExpandedRows.add(index);
      // Initialize section state when row is expanded
      setExpandedSections(prev => ({
        ...prev,
        [index]: { sold: false, display: false, stock: false }
      }));
    }
    setExpandedRows(newExpandedRows);
  };

  // Toggle section expansion
  const toggleSectionExpansion = (rowIndex, section) => {
    setExpandedSections(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [section]: !prev[rowIndex]?.[section]
      }
    }));
  };

  // Handle filter change - UPDATED VERSION
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // Simply update the filter value - no cascading clearing
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear all filters - UPDATED VERSION
  const clearFilters = () => {
    setFilters({
      manufacturer: '',
      model: '',
      ram: '',
      storage: '',
      color: ''
    });
    
    // Reset filtered options to show all options
    setFilteredOptions({
      models: filterOptions.models,
      rams: filterOptions.rams,
      storages: filterOptions.storages,
      colors: filterOptions.colors
    });
  };

  // Utility functions
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Try to parse the date
    try {
      const date = new Date(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return dateString; // If invalid, just return the original string
      }
      
      // Format as MM/DD/YYYY
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      // If any error occurs, return the original string
      return dateString;
    }
  };

  // Format price
  const formatPrice = (price) => {
    if (!price && price !== 0) return 'N/A';
    return `₱${price.toLocaleString()}`;
  };

  // Calculate margin percentage
  const calculateMargin = (dealersPrice, retailPrice) => {
    if (!dealersPrice || !retailPrice) return 'N/A';
    
    // Convert to numbers if they're strings
    const costPrice = typeof dealersPrice === 'string' ? parseFloat(dealersPrice.replace(/[^\d.-]/g, '')) : dealersPrice;
    const sellPrice = typeof retailPrice === 'string' ? parseFloat(retailPrice.replace(/[^\d.-]/g, '')) : retailPrice;
    
    if (costPrice <= 0) return 'N/A';
    
    const marginAmount = sellPrice - costPrice;
    const marginPercentage = (marginAmount / costPrice) * 100;
    
    return `${marginPercentage.toFixed(2)}%`;
  };

  // Format RAM and Storage with GB
  const formatWithGB = (value) => {
    if (!value) return 'N/A';
    
    // If the value already contains GB or TB, return as is
    if (value.includes('GB') || value.includes('TB') || value.includes('gb') || value.includes('tb')) {
      return value;
    }
    
    // Otherwise add GB
    return `${value}GB`;
  };

  // Apply filters to data
  const applyFilters = () => {
    if (!inventoryData.length) return;
    
    const filtered = inventoryData.filter(item => {
      // Skip filters that are not set
      if (filters.manufacturer && item.manufacturer !== filters.manufacturer) return false;
      if (filters.model && item.model !== filters.model) return false;
      if (filters.ram && item.ram !== filters.ram) return false;
      if (filters.storage && item.storage !== filters.storage) return false;
      if (filters.color && item.color !== filters.color) return false;
      return true;
    });
    
    setFilteredData(filtered);
  };
  
  // Update filtered options based on current selections - UPDATED VERSION
  const updateFilteredOptions = () => {
    if (!inventoryData.length) return;
    
    // Start with all available options
    let filteredModels = filterOptions.models;
    let filteredRams = filterOptions.rams;
    let filteredStorages = filterOptions.storages;
    let filteredColors = filterOptions.colors;
    
    // Filter models based on selected manufacturer (if any)
    if (filters.manufacturer) {
      filteredModels = [...new Set(
        inventoryData
          .filter(item => item.manufacturer === filters.manufacturer)
          .map(item => item.model)
      )].sort();
    }
    
    // Filter RAM options based on selected manufacturer and/or model (if any)
    if (filters.manufacturer || filters.model) {
      let filtered = inventoryData;
      
      if (filters.manufacturer) {
        filtered = filtered.filter(item => item.manufacturer === filters.manufacturer);
      }
      
      if (filters.model) {
        filtered = filtered.filter(item => item.model === filters.model);
      }
      
      filteredRams = [...new Set(
        filtered.map(item => item.ram)
      )].sort();
    }
    
    // Filter storage options based on selected manufacturer, model, and/or RAM (if any)
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
      
      filteredStorages = [...new Set(
        filtered.map(item => item.storage)
      )].sort();
    }
    
    // Filter color options based on all previous selections (if any)
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
        filtered.map(item => item.color)
      )].sort();
    }
    
    // Update filtered options
    setFilteredOptions({
      models: filteredModels,
      rams: filteredRams,
      storages: filteredStorages,
      colors: filteredColors
    });
  };
  // Fetch and process inventory data
  const fetchInventoryData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      // Group inventory by model, ram, storage, and color
      const groupedData = {};
      
      // For filter options
      const manufacturers = new Set();
      const models = new Set();
      const rams = new Set();
      const storages = new Set();
      const colors = new Set();
      
      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        
        // Create a unique key for each configuration
        const key = `${item.manufacturer}_${item.model}_${item.ram}_${item.storage}_${item.color}`;
        
        // Add to filter options
        if (item.manufacturer) manufacturers.add(item.manufacturer);
        if (item.model) models.add(item.model);
        if (item.ram) rams.add(item.ram);
        if (item.storage) storages.add(item.storage);
        if (item.color) colors.add(item.color);
        
        if (!groupedData[key]) {
          groupedData[key] = {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
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
        
        // Count and store items based on status
        switch (item.status) {
          case 'Sold':
            groupedData[key].sold++;
            groupedData[key].soldItems.push(item);
            break;
          case 'On-Display':
            groupedData[key].onDisplay++;
            groupedData[key].onDisplayItems.push(item);
            break;
          case 'On-Hand':
            groupedData[key].onHand++;
            groupedData[key].onHandItems.push(item);
            break;
        }
        
        // Calculate available (On-Display + On-Hand)
        groupedData[key].available = groupedData[key].onDisplay + groupedData[key].onHand;
      });
      
      // Sort items in each group by lastUpdated
      Object.values(groupedData).forEach(group => {
        // Sort function for date strings (earliest first)
        const sortByLastUpdated = (a, b) => {
          const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
          const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
          return dateA - dateB; // Ascending order (oldest first)
        };
        
        // Sort all item arrays
        group.soldItems.sort(sortByLastUpdated);
        group.onDisplayItems.sort(sortByLastUpdated);
        group.onHandItems.sort(sortByLastUpdated);
      });
      
      // Convert to array and sort
      const inventoryArray = Object.values(groupedData).sort((a, b) => {
        // Sort by manufacturer, then model, then RAM, then storage, then color
        if (a.manufacturer !== b.manufacturer) {
          return a.manufacturer.localeCompare(b.manufacturer);
        }
        if (a.model !== b.model) {
          return a.model.localeCompare(b.model);
        }
        if (a.ram !== b.ram) {
          return a.ram.localeCompare(b.ram);
        }
        if (a.storage !== b.storage) {
          return a.storage.localeCompare(b.storage);
        }
        return a.color.localeCompare(b.color);
      });
      
      // Update filter options
      const filterOpts = {
        manufacturers: [...manufacturers].sort(),
        models: [...models].sort(),
        rams: [...rams].sort(),
        storages: [...storages].sort(),
        colors: [...colors].sort()
      };
      setFilterOptions(filterOpts);
      
      // Initialize filtered options with all options
      setFilteredOptions({
        models: filterOpts.models,
        rams: filterOpts.rams,
        storages: filterOpts.storages,
        colors: filterOpts.colors
      });
      
      setInventoryData(inventoryArray);
      setFilteredData(inventoryArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      setError(`Error fetching inventory: ${err.message}`);
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchInventoryData();
  }, []);
  
  // Update filtered options when inventory data changes
  useEffect(() => {
    updateFilteredOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryData, filters]);
  
  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, inventoryData]);

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
                >
                  <option value="">All Models</option>
                  {filteredOptions.models.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {filters.manufacturer && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing models for {filters.manufacturer}
                  </p>
                )}
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
                >
                  <option value="">All RAM</option>
                  {filteredOptions.rams.map(ram => (
                    <option key={ram} value={ram}>
                      {ram}
                    </option>
                  ))}
                </select>
                {(filters.manufacturer || filters.model) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Filtered by current selections
                  </p>
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
                >
                  <option value="">All Storage</option>
                  {filteredOptions.storages.map(storage => (
                    <option key={storage} value={storage}>
                      {storage}
                    </option>
                  ))}
                </select>
                {(filters.manufacturer || filters.model || filters.ram) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Filtered by current selections
                  </p>
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
                >
                  <option value="">All Colors</option>
                  {filteredOptions.colors.map(color => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
                {(filters.manufacturer || filters.model || filters.ram || filters.storage) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Filtered by current selections
                  </p>
                )}
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

        <CardContent className="p-4">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No inventory data found</h3>
              {Object.values(filters).some(f => f) ? (
                <>
                  <p className="text-gray-500 mb-4">No items match your current filters.</p>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
                  >
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
                      <th className="px-3 py-3 text-left">Color</th>
                      <th className="pl-0 pr-1 py-3 text-right">Dealer&apos;s Price</th>
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
                          <td className="px-3 py-3 text-sm">{item.color}</td>
                          <td className="pl-0 pr-1 py-3 text-sm text-right">{formatPrice(item.dealersPrice)}</td>
                          <td className="px-1 py-3 text-sm text-right">{formatPrice(item.retailPrice)}</td>
                          <td className="px-1 py-3 text-sm text-right font-medium">
                            {calculateMargin(item.dealersPrice, item.retailPrice)}
                          </td>
                          
                          <td className="pl-12 pr-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              {item.sold}
                            </span>
                          </td>
                          
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                              {item.onDisplay}
                            </span>
                          </td>
                          
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {item.onHand}
                            </span>
                          </td>
                          
                          <td className="px-1 py-2 text-sm text-center">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              {item.available}
                            </span>
                          </td>
                        </tr>
                        {/* Expanded details */}
                        {expandedRows.has(index) && (
                          <tr>
                            <td colSpan="12" className="px-0 py-0 border-b border-gray-200">
                              <div className="px-4 pb-4 pt-2 bg-gray-100">
                                <div className="space-y-4">
                                  
                                  {/* Sold Items */}
                                  {item.soldItems.length > 0 && (
                                    <div>
                                      <div 
                                        className="flex items-center justify-between cursor-pointer bg-purple-50 p-2 rounded-t border border-purple-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSectionExpansion(index, 'sold');
                                        }}
                                      >
                                        <h4 className="font-semibold text-purple-700">
                                          Sold Units ({item.sold})
                                        </h4>
                                        {expandedSections[index]?.sold ? (
                                          <ChevronDown className="h-5 w-5 text-purple-500" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-purple-500" />
                                        )}
                                      </div>
                                      
                                      {expandedSections[index]?.sold && (
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
                                              {item.soldItems.map((soldItem, soldIndex) => (
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
                                  {item.onDisplayItems.length > 0 && (
                                    <div>
                                      <div 
                                        className="flex items-center justify-between cursor-pointer bg-yellow-50 p-2 rounded-t border border-yellow-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSectionExpansion(index, 'display');
                                        }}
                                      >
                                        <h4 className="font-semibold text-yellow-700">
                                          Display Units ({item.onDisplay})
                                        </h4>
                                        {expandedSections[index]?.display ? (
                                          <ChevronDown className="h-5 w-5 text-yellow-500" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-yellow-500" />
                                        )}
                                      </div>
                                      
                                      {expandedSections[index]?.display && (
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
                                              {item.onDisplayItems.map((displayItem, displayIndex) => (
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
                                  {item.onHandItems.length > 0 && (
                                    <div>
                                      <div 
                                        className="flex items-center justify-between cursor-pointer bg-blue-50 p-2 rounded-t border border-blue-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSectionExpansion(index, 'stock');
                                        }}
                                      >
                                        <h4 className="font-semibold text-blue-700">
                                          Stock Units ({item.onHand})
                                        </h4>
                                        {expandedSections[index]?.stock ? (
                                          <ChevronDown className="h-5 w-5 text-blue-500" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-blue-500" />
                                        )}
                                      </div>
                                      
                                      {expandedSections[index]?.stock && (
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
                                              {item.onHandItems.map((handItem, handIndex) => (
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
                                  {item.soldItems.length === 0 && item.onDisplayItems.length === 0 && item.onHandItems.length === 0 && (
                                    <div className="text-center py-4 text-gray-500">
                                      No detailed information available for this configuration
                                    </div>
                                  )}
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