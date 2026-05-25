import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  X,
  Eye,
  Edit,
  CreditCard,
  Truck,
  Trash2,
  AlertCircle,
  Check,
  Plus,
  Store
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  getAllAccessoryProcurements,
  deleteAccessoryProcurement
} from '../../services/accessoryService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const AccessoryProcurementManagementForm = () => {
  const {
    setActiveComponent,
    editAccessoryProcurement,
    viewAccessoryProcurement,
    paymentAccessoryProcurement,
    receiveAccessoryProcurement
  } = useGlobalState();

  const [procurements, setProcurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    paymentStatus: 'all',
    deliveryStatus: 'all',
    year: String(CURRENT_YEAR)
  });

  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllAccessoryProcurements();
      if (res.success) {
        setProcurements(res.procurements || []);
      } else {
        setError(res.error || 'Failed to load procurements');
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

  const filteredProcurements = useMemo(() => {
    let result = [...procurements];

    if (filters.year) {
      result = result.filter((p) => {
        const year = (p.purchaseDate || '').slice(0, 4);
        return year === filters.year;
      });
    }

    if (filters.paymentStatus === 'paid') {
      result = result.filter((p) => p.isPaid);
    } else if (filters.paymentStatus === 'unpaid') {
      result = result.filter((p) => !p.isPaid);
    }

    if (filters.deliveryStatus === 'delivered') {
      result = result.filter((p) => p.isReceived);
    } else if (filters.deliveryStatus === 'pending') {
      result = result.filter((p) => !p.isReceived);
    }

    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      result = result.filter((p) => {
        const ref = (p.reference || '').toLowerCase();
        const supplier = (p.supplierName || '').toLowerCase();
        const dest = (p.destinationLocationName || '').toLowerCase();
        const itemMatch = (p.items || []).some(
          (it) =>
            (it.model || '').toLowerCase().includes(s) ||
            (it.manufacturer || '').toLowerCase().includes(s) ||
            (it.internalSku || '').toLowerCase().includes(s)
        );
        return ref.includes(s) || supplier.includes(s) || dest.includes(s) || itemMatch;
      });
    }

    return result;
  }, [procurements, filters]);

  /* ========== SUMMARY CARDS ========== */

  const summary = useMemo(() => {
    const totalValue = filteredProcurements.reduce((t, p) => t + (p.grandTotal || 0), 0);
    const totalUnits = filteredProcurements.reduce((t, p) => t + (p.totalQuantity || 0), 0);
    const paidProcs = filteredProcurements.filter((p) => p.isPaid);
    const unpaidProcs = filteredProcurements.filter((p) => !p.isPaid);
    const paidValue = paidProcs.reduce((t, p) => t + (p.grandTotal || 0), 0);
    const unpaidValue = unpaidProcs.reduce((t, p) => t + (p.grandTotal || 0), 0);
    return {
      count: filteredProcurements.length,
      totalValue,
      totalUnits,
      paidCount: paidProcs.length,
      paidValue,
      unpaidCount: unpaidProcs.length,
      unpaidValue
    };
  }, [filteredProcurements]);

  /* ========== HANDLERS ========== */

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      paymentStatus: 'all',
      deliveryStatus: 'all',
      year: String(CURRENT_YEAR)
    });
  };

  const handleCreate = () => {
    setActiveComponent('acc-procurement');
  };

  const handleDelete = async (proc) => {
    const confirmMsg =
      `Delete procurement ${proc.reference || proc.id}?\n\n` +
      `Supplier: ${proc.supplierName || '(unknown)'}\n` +
      `Amount: ₱${formatNumberWithCommas((proc.grandTotal || 0).toFixed(2))}\n` +
      `Items: ${proc.items?.length || 0}\n` +
      `Paid: ${proc.isPaid ? 'Yes' : 'No'}\n` +
      `Received: ${proc.isReceived ? 'Yes' : 'No'}\n\n` +
      `The procurement will be removed and its ledger entries marked as deleted (audit trail preserved).`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(proc.id);
    setError(null);
    setSuccessMessage('');
    try {
      const res = await deleteAccessoryProcurement(proc.id);
      if (res.success) {
        setSuccessMessage(`Procurement ${proc.reference || proc.id} deleted`);
        await loadData();
      } else {
        setError(res.error || 'Failed to delete');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  /* ========== RENDER ========== */

  const hasActiveFilters =
    filters.searchTerm ||
    filters.paymentStatus !== 'all' ||
    filters.deliveryStatus !== 'all' ||
    filters.year !== String(CURRENT_YEAR);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return dateStr;
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1500px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Procurement Management</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
            >
              <Plus className="h-5 w-5 mr-1" />
              <span>New</span>
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

        <CardContent className="p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium">Total Value</p>
              <p className="text-xl font-bold text-[rgb(52,69,157)]">
                ₱{formatNumberWithCommas(summary.totalValue.toFixed(2))}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {summary.count} procurement{summary.count !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium">Total Units Procured</p>
              <p className="text-xl font-bold text-amber-700">{summary.totalUnits}</p>
            </div>
            <div className="bg-white border rounded-lg p-3 border-green-200">
              <p className="text-xs text-gray-600 font-medium">Paid</p>
              <p className="text-xl font-bold text-green-700">
                ₱{formatNumberWithCommas(summary.paidValue.toFixed(2))}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {summary.paidCount} procurement{summary.paidCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-3 border-red-200">
              <p className="text-xs text-gray-600 font-medium">Unpaid</p>
              <p className="text-xl font-bold text-red-700">
                ₱{formatNumberWithCommas(summary.unpaidValue.toFixed(2))}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {summary.unpaidCount} procurement{summary.unpaidCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg text-[rgb(52,69,157)]">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-red-500 flex items-center text-sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset Filters
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    name="year"
                    value={filters.year}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">All Years</option>
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    name="paymentStatus"
                    value={filters.paymentStatus}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="all">All</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Status
                  </label>
                  <select
                    name="deliveryStatus"
                    value={filters.deliveryStatus}
                    onChange={handleFilterChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="all">All</option>
                    <option value="delivered">Delivered</option>
                    <option value="pending">Pending</option>
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
                      placeholder="Ref, supplier, store, SKU, model…"
                      className="w-full p-2 pl-9 border rounded"
                    />
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading procurements…</p>
            </div>
          ) : procurements.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No procurements yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first accessory procurement order.
              </p>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md inline-flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                New Procurement
              </button>
            </div>
          ) : filteredProcurements.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matching procurements</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">Date / Reference</th>
                    <th className="px-3 py-3 text-left">Supplier</th>
                    <th className="px-3 py-3 text-left">Store</th>
                    <th className="px-3 py-3 text-right">Items</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-center">Payment</th>
                    <th className="px-3 py-3 text-center">Delivery</th>
                    <th className="px-3 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProcurements.map((p, index) => {
                    const itemsCount = p.items?.length || 0;
                    const unitsCount = p.totalQuantity || 0;
                    return (
                      <tr
                        key={p.id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-3 py-3 text-sm">
                          <div className="font-medium">{formatDate(p.purchaseDate)}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {p.reference || p.id}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">{p.supplierName || '-'}</td>
                        <td className="px-3 py-3 text-sm">
                          {p.destinationLocationName ? (
                            <span className="inline-flex items-center gap-1">
                              <Store className="h-3.5 w-3.5 text-[rgb(52,69,157)]" />
                              {p.destinationLocationName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">(not set)</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-right">
                          <div>{itemsCount} line{itemsCount !== 1 ? 's' : ''}</div>
                          <div className="text-xs text-gray-500">
                            {unitsCount} unit{unitsCount !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-semibold">
                          ₱{formatNumberWithCommas((p.grandTotal || 0).toFixed(2))}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => paymentAccessoryProcurement(p)}
                            title={p.isPaid ? 'Paid — click to view/edit payment' : 'Record payment'}
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.isPaid
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {p.isPaid ? 'Paid' : 'Unpaid'}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => receiveAccessoryProcurement(p)}
                            disabled={p.isReceived}
                            title={
                              p.isReceived
                                ? 'Already received'
                                : 'Receive stock for this procurement'
                            }
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.isReceived
                                ? 'bg-green-100 text-green-700 cursor-default'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            }`}
                          >
                            {p.isReceived ? 'Delivered' : 'Pending'}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => viewAccessoryProcurement(p)}
                              title="View"
                              className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => editAccessoryProcurement(p)}
                              disabled={p.isReceived}
                              title={
                                p.isReceived ? 'Cannot edit after receiving' : 'Edit'
                              }
                              className="p-1 text-green-700 hover:bg-green-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => paymentAccessoryProcurement(p)}
                              title="Record / view payment"
                              className="p-1 text-amber-700 hover:bg-amber-50 rounded"
                            >
                              <CreditCard className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => receiveAccessoryProcurement(p)}
                              disabled={p.isReceived}
                              title={p.isReceived ? 'Already received' : 'Receive stock'}
                              className="p-1 text-blue-700 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Truck className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={deletingId === p.id}
                              title="Delete"
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            >
                              {deletingId === p.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-4 py-3 text-sm text-gray-600 border-t bg-gray-50">
                Showing {filteredProcurements.length} of {procurements.length} procurement
                {procurements.length !== 1 ? 's' : ''}
                {hasActiveFilters ? ' (filtered)' : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryProcurementManagementForm;
