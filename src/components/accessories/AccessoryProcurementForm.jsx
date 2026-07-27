import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShoppingCart,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { getAllSuppliers } from '../../services/supplierService';
import {
  getAllAccessoryProducts,
  getAllAccessoryPricing,
  createAccessoryProcurement,
  updateAccessoryProcurement,
  markAccessoryProcurementPaid,
  setAccessoryPricing
} from '../../services/accessoryService';
import {
  formatNumberWithCommas,
  parsePrice
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
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [refsError, setRefsError] = useState(null);

  /* ========== PROCUREMENT CONTEXT ========== */

  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountPayable, setAccountPayable] = useState('');

  const [isPaid, setIsPaid] = useState(false);
  const [datePaid, setDatePaid] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const [isReceived, setIsReceived] = useState(false);
  const [dateDelivered, setDateDelivered] = useState('');

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
  const [pickerRetailPrice, setPickerRetailPrice] = useState('');
  const [pickerBarcode, setPickerBarcode] = useState('');

  /* ========== UI ========== */

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  /* ========== LOADERS ========== */

  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    setRefsError(null);
    try {
      const [productsRes, pricingRes, suppliersRes] = await Promise.all([
        getAllAccessoryProducts(),
        getAllAccessoryPricing(),
        getAllSuppliers()
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
      setBankName(p.bankName || '');
      setBankAccount(p.bankAccount || '');
      setAccountPayable(p.accountPayable || '');
      setIsPaid(Boolean(p.isPaid));
      setDatePaid(p.datePaid || '');
      setPaymentReference(p.paymentReference || '');
      setIsReceived(Boolean(p.isReceived));
      setDateDelivered(p.dateDelivered || '');
      setItems(
        (p.items || []).map((item) => ({
          id: nextItemId(),
          internalSku: item.internalSku,
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          category: item.category || '',
          quantity: Number(item.quantity) || 0,
          dealersPrice: Number(item.dealersPrice) || 0,
          retailPrice: Number(item.retailPrice) || 0,
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
    setBankName('');
    setBankAccount('');
    setAccountPayable('');
    setIsPaid(false);
    setDatePaid('');
    setPaymentReference('');
    setIsReceived(false);
    setDateDelivered('');
    setItems([]);
    setPickerFilters({ category: '', manufacturer: '', model: '' });
    setPickerSku('');
    setPickerQuantity('1');
    setPickerDealersPrice('');
    setPickerRetailPrice('');
    setPickerBarcode('');
    setSaveError(null);
    setSuccessMessage('');
  };

  /* ========== CASCADING PICKER FILTERS ========== */

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  const pickerManufacturers = useMemo(() => {
    const set = new Set(activeProducts.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts]);

  const pickerCategories = useMemo(() => {
    const source = pickerFilters.manufacturer
      ? activeProducts.filter((p) => p.manufacturer === pickerFilters.manufacturer)
      : activeProducts;
    const set = new Set(source.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, pickerFilters.manufacturer]);

  const pickerModels = useMemo(() => {
    let source = activeProducts;
    if (pickerFilters.category) source = source.filter((p) => p.category === pickerFilters.category);
    if (pickerFilters.manufacturer)
      source = source.filter((p) => p.manufacturer === pickerFilters.manufacturer);
    const set = new Set(source.map((p) => p.model).filter(Boolean));
    return Array.from(set).sort();
  }, [activeProducts, pickerFilters.category, pickerFilters.manufacturer]);

  const pickerKeyword = pickerBarcode.trim().toLowerCase();

  const pickerProductOptions = useMemo(() => {
    let list = activeProducts;
    if (pickerFilters.category) list = list.filter((p) => p.category === pickerFilters.category);
    if (pickerFilters.manufacturer)
      list = list.filter((p) => p.manufacturer === pickerFilters.manufacturer);
    if (pickerFilters.model) list = list.filter((p) => p.model === pickerFilters.model);
    // The barcode/SKU/keyword input live-filters the dropdown
    if (pickerKeyword) {
      list = list.filter((p) => {
        const sku = (p.internalSku || p.id || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        const model = (p.model || '').toLowerCase();
        const shortDesc = (p.shortDescription || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        return (
          sku.includes(pickerKeyword) ||
          barcode.includes(pickerKeyword) ||
          model.includes(pickerKeyword) ||
          shortDesc.includes(pickerKeyword) ||
          tags.includes(pickerKeyword)
        );
      });
    }
    return list
      .slice()
      .sort((a, b) => {
        const m = (a.manufacturer || '').localeCompare(b.manufacturer || '');
        if (m !== 0) return m;
        return (a.model || '').localeCompare(b.model || '');
      });
  }, [activeProducts, pickerFilters, pickerKeyword]);

  // Exact barcode or SKU match auto-selects the product and clears the input
  // (covers the scanner workflow: scan → selected → ready for the next scan)
  useEffect(() => {
    const code = pickerBarcode.trim().toUpperCase();
    if (!code) return;
    const exact = activeProducts.filter((p) => {
      const sku = (p.internalSku || p.id || '').toUpperCase();
      const barcode = (p.barcode || '').toUpperCase();
      return sku === code || barcode === code;
    });
    if (exact.length === 1) {
      setPickerSku(exact[0].internalSku || exact[0].id);
      setPickerBarcode('');
    }
  }, [pickerBarcode, activeProducts]);

  const pickerSelectedProduct = useMemo(() => {
    if (!pickerSku) return null;
    return products.find((p) => (p.internalSku || p.id) === pickerSku) || null;
  }, [pickerSku, products]);

  // When a SKU is selected, default both prices from pricingMap
  useEffect(() => {
    if (!pickerSku) {
      setPickerDealersPrice('');
      setPickerRetailPrice('');
      return;
    }
    const pricing = pricingMap[pickerSku];
    if (pricing && pricing.dealersPrice) {
      setPickerDealersPrice(formatNumberWithCommas(String(pricing.dealersPrice)));
    } else {
      setPickerDealersPrice('');
    }
    if (pricing && pricing.retailPrice) {
      setPickerRetailPrice(formatNumberWithCommas(String(pricing.retailPrice)));
    } else {
      setPickerRetailPrice('');
    }
  }, [pickerSku, pricingMap]);

  /* ========== HANDLERS ========== */

  const handlePickerFilterChange = (name, value) => {
    setPickerFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'manufacturer') {
        next.category = '';
        next.model = '';
      } else if (name === 'category') {
        next.model = '';
      }
      return next;
    });
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
    if (price <= 0) {
      setSaveError('Dealer price must be greater than zero');
      return;
    }
    const retail = parseFloat(parsePrice(pickerRetailPrice)) || 0;
    if (retail <= 0) {
      setSaveError('Retail price must be greater than zero');
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
          retailPrice: retail,
          totalPrice: qty * price
        }
      ]);
    }
    // Reset picker
    setPickerSku('');
    setPickerQuantity('1');
    setPickerDealersPrice('');
    setPickerRetailPrice('');
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

    const invalidItem = items.find(
      (it) => !(it.dealersPrice > 0) || !(it.retailPrice > 0)
    );
    if (invalidItem) {
      setSaveError(
        `Dealer and Retail prices must be greater than zero for "${
          invalidItem.model || invalidItem.internalSku
        }". Edit or remove the item before saving.`
      );
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);

    const payload = {
      supplierId: selectedSupplierId,
      supplierName: supplier?.supplierName || '',
      purchaseDate,
      items: items.map((it) => ({
        internalSku: it.internalSku,
        manufacturer: it.manufacturer,
        model: it.model,
        category: it.category,
        quantity: it.quantity,
        dealersPrice: it.dealersPrice,
        retailPrice: it.retailPrice || 0,
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
        // Push the dealer/retail prices used in this procurement into the
        // accessory_pricing collection so the catalog stays in sync. Errors
        // are logged but don't block the success flow — the procurement is
        // already saved.
        await Promise.all(
          items.map(async (it) => {
            try {
              await setAccessoryPricing(it.internalSku, {
                dealersPrice: it.dealersPrice,
                retailPrice: it.retailPrice || 0
              });
            } catch (priceErr) {
              console.error(`Failed to update pricing for ${it.internalSku}:`, priceErr);
            }
          })
        );

        setSuccessMessage(
          isEditing
            ? 'Procurement updated successfully · prices synced to catalog'
            : `Procurement created successfully (${res.reference || ''}) · prices synced to catalog`
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

            {/* Procurement Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Procurement Details</h3>

              {/* First Row: Purchase Date, Supplier, Bank Name, Bank Account, Account Payable */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Purchase Date:
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={coreFieldsDisabled}
                    required
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Supplier:
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={coreFieldsDisabled || loadingRefs}
                    required
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName || s.name || s.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Bank Name:
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank name"
                    disabled
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Bank Account:
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Account number"
                    disabled
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Account Payable:
                  </label>
                  <input
                    type="text"
                    value={accountPayable}
                    onChange={(e) => setAccountPayable(e.target.value)}
                    placeholder="Payable amount"
                    disabled
                    className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              {/* Second Row: Payment Status, Date Paid, Payment Reference, Delivery Status, Date Delivered */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Payment Status:
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
                    disabled={!isPaymentMode}
                    className={`w-full p-2 border rounded text-sm h-10 font-medium ${
                      isPaymentMode
                        ? isPaid
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Date Paid:
                  </label>
                  <input
                    type="date"
                    value={datePaid}
                    onChange={(e) => setDatePaid(e.target.value)}
                    disabled={!isPaymentMode || !isPaid}
                    className={`w-full p-2 border rounded text-sm h-10 ${
                      isPaymentMode && isPaid
                        ? 'bg-white text-black'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Payment Reference:
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Auto-generated if blank"
                    disabled={!isPaymentMode || !isPaid}
                    className={`w-full p-2 border rounded text-sm h-10 ${
                      isPaymentMode && isPaid
                        ? 'bg-white text-black'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Delivery Status:
                  </label>
                  <input
                    type="text"
                    value={isReceived ? 'Delivered' : 'Pending'}
                    disabled
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                    Date Delivered:
                  </label>
                  <input
                    type="date"
                    value={dateDelivered}
                    disabled
                    className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Section: Add Accessories to Procurement */}
            {!isPaymentMode && !isReadOnly && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                  Add Accessories to Procurement
                </h3>

                {/* Row 1: Manufacturer, Category, Model */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Manufacturer:
                    </label>
                    <select
                      value={pickerFilters.manufacturer}
                      onChange={(e) => handlePickerFilterChange('manufacturer', e.target.value)}
                      disabled={pickerManufacturers.length === 0}
                      className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">-- All Manufacturers --</option>
                      {pickerManufacturers.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Category:
                    </label>
                    <select
                      value={pickerFilters.category}
                      onChange={(e) => handlePickerFilterChange('category', e.target.value)}
                      disabled={!pickerFilters.manufacturer || pickerCategories.length === 0}
                      className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">-- All Categories --</option>
                      {pickerCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Model:
                    </label>
                    <select
                      value={pickerFilters.model}
                      onChange={(e) => handlePickerFilterChange('model', e.target.value)}
                      disabled={!pickerFilters.category || pickerModels.length === 0}
                      className="w-full p-2 border rounded text-sm h-10 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">-- All Models --</option>
                      {pickerModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Product picker + Barcode lookup */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8 space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      <Search className="h-3.5 w-3.5 inline mr-1" />
                      Select Product:
                    </label>
                    <select
                      value={pickerSku}
                      onChange={(e) => setPickerSku(e.target.value)}
                      className="w-full p-2 border rounded text-sm h-10"
                    >
                      <option value="">
                        {activeProducts.length === 0
                          ? '-- No active products --'
                          : pickerProductOptions.length === 0
                          ? '-- No products match the current filters --'
                          : pickerKeyword ||
                            pickerFilters.category ||
                            pickerFilters.manufacturer ||
                            pickerFilters.model
                          ? `-- Select a product (${pickerProductOptions.length} of ${activeProducts.length} matching) --`
                          : `-- Select a product (${activeProducts.length} active) --`}
                      </option>
                      {pickerProductOptions.map((p) => {
                        const sku = p.internalSku || p.id;
                        return (
                          <option key={sku} value={sku}>
                            {p.manufacturer} —{' '}
                            {p.shortDescription ? `${p.shortDescription} — ` : ''}
                            {p.model} [{sku}]
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="md:col-span-4 space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      <Barcode className="h-3.5 w-3.5 inline mr-1" />
                      Or Barcode / SKU / Keyword:
                    </label>
                    <input
                      type="text"
                      value={pickerBarcode}
                      onChange={(e) => setPickerBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // Enter picks the only remaining product, if any
                          if (pickerProductOptions.length === 1) {
                            const p = pickerProductOptions[0];
                            setPickerSku(p.internalSku || p.id);
                            setPickerBarcode('');
                          }
                        }
                      }}
                      placeholder="Scan or type to filter"
                      className="w-full px-2 py-2 border rounded text-sm h-10"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Typing filters the product dropdown. An exact barcode or SKU selects it
                      automatically.
                    </p>
                  </div>
                </div>

                {/* Row 3: Quantity, Dealer Price, Retail Price, Total Price, Margin + Action */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Quantity */}
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Quantity:
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPickerQuantity((q) =>
                            String(Math.max(1, (parseInt(q, 10) || 1) - 1))
                          )
                        }
                        disabled={(parseInt(pickerQuantity, 10) || 1) <= 1}
                        className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={pickerQuantity}
                        onChange={(e) =>
                          setPickerQuantity(e.target.value.replace(/[^\d]/g, ''))
                        }
                        className="w-full p-2 border rounded text-center text-sm h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPickerQuantity((q) =>
                            String((parseInt(q, 10) || 0) + 1)
                          )
                        }
                        className="w-10 h-10 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Dealer Price */}
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Dealer&apos;s Price:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                      <input
                        type="text"
                        value={pickerDealersPrice}
                        onChange={(e) =>
                          setPickerDealersPrice(formatNumberWithCommas(e.target.value))
                        }
                        className="w-full p-2 pl-6 border rounded text-sm h-10"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Retail Price */}
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Retail Price:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                      <input
                        type="text"
                        value={pickerRetailPrice}
                        onChange={(e) =>
                          setPickerRetailPrice(formatNumberWithCommas(e.target.value))
                        }
                        className="w-full p-2 pl-6 border rounded text-sm h-10"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Total Price (auto) */}
                  <div className="space-y-2">
                    <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                      Total Price:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                      <input
                        type="text"
                        value={formatNumberWithCommas(
                          (
                            (parseFloat(parsePrice(pickerDealersPrice)) || 0) *
                            (parseInt(pickerQuantity, 10) || 0)
                          ).toFixed(2)
                        )}
                        disabled
                        readOnly
                        className="w-full p-2 pl-6 border rounded text-sm h-10 bg-gray-100 text-gray-500"
                      />
                    </div>
                  </div>

                  {/* Margin + Add */}
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                        Margin:
                      </label>
                      <input
                        type="text"
                        value={(() => {
                          const d = parseFloat(parsePrice(pickerDealersPrice)) || 0;
                          const r = parseFloat(parsePrice(pickerRetailPrice)) || 0;
                          if (!d) return '0.00%';
                          return `${(((r - d) / d) * 100).toFixed(2)}%`;
                        })()}
                        disabled
                        readOnly
                        className="w-full p-2 border rounded text-sm h-10 bg-gray-100 text-gray-500 text-center"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="block text-[rgb(52,69,157)] font-semibold text-sm">
                        Action:
                      </label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!pickerSku}
                        className="w-full h-10 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section: Procurement List */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                  Procurement List ({items.length} item{items.length !== 1 ? 's' : ''})
                </h3>
                {items.length > 0 && !isReadOnly && !isPaymentMode && (
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-lg font-medium">No items in procurement list</p>
                  <p className="text-sm">Add accessories using the form above</p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-3 text-left font-semibold w-[14%]">SKU</th>
                        <th className="border px-3 py-3 text-left font-semibold w-[9%]">Manufacturer</th>
                        <th className="border px-3 py-3 text-left font-semibold w-[19%]">Model</th>
                        <th className="border px-3 py-3 text-left font-semibold w-[10%]">Category</th>
                        <th className="border px-3 py-3 text-center font-semibold w-[10%]">Qty</th>
                        <th className="border px-3 py-3 text-right font-semibold w-[12%]">Dealer&apos;s Price</th>
                        <th className="border px-3 py-3 text-right font-semibold w-[12%]">Retail Price</th>
                        <th className="border px-3 py-3 text-right font-semibold w-[14%]">Total Price</th>
                        {!isReadOnly && !isPaymentMode && (
                          <th className="border px-3 py-3 text-center font-semibold w-10"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-left whitespace-nowrap">{it.internalSku}</td>
                          <td className="border px-3 py-2 text-left">{it.manufacturer || '-'}</td>
                          <td className="border px-3 py-2 text-left">{it.model || '-'}</td>
                          <td className="border px-3 py-2 text-left">{it.category || '-'}</td>
                          <td className="border px-3 py-2 text-center">
                            {isReadOnly || isPaymentMode ? (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium min-w-[2rem] text-center">
                                {it.quantity}
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleChangeItemQuantity(it.id, -1)}
                                  className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs"
                                  title={it.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium min-w-[2rem] text-center">
                                  {it.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleChangeItemQuantity(it.id, 1)}
                                  className="w-6 h-6 border rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs"
                                  title="Increase quantity"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="border px-3 py-2 text-right font-mono">
                            ₱{formatNumberWithCommas(it.dealersPrice.toFixed(2))}
                          </td>
                          <td className="border px-3 py-2 text-right font-mono">
                            ₱{formatNumberWithCommas((it.retailPrice || 0).toFixed(2))}
                          </td>
                          <td className="border px-3 py-2 text-right font-mono font-medium">
                            ₱{formatNumberWithCommas(it.totalPrice.toFixed(2))}
                          </td>
                          {!isReadOnly && !isPaymentMode && (
                            <td className="border px-3 py-2 text-center">
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
                      <tr className="bg-blue-50 font-semibold">
                        <td colSpan="4" className="border px-3 py-2 text-right">
                          Total Items:
                        </td>
                        <td className="border px-3 py-2 text-center font-mono">
                          {totals.totalUnits}
                        </td>
                        <td colSpan="2" className="border px-3 py-2 text-right">
                          Grand Total:
                        </td>
                        <td className="border px-3 py-2 text-right font-mono text-lg">
                          ₱{formatNumberWithCommas(totals.grandTotal.toFixed(2))}
                        </td>
                        {!isReadOnly && !isPaymentMode && <td className="border"></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Procurement Summary Section */}
            {items.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Procurement Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Line Items</p>
                        <p className="text-xs text-gray-500">Different accessories ordered</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">{totals.totalItems}</p>
                        <p className="text-xs text-gray-500">items</p>
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
                        <p className="text-xl font-bold text-green-600">{totals.totalUnits}</p>
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
                          ₱{formatNumberWithCommas(totals.grandTotal.toFixed(2))}
                        </p>
                        <p className="text-xs text-gray-500">total cost</p>
                      </div>
                    </div>
                  </div>
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
