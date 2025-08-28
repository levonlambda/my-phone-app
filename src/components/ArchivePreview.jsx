// ArchivePreview.jsx - Read-Only Archive Preview Component
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
  DollarSign
} from 'lucide-react';
import archiveService from '../services/archiveService';

const ArchivePreview = () => {
  const [loading, setLoading] = useState(true);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [ineligibleItems, setIneligibleItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [activeTab, setActiveTab] = useState('eligible');
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEligibleItems, setFilteredEligibleItems] = useState([]);
  const [sortField, setSortField] = useState('daysSinceUpdate');
  const [sortDirection, setSortDirection] = useState('desc');

  // Load eligible items on component mount
  useEffect(() => {
    console.log('ArchivePreview component mounted');
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

  // Sort items
  const sortItems = (items, field, direction) => {
    return [...items].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];
      
      // Handle numeric fields
      if (field === 'daysSinceUpdate' || field === 'retailPrice' || field === 'estimatedSize') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      
      // Handle date fields
      if (field === 'lastUpdated') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
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

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center justify-between">
            <div className="flex items-center">
              <Archive className="h-6 w-6 mr-2" />
              Archive Preview System
            </div>
            <span className="text-sm font-normal bg-yellow-500 text-white px-3 py-1 rounded">
              READ-ONLY MODE
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-6">
          
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

          {/* Search and Filter Section */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by ID, model, manufacturer, or IMEI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Quick Select Buttons */}
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
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
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>

            {/* Preview Archive Button */}
            {selectedItems.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handlePreviewArchive}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Preview Archive ({selectedItems.length} items)
                </button>
              </div>
            )}
          </div>

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

          {/* Tab Content */}
          <div className="min-h-[400px]">
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

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                      <Archive className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                      <p className="text-blue-800 font-medium">
                        This is a preview only. When the actual archive feature is implemented,
                        these items would be moved to the archive collection.
                      </p>
                    </div>
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
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default ArchivePreview;