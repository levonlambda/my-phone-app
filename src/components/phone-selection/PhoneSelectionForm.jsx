{/* Part 1 Start - Imports and Dependencies */}
import { useGlobalState } from '../../context/GlobalStateContext'; // NEW: Import global state
import { updatePhoneInInventory } from './services/inventoryService'; // NEW: Import update function
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PhoneBasicInfo from './PhoneBasicInfo';
import PhonePriceInfo from './PhonePriceInfo';
import PhoneColorInfo from './PhoneColorInfo';
import PhoneAdditionalInfo from './PhoneAdditionalInfo';
import usePhoneOptions from './hooks/usePhoneOptions';
import usePhoneCache from './hooks/usePhoneCache';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  formatNumberWithCommas,
  validateImei, 
  validatePrice,
  handleKeyDown, 
  getCurrentDate 
} from './utils/phoneUtils';
import { 
  checkDuplicateImeis, 
  addPhoneToInventory 
} from './services/inventoryService';
import supplierService from '../../services/supplierService'; // NEW: Import supplier service
import { Search, ArrowRight, CircleAlert } from 'lucide-react';
{/* Part 1 End - Imports and Dependencies */}

{/* Part 2 Start - Component and State Definitions */}
const PhoneSelectionForm = () => {
  // Get inventory item to edit from global state
  const { inventoryItemToEdit, clearInventoryItemToEdit } = useGlobalState(); // NEW: Get inventory edit state
  
  // ====== STATE DEFINITIONS ======
  // Core state for selections
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedRam, setSelectedRam] = useState('');
  
  // NEW: Track if we're in edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  
  // Barcode search
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [isBarcodeSearching, setIsBarcodeSearching] = useState(false);
  const [barcodeSearchError, setBarcodeSearchError] = useState('');
  
  // Get options and loading state from custom hook
  const { 
    manufacturers, 
    models, 
    colors, 
    storage, 
    ram, 
    loading: optionsLoading, 
    error: optionsError,
    fetchManufacturers,
    fetchModels,
    fetchOptions
  } = usePhoneOptions();
  
  // Get price cache from custom hook (keeping for backward compatibility in form submission)
  const {
    updatePriceConfiguration
  } = usePhoneCache();
  
  // Track previous selection to avoid overwriting user edits
  const prevSelectionRef = useRef('');
  const prevColorRef = useRef('');
  
  // Form input fields state
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState(''); // NEW: Added serial number state
  const [location, setLocation] = useState(''); // NEW: Added location state
  const [supplier, setSupplier] = useState(''); // NEW: Added supplier state
  const [suppliers, setSuppliers] = useState([]); // NEW: Added suppliers array state
  const [dealersPrice, setDealersPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [status, setStatus] = useState('On-Hand');
  

  // ADD THIS DEBUGGING USEEFFECT
  useEffect(() => {
    console.log('Serial number state changed to:', serialNumber);
  }, [serialNumber]);

  // UI state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpecsSelected, setIsSpecsSelected] = useState(false);
  const [isCheckingImei, setIsCheckingImei] = useState(false);
  const [imei1Error, setImei1Error] = useState('');
  const [imei2Error, setImei2Error] = useState('');
  const [lastUpdated, setLastUpdated] = useState(getCurrentDate());
  const [userEnteredBarcode, setUserEnteredBarcode] = useState(false);
{/* Part 2 End - Component and State Definitions */}

{/* Part 3 Start - Event Handlers */}
  // ====== EVENT HANDLERS ======
  // Event handlers for form inputs
  const handleManufacturerChange = (e) => {
    const newManufacturer = e.target.value;
    setSelectedManufacturer(newManufacturer);
    setSelectedModel('');
    setSelectedColor('');
    setSelectedStorage('');
    setSelectedRam('');
    setDealersPrice('');
    setRetailPrice('');
    
    if (newManufacturer) {
      fetchModels(newManufacturer);
    }
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    setSelectedColor('');
    setSelectedStorage('');
    setSelectedRam('');
    setDealersPrice('');
    setRetailPrice('');
    
    if (selectedManufacturer && newModel) {
      fetchOptions(selectedManufacturer, newModel);
    }
  };

  const handleColorChange = (e) => {
    setSelectedColor(e.target.value);
    // Reset user entered flag when color changes
    setUserEnteredBarcode(false);
  };

  const handleRamChange = (e) => {
    const newRam = e.target.value;
    setSelectedRam(newRam);
  };

  const handleStorageChange = (e) => {
    const newStorage = e.target.value;
    setSelectedStorage(newStorage);
  };

  const handleImei1Change = (e) => {
    const newImei = validateImei(e.target.value);
    setImei1(newImei);
    setImei1Error(''); // Clear error on change
  };

  const handleImei2Change = (e) => {
    const newImei = validateImei(e.target.value);
    setImei2(newImei);
    setImei2Error(''); // Clear error on change
  };

  const handleBarcodeChange = (e) => {
    const newBarcode = e.target.value.toUpperCase();
    setBarcode(newBarcode);
    // Set flag that user has entered a barcode manually
    setUserEnteredBarcode(true);
  };

  const handleSerialNumberChange = (e) => {
    const newSerialNumber = e.target.value.toUpperCase();
    console.log('Serial number changing to:', newSerialNumber); // ADD THIS
    setSerialNumber(newSerialNumber);
  };

  const handleLocationChange = (e) => {
    const newLocation = e.target.value;
    setLocation(newLocation);
  };

  const handleSupplierChange = (e) => {
    const newSupplier = e.target.value;
    setSupplier(newSupplier);
  };

  const handleBarcodeSearchChange = (e) => {
    setBarcodeSearch(e.target.value.toUpperCase());
    setBarcodeSearchError('');
  };

  const handleBarcodeSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSearch();
    }
  };

  // Handle barcode search
  const handleBarcodeSearch = async () => {
    if (!barcodeSearch.trim()) {
      setBarcodeSearchError('Please enter a barcode to search');
      return;
    }
    
    setIsBarcodeSearching(true);
    setBarcodeSearchError('');
    
    try {
      // Search for the barcode in inventory
      const inventoryRef = collection(db, 'inventory');
      const q = query(
        inventoryRef, 
        where("barcode", "==", barcodeSearch.trim())
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setBarcodeSearchError('No matching phone found for this barcode');
        setIsBarcodeSearching(false);
        return;
      }
      
      // Get the first matching record
      const matchingPhone = snapshot.docs[0].data();
      
      // Set all the fields accordingly
      setSelectedManufacturer(matchingPhone.manufacturer);
      
      // Fetch models for this manufacturer
      await fetchModels(matchingPhone.manufacturer);
      
      setSelectedModel(matchingPhone.model);
      
      // Fetch options for this model
      await fetchOptions(matchingPhone.manufacturer, matchingPhone.model);
      
      setSelectedRam(matchingPhone.ram);
      setSelectedStorage(matchingPhone.storage);
      setSelectedColor(matchingPhone.color);
      
      // Set prices
      setDealersPrice(formatNumberWithCommas(matchingPhone.dealersPrice.toString()));
      setRetailPrice(formatNumberWithCommas(matchingPhone.retailPrice.toString()));
      
      // Set isSpecsSelected to true BEFORE setting barcode
      setIsSpecsSelected(true);
      
      // Use setTimeout to ensure the DOM has updated and the barcode field exists
      setTimeout(() => {
        // Set barcode
        setBarcode(matchingPhone.barcode);
        setUserEnteredBarcode(true); // Treat this as a user-confirmed barcode
      }, 0);
      
      // Clear the barcode search
      setBarcodeSearch('');
      
      // Clear IMEI fields (these should be empty for a new entry)
      setImei1('');
      setImei2('');
      setSerialNumber('');

      // Set status and last updated
      setStatus('On-Hand');
      setLastUpdated(getCurrentDate());
      
    } catch (error) {
      console.error("Error searching by barcode:", error);
      setBarcodeSearchError('Error searching for barcode. Please try again.');
    } finally {
      setIsBarcodeSearching(false);
    }
  };

  // Pricing input handlers with commas that work correctly
  const handleDealersPriceChange = (e) => {
    const rawValue = e.target.value;
    
    // Check if input is empty and store as-is if it is
    if (rawValue === '') {
      setDealersPrice('');
    } else {
      // Apply formatting if not empty
      const validatedPrice = validatePrice(rawValue);
      const formattedPrice = formatNumberWithCommas(validatedPrice);
      setDealersPrice(formattedPrice);
    }
  };

  const handleRetailPriceChange = (e) => {
    const rawValue = e.target.value;
    
    // Check if input is empty and store as-is if it is
    if (rawValue === '') {
      setRetailPrice('');
    } else {
      // Apply formatting if not empty
      const validatedPrice = validatePrice(rawValue);
      const formattedPrice = formatNumberWithCommas(validatedPrice);
      setRetailPrice(formattedPrice);
    }
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setLastUpdated(getCurrentDate());
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic form validation - UPDATED to include location and supplier
    if (!selectedManufacturer || !selectedModel || !selectedRam || 
        !selectedStorage || !selectedColor || !imei1 || !barcode || 
        !dealersPrice || !retailPrice || !location || !supplier) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Set checking state and clear previous errors
    setIsSubmitting(true);
    setIsCheckingImei(true);
    setImei1Error('');
    setImei2Error('');
    
    // Check for duplicate IMEIs before submitting (skip if editing same item)
    const imeisCheck = await checkDuplicateImeis(imei1, imei2, isEditMode ? editItemId : null);
    
    setIsCheckingImei(false);
    
    if (!imeisCheck.isValid) {
      setImei1Error(imeisCheck.imei1Error);
      setImei2Error(imeisCheck.imei2Error);
      setIsSubmitting(false);
      return; // Don't proceed if IMEIs are invalid
    }
    
    // Update lastUpdated on submit
    const currentDate = getCurrentDate();
    setLastUpdated(currentDate);
    
    // Parse prices properly removing commas
    const dPrice = parseFloat(dealersPrice.replace(/,/g, '')) || 0;
    const rPrice = parseFloat(retailPrice.replace(/,/g, '')) || 0;
    
    const phoneData = {
      manufacturer: selectedManufacturer,
      model: selectedModel,
      color: selectedColor,
      ram: selectedRam,
      storage: selectedStorage,
      imei1,
      imei2,
      barcode,
      serialNumber, // NEW: Added serial number to phone data
      location, // NEW: Added location to phone data
      supplier, // NEW: Added supplier to phone data
      dealersPrice: dPrice,
      retailPrice: rPrice,
      status,
      lastUpdated: currentDate,
      dateAdded: isEditMode ? inventoryItemToEdit.dateAdded : currentDate // Preserve original date if editing
    };
    
    setLoading(true);
    
    try {
      let result;
      
      if (isEditMode) {
        // Update existing phone in inventory
        result = await updatePhoneInInventory(editItemId, phoneData, inventoryItemToEdit);
      } else {
        // Add new phone to inventory
        result = await addPhoneToInventory(phoneData);
      }
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'add'} phone to inventory`);
      }
      
      // IMPORTANT: Update the price configuration
      // 1. First update base price (without color)
      await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice
      );
      
      // 2. Then update color-specific price
      await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice,
        selectedColor
      );
      
      // Reset fields after successful submission
      setImei1('');
      setImei2('');
      setSerialNumber(''); // NEW: Reset serial number after submission
      setLocation(''); // NEW: Reset location after submission
      setSupplier(''); // NEW: Reset supplier after submission
      setStatus('On-Hand');
      
      // Clear edit mode
      if (isEditMode) {
        clearInventoryItemToEdit();
        setIsEditMode(false);
        setEditItemId(null);
      }
      
      // Set flag that the barcode value should persist
      setUserEnteredBarcode(true);
      
      setLoading(false);
      setIsSubmitting(false);
      alert(`Phone details ${isEditMode ? 'updated' : 'saved'} successfully!`);
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} document:`, error);
      setError(`Error ${isEditMode ? 'updating' : 'saving'} phone: ${error.message}`);
      setLoading(false);
      setIsSubmitting(false);
      alert(`Error ${isEditMode ? 'updating' : 'saving'} phone details. Please try again.`);
    }
  };
{/* Part 3 End - Event Handlers */}

