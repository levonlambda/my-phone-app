{/* Part 1 Start - Imports, State, and Helper Functions */}
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  RefreshCw, 
  Plus,
  Minus,
  ShoppingCart,
  Trash2
} from 'lucide-react';
// Import supplier service
import supplierService from '../services/supplierService';
// Import global state for editing functionality
import { useGlobalState } from '../context/GlobalStateContext';

const PhoneProcurementForm = () => {
  // ====== GLOBAL STATE FOR EDITING ======
  const { procurementToEdit, clearProcurementToEdit } = useGlobalState();
  
  // ====== EDITING STATE ======
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // ====== STATE DEFINITIONS ======
  // Table data for multiple phone models
  const [procurementItems, setProcurementItems] = useState([]);
  const [nextId, setNextId] = useState(1);
  
  // Current item being added
  const [currentItem, setCurrentItem] = useState({
    id: null,
    manufacturer: '',
    model: '',
    ram: '',
    storage: '',
    color: '',
    quantity: 1,
    dealersPrice: '',
    retailPrice: '',
    totalPrice: 0
  });
  
  // Options from database
  const [manufacturers, setManufacturers] = useState([]);
  const [models, setModels] = useState([]);
  const [rams, setRams] = useState([]);
  const [storages, setStorages] = useState([]);
  const [colors, setColors] = useState([]);
  
  // Supplier management
  const [suppliers, setSuppliers] = useState([]); // Suppliers from Firebase
  const [selectedSupplier, setSelectedSupplier] = useState(''); // Selected supplier ID
  const [selectedSupplierData, setSelectedSupplierData] = useState(null); // Full supplier data
  
  // General procurement details
  const [purchaseDate, setPurchaseDate] = useState('');
  
  // Payment and delivery status - Read-only values for new entries
  const [datePaid] = useState(''); // Read-only, empty for new entries
  const [dateDelivered] = useState(''); // Read-only, empty for new entries
  const [paymentReference, setPaymentReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountPayable, setAccountPayable] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrentItemValid, setIsCurrentItemValid] = useState(false);
  
  // State for tracking available colors for each item in the table
  const [itemColorOptions, setItemColorOptions] = useState({});

  // ====== HELPER FUNCTIONS ======
  // Get current date in YYYY-MM-DD format for date input
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format number with commas
  const formatNumberWithCommas = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // NEW: Format price with commas and two decimal places
  const formatPrice = (value) => {
    if (!value && value !== 0) return '';
    const numValue = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // NEW: Clean price value by removing commas and formatting characters
  const cleanPriceValue = (value) => {
    return value.replace(/[^\d.]/g, '');
  };

  // Validation function for price - UPDATED to work with formatted prices
  const validatePrice = (value) => {
    return cleanPriceValue(value);
  };

  // Format RAM/Storage with GB suffix
  const formatWithGB = (value) => {
    return value ? `${value}GB` : value;
  };

  // Calculate margin percentage
  const calculateMargin = (dealersPrice, retailPrice) => {
    const dealers = parseFloat(dealersPrice.replace(/,/g, '')) || 0;
    const retail = parseFloat(retailPrice.replace(/,/g, '')) || 0;
    
    if (dealers === 0) return '0.00';
    const margin = ((retail - dealers) / dealers) * 100;
    return margin.toFixed(2);
  };

  // Calculate grand total
  const calculateGrandTotal = () => {
    return procurementItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  // Reset current item to initial state
  const resetCurrentItem = () => {
    setCurrentItem({
      id: null,
      manufacturer: '',
      model: '',
      ram: '',
      storage: '',
      color: '',
      quantity: 1,
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    });
  };

  // Reset to create mode function
  const resetToCreateMode = () => {
    clearProcurementToEdit();
    resetForm();
  };

  // Reset form function - UPDATED to properly clear global state
  const resetForm = () => {
    setProcurementItems([]);
    setNextId(1);
    resetCurrentItem();
    setPurchaseDate(getCurrentDate());
    setSelectedSupplier('');
    setSelectedSupplierData(null);
    setBankName('');
    setBankAccount('');
    setAccountPayable('');
    setPaymentReference('');
    setIsSubmitting(false);
    setIsEditing(false);
    setEditingId(null);
    // Clear global state to prevent persistence
    clearProcurementToEdit();
  };
{/* Part 1 End - Imports, State, and Helper Functions */}

{/* Part 2 Start - Data Fetching and useEffect Hooks with Suppliers */}
  // Initialize purchase date to current date
  useEffect(() => {
    setPurchaseDate(getCurrentDate());
  }, []);

  // Handle editing mode when procurementToEdit changes
  useEffect(() => {
    if (procurementToEdit) {
      setIsEditing(true);
      setEditingId(procurementToEdit.id);
      
      // Populate form fields with existing procurement data
      setPurchaseDate(procurementToEdit.purchaseDate || getCurrentDate());
      setSelectedSupplier(procurementToEdit.supplierId || '');
      setBankName(procurementToEdit.bankName || '');
      setBankAccount(procurementToEdit.bankAccount || '');
      setAccountPayable(procurementToEdit.accountPayable || '');
      setPaymentReference(procurementToEdit.paymentReference || '');
      
      // Find and set supplier data
      if (procurementToEdit.supplierId && suppliers.length > 0) {
        const supplierData = suppliers.find(s => s.id === procurementToEdit.supplierId);
        setSelectedSupplierData(supplierData || null);
      }
      
      // Populate procurement items
      if (procurementToEdit.items && Array.isArray(procurementToEdit.items)) {
        const formattedItems = procurementToEdit.items.map((item, index) => ({
          id: index + 1,
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          ram: item.ram || '',
          storage: item.storage || '',
          color: item.color || '',
          quantity: item.quantity || 1,
          dealersPrice: formatNumberWithCommas((item.dealersPrice || 0).toString()),
          retailPrice: (item.retailPrice || 0).toString(),
          totalPrice: item.totalPrice || (item.quantity * item.dealersPrice) || 0
        }));
        setProcurementItems(formattedItems);
        setNextId(formattedItems.length + 1);
      }
    } else {
      setIsEditing(false);
      setEditingId(null);
    }
  }, [procurementToEdit, suppliers]);

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const supplierResult = await supplierService.getAllSuppliers();
        if (supplierResult.success) {
          setSuppliers(supplierResult.suppliers);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchSuppliers();
  }, []);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'phones'));
        const querySnapshot = await getDocs(q);
        const manufacturerSet = new Set();
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.manufacturer) {
            manufacturerSet.add(data.manufacturer);
          }
        });
        
        setManufacturers(Array.from(manufacturerSet).sort());
      } catch (error) {
        console.error("Error fetching manufacturers:", error);
        setError(`Error fetching manufacturers: ${error.message}`);
      }
      setLoading(false);
    };

    fetchManufacturers();
  }, []);

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      if (!currentItem.manufacturer) {
        setModels([]);
        return;
      }
      
      try {
        const q = query(
          collection(db, 'phones'),
          where('manufacturer', '==', currentItem.manufacturer)
        );
        const querySnapshot = await getDocs(q);
        const modelSet = new Set();
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.model) {
            modelSet.add(data.model);
          }
        });
        
        setModels(Array.from(modelSet).sort());
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    };

    fetchModels();
  }, [currentItem.manufacturer]);

  // Fetch RAM, Storage, Colors from arrays in the document
  useEffect(() => {
    const fetchOptions = async () => {
      if (!currentItem.manufacturer || !currentItem.model) {
        setRams([]);
        setStorages([]);
        setColors([]);
        return;
      }
      
      try {
        const q = query(
          collection(db, 'phones'),
          where('manufacturer', '==', currentItem.manufacturer),
          where('model', '==', currentItem.model)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          
          const ramArray = Array.isArray(data.storage_extra) ? data.storage_extra : [];
          setRams(ramArray.sort());
          
          const storageArray = Array.isArray(data.storage) ? data.storage : [];
          setStorages(storageArray.sort());
          
          const colorArray = Array.isArray(data.colors) ? data.colors : [];
          setColors(colorArray.sort());
        } else {
          setRams([]);
          setStorages([]);
          setColors([]);
        }
      } catch (error) {
        console.error("Error fetching options:", error);
        setRams([]);
        setStorages([]);
        setColors([]);
      }
    };

    fetchOptions();
  }, [currentItem.manufacturer, currentItem.model]);

  // Fetch pricing when complete configuration is selected
  useEffect(() => {
    const fetchPricing = async () => {
      if (!currentItem.manufacturer || !currentItem.model || !currentItem.ram || !currentItem.storage || !currentItem.color) {
        setCurrentItem(prev => ({
          ...prev,
          dealersPrice: '',
          retailPrice: ''
        }));
        return;
      }
      
      try {
        const q = query(
          collection(db, 'price_configurations'),
          where('manufacturer', '==', currentItem.manufacturer),
          where('model', '==', currentItem.model),
          where('ram', '==', currentItem.ram),
          where('storage', '==', currentItem.storage),
          where('color', '==', currentItem.color)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const priceData = querySnapshot.docs[0].data();
          setCurrentItem(prev => ({
            ...prev,
            dealersPrice: priceData.dealersPrice ? priceData.dealersPrice.toString() : '',
            retailPrice: priceData.retailPrice ? priceData.retailPrice.toString() : ''
          }));
        } else {
          setCurrentItem(prev => ({
            ...prev,
            dealersPrice: '',
            retailPrice: ''
          }));
        }
      } catch (error) {
        console.error("Error fetching pricing:", error);
        setCurrentItem(prev => ({
          ...prev,
          dealersPrice: '',
          retailPrice: ''
        }));
      }
    };

    fetchPricing();
  }, [currentItem.manufacturer, currentItem.model, currentItem.ram, currentItem.storage, currentItem.color]);

  // Validate current item and calculate totals
  useEffect(() => {
    const isValid = 
      currentItem.manufacturer &&
      currentItem.model &&
      currentItem.ram &&
      currentItem.storage &&
      currentItem.color &&
      currentItem.quantity > 0 &&
      currentItem.dealersPrice &&
      parseFloat(currentItem.dealersPrice.replace(/,/g, '')) > 0;
    
    setIsCurrentItemValid(isValid);
    
    if (currentItem.dealersPrice && currentItem.quantity) {
      const price = parseFloat(currentItem.dealersPrice.replace(/,/g, '')) || 0;
      const total = price * currentItem.quantity;
      
      setCurrentItem(prev => ({
        ...prev,
        totalPrice: total
      }));
    }
  }, [
    currentItem.manufacturer,
    currentItem.model,
    currentItem.ram,
    currentItem.storage,
    currentItem.color,
    currentItem.quantity,
    currentItem.dealersPrice
  ]);
{/* Part 2 End - Data Fetching and useEffect Hooks with Suppliers */}

