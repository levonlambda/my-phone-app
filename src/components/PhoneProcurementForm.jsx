{/* Part 1 Start - Imports, State, and Helper Functions with Persistence Logic */}
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  RefreshCw, 
  Plus,
  Minus,
  ShoppingCart,
  Trash2
} from 'lucide-react';

const PhoneProcurementForm = () => {
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
    supplier: '',
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
  
  // General procurement details
  const [purchaseDate, setPurchaseDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [isReceived, setIsReceived] = useState(false);
  const [datePaid, setDatePaid] = useState('');
  const [dateDelivered, setDateDelivered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountPayable, setAccountPayable] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrentItemValid, setIsCurrentItemValid] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  
  // NEW: State for tracking available colors for each item in the table
  const [itemColorOptions, setItemColorOptions] = useState({});

  // ====== HELPER FUNCTIONS ======
  // UPDATED: Get current date in YYYY-MM-DD format for date input
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

  // Validation function for price
  const validatePrice = (value) => {
    return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  };

  // Calculate total for current item
  const calculateItemTotal = (quantity, price) => {
    if (!price || !quantity) return 0;
    const cleanPrice = parseFloat(price.replace(/,/g, '')) || 0;
    return cleanPrice * quantity;
  };

  // Calculate grand total for all items
  const calculateGrandTotal = () => {
    return procurementItems.reduce((total, item) => total + item.totalPrice, 0);
  };

  // Format with GB suffix if needed
  const formatWithGB = (value) => {
    if (!value) return 'N/A';
    if (value.includes('GB') || value.includes('TB') || value.includes('gb') || value.includes('tb')) {
      return value;
    }
    return `${value}GB`;
  };

  // Calculate margin percentage
  const calculateMargin = (dealersPrice, retailPrice) => {
    if (!dealersPrice || !retailPrice) return 'N/A';
    const dPrice = parseFloat(dealersPrice.replace(/,/g, '')) || 0;
    const rPrice = parseFloat(retailPrice.replace(/,/g, '')) || 0;
    
    if (dPrice <= 0) return '0.00';
    
    const margin = ((rPrice - dPrice) / dPrice) * 100;
    return margin.toFixed(2);
  };

  // Generate unique ID for items
  const generateItemId = () => {
    const id = nextId;
    setNextId(prev => prev + 1);
    return id;
  };

  // NEW: Handle payment status change
  const handlePaymentStatusChange = (e) => {
    const newPaymentStatus = e.target.value === 'Paid';
    setIsPaid(newPaymentStatus);
    
    if (newPaymentStatus) {
      // If changing to Paid, set date paid to current date
      setDatePaid(getCurrentDate());
    } else {
      // If changing from Paid to Unpaid, clear the related fields
      setDatePaid('');
      setPaymentReference('');
    }
  };

  // NEW: Handle delivery status change
  const handleDeliveryStatusChange = (e) => {
    const newDeliveryStatus = e.target.value === 'Delivered';
    setIsReceived(newDeliveryStatus);
    
    if (newDeliveryStatus) {
      // If changing to Delivered, set date delivered to current date
      setDateDelivered(getCurrentDate());
    } else {
      // If changing from Delivered to Pending, clear the date delivered field
      setDateDelivered('');
    }
  };

  // NEW: Handle date paid change
  const handleDatePaidChange = (e) => {
    setDatePaid(e.target.value);
  };

  // NEW: Handle date delivered change
  const handleDateDeliveredChange = (e) => {
    setDateDelivered(e.target.value);
  };

  // NEW: Handle payment reference change
  const handlePaymentReferenceChange = (e) => {
    setPaymentReference(e.target.value);
  };

  // NEW: Handle bank name change
  const handleBankNameChange = (e) => {
    setBankName(e.target.value);
  };

  // NEW: Handle bank account change
  const handleBankAccountChange = (e) => {
    setBankAccount(e.target.value);
  };

  // NEW: Handle account payable change
  const handleAccountPayableChange = (e) => {
    setAccountPayable(e.target.value);
  };

  // NEW: Handle retail price change for current item
  const handleCurrentRetailPriceChange = (e) => {
    const rawValue = e.target.value;
    
    if (rawValue === '') {
      setCurrentItem(prev => ({
        ...prev,
        retailPrice: ''
      }));
    } else {
      const validatedPrice = validatePrice(rawValue);
      const formattedPrice = formatNumberWithCommas(validatedPrice);
      setCurrentItem(prev => ({
        ...prev,
        retailPrice: formattedPrice
      }));
    }
  };

  // UPDATED: Modified reset function to preserve supplier and manufacturer
  const resetCurrentItem = () => {
    const preservedManufacturer = currentItem.manufacturer;
    const preservedSupplier = currentItem.supplier;
    
    setCurrentItem({
      id: null,
      manufacturer: preservedManufacturer, // KEEP manufacturer
      model: '',
      ram: '',
      storage: '',
      color: '',
      supplier: preservedSupplier, // KEEP supplier
      quantity: 1,
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    });
    
    // DON'T clear the options arrays if manufacturer is preserved
    if (!preservedManufacturer) {
      setModels([]);
      setRams([]);
      setStorages([]);
      setColors([]);
    }
    // If manufacturer is preserved, keep the models but clear the dependent options
    else {
      setRams([]);
      setStorages([]);
      setColors([]);
    }
    
    setIsCurrentItemValid(false);
  };

  // NEW: Function to increment quantity in table
  const incrementTableQuantity = (itemId) => {
    setProcurementItems(prev => 
      prev.map(item => {
        if (item.id === itemId) {
          const newQuantity = item.quantity + 1;
          const newTotalPrice = calculateItemTotal(newQuantity, item.dealersPrice);
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: newTotalPrice
          };
        }
        return item;
      })
    );
  };

  // NEW: Function to decrement quantity in table
  const decrementTableQuantity = (itemId) => {
    const item = procurementItems.find(item => item.id === itemId);
    if (item && item.quantity === 1) {
      // Remove item if quantity would become 0
      setProcurementItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      setProcurementItems(prev => 
        prev.map(item => {
          if (item.id === itemId) {
            const newQuantity = Math.max(1, item.quantity - 1);
            const newTotalPrice = calculateItemTotal(newQuantity, item.dealersPrice);
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: newTotalPrice
            };
          }
          return item;
        })
      );
    }
  };

  // NEW: Function to handle color change in table
  const handleTableColorChange = async (itemId, newColor) => {
    const item = procurementItems.find(item => item.id === itemId);
    if (!item) return;

    // Fetch price for new color configuration
    const price = await fetchPriceForConfiguration(
      item.manufacturer, 
      item.model, 
      item.ram, 
      item.storage, 
      newColor
    );

    setProcurementItems(prev => 
      prev.map(mappedItem => {
        if (mappedItem.id === itemId) {
          const newDealersPrice = price || mappedItem.dealersPrice;
          const newTotalPrice = calculateItemTotal(mappedItem.quantity, newDealersPrice);
          return {
            ...mappedItem,
            color: newColor,
            dealersPrice: newDealersPrice,
            totalPrice: newTotalPrice
          };
        }
        return mappedItem;
      })
    );
  };

  // NEW: Function to get available colors for a specific item
  const getAvailableColorsForItem = async (manufacturer, model) => {
    try {
      const phonesRef = collection(db, 'phones');
      const q = query(
        phonesRef, 
        where("manufacturer", "==", manufacturer),
        where("model", "==", model)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return Array.isArray(data.colors) ? data.colors : [];
      }
      return [];
    } catch (error) {
      console.error("Error fetching colors:", error);
      return [];
    }
  };
{/* Part 1 End - Imports, State, and Helper Functions with Persistence Logic */}

