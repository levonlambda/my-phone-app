{/* Part 1 Start - Imports */}
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Smartphone, RefreshCw, Search, Filter, X, Eye, SlidersHorizontal, Edit } from 'lucide-react';
import PhoneDetailModal from './phone-list/PhoneDetailModal';
import PhoneAdvancedSearch from './phone-list/PhoneAdvancedSearch';
import { useGlobalState } from '../context/GlobalStateContext';
{/* Part 1 End - Imports */}

{/* Part 2 Start - Component Definition */}
const PhoneListForm = () => {
{/* Part 2 End - Component Definition */}

  {/* Part 3 Start - State Management */}
  // Get global state functions
  const { editPhone } = useGlobalState();
  
  // State for phones data
  const [phones, setPhones] = useState([]);
  const [filteredPhones, setFilteredPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('manufacturer');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // State for filters
  const [filters, setFilters] = useState({
    manufacturer: '',
    searchTerm: ''
  });
  
  // Filter options
  const [manufacturers, setManufacturers] = useState([]);
  
  // Show/hide filters
  const [showFilters, setShowFilters] = useState(true);
  
  // Advanced search modal state
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState(null);
  
  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState(null);
  {/* Part 3 End - State Management */}

  {/* Part 4 Start - Filter and Search Functions */}
  // Apply filters function defined before fetchPhones to avoid dependency issues
  const applyFilters = useCallback((phonesData) => {
    let filtered = [...phonesData];
    
    // Apply basic filters
    // Apply manufacturer filter
    if (filters.manufacturer) {
      filtered = filtered.filter(phone => 
        phone.manufacturer === filters.manufacturer
      );
    }
    
    // Apply search term filter (search across multiple fields)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(phone => 
        phone.manufacturer?.toLowerCase().includes(searchLower) ||
        phone.model?.toLowerCase().includes(searchLower) ||
        phone.chipset?.toLowerCase().includes(searchLower) ||
        phone.display?.toLowerCase().includes(searchLower) ||
        (Array.isArray(phone.colors) && phone.colors.some(color => 
          color.toLowerCase().includes(searchLower)
        ))
      );
    }
    
    // Apply advanced search criteria if present
    if (advancedSearchCriteria) {
      // Manufacturer filter (if not already applied in basic filters)
      if (advancedSearchCriteria.manufacturer && !filters.manufacturer) {
        filtered = filtered.filter(phone => 
          phone.manufacturer === advancedSearchCriteria.manufacturer
        );
      }
      
      // Model filter
      if (advancedSearchCriteria.model) {
        const modelSearch = advancedSearchCriteria.model.toLowerCase();
        filtered = filtered.filter(phone => 
          phone.model?.toLowerCase().includes(modelSearch)
        );
      }
      
      // RAM filter
      if (advancedSearchCriteria.ram) {
        const ramSearch = advancedSearchCriteria.ram.toLowerCase();
        filtered = filtered.filter(phone => 
          Array.isArray(phone.storage_extra) && 
          phone.storage_extra.some(ram => ram.toLowerCase().includes(ramSearch))
        );
      }
      
      // Storage filter
      if (advancedSearchCriteria.storage) {
        const storageSearch = advancedSearchCriteria.storage.toLowerCase();
        filtered = filtered.filter(phone => 
          Array.isArray(phone.storage) && 
          phone.storage.some(storage => storage.toLowerCase().includes(storageSearch))
        );
      }
      
      // Display filter
      if (advancedSearchCriteria.display) {
        const displaySearch = advancedSearchCriteria.display.toLowerCase();
        filtered = filtered.filter(phone => 
          phone.display?.toLowerCase().includes(displaySearch)
        );
      }
      
      // Chipset filter
      if (advancedSearchCriteria.chipset) {
        const chipsetSearch = advancedSearchCriteria.chipset.toLowerCase();
        filtered = filtered.filter(phone => 
          phone.chipset?.toLowerCase().includes(chipsetSearch) ||
          phone.cpu?.toLowerCase().includes(chipsetSearch)
        );
      }
      
      // Battery range filter
      if (advancedSearchCriteria.battery) {
        // Min battery
        if (advancedSearchCriteria.battery.min) {
          const minBattery = parseInt(advancedSearchCriteria.battery.min);
          if (!isNaN(minBattery)) {
            filtered = filtered.filter(phone => 
              phone.battery >= minBattery
            );
          }
        }
        
        // Max battery
        if (advancedSearchCriteria.battery.max) {
          const maxBattery = parseInt(advancedSearchCriteria.battery.max);
          if (!isNaN(maxBattery)) {
            filtered = filtered.filter(phone => 
              phone.battery <= maxBattery
            );
          }
        }
      }
    }
    
    setFilteredPhones(filtered);
  }, [filters, advancedSearchCriteria]);

  // Fetch phones data
  const fetchPhones = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const phonesRef = collection(db, 'phones');
      const q = query(phonesRef, orderBy(sortField, sortDirection));
      const snapshot = await getDocs(q);
      
      const phonesData = [];
      snapshot.forEach(doc => {
        phonesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Extract unique manufacturers for filter
      const uniqueManufacturers = [...new Set(phonesData.map(phone => phone.manufacturer))].sort();
      setManufacturers(uniqueManufacturers);
      
      setPhones(phonesData);
      applyFilters(phonesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching phones:", error);
      setError(`Error fetching phones: ${error.message}`);
      setLoading(false);
    }
  }, [sortField, sortDirection, applyFilters]); // Added applyFilters dependency here
  {/* Part 4 End - Filter and Search Functions */}

  {/* Part 5 Start - Event Handlers */}
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
      searchTerm: ''
    });
    setAdvancedSearchCriteria(null);
  };
  
  // Handle advanced search
  const handleAdvancedSearch = (criteria) => {
    setAdvancedSearchCriteria(criteria);
    // Clear basic search term to avoid confusion
    setFilters(prev => ({
      ...prev,
      searchTerm: ''
    }));
  };
  
  // Open advanced search modal
  const openAdvancedSearch = () => {
    setIsAdvancedSearchOpen(true);
  };
  
  // Close advanced search modal
  const closeAdvancedSearch = () => {
    setIsAdvancedSearchOpen(false);
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
  
  // Open detail modal for a phone
  const openPhoneDetail = (phone) => {
    setSelectedPhone(phone);
    setIsDetailModalOpen(true);
  };
  
  // Close detail modal
  const closePhoneDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedPhone(null);
  };
  
  // Handle edit phone
  const handleEditPhone = (phone) => {
    console.log("Editing phone:", phone.id);
    editPhone(phone);
    // No need to manually change location, the context will handle this
  };
  {/* Part 5 End - Event Handlers */}

  {/* Part 6 Start - UseEffect Hooks */}
  // Initial data fetch
  useEffect(() => {
    fetchPhones();
  }, [fetchPhones]);

  // Apply filters when they change
  useEffect(() => {
    if (phones.length > 0) {
      applyFilters(phones);
    }
  }, [filters, phones, applyFilters, advancedSearchCriteria]);
  {/* Part 6 End - UseEffect Hooks */}

  {/* Part 7 Start - Helper Functions */}
  // Format storage array as string
  const formatStorage = (storageArray) => {
    if (!storageArray || !Array.isArray(storageArray)) return '-';
    return storageArray.join(', ');
  };

  // Format RAM array as string
  const formatRAM = (ramArray) => {
    if (!ramArray || !Array.isArray(ramArray)) return '-';
    return ramArray.join(', ');
  };
  {/* Part 7 End - Helper Functions */}

  {/* Part 8 Start - Component Render */}
  // Main component render
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Device Models</CardTitle>
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
              onClick={openAdvancedSearch}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <SlidersHorizontal className="h-5 w-5 mr-1" />
              <span>Advanced</span>
            </button>
            <button
              onClick={fetchPhones}
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
                <div>
                  <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">Filters</h3>
                  {advancedSearchCriteria && (
                    <p className="text-xs text-[rgb(52,69,157)]">Advanced filters active</p>
                  )}
                </div>
                <button 
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-red-500 flex items-center"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {manufacturers.map(manufacturer => (
                      <option key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="searchTerm"
                      value={filters.searchTerm}
                      onChange={handleFilterChange}
                      placeholder="Search phones..."
                      className="w-full p-2 pl-9 border rounded"
                    />
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Empty states and content */}
          {!loading && !error && (
            <>
              {phones.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No devices found</h3>
                  <p className="text-gray-500 mb-4">There are no device models in the database yet.</p>
                  <button
                    onClick={() => window.location.href = '#form'}
                    className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
                  >
                    Add New Device
                  </button>
                </div>
              ) : filteredPhones.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No matching phones</h3>
                  <p className="text-gray-500 mb-4">Try changing your search criteria or clearing filters.</p>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-md border">
                  <table className="w-full border-collapse text-sm table-fixed">
                    <thead>
                      <tr className="bg-gray-100">
                        <th 
                          className="border px-4 py-2 text-left cursor-pointer hover:bg-gray-200 w-[11%]"
                          onClick={() => handleSort('manufacturer')}
                        >
                          Manufacturer
                          {sortField === 'manufacturer' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="border px-4 py-2 text-left cursor-pointer hover:bg-gray-200 w-[11%]"
                          onClick={() => handleSort('model')}
                        >
                          Model
                          {sortField === 'model' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th className="border px-4 py-2 text-left w-[10%]">Display</th>
                        <th className="border px-4 py-2 text-left w-[10%]">RAM</th>
                        <th className="border px-4 py-2 text-left w-[12%]">Storage</th>
                        <th className="border px-4 py-2 text-left w-[15%]">CPU/Chipset</th>
                        <th className="border px-4 py-2 text-left w-[10%]">Battery</th>
                        <th className="border px-4 py-2 text-left w-[13%]">Colors</th>
                        <th className="border px-4 py-2 text-center w-[8%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPhones.map((phone) => (
                        <tr key={phone.id} className="hover:bg-gray-50">
                          <td className="border px-4 py-2">{phone.manufacturer}</td>
                          <td className="border px-4 py-2 font-medium">{phone.model}</td>
                          <td className="border px-4 py-2 truncate max-w-[150px]">{phone.display || '-'}</td>
                          <td className="border px-4 py-2 whitespace-nowrap">{formatRAM(phone.storage_extra)}</td>
                          <td className="border px-4 py-2 whitespace-nowrap">{formatStorage(phone.storage)}</td>
                          <td className="border px-4 py-2 truncate max-w-[200px]">{phone.chipset || phone.cpu || '-'}</td>
                          <td className="border px-4 py-2 whitespace-nowrap">{phone.battery ? `${phone.battery} mAh` : '-'}</td>
                          <td className="border px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(phone.colors) ? (
                                phone.colors.length > 0 ? (
                                  phone.colors.slice(0, 3).map((color, index) => (
                                    <span 
                                      key={index} 
                                      className="inline-block px-2 py-1 text-xs bg-gray-100 rounded"
                                    >
                                      {color}
                                    </span>
                                  ))
                                ) : '-'
                              ) : '-'}
                              {Array.isArray(phone.colors) && phone.colors.length > 3 && (
                                <span className="inline-block px-2 py-1 text-xs bg-gray-100 rounded">
                                  +{phone.colors.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border px-4 py-2 text-center">
                            <div className="flex justify-center space-x-3">
                              <button
                                onClick={() => openPhoneDetail(phone)}
                                className="p-1 text-[rgb(52,69,157)] hover:text-[rgb(80,100,200)]"
                                title="View details"
                              >
                                <Eye className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleEditPhone(phone)}
                                className="p-1 text-[rgb(52,69,157)] hover:text-[rgb(80,100,200)]"
                                title="Edit phone"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="p-4 flex justify-between items-center text-gray-600">
                    <div>
                      Showing {filteredPhones.length} of {phones.length} phones
                    </div>
                    {advancedSearchCriteria && (
                      <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                        Advanced filters applied
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Loading state */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading phones...</p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="text-center py-8 text-red-600">
              <p className="mb-2">{error}</p>
              <button
                onClick={fetchPhones}
                className="mt-2 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
              >
                Try Again
              </button>
            </div>
          )}
          
          {/* Phone Detail Modal */}
          <PhoneDetailModal 
            isOpen={isDetailModalOpen}
            phone={selectedPhone}
            onClose={closePhoneDetail}
          />
          
          {/* Advanced Search Modal */}
          <PhoneAdvancedSearch
            isOpen={isAdvancedSearchOpen}
            onClose={closeAdvancedSearch}
            onSearch={handleAdvancedSearch}
            manufacturers={manufacturers}
          />
        </CardContent>
      </Card>
    </div>
  );
};
{/* Part 8 End - Component Render */}

{/* Part 9 Start - Export */}
export default PhoneListForm;
{/* Part 9 End - Export */}