{/* Part 3 Start - Event Handlers */}
  // Handle purchase date change
  const handlePurchaseDateChange = (e) => {
    setPurchaseDate(e.target.value);
  };

  // Handle supplier selection - UPDATED: Auto-populate account payable from supplier's outstanding balance
  const handleSupplierChange = (e) => {
    const supplierId = e.target.value;
    setSelectedSupplier(supplierId);
    
    if (supplierId) {
      const supplierData = suppliers.find(s => s.id === supplierId);
      setSelectedSupplierData(supplierData);
      
      // Auto-populate bank fields and account payable when supplier is selected
      if (supplierData) {
        setBankName(supplierData.bankName || '');
        setBankAccount(supplierData.bankAccount || '');
        
        // NEW: Auto-populate account payable from supplier's outstanding balance
        const outstandingBalance = supplierData.totalOutstanding || 0;
        setAccountPayable(formatNumberWithCommas(outstandingBalance.toString()));
      }
    } else {
      setSelectedSupplierData(null);
      setBankName('');
      setBankAccount('');
      setAccountPayable(''); // Clear account payable when no supplier selected
    }
  };

  // Handle current item field changes
  const handleCurrentManufacturerChange = (e) => {
    setCurrentItem(prev => ({
      ...prev,
      manufacturer: e.target.value,
      model: '',
      ram: '',
      storage: '',
      color: ''
    }));
  };

  const handleCurrentModelChange = (e) => {
    setCurrentItem(prev => ({
      ...prev,
      model: e.target.value,
      ram: '',
      storage: '',
      color: ''
    }));
  };

  const handleCurrentRamChange = (e) => {
    setCurrentItem(prev => ({
      ...prev,
      ram: e.target.value,
      storage: '',
      color: ''
    }));
  };

  const handleCurrentStorageChange = (e) => {
    setCurrentItem(prev => ({
      ...prev,
      storage: e.target.value,
      color: ''
    }));
  };

  const handleCurrentColorChange = (e) => {
    setCurrentItem(prev => ({
      ...prev,
      color: e.target.value
    }));
  };

  const handleCurrentQuantityChange = (e) => {
    const quantity = parseInt(e.target.value) || 1;
    setCurrentItem(prev => ({
      ...prev,
      quantity: Math.max(1, quantity)
    }));
  };

  const handleCurrentDealersPriceChange = (e) => {
    const cleanValue = validatePrice(e.target.value);
    setCurrentItem(prev => ({
      ...prev,
      dealersPrice: cleanValue
    }));
  };

  const handleCurrentRetailPriceChange = (e) => {
    const cleanValue = validatePrice(e.target.value);
    setCurrentItem(prev => ({
      ...prev,
      retailPrice: cleanValue
    }));
  };

  const handlePaymentReferenceChange = (e) => {
    setPaymentReference(e.target.value);
  };

  const handleBankNameChange = (e) => {
    setBankName(e.target.value);
  };

  const handleBankAccountChange = (e) => {
    setBankAccount(e.target.value);
  };

  const handleAccountPayableChange = (e) => {
    setAccountPayable(e.target.value);
  };
{/* Part 3 End - Event Handlers */}