{/* Part 2 Start - Data Fetching Functions */}
  // ====== DATA FETCHING FUNCTIONS ======
  // Fetch manufacturers from phones collection
  const fetchManufacturers = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Fetching manufacturers...");
      const phonesRef = collection(db, 'phones');
      const snapshot = await getDocs(phonesRef);
      
      const uniqueManufacturers = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.manufacturer) {
          uniqueManufacturers.add(data.manufacturer);
        }
      });
      
      const manufacturerArray = Array.from(uniqueManufacturers).sort();
      console.log("Manufacturers fetched:", manufacturerArray);
      setManufacturers(manufacturerArray);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      setError(`Error fetching manufacturers: ${error.message}`);
      setLoading(false);
    }
  }, []);

  // Fetch models for a specific manufacturer
  const fetchModels = useCallback(async (manufacturer) => {
    if (!manufacturer) {
      setModels([]);
      return;
    }
    
    try {
      console.log(`Fetching models for ${manufacturer}...`);
      const phonesRef = collection(db, 'phones');
      const q = query(phonesRef, where("manufacturer", "==", manufacturer));
      const snapshot = await getDocs(q);
      
      const uniqueModels = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.model) {
          uniqueModels.add(data.model);
        }
      });
      
      const modelArray = Array.from(uniqueModels).sort();
      console.log("Models fetched:", modelArray);
      setModels(modelArray);
    } catch (error) {
      console.error(`Error fetching models for ${manufacturer}:`, error);
      setError(`Error fetching models: ${error.message}`);
    }
  }, []);

  // Fetch options (RAM, storage, colors) for a specific manufacturer and model
  const fetchOptions = useCallback(async (manufacturer, model) => {
    if (!manufacturer || !model) {
      setRams([]);
      setStorages([]);
      setColors([]);
      return;
    }
    
    try {
      console.log(`Fetching options for ${manufacturer} ${model}...`);
      const phonesRef = collection(db, 'phones');
      const q = query(
        phonesRef, 
        where("manufacturer", "==", manufacturer),
        where("model", "==", model)
      );
      const snapshot = await getDocs(q);
      
      let ramArray = [];
      let storageArray = [];
      let colorArray = [];
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        
        ramArray = Array.isArray(data.storage_extra) ? data.storage_extra : [];
        storageArray = Array.isArray(data.storage) ? data.storage : [];
        colorArray = Array.isArray(data.colors) ? data.colors : [];
        
        setRams(ramArray);
        setStorages(storageArray);
        setColors(colorArray);
        
        console.log("Options fetched:", {
          rams: ramArray,
          storages: storageArray,
          colors: colorArray
        });
      }
    } catch (error) {
      console.error(`Error fetching options for ${manufacturer} ${model}:`, error);
      setError(`Error fetching options: ${error.message}`);
    }
  }, []);

  // Fetch price for specific configuration - UPDATED to return both dealer and retail prices
  const fetchPriceForConfiguration = useCallback(async (manufacturer, model, ram, storage, color) => {
    try {
      console.log("Fetching price for configuration...");
      
      // First try to get color-specific pricing
      const colorConfigId = `${manufacturer}_${model}_${ram}_${storage}_${color}`.replace(/\s+/g, '_').toLowerCase();
      const colorConfigRef = doc(db, 'price_configurations', colorConfigId);
      const colorConfigSnap = await getDoc(colorConfigRef);
      
      if (colorConfigSnap.exists()) {
        const colorData = colorConfigSnap.data();
        console.log("Found color-specific pricing:", colorData);
        
        if (colorData.dealersPrice && colorData.retailPrice) {
          return {
            dealersPrice: formatNumberWithCommas(colorData.dealersPrice.toString()),
            retailPrice: formatNumberWithCommas(colorData.retailPrice.toString())
          };
        }
      }
      
      // If no color-specific pricing, try base pricing
      const baseConfigId = `${manufacturer}_${model}_${ram}_${storage}`.replace(/\s+/g, '_').toLowerCase();
      const baseConfigRef = doc(db, 'price_configurations', baseConfigId);
      const baseConfigSnap = await getDoc(baseConfigRef);
      
      if (baseConfigSnap.exists()) {
        const baseData = baseConfigSnap.data();
        console.log("Found base pricing:", baseData);
        
        if (baseData.dealersPrice && baseData.retailPrice) {
          return {
            dealersPrice: formatNumberWithCommas(baseData.dealersPrice.toString()),
            retailPrice: formatNumberWithCommas(baseData.retailPrice.toString())
          };
        }
      }
      
      console.log("No pricing found for this configuration");
      return null;
    } catch (error) {
      console.error("Error fetching price configuration:", error);
      return null;
    }
  }, []);
{/* Part 2 End - Data Fetching Functions */}

