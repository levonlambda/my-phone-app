import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PhoneBasicInfo from './PhoneBasicInfo';
import PhonePriceInfo from './PhonePriceInfo';
import PhoneColorInfo from './PhoneColorInfo';
import PhoneAdditionalInfo from './PhoneAdditionalInfo';
import usePhoneOptions from './hooks/usePhoneOptions';
import usePhoneCache from './hooks/usePhoneCache';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
import { Search, ArrowRight, CircleAlert } from 'lucide-react';

const PhoneSelectionForm = () => {
  // ====== STATE DEFINITIONS ======
  // Core state for selections
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedRam, setSelectedRam] = useState('');
  
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
  
  // Get price cache from custom hook
  const {
    priceCache,
    setPriceCache,
    loadPriceCacheFromInventory,
    updatePriceConfiguration
  } = usePhoneCache();
  
  // Track previous selection to avoid overwriting user edits
  const prevSelectionRef = useRef('');
  const prevColorRef = useRef('');
  
  // Form input fields state
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [barcode, setBarcode] = useState('');
  const [dealersPrice, setDealersPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [status, setStatus] = useState('On-Hand');
  
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
    // We're not automatically setting prices here anymore
  };

  const handleStorageChange = (e) => {
    const newStorage = e.target.value;
    setSelectedStorage(newStorage);
    // We're not automatically setting prices here anymore
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
    
    // Add to cache if we have a valid model, RAM, storage, and color
    if (selectedManufacturer && selectedModel && selectedRam && selectedStorage && selectedColor) {
      const cacheKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}_${selectedColor}`;
      setPriceCache(prev => ({
        ...prev,
        [cacheKey]: {
          ...prev[cacheKey],
          barcode: newBarcode,
          lastUpdated: getCurrentDate()
        }
      }));
    }
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
  
  // Handle barcode search - FIXED VERSION
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
      
      // IMPORTANT FIX: Set isSpecsSelected to true BEFORE setting barcode
      // This ensures the barcode field exists when we try to set its value
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
    
    // Basic form validation
    if (!selectedManufacturer || !selectedModel || !selectedRam || 
        !selectedStorage || !selectedColor || !imei1 || !barcode || 
        !dealersPrice || !retailPrice) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Set checking state and clear previous errors
    setIsSubmitting(true);
    setIsCheckingImei(true);
    setImei1Error('');
    setImei2Error('');
    
    // Check for duplicate IMEIs before submitting
    const imeisCheck = await checkDuplicateImeis(imei1, imei2);
    
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
      dealersPrice: dPrice,
      retailPrice: rPrice,
      status,
      lastUpdated: currentDate,
      dateAdded: currentDate  // New field to track when the entry was first added
    };
    
    setLoading(true);
    
    try {
      // Add the phone to inventory
      const result = await addPhoneToInventory(phoneData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add phone to inventory');
      }
      
      console.log("About to update price configurations:");
      console.log("Dealers Price:", dealersPrice);
      console.log("Retail Price:", retailPrice);

      // IMPORTANT: Update the price configuration
      const baseUpdateResult = await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice
      );
      
      console.log("Base price update result:", baseUpdateResult);
      
      const colorUpdateResult = await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice,
        selectedColor
      );
      
      console.log("Color price update result:", colorUpdateResult);

      // 1. First update base price (without color)
      await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice
      );
      
      
      // 2. Then update color-specific price if different from base price
      await updatePriceConfiguration(
        selectedManufacturer,
        selectedModel,
        selectedRam,
        selectedStorage,
        dealersPrice,
        retailPrice,
        selectedColor
      );
      
      // Update the local cache with the new price configuration
      const basePriceKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}`;
      const colorPriceKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}_${selectedColor}`;
      
      // Update local cache
      setPriceCache(prev => ({
        ...prev,
        [basePriceKey]: {
          ...prev[basePriceKey],
          dealersPrice: dealersPrice,
          retailPrice: retailPrice,
          lastUpdated: currentDate
        },
        [colorPriceKey]: {
          ...prev[colorPriceKey],
          dealersPrice: dealersPrice,
          retailPrice: retailPrice,
          barcode: barcode,
          lastUpdated: currentDate
        }
      }));
            
      // Reset fields after successful submission
      setImei1('');
      setImei2('');
      // Do NOT reset barcode
      // setBarcode('');
      setStatus('On-Hand');
      
      // Set flag that the value should persist
      setUserEnteredBarcode(true);
      
      // Don't reset these:
      // selectedManufacturer, selectedModel, selectedRam,
      // selectedStorage, selectedColor, dealersPrice, or retailPrice
      
      setLoading(false);
      setIsSubmitting(false);
      alert('Phone details saved successfully!');
    } catch (error) {
      console.error("Error adding document:", error);
      setError(`Error saving phone: ${error.message}`);
      setLoading(false);
      setIsSubmitting(false);
      alert('Error saving phone details. Please try again.');
    }
  };
  // ====== EFFECT HOOKS ======
  // Fetch manufacturers on component mount
  useEffect(() => {
    async function initializeForm() {
      setLoading(true);
      try {
        // Fetch manufacturers list
        await fetchManufacturers();
        
        // Fetch existing inventory to build price cache
        await loadPriceCacheFromInventory();
        
        setLoading(false);
      } catch (error) {
        console.error("Error initializing form:", error);
        setError(`Error loading data: ${error.message}`);
        setLoading(false);
      }
    }
    
    initializeForm();
  }, [fetchManufacturers, loadPriceCacheFromInventory]);

  // Check if selections are complete and fetch prices from cache when selections change
  useEffect(() => {
    // First, create a key to track our selections for pricing (without color)
    const priceSelectionKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}`;
    
    // Create a complete key that includes color for barcode lookup
    const barcodeSelectionKey = `${selectedManufacturer}_${selectedModel}_${selectedRam}_${selectedStorage}_${selectedColor}`;
    
    // Track if we need to reset the barcode
    const shouldResetBarcode = prevSelectionRef.current !== priceSelectionKey;
    
    // Only check when we have all the necessary selections
    if (selectedManufacturer && selectedModel && selectedRam && selectedStorage) {
      // Only set the price if selection changed (not when price changed)
      if (shouldResetBarcode) {
        console.log("Selection changed - checking price cache");
        const cacheKey = priceSelectionKey;
        
        if (priceCache[cacheKey]) {
          console.log("Found cached values:", priceCache[cacheKey]);
          if (priceCache[cacheKey].dealersPrice) {
            // Set price from cache
            setDealersPrice(priceCache[cacheKey].dealersPrice);
          }
          if (priceCache[cacheKey].retailPrice) {
            // Set price from cache
            setRetailPrice(priceCache[cacheKey].retailPrice);
          }
        }
      }
      
      // Reset barcode when the base configuration changes (manufacturer, model, RAM, storage)
      if (shouldResetBarcode) {
        setBarcode('');
        setUserEnteredBarcode(false);
      }
      
      // Check for barcode if color is also selected
      if (selectedColor) {
        // Check if color changed - comparing with previous color
        const colorChanged = prevColorRef.current !== selectedColor;
        
        // Only set/clear barcode when color or base selections change, not every render
        if ((shouldResetBarcode || colorChanged) && !userEnteredBarcode) {
          if (priceCache[barcodeSelectionKey] && priceCache[barcodeSelectionKey].barcode) {
            setBarcode(priceCache[barcodeSelectionKey].barcode);
          } else if (colorChanged) {
            // Only clear barcode when color changes and there's no cached barcode for this color
            // AND the user hasn't manually entered a barcode
            setBarcode('');
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
    prevSelectionRef.current = priceSelectionKey;
    prevColorRef.current = selectedColor;
    // CRITICAL FIX: Removed dealersPrice and retailPrice from the dependency array
    // This prevents the effect from running when price changes
  }, [selectedManufacturer, selectedModel, selectedRam, selectedStorage, selectedColor, priceCache, userEnteredBarcode]);
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
            <CardTitle className="text-2xl text-white">Select Phone</CardTitle>
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
                status={status}
                lastUpdated={lastUpdated}
                handleImei1Change={handleImei1Change}
                handleImei2Change={handleImei2Change}
                handleBarcodeChange={handleBarcodeChange}
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
                {isSubmitting ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PhoneSelectionForm;