{/* Part 4 Start - Essential Functions */}
  // Clear all items from procurement list
  const clearAllItems = () => {
    if (window.confirm('Are you sure you want to clear all items from the procurement list?')) {
      setProcurementItems([]);
      resetCurrentItem();
    }
  };

  // Increment current item quantity
  const incrementCurrentQuantity = () => {
    setCurrentItem(prev => ({
      ...prev,
      quantity: prev.quantity + 1
    }));
  };

  // Decrement current item quantity
  const decrementCurrentQuantity = () => {
    setCurrentItem(prev => ({
      ...prev,
      quantity: Math.max(1, prev.quantity - 1)
    }));
  };

  // Increment table item quantity
  const incrementTableQuantity = (itemId) => {
    setProcurementItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * parseFloat(item.dealersPrice.replace(/,/g, '')) }
          : item
      )
    );
  };

  // Decrement table item quantity (remove if quantity becomes 0)
  const decrementTableQuantity = (itemId) => {
    setProcurementItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? item.quantity === 1 
            ? null // Will be filtered out
            : { ...item, quantity: item.quantity - 1, totalPrice: (item.quantity - 1) * parseFloat(item.dealersPrice.replace(/,/g, '')) }
          : item
      ).filter(Boolean) // Remove null items
    );
  };

  // Handle color change in table
  const handleTableColorChange = (itemId, newColor) => {
    setProcurementItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, color: newColor }
          : item
      )
    );
  };

  // Handle form key events
  const handleKeyDown = (e) => {
    // Allow form submission on Ctrl+Enter
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (procurementItems.length > 0 && purchaseDate && selectedSupplier) {
        handleSubmit(e);
      }
    }
  };

  // Add item to procurement table
  const addItemToTable = () => {
    if (!isCurrentItemValid) return;
    
    const dealersPrice = parseFloat(currentItem.dealersPrice.replace(/,/g, '')) || 0;
    const totalPrice = currentItem.quantity * dealersPrice;
    
    const newItem = {
      id: nextId,
      manufacturer: currentItem.manufacturer,
      model: currentItem.model,
      ram: currentItem.ram,
      storage: currentItem.storage,
      color: currentItem.color,
      quantity: currentItem.quantity,
      dealersPrice: formatNumberWithCommas(dealersPrice.toString()),
      retailPrice: currentItem.retailPrice,
      totalPrice: totalPrice
    };
    
    // Store available colors for this item
    setItemColorOptions(prev => ({
      ...prev,
      [nextId]: colors
    }));
    
    setProcurementItems(prev => [...prev, newItem]);
    setNextId(prev => prev + 1);
    resetCurrentItem();
  };
{/* Part 4 End - Essential Functions */}