{/* Part 3 Start - Current Item Event Handlers */}
  // ====== CURRENT ITEM EVENT HANDLERS ======
  // Handle manufacturer change for current item
  const handleCurrentManufacturerChange = (e) => {
    const newManufacturer = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      manufacturer: newManufacturer,
      model: '',
      ram: '',
      storage: '',
      color: '',
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    }));
    
    if (newManufacturer) {
      fetchModels(newManufacturer);
    } else {
      setModels([]);
      setRams([]);
      setStorages([]);
      setColors([]);
    }
  };

  // Handle model change for current item
  const handleCurrentModelChange = (e) => {
    const newModel = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      model: newModel,
      ram: '',
      storage: '',
      color: '',
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    }));
    
    if (currentItem.manufacturer && newModel) {
      fetchOptions(currentItem.manufacturer, newModel);
    } else {
      setRams([]);
      setStorages([]);
      setColors([]);
    }
  };

  // Handle RAM change for current item
  const handleCurrentRamChange = (e) => {
    const newRam = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      ram: newRam,
      color: '',
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    }));
  };

  // Handle storage change for current item
  const handleCurrentStorageChange = (e) => {
    const newStorage = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      storage: newStorage,
      color: '',
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    }));
  };

  // Handle color change for current item - UPDATED to fetch both dealer and retail prices
  const handleCurrentColorChange = async (e) => {
    const newColor = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      color: newColor,
      dealersPrice: '',
      retailPrice: '',
      totalPrice: 0
    }));
    
    // Fetch prices when all selections are made
    if (currentItem.manufacturer && currentItem.model && currentItem.ram && currentItem.storage && newColor) {
      const price = await fetchPriceForConfiguration(
        currentItem.manufacturer, 
        currentItem.model, 
        currentItem.ram, 
        currentItem.storage, 
        newColor
      );
      
      if (price && price.dealersPrice && price.retailPrice) {
        const totalPrice = calculateItemTotal(currentItem.quantity, price.dealersPrice);
        setCurrentItem(prev => ({
          ...prev,
          dealersPrice: price.dealersPrice,
          retailPrice: price.retailPrice,
          totalPrice: totalPrice
        }));
      }
    }
  };

  // Handle supplier change for current item
  const handleCurrentSupplierChange = (e) => {
    const newSupplier = e.target.value;
    setCurrentItem(prev => ({
      ...prev,
      supplier: newSupplier
    }));
  };

  // Handle quantity change for current item
  const handleCurrentQuantityChange = (e) => {
    const newQuantity = parseInt(e.target.value) || 1;
    const validQuantity = Math.max(1, newQuantity);
    const totalPrice = calculateItemTotal(validQuantity, currentItem.dealersPrice);
    
    setCurrentItem(prev => ({
      ...prev,
      quantity: validQuantity,
      totalPrice: totalPrice
    }));
  };

  // Handle quantity increment/decrement for current item
  const incrementCurrentQuantity = () => {
    const newQuantity = currentItem.quantity + 1;
    const totalPrice = calculateItemTotal(newQuantity, currentItem.dealersPrice);
    
    setCurrentItem(prev => ({
      ...prev,
      quantity: newQuantity,
      totalPrice: totalPrice
    }));
  };

  const decrementCurrentQuantity = () => {
    const newQuantity = Math.max(1, currentItem.quantity - 1);
    const totalPrice = calculateItemTotal(newQuantity, currentItem.dealersPrice);
    
    setCurrentItem(prev => ({
      ...prev,
      quantity: newQuantity,
      totalPrice: totalPrice
    }));
  };

  // Handle dealers price change for current item
  const handleCurrentDealersPriceChange = (e) => {
    const rawValue = e.target.value;
    
    if (rawValue === '') {
      setCurrentItem(prev => ({
        ...prev,
        dealersPrice: '',
        totalPrice: 0
      }));
    } else {
      const validatedPrice = validatePrice(rawValue);
      const formattedPrice = formatNumberWithCommas(validatedPrice);
      const totalPrice = calculateItemTotal(currentItem.quantity, formattedPrice);
      
      setCurrentItem(prev => ({
        ...prev,
        dealersPrice: formattedPrice,
        totalPrice: totalPrice
      }));
    }
  };
{/* Part 3 End - Current Item Event Handlers */}

