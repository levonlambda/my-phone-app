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

const ProcurementManagementForm = () => {
  // ====== GLOBAL STATE ======
  const { editProcurement } = useGlobalState(); // NEW: Get editProcurement function

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
  const fetchProcurements = async () => {
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
      
    } catch (error) {
      console.error("Error fetching procurements:", error);
      setError(`Error fetching procurements: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load procurements on component mount
  useEffect(() => {
    fetchProcurements();
  }, []);
{/* Part 2 End - Data Fetching Functions */}

{/* Part 3 Start - Event Handlers and Filter Logic */}
  // Filter procurements based on search term and status
  useEffect(() => {
    let filtered = procurements;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(procurement => 
        procurement.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        procurement.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        procurement.purchaseDate?.includes(searchTerm)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid') {
        filtered = filtered.filter(p => p.isPaid === true || p.paymentStatus === 'paid');
      } else if (statusFilter === 'unpaid') {
        filtered = filtered.filter(p => p.isPaid !== true && p.paymentStatus !== 'paid');
      } else if (statusFilter === 'delivered') {
        filtered = filtered.filter(p => p.isReceived === true || p.deliveryStatus === 'delivered');
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(p => p.isReceived !== true && p.deliveryStatus !== 'delivered');
      }
    }
    
    setFilteredProcurements(filtered);
  }, [procurements, searchTerm, statusFilter]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };

  // Handle action clicks
  const handleViewProcurement = (procurement) => {
    console.log('View procurement:', procurement.id);
    alert(`View details for procurement ${procurement.reference || procurement.id}`);
    // TODO: Implement view modal/details
  };

  const handleEditProcurement = (procurement) => {
    console.log('Edit procurement:', procurement.id);
    // NEW: Use global state to edit procurement and switch to procurement form
    editProcurement(procurement);
  };

  const handleDeleteProcurement = (procurement) => {
    console.log('Delete procurement:', procurement.id);
    if (window.confirm(`Are you sure you want to delete procurement ${procurement.reference || procurement.id}?`)) {
      alert('Delete functionality will be implemented here');
      // TODO: Implement delete confirmation and deletion
    }
  };
{/* Part 3 End - Event Handlers and Filter Logic */}

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
              onClick={fetchProcurements}
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
                onClick={fetchProcurements}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
{/* Part 6 End - Search and Filter Section */}

{/* Part 7 Start - Procurement Entries Table */}
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
                          Payment Status
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Truck className="h-4 w-4 mr-2" />
                          Delivery Status
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold w-32">
                        <div className="flex items-center justify-center">
                          <Settings className="h-4 w-4 mr-2" />
                          Actions
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcurements.map((procurement) => {
                      const paymentStatus = getPaymentStatus(procurement);
                      const deliveryStatus = getDeliveryStatus(procurement);
                      
                      return (
                        <tr key={procurement.id} className="hover:bg-gray-50">
                          <td className="border px-3 py-3">
                            <div className="font-medium">
                              {formatDate(procurement.purchaseDate)}
                            </div>
                            {procurement.reference && (
                              <div className="text-xs text-gray-500 mt-1">
                                {procurement.reference}
                              </div>
                            )}
                          </td>
                          <td className="border px-3 py-3">
                            <div className="font-medium text-gray-900">
                              {procurement.supplierName || 'Unknown Supplier'}
                            </div>
                          </td>
                          <td className="border px-3 py-3 text-center">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {procurement.totalQuantity}
                            </span>
                          </td>
                          <td className="border px-3 py-3 text-right font-mono">
                            <span className="font-semibold text-lg">
                              ₱{formatPrice(procurement.grandTotal)}
                            </span>
                          </td>
                          <td className="border px-3 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${paymentStatus.className}`}>
                              {paymentStatus.label}
                            </span>
                          </td>
                          <td className="border px-3 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${deliveryStatus.className}`}>
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
{/* Part 7 End - Procurement Entries Table */}

{/* Part 8 Start - Summary Statistics */}
          {/* Summary Stats - MOVED TO BOTTOM */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Total Procurements</p>
                  <p className="text-xl font-bold text-blue-600">{procurements.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Paid</p>
                  <p className="text-xl font-bold text-green-600">
                    {procurements.filter(p => p.isPaid === true || p.paymentStatus === 'paid').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Unpaid</p>
                  <p className="text-xl font-bold text-red-600">
                    {procurements.filter(p => p.isPaid !== true && p.paymentStatus !== 'paid').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Truck className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Pending Delivery</p>
                  <p className="text-xl font-bold text-yellow-600">
                    {procurements.filter(p => p.isReceived !== true && p.deliveryStatus !== 'delivered').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
{/* Part 8 End - Summary Statistics */}

        </CardContent>
      </Card>
    </div>
  );
};

export default ProcurementManagementForm;