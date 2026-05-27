import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Search,
  RefreshCw,
  Calendar,
  Building2,
  Hash,
  DollarSign,
  CreditCard,
  Truck,
  Eye,
  Edit,
  Trash2,
  Settings,
  AlertCircle,
  Check
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  getAllAccessoryProcurements,
  deleteAccessoryProcurement
} from '../../services/accessoryService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = (() => {
  const years = [];
  for (let y = CURRENT_YEAR; y >= 2025; y--) years.push(String(y));
  return years;
})();

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const AccessoryProcurementManagementForm = () => {
  const {
    editAccessoryProcurement,
    viewAccessoryProcurement,
    paymentAccessoryProcurement,
    receiveAccessoryProcurement
  } = useGlobalState();

  const [procurements, setProcurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));

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

    if (yearFilter !== 'all') {
      result = result.filter((p) => (p.purchaseDate || '').slice(0, 4) === yearFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => {
        switch (statusFilter) {
          case 'paid':
            return p.isPaid === true;
          case 'unpaid':
            return p.isPaid !== true;
          case 'delivered':
            return p.isReceived === true;
          case 'pending':
            return p.isReceived !== true;
          default:
            return true;
        }
      });
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((p) => {
        const ref = (p.reference || '').toLowerCase();
        const supplier = (p.supplierName || '').toLowerCase();
        const date = (p.purchaseDate || '').toLowerCase();
        const itemMatch = (p.items || []).some(
          (it) =>
            (it.model || '').toLowerCase().includes(s) ||
            (it.manufacturer || '').toLowerCase().includes(s) ||
            (it.internalSku || '').toLowerCase().includes(s)
        );
        return ref.includes(s) || supplier.includes(s) || date.includes(s) || itemMatch;
      });
    }

    return result;
  }, [procurements, searchTerm, statusFilter, yearFilter]);

  /* ========== SUMMARY ========== */

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

  const handleDelete = async (proc) => {
    const isPaid = proc.isPaid === true;
    const confirmMsg =
      `Are you sure you want to delete this procurement?\n\n` +
      `Reference: ${proc.reference || proc.id}\n` +
      `Supplier: ${proc.supplierName}\n` +
      `Amount: ₱${formatNumberWithCommas((proc.grandTotal || 0).toFixed(2))}\n` +
      `Items: ${proc.totalQuantity || 0}\n` +
      `Payment Status: ${isPaid ? 'PAID' : 'UNPAID'}\n\n` +
      `This will remove the procurement and mark its ledger entries as deleted (audit trail preserved).\n\n` +
      `This action cannot be undone.`;
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

  const hasActiveFilters =
    Boolean(searchTerm) || statusFilter !== 'all' || yearFilter !== String(CURRENT_YEAR);

  /* ========== LOADING / ERROR STATES ========== */

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Accessory Procurement Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading procurement data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ========== RENDER ========== */

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Package className="h-6 w-6 mr-2" />
            Accessory Procurement Management
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-6">
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

          {/* Search and Filter Section */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by supplier name, reference, date, SKU, or model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Year Filter */}
              <div className="w-full md:w-40">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="all">All Years</option>
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid Only</option>
                  <option value="unpaid">Unpaid Only</option>
                  <option value="delivered">Delivered Only</option>
                  <option value="pending">Pending Delivery</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadData}
                className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {/* Procurement Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Procurement Summary</h3>
              <div className="text-sm text-gray-600">
                {hasActiveFilters
                  ? `${filteredProcurements.length} of ${procurements.length} entries (filtered)`
                  : `${filteredProcurements.length} entries`}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Procurement Value</p>
                    <p className="text-xs text-gray-500">Combined value of all procurements</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">
                      ₱{formatNumberWithCommas(summary.totalValue.toFixed(2))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {summary.count} {summary.count === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Units Procured</p>
                    <p className="text-xs text-gray-500">Combined quantity across all entries</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      {summary.totalUnits.toLocaleString('en-US')}
                    </p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Paid Procurements</p>
                    <p className="text-xs text-gray-500">Completed payment amount</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-600">
                      ₱{formatNumberWithCommas(summary.paidValue.toFixed(2))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const pct =
                          summary.count > 0 ? (summary.paidCount / summary.count) * 100 : 0;
                        return `${summary.paidCount} of ${summary.count} (${pct.toFixed(1)}%)`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Unpaid Procurements</p>
                    <p className="text-xs text-gray-500">Outstanding payment amount</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-600">
                      ₱{formatNumberWithCommas(summary.unpaidValue.toFixed(2))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const pct =
                          summary.count > 0 ? (summary.unpaidCount / summary.count) * 100 : 0;
                        return `${summary.unpaidCount} of ${summary.count} (${pct.toFixed(1)}%)`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Procurement Entries Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                Procurement Entries ({filteredProcurements.length} items)
              </h3>
            </div>

            {filteredProcurements.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-700 mb-2">
                  {procurements.length === 0
                    ? 'No procurement entries found'
                    : 'No entries match your filters'}
                </h4>
                <p className="text-gray-500">
                  {procurements.length === 0
                    ? 'Create procurement entries from the Accessory Procurement form'
                    : 'Try adjusting your search criteria or filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-3 text-left font-semibold">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Date
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-left font-semibold">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2" />
                          Supplier
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Hash className="h-4 w-4 mr-2" />
                          Total Items
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Amount
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Payment
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Truck className="h-4 w-4 mr-2" />
                          Delivery
                        </div>
                      </th>
                      <th className="border px-3 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          <Settings className="h-4 w-4 mr-2" />
                          Actions
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcurements.map((p, index) => (
                      <tr
                        key={p.id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="border px-3 py-3">
                          <div className="font-medium">{formatDate(p.purchaseDate)}</div>
                          {p.reference && (
                            <div className="text-xs text-gray-500">Ref: {p.reference}</div>
                          )}
                        </td>
                        <td className="border px-3 py-3">
                          <div className="font-medium">{p.supplierName || 'Unknown'}</div>
                          {p.deliveryLocationName && (
                            <div className="text-xs text-gray-500">
                              Store: {p.deliveryLocationName}
                            </div>
                          )}
                        </td>
                        <td className="border px-3 py-3 text-center">
                          <span className="font-semibold">{p.totalQuantity || 0}</span>
                        </td>
                        <td className="border px-3 py-3 text-right">
                          <span className="font-mono font-semibold">
                            ₱{formatNumberWithCommas((p.grandTotal || 0).toFixed(2))}
                          </span>
                        </td>
                        <td className="border px-3 py-3 text-center">
                          <button
                            onClick={() => paymentAccessoryProcurement(p)}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 cursor-pointer ${
                              p.isPaid
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                            title={
                              p.isPaid
                                ? 'Paid — click to view/edit payment'
                                : 'Click to record payment'
                            }
                          >
                            {p.isPaid ? 'Paid' : 'Unpaid'}
                          </button>
                        </td>
                        <td className="border px-3 py-3 text-center">
                          <button
                            onClick={() => receiveAccessoryProcurement(p)}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 cursor-pointer ${
                              p.isReceived
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                            title={
                              p.isReceived
                                ? 'View received items'
                                : 'Click to receive inventory'
                            }
                          >
                            {p.isReceived ? 'Delivered' : 'Pending'}
                          </button>
                        </td>
                        <td className="border px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => viewAccessoryProcurement(p)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => editAccessoryProcurement(p)}
                              disabled={p.isReceived}
                              className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title={
                                p.isReceived
                                  ? 'Cannot edit after receiving'
                                  : 'Edit Procurement'
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              disabled={deletingId === p.id}
                              className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                              title="Delete Procurement"
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryProcurementManagementForm;
