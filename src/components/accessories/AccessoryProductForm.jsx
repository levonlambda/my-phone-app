import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Barcode,
  Hash,
  Factory,
  Tag as TagIcon,
  FileText,
  Settings2,
  RefreshCw,
  AlertCircle,
  Check,
  Settings,
  Save,
  X,
  Trash2
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalStateContext';
import {
  createAccessoryProduct,
  updateAccessoryProduct,
  deleteAccessoryProduct,
  getAllAccessoryProducts,
  getAllCategories
} from '../../services/accessoryService';
import { uploadAccessoryImage } from '../../services/accessoryImageService';
import { generateNextSku, sanitizeTags } from './utils/accessoryUtils';
import AccessoryImageUploader from './AccessoryImageUploader';
import AccessoryCategoryModal from './AccessoryCategoryModal';

const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const EMPTY_FORM = {
  internalSku: '',
  barcode: '',
  category: '',
  manufacturer: '',
  shortDescription: '',
  model: '',
  tagsInput: '',
  description: '',
  active: true,
  photoUrl: ''
};

const AccessoryProductForm = () => {
  const { accessoryProductToEdit, clearAccessoryProductToEdit } = useGlobalState();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [editSku, setEditSku] = useState(null);

  const [categories, setCategories] = useState([]);
  const [existingSkus, setExistingSkus] = useState([]);
  const [existingManufacturers, setExistingManufacturers] = useState([]);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Pending image: a File the user has selected before the product is saved.
  // Previewed in the uploader via a blob URL; actually uploaded to Firebase
  // Storage after the product save succeeds.
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [loadingRefs, setLoadingRefs] = useState(true);

  /* ========== DATA LOADING ========== */

  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      // Categories are seeded on demand by the "Manage Categories" modal —
      // the form only reads them here to avoid duplicate seed invocations.
      const [categoriesRes, productsRes] = await Promise.all([
        getAllCategories(),
        getAllAccessoryProducts()
      ]);

      if (categoriesRes.success) {
        const active = categoriesRes.categories.filter((c) => c.active !== false);
        setCategories(active);
      }

      if (productsRes.success) {
        const products = productsRes.products || [];
        setExistingSkus(products.map((p) => p.internalSku || p.id));
        const uniqueManufacturers = Array.from(
          new Set(products.map((p) => p.manufacturer).filter(Boolean))
        ).sort();
        setExistingManufacturers(uniqueManufacturers);
      }
    } catch (err) {
      console.error('Error loading reference data:', err);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  /* ========== HELPERS ========== */

  const clearPendingImage = useCallback(() => {
    setPendingImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingImageFile(null);
  }, []);

  const handlePendingFileSelect = useCallback(
    (file) => {
      setPendingImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : null;
      });
      setPendingImageFile(file || null);
    },
    []
  );

  // Revoke the blob URL on unmount to avoid a leak
  useEffect(() => {
    return () => {
      setPendingImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setIsEditing(false);
    setEditSku(null);
    setError(null);
    setSuccessMessage('');
    clearPendingImage();
  }, [clearPendingImage]);

  /* ========== EDIT MODE ========== */

  useEffect(() => {
    if (accessoryProductToEdit) {
      setIsEditing(true);
      const sku = accessoryProductToEdit.internalSku || accessoryProductToEdit.id;
      setEditSku(sku);
      setFormData({
        internalSku: sku || '',
        barcode: accessoryProductToEdit.barcode || '',
        category: accessoryProductToEdit.category || '',
        manufacturer: accessoryProductToEdit.manufacturer || '',
        shortDescription: accessoryProductToEdit.shortDescription || '',
        model: accessoryProductToEdit.model || '',
        tagsInput: Array.isArray(accessoryProductToEdit.tags)
          ? accessoryProductToEdit.tags.join(', ')
          : '',
        description: accessoryProductToEdit.description || '',
        active: accessoryProductToEdit.active !== false,
        photoUrl: accessoryProductToEdit.photoUrl || ''
      });
      setError(null);
      setSuccessMessage('');
    } else {
      resetForm();
    }
  }, [accessoryProductToEdit, resetForm]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (e) => {
    const nextCategory = e.target.value;

    // SKU is always auto-generated from the category in add mode (never in edit mode).
    let nextSku = formData.internalSku;
    if (!isEditing) {
      if (nextCategory) {
        const code = categories.find((c) => c.name === nextCategory)?.code;
        nextSku = code ? generateNextSku(code, existingSkus) : '';
      } else {
        nextSku = '';
      }
    }

    setFormData((prev) => ({ ...prev, category: nextCategory, internalSku: nextSku }));
  };

  const handleImageChange = (newUrl) => {
    setFormData((prev) => ({ ...prev, photoUrl: newUrl || '' }));
  };

  const handleCancel = () => {
    clearAccessoryProductToEdit();
    resetForm();
  };

  const handleDelete = async () => {
    if (!editSku) return;

    const displayName =
      `${formData.manufacturer || ''} ${formData.model || ''}`.trim() || editSku;
    const confirmMsg =
      `Delete this accessory product?\n\n` +
      `SKU: ${editSku}\n` +
      `Product: ${displayName}\n\n` +
      `Deletion is blocked if Stock, Display, Reserved, or Pending quantities are non-zero at any location. ` +
      `Defective stock does NOT block deletion.\n\n` +
      `This will remove the product, its pricing, all per-location inventory rows, and the product image. ` +
      `Procurement history and adjustment-log entries are preserved.\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    setError(null);
    setSuccessMessage('');
    try {
      const result = await deleteAccessoryProduct(editSku);
      if (!result.success) {
        setError(result.error || 'Failed to delete product');
        return;
      }
      setSuccessMessage(result.message || 'Product deleted successfully');
      // Brief pause so the user sees confirmation, then close the form
      setTimeout(() => {
        clearAccessoryProductToEdit();
        resetForm();
      }, 1200);
    } catch (err) {
      console.error('Error deleting accessory product:', err);
      setError(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  /* ========== SUBMIT ========== */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');

    // Client-side validation
    const category = formData.category.trim();
    const manufacturer = formData.manufacturer.trim();
    const model = formData.model.trim();
    const barcode = formData.barcode.trim();

    if (!category) {
      setError('Category is required');
      return;
    }
    if (!manufacturer) {
      setError('Manufacturer is required');
      return;
    }
    if (!model) {
      setError('Model is required');
      return;
    }

    const cleanTags = sanitizeTags(formData.tagsInput);

    // For new products, regenerate the SKU from fresh data at submit time so
    // we don't collide with products created by someone else after our mount.
    let sku = formData.internalSku.trim();
    if (!isEditing) {
      const freshProductsRes = await getAllAccessoryProducts();
      const freshSkus = freshProductsRes.success
        ? (freshProductsRes.products || []).map((p) => p.internalSku || p.id)
        : existingSkus;
      const code = categories.find((c) => c.name === category)?.code;
      if (!code) {
        setError('Selected category no longer exists — please re-select.');
        return;
      }
      sku = generateNextSku(code, freshSkus);
      setFormData((prev) => ({ ...prev, internalSku: sku }));
    }

    const productPayload = {
      internalSku: sku,
      barcode: barcode || '',
      category,
      manufacturer: capitalizeWords(manufacturer),
      shortDescription: formData.shortDescription.trim(),
      model: capitalizeWords(model),
      tags: cleanTags,
      description: formData.description.trim(),
      active: formData.active,
      photoUrl: formData.photoUrl || ''
    };

    setSubmitting(true);
    try {
      let result;
      if (isEditing) {
        result = await updateAccessoryProduct(editSku, productPayload);
      } else {
        result = await createAccessoryProduct(productPayload);
      }

      if (!result.success) {
        setError(result.error || 'Save failed');
        return;
      }

      // If there's a pending image selected before save, upload it now that
      // we have a canonical SKU. Don't fail the whole save if the upload
      // fails — surface a warning so the user can retry via Replace image.
      let imageWarning = '';
      let uploadedPhotoUrl = formData.photoUrl || '';
      if (!isEditing && pendingImageFile) {
        const uploadResult = await uploadAccessoryImage(sku, pendingImageFile);
        if (uploadResult.success) {
          uploadedPhotoUrl = uploadResult.url;
          setFormData((prev) => ({ ...prev, photoUrl: uploadResult.url }));
          clearPendingImage();
        } else {
          imageWarning = ` Product saved, but image upload failed: ${
            uploadResult.error || 'Unknown error'
          }. Use Replace image to retry.`;
          // Keep the pending file so the user can see it and retry
        }
      }

      setSuccessMessage(
        (isEditing
          ? 'Product updated successfully'
          : `Product "${sku}" created successfully.`) + imageWarning
      );

      if (isEditing) {
        await loadReferenceData();
      } else {
        // Flip the form into edit mode for this SKU so further image actions
        // go through Firebase directly.
        setIsEditing(true);
        setEditSku(sku);
        void uploadedPhotoUrl; // already reflected in formData.photoUrl
        await loadReferenceData();
      }
    } catch (err) {
      console.error('Error submitting accessory product:', err);
      setError(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== RENDER ========== */

  const headerTitle = isEditing ? 'Edit Accessory Product' : 'Add Accessory Product';

  const categoryOptions = useMemo(() => {
    return categories.map((c) => ({ value: c.name, label: c.name, code: c.code }));
  }, [categories]);

  return (
    <div className="min-h-screen bg-white p-4">
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-[720px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Package className="h-6 w-6" />
              {headerTitle}
            </CardTitle>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-3 py-1.5 rounded text-sm font-medium"
            >
              <Settings className="h-4 w-4" />
              <span>Manage Categories</span>
            </button>
          </CardHeader>

          <CardContent className="bg-white p-4 space-y-5">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Identifiers */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Hash className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Identifiers</h3>
              </div>
              <div>
                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">Internal SKU:</p>
                  <input
                    type="text"
                    value={formData.internalSku}
                    disabled
                    readOnly
                    placeholder="Auto-generated from the selected category"
                    title="Internal SKU is auto-generated from the selected category and cannot be edited"
                    className="text-base flex-1 border rounded px-2 py-1 font-mono bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center py-0.5 mt-1">
                  <p className="text-[rgb(52,69,157)] w-40 text-base flex items-center gap-1">
                    <Barcode className="h-4 w-4 inline" />
                    Barcode:
                  </p>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => handleFieldChange('barcode', e.target.value)}
                    placeholder="Optional — EAN / UPC / manufacturer code"
                    className="text-base flex-1 border rounded px-2 py-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Core fields */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Factory className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Details</h3>
              </div>
              <div>
                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">Category:</p>
                  <select
                    value={formData.category}
                    onChange={handleCategoryChange}
                    className="text-base flex-1 border rounded px-2 py-1"
                  >
                    <option value="">
                      {loadingRefs ? 'Loading categories…' : 'Select a category'}
                    </option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({opt.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">Manufacturer:</p>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                    list="accessory-manufacturers"
                    placeholder="e.g., Oraimo, Anker, Ugreen"
                    className="text-base flex-1 border rounded px-2 py-1"
                  />
                  <datalist id="accessory-manufacturers">
                    {existingManufacturers.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">Short Description:</p>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => handleFieldChange('shortDescription', e.target.value)}
                    placeholder="e.g., Wireless earbuds with charging case"
                    className="text-base flex-1 border rounded px-2 py-1"
                  />
                </div>

                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">Model:</p>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleFieldChange('model', e.target.value)}
                    placeholder="e.g., FreePods 4 TWS Earbuds"
                    className="text-base flex-1 border rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TagIcon className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Tags & Description</h3>
              </div>
              <div>
                <div className="flex items-start py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base pt-1">Tags:</p>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.tagsInput}
                      onChange={(e) => handleFieldChange('tagsInput', e.target.value)}
                      placeholder="Comma-separated (e.g., wireless, black, USB-C, 65W)"
                      className="text-base w-full border rounded px-2 py-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Stored lowercase, deduplicated. Max 20 tags.
                    </p>
                  </div>
                </div>
                <div className="flex items-start py-0.5 mt-2">
                  <p className="text-[rgb(52,69,157)] w-40 text-base pt-1 flex items-center gap-1">
                    <FileText className="h-4 w-4 inline" />
                    Description:
                  </p>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={10}
                    placeholder="Optional. Specs, features, marketing copy, etc."
                    className="text-base flex-1 border rounded px-2 py-1 resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="border-t border-gray-200 pt-4">
              <AccessoryImageUploader
                sku={editSku}
                currentPhotoUrl={formData.photoUrl}
                pendingPreviewUrl={pendingImagePreview}
                onPendingFileSelect={handlePendingFileSelect}
                onPhotoUrlChange={handleImageChange}
              />
            </div>

            {/* Settings */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Settings</h3>
              </div>
              <div className="flex items-center py-2">
                <input
                  type="checkbox"
                  id="acc-active"
                  checked={formData.active}
                  onChange={(e) => handleFieldChange('active', e.target.checked)}
                  className="w-4 h-4 text-[rgb(52,69,157)] bg-gray-100 border-gray-300 rounded focus:ring-[rgb(52,69,157)] focus:ring-2"
                />
                <label htmlFor="acc-active" className="ml-2 text-base text-gray-700">
                  Active
                </label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Inactive products are hidden from inventory entry and procurement forms but remain
                in the product list.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3">
              {(isEditing || accessoryProductToEdit) && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting || deleting}
                  className="w-1/4 flex items-center justify-center gap-1 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                  className={`w-1/4 flex items-center justify-center gap-1 py-2 rounded ${
                    submitting || deleting
                      ? 'bg-red-300 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {deleting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || deleting}
                className={`${
                  isEditing
                    ? 'w-1/2'
                    : accessoryProductToEdit
                    ? 'w-3/4'
                    : 'w-full'
                } flex items-center justify-center gap-1 py-2 rounded ${
                  submitting || deleting
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                }`}
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEditing ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>

      <AccessoryCategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onCategoriesChanged={loadReferenceData}
      />
    </div>
  );
};

export default AccessoryProductForm;
