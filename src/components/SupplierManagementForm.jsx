{/* Part 1 Start - Imports, State, and Helper Functions */}
import { useState } from 'react';
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
  FileText
} from 'lucide-react';

const SupplierManagementForm = () => {
  // State for suppliers list
  const [suppliers, setSuppliers] = useState([
    {
      id: 1,
      supplierName: 'Tech Distributors Inc.',
      bankName: 'BPI',
      bankAccount: '1234-5678-9012',
      accountPayable: '25,000.00',
      notes: 'Primary supplier for Samsung products',
      balance: '15,250.00'
    },
    {
      id: 2,
      supplierName: 'Mobile World Supply',
      bankName: 'BDO',
      bankAccount: '9876-5432-1098',
      accountPayable: '18,500.00',
      notes: 'Good payment terms, reliable delivery',
      balance: '8,750.00'
    }
  ]);

  // State for current form
  const [currentSupplier, setCurrentSupplier] = useState({
    id: null,
    supplierName: '',
    bankName: '',
    bankAccount: '',
    accountPayable: '',
    notes: ''
  });

  // State for ledger entries (sample data) - Read-only for display
  const [ledgerEntries] = useState([
    {
      id: 1,
      date: '2025-01-15',
      reference: 'INV-2025-001',
      amountDue: '25,000.00',
      amountPaid: '',
      balance: '25,000.00'
    },
    {
      id: 2,
      date: '2025-01-18',
      reference: 'PAY-2025-001',
      amountDue: '',
      amountPaid: '10,000.00',
      balance: '15,000.00'
    },
    {
      id: 3,
      date: '2025-01-20',
      reference: 'INV-2025-002',
      amountDue: '8,500.00',
      amountPaid: '',
      balance: '23,500.00'
    }
  ]);

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' or 'ledger'
  const [showSupplierForm, setShowSupplierForm] = useState(false); // Add state to control supplier form visibility

  // Helper functions
  const formatNumberWithCommas = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
{/* Part 1 End - Imports, State, and Helper Functions */}

{/* Part 2 Start - Supplier Form Event Handlers */}
  // Supplier form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Format account payable with commas (even though it's disabled, keep for consistency)
    if (name === 'accountPayable') {
      const cleanValue = value.replace(/[^\d.]/g, '');
      const formattedValue = formatNumberWithCommas(cleanValue);
      setCurrentSupplier(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else {
      setCurrentSupplier(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    if (isEditing) {
      // Update existing supplier
      setSuppliers(prev => 
        prev.map(supplier => 
          supplier.id === editingId 
            ? { ...currentSupplier, id: editingId }
            : supplier
        )
      );
    } else {
      // Add new supplier
      const newId = Math.max(...suppliers.map(s => s.id), 0) + 1;
      setSuppliers(prev => [...prev, { ...currentSupplier, id: newId, balance: '0.00' }]);
    }
    
    // Reset form
    setCurrentSupplier({
      id: null,
      supplierName: '',
      bankName: '',
      bankAccount: '',
      accountPayable: '',
      notes: ''
    });
    setIsEditing(false);
    setEditingId(null);
    setShowSupplierForm(false); // NEW: Hide supplier form after successful submission
  };

  const handleEdit = (supplier) => {
    setCurrentSupplier(supplier);
    setIsEditing(true);
    setEditingId(supplier.id);
    setShowSupplierForm(true); // NEW: Show supplier form when editing
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      setSuppliers(prev => prev.filter(supplier => supplier.id !== id));
    }
  };

  const handleCancel = () => {
    setCurrentSupplier({
      id: null,
      supplierName: '',
      bankName: '',
      bankAccount: '',
      accountPayable: '',
      notes: ''
    });
    setIsEditing(false);
    setEditingId(null);
    setShowSupplierForm(false); // NEW: Hide supplier form when cancelling
  };

  // NEW: Handle add new supplier button click
  const handleAddNewSupplier = () => {
    setShowSupplierForm(true);
    setIsEditing(false);
    setEditingId(null);
    setCurrentSupplier({
      id: null,
      supplierName: '',
      bankName: '',
      bankAccount: '',
      accountPayable: '',
      notes: ''
    });
  };
{/* Part 2 End - Supplier Form Event Handlers */}

{/* Part 3 Start - Ledger Form Event Handlers */}
  
{/* Part 3 End - Ledger Form Event Handlers */}

{/* Part 4 Start - Main Component Structure and Header */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Building className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Supplier Management</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex items-center gap-1 ${activeTab === 'suppliers' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-white/20 text-white'} px-4 py-2 rounded text-base font-medium`}
            >
              <Building className="h-5 w-5 mr-1" />
              <span>Suppliers</span>
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1 ${activeTab === 'ledger' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-white/20 text-white'} px-4 py-2 rounded text-base font-medium`}
            >
              <FileText className="h-5 w-5 mr-1" />
              <span>Ledger</span>
            </button>
            {/* NEW: Add New Supplier Button - only show on suppliers tab */}
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
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <RefreshCw className="h-5 w-5 mr-1" />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
{/* Part 4 End - Main Component Structure and Header */}

{/* Part 5 Start - Suppliers Tab Content with Conditional Form Display */}
          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="space-y-6">
              {/* Add/Edit Supplier Form - NOW CONDITIONAL */}
              {showSupplierForm && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">
                      {isEditing ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                    {/* NEW: Add close button */}
                    <button
                      onClick={() => setShowSupplierForm(false)}
                      className="text-gray-500 hover:text-gray-700"
                      title="Close form"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* UPDATED: First Row - Supplier Name and Account Payable */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        />
                      </div>
                      
                      {/* UPDATED: Account Payable moved to first row and disabled */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Account Payable
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-gray-400 text-sm">₱</span>
                          <input
                            type="text"
                            name="accountPayable"
                            value={currentSupplier.accountPayable}
                            onChange={handleInputChange}
                            className="w-full p-2 pl-6 border rounded disabled:bg-gray-100 disabled:text-gray-400"
                            placeholder="0.00"
                            disabled={true}
                          />
                        </div>
                      </div>
                    </div>

                    {/* UPDATED: Second Row - Bank Name and Bank Account */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          name="bankName"
                          value={currentSupplier.bankName}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Account
                        </label>
                        <input
                          type="text"
                          name="bankAccount"
                          value={currentSupplier.bankAccount}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    </div>
                    
                    {/* Notes field remains in its own row */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={currentSupplier.notes}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded"
                        rows={3}
                        placeholder="Optional notes about this supplier..."
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isEditing ? 'Update Supplier' : 'Add Supplier'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
{/* Part 5 End - Suppliers Tab Content with Conditional Form Display */}

{/* Part 6 Start - Suppliers List Table (Unchanged) */}
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
                    <p>No suppliers added yet</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supplier Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Bank Details</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Outstanding Balance</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {suppliers.map((supplier) => (
                            <tr key={supplier.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div>{supplier.bankName}</div>
                                <div className="text-gray-500">{supplier.bankAccount}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">
                                <span className={`${parseFloat(supplier.balance.replace(/,/g, '')) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ₱{supplier.balance}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {supplier.notes || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center space-x-2">
                                  <button
                                    onClick={() => handleEdit(supplier)}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                    title="Edit supplier"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedSupplierId(supplier.id);
                                      setActiveTab('ledger');
                                    }}
                                    className="p-1 text-green-600 hover:text-green-800"
                                    title="View ledger"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(supplier.id)}
                                    className="p-1 text-red-600 hover:text-red-800"
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

                    {/* Outstanding Balance Summary */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Outstanding Balance Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 font-medium">Suppliers - Zero Balance</p>
                              <p className="text-xs text-gray-500">Suppliers with zero balance</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-600">
                                {suppliers.filter(s => parseFloat(s.balance.replace(/,/g, '')) === 0).length}
                              </p>
                              <p className="text-xs text-gray-500">suppliers</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 font-medium">Suppliers with Balance</p>
                              <p className="text-xs text-gray-500">Suppliers that owe money</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-orange-600">
                                {suppliers.filter(s => parseFloat(s.balance.replace(/,/g, '')) > 0).length}
                              </p>
                              <p className="text-xs text-gray-500">suppliers</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-red-100 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 font-medium">Total Outstanding</p>
                              <p className="text-xs text-gray-500">Total amount owed to suppliers</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-red-600">
                                ₱{(() => {
                                  const total = suppliers.reduce((sum, supplier) => {
                                    const balance = parseFloat(supplier.balance.replace(/,/g, '')) || 0;
                                    return sum + balance;
                                  }, 0);
                                  return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
{/* Part 6 End - Suppliers List Table (Unchanged) */}

{/* Part 7 Start - Ledger Tab and Component Export (Updated - Removed Add Entry) */}
          {/* Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Supplier Selection */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-semibold text-lg text-[rgb(52,69,157)] mb-4">Supplier Ledger</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Supplier
                    </label>
                    <select
                      value={selectedSupplierId || ''}
                      onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Choose a supplier...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplierName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* REMOVED: Add Entry Button and surrounding logic */}
                </div>
              </div>

              {/* REMOVED: Add Ledger Entry Form - Entire section removed */}

              {/* Ledger Table */}
              {selectedSupplierId ? (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-100 border-b">
                    <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">
                      Ledger for {suppliers.find(s => s.id === selectedSupplierId)?.supplierName}
                    </h3>
                  </div>
                  
                  {ledgerEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No ledger entries yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Reference</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount Due</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount Paid</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Outstanding Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ledgerEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">{entry.date}</td>
                              <td className="px-4 py-3 text-sm font-medium">{entry.reference}</td>
                              <td className="px-4 py-3 text-right font-mono text-sm">
                                {entry.amountDue && (
                                  <span className="text-red-600">₱{entry.amountDue}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm">
                                {entry.amountPaid && (
                                  <span className="text-green-600">₱{entry.amountPaid}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                                ₱{entry.balance}
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
{/* Part 7 End - Ledger Tab and Component Export (Updated - Removed Add Entry) */}