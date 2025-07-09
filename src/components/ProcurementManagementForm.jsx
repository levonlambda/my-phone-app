{/* Part 1 Start - Imports, State, and Helper Functions */}
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  RefreshCw, 
  Package,
  Search,
  Calendar,
  Building2,
  Hash,
  DollarSign,
  CreditCard,
  Truck,
  Eye,
  Edit,
  Trash2,
  Settings
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalStateContext'; // NEW: Import global state
import supplierService from '../services/supplierService'; // NEW: Import supplier service

const ProcurementManagementForm = () => {
  // ====== GLOBAL STATE ======
  const { editProcurement, viewProcurement } = useGlobalState(); // NEW: Get both edit and view functions

  // ====== STATE DEFINITIONS ======
  // State for procurement data
  const [procurements, setProcurements] = useState([]);
  const [filteredProcurements, setFilteredProcurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ====== HELPER FUNCTIONS ======
  // Format price with commas and two decimal places
  const formatPrice = (value) => {
    if (!value && value !== 0) return '0.00';
    const numValue = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(numValue)) return '0.00';
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get payment status display
  const getPaymentStatus = (procurement) => {
    if (procurement.isPaid === true || procurement.paymentStatus === 'paid') {
      return {
        label: 'Paid',
        className: 'bg-green-100 text-green-800'
      };
    }
    return {
      label: 'Unpaid',
      className: 'bg-red-100 text-red-800'
    };
  };

  // Get delivery status display
  const getDeliveryStatus = (procurement) => {
    if (procurement.isReceived === true || procurement.deliveryStatus === 'delivered') {
      return {
        label: 'Delivered',
        className: 'bg-green-100 text-green-800'
      };
    }
    return {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800'
    };
  };
{/* Part 1 End - Imports, State, and Helper Functions */}

{/* Part 2 Start - Data Fetching Functions */}
  // Fetch all procurement entries
  const fetchAllProcurements = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const procurementsRef = collection(db, 'procurements');
      const q = query(procurementsRef, orderBy('purchaseDate', 'desc'));
      const snapshot = await getDocs(q);
      
      const procurementsList = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        procurementsList.push({
          id: doc.id,
          ...data,
          // Ensure we have the necessary fields with fallbacks
          totalQuantity: data.totalQuantity || (data.items ? data.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0),
          grandTotal: data.grandTotal || 0,
          paymentStatus: data.paymentStatus || (data.isPaid ? 'paid' : 'pending'),
          deliveryStatus: data.deliveryStatus || (data.isReceived ? 'delivered' : 'pending')
        });
      });
      
      setProcurements(procurementsList);
      setFilteredProcurements(procurementsList);
      console.log('Fetched procurements:', procurementsList.length);
      
    } catch (error) {
      console.error('Error fetching procurements:', error);
      setError('Failed to load procurement data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize data fetch
  useEffect(() => {
    fetchAllProcurements();
  }, []);

  // Filter procurements based on search and status
  useEffect(() => {
    let filtered = [...procurements];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(procurement =>
        procurement.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        procurement.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        procurement.purchaseDate?.includes(searchTerm) ||
        procurement.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(procurement => {
        switch (statusFilter) {
          case 'paid':
            return procurement.isPaid === true || procurement.paymentStatus === 'paid';
          case 'unpaid':
            return procurement.isPaid !== true && procurement.paymentStatus !== 'paid';
          case 'delivered':
            return procurement.isReceived === true || procurement.deliveryStatus === 'delivered';
          case 'pending':
            return procurement.isReceived !== true && procurement.deliveryStatus !== 'delivered';
          default:
            return true;
        }
      });
    }
    
    setFilteredProcurements(filtered);
  }, [procurements, searchTerm, statusFilter]);
{/* Part 2 End - Data Fetching Functions */}

{/* Part 3 Start - Form Action Handlers with Payment Update */}
  // ====== FORM ACTION HANDLERS ======
  
  // Handle payment status click (no dialog)
  const handlePaymentUpdate = async (procurement) => {
    console.log('Payment clicked for procurement:', procurement.id);
    // Click handler preserved but dialog functionality removed
  };

  const handleViewProcurement = (procurement) => {
    console.log('View procurement:', procurement.id);
    // Use the view function to open the form in read-only mode
    viewProcurement(procurement);
  };

  const handleEditProcurement = (procurement) => {
    console.log('Edit procurement:', procurement.id);
    // Use global state to edit procurement and switch to procurement form
    editProcurement(procurement);
  };

  const handleDeleteProcurement = async (procurement) => {
    const confirmMessage = `Are you sure you want to delete this procurement?\n\n` +
      `Reference: ${procurement.reference || procurement.id}\n` +
      `Supplier: ${procurement.supplierName}\n` +
      `Amount: ₱${formatPrice(procurement.grandTotal?.toString() || '0')}\n` +
      `Items: ${procurement.totalQuantity || 0}\n\n` +
      `This action cannot be undone!`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        setError('');
        
        console.log("Deleting procurement with supplier service:", procurement.id);
        
        const result = await supplierService.deleteProcurement(procurement.id);
        
        if (result.success) {
          console.log("Procurement deleted successfully:", result);
          
          // Show success message
          alert(`Procurement deleted successfully!\n\nReference: ${procurement.reference || procurement.id}\nSupplier: ${procurement.supplierName}`);
          
          // Refresh the procurement list
          await fetchAllProcurements();
          
        } else {
          console.error("Error deleting procurement:", result.error);
          setError(`Error deleting procurement: ${result.error}`);
        }
        
      } catch (error) {
        console.error('Error deleting procurement:', error);
        setError(`Error deleting procurement: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // ====== SEARCH AND FILTER HANDLERS ======
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };
{/* Part 3 End - Form Action Handlers with Payment Update */}

{/* Part 4 Start - Loading and Error States */}
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Procurement Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading procurement data...</p>
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
              <Package className="h-6 w-6 mr-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={fetchAllProcurements}
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
{/* Part 4 End - Loading and Error States */}

{/* Part 5 Start - Main Component Render */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Package className="h-6 w-6 mr-2" />
            Procurement Management
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-6">
{/* Part 5 End - Main Component Render */}

{/* Part 6 Start - Search and Filter Section */}
          {/* Search and Filter Section */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by supplier name, reference, or date..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-48">
                <select
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid Only</option>
                  <option value="unpaid">Unpaid Only</option>
                  <option value="delivered">Delivered Only</option>
                  <option value="pending">Pending Delivery</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchAllProcurements}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
{/* Part 6 End - Search and Filter Section */}

{/* Part 7 Start - Enhanced Procurement Summary */}
          {/* Procurement Summary - Enhanced Design */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Procurement Summary</h3>
              <div className="text-sm text-gray-600">
                {searchTerm || statusFilter !== 'all' 
                  ? `${filteredProcurements.length} of ${procurements.length} entries (filtered)`
                  : `${filteredProcurements.length} entries`}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Procurement Value</p>
                    <p className="text-xs text-gray-500">Combined value of all procurements</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">
                      ₱{(() => {
                        const totalValue = filteredProcurements.reduce((total, procurement) => {
                          return total + (procurement.grandTotal || 0);
                        }, 0);
                        return totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {filteredProcurements.length} {filteredProcurements.length === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Units Procured</p>
                    <p className="text-xs text-gray-500">Combined quantity across all entries</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      {(() => {
                        const totalQuantity = filteredProcurements.reduce((total, procurement) => {
                          return total + (procurement.totalQuantity || 0);
                        }, 0);
                        return totalQuantity.toLocaleString('en-US');
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Payment Status</p>
                    <p className="text-xs text-gray-500">Paid vs Outstanding amounts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-600">
                      ₱{(() => {
                        const paidAmount = filteredProcurements.reduce((total, procurement) => {
                          if (procurement.isPaid === true || procurement.paymentStatus === 'paid') {
                            return total + (procurement.grandTotal || 0);
                          }
                          return total;
                        }, 0);
                        return paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()} paid
                    </p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const paidCount = filteredProcurements.filter(p => 
                          p.isPaid === true || p.paymentStatus === 'paid'
                        ).length;
                        const totalCount = filteredProcurements.length;
                        const percentage = totalCount > 0 ? (paidCount / totalCount * 100) : 0;
                        return `${percentage.toFixed(1)}% completed`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
{/* Part 7 End - Enhanced Procurement Summary */}

{/* Part 8 Start - Procurement Entries Table */}
          {/* Procurement List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                Procurement Entries ({filteredProcurements.length} items)
              </h3>
            </div>

            {filteredProcurements.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-700 mb-2">
                  {procurements.length === 0 ? 'No procurement entries found' : 'No entries match your filters'}
                </h4>
                <p className="text-gray-500">
                  {procurements.length === 0 
                    ? 'Create procurement entries from the Phone Procurement form'
                    : 'Try adjusting your search criteria or filters'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-3 text-left font-semibold">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Date
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-left font-semibold">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2" />
                          Supplier
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Hash className="h-4 w-4 mr-2" />
                          Total Items
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Amount
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Payment
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Truck className="h-4 w-4 mr-2" />
                          Delivery
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Settings className="h-4 w-4 mr-2" />
                          Actions
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcurements.map((procurement, index) => {
                      const paymentStatus = getPaymentStatus(procurement);
                      const deliveryStatus = getDeliveryStatus(procurement);
                      
                      return (
                        <tr key={procurement.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border px-3 py-3">
                            <div className="font-medium">{formatDate(procurement.purchaseDate)}</div>
                            <div className="text-xs text-gray-500">ID: {procurement.id.slice(-8)}</div>
                          </td>
                          <td className="border px-3 py-3">
                            <div className="font-medium">{procurement.supplierName || 'Unknown'}</div>
                            {procurement.reference && (
                              <div className="text-xs text-gray-500">Ref: {procurement.reference}</div>
                            )}
                          </td>
                          <td className="border px-3 py-3 text-center">
                            <span className="font-semibold">{procurement.totalQuantity || 0}</span>
                          </td>
                          <td className="border px-3 py-3 text-right">
                            <span className="font-mono font-semibold">
                              ₱{(procurement.grandTotal || 0).toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })}
                            </span>
                          </td>
                          <td className="border px-3 py-3 text-center">
                            {/* CHANGED: Convert Payment column to clickable status button */}
                            <button
                              onClick={() => handlePaymentUpdate(procurement)}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${paymentStatus.className} hover:opacity-80 cursor-pointer`}
                              title={`${paymentStatus.label === 'Paid' ? 'Click to mark as Unpaid' : 'Click to mark as Paid'}`}
                            >
                              {paymentStatus.label}
                            </button>
                          </td>
                          <td className="border px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${deliveryStatus.className}`}>
                              {deliveryStatus.label}
                            </span>
                          </td>
                          <td className="border px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleViewProcurement(procurement)}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditProcurement(procurement)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                title="Edit Procurement"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProcurement(procurement)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Delete Procurement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
{/* Part 8 End - Procurement Entries Table */}

        </CardContent>
      </Card>
    </div>
  );
};

export default ProcurementManagementForm;