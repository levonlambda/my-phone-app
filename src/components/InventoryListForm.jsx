{/* Part 1 Start - Imports and Initial State */}
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Smartphone, RefreshCw, Filter, X, Search } from 'lucide-react';
import InventoryTable from './inventory/InventoryTable';
import InventoryFilters from './inventory/InventoryFilters';

const InventoryListForm = () => {
  // State for inventory data
  const [inventoryItems, setInventoryItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // Store all unfiltered items
  const [loading, setLoading] = useState(false); // Changed to false by default
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('manufacturer');
  const [sortDirection, setSortDirection] = useState('asc');
  const [initialLoad, setInitialLoad] = useState(true); // Track if data has been loaded
  
  // State for filters - UPDATED: Added startDate and endDate
  const [filters, setFilters] = useState({
    manufacturer: '',
    model: '',
    ram: '',
    storage: '',
    status: '',
    minPrice: '',
    maxPrice: '',
    color: '',
    imei1: '',
    barcode: '',
    serialNumber: '', // ADD THIS LINE
    startDate: '',
    endDate: ''
  });
  
  // Separate state for pending filter changes (before debounce) - UPDATED: Added date fields
  const [pendingFilters, setPendingFilters] = useState({
    minPrice: '',
    maxPrice: '',
    imei1: '',
    barcode: '',
    serialNumber: '', // ADD THIS LINE
    startDate: '',
    endDate: ''
  });
  
  // Filter options lists - Updated to use 'Stock' instead of 'On-Hand'
  const [filterOptions, setFilterOptions] = useState({
    manufacturers: [],
    models: [],
    rams: [],
    storages: [],
    colors: [],
    statuses: ['Stock', 'On-Display', 'Sold', 'Reserved', 'Defective']
  });
  
  // Show/hide filters
  const [showFilters, setShowFilters] = useState(true); // Default to showing filters
  
  // Debounce timer ref
  const debounceTimerRef = useRef(null);
{/* Part 1 End - Imports and Initial State */}

{/* Part 2 Start - Helper Functions and Effects */}
  // Format number with commas
  const formatNumberWithCommas = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  // Parse price value for filters
  const parsePrice = (value) => {
    if (!value) return '';
    return value.replace(/,/g, '');
  };

  // Sync filters to pendingFilters when filters change - UPDATED: Added date fields
  useEffect(() => {
    setPendingFilters(prevPending => ({
      ...prevPending,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      imei1: filters.imei1,
      barcode: filters.barcode,
      serialNumber: filters.serialNumber,
      startDate: filters.startDate,
      endDate: filters.endDate
    }));
  }, [filters.minPrice, filters.maxPrice, filters.imei1, filters.barcode, filters.serialNumber, filters.startDate, filters.endDate]);

  // Load manufacturer list on component mount
  useEffect(() => {
    async function loadManufacturers() {
      try {
        const inventoryRef = collection(db, 'inventory');
        const snapshot = await getDocs(inventoryRef);
        
        const manufacturers = [...new Set(
          snapshot.docs.map(doc => doc.data().manufacturer)
        )].filter(Boolean).sort();
        
        setFilterOptions(prev => ({
          ...prev,
          manufacturers
        }));
      } catch (error) {
        console.error("Error loading manufacturers:", error);
      }
    }
    
    loadManufacturers();
  }, []);
{/* Part 2 End - Helper Functions and Effects */}

{/* Part 3 Start - Filter Logic and Handlers */}
  // Apply filters to the data - UPDATED: Fixed date filtering logic
  const applyFilters = useCallback((items) => {
    return items.filter(item => {
      // Apply manufacturer filter
      if (filters.manufacturer && item.manufacturer !== filters.manufacturer) {
        return false;
      }
      
      // Apply model filter
      if (filters.model && item.model !== filters.model) {
        return false;
      }
      
      // Apply RAM filter
      if (filters.ram && item.ram !== filters.ram) {
        return false;
      }
      
      // Apply storage filter
      if (filters.storage && item.storage !== filters.storage) {
        return false;
      }
      
      // Apply status filter - handle both 'Stock' and 'On-Hand'
      if (filters.status) {
        const filterStatus = filters.status === 'Stock' ? 'On-Hand' : filters.status;
        if (item.status !== filterStatus) {
          return false;
        }
      }
      
      // Apply color filter
      if (filters.color && item.color !== filters.color) {
        return false;
      }
      
      // Apply IMEI1 filter (partial match)
      if (filters.imei1 && !item.imei1.includes(filters.imei1)) {
        return false;
      }
      
      // Apply barcode filter (partial match)
      if (filters.barcode && item.barcode && !item.barcode.includes(filters.barcode)) {
        return false;
      }
      
      // Apply serial number filter (partial match)
      if (filters.serialNumber) {
        // If filter is set, item must have a serial number AND it must include the search term
        if (!item.serialNumber || !item.serialNumber.includes(filters.serialNumber)) {
          return false;
        }
      }
      
      // Apply min price filter (using retail price)
      if (filters.minPrice) {
        const minPrice = parseFloat(parsePrice(filters.minPrice));
        if (!isNaN(minPrice) && item.retailPrice < minPrice) {
          return false;
        }
      }
      
      // Apply max price filter (using retail price)
      if (filters.maxPrice) {
        const maxPrice = parseFloat(parsePrice(filters.maxPrice));
        if (!isNaN(maxPrice) && item.retailPrice > maxPrice) {
          return false;
        }
      }

      // FIXED: Apply start date filter (using lastUpdated field) - Now properly inclusive
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0); // Set to start of day
        
        if (item.lastUpdated) {
          // Parse the item date (which is in MM/DD/YYYY format)
          const itemDate = new Date(item.lastUpdated);
          itemDate.setHours(0, 0, 0, 0); // Set to start of day
          
          // Check if item date is before start date (exclusive)
          if (itemDate < startDate) {
            return false;
          }
        }
      }

      // FIXED: Apply end date filter (using lastUpdated field) - Now properly inclusive
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        
        if (item.lastUpdated) {
          // Parse the item date (which is in MM/DD/YYYY format)
          const itemDate = new Date(item.lastUpdated);
          
          // Check if item date is after end date (exclusive)
          if (itemDate > endDate) {
            return false;
          }
        }
      }
      
      // If it passed all filters, include it
      return true;
    });
  }, [filters]);

  // Apply filters when they change AFTER initial data load - MOVED HERE: After applyFilters declaration
  useEffect(() => {
    if (!initialLoad && allItems.length > 0) {
      const filtered = applyFilters(allItems);
      setInventoryItems(filtered);
    }
  }, [filters, allItems, applyFilters, initialLoad]);

  // Load filter options from data
  const loadFilterOptions = useCallback((data) => {
    const manufacturers = [...new Set(data.map(item => item.manufacturer))].sort();
    const models = [...new Set(data.map(item => item.model))].sort();
    const rams = [...new Set(data.map(item => item.ram))].sort();
    const storages = [...new Set(data.map(item => item.storage))].sort();
   
    // For colors, filter based on manufacturer and model if selected
    let filteredData = data;
    if (filters.manufacturer) {
      filteredData = filteredData.filter(item => item.manufacturer === filters.manufacturer);
    }
    if (filters.model) {
      filteredData = filteredData.filter(item => item.model === filters.model);
    }
    
    const colors = [...new Set(filteredData.map(item => item.color))].sort();
    
    setFilterOptions({
      manufacturers,
      models,
      rams,
      storages,
      colors,
      statuses: ['Stock', 'On-Display', 'Sold', 'Reserved', 'Defective']
    });
  }, [filters.manufacturer, filters.model]);

  // Handle filter change - UPDATED: Added date field handling
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // For debounced text inputs (price fields, imei, barcode, dates)
    if (name === 'minPrice' || name === 'maxPrice' || name === 'imei1' || name === 'barcode' || name === 'serialNumber' || name === 'startDate' || name === 'endDate') {
      // For price fields, handle numeric input
      if (name === 'minPrice' || name === 'maxPrice') {
        // Allow only numbers and commas
        const sanitizedValue = value.replace(/[^\d,]/g, '');
        const formattedValue = formatNumberWithCommas(sanitizedValue);
        
        // Update pending value first (for display)
        setPendingFilters(prev => ({
          ...prev,
          [name]: formattedValue
        }));
        
        // Clear any existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Set a new timer to update the actual filter after delay
        debounceTimerRef.current = setTimeout(() => {
          setFilters(prev => ({
            ...prev,
            [name]: formattedValue
          }));
        }, 800); // 800ms delay
      } else if (name === 'startDate' || name === 'endDate') {
        // NEW: Handle date fields with debounce
        setPendingFilters(prev => ({
          ...prev,
          [name]: value
        }));
        
        // Clear any existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Set a new timer to update the actual filter after delay
        debounceTimerRef.current = setTimeout(() => {
          setFilters(prev => ({
            ...prev,
            [name]: value
          }));
        }, 500); // 500ms delay for dates
      } else {
        // For text search fields (IMEI, barcode, serial number)
        setPendingFilters(prev => ({
          ...prev,
          [name]: value
        }));
        
        // Clear any existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Set a new timer to update the actual filter after delay
        debounceTimerRef.current = setTimeout(() => {
          setFilters(prev => ({
            ...prev,
            [name]: value
          }));
        }, 500); // 500ms delay
      }
    } else {
      // For dropdown selects (instant filtering)
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
      
      // Reset color when manufacturer or model changes
      if (name === 'manufacturer' || name === 'model') {
        setFilters(prev => ({
          ...prev,
          color: '',
          [name]: value
        }));
      }
    }
  };

  // Clear all filters - UPDATED: Added date fields
  const clearFilters = () => {
    // Clear both actual filters and pending filters
    setFilters({
      manufacturer: '',
      model: '',
      ram: '',
      storage: '',
      status: '',
      minPrice: '',
      maxPrice: '',
      color: '',
      imei1: '',
      barcode: '',
      serialNumber: '', 
      startDate: '',
      endDate: ''
    });
    
    setPendingFilters({
      minPrice: '',
      maxPrice: '',
      imei1: '',
      barcode: '',
      serialNumber: '',
      startDate: '',
      endDate: ''
    });
    
    // Clear any active debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };
{/* Part 3 End - Filter Logic and Handlers */}

{/* Part 4 Start - Data Fetching Functions */}
  // Fetch inventory data - modified to handle search constraints
  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const inventoryRef = collection(db, 'inventory');
      
      // Build query constraints
      let queryConstraints = [orderBy(sortField, sortDirection)];
      
      // Add filter constraints if specified
      if (filters.manufacturer) {
        queryConstraints.push(where("manufacturer", "==", filters.manufacturer));
      }
      
      if (filters.model) {
        queryConstraints.push(where("model", "==", filters.model));
      }
      
      // Note: Firebase can only perform inequalities on a single field
      // For more complex filtering, we'll do it client-side
      
      // Create query with constraints
      const q = query(inventoryRef, ...queryConstraints);
      const snapshot = await getDocs(q);
      
      const items = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          manufacturer: data.manufacturer || '',
          model: data.model || '',
          ram: data.ram || '',
          storage: data.storage || '',
          color: data.color || '',
          dealersPrice: data.dealersPrice || 0,
          retailPrice: data.retailPrice || 0,
          imei1: data.imei1 || '',
          imei2: data.imei2 || '',  // Also add imei2 while we're at it
          barcode: data.barcode || '',
          serialNumber: data.serialNumber || '', // ADD THIS LINE
          location: data.location || '', // FIXED: Added location field
          supplier: data.supplier || '', // FIXED: Added supplier field
          status: data.status || 'On-Hand',
          dateAdded: data.dateAdded || '',
          lastUpdated: data.lastUpdated || ''
        });
      });
      
      // Store all items
      setAllItems(items);
      
      // Load filter options from the fetched data
      loadFilterOptions(items);
      
      // Apply all filters client-side
      const filteredItems = applyFilters(items);
      setInventoryItems(filteredItems);
      setInitialLoad(false);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      setError(`Error fetching inventory: ${error.message}`);
      setLoading(false);
    }
  }, [sortField, sortDirection, filters.manufacturer, filters.model, loadFilterOptions, applyFilters]);
{/* Part 4 End - Data Fetching Functions */}