{/* Part 4 Start - Table Management and Form Submission */}
  // ====== TABLE MANAGEMENT FUNCTIONS ======
  // Add current item to procurement table
  const addItemToTable = async () => {
    if (!isCurrentItemValid) {
      alert('Please fill in all required fields for the current item');
      return;
    }

    // Check for duplicate items (same phone configuration)
    const isDuplicate = procurementItems.some(item => 
      item.manufacturer === currentItem.manufacturer &&
      item.model === currentItem.model &&
      item.ram === currentItem.ram &&
      item.storage === currentItem.storage &&
      item.color === currentItem.color
    );

    if (isDuplicate) {
      alert('This phone configuration is already in the procurement list. Please edit the existing item or select a different configuration.');
      return;
    }

    const newItem = {
      ...currentItem,
      id: editingItemId || generateItemId()
    };

    if (editingItemId) {
      // Update existing item
      setProcurementItems(prev => 
        prev.map(item => item.id === editingItemId ? newItem : item)
      );
      setEditingItemId(null);
    } else {
      // Add new item
      setProcurementItems(prev => [...prev, newItem]);
      
      // NEW: Load available colors for this item
      const availableColors = await getAvailableColorsForItem(currentItem.manufacturer, currentItem.model);
      setItemColorOptions(prev => ({
        ...prev,
        [newItem.id]: availableColors
      }));
    }

    // Reset current item form (keeping supplier and manufacturer)
    resetCurrentItem();
    
    // NEW: If manufacturer is preserved, refetch models to ensure they're available
    if (currentItem.manufacturer) {
      fetchModels(currentItem.manufacturer);
    }
  };

  // Handle purchase date change
  const handlePurchaseDateChange = (e) => {
    setPurchaseDate(e.target.value);
  };

  // Clear entire procurement table
  const clearAllItems = () => {
    if (procurementItems.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear all items from the procurement list?')) {
      setProcurementItems([]);
      setEditingItemId(null);
      resetCurrentItem();
    }
  };

  // ====== FORM SUBMISSION ======
  // Handle form submission
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
    
    setIsSubmitting(true);
    
    try {
      const grandTotal = calculateGrandTotal();
      
      const procurementData = {
        items: procurementItems.map(item => ({
          manufacturer: item.manufacturer,
          model: item.model,
          ram: item.ram,
          storage: item.storage,
          color: item.color,
          supplier: item.supplier,
          quantity: item.quantity,
          dealersPrice: parseFloat(item.dealersPrice.replace(/,/g, '')) || 0,
          totalPrice: item.totalPrice
        })),
        totalQuantity: procurementItems.reduce((sum, item) => sum + item.quantity, 0),
        grandTotal: grandTotal,
        purchaseDate: purchaseDate,
        isPaid: isPaid,
        isReceived: isReceived,
        dateCreated: getCurrentDate(),
        lastUpdated: getCurrentDate()
      };
      
      console.log("Submitting procurement data:", procurementData);
      
      // TODO: Add the actual Firebase submission here
      // const result = await addProcurementToDatabase(procurementData);
      
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reset form after successful submission
      setProcurementItems([]);
      setEditingItemId(null);
      resetCurrentItem();
      setPurchaseDate(getCurrentDate());
      setIsPaid(false);
      setIsReceived(false);
      
      setIsSubmitting(false);
      alert(`Procurement record saved successfully!\n\nTotal Items: ${procurementData.items.length}\nTotal Quantity: ${procurementData.totalQuantity}\nGrand Total: ₱${formatNumberWithCommas(grandTotal.toString())}`);
      
    } catch (error) {
      console.error("Error saving procurement:", error);
      setError(`Error saving procurement: ${error.message}`);
      setIsSubmitting(false);
      alert('Error saving procurement. Please try again.');
    }
  };

  // ====== EFFECTS ======
  // Initialize form on component mount
  useEffect(() => {
    const initializeForm = async () => {
      try {
        // Set default purchase date to current date
        setPurchaseDate(getCurrentDate());
        
        // Fetch manufacturers list
        await fetchManufacturers();
        
      } catch (error) {
        console.error("Error initializing form:", error);
        setError(`Error loading data: ${error.message}`);
      }
    };
    
    initializeForm();
  }, [fetchManufacturers]);

  // Check if current item is valid for adding to table
  useEffect(() => {
    const isValid = currentItem.manufacturer && 
                   currentItem.model && 
                   currentItem.ram && 
                   currentItem.storage && 
                   currentItem.color && 
                   currentItem.supplier &&
                   currentItem.dealersPrice && 
                   currentItem.quantity > 0;
    
    setIsCurrentItemValid(isValid);
  }, [currentItem]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Prevent Enter key from submitting the form accidentally
    if (e.key === 'Enter' && e.target.type !== 'submit') {
      e.preventDefault();
      
      // If current item is valid and Enter is pressed, add to table
      if (isCurrentItemValid && !editingItemId) {
        addItemToTable();
      }
    }
  };
{/* Part 4 End - Table Management and Form Submission */}

