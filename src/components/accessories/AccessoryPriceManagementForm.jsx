import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  RefreshCw,
  Search,
  Filter,
  X,
  Edit,
  Save,
  AlertCircle,
  Check,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllAccessoryProducts,
  getAllAccessoryPricing,
  getAllCategories,
  setAccessoryPricing
} from '../../services/accessoryService';
import {
  calculateMarkup,
  calculateProfit,
  formatNumberWithCommas,
  parsePrice
} from '../phone-selection/utils/phoneUtils';

const AccessoryPriceManagementForm = () => {
  const { userRole } = useAuth();

  const [products, setProducts] = useState([]);
  const [pricingMap, setPricingMap] = useState({}); // sku -> { dealersPrice, retailPrice }
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [filters, setFilters] = useState({
    category: '',
    manufacturer: '',
    activeStatus: 'active', // default to active products — inactive ones are rarely priced
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(true);

  // Inline edit state
  const [editingSku, setEditingSku] = useState(null);
  const [editDraft, setEditDraft] = useState({ dealersPrice: '', retailPrice: '' });
  const [savingSku, setSavingSku] = useState(null);

  const isAdmin = userRole === 'admin';

  /* ========== DATA LOAD ========== */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, pricingRes, categoriesRes] = await Promise.all([
        getAllAccessoryProducts(),
        getAllAccessoryPricing(),
        getAllCategories()
      ]);

      if (!productsRes.success) {
        setError(productsRes.error || 'Failed to load products');
        return;
      }
      setProducts(productsRes.products || []);

      const map = {};
      if (pricingRes.success) {
        (pricingRes.pricing || []).forEach((p) => {
          map[p.id] = {
            dealersPrice: p.dealersPrice,
            retailPrice: p.retailPrice
          };
        });
      }
      setPricingMap(map);

      if (categoriesRes.success) {
        setCategories(categoriesRes.categories || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [loadData, isAdmin]);

  const manufacturers = useMemo(() => {
    const set = new Set(products.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const rows = useMemo(() => {
    let result = products.map((p) => {
      const sku = p.internalSku || p.id;
      const pricing = pricingMap[sku] || {};
      return {
        sku,
        barcode: p.barcode || '',
        manufacturer: p.manufacturer || '',
        model: p.model || '',
        category: p.category || '',
        active: p.active !== false,
        dealersPrice: pricing.dealersPrice ?? null,
        retailPrice: pricing.retailPrice ?? null
      };
    });

    if (filters.category) result = result.filter((r) => r.category === filters.category);
    if (filters.manufacturer) result = result.filter((r) => r.manufacturer === filters.manufacturer);
    if (filters.activeStatus === 'active') result = result.filter((r) => r.active);
    else if (filters.activeStatus === 'inactive') result = result.filter((r) => !r.active);

    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      result = result.filter((r) => {
        return (
          r.sku.toLowerCase().includes(s) ||
          (r.barcode || '').toLowerCase().includes(s) ||
          r.manufacturer.toLowerCase().includes(s) ||
          r.model.toLowerCase().includes(s) ||
          r.category.toLowerCase().includes(s)
        );
      });
    }

    // Sort: by manufacturer, then model
    result.sort((a, b) => {
      const mfg = a.manufacturer.localeCompare(b.manufacturer);
      if (mfg !== 0) return mfg;
      return a.model.localeCompare(b.model);
    });

    return result;
  }, [products, pricingMap, filters]);

  /* ========== HANDLERS ========== */

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ category: '', manufacturer: '', activeStatus: 'active', searchTerm: '' });
  };

  const startEdit = (row) => {
    setEditingSku(row.sku);
    setEditDraft({
      dealersPrice:
        row.dealersPrice !== null && row.dealersPrice !== undefined
          ? formatNumberWithCommas(String(row.dealersPrice))
          : '',
      retailPrice:
        row.retailPrice !== null && row.retailPrice !== undefined
          ? formatNumberWithCommas(String(row.retailPrice))
          : ''
    });
    setError(null);
    setSuccessMessage('');
  };

  const cancelEdit = () => {
    setEditingSku(null);
    setEditDraft({ dealersPrice: '', retailPrice: '' });
  };

  const handleDraftChange = (field, rawValue) => {
    // Allow digits + one decimal point; reformat with commas
    const cleaned = rawValue.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setEditDraft((prev) => ({ ...prev, [field]: formatNumberWithCommas(cleaned) }));
  };

  const saveEdit = async (row) => {
    setError(null);
    setSuccessMessage('');

    const dealers = parseFloat(parsePrice(editDraft.dealersPrice)) || 0;
    const retail = parseFloat(parsePrice(editDraft.retailPrice)) || 0;

    if (dealers < 0 || retail < 0) {
      setError('Prices cannot be negative');
      return;
    }

    setSavingSku(row.sku);
    try {
      const result = await setAccessoryPricing(row.sku, {
        dealersPrice: dealers,
        retailPrice: retail
      });
      if (result.success) {
        setPricingMap((prev) => ({
          ...prev,
          [row.sku]: { dealersPrice: dealers, retailPrice: retail }
        }));
        setSuccessMessage(`Pricing updated for ${row.sku}`);
        setEditingSku(null);
        setEditDraft({ dealersPrice: '', retailPrice: '' });
      } else {
        setError(result.error || 'Failed to save pricing');
      }
    } catch (err) {
      setError(err.message || 'Failed to save pricing');
    } finally {
      setSavingSku(null);
    }
  };

  /* ========== RENDER HELPERS ========== */

  const renderPrice = (val) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-400 italic">not set</span>;
    }
    return <span>{formatNumberWithCommas(String(val))}</span>;
  };

  const renderMarkupProfit = (dealer, retail) => {
    const d = dealer ?? 0;
    const r = retail ?? 0;
    if (d === 0 && r === 0) {
      return { markup: '-', profit: '-' };
    }
    const markup = calculateMarkup(String(d), String(r));
    const profit = formatNumberWithCommas(calculateProfit(String(d), String(r)));
    return { markup, profit };
  };

  /* ========== ACCESS GUARD ========== */

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
            <p className="text-red-700">
              Accessory pricing is restricted to administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ========== MAIN RENDER ========== */

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Price Management</CardTitle>
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
                  Clear Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <select
                    name="manufacturer"
                    value={filters.manufacturer}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
                      placeholder="SKU, barcode, model, category…"
                      className="w-full p-2 pl-9 border rounded"
                    />
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading pricing…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No products yet</h3>
              <p className="text-gray-500">
                Add accessory products first — pricing rows appear automatically for each product.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matching products</h3>
              <p className="text-gray-500 mb-4">
                Try changing your search criteria or clearing filters.
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-3 py-2 text-left">SKU</th>
                    <th className="border px-3 py-2 text-left">Barcode</th>
                    <th className="border px-3 py-2 text-left">Manufacturer</th>
                    <th className="border px-3 py-2 text-left">Model</th>
                    <th className="border px-3 py-2 text-left">Category</th>
                    <th className="border px-3 py-2 text-right">Dealer Price</th>
                    <th className="border px-3 py-2 text-right">Retail Price</th>
                    <th className="border px-3 py-2 text-right">Markup %</th>
                    <th className="border px-3 py-2 text-right">Profit</th>
                    <th className="border px-3 py-2 text-center">Status</th>
                    <th className="border px-3 py-2 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isEditing = editingSku === row.sku;
                    const isSaving = savingSku === row.sku;

                    // Live markup/profit calculation from the draft values while editing
                    const { markup, profit } = renderMarkupProfit(
                      isEditing ? parseFloat(parsePrice(editDraft.dealersPrice)) || 0 : row.dealersPrice,
                      isEditing ? parseFloat(parsePrice(editDraft.retailPrice)) || 0 : row.retailPrice
                    );

                    return (
                      <tr key={row.sku} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                        <td className="border px-3 py-2">{row.sku}</td>
                        <td className="border px-3 py-2">{row.barcode || '-'}</td>
                        <td className="border px-3 py-2">{row.manufacturer || '-'}</td>
                        <td className="border px-3 py-2 font-medium">{row.model || '-'}</td>
                        <td className="border px-3 py-2">{row.category || '-'}</td>
                        <td className="border px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.dealersPrice}
                              onChange={(e) => handleDraftChange('dealersPrice', e.target.value)}
                              className="w-28 px-2 py-1 border rounded text-sm text-right"
                              placeholder="0.00"
                              autoFocus
                            />
                          ) : (
                            renderPrice(row.dealersPrice)
                          )}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.retailPrice}
                              onChange={(e) => handleDraftChange('retailPrice', e.target.value)}
                              className="w-28 px-2 py-1 border rounded text-sm text-right"
                              placeholder="0.00"
                            />
                          ) : (
                            renderPrice(row.retailPrice)
                          )}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {markup === '-' ? markup : `${markup}%`}
                        </td>
                        <td className="border px-3 py-2 text-right">{profit}</td>
                        <td className="border px-3 py-2 text-center">
                          {row.active ? (
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Active
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                              Inactive
                            </span>
                          )}
                        </td>
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
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded"
                              title="Edit pricing"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-4 flex justify-between items-center text-gray-600">
                <div>
                  Showing {rows.length} of {products.length} products
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryPriceManagementForm;
