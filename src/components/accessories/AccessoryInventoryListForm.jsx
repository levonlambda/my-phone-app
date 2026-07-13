import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ClipboardList,
  RefreshCw,
  Filter,
  Search,
  X,
  Edit,
  Save,
  AlertCircle,
  Check,
  Settings,
  Store
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  getAllAccessoryProducts,
  getAllAccessoryPricing,
  getAllAccessoryProcurements
} from '../../services/accessoryService';
import {
  getAllAccessoryInventory,
  composeInventoryId
} from '../../services/accessoryInventoryService';
import {
  getActiveLocations,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';
import AccessoryLocationModal from './AccessoryLocationModal';
import AccessoryAdjustmentConfirmModal from './AccessoryAdjustmentConfirmModal';

const LOW_STOCK_THRESHOLD = 5;
// Columns editable inline in the list. Reserved / Defective are hidden from
// the list view — adjust them via the Entry form.
const EDITABLE_FIELDS = ['onHand', 'onDisplay'];

// Pill-style color scheme shared with the Accessory Inventory Summary.
// Each count value is rendered inside a small rounded background badge whose
// color encodes the status.
const PILL_BASE =
  'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold';
const PILL_CLASS = {
  onHand: 'bg-blue-100 text-blue-800',
  onDisplay: 'bg-yellow-100 text-yellow-800',
  reserved: 'bg-gray-100 text-gray-700',
  defective: 'bg-red-100 text-red-800',
  sold: 'bg-purple-100 text-purple-800',
  pending: 'bg-orange-100 text-orange-800',
  available: 'bg-green-100 text-green-800'
};

const AccessoryInventoryListForm = () => {
  const { userRole, currentUser } = useAuth();
  const { editAccessoryInventoryItem } = useGlobalState();
  const isAdmin = userRole === 'admin';

  const [products, setProducts] = useState([]);
  const [inventoryDocs, setInventoryDocs] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [pendingMap, setPendingMap] = useState({}); // "<sku>::<locId>" -> qty
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [filters, setFilters] = useState({
    locationId: '',
    category: '',
    manufacturer: '',
    model: '',
    stockStatus: 'all',
    activeStatus: 'active',
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(true);

  const [sortField, setSortField] = useState('model');
  const [sortDirection, setSortDirection] = useState('asc');

  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const [editingRowKey, setEditingRowKey] = useState(null);
  const [editDraft, setEditDraft] = useState({ onHand: '', onDisplay: '' });
  const [savingRowKey, setSavingRowKey] = useState(null);
  const [confirmContext, setConfirmContext] = useState(null);

  /* ========== DATA LOAD ========== */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDefaultLocationIfEmpty();
      const [productsRes, inventoryRes, pricingRes, locationsRes, procurementsRes] =
        await Promise.all([
          getAllAccessoryProducts(),
          getAllAccessoryInventory(),
          getAllAccessoryPricing(),
          getActiveLocations(),
          getAllAccessoryProcurements()
        ]);

      if (!productsRes.success) {
        setError(productsRes.error || 'Failed to load products');
        return;
      }
      setProducts(productsRes.products || []);
      setInventoryDocs(inventoryRes.success ? inventoryRes.inventory || [] : []);

      const priceMap = {};
      if (pricingRes.success) {
        (pricingRes.pricing || []).forEach((p) => {
          priceMap[p.id] = { dealersPrice: p.dealersPrice, retailPrice: p.retailPrice };
        });
      }
      setPricingMap(priceMap);

      // Build pendingMap from unreceived procurements that carry a destinationLocationId.
      // Procurements missing that field (e.g., from before Phase 5 wires it up) simply
      // don't contribute to Pending — the column stays at 0 for those rows.
      const pMap = {};
      if (procurementsRes.success) {
        (procurementsRes.procurements || []).forEach((proc) => {
          if (proc.isReceived) return;
          const destLocId = proc.destinationLocationId;
          if (!destLocId) return;
          (proc.items || []).forEach((item) => {
            if (!item.internalSku) return;
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) return;
            const key = `${item.internalSku}::${destLocId}`;
            pMap[key] = (pMap[key] || 0) + qty;
          });
        });
      }
      setPendingMap(pMap);

      if (locationsRes.success) {
        setLocations(locationsRes.locations || []);
        setFilters((prev) => {
          if (prev.locationId) return prev;
          const primary =
            (locationsRes.locations || []).find((l) => l.isPrimary) ||
            (locationsRes.locations || [])[0];
          return primary ? { ...prev, locationId: primary.id } : prev;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ========== DERIVED ========== */

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const sku = p.internalSku || p.id;
      map[sku] = p;
    });
    return map;
  }, [products]);

  // Cascading filter sources: each level narrows based on the levels above.
  const filteredProductsForFilters = useMemo(() => {
    let list = products;
    if (filters.category) list = list.filter((p) => p.category === filters.category);
    if (filters.manufacturer) list = list.filter((p) => p.manufacturer === filters.manufacturer);
    return list;
  }, [products, filters.category, filters.manufacturer]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const manufacturers = useMemo(() => {
    const source = filters.category
      ? products.filter((p) => p.category === filters.category)
      : products;
    const set = new Set(source.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [products, filters.category]);

  const models = useMemo(() => {
    const set = new Set(filteredProductsForFilters.map((p) => p.model).filter(Boolean));
    return Array.from(set).sort();
  }, [filteredProductsForFilters]);

  const rows = useMemo(() => {
    const locNameById = {};
    locations.forEach((l) => {
      locNameById[l.id] = l.name;
    });

    const pendingFor = (sku, locId) => pendingMap[`${sku}::${locId}`] || 0;

    // Which stores to iterate:
    //   - If a specific store is selected, only that one
    //   - Otherwise, all active stores
    const storesToIterate = filters.locationId
      ? locations.filter((l) => l.id === filters.locationId)
      : locations.filter((l) => l.active !== false);

    // Fast lookup of inventory docs by composite doc ID
    const invByComposite = {};
    inventoryDocs.forEach((inv) => {
      invByComposite[inv.id] = inv;
    });

    // Cross-join every product with every in-scope store. This guarantees a row
    // per (product, store) pair even when the inventory doc doesn't exist yet —
    // which is why the specific-store view already worked.
    const rowByKey = new Map();
    products.forEach((p) => {
      const sku = p.internalSku || p.id;
      storesToIterate.forEach((loc) => {
        const compositeId = composeInventoryId(sku, loc.id);
        const inv = invByComposite[compositeId] || {};
        const rowKey = `${sku}__${loc.id}`;
        rowByKey.set(
          rowKey,
          buildRow(
            sku,
            p,
            loc.id,
            loc.name,
            inv,
            pricingMap[sku] || {},
            pendingFor(sku, loc.id)
          )
        );
      });
    });

    // Surface any orphaned inventory doc whose product or store no longer
    // exists, so the data is visible rather than silently dropped.
    inventoryDocs.forEach((inv) => {
      let sku = inv.sku;
      let locationId = inv.locationId;
      if ((!sku || !locationId) && typeof inv.id === 'string' && inv.id.includes('__')) {
        const parts = inv.id.split('__');
        if (!sku) sku = parts[0];
        if (!locationId) locationId = parts[1];
      }
      if (!sku || !locationId) return;
      if (filters.locationId && locationId !== filters.locationId) return;
      const rowKey = `${sku}__${locationId}`;
      if (rowByKey.has(rowKey)) return;
      const product = productMap[sku] || {
        manufacturer: '(missing product)',
        model: `(SKU: ${sku})`,
        category: '',
        active: true
      };
      const locName = inv.locationName || locNameById[locationId] || locationId || '';
      rowByKey.set(
        rowKey,
        buildRow(
          sku,
          product,
          locationId,
          locName,
          inv,
          pricingMap[sku] || {},
          pendingFor(sku, locationId)
        )
      );
    });

    // Pending-only (sku, locationId) pairs not already represented.
    Object.keys(pendingMap).forEach((key) => {
      const [sku, locationId] = key.split('::');
      if (filters.locationId && locationId !== filters.locationId) return;
      const rowKey = `${sku}__${locationId}`;
      if (rowByKey.has(rowKey)) return;
      const product = productMap[sku];
      if (!product) return;
      const locName = locNameById[locationId] || locationId || '';
      rowByKey.set(
        rowKey,
        buildRow(
          sku,
          product,
          locationId,
          locName,
          {},
          pricingMap[sku] || {},
          pendingFor(sku, locationId)
        )
      );
    });

    let baseRows = Array.from(rowByKey.values());

    // Filters
    let result = baseRows;
    if (filters.category) result = result.filter((r) => r.category === filters.category);
    if (filters.manufacturer) result = result.filter((r) => r.manufacturer === filters.manufacturer);
    if (filters.model) result = result.filter((r) => r.model === filters.model);
    if (filters.activeStatus === 'active') result = result.filter((r) => r.active);
    else if (filters.activeStatus === 'inactive') result = result.filter((r) => !r.active);

    if (filters.stockStatus === 'in-stock') result = result.filter((r) => r.onHand > 0);
    else if (filters.stockStatus === 'out-of-stock') result = result.filter((r) => r.onHand === 0);
    else if (filters.stockStatus === 'low-stock')
      result = result.filter((r) => r.onHand > 0 && r.onHand <= LOW_STOCK_THRESHOLD);

    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.sku.toLowerCase().includes(s) ||
          (r.barcode || '').toLowerCase().includes(s) ||
          r.manufacturer.toLowerCase().includes(s) ||
          r.model.toLowerCase().includes(s) ||
          r.category.toLowerCase().includes(s) ||
          r.tags.join(' ').toLowerCase().includes(s) ||
          (r.locationName || '').toLowerCase().includes(s)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal || '').localeCompare(String(bVal || ''));
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    products,
    inventoryDocs,
    productMap,
    pricingMap,
    pendingMap,
    locations,
    filters,
    sortField,
    sortDirection
  ]);

  const totalProductsVisible = useMemo(() => {
    if (filters.locationId) return products.length;
    const skus = new Set();
    inventoryDocs.forEach((i) => {
      if (i.sku) skus.add(i.sku);
    });
    Object.keys(pendingMap).forEach((k) => skus.add(k.split('::')[0]));
    return skus.size;
  }, [filters.locationId, products, inventoryDocs, pendingMap]);

  /* ========== HANDLERS ========== */

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      // Cascading: clear dependent filters when a parent changes.
      if (name === 'category') {
        next.manufacturer = '';
        next.model = '';
      } else if (name === 'manufacturer') {
        next.model = '';
      }
      return next;
    });
  };

  const clearFilters = () => {
    const primary = locations.find((l) => l.isPrimary) || locations[0];
    setFilters({
      locationId: primary?.id || '',
      category: '',
      manufacturer: '',
      model: '',
      stockStatus: 'all',
      activeStatus: 'active',
      searchTerm: ''
    });
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startEdit = (row) => {
    setEditingRowKey(row.rowKey);
    setEditDraft({
      onHand: String(row.onHand || 0),
      onDisplay: String(row.onDisplay || 0)
    });
    setError(null);
    setSuccessMessage('');
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setEditDraft({ onHand: '', onDisplay: '' });
  };

  const handleDraftChange = (field, rawValue) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    setEditDraft((prev) => ({ ...prev, [field]: cleaned }));
  };

  const saveEdit = (row) => {
    setError(null);
    setSuccessMessage('');

    const payload = {};
    for (const f of EDITABLE_FIELDS) {
      const desired = parseInt(editDraft[f], 10);
      if (!Number.isFinite(desired) || desired < 0) {
        setError(`${f} must be a non-negative integer`);
        return;
      }
      const delta = desired - (row[f] || 0);
      if (delta !== 0) payload[f] = delta;
    }
    if (Object.keys(payload).length === 0) {
      setEditingRowKey(null);
      return;
    }

    setConfirmContext({
      rowKey: row.rowKey,
      sku: row.sku,
      locationId: row.locationId,
      locationName: row.locationName,
      productLabel: `${row.manufacturer || ''} ${row.model || ''}`.trim() || row.sku,
      before: {
        onHand: row.onHand || 0,
        onDisplay: row.onDisplay || 0,
        reserved: row.reserved || 0,
        defective: row.defective || 0
      },
      adjustments: payload
    });
  };

  const handleConfirmSuccess = async () => {
    const sku = confirmContext?.sku;
    const locationName = confirmContext?.locationName;
    setConfirmContext(null);
    setEditingRowKey(null);
    setEditDraft({ onHand: '', onDisplay: '' });
    setSavingRowKey(null);
    if (sku) {
      setSuccessMessage(`Inventory updated for ${sku} at ${locationName || 'selected store'}`);
    }
    await loadData();
  };

  const handleOpenEntry = (row) => {
    editAccessoryInventoryItem({
      id: row.sku,
      internalSku: row.sku,
      locationId: row.locationId
    });
  };

  /* ========== RENDER ========== */

  const renderPrice = (val) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-400 italic">not set</span>;
    }
    return <span>{formatNumberWithCommas(String(val))}</span>;
  };

  const sortCaret = (field) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1600px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Inventory</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <Settings className="h-5 w-5 mr-1" />
              <span>Stores</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 ${
                showFilters ? 'bg-white/20 text-white' : 'bg-white text-[rgb(52,69,157)]'
              } px-4 py-2 rounded text-base font-medium`}
            >
              <Filter className="h-5 w-5 mr-1" />
              <span>Filters</span>
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <RefreshCw className="h-5 w-5 mr-1" />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {error && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-red-500 flex items-center"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Store className="h-4 w-4 inline mr-1" />
                    Store
                  </label>
                  <select
                    name="locationId"
                    value={filters.locationId}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">All Stores</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.isPrimary ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <select
                    name="manufacturer"
                    value={filters.manufacturer}
                    onChange={handleFilterChange}
                    disabled={manufacturers.length === 0}
                    className="w-full p-2 border rounded disabled:bg-gray-100"
                  >
                    <option value="">All Manufacturers</option>
                    {manufacturers.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select
                    name="model"
                    value={filters.model}
                    onChange={handleFilterChange}
                    disabled={!filters.manufacturer || models.length === 0}
                    title={!filters.manufacturer ? 'Select a manufacturer first' : ''}
                    className="w-full p-2 border rounded disabled:bg-gray-100"
                  >
                    <option value="">All Models</option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                  <select
                    name="stockStatus"
                    value={filters.stockStatus}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="all">All Stock Levels</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock (≤ {LOW_STOCK_THRESHOLD})</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                  <select
                    name="activeStatus"
                    value={filters.activeStatus}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="all">All</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="searchTerm"
                      value={filters.searchTerm}
                      onChange={handleFilterChange}
                      placeholder="SKU, barcode, model, tags, store…"
                      className="w-full p-2 pl-9 border rounded"
                    />
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
              {!filters.locationId && (
                <p className="mt-3 text-xs text-gray-600">
                  Showing rows across all stores (one row per (product, store) pair). Pick a store
                  above to narrow to a single location.
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading inventory…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No products yet</h3>
              <p className="text-gray-500">
                Add accessory products first — inventory rows appear here for every (product,
                store) pair.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matching rows</h3>
              <p className="text-gray-500 mb-4">Try adjusting your filters.</p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('sku')}
                    >
                      SKU {sortCaret('sku')}
                    </th>
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('barcode')}
                    >
                      Barcode {sortCaret('barcode')}
                    </th>
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('manufacturer')}
                    >
                      Manufacturer {sortCaret('manufacturer')}
                    </th>
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('model')}
                    >
                      Model {sortCaret('model')}
                    </th>
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('category')}
                    >
                      Category {sortCaret('category')}
                    </th>
                    <th className="border px-3 py-2 text-left">Tags</th>
                    <th
                      className="border px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('locationName')}
                    >
                      Store {sortCaret('locationName')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('sold')}
                    >
                      Sold {sortCaret('sold')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('onDisplay')}
                    >
                      Display {sortCaret('onDisplay')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('onHand')}
                    >
                      Stock {sortCaret('onHand')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('reserved')}
                    >
                      Reserved {sortCaret('reserved')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('available')}
                    >
                      Available {sortCaret('available')}
                    </th>
                    <th
                      className="border px-3 py-2 text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort('pending')}
                    >
                      Pending {sortCaret('pending')}
                    </th>
                    <th className="border px-3 py-2 text-right">Retail Price</th>
                    {isAdmin && <th className="border px-3 py-2 text-right">Dealer Price</th>}
                    <th className="border px-3 py-2 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isEditing = editingRowKey === row.rowKey;
                    const isSaving = savingRowKey === row.rowKey;

                    return (
                      <tr
                        key={row.rowKey}
                        className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      >
                        <td className="border px-3 py-2">{row.sku}</td>
                        <td className="border px-3 py-2">{row.barcode || '-'}</td>
                        <td className="border px-3 py-2">{row.manufacturer || '-'}</td>
                        <td className="border px-3 py-2 font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{row.model || '-'}</span>
                            {!row.active && (
                              <span className="inline-block px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">
                                Inactive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border px-3 py-2">{row.category || '-'}</td>
                        <td className="border px-3 py-2 text-gray-600">
                          {row.tags.length > 0 ? row.tags.join(', ') : '-'}
                        </td>
                        <td className="border px-3 py-2">{row.locationName || '-'}</td>

                        <td className="border px-3 py-2 text-center">
                          <span className={`${PILL_BASE} ${PILL_CLASS.sold}`}>{row.sold}</span>
                        </td>
                        <td className="border px-3 py-2 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editDraft.onDisplay}
                              onChange={(e) => handleDraftChange('onDisplay', e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-right"
                            />
                          ) : (
                            <span className={`${PILL_BASE} ${PILL_CLASS.onDisplay}`}>
                              {row.onDisplay}
                            </span>
                          )}
                        </td>
                        <td className="border px-3 py-2 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editDraft.onHand}
                              onChange={(e) => handleDraftChange('onHand', e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-right"
                            />
                          ) : (
                            <span className={`${PILL_BASE} ${PILL_CLASS.onHand}`}>
                              {row.onHand}
                            </span>
                          )}
                        </td>
                        <td className="border px-3 py-2 text-center">
                          <span className={`${PILL_BASE} ${PILL_CLASS.reserved}`}>
                            {row.reserved}
                          </span>
                        </td>
                        <td className="border px-3 py-2 text-center">
                          <span className={`${PILL_BASE} ${PILL_CLASS.available}`}>
                            {row.available}
                          </span>
                        </td>
                        <td className="border px-3 py-2 text-center">
                          <span className={`${PILL_BASE} ${PILL_CLASS.pending}`}>{row.pending}</span>
                        </td>
                        <td className="border px-3 py-2 text-right">{renderPrice(row.retailPrice)}</td>
                        {isAdmin && (
                          <td className="border px-3 py-2 text-right">
                            {renderPrice(row.dealersPrice)}
                          </td>
                        )}
                        <td className="border px-3 py-2 text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => saveEdit(row)}
                                disabled={isSaving}
                                className="p-1 text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                                title="Save"
                              >
                                {isSaving ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={!row.active}
                                className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title={row.active ? 'Edit inventory' : 'Inactive product — cannot edit'}
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEntry(row)}
                                disabled={!row.active}
                                className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Open in Entry form"
                              >
                                <ClipboardList className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-4 flex justify-between items-center text-gray-600 text-sm">
                <div>
                  Showing {rows.length} row{rows.length !== 1 ? 's' : ''}
                  {filters.locationId ? ' (single store)' : ' (across all stores)'}
                  {' · '}
                  {totalProductsVisible} product{totalProductsVisible !== 1 ? 's' : ''} in scope
                </div>
                <div className="text-xs text-gray-500">
                  Low stock threshold: {LOW_STOCK_THRESHOLD}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AccessoryLocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onLocationsChanged={loadData}
      />

      <AccessoryAdjustmentConfirmModal
        isOpen={Boolean(confirmContext)}
        sku={confirmContext?.sku}
        locationId={confirmContext?.locationId}
        locationName={confirmContext?.locationName}
        productLabel={confirmContext?.productLabel}
        before={confirmContext?.before}
        adjustments={confirmContext?.adjustments}
        userId={currentUser?.uid || null}
        userEmail={currentUser?.email || null}
        source="inventory-list-edit"
        onClose={() => setConfirmContext(null)}
        onSuccess={handleConfirmSuccess}
      />
    </div>
  );
};

/**
 * Build a single table row from a product + (optional) inventory doc.
 */
function buildRow(sku, product, locationId, locationName, inv, price, pending = 0) {
  const onHand = inv.onHand || 0;
  const onDisplay = inv.onDisplay || 0;
  const reserved = inv.reserved || 0;
  const defective = inv.defective || 0;
  const sold = inv.sold || 0;
  const available = onHand + onDisplay - (reserved + defective);
  return {
    rowKey: `${sku}__${locationId}`,
    sku,
    barcode: product.barcode || '',
    locationId,
    locationName: inv.locationName || locationName || '',
    manufacturer: product.manufacturer || '',
    model: product.model || '',
    category: product.category || '',
    tags: Array.isArray(product.tags) ? product.tags : [],
    active: product.active !== false,
    onHand,
    onDisplay,
    reserved,
    defective,
    sold,
    pending,
    available,
    retailPrice: price.retailPrice,
    dealersPrice: price.dealersPrice,
    hasInventoryDoc: Boolean(inv.sku || inv.locationId)
  };
}

export default AccessoryInventoryListForm;
