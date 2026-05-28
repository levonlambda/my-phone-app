import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { X, RefreshCw, History, AlertCircle, User as UserIcon, Store } from 'lucide-react';
import { getAdjustmentHistory } from '../../services/accessoryInventoryService';

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

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const AccessoryAdjustmentHistoryModal = ({
  isOpen,
  sku,
  locationId,
  productLabel,
  locationName,
  onClose
}) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !sku || !locationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getAdjustmentHistory(sku, locationId, 50);
      if (cancelled) return;
      if (res.success) {
        setEntries(res.entries || []);
      } else {
        setError(res.error || 'Failed to load adjustment history');
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sku, locationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[rgb(52,69,157)] px-6 py-4 flex justify-between items-start gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <History className="h-5 w-5" />
              Adjustment History
            </h2>
            <p className="text-xs text-white/80 mt-1 truncate">
              {productLabel || sku} · {locationName || 'Selected store'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 flex-shrink-0 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
          {loading && (
            <div className="text-center py-10 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin inline mr-2" />
              Loading history…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500">
              No adjustments recorded for this product at this store yet.
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="bg-white border rounded-lg p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {formatTimestamp(e.timestamp)}
                    </span>
                    <span className="text-xs text-gray-600 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {e.userEmail || e.userId || 'Unknown user'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {e.locationName || '—'}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(e.delta || {}).map(([field, delta]) => (
                      <span
                        key={field}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DELTA_CLASS(
                          delta
                        )}`}
                      >
                        {FIELD_LABEL[field] || field} {delta > 0 ? `+${delta}` : delta}
                      </span>
                    ))}
                  </div>

                  {e.reason && (
                    <p className="text-sm text-gray-700 italic border-l-2 border-gray-300 pl-3">
                      &ldquo;{e.reason}&rdquo;
                    </p>
                  )}

                  {e.before && e.after && (
                    <div className="text-[11px] text-gray-500 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 pt-1 border-t">
                      {Object.keys(FIELD_LABEL).map((k) => {
                        const b = e.before[k] || 0;
                        const a = e.after[k] || 0;
                        if (b === a) return null;
                        return (
                          <span key={k}>
                            <span className="text-gray-400">{FIELD_LABEL[k]}: </span>
                            {b} → <span className="font-semibold text-gray-700">{a}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-6 py-3 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

AccessoryAdjustmentHistoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  sku: PropTypes.string,
  locationId: PropTypes.string,
  productLabel: PropTypes.string,
  locationName: PropTypes.string,
  onClose: PropTypes.func.isRequired
};

export default AccessoryAdjustmentHistoryModal;