{/* Part 4 Start - Effect Hooks */}
  // ====== EFFECT HOOKS ======
  // Fetch manufacturers on component mount
  useEffect(() => {
    // Only fetch if manufacturers haven't been loaded yet
    if (manufacturers.length === 0) {
      async function initializeForm() {
        setLoading(true);
        try {
          // Fetch manufacturers list
          await fetchManufacturers();
          
          setLoading(false);
        } catch (error) {
          console.error("Error initializing form:", error);
          setError(`Error loading data: ${error.message}`);
          setLoading(false);
        }
      }
      
      initializeForm();
    }
  }, [manufacturers.length, fetchManufacturers]);

  // NEW: Fetch suppliers on component mount
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const result = await supplierService.getAllSuppliers();
        if (result.success) {
          setSuppliers(result.suppliers);
        } else {
          console.error("Error loading suppliers:", result.error);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    }
    
    fetchSuppliers();
  }, []);

  // Check if selections are complete and fetch prices directly from Firestore
  useEffect(() => {
    const fetchPricesDirectly = async () => {
      // First, create a key to track our selections for pricing (without color)
      const priceSelectionKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}`;
      
      // Create a complete key that includes color for barcode lookup
      // const barcodeSelectionKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}_${selectedColor}`;
      
      // Track if we need to reset the barcode
      const shouldResetBarcode = prevSelectionRef.current !== priceSelectionKey;
      
      // Only check when we have all the necessary selections
      if (selectedManufacturer && selectedModel && selectedRam && selectedStorage) {
        
        // Reset barcode when the base configuration changes (manufacturer, model, RAM, storage)
        if (shouldResetBarcode) {
          setBarcode('');
          setUserEnteredBarcode(false);
        }
        
        // Fetch prices directly from Firestore instead of using cache
        if (shouldResetBarcode) {
          console.log("Selection changed - fetching prices from Firestore");
          
          try {
            // Fetch base price configuration
            const baseConfigId = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}`.replace(/\s+/g, '_').toLowerCase();
            const baseConfigRef = doc(db, 'price_configurations', baseConfigId);
            const baseConfigSnap = await getDoc(baseConfigRef);
            
            if (baseConfigSnap.exists()) {
              const baseData = baseConfigSnap.data();
              console.log("Found base pricing:", baseData);
              
              if (baseData.dealersPrice) {
                setDealersPrice(formatNumberWithCommas(baseData.dealersPrice.toString()));
              }
              if (baseData.retailPrice) {
                setRetailPrice(formatNumberWithCommas(baseData.retailPrice.toString()));
              }
            } else {
              console.log("No base pricing found for this configuration");
              // Clear prices if no configuration found
              setDealersPrice('');
              setRetailPrice('');
            }
          } catch (error) {
            console.error("Error fetching price configuration:", error);
          }
        }
        
        // Check for color-specific pricing and barcode if color is also selected
        if (selectedColor) {
          // Check if color changed - comparing with previous color
          const colorChanged = prevColorRef.current !== selectedColor;
          
          // Fetch color-specific pricing and barcode when color changes or base selections change
          if ((shouldResetBarcode || colorChanged) && !userEnteredBarcode) {
            try {
              const colorConfigId = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}_${selectedColor}`.replace(/\s+/g, '_').toLowerCase();
              const colorConfigRef = doc(db, 'price_configurations', colorConfigId);
              const colorConfigSnap = await getDoc(colorConfigRef);
              
              if (colorConfigSnap.exists()) {
                const colorData = colorConfigSnap.data();
                console.log("Found color-specific pricing:", colorData);
                
                // Update prices with color-specific pricing if available
                if (colorData.dealersPrice) {
                  setDealersPrice(formatNumberWithCommas(colorData.dealersPrice.toString()));
                }
                if (colorData.retailPrice) {
                  setRetailPrice(formatNumberWithCommas(colorData.retailPrice.toString()));
                }
              }
              
              // Also check for barcode from inventory
              const inventoryQuery = query(
                collection(db, 'inventory'),
                where("manufacturer", "==", selectedManufacturer),
                where("model", "==", selectedModel),
                where("ram", "==", selectedRam),
                where("storage", "==", selectedStorage),
                where("color", "==", selectedColor),
                limit(1)
              );
              
              const inventorySnap = await getDocs(inventoryQuery);
              if (!inventorySnap.empty) {
                const inventoryItem = inventorySnap.docs[0].data();
                if (inventoryItem.barcode) {
                  setBarcode(inventoryItem.barcode);
                }
              } else if (colorChanged) {
                // Only clear barcode when color changes and there's no barcode for this color
                setBarcode('');
              }
            } catch (error) {
              console.error("Error fetching color-specific pricing:", error);
            }
          }
          
          // If we have a complete selection including color, we can show the additional info section
          setIsSpecsSelected(true);
        } else {
          setIsSpecsSelected(false);
        }
      } else {
        setIsSpecsSelected(false);
      }
      
      // Update the previous selection ref
      // Update ref
      prevSelectionRef.current = priceSelectionKey;
      prevColorRef.current = selectedColor;
    };
    
    fetchPricesDirectly();
  }, [selectedManufacturer, selectedModel, selectedRam, selectedStorage, selectedColor, userEnteredBarcode]);

  // NEW: Handle inventory item editing
  useEffect(() => {
    if (inventoryItemToEdit && !isEditMode) {
      // Set edit mode
      setIsEditMode(true);
      setEditItemId(inventoryItemToEdit.id);
      
      // Populate all fields with the item data
      setSelectedManufacturer(inventoryItemToEdit.manufacturer);
      setSelectedModel(inventoryItemToEdit.model);
      setSelectedRam(inventoryItemToEdit.ram);
      setSelectedStorage(inventoryItemToEdit.storage);
      setSelectedColor(inventoryItemToEdit.color);
      setImei1(inventoryItemToEdit.imei1);
      setImei2(inventoryItemToEdit.imei2 || '');
      setBarcode(inventoryItemToEdit.barcode || '');
      setSerialNumber(inventoryItemToEdit.serialNumber || '');
      setLocation(inventoryItemToEdit.location || ''); // NEW: Set location for editing
      setSupplier(inventoryItemToEdit.supplier || ''); // NEW: Set supplier for editing
      setDealersPrice(formatNumberWithCommas(inventoryItemToEdit.dealersPrice?.toString() || '0'));
      setRetailPrice(formatNumberWithCommas(inventoryItemToEdit.retailPrice?.toString() || '0'));
      setStatus(inventoryItemToEdit.status);
      setLastUpdated(inventoryItemToEdit.lastUpdated || getCurrentDate());
      
      // Set flags to show all sections
      setIsSpecsSelected(true);
      setUserEnteredBarcode(true);
      
      // Fetch options for the selected manufacturer and model
      if (inventoryItemToEdit.manufacturer) {
        fetchModels(inventoryItemToEdit.manufacturer).then(() => {
          if (inventoryItemToEdit.model) {
            fetchOptions(inventoryItemToEdit.manufacturer, inventoryItemToEdit.model);
          }
        });
      }
    }
  }, [inventoryItemToEdit, isEditMode, fetchModels, fetchOptions]); // Include all dependencies
  
  // NEW: Clean up when component unmounts or switches away
  useEffect(() => {
    return () => {
      if (isEditMode) {
        clearInventoryItemToEdit();
        setIsEditMode(false);
        setEditItemId(null);
      }
    };
  }, [isEditMode, clearInventoryItemToEdit]);
{/* Part 4 End - Effect Hooks */}

