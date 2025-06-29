{/* Part 1 Start - Updated Imports and Initial State */}
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building, 
  RefreshCw, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  XCircle,
  Search,
  FileText,
  Calculator,
  Eye,
  Building2,
  CreditCard,
  DollarSign,
  StickyNote,
  Settings
} from 'lucide-react';
// Import the supplier service
import supplierService from '../services/supplierService';

const SupplierManagementForm = () => {
  // State for suppliers list - NOW LOADED FROM FIREBASE
  const [suppliers, setSuppliers] = useState([]);

  // State for current form
  const [currentSupplier, setCurrentSupplier] = useState({
    id: null,
    supplierName: '',
    bankName: '',
    bankAccount: '',
    notes: ''
  });

  // State for ledger entries - NOW LOADED FROM FIREBASE
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState(null);
  const [ledgerSummary, setLedgerSummary] = useState(null);

  // State for loading and errors - NEW
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [activeTab, setActiveTab] = useState('suppliers');
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  // Load data when component mounts
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Load ledger when supplier is selected
  useEffect(() => {
    if (selectedSupplierId && activeTab === 'ledger') {
      fetchSupplierLedger(selectedSupplierId);
    }
  }, [selectedSupplierId, activeTab]);
{/* Part 1 End - Updated Imports and Initial State */}

{/* Part 2 Start - Real Data Fetching Functions */}
  // ====== REAL DATA FETCHING FUNCTIONS ======
  
  // Fetch all suppliers from Firebase
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await supplierService.getAllSuppliers();
      
      if (result.success) {
        setSuppliers(result.suppliers);
        console.log('Suppliers loaded:', result.suppliers);
      } else {
        setError(`Error loading suppliers: ${result.error}`);
        setSuppliers([]);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setError(`Error loading suppliers: ${error.message}`);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ledger for a specific supplier
  const fetchSupplierLedger = async (supplierId) => {
    try {
      setLoading(true);
      setError('');
      
      // Get ledger entries
      const ledgerResult = await supplierService.getSupplierLedger(supplierId);
      
      if (ledgerResult.success) {
        setLedgerEntries(ledgerResult.ledgerEntries);
        console.log('Ledger loaded:', ledgerResult.ledgerEntries);
      } else {
        setError(`Error loading ledger: ${ledgerResult.error}`);
        setLedgerEntries([]);
      }

      // Get ledger summary
      const summaryResult = await supplierService.getSupplierLedgerSummary(supplierId);
      
      if (summaryResult.success) {
        setLedgerSummary(summaryResult.summary);
        console.log('Ledger summary loaded:', summaryResult.summary);
      } else {
        console.warn('Could not load ledger summary:', summaryResult.error);
        setLedgerSummary(null);
      }
      
    } catch (error) {
      console.error("Error fetching supplier ledger:", error);
      setError(`Error loading ledger: ${error.message}`);
      setLedgerEntries([]);
      setLedgerSummary(null);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate supplier balance
  const recalculateBalance = async (supplierId) => {
    try {
      setLoading(true);
      setError('');
      
      const result = await supplierService.recalculateSupplierBalance(supplierId);
      
      if (result.success) {
        setSuccessMessage(`Balance recalculated successfully. Final balance: ₱${formatNumberWithCommas(result.finalBalance.toString())}. Updated ${result.entriesUpdated} entries.`);
        
        // Refresh data
        await fetchSuppliers();
        if (selectedSupplierId) {
          await fetchSupplierLedger(selectedSupplierId);
        }
      } else {
        setError(`Error recalculating balance: ${result.error}`);
      }
    } catch (error) {
      console.error("Error recalculating balance:", error);
      setError(`Error recalculating balance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
{/* Part 2 End - Real Data Fetching Functions */}

{/* Part 3 Start - Real Backend Form Handlers */}
  // ====== REAL BACKEND FORM HANDLERS ======
  
  // Helper function to clear messages after a delay
  const clearMessages = () => {
    setTimeout(() => {
      setError('');
      setSuccessMessage('');
    }, 5000);
  };

  // Helper function to format numbers with commas
  const formatNumberWithCommas = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Supplier form handlers - UPDATED to use real backend
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentSupplier(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Validation
    if (!currentSupplier.supplierName.trim()) {
      setError('Supplier name is required');
      clearMessages();
      return;
    }

    if (!currentSupplier.bankName.trim()) {
      setError('Bank name is required');
      clearMessages();
      return;
    }

    if (!currentSupplier.bankAccount.trim()) {
      setError('Bank account is required');
      clearMessages();
      return;
    }

    try {
      setSubmitLoading(true);
      setError('');
      
      if (isEditing) {
        // Update existing supplier
        const result = await supplierService.updateSupplier(editingId, {
          supplierName: currentSupplier.supplierName.trim(),
          bankName: currentSupplier.bankName.trim(),
          bankAccount: currentSupplier.bankAccount.trim(),
          notes: currentSupplier.notes.trim()
        });

        if (result.success) {
          setSuccessMessage('Supplier updated successfully');
          await fetchSuppliers(); // Refresh the list
        } else {
          setError(`Error updating supplier: ${result.error}`);
        }
      } else {
        // Create new supplier
        const result = await supplierService.createSupplier({
          supplierName: currentSupplier.supplierName.trim(),
          bankName: currentSupplier.bankName.trim(),
          bankAccount: currentSupplier.bankAccount.trim(),
          notes: currentSupplier.notes.trim()
        });

        if (result.success) {
          setSuccessMessage('Supplier created successfully');
          await fetchSuppliers(); // Refresh the list
        } else {
          setError(`Error creating supplier: ${result.error}`);
        }
      }

      // Reset form on success
      if (!error) {
        handleCancel();
      }
      
    } catch (error) {
      console.error('Error submitting supplier:', error);
      setError(`Error saving supplier: ${error.message}`);
    } finally {
      setSubmitLoading(false);
      clearMessages();
    }
  };

  const handleEdit = (supplier) => {
    setCurrentSupplier({
      id: supplier.id,
      supplierName: supplier.supplierName,
      bankName: supplier.bankName,
      bankAccount: supplier.bankAccount,
      notes: supplier.notes || ''
    });
    setIsEditing(true);
    setEditingId(supplier.id);
    setShowSupplierForm(true);
  };

  const handleDelete = async (id) => {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier && window.confirm(`Are you sure you want to delete "${supplier.supplierName}"? This action cannot be undone.`)) {
      try {
        setLoading(true);
        setError('');
        
        // Note: We don't have a delete function in the service yet, so we'll show an error for now
        setError('Delete functionality is not yet implemented. Please contact support.');
        
      } catch (error) {
        console.error('Error deleting supplier:', error);
        setError(`Error deleting supplier: ${error.message}`);
      } finally {
        setLoading(false);
        clearMessages();
      }
    }
  };

  const handleCancel = () => {
    setCurrentSupplier({
      id: null,
      supplierName: '',
      bankName: '',
      bankAccount: '',
      notes: ''
    });
    setIsEditing(false);
    setEditingId(null);
    setShowSupplierForm(false);
    setError('');
    setSuccessMessage('');
  };

  const handleAddNewSupplier = () => {
    setShowSupplierForm(true);
    setIsEditing(false);
    setEditingId(null);
    setCurrentSupplier({
      id: null,
      supplierName: '',
      bankName: '',
      bankAccount: '',
      notes: ''
    });
    setError('');
    setSuccessMessage('');
  };

  // Handle supplier selection for ledger
  const handleSupplierLedgerSelection = (supplierId) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    setSelectedSupplierForLedger(supplier);
    
    if (supplierId) {
      fetchSupplierLedger(supplierId);
    } else {
      setLedgerEntries([]);
      setLedgerSummary(null);
    }
  };

  // Handle direct ledger view from supplier actions - NEW
  const handleViewLedger = (supplier) => {
    // Switch to ledger tab
    setActiveTab('ledger');
    // Select the supplier and load their ledger
    setSelectedSupplierId(supplier.id);
    setSelectedSupplierForLedger(supplier);
    // Clear any existing messages
    setError('');
    setSuccessMessage('');
    // Fetch the ledger data
    fetchSupplierLedger(supplier.id);
  };

  // Handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccessMessage('');
  };

  // Handle refresh
  const handleRefresh = async () => {
    await fetchSuppliers();
    if (selectedSupplierId && activeTab === 'ledger') {
      await fetchSupplierLedger(selectedSupplierId);
    }
    setError('');
    setSuccessMessage('');
  };
{/* Part 3 End - Real Backend Form Handlers */}

{/* Part 4 Start - Main Component Structure and Header */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Building className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Supplier Management</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('suppliers')}
              className={`flex items-center gap-1 ${activeTab === 'suppliers' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-white/20 text-white'} px-4 py-2 rounded text-base font-medium`}
            >
              <Building className="h-5 w-5 mr-1" />
              <span>Suppliers</span>
            </button>
            <button
              onClick={() => handleTabChange('ledger')}
              className={`flex items-center gap-1 ${activeTab === 'ledger' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-white/20 text-white'} px-4 py-2 rounded text-base font-medium`}
            >
              <FileText className="h-5 w-5 mr-1" />
              <span>Ledger</span>
            </button>
            {activeTab === 'suppliers' && (
              <button
                onClick={handleAddNewSupplier}
                className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded text-base font-medium hover:bg-green-700"
              >
                <Plus className="h-5 w-5 mr-1" />
                <span>Add New</span>
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Error and Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {successMessage}
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
              Loading...
            </div>
          )}
{/* Part 4 End - Main Component Structure and Header */}

{/* Part 5 Start - Suppliers Tab Content with Outstanding Balance Display */}
          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="space-y-6">
              {/* Add/Edit Supplier Form */}
              {showSupplierForm && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">
                      {isEditing ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Supplier Name - Position 1 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Supplier Name *
                        </label>
                        <input
                          type="text"
                          name="supplierName"
                          value={currentSupplier.supplierName}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded"
                          required
                          disabled={submitLoading}
                        />
                      </div>

                      {/* Outstanding Balance - Position 2 (MOVED UP) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Outstanding Balance
                        </label>
                        <input
                          type="text"
                          value={isEditing 
                            ? `₱${formatNumberWithCommas((suppliers.find(s => s.id === editingId)?.totalOutstanding || 0).toString())}`
                            : '₱0.00'
                          }
                          className="w-full p-2 border rounded bg-gray-100 text-gray-600"
                          disabled
                          placeholder="Auto-calculated from procurements"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {isEditing ? 'This balance is calculated from active procurements and payments' : 'Balance will be calculated from procurements'}
                        </p>
                      </div>

                      {/* Bank Name - Position 3 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Name *
                        </label>
                        <input
                          type="text"
                          name="bankName"
                          value={currentSupplier.bankName}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded"
                          required
                          disabled={submitLoading}
                        />
                      </div>

                      {/* Bank Account - Position 4 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Account *
                        </label>
                        <input
                          type="text"
                          name="bankAccount"
                          value={currentSupplier.bankAccount}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded"
                          required
                          disabled={submitLoading}
                        />
                      </div>
                    </div>

                    {/* Notes - Full Width */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={currentSupplier.notes}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded h-20"
                        disabled={submitLoading}
                        placeholder="Additional notes about this supplier..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submitLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center disabled:opacity-50"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {submitLoading ? 'Saving...' : (isEditing ? 'Update Supplier' : 'Add Supplier')}
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={submitLoading}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Suppliers List */}
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-100 border-b">
                  <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">
                    Suppliers List ({suppliers.length})
                  </h3>
                </div>
                
                {suppliers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No suppliers found. Add your first supplier to get started.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-3 py-3 text-left font-semibold">
                              <div className="flex items-center">
                                <Building2 className="h-4 w-4 mr-2" />
                                Supplier
                              </div>
                            </th>
                            <th className="border px-3 py-3 text-left font-semibold">
                              <div className="flex items-center">
                                <CreditCard className="h-4 w-4 mr-2" />
                                Bank Details
                              </div>
                            </th>
                            <th className="border px-3 py-3 text-right font-semibold w-48">
                              <div className="flex items-center justify-end">
                                <DollarSign className="h-4 w-4 mr-2" />
                                Balance
                              </div>
                            </th>
                            <th className="border px-3 py-3 text-left font-semibold">
                              <div className="flex items-center">
                                <StickyNote className="h-4 w-4 mr-2" />
                                Notes
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
                          {suppliers.map((supplier) => (
                            <tr key={supplier.id} className="hover:bg-gray-50">
                              <td className="border px-3 py-3">
                                <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                              </td>
                              <td className="border px-3 py-3">
                                <div className="font-medium text-gray-900">{supplier.bankName}</div>
                                <div className="text-xs text-gray-500 mt-1">{supplier.bankAccount}</div>
                              </td>
                              <td className="border px-3 py-3 text-right font-mono w-48">
                                <span className="font-semibold text-lg">
                                  ₱{((supplier.totalOutstanding || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }))}
                                </span>
                              </td>
                              <td className="border px-3 py-3">
                                <div className="text-sm text-gray-500 max-w-xs truncate">
                                  {supplier.notes || 'No notes'}
                                </div>
                              </td>
                              <td className="border px-3 py-3 w-32">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    onClick={() => handleViewLedger(supplier)}
                                    disabled={loading}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded disabled:opacity-50"
                                    title="View ledger"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleEdit(supplier)}
                                    disabled={loading}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                                    title="Edit supplier"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(supplier.id)}
                                    disabled={loading}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                                    title="Delete supplier"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Summary Statistics - Matching ProcurementManagementForm Style */}
              {suppliers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Building2 className="h-8 w-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Total Suppliers</p>
                        <p className="text-xl font-bold text-blue-600">{suppliers.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Suppliers with Balance</p>
                        <p className="text-xl font-bold text-green-600">
                          {suppliers.filter(s => (s.totalOutstanding || 0) > 0).length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CreditCard className="h-8 w-8 text-red-600 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Total Balance</p>
                        <p className="text-xl font-bold text-red-600 font-mono">
                          ₱{(suppliers.reduce((total, supplier) => total + (supplier.totalOutstanding || 0), 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
{/* Part 5 End - Suppliers Tab Content with Outstanding Balance Display */}

{/* Part 6 Start - Ledger Tab and Component Export - FIXED */}
          {/* Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Supplier Selection for Ledger */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Supplier for Ledger View
                    </label>
                    <select
                      value={selectedSupplierId || ''}
                      onChange={(e) => handleSupplierLedgerSelection(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    >
                      <option value="">Choose a supplier...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplierName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedSupplierId && (
                    <button
                      onClick={() => recalculateBalance(selectedSupplierId)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px]"
                      title="Recalculate balance from all transactions"
                    >
                      <Calculator className="h-4 w-4" />
                      Recalculate
                    </button>
                  )}
                </div>
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading ledger...</span>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Success message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800">{successMessage}</p>
                </div>
              )}

              {/* Ledger Summary - FIXED PROPERTY NAMES */}
              {selectedSupplierForLedger && ledgerSummary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Ledger Summary for {selectedSupplierForLedger.supplierName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 font-medium">Total Purchases</p>
                        <p className="text-xl font-bold text-blue-600">
                          ₱{formatNumberWithCommas(ledgerSummary.totalDue.toString())}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 font-medium">Total Payments</p>
                        <p className="text-xl font-bold text-green-600">
                          ₱{formatNumberWithCommas(ledgerSummary.totalPayments.toString())}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 font-medium">Outstanding Balance</p>
                        <p className={`text-xl font-bold ${ledgerSummary.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₱{formatNumberWithCommas(ledgerSummary.outstandingBalance.toString())}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 font-medium">Last Activity</p>
                        <p className="text-sm font-bold text-gray-600">
                          {(() => {
                            const hasLastPurchase = ledgerSummary.lastPurchaseDate && ledgerSummary.lastPurchaseDate !== 'null';
                            const hasLastPayment = ledgerSummary.lastPaymentDate && ledgerSummary.lastPaymentDate !== 'null';
                            
                            if (!hasLastPurchase && !hasLastPayment) {
                              return 'No activity';
                            } else if (hasLastPurchase && !hasLastPayment) {
                              return `Purchase: ${ledgerSummary.lastPurchaseDate}`;
                            } else if (!hasLastPurchase && hasLastPayment) {
                              return `Payment: ${ledgerSummary.lastPaymentDate}`;
                            } else {
                              // Both exist, show the most recent one
                              return ledgerSummary.lastPurchaseDate > ledgerSummary.lastPaymentDate ? 
                                `Purchase: ${ledgerSummary.lastPurchaseDate}` : 
                                `Payment: ${ledgerSummary.lastPaymentDate}`;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ledger Table */}
              {selectedSupplierId ? (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-100 border-b">
                    <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">
                      Ledger for {selectedSupplierForLedger?.supplierName}
                    </h3>
                  </div>
                  
                  {ledgerEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No ledger entries found for this supplier.</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Ledger entries are created automatically when procurements are submitted.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Reference</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount Due</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount Paid</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ledgerEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entry.entryDate}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entry.reference}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entry.description}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {entry.amountDue > 0 && (
                                  <span className="text-red-600 font-medium">
                                    ₱{formatNumberWithCommas(entry.amountDue.toString())}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {entry.amountPaid > 0 && (
                                  <span className="text-green-600 font-medium">
                                    ₱{formatNumberWithCommas(entry.amountPaid.toString())}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium">
                                <span className={entry.runningBalance > 0 ? 
                                  'text-red-600' : 'text-green-600'}>
                                  ₱{formatNumberWithCommas(entry.runningBalance.toString())}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Please select a supplier to view their ledger</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierManagementForm;
{/* Part 6 End - Ledger Tab and Component Export - FIXED */}