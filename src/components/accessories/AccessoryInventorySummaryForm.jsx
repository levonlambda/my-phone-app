import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LayoutDashboard,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  AlertCircle,
  CircleAlert,
  Store,
  Eye
} from 'lucide-react';
import AccessoryProductDetailModal from './AccessoryProductDetailModal';
import { useAuth } from '../../context/AuthContext';
import {
  getAllAccessoryProducts,
  getAllAccessoryPricing,
  getAllAccessoryProcurements
} from '../../services/accessoryService';
import { getAllAccessoryInventory } from '../../services/accessoryInventoryService';
import {
  getActiveLocations,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';
import {
  calculateMarkup,
  formatNumberWithCommas
} from '../phone-selection/utils/phoneUtils';

const PILL_BASE =
  'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold';
const PILL_CLASS = {
  sold: 'bg-purple-100 text-purple-800',
  onDisplay: 'bg-yellow-100 text-yellow-800',
  onHand: 'bg-blue-100 text-blue-800',
  available: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800'
};

const formatPrice = (val) => {
  if (val === null || val === undefined || val === '') return null;
  return `₱${formatNumberWithCommas(String(val))}`;
};

const calculateMargin = (dp, rp) => {
  const d = parseFloat(String(dp || 0).replace(/,/g, '')) || 0;
  const r = parseFloat(String(rp || 0).replace(/,/g, '')) || 0;
  if (d <= 0) return null;
  return `${calculateMarkup(String(d), String(r))}%`;
};

const AccessoryInventorySummaryForm = () => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  /* ========== DATA ========== */

  const [products, setProducts] = useState([]);
  const [inventoryDocs, setInventoryDocs] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [procurements, setProcurements] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedRows, setExpandedRows] = useState(new Set());

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    locationId: '',
    category: '',
    manufacturer: '',
    model: ''
  });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [inactiveListCollapsed, setInactiveListCollapsed] = useState(true);

  const [detailProduct, setDetailProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  /* ========== LOAD ========== */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDefaultLocationIfEmpty();
      const [productsRes, inventoryRes, pricingRes, procurementsRes, locationsRes] =
        await Promise.all([
          getAllAccessoryProducts(),
          getAllAccessoryInventory(),
          getAllAccessoryPricing(),
          getAllAccessoryProcurements(),
          getActiveLocations()
        ]);

      if (!productsRes.success) {
        setError(productsRes.error || 'Failed to load products');
        return;
      }
      setProducts(productsRes.products || []);
      setInventoryDocs(inventoryRes.success ? inventoryRes.inventory || [] : []);

      const pMap = {};
      if (pricingRes.success) {
        (pricingRes.pricing || []).forEach((p) => {
          pMap[p.id] = { dealersPrice: p.dealersPrice, retailPrice: p.retailPrice };
        });
      }
      setPricingMap(pMap);

      setProcurements(procurementsRes.success ? procurementsRes.procurements || [] : []);
      setLocations(locationsRes.success ? locationsRes.locations || [] : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ========== PENDING MAP ========== */

  const pendingMap = useMemo(() => {
    const m = {};
    procurements.forEach((proc) => {
      if (proc.isReceived) return;
      const destLocId = proc.destinationLocationId;
      if (!destLocId) return;
      (proc.items || []).forEach((item) => {
        if (!item.internalSku) return;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;
        const key = `${item.internalSku}::${destLocId}`;
        m[key] = (m[key] || 0) + qty;
      });
    });
    return m;
  }, [procurements]);

  /* ========== FILTER OPTIONS (cascading) ========== */

  const filterCategories = useMemo(() => {
    const source = products.filter((p) => includeInactive || p.active !== false);
    const set = new Set(source.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products, includeInactive]);

  const filterManufacturers = useMemo(() => {
    let source = products.filter((p) => includeInactive || p.active !== false);
    if (filters.category) source = source.filter((p) => p.category === filters.category);
    const set = new Set(source.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [products, includeInactive, filters.category]);

  const filterModels = useMemo(() => {
    let source = products.filter((p) => includeInactive || p.active !== false);
    if (filters.category) source = source.filter((p) => p.category === filters.category);
    if (filters.manufacturer)
      source = source.filter((p) => p.manufacturer === filters.manufacturer);
    const set = new Set(source.map((p) => p.model).filter(Boolean));
    return Array.from(set).sort();
  }, [products, includeInactive, filters.category, filters.manufacturer]);

  /* ========== ROWS ========== */

  const { rows } = useMemo(() => {
    const locNameById = {};
    locations.forEach((l) => {
      locNameById[l.id] = l.name;
    });

    // Scope inventory docs by store filter
    const invBySku = {};
    inventoryDocs.forEach((inv) => {
      if (!inv.sku) return;
      if (filters.locationId && inv.locationId !== filters.locationId) return;
      if (!invBySku[inv.sku]) invBySku[inv.sku] = [];
      invBySku[inv.sku].push(inv);
    });

    const pendingBySku = {};
    Object.keys(pendingMap).forEach((key) => {
      const [sku, locId] = key.split('::');
      if (filters.locationId && locId !== filters.locationId) return;
      if (!pendingBySku[sku]) pendingBySku[sku] = {};
      pendingBySku[sku][locId] = pendingMap[key];
    });

    // Filter products
    let filteredProducts = products.filter((p) => includeInactive || p.active !== false);
    if (filters.category)
      filteredProducts = filteredProducts.filter((p) => p.category === filters.category);
    if (filters.manufacturer)
      filteredProducts = filteredProducts.filter((p) => p.manufacturer === filters.manufacturer);
    if (filters.model)
      filteredProducts = filteredProducts.filter((p) => p.model === filters.model);

    const rowsArr = filteredProducts
      .map((p) => {
        const sku = p.internalSku || p.id;
        const invs = invBySku[sku] || [];
        const pendings = pendingBySku[sku] || {};
        const pricing = pricingMap[sku] || {};

        // Per-store breakdown = union of inventory stores + pending-only stores
        const storeMap = new Map();
        invs.forEach((inv) => {
          storeMap.set(inv.locationId, {
            locationId: inv.locationId,
            locationName: inv.locationName || locNameById[inv.locationId] || inv.locationId,
            sold: inv.sold || 0,
            onDisplay: inv.onDisplay || 0,
            onHand: inv.onHand || 0,
            reserved: inv.reserved || 0,
            defective: inv.defective || 0,
            pending: pendings[inv.locationId] || 0
          });
        });
        Object.keys(pendings).forEach((locId) => {
          if (!storeMap.has(locId)) {
            storeMap.set(locId, {
              locationId: locId,
              locationName: locNameById[locId] || locId,
              sold: 0,
              onDisplay: 0,
              onHand: 0,
              reserved: 0,
              defective: 0,
              pending: pendings[locId]
            });
          }
        });
        const perStore = Array.from(storeMap.values())
          .map((s) => ({
            ...s,
            available: s.onHand + s.onDisplay - (s.reserved + s.defective)
          }))
          .sort((a, b) => a.locationName.localeCompare(b.locationName));

        const totals = perStore.reduce(
          (acc, s) => ({
            sold: acc.sold + s.sold,
            onDisplay: acc.onDisplay + s.onDisplay,
            onHand: acc.onHand + s.onHand,
            available: acc.available + s.available,
            pending: acc.pending + s.pending
          }),
          { sold: 0, onDisplay: 0, onHand: 0, available: 0, pending: 0 }
        );

        return {
          sku,
          product: p,
          manufacturer: p.manufacturer || '',
          model: p.model || '',
          category: p.category || '',
          active: p.active !== false,
          photoUrl: p.photoUrl || '',
          dealersPrice: pricing.dealersPrice,
          retailPrice: pricing.retailPrice,
          totals,
          perStore
        };
      })
      .sort((a, b) => {
        const mfg = a.manufacturer.localeCompare(b.manufacturer);
        if (mfg !== 0) return mfg;
        return a.model.localeCompare(b.model);
      });

    const totals = rowsArr.reduce(
      (acc, r) => ({
        sold: acc.sold + r.totals.sold,
        onDisplay: acc.onDisplay + r.totals.onDisplay,
        onHand: acc.onHand + r.totals.onHand,
        available: acc.available + r.totals.available,
        pending: acc.pending + r.totals.pending
      }),
      { sold: 0, onDisplay: 0, onHand: 0, available: 0, pending: 0 }
    );

    return { rows: rowsArr, grandTotals: totals };
  }, [products, inventoryDocs, pricingMap, pendingMap, locations, filters, includeInactive]);

  /* ========== INACTIVE PRODUCTS INFO ========== */

  const inactiveProductsInfo = useMemo(() => {
    return products
      .filter((p) => p.active === false)
      .map((p) => ({ manufacturer: p.manufacturer, model: p.model }))
      .sort((a, b) => {
        const mfg = (a.manufacturer || '').localeCompare(b.manufacturer || '');
        if (mfg !== 0) return mfg;
        return (a.model || '').localeCompare(b.model || '');
      });
  }, [products]);

  /* ========== HANDLERS ========== */

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
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

  const clearFilters = () =>
    setFilters({ locationId: '', category: '', manufacturer: '', model: '' });
  const hasActiveFilters = Object.values(filters).some((v) => v);

  const toggleRow = (sku) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const expandAll = () => setExpandedRows(new Set(rows.map((r) => r.sku)));
  const collapseAll = () => setExpandedRows(new Set());

  const openDetail = (product) => {
    setDetailProduct(product);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailProduct(null);
  };

  /* ========== RENDERERS ========== */

  const Pill = ({ field, value }) => (
    <span className={`${PILL_BASE} ${PILL_CLASS[field] || ''}`}>{value}</span>
  );

  const renderPriceCell = (val) => {
    const formatted = formatPrice(val);
    if (formatted === null) return <span className="text-gray-400 italic">not set</span>;
    return formatted;
  };

  const renderMarginCell = (dp, rp) => {
    const m = calculateMargin(dp, rp);
    if (m === null) return <span className="text-gray-400">—</span>;
    return m;
  };

  /* ========== ERROR STATE ========== */

  if (error) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-red-600 py-3">
            <CardTitle className="text-2xl text-white">Error</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ========== COLUMN COUNT (for expanded row colSpan) ========== */
  // Columns: Manufacturer, SKU, Model, Category, [DP], SRP, [Margin],
  // Sold, Display, Stock, Available, Pending, Actions
  const columnCount = isAdmin ? 13 : 11;

  /* ========== MAIN RENDER ========== */

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Inventory Summary</CardTitle>
          </div>
          <div className="flex gap-2">
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

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 px-4 py-4 border-b">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-gray-500 hover:text-red-500 flex items-center"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  {filterCategories.map((c) => (
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
                  disabled={filterManufacturers.length === 0}
                  className="w-full p-2 border rounded disabled:bg-gray-100"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  name="model"
                  value={filters.model}
                  onChange={handleFilterChange}
                  disabled={!filters.manufacturer || filterModels.length === 0}
                  title={!filters.manufacturer ? 'Select a manufacturer first' : ''}
                  className="w-full p-2 border rounded disabled:bg-gray-100"
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

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (!value) return null;
                  let label = value;
                  if (key === 'locationId') {
                    label = locations.find((l) => l.id === value)?.name || value;
                  }
                  return (
                    <div
                      key={key}
                      className="bg-gray-200 rounded-full px-3 py-1 text-sm flex items-center"
                    >
                      <span className="font-medium capitalize">
                        {key === 'locationId' ? 'store' : key}:
                      </span>
                      <span className="ml-1">{label}</span>
                      <button
                        onClick={() =>
                          setFilters((prev) => {
                            const next = { ...prev, [key]: '' };
                            if (key === 'category') {
                              next.manufacturer = '';
                              next.model = '';
                            } else if (key === 'manufacturer') {
                              next.model = '';
                            }
                            return next;
                          })
                        }
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <CardContent className="p-4">
          {/* Inactive products info */}
          {inactiveProductsInfo.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setInactiveListCollapsed(!inactiveListCollapsed)}
              >
                <CircleAlert className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-yellow-800">
                  Inactive Products ({inactiveProductsInfo.length})
                </h4>
                {inactiveListCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-yellow-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              {!inactiveListCollapsed && (
                <>
                  <div className="text-sm text-yellow-700 mt-2">
                    The following products are hidden from this summary. Toggle &quot;Include
                    inactive products&quot; below to include them.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {inactiveProductsInfo.map((m, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                      >
                        {m.manufacturer} {m.model}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Include-inactive + Expand/Collapse controls */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="w-4 h-4"
              />
              Include inactive products
            </label>
            {rows.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-sm px-3 py-1 border rounded text-[rgb(52,69,157)] hover:bg-gray-50"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="text-sm px-3 py-1 border rounded text-[rgb(52,69,157)] hover:bg-gray-50"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading summary…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <LayoutDashboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No data to summarize</h3>
              <p className="text-gray-500 mb-4">
                {hasActiveFilters
                  ? 'No products match your current filters.'
                  : products.length === 0
                  ? 'No accessory products yet.'
                  : 'No active products. Toggle "Include inactive products" to see everything.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <th className="px-3 py-3 text-left">Manufacturer</th>
                      <th className="px-3 py-3 text-left">SKU</th>
                      <th className="px-3 py-3 text-left">Model</th>
                      <th className="px-3 py-3 text-left">Category</th>
                      {isAdmin && <th className="px-2 py-3 text-right">DP</th>}
                      <th className="px-2 py-3 text-right">SRP</th>
                      {isAdmin && <th className="px-2 py-3 text-right">Margin</th>}
                      <th className="px-2 py-3 text-center">Sold</th>
                      <th className="px-2 py-3 text-center">Display</th>
                      <th className="px-2 py-3 text-center">Stock</th>
                      <th className="px-2 py-3 text-center">Available</th>
                      <th className="px-2 py-3 text-center">Pending</th>
                      <th className="px-2 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, index) => {
                      const isExpanded = expandedRows.has(row.sku);
                      return (
                        <React.Fragment key={row.sku}>
                          <tr
                            className={`hover:bg-gray-100 cursor-pointer ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                            onClick={() => toggleRow(row.sku)}
                          >
                            <td className="px-3 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                )}
                                <span>{row.manufacturer || '-'}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm">{row.sku}</td>
                            <td className="px-3 py-3 text-sm font-medium">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{row.model || '-'}</span>
                                {!row.active && (
                                  <span className="inline-block px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm">{row.category || '-'}</td>
                            {isAdmin && (
                              <td className="px-2 py-3 text-sm text-right">
                                {renderPriceCell(row.dealersPrice)}
                              </td>
                            )}
                            <td className="px-2 py-3 text-sm text-right">
                              {renderPriceCell(row.retailPrice)}
                            </td>
                            {isAdmin && (
                              <td className="px-2 py-3 text-sm text-right font-medium">
                                {renderMarginCell(row.dealersPrice, row.retailPrice)}
                              </td>
                            )}
                            <td className="px-2 py-2 text-center">
                              <Pill field="sold" value={row.totals.sold} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Pill field="onDisplay" value={row.totals.onDisplay} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Pill field="onHand" value={row.totals.onHand} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Pill field="available" value={row.totals.available} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Pill field="pending" value={row.totals.pending} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetail(row.product);
                                }}
                                className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded"
                                title="View product details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>

                          {isExpanded &&
                            (row.perStore.length === 0 ? (
                              <tr className="bg-gray-50">
                                <td
                                  colSpan={columnCount}
                                  className="px-3 py-3 text-center text-sm text-gray-500"
                                >
                                  No stock or pending procurements at any store for this product.
                                </td>
                              </tr>
                            ) : (
                              row.perStore.map((s) => (
                                <tr
                                  key={`${row.sku}__${s.locationId}`}
                                  className="bg-gray-50 border-l-4 border-l-[rgb(52,69,157)]/20"
                                >
                                  {/* Left columns collapsed into one; holds the store name.
                                      Admin columns: Manufacturer+SKU+Model+Category+DP+SRP+Margin = 7
                                      Non-admin:     Manufacturer+SKU+Model+Category+SRP         = 5 */}
                                  <td
                                    colSpan={isAdmin ? 7 : 5}
                                    className="px-3 py-2 text-sm"
                                  >
                                    <div className="flex items-center gap-2 pl-6">
                                      <Store className="h-4 w-4 text-[rgb(52,69,157)]" />
                                      <span className="font-medium text-gray-700">
                                        {s.locationName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Pill field="sold" value={s.sold} />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Pill field="onDisplay" value={s.onDisplay} />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Pill field="onHand" value={s.onHand} />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Pill field="available" value={s.available} />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Pill field="pending" value={s.pending} />
                                  </td>
                                  {/* Empty Actions cell so column widths stay aligned */}
                                  <td className="px-2 py-2"></td>
                                </tr>
                              ))
                            ))}
                        </React.Fragment>
                      );
                    })}

                  </tbody>
                </table>
              </div>

              {/* Inventory Value Summary (admin only) */}
              {isAdmin && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Inventory Value Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const dealerValue = rows.reduce(
                        (t, r) => t + r.totals.available * (r.dealersPrice || 0),
                        0
                      );
                      const retailValue = rows.reduce(
                        (t, r) => t + r.totals.available * (r.retailPrice || 0),
                        0
                      );
                      const profit = retailValue - dealerValue;
                      const marginPct =
                        dealerValue > 0 ? ((profit / dealerValue) * 100).toFixed(2) : '0.00';
                      const availableUnits = rows.reduce((t, r) => t + r.totals.available, 0);

                      const valueCard = (title, subtitle, amount, color, footer) => (
                        <div
                          className={`bg-white rounded-lg p-4 border ${color.border} shadow-sm`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 font-medium">{title}</p>
                              <p className="text-xs text-gray-500">{subtitle}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${color.text}`}>
                                ₱{formatNumberWithCommas(amount.toFixed(2))}
                              </p>
                              <p className="text-xs text-gray-500">{footer}</p>
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <>
                          {valueCard(
                            "Total Dealer's Value",
                            '(Available units × Dealer price)',
                            dealerValue,
                            { border: 'border-blue-100', text: 'text-blue-600' },
                            `${availableUnits} units`
                          )}
                          {valueCard(
                            'Total Retail Value',
                            '(Available units × Retail price)',
                            retailValue,
                            { border: 'border-green-100', text: 'text-green-600' },
                            `${availableUnits} units`
                          )}
                          {valueCard(
                            'Potential Profit',
                            "(Retail value − Dealer's value)",
                            profit,
                            { border: 'border-purple-100', text: 'text-purple-600' },
                            `${marginPct}% margin`
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-gray-600 text-sm">
                Showing {rows.length} product{rows.length !== 1 ? 's' : ''}
                {hasActiveFilters ? ' (filtered)' : ''}
                {expandedRows.size > 0 && ` • ${expandedRows.size} expanded`}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <AccessoryProductDetailModal
        isOpen={isDetailOpen}
        product={detailProduct}
        onClose={closeDetail}
      />
    </div>
  );
};

export default AccessoryInventorySummaryForm;