{/* Part 5 Start - Loading States and Main Form Start */}
  // ====== LOADING AND ERROR STATES ======
  // Show loading state for initial load
  if (loading && manufacturers.length === 0) {
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
                fetchManufacturers();
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

  // ====== MAIN COMPONENT RENDER ======
  return (
    <div className="min-h-screen bg-white p-4">
      <form 
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
      >
        <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <ShoppingCart className="h-6 w-6 mr-2" />
              Phone Procurement
            </CardTitle>
          </CardHeader>

          <CardContent className="bg-white p-4 space-y-6">
            {/* Procurement Details Section - UPDATED with Supplier, Bank fields, and Payment/Delivery fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Procurement Details</h3>
              
              {/* First Row: Purchase Date, Supplier, Bank fields */}
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

                {/* Supplier - MOVED HERE */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Supplier:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10"
                    value={currentItem.supplier}
                    onChange={handleCurrentSupplierChange}
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                {/* Bank Name - NEW FIELD */}
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

                {/* Bank Account - NEW FIELD */}
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

                {/* Account Payable - NEW FIELD */}
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

              {/* Second Row: Payment and Delivery Details */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Payment Status */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Payment Status:</label>
                  <div className="relative">
                    <select 
                      className="w-full p-2 border rounded text-sm h-10 opacity-0 absolute z-10 cursor-pointer"
                      value={isPaid ? 'Paid' : 'Unpaid'}
                      onChange={handlePaymentStatusChange}
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                    </select>
                    <div className="p-2 border rounded bg-gray-100 text-gray-600 text-sm h-10 flex items-center pointer-events-none">
                      <span className={isPaid ? 'inline-block px-3 py-1 rounded-full text-sm bg-green-100 text-green-800' : 'inline-block px-3 py-1 rounded-full text-sm bg-red-100 text-red-800'}>
                        {isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Paid */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Paid:</label>
                  <input 
                    type="date" 
                    className={!isPaid ? 'w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400' : 'w-full p-2 border rounded text-sm h-10'}
                    value={datePaid}
                    onChange={handleDatePaidChange}
                    disabled={!isPaid}
                  />
                </div>

                {/* Payment Reference */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Payment Reference:</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                    value={paymentReference}
                    onChange={handlePaymentReferenceChange}
                    placeholder="Receipt #"
                    disabled={!isPaid}
                  />
                </div>

                {/* Delivery Status - UPDATED to behave like Payment Status */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Delivery Status:</label>
                  <div className="relative">
                    <select 
                      className="w-full p-2 border rounded text-sm h-10 opacity-0 absolute z-10 cursor-pointer"
                      value={isReceived ? 'Delivered' : 'Pending'}
                      onChange={handleDeliveryStatusChange}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                    <div className="p-2 border rounded bg-gray-100 text-gray-600 text-sm h-10 flex items-center pointer-events-none">
                      <span className={isReceived ? 'inline-block px-3 py-1 rounded-full text-sm bg-green-100 text-green-800' : 'inline-block px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800'}>
                        {isReceived ? 'Delivered' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Delivered - UPDATED to behave like Date Paid */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Date Delivered:</label>
                  <input 
                    type="date" 
                    className={!isReceived ? 'w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400' : 'w-full p-2 border rounded text-sm h-10'}
                    value={dateDelivered}
                    onChange={handleDateDeliveredChange}
                    disabled={!isReceived}
                  />
                </div>
              </div>
            </div>

            {/* Add Phone Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Add Phone Model</h3>
              
              {/* Phone Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Manufacturer */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Manufacturer:</label>
                  <select 
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.manufacturer}
                    onChange={handleCurrentManufacturerChange}
                    required
                  >
                    <option value="">-- Select --</option>
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
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.model}
                    onChange={handleCurrentModelChange}
                    disabled={!currentItem.manufacturer}
                    required
                  >
                    <option value="">-- Select --</option>
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
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.ram}
                    onChange={handleCurrentRamChange}
                    disabled={!currentItem.model}
                    required
                  >
                    <option value="">-- Select --</option>
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
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.storage}
                    onChange={handleCurrentStorageChange}
                    disabled={!currentItem.model}
                    required
                  >
                    <option value="">-- Select --</option>
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
                    className="w-full p-2 border rounded text-sm"
                    value={currentItem.color}
                    onChange={handleCurrentColorChange}
                    disabled={!currentItem.ram || !currentItem.storage}
                    required
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
{/* Part 5 End - Loading States and Main Form Start */}

{/* Part 6 Start - Second Row with Adjusted Quantity and Procurement Details */}
              {/* Second Row: Quantity, Dealers Price, Retail Price, Total Price, Margin % + Action */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Quantity */}
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
                      required
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

                {/* Dealers Price */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Dealer&apos;s Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm"
                      value={currentItem.dealersPrice}
                      onChange={handleCurrentDealersPriceChange}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Retail Price - NEW FIELD (disabled) */}
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Retail Price:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-sm">₱</span>
                    <input 
                      type="text" 
                      className="w-full p-2 pl-6 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                      value={currentItem.retailPrice}
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
                      value={currentItem.totalPrice ? formatNumberWithCommas(currentItem.totalPrice.toString()) : '0.00'}
                      disabled={true}
                      readOnly
                    />
                  </div>
                </div>

                {/* Margin + Add Button - Adjusted sizing to match Color field width */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-20 space-y-2">
                      <label className="block text-[rgb(52,69,157)] font-semibold text-sm">Margin:</label>
                      {/* Margin Field - Made smaller */}
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
                      {/* Add Button - Takes remaining space */}
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
{/* Part 6 End - Second Row with Adjusted Quantity and Procurement Details */}

{/* Part 7 Start - Procurement Table with Quantity Controls */}
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
                            {/* UPDATED: Color dropdown for changing colors */}
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
                            {/* UPDATED: Quantity controls with +/- buttons */}
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
                            ₱{item.dealersPrice}
                          </td>
                          <td className="border px-3 py-2 text-right font-mono font-medium">
                            ₱{formatNumberWithCommas(item.totalPrice.toString())}
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
                          ₱{formatNumberWithCommas(calculateGrandTotal().toString())}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
{/* Part 7 End - Procurement Table with Quantity Controls */}

{/* Part 8 Start - Procurement Summary (Moved Below Table) and Submit Button */}
            {/* Procurement Summary Section - Updated design to match Inventory Value Summary */}
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
                          ₱{formatNumberWithCommas(calculateGrandTotal().toString())}
                        </p>
                        <p className="text-xs text-gray-500">total cost</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={procurementItems.length === 0 || isSubmitting || !purchaseDate}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    Saving Procurement...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Save Procurement Record ({procurementItems.length} items)
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
{/* Part 8 End - Procurement Summary (Moved Below Table) and Submit Button */}