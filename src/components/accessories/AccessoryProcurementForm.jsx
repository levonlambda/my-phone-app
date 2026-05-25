import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShoppingCart,
  Store,
  Calendar,
  User,
  CreditCard,
  Package,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Building2
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { getAllSuppliers } from '../../services/supplierService';
import {
  getAllAccessoryProducts,
  getAllAccessoryPricing,
  getProductByBarcode,
  createAccessoryProcurement,
  updateAccessoryProcurement,
  markAccessoryProcurementPaid
} from '../../services/accessoryService';
import {
  getActiveLocations,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';
import {
  formatNumberWithCommas,
  parsePrice,
  handleKeyDown
} from '../phone-selection/utils/phoneUtils';

const todayIso = () => new Date().toISOString().split('T')[0];

const AccessoryProcurementForm = () => {
  const {
    accessoryProcurementToEdit,
    accessoryProcurementMode,
    clearAccessoryProcurementToEdit,
    setActiveComponent
  } = useGlobalState();

  const mode = accessoryProcurementMode || 'create';
  const isEditing = mode === 'edit';
  const isViewing = mode === 'view';
  const isPaymentMode = mode === 'payment';
  const isReadOnly = isViewing;

  /* ========== REFERENCE DATA ========== */

  const [products, setProducts] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [refsError, setRefsError] = useState(null);

  /* ========== PROCUREMENT CONTEXT ========== */

  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');

  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountPayable, setAccountPayable] = useState('');

  const [isPaid, setIsPaid] = useState(false);
  const [datePaid, setDatePaid] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const [isReceived, setIsReceived] = useState(false);

  /* ========== ITEMS ========== */

  const [items, setItems] = useState([]);
  let _itemIdCounter = 0;
  const nextItemId = () => {
    _itemIdCounter += 1;
    return `it-${Date.now()}-${_itemIdCounter}`;
  };

  /* ========== PRODUCT PICKER ========== */

  const [pickerFilters, setPickerFilters] = useState({
    category: '',
    manufacturer: '',
    model: ''
  });
  const [pickerSku, setPickerSku] = useState('');
  const [pickerQuantity, setPickerQuantity] = useState('1');
  const [pickerDealersPrice, setPickerDealersPrice] = useState('');
  const [pickerBarcode, setPickerBarcode] = useState('');
  const [pickerBarcodeError, setPickerBarcodeError] = useState(null);
  const [pickerBarcodeLookingUp, setPickerBarcodeLookingUp] = useState(false);

  /* ========== UI ========== */

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  /* ========== LOADERS ========== */

  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    setRefsError(null);
    try {
      await seedDefaultLocationIfEmpty();
      const [productsRes, pricingRes, suppliersRes, locationsRes] = await Promise.all([
        getAllAccessoryProducts(),
        getAllAccessoryPricing(),
        getAllSuppliers(),
        getActiveLocations()
      ]);
      if (productsRes.success) setProducts(productsRes.products || []);
      const pMap = {};
      if (pricingRes.success) {
        (pricingRes.pricing || []).forEach((p) => {
          pMap[p.id] = p;
        });
      }
      setPricingMap(pMap);
      if (suppliersRes.success) setSuppliers(suppliersRes.suppliers || []);
      if (locationsRes.success) setLocations(locationsRes.locations || []);
    } catch (err) {
      setRefsError(err.message);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  /* ========== POPULATE FROM CONTEXT (edit / view / payment) ========== */

  useEffect(() => {
    if (accessoryProcurementToEdit) {
      const p = accessoryProcurementToEdit;
      setPurchaseDate(p.purchaseDate || todayIso());
      setSelectedSupplierId(p.supplierId || '');
      setDestinationLocationId(p.destinationLocationId || '');
      setBankName(p.bankName || '');
      setBankAccount(p.bankAccount || '');
      setAccountPayable(p.accountPayable || '');
      setIsPaid(Boolean(p.isPaid));
      setDatePaid(p.datePaid || '');
      setPaymentReference(p.paymentReference || '');
      setIsReceived(Boolean(p.isReceived));
      setItems(
        (p.items || []).map((item) => ({
          id: nextItemId(),
          internalSku: item.internalSku,
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          category: item.category || '',
          quantity: Number(item.quantity) || 0,
          dealersPrice: Number(item.dealersPrice) || 0,
          totalPrice: (Number(item.quantity) || 0) * (Number(item.dealersPrice) || 0)
        }))
      );
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessoryProcurementToEdit]);

  // When supplier selected and not editing a loaded procurement, auto-fill bank info from supplier
  useEffect(() => {
    if (!selectedSupplierId) return;
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return;
    // Only auto-fill in create mode; edit mode preserves the historical values
    if (mode === 'create') {
      setBankName(supplier.bankName || '');
      setBankAccount(supplier.bankAccount || '');
      setAccountPayable(supplier.accountPayable || supplier.supplierName || '');
    }
  }, [selectedSupplierId, suppliers, mode]);

  const resetForm = () => {
    setPurchaseDate(todayIso());
    setSelectedSupplierId('');
    setDestinationLocationId('');
    setBankName('');
    setBankAccount('');
    setAccountPayable('');
    setIsPaid(false);
    setDatePaid('');
    setPaymentReference('');
    setIsReceived(false);
    setItems([]);
    setPickerFilters({ category: '', manufacturer: '', model: '' });
    setPickerSku('');
    setPickerQuantity('1');
    setPickerDealersPrice('');
    setPickerBarcode('');
    setPickerBarcodeError(null);
    setSaveError(null);
    setSuccessMessage('');
  };

  /* ========== CASCADING PICKER FILTERS ========== */

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  const pickerCategories = useMemo(() => {
    const set = new Set(activeProducts.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts]);

  const pickerManufacturers = useMemo(() => {
    const source = pickerFilters.category
      ? activeProducts.filter((p) => p.category === pickerFilters.category)
      : activeProducts;
    const set = new Set(source.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, pickerFilters.category]);

  const pickerModels = useMemo(() => {
    let source = activeProducts;
    if (pickerFilters.category) source = source.filter((p) => p.category === pickerFilters.category);
    if (pickerFilters.manufacturer)
      source = source.filter((p) => p.manufacturer === pickerFilters.manufacturer);
    const set = new Set(source.map((p) => p.model).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, pickerFilters.category, pickerFilters.manufacturer]);

  const pickerProductOptions = useMemo(() => {
    let list = activeProducts;
    if (pickerFilters.category) list = list.filter((p) => p.category === pickerFilters.category);
    if (pickerFilters.manufacturer)
      list = list.filter((p) => p.manufacturer === pickerFilters.manufacturer);
    if (pickerFilters.model) list = list.filter((p) => p.model === pickerFilters.model);
    return list
      .slice()
      .sort((a, b) => {
        const m = (a.manufacturer || '').localeCompare(b.manufacturer || '');
        if (m !== 0) return m;
        return (a.model || '').localeCompare(b.model || '');
      });
  }, [activeProducts, pickerFilters]);

  const pickerSelectedProduct = useMemo(() => {
    if (!pickerSku) return null;
    return products.find((p) => (p.internalSku || p.id) === pickerSku) || null;
  }, [pickerSku, products]);

  // When a SKU is selected, default the dealer price from pricingMap
  useEffect(() => {
    if (!pickerSku) {
      setPickerDealersPrice('');
      return;
    }
    const pricing = pricingMap[pickerSku];
    if (pricing && pricing.dealersPrice) {
      setPickerDealersPrice(formatNumberWithCommas(String(pricing.dealersPrice)));
    } else {
      setPickerDealersPrice('');
    }
  }, [pickerSku, pricingMap]);

  /* ========== HANDLERS ========== */

  const handlePickerFilterChange = (name, value) => {
    setPickerFilters((prev) => {
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

  const handlePickerBarcodeLookup = async (e) => {
    if (e) e.preventDefault();
    const code = pickerBarcode.trim();
    if (!code) return;
    setPickerBarcodeError(null);
    setPickerBarcodeLookingUp(true);
    try {
      const res = await getProductByBarcode(code);
      if (!res.success) {
        setPickerBarcodeError(res.error || 'Lookup failed');
        return;
      }
      if (!res.product) {
        setPickerBarcodeError(`No product found with barcode "${code}"`);
        return;
      }
      if (res.product.active === false) {
        setPickerBarcodeError(`Product "${res.product.model}" is inactive`);
        return;
      }
      setPickerSku(res.product.internalSku || res.product.id);
      setPickerBarcode('');
    } catch (err) {
      setPickerBarcodeError(err.message);
    } finally {
      setPickerBarcodeLookingUp(false);
    }
  };

  const handleAddItem = () => {
    setSaveError(null);
    const product = pickerSelectedProduct;
    if (!product) {
      setSaveError('Pick a product first');
      return;
    }
    const qty = parseInt(pickerQuantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      setSaveError('Quantity must be a positive integer');
      return;
    }
    const price = parseFloat(parsePrice(pickerDealersPrice)) || 0;
    if (price < 0) {
      setSaveError('Dealer price cannot be negative');
      return;
    }

    const sku = product.internalSku || product.id;
    // If the same SKU is already in the items, merge (sum quantities)
    const existing = items.find((it) => it.internalSku === sku);
    if (existing) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === existing.id
            ? {
                ...it,
                quantity: it.quantity + qty,
                totalPrice: (it.quantity + qty) * it.dealersPrice
              }
            : it
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: nextItemId(),
          internalSku: sku,
          manufacturer: product.manufacturer || '',
          model: product.model || '',
          category: product.category || '',
          quantity: qty,
          dealersPrice: price,
          totalPrice: qty * price
        }
      ]);
    }
    // Reset picker
    setPickerSku('');
    setPickerQuantity('1');
    setPickerDealersPrice('');
  };

  const handleChangeItemQuantity = (id, delta) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.id !== id) return it;
          const nextQty = Math.max(0, it.quantity + delta);
          return { ...it, quantity: nextQty, totalPrice: nextQty * it.dealersPrice };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleCancel = () => {
    clearAccessoryProcurementToEdit();
    resetForm();
    setActiveComponent('acc-procurement-mgmt');
  };

  /* ========== TOTALS ========== */

  const totals = useMemo(() => {
    const totalItems = items.length;
    const totalUnits = items.reduce((t, it) => t + it.quantity, 0);
    const grandTotal = items.reduce((t, it) => t + it.totalPrice, 0);
    return { totalItems, totalUnits, grandTotal };
  }, [items]);

  /* ========== SUBMIT ========== */

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSuccessMessage('');

    // Payment-only save
    if (isPaymentMode) {
      if (!isPaid) {
        setSaveError('Set payment status to Paid to record a payment');
        return;
      }
      if (!datePaid) {
        setSaveError('Date paid is required');
        return;
      }
      setSubmitting(true);
      try {
        const res = await markAccessoryProcurementPaid(accessoryProcurementToEdit.id, {
          datePaid,
          paymentReference,
          bankName,
          bankAccount,
          accountPayable
        });
        if (res.success) {
          setSuccessMessage('Payment recorded successfully');
          setTimeout(() => {
            clearAccessoryProcurementToEdit();
            setActiveComponent('acc-procurement-mgmt');
          }, 800);
        } else {
          setSaveError(res.error || 'Failed to record payment');
        }
      } catch (err) {
        setSaveError(err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Create or update: full validation
    if (items.length === 0) {
      setSaveError('Add at least one item');
      return;
    }
    if (!purchaseDate) {
      setSaveError('Purchase date is required');
      return;
    }
    if (!selectedSupplierId) {
      setSaveError('Supplier is required');
      return;
    }
    if (!destinationLocationId) {
      setSaveError('Destination store is required');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    const location = locations.find((l) => l.id === destinationLocationId);

    const payload = {
      supplierId: selectedSupplierId,
      supplierName: supplier?.supplierName || '',
      destinationLocationId,
      destinationLocationName: location?.name || '',
      purchaseDate,
      items: items.map((it) => ({
        internalSku: it.internalSku,
        manufacturer: it.manufacturer,
        model: it.model,
        category: it.category,
        quantity: it.quantity,
        dealersPrice: it.dealersPrice,
        totalPrice: it.totalPrice
      })),
      grandTotal: totals.grandTotal,
      totalQuantity: totals.totalUnits,
      bankName,
      bankAccount,
      accountPayable,
      isPaid,
      datePaid: isPaid ? datePaid : '',
      paymentReference: isPaid ? paymentReference : ''
    };

    setSubmitting(true);
    try {
      let res;
      if (isEditing) {
        res = await updateAccessoryProcurement(accessoryProcurementToEdit.id, payload);
      } else {
        res = await createAccessoryProcurement(payload);
      }
      if (res.success) {
        setSuccessMessage(
          isEditing
            ? 'Procurement updated successfully'
            : `Procurement created successfully (${res.reference || ''})`
        );
        setTimeout(() => {
          clearAccessoryProcurementToEdit();
          resetForm();
          setActiveComponent('acc-procurement-mgmt');
        }, 1000);
      } else {
        setSaveError(res.error || 'Save failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== RENDER HELPERS ========== */

  const disabledBase = 'bg-gray-100 text-gray-600 cursor-not-allowed';
  const inputStyle = (extraDisabled = false) =>
    `w-full px-3 py-2 border rounded text-sm ${
      isReadOnly || extraDisabled ? disabledBase : 'bg-white'
    }`;

  const destinationLocked = isReceived; // once received, can't change destination
  const coreFieldsDisabled = isReadOnly || isPaymentMode;

  const headerTitle = isViewing
    ? 'View Accessory Procurement'
    : isEditing
    ? 'Edit Accessory Procurement'
    : isPaymentMode
    ? 'Record Payment'
    : 'New Accessory Procurement';

  /* ========== RENDER ========== */

  return (
    <div className="min-h-screen bg-white p-4">
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-[1100px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              {headerTitle}
              {accessoryProcurementToEdit?.reference && (
                <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded ml-2">
                  {accessoryProcurementToEdit.reference}
                </span>
              )}
            </CardTitle>
            {(isEditing || isViewing || isPaymentMode) && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium"
              >
                <X className="h-4 w-4" />
                <span>{isViewing ? 'Close' : 'Cancel'}</span>
              </button>
            )}
          </CardHeader>

          <CardContent className="p-4 space-y-5">
            {refsError && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{refsError}</span>
              </div>
            )}
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

            {/* Section: Procurement Details */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[rgb(52,69,157)]" />
                <h3 className="text-lg font-semibold">Procurement Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={coreFieldsDisabled}
                    onKeyDown={handleKeyDown}
                    className={inputStyle()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <User className="h-3.5 w-3.5 inline mr-1" />
                    Supplier *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={coreFieldsDisabled || loadingRefs}
                    className={inputStyle()}
                  >
                    <option value="">Select a supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName || s.name || s.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Store className="h-3.5 w-3.5 inline mr-1" />
                    Destination Store *
                  </label>
                  <select
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    disabled={coreFieldsDisabled || destinationLocked || loadingRefs}
                    title={destinationLocked ? 'Store is locked after stock is received' : ''}
                    className={inputStyle(destinationLocked)}
                  >
                    <option value="">Select a store</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.isPrimary ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Payment / Bank Info */}
            <div className="space-y-1 border-t pt-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[rgb(52,69,157)]" />
                <h3 className="text-lg font-semibold">Payment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Building2 className="h-3.5 w-3.5 inline mr-1" />
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={coreFieldsDisabled}
                    className={inputStyle()}
                    placeholder="Auto-filled from supplier"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Bank Account
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    disabled={coreFieldsDisabled}
                    className={inputStyle()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Account Payable
                  </label>
                  <input
                    type="text"
                    value={accountPayable}
                    onChange={(e) => setAccountPayable(e.target.value)}
                    disabled={coreFieldsDisabled}
                    className={inputStyle()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={isPaid ? 'paid' : 'unpaid'}
                    onChange={(e) => {
                      const paid = e.target.value === 'paid';
                      setIsPaid(paid);
                      if (!paid) {
                        setDatePaid('');
                        setPaymentReference('');
                      } else if (!datePaid) {
                        setDatePaid(todayIso());
                      }
                    }}
                    disabled={isReadOnly}
                    className={`${inputStyle()} ${
                      isPaid ? 'bg-green-50 text-green-800' : ''
                    }`}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Paid</label>
                  <input
                    type="date"
                    value={datePaid}
                    onChange={(e) => setDatePaid(e.target.value)}
                    disabled={isReadOnly || !isPaid}
                    className={inputStyle(!isPaid)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    disabled={isReadOnly || !isPaid}
                    placeholder="Auto-generated if blank"
                    className={inputStyle(!isPaid)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span>Delivery:</span>
                {isReceived ? (
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                    Delivered
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    Pending
                  </span>
                )}
              </div>
            </div>

            {/* Section: Pick a Product */}
            {!isPaymentMode && !isReadOnly && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[rgb(52,69,157)]" />
                  <h3 className="text-lg font-semibold">Add Items</h3>
                </div>

                <div className="p-3 bg-gray-50 border rounded space-y-4">
                  {/* Cascading filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Category
                      </label>
                      <select
                        value={pickerFilters.category}
                        onChange={(e) => handlePickerFilterChange('category', e.target.value)}
                        className="w-full p-2 border rounded text-sm bg-white"
                      >
                        <option value="">All Categories</option>
                        {pickerCategories.map((c) => (
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
                        value={pickerFilters.manufacturer}
                        onChange={(e) => handlePickerFilterChange('manufacturer', e.target.value)}
                        disabled={pickerManufacturers.length === 0}
                        className="w-full p-2 border rounded text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="">All Manufacturers</option>
                        {pickerManufacturers.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                      <select
                        value={pickerFilters.model}
                        onChange={(e) => handlePickerFilterChange('model', e.target.value)}
                        disabled={!pickerFilters.manufacturer || pickerModels.length === 0}
                        className="w-full p-2 border rounded text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="">All Models</option>
                        {pickerModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* SKU / Barcode + qty + price + Add */}
                  <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        <Search className="h-3.5 w-3.5 inline mr-1" />
                        Select product
                      </label>
                      <select
                        value={pickerSku}
                        onChange={(e) => setPickerSku(e.target.value)}
                        className="w-full p-2 border rounded text-sm bg-white"
                      >
                        <option value="">
                          {pickerProductOptions.length === 0
                            ? 'No active products'
                            : `Pick (${pickerProductOptions.length} available)`}
                        </option>
                        {pickerProductOptions.map((p) => {
                          const sku = p.internalSku || p.id;
                          return (
                            <option key={sku} value={sku}>
                              {p.manufacturer} — {p.model} [{sku}]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        <Barcode className="h-3.5 w-3.5 inline mr-1" />
                        Or barcode
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={pickerBarcode}
                          onChange={(e) => setPickerBarcode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handlePickerBarcodeLookup();
                            }
                          }}
                          placeholder="Scan or type"
                          className="flex-1 px-2 py-2 border rounded text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={handlePickerBarcodeLookup}
                          disabled={!pickerBarcode.trim() || pickerBarcodeLookingUp}
                          className={`px-2 py-2 rounded text-sm ${
                            !pickerBarcode.trim() || pickerBarcodeLookingUp
                              ? 'bg-gray-200 text-gray-500'
                              : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                          }`}
                          title="Find by barcode"
                        >
                          {pickerBarcodeLookingUp ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {pickerBarcodeError && (
                        <p className="text-xs text-red-600 mt-1">{pickerBarcodeError}</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pickerQuantity}
                        onChange={(e) =>
                          setPickerQuantity(e.target.value.replace(/[^\d]/g, ''))
                        }
                        className="w-full p-2 border rounded text-sm bg-white text-right"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Dealer Price
                      </label>
                      <input
                        type="text"
                        value={pickerDealersPrice}
                        onChange={(e) =>
                          setPickerDealersPrice(formatNumberWithCommas(e.target.value))
                        }
                        className="w-full p-2 border rounded text-sm bg-white text-right"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!pickerSku}
                        className={`w-full flex items-center justify-center gap-1 py-2 rounded text-sm ${
                          !pickerSku
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  </div>
                  {pickerSelectedProduct && (
                    <div className="text-xs text-gray-600">
                      Adding: {pickerSelectedProduct.manufacturer} — {pickerSelectedProduct.model} ·
                      Category: {pickerSelectedProduct.category || '(none)'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section: Items Table */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[rgb(52,69,157)]" />
                  <h3 className="text-lg font-semibold">
                    Order Items{' '}
                    <span className="text-sm font-normal text-gray-500">
                      ({items.length} line{items.length !== 1 ? 's' : ''} · {totals.totalUnits} unit
                      {totals.totalUnits !== 1 ? 's' : ''})
                    </span>
                  </h3>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 border border-dashed rounded">
                  No items yet — add products from the section above.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Manufacturer</th>
                        <th className="px-3 py-2 text-left">Model</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Dealer Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        {!isReadOnly && !isPaymentMode && (
                          <th className="px-3 py-2 text-center w-10"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-gray-50 border-t">
                          <td className="px-3 py-2 font-mono text-xs">{it.internalSku}</td>
                          <td className="px-3 py-2">{it.manufacturer || '-'}</td>
                          <td className="px-3 py-2 font-medium">{it.model || '-'}</td>
                          <td className="px-3 py-2">{it.category || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            {isReadOnly || isPaymentMode ? (
                              <span>{it.quantity}</span>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleChangeItemQuantity(it.id, -1)}
                                  className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center font-semibold">{it.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleChangeItemQuantity(it.id, 1)}
                                  className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            ₱{formatNumberWithCommas(it.dealersPrice.toFixed(2))}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            ₱{formatNumberWithCommas(it.totalPrice.toFixed(2))}
                          </td>
                          {!isReadOnly && !isPaymentMode && (
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t font-semibold">
                        <td
                          colSpan={6}
                          className="px-3 py-2 text-right text-gray-700"
                        >
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right text-[rgb(52,69,157)] text-base">
                          ₱{formatNumberWithCommas(totals.grandTotal.toFixed(2))}
                        </td>
                        {!isReadOnly && !isPaymentMode && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Summary cards */}
            {items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Line Items</p>
                  <p className="text-2xl font-bold text-blue-700">{totals.totalItems}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Total Units</p>
                  <p className="text-2xl font-bold text-amber-700">{totals.totalUnits}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Grand Total</p>
                  <p className="text-2xl font-bold text-green-700">
                    ₱{formatNumberWithCommas(totals.grandTotal.toFixed(2))}
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            {!isViewing && (
              <div className="pt-4 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded text-base font-medium ${
                    submitting
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                  }`}
                >
                  {submitting ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {submitting
                    ? 'Saving…'
                    : isPaymentMode
                    ? 'Save Payment Details'
                    : isEditing
                    ? 'Update Procurement'
                    : 'Save Procurement'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default AccessoryProcurementForm;
