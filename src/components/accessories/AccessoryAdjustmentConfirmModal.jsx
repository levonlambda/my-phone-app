import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Lock,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Store
} from 'lucide-react';
import { adjustAccessoryInventory } from '../../services/accessoryInventoryService';
import { verifySettingsPassword } from '../../services/appConfigService';

const FIELD_LABEL = {
  onHand: 'Stock',
  onDisplay: 'Display',
  reserved: 'Reserved',
  defective: 'Defective'
};

const AccessoryAdjustmentConfirmModal = ({
  isOpen,
  sku,
  locationId,
  locationName,
  productLabel,
  before,
  adjustments,
  userId,
  userEmail,
  source = 'inventory-list-edit',
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setPassword('');
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const changedFields = Object.entries(adjustments || {}).filter(([, v]) => v !== 0);

  const handleConfirm = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Enter a reason for this adjustment');
      return;
    }
    if (!password) {
      setError('Enter the confirmation password');
      return;
    }
    if (changedFields.length === 0) {
      setError('No changes to apply');
      return;
    }
    setSaving(true);
    try {
      const verify = await verifySettingsPassword(password);
      if (!verify.success) {
        setError(verify.error || 'Could not verify password');
        return;
      }
      if (!verify.ok) {
        setError('Incorrect confirmation password');
        return;
      }

      const res = await adjustAccessoryInventory(sku, locationId, adjustments, {
        reason: reason.trim(),
        userId: userId || null,
        userEmail: userEmail || null,
        source
      });
      if (!res.success) {
        setError(res.error || 'Save failed');
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[rgb(52,69,157)] px-6 py-4 flex justify-between items-start gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Confirm Inventory Adjustment
            </h2>
            <p className="text-xs text-white/80 mt-1 truncate">
              {productLabel || sku} · {locationName || 'Selected store'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 flex-shrink-0 transition-colors disabled:opacity-60"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Change summary */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1">
              <Store className="h-3.5 w-3.5" />
              Changes
            </p>
            {changedFields.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No changes selected.</p>
            ) : (
              <ul className="space-y-1.5">
                {changedFields.map(([field, delta]) => {
                  const beforeVal = before?.[field] ?? 0;
                  const afterVal = beforeVal + delta;
                  return (
                    <li
                      key={field}
                      className="flex items-center gap-2 text-sm text-gray-800"
                    >
                      <span className="font-medium w-20">
                        {FIELD_LABEL[field] || field}
                      </span>
                      <span className="text-gray-500">{beforeVal}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-900">{afterVal}</span>
                      <span
                        className={`text-xs ${
                          delta > 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        ({delta > 0 ? `+${delta}` : delta})
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="h-4 w-4 inline mr-1 text-[rgb(52,69,157)]" />
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you making this adjustment?"
              disabled={saving}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Lock className="h-4 w-4 inline mr-1 text-[rgb(52,69,157)]" />
              Confirmation Password <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the settings password"
              autoComplete="off"
              disabled={saving}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t px-6 py-3 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-white transition-colors text-sm font-medium disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !reason.trim() || !password || changedFields.length === 0}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${
              saving || !reason.trim() || !password || changedFields.length === 0
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
            }`}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

AccessoryAdjustmentConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  sku: PropTypes.string,
  locationId: PropTypes.string,
  locationName: PropTypes.string,
  productLabel: PropTypes.string,
  before: PropTypes.object,
  adjustments: PropTypes.object,
  userId: PropTypes.string,
  userEmail: PropTypes.string,
  source: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};

export default AccessoryAdjustmentConfirmModal;
