import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Boxes,
  Barcode,
  Package,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Search,
  ArrowRight,
  Image as ImageIcon,
  Store,
  Settings
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  getAllAccessoryProducts,
  getProductByBarcode
} from '../../services/accessoryService';
import {
  getActiveLocations,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';
import {
  getAccessoryInventory,
  adjustAccessoryInventory
} from '../../services/accessoryInventoryService';
import AccessoryLocationModal from './AccessoryLocationModal';

const EMPTY_ADJUSTMENTS = { onHand: '', onDisplay: '', reserved: '', defective: '' };
const QUANTITY_FIELDS = ['onHand', 'onDisplay', 'reserved', 'defective'];

const formatFieldLabel = (f) =>
  ({ onHand: 'Stock', onDisplay: 'Display', reserved: 'Reserved', defective: 'Defective' }[f]);

const AccessoryInventoryEntryForm = () => {
  const { accessoryInventoryItemToEdit, clearAccessoryInventoryItemToEdit } = useGlobalState();

  /* ========== REFERENCE DATA ========== */

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationsError, setLocationsError] = useState(null);

  const [locationModalOpen, setLocationModalOpen] = useState(false);

  /* ========== SELECTION ========== */

  const [selectedSku, setSelectedSku] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  /* ========== CURRENT INVENTORY ========== */

  const [currentInventory, setCurrentInventory] = useState(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  /* ========== DRAFT ========== */

  const [adjustments, setAdjustments] = useState(EMPTY_ADJUSTMENTS);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  /* ========== BARCODE LOOKUP ========== */

  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLookingUp, setBarcodeLookingUp] = useState(false);
  const [barcodeError, setBarcodeError] = useState(null);

  /* ========== PRODUCT FILTERS (cascading) ========== */

  const [productFilters, setProductFilters] = useState({
    category: '',
    manufacturer: '',
    model: ''
  });

  /* ========== LOADERS ========== */

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const res = await getAllAccessoryProducts();
      if (res.success) {
        setProducts(res.products || []);
      } else {
        setProductsError(res.error || 'Failed to load products');
      }
    } catch (err) {
      setProductsError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    setLocationsError(null);
    try {
      await seedDefaultLocationIfEmpty();
      const res = await getActiveLocations();
      if (res.success) {
        setLocations(res.locations || []);
        // Use a functional setState so we see the CURRENT selectedLocationId —
        // the edit-mode effect may have just set it to a specific store, and we
        // don't want the primary-default to overwrite that.
        if (res.locations && res.locations.length > 0) {
          setSelectedLocationId((prev) => {
            if (prev) return prev;
            const primary =
              res.locations.find((l) => l.isPrimary) || res.locations[0];
            return primary?.id || '';
          });
        }
      } else {
        setLocationsError(res.error || 'Failed to load stores');
      }
    } catch (err) {
      setLocationsError(err.message);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const loadInventory = useCallback(async (sku, locationId) => {
    if (!sku || !locationId) {
      setCurrentInventory(null);
      return;
    }
    setLoadingInventory(true);
    setInventoryError(null);
    try {
      const res = await getAccessoryInventory(sku, locationId);
      if (res.success) {
        setCurrentInventory(res.inventory);
      } else {
        setInventoryError(res.error || 'Failed to load inventory');
      }
    } catch (err) {
      setInventoryError(err.message);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  // React to (sku, location) selection changes
  useEffect(() => {
    setAdjustments(EMPTY_ADJUSTMENTS);
    setSaveError(null);
    setSuccessMessage('');
    loadInventory(selectedSku, selectedLocationId);
  }, [selectedSku, selectedLocationId, loadInventory]);

  // Context-driven edit (navigation from the inventory list)
  useEffect(() => {
    if (accessoryInventoryItemToEdit) {
      const sku =
        accessoryInventoryItemToEdit.internalSku ||
        accessoryInventoryItemToEdit.sku ||
        accessoryInventoryItemToEdit.id;
      if (sku) setSelectedSku(sku);
      const locId = accessoryInventoryItemToEdit.locationId;
      if (locId) setSelectedLocationId(locId);
    }
  }, [accessoryInventoryItemToEdit]);

  /* ========== DERIVED ========== */

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  // Filter option sources cascade: each level narrows based on the levels above.
  const filterCategories = useMemo(() => {
    const set = new Set(activeProducts.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts]);

  const filterManufacturers = useMemo(() => {
    const source = productFilters.category
      ? activeProducts.filter((p) => p.category === productFilters.category)
      : activeProducts;
    const set = new Set(source.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, productFilters.category]);

  const filterModels = useMemo(() => {
    let source = activeProducts;
    if (productFilters.category) source = source.filter((p) => p.category === productFilters.category);
    if (productFilters.manufacturer)
      source = source.filter((p) => p.manufacturer === productFilters.manufacturer);
    const set = new Set(source.map((p) => p.model).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, productFilters.category, productFilters.manufacturer]);

  const anyProductFilterActive =
    Boolean(productFilters.category) ||
    Boolean(productFilters.manufacturer) ||
    Boolean(productFilters.model);

  const selectedProduct = useMemo(() => {
    if (!selectedSku) return null;
    return products.find((p) => (p.internalSku || p.id) === selectedSku) || null;
  }, [selectedSku, products]);

  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return null;
    return locations.find((l) => l.id === selectedLocationId) || null;
  }, [selectedLocationId, locations]);

  const isInactiveProduct = Boolean(selectedProduct && selectedProduct.active === false);

  const preview = useMemo(() => {
    const current = currentInventory || {
      onHand: 0,
      onDisplay: 0,
      reserved: 0,
      defective: 0,
      sold: 0
    };
    const next = {
      onHand: (current.onHand || 0) + (parseInt(adjustments.onHand, 10) || 0),
      onDisplay: (current.onDisplay || 0) + (parseInt(adjustments.onDisplay, 10) || 0),
      reserved: (current.reserved || 0) + (parseInt(adjustments.reserved, 10) || 0),
      defective: (current.defective || 0) + (parseInt(adjustments.defective, 10) || 0),
      sold: current.sold || 0
    };
    const negative = QUANTITY_FIELDS.filter((f) => next[f] < 0);
    const availableNow =
      ((current.onHand || 0) + (current.onDisplay || 0)) -
      ((current.reserved || 0) + (current.defective || 0));
    const availableNext = next.onHand + next.onDisplay - (next.reserved + next.defective);
    return { current, next, negative, availableNow, availableNext };
  }, [currentInventory, adjustments]);

  const isDirty = QUANTITY_FIELDS.some(
    (f) => adjustments[f] && parseInt(adjustments[f], 10) !== 0
  );

  /* ========== HANDLERS ========== */

  const handleBarcodeLookup = async (e) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeError(null);
    setBarcodeLookingUp(true);
    try {
      const res = await getProductByBarcode(code);
      if (!res.success) {
        setBarcodeError(res.error || 'Lookup failed');
        return;
      }
      if (!res.product) {
        setBarcodeError(`No product found with barcode "${code}"`);
        return;
      }
      if (res.product.active === false) {
        setBarcodeError(
          `Product "${res.product.model}" is INACTIVE and cannot have inventory adjusted. Reactivate it first.`
        );
        return;
      }
      const sku = res.product.internalSku || res.product.id;
      setSelectedSku(sku);
      setBarcodeInput('');
    } catch (err) {
      setBarcodeError(err.message);
    } finally {
      setBarcodeLookingUp(false);
    }
  };

  const handleProductFilterChange = (name, value) => {
    setProductFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'category') {
        next.manufacturer = '';
        next.model = '';
      } else if (name === 'manufacturer') {
        next.model = '';
      }
      return next;
    });
  };

  const clearProductFilters = () => {
    setProductFilters({ category: '', manufacturer: '', model: '' });
  };

  const handleAdjustmentChange = (field, rawValue) => {
    let cleaned = rawValue.replace(/[^\d-]/g, '');
    if (cleaned.startsWith('-')) {
      cleaned = '-' + cleaned.slice(1).replace(/-/g, '');
    } else {
      cleaned = cleaned.replace(/-/g, '');
    }
    setAdjustments((prev) => ({ ...prev, [field]: cleaned }));
  };

  const handleSave = async () => {
    setSaveError(null);
    setSuccessMessage('');

    if (!selectedSku) {
      setSaveError('Select a product first');
      return;
    }
    if (!selectedLocationId) {
      setSaveError('Select a store first');
      return;
    }
    if (isInactiveProduct) {
      setSaveError('Cannot adjust inventory on an inactive product. Reactivate it first.');
      return;
    }
    if (!isDirty) {
      setSaveError('No changes to save');
      return;
    }
    if (preview.negative.length > 0) {
      setSaveError(
        `Cannot reduce ${preview.negative
          .map(formatFieldLabel)
          .join(', ')} below zero. Review the preview.`
      );
      return;
    }

    const payload = {};
    QUANTITY_FIELDS.forEach((f) => {
      const n = parseInt(adjustments[f], 10);
      if (Number.isFinite(n) && n !== 0) payload[f] = n;
    });

    setSaving(true);
    try {
      const res = await adjustAccessoryInventory(selectedSku, selectedLocationId, payload);
      if (res.success) {
        setSuccessMessage(
          `Inventory updated for ${selectedSku} at ${selectedLocation?.name || 'selected store'}`
        );
        setAdjustments(EMPTY_ADJUSTMENTS);
        await loadInventory(selectedSku, selectedLocationId);
      } else {
        setSaveError(res.error || 'Save failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setAdjustments(EMPTY_ADJUSTMENTS);
    setSaveError(null);
    setSuccessMessage('');
  };

  const handleDeselect = () => {
    setSelectedSku('');
    setAdjustments(EMPTY_ADJUSTMENTS);
    setCurrentInventory(null);
    setSaveError(null);
    setSuccessMessage('');
    clearProductFilters();
    clearAccessoryInventoryItemToEdit();
  };

  /* ========== RENDER ========== */

  const renderCurrentCell = (field) => {
    const current = preview.current[field] || 0;
    const nextVal = preview.next[field] || 0;
    const delta = parseInt(adjustments[field], 10) || 0;
    const negative = nextVal < 0;
    return (
      <div className="flex flex-col items-start">
        <span className="text-xs text-gray-500">{formatFieldLabel(field)}</span>
        <span className="text-lg font-semibold">{current}</span>
        {delta !== 0 && (
          <span
            className={`text-xs flex items-center gap-1 ${
              negative ? 'text-red-600' : 'text-green-700'
            }`}
          >
            <ArrowRight className="h-3 w-3" />
            {nextVal}
            {delta > 0 ? ` (+${delta})` : ` (${delta})`}
          </span>
        )}
      </div>
    );
  };

  const sortedProductOptions = useMemo(() => {
    let list = activeProducts;
    if (productFilters.category) list = list.filter((p) => p.category === productFilters.category);
    if (productFilters.manufacturer)
      list = list.filter((p) => p.manufacturer === productFilters.manufacturer);
    if (productFilters.model) list = list.filter((p) => p.model === productFilters.model);
    return list.slice().sort((a, b) => {
      const m = (a.manufacturer || '').localeCompare(b.manufacturer || '');
      if (m !== 0) return m;
      return (a.model || '').localeCompare(b.model || '');
    });
  }, [activeProducts, productFilters]);

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[860px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <Boxes className="h-6 w-6" />
            Accessory Inventory Entry
          </CardTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium"
            >
              <Settings className="h-4 w-4" />
              <span>Manage Stores</span>
            </button>
            {selectedSku && (
              <button
                type="button"
                onClick={handleDeselect}
                className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium"
              >
                <X className="h-4 w-4" />
                <span>Pick another</span>
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-5">
          {/* Store selector (always visible) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Store className="w-6 h-6 text-[rgb(52,69,157)]" />
              <h3 className="text-xl font-semibold">Store</h3>
            </div>
            <div className="mt-2">
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={loadingLocations}
                className="w-full p-2 border rounded"
              >
                <option value="">
                  {loadingLocations
                    ? 'Loading stores…'
                    : locations.length === 0
                    ? 'No stores available — click "Manage Stores"'
                    : 'Select a store'}
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.isPrimary ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
              {locationsError && (
                <p className="text-xs text-red-600 mt-1">{locationsError}</p>
              )}
              {selectedLocation?.address && (
                <p className="text-xs text-gray-500 mt-1">{selectedLocation.address}</p>
              )}
            </div>
          </div>

          {/* Product lookup (hidden once one is selected) */}
          {!selectedSku && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Pick a Product</h3>
              </div>

              <div className="p-3 bg-gray-50 border rounded space-y-4">
                {/* Cascading filters */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Narrow by</span>
                    {anyProductFilterActive && (
                      <button
                        type="button"
                        onClick={clearProductFilters}
                        className="text-xs text-gray-500 hover:text-red-600 flex items-center"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear filters
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select
                        value={productFilters.category}
                        onChange={(e) => handleProductFilterChange('category', e.target.value)}
                        className="w-full p-2 border rounded text-sm bg-white"
                      >
                        <option value="">All Categories</option>
                        {filterCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Manufacturer
                      </label>
                      <select
                        value={productFilters.manufacturer}
                        onChange={(e) => handleProductFilterChange('manufacturer', e.target.value)}
                        disabled={filterManufacturers.length === 0}
                        className="w-full p-2 border rounded text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="">All Manufacturers</option>
                        {filterManufacturers.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                      <select
                        value={productFilters.model}
                        onChange={(e) => handleProductFilterChange('model', e.target.value)}
                        disabled={!productFilters.manufacturer || filterModels.length === 0}
                        title={!productFilters.manufacturer ? 'Select a manufacturer first' : ''}
                        className="w-full p-2 border rounded text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="">All Models</option>
                        {filterModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SKU picker + barcode lookup — separated by a subtle divider */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Search className="h-4 w-4 inline mr-1" />
                        Select by SKU / model
                      </label>
                      <select
                        value={selectedSku}
                        onChange={(e) => setSelectedSku(e.target.value)}
                        disabled={loadingProducts}
                        className="w-full p-2 border rounded bg-white"
                      >
                        <option value="">
                          {loadingProducts
                            ? 'Loading products…'
                            : activeProducts.length === 0
                            ? 'No active products'
                            : sortedProductOptions.length === 0
                            ? 'No products match the current filters'
                            : anyProductFilterActive
                            ? `Select a product (${sortedProductOptions.length} of ${activeProducts.length} matching)`
                            : `Select a product (${activeProducts.length} active)`}
                        </option>
                        {sortedProductOptions.map((p) => {
                          const sku = p.internalSku || p.id;
                          return (
                            <option key={sku} value={sku}>
                              {p.manufacturer} — {p.model} [{sku}]
                            </option>
                          );
                        })}
                      </select>
                      {productsError && (
                        <p className="text-xs text-red-600 mt-1">{productsError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Barcode className="h-4 w-4 inline mr-1" />
                        Or enter barcode
                      </label>
                      <form onSubmit={handleBarcodeLookup} className="flex gap-2">
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Type or paste barcode"
                          className="flex-1 px-3 py-2 border rounded text-sm bg-white"
                        />
                        <button
                          type="submit"
                          disabled={!barcodeInput.trim() || barcodeLookingUp}
                          className={`flex items-center gap-1 px-3 py-2 rounded text-sm ${
                            !barcodeInput.trim() || barcodeLookingUp
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                          }`}
                        >
                          {barcodeLookingUp ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          <span>Find</span>
                        </button>
                      </form>
                      {barcodeError && (
                        <div className="mt-1 flex items-start gap-1 text-xs text-red-700">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>{barcodeError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected product + inventory */}
          {selectedSku && (
            <>
              {/* Product header */}
              <div className="flex flex-col md:flex-row gap-4 p-4 bg-gray-50 border rounded">
                {/* Image */}
                <div className="w-32 h-32 bg-white rounded border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedProduct?.photoUrl ? (
                    <img
                      src={selectedProduct.photoUrl}
                      alt={selectedProduct.model}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <ImageIcon className="h-7 w-7" />
                      <span className="text-[10px] mt-0.5">No Image</span>
                    </div>
                  )}
                </div>

                {/* Identity */}
                <div className="min-w-0 md:w-64 md:flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">
                      {selectedProduct?.manufacturer || ''} {selectedProduct?.model || ''}
                    </h3>
                    {selectedProduct?.active === false && (
                      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {selectedProduct?.category || '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    SKU: {selectedSku}
                    {selectedProduct?.barcode ? `  ·  Barcode: ${selectedProduct.barcode}` : ''}
                  </p>
                </div>

                {/* Description */}
                <div className="min-w-0 flex-1 self-stretch md:border-l md:border-gray-200 md:pl-4 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Description
                  </p>
                  {selectedProduct?.description ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No description provided</p>
                  )}
                </div>
              </div>

              {inventoryError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{inventoryError}</span>
                </div>
              )}

              {/* Current stock (scoped to selected store) */}
              <div className="border rounded p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[rgb(52,69,157)]">
                    Current Stock
                  </h3>
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Store className="h-4 w-4" />
                    {selectedLocation?.name || '—'}
                  </span>
                </div>
                {loadingInventory ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin inline mr-2" />
                    Loading inventory…
                  </div>
                ) : (
                  <>
                    {!currentInventory && selectedLocationId && (
                      <p className="text-sm text-amber-700">
                        No inventory record for this product at this store yet — saving will
                        create one.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {QUANTITY_FIELDS.map((f) => (
                        <div key={f} className="p-3 border rounded bg-gray-50">
                          {renderCurrentCell(f)}
                        </div>
                      ))}
                      <div className="p-3 border rounded bg-gray-50">
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-gray-500">Sold (read-only)</span>
                          <span className="text-lg font-semibold">{preview.current.sold || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 pt-2 border-t">
                      <span>
                        Available now:{' '}
                        <span className="font-semibold text-gray-800">{preview.availableNow}</span>
                      </span>
                      {isDirty && (
                        <span>
                          After save:{' '}
                          <span
                            className={`font-semibold ${
                              preview.availableNext < 0 ? 'text-red-600' : 'text-gray-800'
                            }`}
                          >
                            {preview.availableNext}
                          </span>
                        </span>
                      )}
                      <span className="text-gray-400">
                        (Available = (On Hand + On Display) − (Reserved + Defective))
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Adjustments */}
              <div className="border rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[rgb(52,69,157)]">Adjustments</h3>
                  <p className="text-xs text-gray-500">
                    Positive adds stock, negative removes. Leave blank for no change.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {QUANTITY_FIELDS.map((f) => (
                    <div key={f}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {formatFieldLabel(f)}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={adjustments[f]}
                        onChange={(e) => handleAdjustmentChange(f, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border rounded text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {saveError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
              {successMessage && (
                <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!isDirty || saving}
                  className="w-1/3 flex items-center justify-center gap-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    !isDirty ||
                    saving ||
                    isInactiveProduct ||
                    preview.negative.length > 0 ||
                    !selectedLocationId
                  }
                  className={`w-2/3 flex items-center justify-center gap-1 py-2 rounded ${
                    !isDirty ||
                    saving ||
                    isInactiveProduct ||
                    preview.negative.length > 0 ||
                    !selectedLocationId
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                  }`}
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving…' : 'Apply Adjustments'}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AccessoryLocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onLocationsChanged={loadLocations}
      />
    </div>
  );
};

export default AccessoryInventoryEntryForm;
