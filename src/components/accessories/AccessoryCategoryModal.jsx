import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { X, Plus, Check, AlertCircle, RefreshCw, Edit, Save, Trash2 } from 'lucide-react';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  countProductsInCategory,
  seedDefaultCategoriesIfEmpty
} from '../../services/accessoryService';

const AccessoryCategoryModal = ({ isOpen, onClose, onCategoriesChanged }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // New category form
  const [newCategory, setNewCategory] = useState({ name: '', code: '', sortOrder: 100 });
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', code: '', sortOrder: 100, active: true });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Seed defaults on first open if collection is empty
      await seedDefaultCategoriesIfEmpty();
      const result = await getAllCategories();
      if (result.success) {
        setCategories(result.categories);
      } else {
        setError(result.error || 'Failed to load categories');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setSuccessMessage('');
      setError(null);
      setEditingId(null);
      setNewCategory({ name: '', code: '', sortOrder: 100 });
    }
  }, [isOpen, loadCategories]);

  const handleCreate = async () => {
    setError(null);
    setSuccessMessage('');
    if (!newCategory.name.trim() || !newCategory.code.trim()) {
      setError('Name and code are required');
      return;
    }
    if (!/^[A-Za-z]{2,6}$/.test(newCategory.code.trim())) {
      setError('Code must be 2 to 6 letters (e.g., CHG, CBL)');
      return;
    }

    setSaving(true);
    try {
      const result = await createCategory({
        name: newCategory.name.trim(),
        code: newCategory.code.trim(),
        sortOrder: Number(newCategory.sortOrder) || 100,
        active: true
      });
      if (result.success) {
        setSuccessMessage(`Category "${newCategory.name.trim()}" added`);
        setNewCategory({ name: '', code: '', sortOrder: 100 });
        await loadCategories();
        if (onCategoriesChanged) onCategoriesChanged();
      } else {
        setError(result.error || 'Failed to create category');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditDraft({
      name: category.name || '',
      code: category.code || '',
      sortOrder: category.sortOrder ?? 100,
      active: category.active !== false
    });
    setError(null);
    setSuccessMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: '', code: '', sortOrder: 100, active: true });
  };

  const handleDelete = async (category) => {
    setError(null);
    setSuccessMessage('');

    // Check if any products use this category
    const countResult = await countProductsInCategory(category.name);
    const usage = countResult.success ? countResult.count : 0;

    let confirmMsg = `Delete category "${category.name}" (${category.code})?`;
    if (usage > 0) {
      confirmMsg +=
        `\n\nWARNING: ${usage} product(s) currently use this category. ` +
        `They will NOT be deleted but will be left with an orphaned category name. ` +
        `Consider editing those products to assign a different category first.\n\nDelete anyway?`;
    }
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(category.id);
    try {
      const result = await deleteCategory(category.id);
      if (result.success) {
        setSuccessMessage(`Category "${category.name}" deleted`);
        await loadCategories();
        if (onCategoriesChanged) onCategoriesChanged();
      } else {
        setError(result.error || 'Failed to delete category');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const saveEdit = async (categoryId) => {
    setError(null);
    setSuccessMessage('');
    if (!editDraft.name.trim() || !editDraft.code.trim()) {
      setError('Name and code are required');
      return;
    }
    if (!/^[A-Za-z]{2,6}$/.test(editDraft.code.trim())) {
      setError('Code must be 2 to 6 letters');
      return;
    }

    setSavingEdit(true);
    try {
      const result = await updateCategory(categoryId, {
        name: editDraft.name.trim(),
        code: editDraft.code.trim(),
        sortOrder: Number(editDraft.sortOrder) || 100,
        active: editDraft.active
      });
      if (result.success) {
        setSuccessMessage('Category updated');
        setEditingId(null);
        await loadCategories();
        if (onCategoriesChanged) onCategoriesChanged();
      } else {
        setError(result.error || 'Failed to update category');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[rgb(52,69,157)]">Manage Accessory Categories</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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

          {/* Add new category */}
          <div className="border rounded p-4 bg-gray-50">
            <h3 className="font-semibold text-[rgb(52,69,157)] mb-3">Add New Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Charger"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Code (2-6 letters)</label>
                <input
                  type="text"
                  value={newCategory.code}
                  onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
                  placeholder="CHG"
                  maxLength={6}
                  className="w-full px-3 py-2 border rounded text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={newCategory.sortOrder}
                  onChange={(e) => setNewCategory({ ...newCategory, sortOrder: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded text-sm ${
                    saving
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                  }`}
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Existing categories */}
          <div>
            <h3 className="font-semibold text-[rgb(52,69,157)] mb-2">Existing Categories</h3>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-[rgb(52,69,157)] mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading categories…</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm border rounded bg-gray-50">
                No categories yet.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-b px-3 py-2 text-left">Name</th>
                      <th className="border-b px-3 py-2 text-left">Code</th>
                      <th className="border-b px-3 py-2 text-left">Sort</th>
                      <th className="border-b px-3 py-2 text-center">Active</th>
                      <th className="border-b px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const isEditing = editingId === cat.id;
                      return (
                        <tr key={cat.id} className="hover:bg-gray-50">
                          <td className="border-b px-3 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft.name}
                                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            ) : (
                              cat.name
                            )}
                          </td>
                          <td className="border-b px-3 py-2 font-mono">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft.code}
                                disabled
                                title="Category code is immutable — it is used as the document ID and in SKU generation"
                                className="w-full px-2 py-1 border rounded text-sm font-mono uppercase bg-gray-100 text-gray-600 cursor-not-allowed"
                              />
                            ) : (
                              cat.code
                            )}
                          </td>
                          <td className="border-b px-3 py-2">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editDraft.sortOrder}
                                onChange={(e) => setEditDraft({ ...editDraft, sortOrder: e.target.value })}
                                className="w-20 px-2 py-1 border rounded text-sm"
                              />
                            ) : (
                              cat.sortOrder ?? '-'
                            )}
                          </td>
                          <td className="border-b px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={editDraft.active}
                                onChange={(e) => setEditDraft({ ...editDraft, active: e.target.checked })}
                              />
                            ) : (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs ${
                                  cat.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {cat.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="border-b px-3 py-2 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(cat.id)}
                                  disabled={savingEdit}
                                  className="p-1 text-green-700 hover:bg-green-50 rounded"
                                  title="Save"
                                >
                                  {savingEdit ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(cat)}
                                  className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(cat)}
                                  disabled={deletingId === cat.id}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Delete"
                                >
                                  {deletingId === cat.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

AccessoryCategoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCategoriesChanged: PropTypes.func
};

export default AccessoryCategoryModal;
