import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Calendar,
  FileText,
  Building2,
  Store,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { receiveAccessoryStock } from '../../services/accessoryInventoryService';
import {
  getActiveLocations,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';
import { getAllAccessoryProducts } from '../../services/accessoryService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';

const todayIso = () => new Date().toISOString().split('T')[0];

const AccessoryStockReceivingForm = () => {
  const {
    accessoryProcurementForReceiving,
    clearAccessoryProcurementForReceiving,
    setActiveComponent
  } = useGlobalState();

  const proc = accessoryProcurementForReceiving;

  // Per-SKU allocation: { internalSku: { onHand: '', onDisplay: '', defective: '' } }
  const [receivedQtys, setReceivedQtys] = useState({});
  const [dateDelivered, setDateDelivered] = useState(todayIso());
  const [deliveryReference, setDeliveryReference] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');

  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [productMap, setProductMap] = useState({}); // sku -> product doc (for barcode)

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingLocations(true);
      try {
        await seedDefaultLocationIfEmpty();
        const [locRes, prodRes] = await Promise.all([
          getActiveLocations(),
          getAllAccessoryProducts()
        ]);
        if (cancelled) return;
        if (locRes.success) setLocations(locRes.locations || []);
        if (prodRes.success) {
          const map = {};
          (prodRes.products || []).forEach((p) => {
            map[p.internalSku || p.id] = p;
          });
          setProductMap(map);
        }
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!proc) return;
    // If the procurement was already received and we have a stored breakdown,
    // hydrate from it. Otherwise default to "everything goes into Stock"
    // matching the ordered quantity.
    const breakdownMap = {};
    (proc.receivedBreakdown || []).forEach((b) => {
      breakdownMap[b.internalSku] = b;
    });
    const defaults = {};
    (proc.items || []).forEach((item) => {
      const sku = item.internalSku;
      const ordered = item.quantity || 0;
      const stored = breakdownMap[sku];
      if (stored) {
        defaults[sku] = {
          onHand: String(stored.onHand || 0),
          onDisplay: String(stored.onDisplay || 0),
          defective: String(stored.defective || 0)
        };
      } else {
        defaults[sku] = {
          onHand: String(ordered),
          onDisplay: '0',
          defective: '0'
        };
      }
    });
    setReceivedQtys(defaults);
    setDateDelivered(proc.dateDelivered || todayIso());
    setDeliveryReference(proc.deliveryReference || '');
  }, [proc]);

  // Default destination: use proc's saved location if present (e.g., already
  // received), otherwise fall back to the primary location once locations load.
  useEffect(() => {
    if (!proc) return;
    setDestinationLocationId((prev) => {
      if (prev) return prev;
      if (proc.destinationLocationId) return proc.destinationLocationId;
      if (proc.deliveryLocationId) return proc.deliveryLocationId;
      if (locations.length > 0) {
        const primary = locations.find((l) => l.isPrimary) || locations[0];
        return primary?.id || '';
      }
      return '';
    });
  }, [proc, locations]);

  const handleBucketChange = (sku, bucket, rawValue) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    setReceivedQtys((prev) => ({
      ...prev,
      [sku]: {
        onHand: prev[sku]?.onHand ?? '0',
        onDisplay: prev[sku]?.onDisplay ?? '0',
        defective: prev[sku]?.defective ?? '0',
        [bucket]: cleaned
      }
    }));
  };

  const handleApplyAll = (which) => {
    if (!proc) return;
    const next = {};
    (proc.items || []).forEach((item) => {
      if (which === 'full') {
        next[item.internalSku] = {
          onHand: String(item.quantity || 0),
          onDisplay: '0',
          defective: '0'
        };
      } else if (which === 'zero') {
        next[item.internalSku] = { onHand: '0', onDisplay: '0', defective: '0' };
      }
    });
    setReceivedQtys(next);
  };

  const rowTotal = (sku) => {
    const r = receivedQtys[sku] || {};
    return (
      (parseInt(r.onHand || '0', 10) || 0) +
      (parseInt(r.onDisplay || '0', 10) || 0) +
      (parseInt(r.defective || '0', 10) || 0)
    );
  };

  const totals = useMemo(() => {
    if (!proc) return { orderedUnits: 0, onHand: 0, onDisplay: 0, defective: 0, total: 0 };
    let ordered = 0;
    let onHand = 0;
    let onDisplay = 0;
    let defective = 0;
    (proc.items || []).forEach((item) => {
      ordered += item.quantity || 0;
      const r = receivedQtys[item.internalSku] || {};
      onHand += parseInt(r.onHand || '0', 10) || 0;
      onDisplay += parseInt(r.onDisplay || '0', 10) || 0;
      defective += parseInt(r.defective || '0', 10) || 0;
    });
    return {
      orderedUnits: ordered,
      onHand,
      onDisplay,
      defective,
      total: onHand + onDisplay + defective
    };
  }, [proc, receivedQtys]);

  const handleCancel = () => {
    clearAccessoryProcurementForReceiving();
    setActiveComponent('acc-procurement-mgmt');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSuccessMessage('');

    if (!proc) return;

    if (!destinationLocationId) {
      setSaveError('Select a destination store before receiving.');
      return;
    }

    if (!dateDelivered) {
      setSaveError('Date delivered is required');
      return;
    }

    const receivedItems = [];
    for (const item of proc.items || []) {
      const ordered = item.quantity || 0;
      const r = receivedQtys[item.internalSku] || {};
      const onHand = parseInt(r.onHand || '0', 10);
      const onDisplay = parseInt(r.onDisplay || '0', 10);
      const defective = parseInt(r.defective || '0', 10);
      if (
        !Number.isFinite(onHand) ||
        !Number.isFinite(onDisplay) ||
        !Number.isFinite(defective) ||
        onHand < 0 ||
        onDisplay < 0 ||
        defective < 0
      ) {
        setSaveError(
          `Invalid received quantity for ${item.model || item.internalSku} — values must be non-negative integers`
        );
        return;
      }
      const total = onHand + onDisplay + defective;
      if (total !== ordered) {
        setSaveError(
          `Allocated qty for ${item.model || item.internalSku} (${total}) must equal ordered qty (${ordered}). ` +
            (total > ordered
              ? `Reduce Stock / Display / Defective by ${total - ordered}.`
              : `Add ${ordered - total} more to Stock, Display, or Defective.`)
        );
        return;
      }
      receivedItems.push({
        internalSku: item.internalSku,
        onHand,
        onDisplay,
        defective
      });
    }

    if (receivedItems.every((it) => it.onHand + it.onDisplay + it.defective === 0)) {
      setSaveError('At least one item must have a received quantity greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receiveAccessoryStock(
        proc.id,
        receivedItems,
        dateDelivered,
        deliveryReference,
        destinationLocationId
      );
      if (res.success) {
        const destName =
          locations.find((l) => l.id === destinationLocationId)?.name || 'destination store';
        setSuccessMessage(`Stock received successfully at ${destName}`);
        setTimeout(() => {
          clearAccessoryProcurementForReceiving();
          setActiveComponent('acc-procurement-mgmt');
        }, 900);
      } else {
        setSaveError(res.error || 'Save failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== NO PROCUREMENT LOADED ========== */

  if (!proc) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Accessory Stock Receiving
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No procurement selected
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              To receive stock, open the procurement management list and click the delivery
              badge on a pending procurement.
            </p>
            <button
              type="button"
              onClick={() => setActiveComponent('acc-procurement-mgmt')}
              className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-md text-sm"
            >
              Open Procurement Management
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyReceived = proc.isReceived;
  const isViewOnly = alreadyReceived;

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Accessory Stock Receiving {isViewOnly && '(View Only)'}
            </CardTitle>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center text-sm"
              title="Cancel and return to procurement management"
            >
              <X className="h-4 w-4 mr-1" />
              {isViewOnly ? 'Close' : 'Cancel'}
            </button>
          </div>
        </CardHeader>

        <CardContent className="bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {alreadyReceived && (
              <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  This procurement has already been received on{' '}
                  <strong>{proc.dateDelivered || 'an unknown date'}</strong>. You can review the
                  details below.
                </span>
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

            {/* Procurement Info Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex flex-wrap gap-4">
                {/* Date Delivered */}
                <div className="space-y-2 flex-1 min-w-[140px] max-w-[170px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Date Delivered:
                  </label>
                  <input
                    type="date"
                    value={dateDelivered}
                    onChange={(e) => setDateDelivered(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    required
                    disabled={isViewOnly}
                  />
                </div>

                {/* Delivery Reference */}
                <div className="space-y-2 flex-1 min-w-[140px] max-w-[200px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <FileText className="h-4 w-4 inline mr-1" />
                    Reference:
                  </label>
                  <input
                    type="text"
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Delivery Receipt #"
                    disabled={isViewOnly}
                  />
                </div>

                {/* Destination Store */}
                <div className="space-y-2 flex-1 min-w-[200px] max-w-[260px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Store className="h-4 w-4 inline mr-1" />
                    Destination Store:
                  </label>
                  <select
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    disabled={isViewOnly || loadingLocations}
                    className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    required
                  >
                    <option value="">
                      {loadingLocations ? 'Loading stores…' : '-- Select a store --'}
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.isPrimary ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier - read-only */}
                <div className="space-y-2 flex-1 min-w-[180px] max-w-[240px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Supplier:
                  </label>
                  <input
                    type="text"
                    value={proc.supplierName || '-'}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Purchase Date - read-only */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[150px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Purchase Date:
                  </label>
                  <input
                    type="text"
                    value={proc.purchaseDate || '-'}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Procurement Reference - read-only */}
                <div className="space-y-2 flex-1 min-w-[140px] max-w-[180px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Procurement Ref:
                  </label>
                  <input
                    type="text"
                    value={proc.reference || proc.id}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100 font-mono"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Items to Receive */}
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                  {isViewOnly ? 'Received Items' : 'Items to Receive'} (
                  {(proc.items || []).length} line
                  {(proc.items || []).length !== 1 ? 's' : ''})
                </h3>
                {!isViewOnly && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyAll('full')}
                      className="text-xs px-3 py-1.5 border rounded text-[rgb(52,69,157)] hover:bg-gray-50"
                    >
                      Receive full amounts
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyAll('zero')}
                      className="text-xs px-3 py-1.5 border rounded text-gray-600 hover:bg-gray-50"
                    >
                      Zero all
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-3 text-left font-semibold w-[11%]">SKU</th>
                      <th className="border px-3 py-3 text-left font-semibold w-[20%]">Product</th>
                      <th className="border px-3 py-3 text-left font-semibold w-[10%]">Barcode</th>
                      <th className="border px-3 py-3 text-right font-semibold w-[10%]">Retail Price</th>
                      <th className="border px-3 py-3 text-center font-semibold w-[8%]">Ordered</th>
                      <th className="border px-3 py-3 text-center font-semibold w-[10%]">Stock</th>
                      <th className="border px-3 py-3 text-center font-semibold w-[10%]">Display</th>
                      <th className="border px-3 py-3 text-center font-semibold w-[10%]">Defective</th>
                      <th className="border px-3 py-3 text-center font-semibold w-[11%]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(proc.items || []).map((item) => {
                      const ordered = item.quantity || 0;
                      const r = receivedQtys[item.internalSku] || {};
                      const total = rowTotal(item.internalSku);
                      const totalIsOver = total > ordered;
                      const totalClass = totalIsOver
                        ? 'bg-red-100 text-red-700'
                        : total === ordered
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800';
                      const product = productMap[item.internalSku];
                      const barcode = product?.barcode || '';
                      const retail = Number(item.retailPrice) || 0;
                      return (
                        <tr key={item.internalSku} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-left whitespace-nowrap">
                            {item.internalSku}
                          </td>
                          <td className="border px-3 py-2 text-left">
                            <div className="font-medium">
                              {item.manufacturer ? `${item.manufacturer} ` : ''}
                              {item.model || '-'}
                            </div>
                            {item.category && (
                              <div className="text-xs text-gray-500">{item.category}</div>
                            )}
                          </td>
                          <td className="border px-3 py-2 text-left">
                            {barcode ? (
                              <span className="font-mono text-xs">{barcode}</span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">no barcode</span>
                            )}
                          </td>
                          <td className="border px-3 py-2 text-right">
                            {retail > 0 ? (
                              <span className="font-mono">
                                ₱{formatNumberWithCommas(retail.toFixed(2))}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">not set</span>
                            )}
                          </td>
                          <td className="border px-3 py-2 text-center">
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium min-w-[2.5rem] text-center">
                              {ordered}
                            </span>
                          </td>
                          {['onHand', 'onDisplay', 'defective'].map((bucket) => (
                            <td key={bucket} className="border px-3 py-2 text-center">
                              {isViewOnly ? (
                                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium min-w-[2.5rem] text-center">
                                  {parseInt(r[bucket] || '0', 10) || 0}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={r[bucket] ?? '0'}
                                  onChange={(e) =>
                                    handleBucketChange(
                                      item.internalSku,
                                      bucket,
                                      e.target.value
                                    )
                                  }
                                  className="w-20 px-2 py-1 border rounded text-center text-sm font-mono"
                                />
                              )}
                            </td>
                          ))}
                          <td className="border px-3 py-2 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold min-w-[2.5rem] text-center ${totalClass}`}
                              title={
                                totalIsOver
                                  ? `Exceeds ordered (${ordered})`
                                  : total === ordered
                                  ? 'Complete'
                                  : `Under-allocated (${ordered - total} remaining)`
                              }
                            >
                              {total}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 font-semibold">
                      <td colSpan="4" className="border px-3 py-2 text-right">
                        Totals:
                      </td>
                      <td className="border px-3 py-2 text-center font-mono">
                        {totals.orderedUnits}
                      </td>
                      <td className="border px-3 py-2 text-center font-mono">
                        {totals.onHand}
                      </td>
                      <td className="border px-3 py-2 text-center font-mono">
                        {totals.onDisplay}
                      </td>
                      <td className="border px-3 py-2 text-center font-mono">
                        {totals.defective}
                      </td>
                      <td className="border px-3 py-2 text-center font-mono">
                        {totals.total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!isViewOnly && totals.total !== totals.orderedUnits && (
                <p className="text-xs text-amber-700 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {totals.total < totals.orderedUnits ? (
                    <>
                      Under-allocated by {totals.orderedUnits - totals.total} unit
                      {totals.orderedUnits - totals.total !== 1 ? 's' : ''}. Save is blocked
                      until every row&apos;s Stock + Display + Defective equals the ordered
                      quantity. If the supplier under-delivered, edit the procurement first
                      to reduce the ordered quantity.
                    </>
                  ) : (
                    <>
                      Over-allocated by {totals.total - totals.orderedUnits} unit
                      {totals.total - totals.orderedUnits !== 1 ? 's' : ''}. Save is blocked
                      until every row&apos;s Stock + Display + Defective equals the ordered
                      quantity.
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Footer with grand total + action buttons */}
            {!isViewOnly && (
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm">
                  <span className="text-gray-600">Procurement total:</span>{' '}
                  <span className="font-semibold text-[rgb(52,69,157)]">
                    ₱{formatNumberWithCommas((proc.grandTotal || 0).toFixed(2))}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-6 py-2.5 rounded text-sm font-medium flex items-center gap-2 ${
                      submitting
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                    }`}
                  >
                    {submitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {submitting
                      ? 'Receiving…'
                      : `Receive Stock (${totals.total} unit${totals.total !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryStockReceivingForm;