{/* Part 5 Start - Component Render */}
  // Show loading state for initial load
  if ((loading || optionsLoading) && manufacturers.length === 0) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[640px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white">Loading...</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p>Fetching data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show error state
  if (error || optionsError) {
    const errorMessage = error || optionsError;
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[640px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-red-600 py-3">
            <CardTitle className="text-2xl text-white">Error</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p>{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
            >
              Reload
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
        onKeyDown={handleKeyDown}>
        <Card className="w-full max-w-[640px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white">
              {isEditMode ? 'Edit Phone Details' : 'Select Phone'}
            </CardTitle>
          </CardHeader>

          <CardContent className="bg-white p-4 space-y-4">
            {/* Barcode Search */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-lg text-[rgb(52,69,157)] mb-3">Quick Barcode Search</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={barcodeSearch}
                    onChange={handleBarcodeSearchChange}
                    onKeyDown={handleBarcodeSearchKeyDown}
                    placeholder="Enter barcode to auto-fill phone details"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBarcodeSearch}
                  disabled={isBarcodeSearching || !barcodeSearch.trim()}
                  className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded flex items-center"
                >
                  {isBarcodeSearching ? (
                    <span className="animate-spin mr-2">⊛</span>
                  ) : (
                    <Search className="h-5 w-5 mr-2" />
                  )}
                  Search
                </button>
              </div>
              
              {barcodeSearchError && (
                <div className="mt-2 text-red-500 flex items-center">
                  <CircleAlert className="h-4 w-4 mr-1" />
                  {barcodeSearchError}
                </div>
              )}
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <ArrowRight className="h-4 w-4 mr-1" />
                <span>Scan or enter a barcode to automatically fill the phone details</span>
              </div>
            </div>

            {/* Manual Selection Divider */}
            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-gray-500 text-sm">Or select manually</span>
              </div>
            </div>

            {/* Basic Information */}
            <PhoneBasicInfo 
              selectedManufacturer={selectedManufacturer}
              selectedModel={selectedModel}
              selectedRam={selectedRam}
              selectedStorage={selectedStorage}
              manufacturers={manufacturers}
              models={models}
              ram={ram}
              storage={storage}
              handleRamChange={handleRamChange}
              handleStorageChange={handleStorageChange}
              handleManufacturerChange={handleManufacturerChange}
              handleModelChange={handleModelChange}
            />

            {/* Price Information */}
            {selectedRam && selectedStorage && (
              <PhonePriceInfo 
                dealersPrice={dealersPrice}
                retailPrice={retailPrice}
                handleDealersPriceChange={handleDealersPriceChange}
                handleRetailPriceChange={handleRetailPriceChange}
              />
            )}

            {/* Color Information */}
            {selectedModel && (
              <PhoneColorInfo 
                selectedColor={selectedColor}
                colors={colors}
                handleColorChange={handleColorChange}
              />
            )}

            {/* Additional Information */}
            {isSpecsSelected && (
              <PhoneAdditionalInfo 
                imei1={imei1}
                imei2={imei2}
                barcode={barcode}
                serialNumber={serialNumber}
                location={location}
                supplier={supplier}
                suppliers={suppliers}
                status={status}
                lastUpdated={lastUpdated}
                handleImei1Change={handleImei1Change}
                handleImei2Change={handleImei2Change}
                handleBarcodeChange={handleBarcodeChange}
                handleSerialNumberChange={handleSerialNumberChange}
                handleLocationChange={handleLocationChange}
                handleSupplierChange={handleSupplierChange}
                handleStatusChange={handleStatusChange}
                imei1Error={imei1Error}
                imei2Error={imei2Error}
              />
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
                disabled={!isSpecsSelected || isCheckingImei || isSubmitting}
              >
                {isSubmitting ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Entry' : 'Save Entry')}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};
{/* Part 5 End - Component Render */}

export default PhoneSelectionForm;