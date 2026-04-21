import { useState } from 'react';
import PropTypes from 'prop-types';
import { Image as ImageIcon, Upload, Trash2, RefreshCw, AlertCircle, Check, Clock } from 'lucide-react';
import {
  uploadAccessoryImage,
  deleteAccessoryImage
} from '../../services/accessoryImageService';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Image uploader widget with two modes:
 *
 *   - SAVED mode (sku is truthy): user actions hit Firebase directly —
 *     uploads/deletes the file in Storage and updates the product's photoUrl.
 *
 *   - PENDING mode (sku is empty): the product hasn't been saved yet, so we
 *     keep the selected File in the parent's state (and preview it via a blob
 *     URL) without touching Firebase. The parent uploads the file to Storage
 *     after the product save succeeds.
 *
 * Display precedence: pendingPreviewUrl > currentPhotoUrl > "No Image" tile.
 */
const AccessoryImageUploader = ({
  sku,
  currentPhotoUrl,
  pendingPreviewUrl,
  onPendingFileSelect,
  onPhotoUrlChange
}) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const savedMode = Boolean(sku);
  const displayUrl = pendingPreviewUrl || currentPhotoUrl || '';
  const hasImage = Boolean(displayUrl);
  const isPending = Boolean(pendingPreviewUrl);

  const validateFile = (file) => {
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file (PNG, JPG, WebP, etc.)';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'Image must be 5 MB or smaller';
    }
    return null;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file
    e.target.value = '';

    if (!file) return;
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!savedMode) {
      // Pending mode: just hand the file back to the parent. Upload happens
      // in the parent after the product is saved.
      onPendingFileSelect(file);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAccessoryImage(sku, file);
      if (result.success) {
        onPhotoUrlChange(result.url);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove this product image?')) return;
    setError(null);

    if (!savedMode) {
      // Pending mode: just drop the in-memory file. Nothing to delete yet.
      onPendingFileSelect(null);
      return;
    }

    // Saved mode: if there's a pending file on top of a saved photoUrl, the
    // user probably wants to drop the pending one first. Otherwise delete
    // the persisted image from Firebase.
    if (isPending) {
      onPendingFileSelect(null);
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAccessoryImage(sku);
      if (result.success) {
        onPhotoUrlChange('');
        if (result.warning) setError(result.warning);
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const busy = uploading || deleting;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-6 h-6 text-[rgb(52,69,157)]" />
        <h3 className="text-xl font-semibold">Product Image</h3>
      </div>

      <div className="border rounded bg-gray-50 p-4">
        {hasImage ? (
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="relative w-full sm:w-48 h-48 bg-white rounded border flex items-center justify-center overflow-hidden">
              <img
                src={displayUrl}
                alt="Product"
                className="max-w-full max-h-full object-contain"
              />
              {isPending && (
                <span className="absolute top-1 left-1 flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-medium">
                  <Clock className="h-3 w-3" />
                  Pending
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {isPending ? (
                <span className="text-sm text-amber-700 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Will be uploaded when you save the product
                </span>
              ) : (
                <span className="text-sm text-green-700 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Image uploaded
                </span>
              )}

              <label
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded cursor-pointer text-sm ${
                  busy
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                }`}
              >
                {uploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{uploading ? 'Uploading…' : 'Replace image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={handleFileChange}
                />
              </label>

              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded text-sm border ${
                  busy
                    ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                }`}
              >
                {deleting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{deleting ? 'Deleting…' : isPending ? 'Discard image' : 'Delete image'}</span>
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded cursor-pointer transition-colors ${
              uploading
                ? 'border-[rgb(52,69,157)] bg-blue-50'
                : 'border-gray-300 hover:border-[rgb(52,69,157)] hover:bg-gray-100 bg-white'
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw className="h-8 w-8 text-[rgb(52,69,157)] animate-spin" />
                <span className="text-sm text-[rgb(52,69,157)] mt-2">Uploading…</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-10 w-10 text-gray-400" />
                <span className="text-sm font-medium text-gray-600 mt-2">No Image</span>
                <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  Click to upload (max 5 MB)
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

AccessoryImageUploader.propTypes = {
  sku: PropTypes.string,
  currentPhotoUrl: PropTypes.string,
  pendingPreviewUrl: PropTypes.string,
  onPendingFileSelect: PropTypes.func.isRequired,
  onPhotoUrlChange: PropTypes.func.isRequired
};

export default AccessoryImageUploader;
