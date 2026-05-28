import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Search,
  X,
  User as UserIcon,
  Store,
  Clock,
  FileText
} from 'lucide-react';
import { getAllAdjustments } from '../../services/accessoryInventoryService';
import { getAllAccessoryProducts } from '../../services/accessoryService';
import { getAllLocations } from '../../services/accessoryLocationService';

const FIELD_LABEL = {
  onHand: 'Stock',
  onDisplay: 'Display',
  reserved: 'Reserved',
  defective: 'Defective'
};

const DELTA_CLASS = (delta) =>
  delta > 0
    ? 'bg-green-100 text-green-800'
    : delta < 0
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700';

const RANGE_OPTIONS = [
  { key: '24h', label: 'Last 24 hours', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: 'all', label: 'All time', hours: null }
];

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date((ts.seconds || 0) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const tsToMs = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  return (ts.seconds || 0) * 1000;
};

const AccessoryAdjustmentLogForm = () => {
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rangeKey, setRangeKey] = useState('7d');
  const [userFilter, setUserFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adjRes, prodRes, locRes] = await Promise.all([
        getAllAdjustments(500),
        getAllAccessoryProducts(),
        getAllLocations()
      ]);
      if (adjRes.success) setEntries(adjRes.entries || []);
      else setError(adjRes.error || 'Failed to load adjustments');
      if (prodRes.success) setProducts(prodRes.products || []);
      if (locRes.success) setLocations(locRes.locations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const sku = p.internalSku || p.id;
      map[sku] = p;
    });
    return map;
  }, [products]);

  const distinctUsers = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      const id = e.userEmail || e.userId;
      if (id) set.add(id);
    });
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const range = RANGE_OPTIONS.find((r) => r.key === rangeKey);
    const cutoff = range?.hours ? now - range.hours * 60 * 60 * 1000 : 0;
    const searchLower = searchTerm.trim().toLowerCase();

    return entries.filter((e) => {
      if (cutoff && tsToMs(e.timestamp) < cutoff) return false;
      if (userFilter && (e.userEmail || e.userId) !== userFilter) return false;
      if (locationFilter && e.locationId !== locationFilter) return false;
      if (searchLower) {
        const product = productMap[e.sku];
        const haystack = [
          e.sku,
          product?.manufacturer,
          product?.model,
          e.reason
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [entries, rangeKey, userFilter, locationFilter, searchTerm, productMap]);

  const summary = useMemo(() => {
    const users = new Set();
    const skus = new Set();
    let largestAbsDelta = 0;
    filteredEntries.forEach((e) => {
      const user = e.userEmail || e.userId;
      if (user) users.add(user);
      if (e.sku) skus.add(e.sku);
      Object.values(e.delta || {}).forEach((d) => {
        const abs = Math.abs(d);
        if (abs > largestAbsDelta) largestAbsDelta = abs;
      });
    });
    return {
      total: filteredEntries.length,
      users: users.size,
      products: skus.size,
      largestDelta: largestAbsDelta
    };
  }, [filteredEntries]);

  const clearFilters = () => {
    setRangeKey('7d');
    setUserFilter('');
    setLocationFilter('');
    setSearchTerm('');
  };

  const anyFilterActive =
    rangeKey !== '7d' || userFilter || locationFilter || searchTerm.trim();

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Accessory Adjustments Log
          </CardTitle>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="Adjustments in range"
              value={summary.total}
            />
            <SummaryCard
              icon={<UserIcon className="h-5 w-5" />}
              label="Unique users"
              value={summary.users}
            />
            <SummaryCard
              icon={<FileText className="h-5 w-5" />}
              label="Products affected"
              value={summary.products}
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5" />}
              label="Largest single delta"
              value={summary.largestDelta}
            />
          </div>

          {/* Filters */}
          <div className="bg-gray-50 border rounded p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Range:</span>
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRangeKey(r.key)}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    rangeKey === r.key
                      ? 'bg-[rgb(52,69,157)] text-white border-[rgb(52,69,157)]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              {anyFilterActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto text-xs text-gray-500 hover:text-red-600 flex items-center"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full p-2 border rounded text-sm bg-white"
                >
                  <option value="">All users</option>
                  {distinctUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Store</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full p-2 border rounded text-sm bg-white"
                >
                  <option value="">All stores</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="SKU, product, or reason text"
                    className="w-full pl-8 pr-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin inline mr-2" />
              Loading adjustments…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No adjustments match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border px-3 py-2 text-left whitespace-nowrap">When</th>
                    <th className="border px-3 py-2 text-left">User</th>
                    <th className="border px-3 py-2 text-left whitespace-nowrap">SKU</th>
                    <th className="border px-3 py-2 text-left">Product</th>
                    <th className="border px-3 py-2 text-left">Store</th>
                    <th className="border px-3 py-2 text-left">Changes</th>
                    <th className="border px-3 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => {
                    const product = productMap[e.sku];
                    return (
                      <tr key={e.id} className="hover:bg-gray-50 align-top">
                        <td className="border px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                          {formatTimestamp(e.timestamp)}
                        </td>
                        <td className="border px-3 py-2 text-xs">
                          {e.userEmail || e.userId || (
                            <span className="text-gray-400 italic">unknown</span>
                          )}
                        </td>
                        <td className="border px-3 py-2 whitespace-nowrap font-mono text-xs">
                          {e.sku}
                        </td>
                        <td className="border px-3 py-2 text-xs">
                          {product ? (
                            <>
                              <div className="font-medium text-gray-800">
                                {product.manufacturer} {product.model}
                              </div>
                              {product.category && (
                                <div className="text-[11px] text-gray-500">
                                  {product.category}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">unknown product</span>
                          )}
                        </td>
                        <td className="border px-3 py-2 text-xs whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Store className="h-3 w-3 text-gray-400" />
                            {e.locationName || '—'}
                          </span>
                        </td>
                        <td className="border px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(e.delta || {}).map(([field, delta]) => (
                              <span
                                key={field}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${DELTA_CLASS(
                                  delta
                                )}`}
                              >
                                {FIELD_LABEL[field] || field}{' '}
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border px-3 py-2 text-xs text-gray-700 max-w-md">
                          <p
                            className="line-clamp-3 italic"
                            title={e.reason || ''}
                          >
                            {e.reason ? `"${e.reason}"` : (
                              <span className="text-gray-400 not-italic">(no reason)</span>
                            )}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-500 mt-2">
                Showing {filteredEntries.length} of {entries.length} adjustments loaded
                (limit 500). Use filters to narrow down.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryCard = ({ icon, label, value }) => (
  <div className="border rounded-lg p-3 bg-gray-50">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">
      <span className="text-[rgb(52,69,157)]">{icon}</span>
      <span>{label}</span>
    </div>
    <div className="mt-1 text-2xl font-bold text-gray-800">{value}</div>
  </div>
);

export default AccessoryAdjustmentLogForm;
