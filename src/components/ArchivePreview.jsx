// ArchivePreview.jsx - Read-Only Archive Preview Component
// Divided into sections for easy maintenance and updates

{/* Part 1 Start - Imports and Dependencies */}
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  RefreshCw, 
  Search, 
  Archive,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  RotateCcw  // ADDED: Missing import for restore icon
} from 'lucide-react';
import archiveService from '../services/archiveService';
{/* Part 1 End - Imports and Dependencies */}

{/* Part 2 Start - Component Definition and State */}
const ArchivePreview = () => {
  // VISIBILITY CONTROL - Set to true to show toggle
  const showModeToggle = false; // ADDED: Flag to hide toggle button
  
  // Main data states
  const [loading, setLoading] = useState(true);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [ineligibleItems, setIneligibleItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  
  // UI states
  const [activeTab, setActiveTab] = useState('eligible');
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEligibleItems, setFilteredEligibleItems] = useState([]);
  
  // Sorting states
  const [sortField, setSortField] = useState('daysSinceUpdate');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Archive operation states (Phase 3)
  const [archiveInProgress, setArchiveInProgress] = useState(false);
  const [archiveResult, setArchiveResult] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Test mode state
  const [testMode, setTestMode] = useState(false); // CHANGED: From true to false for LIVE MODE

  // Phase 4: Restore operation states
  const [showRestoreSearch, setShowRestoreSearch] = useState(false);
  const [restoreSearchTerm, setRestoreSearchTerm] = useState('');
  const [restoreSearchResults, setRestoreSearchResults] = useState(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [itemToRestore, setItemToRestore] = useState(null);

  // Phase 4: Archive table sorting states
  const [archiveSortField, setArchiveSortField] = useState('id');
  const [archiveSortDirection, setArchiveSortDirection] = useState('asc');
{/* Part 2 End - Component Definition and State */}

{/* Part 3 Start - Effects and Data Loading */}
  // Load eligible items on component mount
  useEffect(() => {
    console.log('ArchivePreview component mounted');
    // Set initial mode to LIVE MODE
    archiveService.setTestMode(false); // CHANGED: From true to false for LIVE MODE
    loadEligibleItems();
  }, []);

  // Filter items based on search
  useEffect(() => {
    const filtered = eligibleItems.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.id?.toLowerCase().includes(searchLower) ||
        item.model?.toLowerCase().includes(searchLower) ||
        item.manufacturer?.toLowerCase().includes(searchLower) ||
        item.imei1?.toLowerCase().includes(searchLower) ||
        item.imei2?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredEligibleItems(filtered);
  }, [searchTerm, eligibleItems]);

  // Calculate stats whenever selection changes
  useEffect(() => {
    if (selectedItems.length > 0) {
      const selectedStats = archiveService.calculateArchiveStats(selectedItems);
      setStats(selectedStats);
    } else {
      setStats(null);
    }
  }, [selectedItems]);

  const loadEligibleItems = async () => {
    try {
      console.log('Starting to load eligible items...');
      setLoading(true);
      setError(null);
      const result = await archiveService.getEligibleItems();
      console.log('Loaded items result:', result);
      console.log('Eligible items count:', result.eligible.length);
      console.log('Ineligible items count:', result.ineligible.length);
      setEligibleItems(result.eligible);
      setIneligibleItems(result.ineligible);
      setFilteredEligibleItems(result.eligible);
    } catch (err) {
      console.error('Error loading items:', err);
      setError(`Failed to load items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
{/* Part 3 End - Effects and Data Loading */}

{/* Part 4 Start - Sorting and Selection Handlers */}
  // Sort items by field
  const sortItems = (items, field, direction) => {
    return [...items].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      if (direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Handle sort
  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  // Get sorted items
  const getSortedItems = () => {
    return sortItems(filteredEligibleItems, sortField, sortDirection);
  };

  const handleSelectItem = (item) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(i => i.id === item.id);
      if (isSelected) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredEligibleItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...filteredEligibleItems]);
    }
  };

  const handleSelectByAge = (minDays, maxDays = Infinity) => {
    const filtered = eligibleItems.filter(item => {
      const days = item.daysSinceUpdate;
      return days >= minDays && days <= maxDays;
    });
    setSelectedItems(filtered);
  };

  const handlePreviewArchive = () => {
    const result = archiveService.previewArchive(selectedItems);
    setPreviewResult(result);
  };

  // Phase 3: Handle actual archive operation
  const handleArchiveSelected = async () => {
    setShowConfirmDialog(true);
  };

  const confirmArchive = async () => {
    setShowConfirmDialog(false);
    setArchiveInProgress(true);
    setError(null);
    setArchiveResult(null);
    
    try {
      // CRITICAL SAFETY LOGGING
      console.log('=====================================');
      console.log(`🎯 ARCHIVE MODE: ${testMode ? 'TEST' : 'LIVE'}`);
      console.log(`📂 Will use collection: ${testMode ? 'inventory_test' : 'inventory'}`);
      console.log(`📦 Will archive to: ${testMode ? 'inventory_archives_test' : 'inventory_archives'}`);
      console.log('=====================================');
      console.log('Starting archive operation for', selectedItems.length, 'items');
      
      // Call the validateAndExecute method with safety parameters
      const result = await archiveService.validateAndExecute(
        selectedItems,
        'admin',
        { 
          skipConfirmation: true,
          confirmedLiveMode: !testMode // This skips extra warning in test mode
        }
      );
      
      if (result.success) {
        console.log('Archive successful:', result);
        setArchiveResult(result);
        setSelectedItems([]);
        setPreviewResult(null);
        await loadEligibleItems();
        
        // Show success message WITH MODE
        alert(`Success! Archived ${result.details.itemsArchived} items in ${result.details.batchesCreated} batch(es) to ${testMode ? 'TEST' : 'LIVE'} archive!`);
      } else if (result.cancelled) {
        console.log('Archive cancelled by user');
      } else {
        throw new Error(result.message || 'Archive operation failed');
      }
      
    } catch (error) {
      console.error('Archive operation failed:', error);
      setError(`Archive failed: ${error.message}`);
      alert(`Archive failed: ${error.message}`);
    } finally {
      setArchiveInProgress(false);
    }
  };

  const cancelArchive = () => {
    setShowConfirmDialog(false);
  };
{/* Part 4 End - Sorting and Selection Handlers */}

{/* Part 4.5 Start - Phase 4 Restore Handlers */}
  // Load all archived items
  const loadAllArchivedItems = async () => {
    setRestoreInProgress(true);
    setRestoreSearchResults(null);
    
    try {
      console.log('Loading all archived items...');
      
      // Search with empty criteria to get all items
      const result = await archiveService.searchInArchives({}, { getAllItems: true });
      
      if (result.success) {
        console.log(`Found ${result.totalItems} total items in archives`);
        setRestoreSearchResults(result);
        
        if (result.totalItems === 0) {
          console.log('No items in archives yet');
        }
      } else {
        throw new Error(result.message || 'Failed to load archived items');
      }
      
    } catch (error) {
      console.error('Failed to load archived items:', error);
      alert(`Failed to load archives: ${error.message}`);
    } finally {
      setRestoreInProgress(false);
    }
  };

  // Search for specific items in archives
  const handleSearchArchives = async () => {
    if (!restoreSearchTerm.trim()) {
      // If search is empty, load all items
      await loadAllArchivedItems();
      return;
    }
    
    setRestoreInProgress(true);
    setRestoreSearchResults(null);
    
    try {
      console.log('Searching archives for:', restoreSearchTerm);
      
      // Build search criteria - FIX the IMEI field name
      const searchCriteria = {};
      
      // Determine what type of search this is
      if (restoreSearchTerm.includes('FPH') || restoreSearchTerm.length > 20) {
        // Likely an ID search
        searchCriteria.id = restoreSearchTerm;
      } else if (restoreSearchTerm.length === 15 && /^\d+$/.test(restoreSearchTerm)) {
        // Likely an IMEI search - use imei1 field name to match the actual field
        searchCriteria.imei1 = restoreSearchTerm;
      } else {
        // Generic model/brand search
        searchCriteria.model = restoreSearchTerm;
      }
      
      const result = await archiveService.searchInArchives(searchCriteria);
      
      if (result.success) {
        console.log(`Found ${result.totalItems} items in archives`);
        setRestoreSearchResults(result);
        
        if (result.totalItems === 0) {
          alert('No items found in archives matching your search');
        }
      } else {
        throw new Error(result.message || 'Search failed');
      }
      
    } catch (error) {
      console.error('Archive search failed:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setRestoreInProgress(false);
    }
  };
  
  // Toggle restore search and load all items when opened
  const toggleRestoreSearch = async () => {
    const newState = !showRestoreSearch;
    setShowRestoreSearch(newState);
    
    // When opening, automatically load all archived items
    if (newState) {
      await loadAllArchivedItems();
    } else {
      // When closing, clear the results
      clearRestoreSearch();
    }
  };
  
  // Initiate restore for a specific item
  const handleRestoreItem = (item, batchId) => {
    setItemToRestore({ item, batchId });
    setShowRestoreConfirm(true);
  };
  
  // Confirm and execute restore
  const confirmRestore = async () => {
    if (!itemToRestore) return;
    
    setShowRestoreConfirm(false);
    setRestoreInProgress(true);
    
    try {
      console.log('=====================================');
      console.log(`🔄 RESTORE MODE: ${testMode ? 'TEST' : 'LIVE'}`);
      console.log(`📂 Will restore to: ${testMode ? 'inventory_test' : 'inventory (LIVE)'}`);
      console.log(`📦 Will remove from: ${testMode ? 'inventory_archives_test' : 'inventory_archives'}`);
      console.log('=====================================');
      console.log('Restoring item:', itemToRestore.item.id);
      
      const result = await archiveService.restoreToInventory(
        itemToRestore.item,
        {
          confirmedLiveMode: !testMode
        }
      );
      
      if (result.success) {
        console.log('Restore successful:', result);
        
        // Remove restored item from search results
        if (restoreSearchResults) {
          const updatedResults = {
            ...restoreSearchResults,
            results: restoreSearchResults.results.map(batch => ({
              ...batch,
              items: batch.items.filter(item => item.id !== itemToRestore.item.id)
            })).filter(batch => batch.items.length > 0),
            totalItems: restoreSearchResults.totalItems - 1
          };
          setRestoreSearchResults(updatedResults);
        }
        
        // Refresh eligible items
        await loadEligibleItems();
        
        alert(`Success! Restored item ${itemToRestore.item.id} to ${testMode ? 'TEST' : 'LIVE'} inventory.`);
      } else if (result.cancelled) {
        console.log('Restore cancelled by user');
      } else {
        throw new Error(result.message || 'Restore operation failed');
      }
      
    } catch (error) {
      console.error('Restore operation failed:', error);
      alert(`Restore failed: ${error.message}`);
    } finally {
      setRestoreInProgress(false);
      setItemToRestore(null);
    }
  };
  
  // Cancel restore operation
  const cancelRestore = () => {
    setShowRestoreConfirm(false);
    setItemToRestore(null);
  };
  
  // Clear restore search
  const clearRestoreSearch = () => {
    setRestoreSearchTerm('');
    setRestoreSearchResults(null);
    // Don't hide the interface, just clear the search
  };
  
  // Sort archived items
  const sortArchivedItems = (items, field, direction) => {
    return [...items].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      if (direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };
{/* Part 4.5 End - Phase 4 Restore Handlers */}

{/* Part 5 Start - Utility Functions */}
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₱0.00';
    return `₱${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
{/* Part 5 End - Utility Functions */}

{/* Part 6 Start - Loading and Error States */}
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Archive className="h-6 w-6 mr-2" />
              Archive Preview System
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading eligible items...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-red-600 py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Archive className="h-6 w-6 mr-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={loadEligibleItems}
              className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
{/* Part 6 End - Loading and Error States */}

{/* Part 7 Start - Main Component Render */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        
{/* Part 7.1 Start - Card Header */}
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center justify-between">
            <div className="flex items-center">
              <Archive className="h-6 w-6 mr-2" />
              Archive Preview System
            </div>
            {showModeToggle && ( // ONLY CHANGE: Wrapped in conditional
              <div className="flex items-center gap-3">
                {/* Test Mode Toggle Button */}
                <button
                  onClick={() => {
                    const newTestMode = !testMode;
                    setTestMode(newTestMode);
                    archiveService.setTestMode(newTestMode);
                    loadEligibleItems(); // Reload data with new mode
                  }}
                  className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${
                    testMode 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {testMode ? '🧪 TEST MODE' : '🔴 LIVE MODE'}
                </button>
                
                {/* Status Badge */}
                <span className={`text-sm font-normal px-3 py-1 rounded ${
                  testMode 
                    ? 'bg-green-500/30 text-white border border-green-400' 
                    : 'bg-red-500/30 text-white border border-red-400'
                }`}>
                  {testMode ? 'Using: inventory_test' : 'Using: inventory (LIVE)'}
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
{/* Part 7.1 End - Card Header */}

        <CardContent className="bg-white p-4 space-y-6">
          
{/* Part 8 Start - Archive Summary Section */}
          {/* Archive Summary - Enhanced Design */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Archive Summary</h3>
              <div className="text-sm text-gray-600">
                {searchTerm ? `Filtered Results` : 'All Eligible Items'}
              </div>
            </div>
            
            <div className="flex justify-around items-stretch gap-4">
              <div className="bg-white rounded-lg p-4 shadow-md flex-1">
                <div className="flex items-center justify-between mb-1">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xs text-gray-500">Eligible</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{eligibleItems.length}</p>
                <p className="text-xs text-gray-600">Ready to archive</p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-md flex-1">
                <div className="flex items-center justify-between mb-1">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="text-xs text-gray-500">Too Recent</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{ineligibleItems.length}</p>
                <p className="text-xs text-gray-600">&lt; 60 days old</p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-md flex-1">
                <div className="flex items-center justify-between mb-1">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="text-xs text-gray-500">Selected</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{selectedItems.length}</p>
                <p className="text-xs text-gray-600">For preview</p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-md flex-1">
                <div className="flex items-center justify-between mb-1">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="text-xs text-gray-500">Total Value</span>
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {stats ? formatCurrency(stats.totalValue) : '₱0.00'}
                </p>
                <p className="text-xs text-gray-600">Selected items</p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-md flex-1">
                <div className="flex items-center justify-between mb-1">
                  <Archive className="h-5 w-5 text-indigo-600" />
                  <span className="text-xs text-gray-500">Batches</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600">
                  {stats ? stats.estimatedBatches : 0}
                </p>
                <p className="text-xs text-gray-600">
                  {stats ? `${stats.totalSizeKB}KB / 700KB` : '0KB / 700KB'}
                </p>
              </div>
            </div>
          </div>
{/* Part 8 End - Archive Summary Section */}

{/* Part 9 Start - Search and Filter Controls */}
          {/* Search and Action Buttons */}
          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by ID, Model, Manufacturer, or IMEI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-[rgb(52,69,157)]"
                />
              </div>
              <span className="text-sm text-gray-600">
                {selectedItems.length} of {filteredEligibleItems.length} selected
              </span>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Selection Buttons */}
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 text-sm"
                >
                  {selectedItems.length === filteredEligibleItems.length ? 'Deselect All' : 'Select All'}
                </button>
                
                <button
                  onClick={() => handleSelectByAge(60, 90)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  60-90 days
                </button>
                
                <button
                  onClick={() => handleSelectByAge(90, 120)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  90-120 days
                </button>
                
                <button
                  onClick={() => handleSelectByAge(120)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  120+ days
                </button>

                {/* Refresh Button */}
                <button
                  onClick={loadEligibleItems}
                  disabled={archiveInProgress}
                  className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>

              {/* Archive Action Buttons */}
              {selectedItems.length > 0 && (
                <div className="flex items-center space-x-2">
                  {/* Preview Button */}
                  <button
                    onClick={handlePreviewArchive}
                    disabled={archiveInProgress}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Preview ({selectedItems.length})
                  </button>
                  
                  {/* Archive Button - CHANGED TO GREEN WITHOUT BLINKING */}
                  <button
                    onClick={handleArchiveSelected}
                    disabled={archiveInProgress}
                    className={`px-6 py-2 text-white rounded-lg flex items-center disabled:opacity-50 ${
                      testMode 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-green-600 hover:bg-green-700'  // CHANGED: Now green for both modes, removed animate-pulse
                    }`}
                    title={testMode 
                      ? 'Archive to TEST collection (inventory_archives_test)' 
                      : 'Archive to LIVE collection (inventory_archives)'  // CHANGED: Removed ⚠️
                    }
                  >
                    {archiveInProgress ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                        Archiving...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        {testMode ? (
                          <>Archive Selected (TEST) ({selectedItems.length})</>
                        ) : (
                          <>Archive Selected (LIVE) ({selectedItems.length})</>  // CHANGED: Removed ⚠️ and !
                        )}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Phase 4: Restore Search Button */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleRestoreSearch}
                  disabled={archiveInProgress || restoreInProgress}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {showRestoreSearch ? 'Hide Archive Table' : 'Show Archive Table'}
                </button>
              </div>
            </div>

            {/* Restore Search Interface */}
            {/* Restore Search Interface with Table View */}
            {showRestoreSearch && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Archived Items - Search & Restore
                </h3>
                
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search by Item ID, IMEI, or Model..."
                    value={restoreSearchTerm}
                    onChange={(e) => setRestoreSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchArchives()}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-600"
                    disabled={restoreInProgress}
                  />
                  <button
                    onClick={handleSearchArchives}
                    disabled={restoreInProgress}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {restoreInProgress ? 'Loading...' : 'Search'}
                  </button>
                  {restoreSearchTerm && (
                    <button
                      onClick={clearRestoreSearch}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Clear Search
                    </button>
                  )}
                  <button
                    onClick={loadAllArchivedItems}
                    disabled={restoreInProgress}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2 inline" />
                    Refresh All
                  </button>
                </div>
                
                {/* Archive Items Table */}
                {restoreInProgress && !restoreSearchResults ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="mt-2 text-gray-600">Loading archived items...</p>
                  </div>
                ) : restoreSearchResults ? (
                  <div className="overflow-x-auto">
                    {restoreSearchResults.totalItems === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {restoreSearchTerm 
                          ? `No archived items found matching "${restoreSearchTerm}"`
                          : 'No items in archives yet'}
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 text-sm text-purple-700">
                          Found {restoreSearchResults.totalItems} archived item(s) in {restoreSearchResults.results.length} batch(es)
                          {restoreSearchTerm && ` matching "${restoreSearchTerm}"`}
                        </div>
                        
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-purple-100">
                              <th 
                                className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'id' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('id');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center">
                                  ID
                                  {archiveSortField === 'id' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'model' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('model');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center">
                                  Model
                                  {archiveSortField === 'model' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'status' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('status');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center">
                                  Status
                                  {archiveSortField === 'status' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'imei1' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('imei1');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center">
                                  IMEI
                                  {archiveSortField === 'imei1' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'lastUpdated' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('lastUpdated');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center">
                                  Archived Date
                                  {archiveSortField === 'lastUpdated' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="border px-3 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-purple-200"
                                onClick={() => {
                                  const newDirection = archiveSortField === 'retailPrice' && archiveSortDirection === 'asc' ? 'desc' : 'asc';
                                  setArchiveSortField('retailPrice');
                                  setArchiveSortDirection(newDirection);
                                }}
                              >
                                <div className="flex items-center justify-end">
                                  Price
                                  {archiveSortField === 'retailPrice' && (
                                    <span className="ml-1">{archiveSortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="border px-3 py-3 text-left text-sm font-semibold">
                                Batch ID
                              </th>
                              <th className="border px-3 py-3 text-center text-sm font-semibold">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Flatten all items from all batches for table display
                              const allItems = [];
                              restoreSearchResults.results.forEach((batch) => {
                                batch.items.forEach((item) => {
                                  allItems.push({ ...item, batchId: batch.batchId });
                                });
                              });
                              
                              // Sort the flattened items
                              const sortedItems = sortArchivedItems(allItems, archiveSortField, archiveSortDirection);
                              
                              return sortedItems.map((item, index) => (
                                <tr 
                                  key={`${item.batchId}-${item.id}`}
                                  className={index % 2 === 0 ? 'bg-white' : 'bg-purple-50'}
                                >
                                  <td className="border px-3 py-2 text-sm">{item.id}</td>
                                  <td className="border px-3 py-2 text-sm">
                                    {item.manufacturer} {item.model}
                                  </td>
                                  <td className="border px-3 py-2 text-sm">
                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="border px-3 py-2 text-sm">{item.imei1 || 'N/A'}</td>
                                  <td className="border px-3 py-2 text-sm">{formatDate(item.lastUpdated)}</td>
                                  <td className="border px-3 py-2 text-sm text-right">{formatCurrency(item.retailPrice)}</td>                                  
                                  <td className="border px-3 py-2 text-sm text-gray-600">
                                    {item.batchId.substring(0, 20)}...
                                  </td>
                                  <td className="border px-3 py-2 text-center">
                                    <button
                                      onClick={() => handleRestoreItem(item, item.batchId)}
                                      disabled={restoreInProgress}
                                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                                    >
                                      Restore
                                    </button>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Restore Confirmation Dialog */}
            {showRestoreConfirm && itemToRestore && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <RotateCcw className={`h-5 w-5 mr-2 ${testMode ? 'text-green-600' : 'text-red-600'}`} />
                    Confirm Restore Operation ({testMode ? 'TEST MODE' : '⚠️ LIVE MODE'})
                  </h3>
                  
                  {/* Mode Indicator */}
                  <div className={`mb-4 p-3 rounded-lg ${
                    testMode 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`font-bold ${testMode ? 'text-green-800' : 'text-red-800'}`}>
                      {testMode ? '✅ TEST MODE - Safe to proceed' : '⚠️ LIVE MODE - This will affect PRODUCTION data!'}
                    </p>
                    <p className={`text-sm mt-1 ${testMode ? 'text-green-700' : 'text-red-700'}`}>
                      Restoring to: <code className="font-mono bg-white px-1 rounded">
                        {testMode ? 'inventory_test' : 'inventory (LIVE)'}
                      </code>
                      <br/>
                      Removing from: <code className="font-mono bg-white px-1 rounded">
                        {testMode ? 'inventory_archives_test' : 'inventory_archives (LIVE)'}
                      </code>
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded mb-4">
                    <p className="font-medium text-sm mb-1">Item to Restore:</p>
                    <p className="text-sm text-gray-700">
                      {itemToRestore.item.manufacturer} {itemToRestore.item.model}
                    </p>
                    <p className="text-xs text-gray-600">
                      ID: {itemToRestore.item.id}
                    </p>
                    <p className="text-xs text-gray-600">
                      IMEI: {itemToRestore.item.imei1 || 'N/A'}
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-4">
                    This will restore the item back to active inventory and remove it from the archive.
                  </p>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={cancelRestore}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRestore}
                      className={`px-4 py-2 text-white rounded-lg ${
                        testMode 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-red-600 hover:bg-red-700 animate-pulse'
                      }`}
                    >
                      {testMode ? 'Yes, Restore (TEST)' : '⚠️ Yes, Restore (LIVE!)'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Archive Confirmation Dialog - WITH FULL MODE INDICATORS AND ALL ORIGINAL CONTENT */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <AlertCircle className={`h-5 w-5 mr-2 ${testMode ? 'text-green-600' : 'text-red-600'}`} />
                  Confirm Archive Operation ({testMode ? 'TEST MODE' : '⚠️ LIVE MODE'})
                </h3>
                
                {/* Mode Indicator */}
                <div className={`mb-4 p-3 rounded-lg ${
                  testMode 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`font-bold ${testMode ? 'text-green-800' : 'text-red-800'}`}>
                    {testMode ? '✅ TEST MODE - Safe to proceed' : '⚠️ LIVE MODE - This will affect PRODUCTION data!'}
                  </p>
                  <p className={`text-sm mt-1 ${testMode ? 'text-green-700' : 'text-red-700'}`}>
                    Reading from: <code className="font-mono bg-white px-1 rounded">
                      {testMode ? 'inventory_test' : 'inventory (LIVE)'}
                    </code>
                    <br/>
                    Writing to: <code className="font-mono bg-white px-1 rounded">
                      {testMode ? 'inventory_archives_test' : 'inventory_archives (LIVE)'}
                    </code>
                  </p>
                </div>
                
                {/* THIS IS THE SECTION THAT WAS MISSING - NOW RESTORED */}
                <div className="mb-4 space-y-2">
                  <p className="text-gray-700">
                    You are about to archive <strong>{selectedItems.length} items</strong>.
                  </p>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                    <p className="font-semibold text-yellow-800 mb-1">This will:</p>
                    <ul className="list-disc list-inside text-yellow-700 space-y-1">
                      <li>Move items to {testMode ? 'TEST' : 'LIVE'} archive collection</li>
                      <li>Remove them from {testMode ? 'TEST' : 'LIVE'} inventory</li>
                      <li>Create archive batch document(s)</li>
                    </ul>
                  </div>
                  
                  {!testMode && (
                    <div className="bg-red-100 border-2 border-red-500 rounded p-3">
                      <p className="text-red-600 font-bold text-lg animate-pulse">
                        ⚠️ THIS IS LIVE MODE - PERMANENT CHANGES!
                      </p>
                      <p className="text-red-600 text-sm mt-1">
                        This will modify your PRODUCTION database!
                      </p>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 mb-4">
                  This action will permanently move these items from inventory to the archive collection.
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelArchive}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmArchive}
                    className={`px-4 py-2 text-white rounded-lg ${
                      testMode 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-red-600 hover:bg-red-700 animate-pulse'
                    }`}
                  >
                    {testMode ? 'Yes, Archive (TEST)' : '⚠️ Yes, Archive (LIVE!)'}
                  </button>
                </div>
              </div>
            </div>
          )}
{/* Part 9 End - Search and Filter Controls */}

{/* Part 10 Start - Tab Navigation */}
          {/* Tabs */}
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('eligible')}
              className={`pb-2 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'eligible'
                  ? 'text-[rgb(52,69,157)] border-b-2 border-[rgb(52,69,157)]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Eligible Items ({filteredEligibleItems.length})
            </button>
            <button
              onClick={() => setActiveTab('ineligible')}
              className={`pb-2 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'ineligible'
                  ? 'text-[rgb(52,69,157)] border-b-2 border-[rgb(52,69,157)]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Ineligible Items ({ineligibleItems.length})
            </button>
            {previewResult && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`pb-2 px-4 text-sm font-semibold transition-colors ${
                  activeTab === 'preview'
                    ? 'text-[rgb(52,69,157)] border-b-2 border-[rgb(52,69,157)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Archive Preview
              </button>
            )}
          </div>
{/* Part 10 End - Tab Navigation */}

{/* Part 11 Start - Tab Content Container */}
          {/* Tab Content */}
          <div className="min-h-[400px]">
            
{/* Part 11.1 Start - Eligible Items Table */}
            {activeTab === 'eligible' && (
              <div className="overflow-x-auto">
                {filteredEligibleItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchTerm 
                      ? 'No items match your search criteria'
                      : 'No items eligible for archiving (all sold items are less than 60 days old)'}
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-3 text-left text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={selectedItems.length === filteredEligibleItems.length && filteredEligibleItems.length > 0}
                            onChange={handleSelectAll}
                            className="mr-2"
                          />
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center">
                            ID
                            {sortField === 'id' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('model')}
                        >
                          <div className="flex items-center">
                            Model
                            {sortField === 'model' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center">
                            Status
                            {sortField === 'status' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('imei1')}
                        >
                          <div className="flex items-center">
                            IMEI
                            {sortField === 'imei1' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('daysSinceUpdate')}
                        >
                          <div className="flex items-center">
                            Days Old
                            {sortField === 'daysSinceUpdate' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('lastUpdated')}
                        >
                          <div className="flex items-center">
                            Last Updated
                            {sortField === 'lastUpdated' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('retailPrice')}
                        >
                          <div className="flex items-center justify-end">
                            Price
                            {sortField === 'retailPrice' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="border px-3 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('estimatedSize')}
                        >
                          <div className="flex items-center justify-end">
                            Size (KB)
                            {sortField === 'estimatedSize' && (
                              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedItems().map((item, index) => (
                        <tr 
                          key={item.id} 
                          className={`${
                            selectedItems.some(i => i.id === item.id) 
                              ? 'bg-blue-50' 
                              : index % 2 === 0 
                                ? 'bg-white' 
                                : 'bg-gray-50'
                          } hover:bg-blue-100 transition-colors`}
                        >
                          <td className="border px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedItems.some(i => i.id === item.id)}
                              onChange={() => handleSelectItem(item)}
                            />
                          </td>
                          <td className="border px-3 py-2 text-sm">{item.id}</td>
                          <td className="border px-3 py-2 text-sm">
                            {item.manufacturer} {item.model}
                          </td>
                          <td className="border px-3 py-2 text-sm">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                              {item.status}
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm">{item.imei1}</td>
                          <td className="border px-3 py-2 text-sm">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              {item.daysSinceUpdate} days
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm">{formatDate(item.lastUpdated)}</td>
                          <td className="border px-3 py-2 text-sm text-right">{formatCurrency(item.retailPrice)}</td>
                          <td className="border px-3 py-2 text-sm text-right">
                            {(item.estimatedSize / 1024).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
{/* Part 11.1 End - Eligible Items Table */}

{/* Part 11.2 Start - Ineligible Items Table */}
            {activeTab === 'ineligible' && (
              <div className="overflow-x-auto">
                {ineligibleItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No ineligible items found
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-3 text-left text-sm font-semibold">ID</th>
                        <th className="border px-3 py-3 text-left text-sm font-semibold">Model</th>
                        <th className="border px-3 py-3 text-left text-sm font-semibold">Status</th>
                        <th className="border px-3 py-3 text-left text-sm font-semibold">Days Old</th>
                        <th className="border px-3 py-3 text-left text-sm font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ineligibleItems.map((item, index) => (
                        <tr 
                          key={item.id}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="border px-3 py-2 text-sm">{item.id}</td>
                          <td className="border px-3 py-2 text-sm">
                            {item.manufacturer} {item.model}
                          </td>
                          <td className="border px-3 py-2 text-sm">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {item.status}
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm">
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                              {item.daysSinceUpdate} days
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm text-red-600">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
{/* Part 11.2 End - Ineligible Items Table */}

{/* Part 11.3 Start - Archive Preview Results */}
            {activeTab === 'preview' && previewResult && (
              <div className="space-y-6">
                {previewResult.success ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <h3 className="text-lg font-semibold text-green-800">
                          Archive Preview Generated Successfully
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Items to Archive</p>
                        <p className="text-2xl font-bold text-gray-800">{previewResult.details.itemCount}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Number of Batches</p>
                        <p className="text-2xl font-bold text-gray-800">{previewResult.details.batchCount}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Value</p>
                        <p className="text-xl font-bold text-gray-800">{formatCurrency(previewResult.details.totalValue)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Margin</p>
                        <p className="text-xl font-bold text-gray-800">{formatCurrency(previewResult.details.totalMargin)}</p>
                      </div>
                    </div>

                    {previewResult.details.warning && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                          <p className="text-sm text-yellow-800">{previewResult.details.warning}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-lg font-semibold mb-3">Batch Details</h4>
                      <div className="space-y-2">
                        {previewResult.details.batches.map((batch, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
                            <span className="font-medium text-gray-700">{batch.documentId}</span>
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-gray-600">{batch.itemCount} items</span>
                              <span className={`text-sm font-medium ${
                                batch.withinLimit ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                {batch.sizeKB} KB
                              </span>
                              {!batch.withinLimit && (
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                      <Archive className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <p className="text-green-800 font-medium mb-3">
                        ✅ Archive functionality is now active!
                      </p>
                      <p className="text-green-700 text-sm">
                        Use the "Archive Selected" button above to permanently move these items to the archive collection.
                      </p>
                      <p className="text-orange-600 text-sm mt-2 font-semibold">
                        ⚠️ Remember: Always ensure you have a backup before archiving!
                      </p>
                    </div>

                    {/* Show Archive Result if Available */}
                    {archiveResult && archiveResult.success && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                          <h4 className="text-lg font-semibold text-blue-800">Last Archive Operation</h4>
                        </div>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p>✓ Archived {archiveResult.details.itemsArchived} items</p>
                          <p>✓ Created {archiveResult.details.batchesCreated} batch(es)</p>
                          <p>✓ Operation took {archiveResult.details.duration}ms</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      <h3 className="text-lg font-semibold text-red-800">Preview Failed</h3>
                    </div>
                    <p className="text-red-700 mb-3">{previewResult.message}</p>
                    {previewResult.errors && (
                      <ul className="space-y-1">
                        {previewResult.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-600 pl-4">• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
{/* Part 11.3 End - Archive Preview Results */}

          </div>
{/* Part 11 End - Tab Content Container */}

        </CardContent>
      </Card>
    </div>
  );
};

export default ArchivePreview;
{/* Component End */}