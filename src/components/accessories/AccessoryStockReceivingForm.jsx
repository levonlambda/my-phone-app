import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Truck,
  Store,
  Calendar,
  Package,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  FileText,
  User
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { receiveAccessoryStock } from '../../services/accessoryInventoryService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';

const todayIso = () => new Date().toISOString().split('T')[0];

const AccessoryStockReceivingForm = () => {
  const {
    accessoryProcurementForReceiving,
    clearAccessoryProcurementForReceiving,
    setActiveComponent
  } = useGlobalState();

  const proc = accessoryProcurementForReceiving;

  const [receivedQtys, setReceivedQtys] = useState({}); // { internalSku -> qty }
  const [dateDelivered, setDateDelivered] = useState(todayIso());
  const [deliveryReference, setDeliveryReference] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!proc) return;
    // Pre-populate received quantities with the ordered quantities.
    const defaults = {};
    (proc.items || []).forEach((item) => {
      defaults[item.internalSku] = String(item.quantity || 0);
    });
    setReceivedQtys(defaults);
    setDateDelivered(proc.dateDelivered || todayIso());
    setDeliveryReference(proc.deliveryReference || '');
  }, [proc]);

  const handleQtyChange = (sku, rawValue) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    setReceivedQtys((prev) => ({ ...prev, [sku]: cleaned }));
  };

  const handleApplyAll = (which) => {
    if (!proc) return;
    const next = {};
    (proc.items || []).forEach((item) => {
      if (which === 'full') next[item.internalSku] = String(item.quantity || 0);
      else if (which === 'zero') next[item.internalSku] = '0';
    });
    setReceivedQtys(next);
  };

  const totals = useMemo(() => {
    if (!proc) return { orderedUnits: 0, receivedUnits: 0, linesAll: 0, linesPartial: 0 };
    let ordered = 0;
    let received = 0;
    let full = 0;
    let partial = 0;
    (proc.items || []).forEach((item) => {
      const ord = item.quantity || 0;
      const rec = parseInt(receivedQtys[item.internalSku] || '0', 10) || 0;
      ordered += ord;
      received += rec;
      if (rec === ord && ord > 0) full += 1;
      else if (rec > 0) partial += 1;
    });
    return { orderedUnits: ordered, receivedUnits: received, linesFull: full, linesPartial: partial };
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

    if (!proc.destinationLocationId) {
      setSaveError(
        'This procurement has no destination store set. Edit the procurement and assign one before receiving.'
      );
      return;
    }

    if (!dateDelivered) {
      setSaveError('Date delivered is required');
      return;
    }

    // Build items payload; validate received >= 0 and <= ordered
    const receivedItems = [];
    for (const item of proc.items || []) {
      const ordered = item.quantity || 0;
      const raw = receivedQtys[item.internalSku];
      const rec = parseInt(raw, 10);
      if (!Number.isFinite(rec) || rec < 0) {
        setSaveError(`Invalid received quantity for ${item.model || item.internalSku}`);
        return;
      }
      if (rec > ordered) {
        setSaveError(
          `Received qty for ${item.model || item.internalSku} (${rec}) exceeds ordered qty (${ordered}). Adjust the procurement first.`
        );
        return;
      }
      receivedItems.push({ internalSku: item.internalSku, quantity: rec });
    }

    if (receivedItems.every((it) => it.quantity === 0)) {
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
        proc.destinationLocationId
      );
      if (res.success) {
        setSuccessMessage(
          `Stock received successfully at ${proc.destinationLocationName || 'destination store'}`
        );
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
        <Card className="w-full max-w-[700px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Accessory Stock Receiving
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No procurement selected
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              To receive stock, open the procurement management list and click the delivery
              badge (or truck icon) on a pending procurement.
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

  return (
    <div className="min-h-screen bg-white p-4">
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-[1100px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Truck className="h-6 w-6" />
              {alreadyReceived ? 'Review Received Stock' : 'Receive Stock'}
              {proc.reference && (
                <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded ml-2">
                  {proc.reference}
                </span>
              )}
            </CardTitle>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </CardHeader>

          <CardContent className="p-4 space-y-5">
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

            {/* Procurement header (read-only summary) */}
            <div className="p-4 bg-gray-50 border rounded grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Supplier
                </p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {proc.supplierName || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Purchase Date
                </p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {proc.purchaseDate || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Store className="h-3 w-3" />
                  Destination Store
                </p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {proc.destinationLocationName || (
                    <span className="text-red-600 italic text-sm">(not set)</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Grand Total
                </p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  ₱{formatNumberWithCommas((proc.grandTotal || 0).toFixed(2))}
                </p>
              </div>
            </div>

            {/* Delivery metadata */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[rgb(52,69,157)]" />
                <h3 className="text-lg font-semibold">Delivery Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Calendar className="h-3.5 w-3.5 inline mr-1" />
                    Date Delivered *
                  </label>
                  <input
                    type="date"
                    value={dateDelivered}
                    onChange={(e) => setDateDelivered(e.target.value)}
                    disabled={alreadyReceived}
                    className={`w-full px-3 py-2 border rounded text-sm ${
                      alreadyReceived ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <FileText className="h-3.5 w-3.5 inline mr-1" />
                    Delivery Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    disabled={alreadyReceived}
                    placeholder="DR number, invoice #, etc."
                    className={`w-full px-3 py-2 border rounded text-sm ${
                      alreadyReceived ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[rgb(52,69,157)]" />
                  <h3 className="text-lg font-semibold">Items to Receive</h3>
                </div>
                {!alreadyReceived && (
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

              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Manufacturer</th>
                      <th className="px-3 py-2 text-left">Model</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Shortfall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(proc.items || []).map((item) => {
                      const ordered = item.quantity || 0;
                      const raw = receivedQtys[item.internalSku];
                      const received = parseInt(raw || '0', 10) || 0;
                      const shortfall = ordered - received;
                      return (
                        <tr key={item.internalSku} className="hover:bg-gray-50 border-t">
                          <td className="px-3 py-2 font-mono text-xs">{item.internalSku}</td>
                          <td className="px-3 py-2">{item.manufacturer || '-'}</td>
                          <td className="px-3 py-2 font-medium">{item.model || '-'}</td>
                          <td className="px-3 py-2">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-right">{ordered}</td>
                          <td className="px-3 py-2 text-right">
                            {alreadyReceived ? (
                              <span className="font-semibold">{received}</span>
                            ) : (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={raw ?? '0'}
                                onChange={(e) =>
                                  handleQtyChange(item.internalSku, e.target.value)
                                }
                                className="w-20 px-2 py-1 border rounded text-right text-sm"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {shortfall === 0 ? (
                              <span className="text-green-700 text-xs font-semibold">
                                Complete
                              </span>
                            ) : shortfall > 0 ? (
                              <span className="text-amber-700 text-xs font-semibold">
                                − {shortfall}
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs font-semibold">
                                OVER BY {-shortfall}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t font-semibold">
                      <td colSpan={4} className="px-3 py-2 text-right text-gray-700">
                        Totals
                      </td>
                      <td className="px-3 py-2 text-right">{totals.orderedUnits}</td>
                      <td className="px-3 py-2 text-right text-[rgb(52,69,157)]">
                        {totals.receivedUnits}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {totals.orderedUnits - totals.receivedUnits}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!alreadyReceived && totals.receivedUnits < totals.orderedUnits && (
                <p className="text-xs text-amber-700 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Partial receipt detected. The procurement will still be marked as received;
                  outstanding units are not tracked separately for now. Adjust the procurement
                  before receiving if you expect the supplier to redeliver.
                </p>
              )}
            </div>

            {/* Submit */}
            {!alreadyReceived && (
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
                  {submitting ? 'Receiving…' : 'Receive Stock'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default AccessoryStockReceivingForm;
