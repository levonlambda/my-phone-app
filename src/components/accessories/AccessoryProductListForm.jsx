import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  RefreshCw,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  Image as ImageIcon
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  getAllAccessoryProducts,
  getAllCategories
} from '../../services/accessoryService';
import AccessoryProductDetailModal from './AccessoryProductDetailModal';

const AccessoryProductListForm = () => {
  const { editAccessoryProduct } = useGlobalState();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    category: '',
    manufacturer: '',
    activeStatus: 'all', // 'all' | 'active' | 'inactive'
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        getAllAccessoryProducts(),
        getAllCategories()
      ]);
      if (!productsRes.success) {
        setError(productsRes.error || 'Failed to load products');
      } else {
        setProducts(productsRes.products || []);
      }
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
    loadData();
  }, [loadData]);

  const manufacturers = useMemo(() => {
    const set = new Set(products.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];

    if (filters.category) {
      result = result.filter((p) => p.category === filters.category);
    }
    if (filters.manufacturer) {
      result = result.filter((p) => p.manufacturer === filters.manufacturer);
    }
    if (filters.activeStatus === 'active') {
      result = result.filter((p) => p.active !== false);
    } else if (filters.activeStatus === 'inactive') {
      result = result.filter((p) => p.active === false);
    }
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      result = result.filter((p) => {
        const sku = (p.internalSku || p.id || '').toLowerCase();
        const mfg = (p.manufacturer || '').toLowerCase();
        const model = (p.model || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        return (
          sku.includes(s) ||
          mfg.includes(s) ||
          model.includes(s) ||
          barcode.includes(s) ||
          tags.includes(s)
        );
      });
    }

    // Sort: active first, then manufacturer, then model
    result.sort((a, b) => {
      const aActive = a.active === false ? 1 : 0;
      const bActive = b.active === false ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      const mfg = (a.manufacturer || '').localeCompare(b.manufacturer || '');
      if (mfg !== 0) return mfg;
      return (a.model || '').localeCompare(b.model || '');
    });

    return result;
  }, [products, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      manufacturer: '',
      activeStatus: 'all',
      searchTerm: ''
    });
  };

  const openDetail = (product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedProduct(null);
  };

  const handleEdit = (product) => {
    editAccessoryProduct(product);
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-6xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Products</CardTitle>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
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
                      placeholder="SKU, model, barcode, tag…"
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
              <p className="mt-2 text-gray-600">Loading products…</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p className="mb-2">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded"
              >
                Try Again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No accessory products yet</h3>
              <p className="text-gray-500">Add products from the &quot;Acc. Products&quot; tab.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matching products</h3>
              <p className="text-gray-500 mb-4">Try changing your search criteria or clearing filters.</p>
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
                    <th className="border px-3 py-2 text-center w-20">Image</th>
                    <th className="border px-3 py-2 text-left">SKU</th>
                    <th className="border px-3 py-2 text-left">Manufacturer</th>
                    <th className="border px-3 py-2 text-left">Model</th>
                    <th className="border px-3 py-2 text-left">Category</th>
                    <th className="border px-3 py-2 text-left">Barcode</th>
                    <th className="border px-3 py-2 text-center">Status</th>
                    <th className="border px-3 py-2 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const sku = p.internalSku || p.id;
                    return (
                      <tr key={sku} className="hover:bg-gray-50">
                        <td className="border px-3 py-2 text-center">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={p.model}
                              className="inline-block w-14 h-14 object-contain bg-gray-50 border rounded"
                            />
                          ) : (
                            <div
                              className="inline-flex flex-col items-center justify-center w-14 h-14 bg-gray-50 border border-dashed border-gray-300 rounded text-gray-400"
                              title="No Image"
                            >
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-[10px] mt-0.5">No Image</span>
                            </div>
                          )}
                        </td>
                        <td className="border px-3 py-2 font-mono text-xs">{sku}</td>
                        <td className="border px-3 py-2">{p.manufacturer || '-'}</td>
                        <td className="border px-3 py-2 font-medium">{p.model || '-'}</td>
                        <td className="border px-3 py-2">{p.category || '-'}</td>
                        <td className="border px-3 py-2 font-mono text-xs">{p.barcode || '-'}</td>
                        <td className="border px-3 py-2 text-center">
                          {p.active === false ? (
                            <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                              Inactive
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="border px-3 py-2 text-center">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => openDetail(p)}
                              className="p-1 text-[rgb(52,69,157)] hover:text-[rgb(80,100,200)]"
                              title="View details"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleEdit(p)}
                              className="p-1 text-[rgb(52,69,157)] hover:text-[rgb(80,100,200)]"
                              title="Edit product"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-4 flex justify-between items-center text-gray-600">
                <div>
                  Showing {filtered.length} of {products.length} products
                </div>
              </div>
            </div>
          )}

          <AccessoryProductDetailModal
            isOpen={isDetailOpen}
            product={selectedProduct}
            onClose={closeDetail}
            onEdit={(p) => {
              closeDetail();
              handleEdit(p);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryProductListForm;
