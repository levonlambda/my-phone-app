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
  const { procurementToEdit, clearProcurementToEdit, isViewingProcurement } = useGlobalState(); // NEW: Add isViewingProcurement
  
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
      
      // Calculate account payable: use saved value, or calculate from grand total if zero/empty
      let accountPayableValue = procurementToEdit.accountPayable || '';
      
      // If account payable is zero or empty, calculate it from the procurement's grand total
      // This makes business sense: account payable should be the amount owed for THIS procurement
      if (!accountPayableValue || accountPayableValue === '0' || accountPayableValue === 0) {
        const grandTotal = procurementToEdit.grandTotal || 0;
        accountPayableValue = formatNumberWithCommas(grandTotal.toString());
      }
      
      // Populate form fields with existing procurement data
      setPurchaseDate(procurementToEdit.purchaseDate || getCurrentDate());
      setSelectedSupplier(procurementToEdit.supplierId || '');
      setBankName(procurementToEdit.bankName || '');
      setBankAccount(procurementToEdit.bankAccount || '');
      setAccountPayable(accountPayableValue);
      setPaymentReference(procurementToEdit.paymentReference || '');
      
      // Find and set supplier data WITHOUT triggering auto-populate behavior
      if (procurementToEdit.supplierId && suppliers.length > 0) {
        const supplierData = suppliers.find(s => s.id === procurementToEdit.supplierId);
        setSelectedSupplierData(supplierData || null);
        
        // For existing procurement: preserve bank fields from procurement data, NOT supplier data
        // This prevents overwriting with current supplier info when we want historical data
        if (supplierData) {
          // Only set bank fields if they're empty in procurement data
          if (!procurementToEdit.bankName) {
            setBankName(supplierData.bankName || '');
          }
          if (!procurementToEdit.bankAccount) {
            setBankAccount(supplierData.bankAccount || '');
          }
          // IMPORTANT: Account payable is already set above based on procurement data or calculated from grand total
          // Do NOT auto-populate from supplier's current outstanding balance for existing procurements
        }
      }
      
      // Populate procurement items and fetch colors for each item
      if (procurementToEdit.items && Array.isArray(procurementToEdit.items)) {
        const formattedItems = procurementToEdit.items.map((item, index) => ({
          id: index + 1,
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          ram: item.ram || '',
          storage: item.storage || '',
          color: item.color || '',
          quantity: item.quantity || 1,
          dealersPrice: item.dealersPrice || '',
          retailPrice: item.retailPrice || '',
          totalPrice: item.totalPrice || 0
        }));
        
        setProcurementItems(formattedItems);
        setNextId(formattedItems.length + 1);
        
        // Fetch colors for each existing item
        const fetchColorsForExistingItems = async () => {
          const colorOptionsMap = {};
          
          for (const item of formattedItems) {
            if (item.manufacturer && item.model) {
              try {
                const q = query(
                  collection(db, 'phones'),
                  where('manufacturer', '==', item.manufacturer),
                  where('model', '==', item.model)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const data = querySnapshot.docs[0].data();
                  const colorArray = Array.isArray(data.colors) ? data.colors : [];
                  colorOptionsMap[item.id] = colorArray.sort();
                }
              } catch (error) {
                console.error(`Error fetching colors for ${item.manufacturer} ${item.model}:`, error);
                colorOptionsMap[item.id] = [];
              }
            } else {
              colorOptionsMap[item.id] = [];
            }
          }
          
          // Update itemColorOptions state with all fetched colors
          setItemColorOptions(colorOptionsMap);
        };
        
        // Call the function to fetch colors
        fetchColorsForExistingItems();
      }
    } else {
      // Reset form when not editing
      setIsEditing(false);
      setEditingId(null);
      setProcurementItems([]);
      setNextId(1);
      setItemColorOptions({}); // Clear color options
    }
  }, [procurementToEdit, suppliers]);

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const supplierResult = await supplierService.getAllSuppliers();
        if (supplierResult.success) {
          setSuppliers(supplierResult.suppliers);
          console.log("Suppliers loaded:", supplierResult.suppliers.length);
        } else {
          setError("Failed to load suppliers");
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        setError("Failed to load suppliers");
      }
    };

    fetchSuppliers();
  }, []);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'phones'));
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
      } finally {
        setLoading(false);
      }
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

  // Handle supplier selection - UPDATED: Auto-populate account payable from supplier's outstanding balance (only for new procurement)
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
        
        // FIXED: Only auto-populate account payable for NEW procurement, not when editing existing ones
        // This preserves the historical account payable value for existing procurements
        if (!isEditing && !procurementToEdit) {
          const outstandingBalance = supplierData.totalOutstanding || 0;
          setAccountPayable(formatNumberWithCommas(outstandingBalance.toString()));
        }
        // For existing procurement: keep the account payable that was already set from procurement data
      }
    } else {
      setSelectedSupplierData(null);
      setBankName('');
      setBankAccount('');
      // Only clear account payable for new procurement, not when editing
      if (!isEditing && !procurementToEdit) {
        setAccountPayable('');
      }
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
  // Helper function to safely parse any price (handles both string and number)
  const safeParsePrice = (price) => {
    if (typeof price === 'number') {
      return price;
    }
    if (typeof price === 'string') {
      return parseFloat(price.replace(/,/g, '')) || 0;
    }
    return 0;
  };

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
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * safeParsePrice(item.dealersPrice) }
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
            : { ...item, quantity: item.quantity - 1, totalPrice: (item.quantity - 1) * safeParsePrice(item.dealersPrice) }
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
        // Items array - using safe parsing for both dealersPrice and retailPrice
        items: procurementItems.map(item => ({
          manufacturer: item.manufacturer,
          model: item.model,
          ram: item.ram,
          storage: item.storage,
          color: item.color,
          quantity: item.quantity,
          dealersPrice: safeParsePrice(item.dealersPrice),
          retailPrice: safeParsePrice(item.retailPrice),
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
              onClick={() => window.location.reload()}
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
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl text-white flex items-center">
                <ShoppingCart className="h-6 w-6 mr-2" />
                {isViewingProcurement 
                  ? `View Phone Procurement - ${procurementToEdit?.reference || procurementToEdit?.id}`
                  : (isEditing || procurementToEdit) 
                    ? `Edit Phone Procurement - ${procurementToEdit?.reference || editingId}` 
                    : 'Phone Procurement'}
              </CardTitle>
              
              {/* Cancel Edit Button */}
              {(isEditing || procurementToEdit) && (
                <button
                  type="button"
                  onClick={resetToCreateMode}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center text-sm"
                  title={isViewingProcurement ? "Close view and return to create mode" : "Cancel editing and return to create mode"}
                >
                  ✕ {isViewingProcurement ? 'Close' : 'Cancel Edit'}
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
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={purchaseDate}
                    onChange={handlePurchaseDateChange}
                    disabled={isViewingProcurement}
                    required
                  />
                </div>

                {/* Supplier - Dropdown */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Supplier:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={selectedSupplier}
                    onChange={handleSupplierChange}
                    disabled={isViewingProcurement}
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
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value="Pending"
                    disabled={true}
                  />
                </div>

                {/* Date Paid - Read-only */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Paid:</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value={datePaid}
                    disabled={true}
                  />
                </div>

                {/* Payment Reference - DISABLED in both create and edit modes */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Payment Reference:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value={paymentReference}
                    onChange={handlePaymentReferenceChange}
                    placeholder="Payment reference"
                    disabled={true}
                  />
                </div>

                {/* Delivery Status - Read-only */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Delivery Status:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value="Pending"
                    disabled={true}
                  />
                </div>

                {/* Date Delivered - Read-only */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Delivered:</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                    value={dateDelivered}
                    disabled={true}
                  />
                </div>
              </div>
            </div>
{/* Part 7 End - Procurement Details Section */}

{/* Part 8 Start - Phone Selection Section */}
            {/* Phone Selection Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Add Phone to Procurement</h3>
              
              {/* First Row: Manufacturer, Model, RAM, Storage, Color */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Manufacturer */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Manufacturer:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={currentItem.manufacturer}
                    onChange={handleCurrentManufacturerChange}
                    disabled={isViewingProcurement}
                  >
                    <option value="">-- Select Manufacturer --</option>
                    {manufacturers.map(manufacturer => (
                      <option key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Model:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={currentItem.model}
                    onChange={handleCurrentModelChange}
                    disabled={isViewingProcurement || !currentItem.manufacturer}
                  >
                    <option value="">-- Select Model --</option>
                    {models.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RAM */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">RAM:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={currentItem.ram}
                    onChange={handleCurrentRamChange}
                    disabled={isViewingProcurement || !currentItem.model}
                  >
                    <option value="">-- Select RAM --</option>
                    {rams.map(ram => (
                      <option key={ram} value={ram}>
                        {formatWithGB(ram)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Storage */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Storage:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={currentItem.storage}
                    onChange={handleCurrentStorageChange}
                    disabled={isViewingProcurement || !currentItem.ram}
                  >
                    <option value="">-- Select Storage --</option>
                    {storages.map(storage => (
                      <option key={storage} value={storage}>
                        {formatWithGB(storage)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Color:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    value={currentItem.color}
                    onChange={handleCurrentColorChange}
                    disabled={isViewingProcurement || !currentItem.storage}
                  >
                    <option value="">-- Select Color --</option>
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
                      disabled={currentItem.quantity <= 1 || isViewingProcurement}
                      className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input 
                      type="number" 
                      className="w-32 p-2 border rounded text-center text-sm h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-gray-100 disabled:text-gray-500"
                      value={currentItem.quantity}
                      onChange={handleCurrentQuantityChange}
                      disabled={isViewingProcurement}
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={incrementCurrentQuantity}
                      disabled={isViewingProcurement}
                      className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                      className="w-full p-2 pl-6 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      value={currentItem.dealersPrice ? formatNumberWithCommas(currentItem.dealersPrice) : ''}
                      onChange={handleCurrentDealersPriceChange}
                      disabled={isViewingProcurement}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Retail Price - UPDATED with formatted display */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Retail Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      value={currentItem.retailPrice ? formatNumberWithCommas(currentItem.retailPrice) : ''}
                      onChange={handleCurrentRetailPriceChange}
                      disabled={isViewingProcurement}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Total Price - Auto-calculated, disabled */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Total Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm bg-gray-100 text-gray-400"
                      value={currentItem.dealersPrice && currentItem.quantity 
                        ? formatPrice((parseFloat(currentItem.dealersPrice.replace(/,/g, '')) * currentItem.quantity).toString())
                        : '0.00'}
                      disabled={true}
                      readOnly
                    />
                  </div>
                </div>

                {/* Right Column: Margin and Action */}
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Margin:</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded text-sm bg-gray-100 text-gray-400 text-center"
                      value={currentItem.dealersPrice && currentItem.retailPrice 
                        ? `${calculateMargin(currentItem.dealersPrice, currentItem.retailPrice)}%` : '0.00%'}
                      disabled={true}
                      readOnly
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Action:</label>
                    <button
                      type="button"
                      onClick={addItemToTable}
                      disabled={!isCurrentItemValid || isViewingProcurement}
                      className="w-full py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </button>
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
                {procurementItems.length > 0 && !isViewingProcurement && (
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
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-lg font-medium">No items in procurement list</p>
                  <p className="text-sm">Add phones using the form above</p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-3 text-left font-semibold">Manufacturer</th>
                        <th className="border px-3 py-3 text-left font-semibold">Model</th>
                        <th className="border px-3 py-3 text-center font-semibold">RAM</th>
                        <th className="border px-3 py-3 text-center font-semibold">Storage</th>
                        <th className="border px-3 py-3 text-center font-semibold">Color</th>
                        <th className="border px-3 py-3 text-center font-semibold">Qty</th>
                        <th className="border px-3 py-3 text-right font-semibold">Dealer&apos;s Price</th>
                        <th className="border px-3 py-3 text-right font-semibold">Total Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procurementItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-left">{item.manufacturer}</td>
                          <td className="border px-3 py-2 text-left">{item.model}</td>
                          <td className="border px-3 py-2 text-center">{formatWithGB(item.ram)}</td>
                          <td className="border px-3 py-2 text-center">{formatWithGB(item.storage)}</td>
                          <td className="border px-3 py-2 text-center">
                            {isViewingProcurement ? (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                {item.color}
                              </span>
                            ) : (
                              <select 
                                value={item.color}
                                onChange={(e) => handleTableColorChange(item.id, e.target.value)}
                                className="w-full p-1 border rounded text-xs text-center"
                              >
                                {(itemColorOptions[item.id] || []).map(color => (
                                  <option key={color} value={color}>{color}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="border px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => decrementTableQuantity(item.id)}
                                disabled={isViewingProcurement}
                                className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xs"
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
                                disabled={isViewingProcurement}
                                className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xs"
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

            {/* Submit Button - Hide when viewing */}
            {!isViewingProcurement && (
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
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PhoneProcurementForm;
{/* Part 10 End - Summary and Submit Button */}