{/* Part 5 Start - Form Submission with Edit and Create Support */}
  // Handle form submission with supplier service for proper balance updates
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (procurementItems.length === 0) {
      alert('Please add at least one phone model to the procurement list');
      return;
    }
    
    if (!purchaseDate) {
      alert('Please enter the purchase date');
      return;
    }
    
    // Supplier validation - Required for saving
    if (!selectedSupplier) {
      alert('Please select a supplier before saving the procurement record');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const grandTotal = calculateGrandTotal();
      
      // Prepare procurement data
      const procurementData = {
        // Items array
        items: procurementItems.map(item => ({
          manufacturer: item.manufacturer,
          model: item.model,
          ram: item.ram,
          storage: item.storage,
          color: item.color,
          quantity: item.quantity,
          dealersPrice: parseFloat(item.dealersPrice.replace(/,/g, '')) || 0,
          retailPrice: parseFloat(item.retailPrice.replace(/,/g, '')) || 0,
          totalPrice: item.totalPrice
        })),
        
        // Summary data
        totalQuantity: procurementItems.reduce((sum, item) => sum + item.quantity, 0),
        grandTotal: grandTotal,
        
        // Procurement details
        purchaseDate: purchaseDate,
        paymentStatus: 'pending',
        deliveryStatus: 'pending',
        paymentReference: paymentReference || '',
        bankName: bankName || '',
        bankAccount: bankAccount || '',
        accountPayable: accountPayable || ''
      };
      
      if (isEditing) {
        // UPDATE EXISTING PROCUREMENT WITH PROPER BALANCE MANAGEMENT
        console.log("Updating procurement with supplier service:", editingId, procurementData);
        
        const result = await supplierService.updateProcurement(
          editingId, 
          procurementData, 
          selectedSupplier
        );
        
        if (result.success) {
          console.log("Procurement updated successfully:", result);
          
          // Clear editing state
          clearProcurementToEdit();
          
          // Detailed success message
          let message = `Procurement record updated successfully!\n\n`;
          message += `Procurement ID: ${editingId}\n`;
          message += `Supplier: ${selectedSupplierData?.supplierName}\n`;
          message += `Total Items: ${procurementData.items.length}\n`;
          message += `Total Quantity: ${procurementData.totalQuantity}\n`;
          message += `Grand Total: ₱${formatPrice(grandTotal.toString())}\n`;
          
          if (result.supplierChanged) {
            message += `\n🔄 Supplier was changed - balances updated accordingly`;
          }
          
          if (result.grandTotalDifference !== 0) {
            const diffType = result.grandTotalDifference > 0 ? 'increased' : 'decreased';
            const diffAmount = Math.abs(result.grandTotalDifference);
            message += `\n💰 Grand total ${diffType} by ₱${formatPrice(diffAmount.toString())}`;
            message += `\n📊 Supplier balance updated automatically`;
          }
          
          alert(message);
          
          // Reset form
          resetForm();
          
        } else {
          console.error("Error updating procurement:", result.error);
          alert(`Error updating procurement: ${result.error}`);
        }
        
      } else {
        // CREATE NEW PROCUREMENT (existing logic)
        console.log("Creating new procurement with supplier service:", procurementData);
        
        const result = await supplierService.createProcurement(procurementData, selectedSupplier);
        
        if (result.success) {
          console.log("Procurement created successfully:", result);
          
          // Success message
          alert(`Procurement record saved successfully!\n\nProcurement ID: ${result.procurementId}\nReference: ${result.reference}\nSupplier: ${selectedSupplierData?.supplierName}\nTotal Items: ${procurementData.items.length}\nTotal Quantity: ${procurementData.totalQuantity}\nGrand Total: ₱${formatPrice(grandTotal.toString())}`);
          
          // Reset form
          resetForm();
          
        } else {
          console.error("Error creating procurement:", result.error);
          alert(`Error creating procurement: ${result.error}`);
        }
      }
      
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      alert(`Error submitting form: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
{/* Part 5 End - Form Submission with Edit and Create Support */}

{/* Part 6 Start - Loading States and Form Start */}
  // Show loading state ONLY when actually loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <ShoppingCart className="h-6 w-6 mr-2" />
              Phone Procurement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading form data...</p>
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
        <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-red-600 py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <ShoppingCart className="h-6 w-6 mr-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
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

  // Main component render
  return (
    <div className="min-h-screen bg-white p-4">
      <form 
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
      >
        <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl text-white flex items-center">
                <ShoppingCart className="h-6 w-6 mr-2" />
                {isEditing ? `Edit Phone Procurement - ${procurementToEdit?.reference || editingId}` : 'Phone Procurement'}
              </CardTitle>
              
              {/* Cancel Edit Button */}
              {(isEditing || procurementToEdit) && (
                <button
                  type="button"
                  onClick={resetToCreateMode}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center text-sm"
                  title="Cancel editing and return to create mode"
                >
                  ✕ Cancel Edit
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="bg-white p-4 space-y-6">
{/* Part 6 End - Loading States and Form Start */}

{/* Part 7 Start - Procurement Details Section */}
            {/* Procurement Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Procurement Details</h3>
              
              {/* First Row: Purchase Date, Supplier, Bank Name, Bank Account, Account Payable */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Purchase Date */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Purchase Date:</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm h-10"
                    value={purchaseDate}
                    onChange={handlePurchaseDateChange}
                    required
                  />
                </div>

                {/* Supplier - Dropdown */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Supplier:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10"
                    value={selectedSupplier}
                    onChange={handleSupplierChange}
                    required
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplierName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bank Name - DISABLED */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Bank Name:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                    value={bankName}
                    onChange={handleBankNameChange}
                    placeholder="Bank name"
                    disabled={true}
                  />
                </div>

                {/* Bank Account - DISABLED */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Bank Account:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                    value={bankAccount}
                    onChange={handleBankAccountChange}
                    placeholder="Account number"
                    disabled={true}
                  />
                </div>

                {/* Account Payable - DISABLED */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Account Payable:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                    value={accountPayable}
                    onChange={handleAccountPayableChange}
                    placeholder="Payable amount"
                    disabled={true}
                  />
                </div>
              </div>

              {/* Second Row: Payment Status, Date Paid, Payment Reference, Delivery Status, Date Delivered */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Payment Status - Read-only */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Payment Status:</label>
                  <div className="w-full p-2 border rounded text-sm h-10 bg-gray-50 flex items-center">
                    <span className="inline-block px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                      Unpaid
                    </span>
                  </div>
                </div>

                {/* Date Paid */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Paid:</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value={datePaid}
                    disabled
                  />
                </div>

                {/* Payment Reference - DISABLED */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Payment Reference:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                    value={paymentReference}
                    onChange={handlePaymentReferenceChange}
                    placeholder="Receipt #"
                    disabled={true}
                  />
                </div>

                {/* Delivery Status - Read-only */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Delivery Status:</label>
                  <div className="w-full p-2 border rounded text-sm h-10 bg-gray-50 flex items-center">
                    <span className="inline-block px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  </div>
                </div>

                {/* Date Delivered */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Delivered:</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value={dateDelivered}
                    disabled
                  />
                </div>
              </div>
            </div>
{/* Part 7 End - Procurement Details Section */}

{/* Part 8 Start - Phone Selection Section */}
            {/* Add Phone Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Add Phone Model</h3>
              
              {/* Phone Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Manufacturer - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Manufacturer:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.manufacturer}
                    onChange={handleCurrentManufacturerChange}
                  >
                    <option value="">-- Select --</option>
                    {manufacturers.map(manufacturer => (
                      <option key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Model:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.model}
                    onChange={handleCurrentModelChange}
                    disabled={!currentItem.manufacturer}
                  >
                    <option value="">-- Select --</option>
                    {models.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RAM - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">RAM:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.ram}
                    onChange={handleCurrentRamChange}
                    disabled={!currentItem.model}
                  >
                    <option value="">-- Select --</option>
                    {rams.map(ram => (
                      <option key={ram} value={ram}>
                        {formatWithGB(ram)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Storage - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Storage:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.storage}
                    onChange={handleCurrentStorageChange}
                    disabled={!currentItem.model}
                  >
                    <option value="">-- Select --</option>
                    {storages.map(storage => (
                      <option key={storage} value={storage}>
                        {formatWithGB(storage)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Color:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.color}
                    onChange={handleCurrentColorChange}
                    disabled={!currentItem.ram || !currentItem.storage}
                  >
                    <option value="">-- Select --</option>
                    {colors.map(color => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Second Row: Quantity, Dealers Price, Retail Price, Total Price, Margin % + Action */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Quantity - REMOVED required */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Quantity:</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={decrementCurrentQuantity}
                      disabled={currentItem.quantity <= 1}
                      className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input 
                      type="number" 
                      className="w-32 p-2 border rounded text-center text-sm h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={currentItem.quantity}
                      onChange={handleCurrentQuantityChange}
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={incrementCurrentQuantity}
                      className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Dealers Price - UPDATED with formatted display */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Dealer&apos;s Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm"
                      value={currentItem.dealersPrice ? formatPrice(currentItem.dealersPrice) : ''}
                      onChange={handleCurrentDealersPriceChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Retail Price - UPDATED with formatted display */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Retail Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                      value={currentItem.retailPrice ? formatPrice(currentItem.retailPrice) : ''}
                      onChange={handleCurrentRetailPriceChange}
                      placeholder="0.00"
                      disabled={true}
                    />
                  </div>
                </div>

                {/* Total Price Display */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Total Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                      value={currentItem.totalPrice ? formatPrice(currentItem.totalPrice.toString()) : '0.00'}
                      disabled={true}
                      readOnly
                    />
                  </div>
                </div>

                {/* Margin + Add Button */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-20 space-y-2">
                      <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Margin:</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-400 text-center"
                        value={currentItem.dealersPrice && currentItem.retailPrice ? `${calculateMargin(currentItem.dealersPrice, currentItem.retailPrice)}%` : '0.00%'}
                        disabled={true}
                        readOnly
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Action:</label>
                      <button
                        type="button"
                        onClick={addItemToTable}
                        disabled={!isCurrentItemValid}
                        className="w-full py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
{/* Part 8 End - Phone Selection Section */}

{/* Part 9 Start - Procurement Table */}
            {/* Section Divider */}
            <div className="border-t border-gray-300 my-6"></div>

            {/* Procurement Table Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                  Procurement List ({procurementItems.length} items)
                </h3>
                {procurementItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllItems}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </button>
                )}
              </div>

              {procurementItems.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-700 mb-2">No items in procurement list</h4>
                  <p className="text-gray-500">Add phone models above to build your procurement list</p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-2 text-left font-semibold w-[13%]">Manufacturer</th>
                        <th className="border px-3 py-2 text-left font-semibold w-[13%]">Model</th>
                        <th className="border px-3 py-2 text-left font-semibold w-[22%]">Configuration</th>
                        <th className="border px-3 py-2 text-left font-semibold w-[10%]">Color</th>
                        <th className="border px-3 py-2 text-center font-semibold w-[12%]">Qty</th>
                        <th className="border px-3 py-2 text-right font-semibold w-[15%]">Unit Price</th>
                        <th className="border px-3 py-2 text-right font-semibold w-[15%]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procurementItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border px-3 py-2">
                            <div className="font-medium">{item.manufacturer}</div>
                          </td>
                          <td className="border px-3 py-2">
                            <div className="text-gray-700">{item.model}</div>
                          </td>
                          <td className="border px-3 py-2">
                            <div className="whitespace-nowrap">{formatWithGB(item.ram)} RAM / {formatWithGB(item.storage)} Storage</div>
                          </td>
                          <td className="border px-3 py-2">
                            <select
                              value={item.color}
                              onChange={(e) => handleTableColorChange(item.id, e.target.value)}
                              className="w-full p-1 border rounded text-xs bg-white"
                              title="Change color"
                            >
                              {(itemColorOptions[item.id] || [item.color]).map(color => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => decrementTableQuantity(item.id)}
                                className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs"
                                title={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium min-w-[2rem] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => incrementTableQuantity(item.id)}
                                className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs"
                                title="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="border px-3 py-2 text-right font-mono">
                            ₱{formatPrice(item.dealersPrice)}
                          </td>
                          <td className="border px-3 py-2 text-right font-mono font-medium">
                            ₱{formatPrice(item.totalPrice.toString())}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 font-semibold">
                        <td colSpan="4" className="border px-3 py-2 text-right">Total Items:</td>
                        <td className="border px-3 py-2 text-center">
                          {procurementItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </td>
                        <td className="border px-3 py-2 text-right">Grand Total:</td>
                        <td className="border px-3 py-2 text-right font-mono text-lg">
                          ₱{formatPrice(calculateGrandTotal().toString())}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
{/* Part 9 End - Procurement Table */}

{/* Part 10 Start - Summary and Submit Button */}
            {/* Procurement Summary Section */}
            {procurementItems.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Procurement Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Unique Models</p>
                        <p className="text-xs text-gray-500">Different phone configurations</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">
                          {procurementItems.length}
                        </p>
                        <p className="text-xs text-gray-500">models</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Total Units</p>
                        <p className="text-xs text-gray-500">Combined quantity ordered</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          {procurementItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </p>
                        <p className="text-xs text-gray-500">units</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Grand Total</p>
                        <p className="text-xs text-gray-500">Total procurement cost</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-purple-600">
                          ₱{formatPrice(calculateGrandTotal().toString())}
                        </p>
                        <p className="text-xs text-gray-500">total cost</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button - UPDATED: Shows edit vs create mode */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  procurementItems.length === 0 || 
                  isSubmitting || 
                  !purchaseDate || 
                  !selectedSupplier
                }
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    {isEditing ? 'Updating Procurement...' : 'Saving Procurement...'}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isEditing ? `Update Procurement Record (${procurementItems.length} items)` : `Save Procurement Record (${procurementItems.length} items)`}
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PhoneProcurementForm;
{/* Part 10 End - Summary and Submit Button */}