{/* Part 5 Start - Event Handlers */}
  // Handle the search button click
  const handleSearch = () => {
    fetchInventoryData();
  };

  // Handle sort change
  const handleSort = (field) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to asc
      setSortField(field);
      setSortDirection('asc');
    }
  };
{/* Part 5 End - Event Handlers */}

{/* Part 6 Start - Main Component JSX */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]" style={{ maxWidth: '1472px' }}>
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Inventory List</CardTitle>
            {!initialLoad && (
              <span className="text-white/80 text-sm">
                ({inventoryItems.length} items)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 ${showFilters ? 
                'bg-white/20 text-white' : 'bg-white text-[rgb(52,69,157)]'} px-4 py-2 rounded text-base font-medium`}
            >
              <Filter className="h-5 w-5 mr-1" />
              <span>Filters</span>
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <Search className="h-5 w-5 mr-1" />
              <span>Search</span>
            </button>
            <button
              onClick={() => fetchInventoryData()}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <RefreshCw className="h-5 w-5 mr-1" />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Filters panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
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
              
              <InventoryFilters 
                filters={filters}
                pendingFilters={pendingFilters}
                filterOptions={filterOptions}
                handleFilterChange={handleFilterChange}
                allItems={allItems}
              />
            </div>
          )}
          {/* Inventory Summary Section */}
          {!initialLoad && inventoryItems.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Inventory Summary</h3>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                {/* Item Count - 25% */}
                <div className="w-full md:w-[25%] bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Item Count</p>
                      <p className="text-xs text-gray-500">Total inventory items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-600">
                        {inventoryItems.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {inventoryItems.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Total Value - 30% */}
                <div className="w-full md:w-[30%] bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Value</p>
                      <p className="text-xs text-gray-500">Combined retail price</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        ₱{(() => {
                          const totalValue = inventoryItems.reduce((total, item) => {
                            return total + (item.retailPrice || 0);
                          }, 0);
                          return totalValue.toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          });
                        })()}
                      </p>
                      <p className="text-xs text-gray-500">retail value</p>
                    </div>
                  </div>
                </div>
                
                {/* Status Breakdown - 45% */}
                <div className="w-full md:w-[45%] bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                  <div className="flex items-start">
                    <div className="mr-4">
                      <p className="text-sm text-gray-600 font-medium">Status Breakdown</p>
                      <p className="text-xs text-gray-500">Items by status</p>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                      {(() => {
                        const statusCounts = inventoryItems.reduce((counts, item) => {
                          const status = item.status || 'Unknown';
                          counts[status] = (counts[status] || 0) + 1;
                          return counts;
                        }, {});
                        
                        // Define order and display names
                        const statusOrder = [
                          { key: 'On-Hand', display: 'Stock' },
                          { key: 'On-Display', display: 'Display' },
                          { key: 'Sold', display: 'Sold' },
                          { key: 'Reserved', display: 'Reserved' },
                          { key: 'Defective', display: 'Defective' }
                        ];
                        
                        return statusOrder
                          .filter(status => statusCounts[status.key] > 0)
                          .map((status) => (
                            <div key={status.key} className="flex items-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                status.key === 'On-Hand' ? 'bg-blue-100 text-blue-700' :
                                status.key === 'On-Display' ? 'bg-yellow-100 text-yellow-700' :
                                status.key === 'Sold' ? 'bg-purple-100 text-purple-700' :
                                status.key === 'Reserved' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {status.display}
                              </span>
                              <span className="font-semibold text-gray-700 ml-1">
                                {statusCounts[status.key]}
                              </span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            {initialLoad ? (
              <div className="text-center py-12">
                <p className="text-lg mb-4">Use the search button to load inventory items</p>
                <p className="text-sm text-gray-500 mb-6">You can apply filters before searching or search all items</p>
                <button
                  onClick={handleSearch}
                  className="bg-[rgb(52,69,157)] text-white px-6 py-2 rounded-md flex items-center mx-auto"
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search All Inventory
                </button>
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-500">No inventory items match your filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <InventoryTable 
                inventoryItems={inventoryItems}
                allItems={allItems}
                setAllItems={setAllItems}
                setInventoryItems={setInventoryItems}
                loading={loading}
                error={error}
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                applyFilters={applyFilters}
              />
            )}
          </div>
          <div className="overflow-x-auto"></div>
          {/* Show loading state */}
          {loading && (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[rgb(52,69,157)]" />
              <p className="text-gray-600 mt-2">Loading inventory items...</p>
            </div>
          )}
          
          {/* Show error state */}
          {error && (
            <div className="text-center py-4 text-red-600">
              <p>{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  fetchInventoryData();
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 underline"
              >
                Try again
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryListForm;
{/* Part 6 End - Main Component JSX */}