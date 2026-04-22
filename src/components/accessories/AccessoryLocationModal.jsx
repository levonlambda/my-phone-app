import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Plus,
  Check,
  AlertCircle,
  RefreshCw,
  Edit,
  Save,
  Trash2,
  Star
} from 'lucide-react';
import {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  countInventoryAtLocation,
  seedDefaultLocationIfEmpty
} from '../../services/accessoryLocationService';

const AccessoryLocationModal = ({ isOpen, onClose, onLocationsChanged }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    sortOrder: 100,
    isPrimary: false
  });
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    address: '',
    sortOrder: 100,
    active: true,
    isPrimary: false
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDefaultLocationIfEmpty();
      const result = await getAllLocations();
      if (result.success) {
        setLocations(result.locations);
      } else {
        setError(result.error || 'Failed to load locations');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadLocations();
      setSuccessMessage('');
      setError(null);
      setEditingId(null);
      setNewLocation({ name: '', address: '', sortOrder: 100, isPrimary: false });
    }
  }, [isOpen, loadLocations]);

  // When a location is marked primary, unmark all others (async follow-up).
  const enforceSinglePrimary = async (newlyPrimaryId) => {
    const others = locations.filter((l) => l.id !== newlyPrimaryId && l.isPrimary);
    await Promise.all(
      others.map((l) => updateLocation(l.id, { isPrimary: false }))
    );
  };

  const handleCreate = async () => {
    setError(null);
    setSuccessMessage('');
    const name = newLocation.name.trim();
    if (!name) {
      setError('Location name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await createLocation({
        name,
        address: newLocation.address.trim(),
        sortOrder: Number(newLocation.sortOrder) || 100,
        isPrimary: newLocation.isPrimary,
        active: true
      });
      if (result.success) {
        if (newLocation.isPrimary) {
          await enforceSinglePrimary(result.id);
        }
        setSuccessMessage(`Location "${name}" added`);
        setNewLocation({ name: '', address: '', sortOrder: 100, isPrimary: false });
        await loadLocations();
        if (onLocationsChanged) onLocationsChanged();
      } else {
        setError(result.error || 'Failed to create location');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (location) => {
    setEditingId(location.id);
    setEditDraft({
      name: location.name || '',
      address: location.address || '',
      sortOrder: location.sortOrder ?? 100,
      active: location.active !== false,
      isPrimary: Boolean(location.isPrimary)
    });
    setError(null);
    setSuccessMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: '', address: '', sortOrder: 100, active: true, isPrimary: false });
  };

  const saveEdit = async (locationId) => {
    setError(null);
    setSuccessMessage('');
    const name = editDraft.name.trim();
    if (!name) {
      setError('Location name is required');
      return;
    }

    setSavingEdit(true);
    try {
      const result = await updateLocation(locationId, {
        name,
        address: editDraft.address.trim(),
        sortOrder: Number(editDraft.sortOrder) || 100,
        active: editDraft.active,
        isPrimary: editDraft.isPrimary
      });
      if (result.success) {
        if (editDraft.isPrimary) {
          await enforceSinglePrimary(locationId);
        }
        setSuccessMessage('Location updated');
        setEditingId(null);
        await loadLocations();
        if (onLocationsChanged) onLocationsChanged();
      } else {
        setError(result.error || 'Failed to update location');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (location) => {
    setError(null);
    setSuccessMessage('');

    const countResult = await countInventoryAtLocation(location.id);
    const usage = countResult.success ? countResult.count : 0;

    let confirmMsg = `Delete location "${location.name}"?`;
    if (usage > 0) {
      confirmMsg +=
        `\n\nWARNING: ${usage} product(s) currently have stock at this location. ` +
        `Those inventory records will be left orphaned. Consider moving or zeroing out ` +
        `stock at this location first.\n\nDelete anyway?`;
    }
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(location.id);
    try {
      const result = await deleteLocation(location.id);
      if (result.success) {
        setSuccessMessage(`Location "${location.name}" deleted`);
        await loadLocations();
        if (onLocationsChanged) onLocationsChanged();
      } else {
        setError(result.error || 'Failed to delete location');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[rgb(52,69,157)]">Manage Stores (Locations)</h2>
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

          {/* Add new */}
          <div className="border rounded p-4 bg-gray-50">
            <h3 className="font-semibold text-[rgb(52,69,157)] mb-3">Add New Store</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Store Name
                </label>
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, name: e.target.value })
                  }
                  placeholder="e.g., Main Branch"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Address (optional)
                </label>
                <input
                  type="text"
                  value={newLocation.address}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, address: e.target.value })
                  }
                  placeholder="Street, city"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={newLocation.sortOrder}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, sortOrder: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="md:col-span-4 flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="new-loc-primary"
                  checked={newLocation.isPrimary}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, isPrimary: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="new-loc-primary" className="text-sm text-gray-700">
                  Set as primary (default in forms)
                </label>
              </div>
              <div className="md:col-span-1 flex items-end">
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

          {/* Existing */}
          <div>
            <h3 className="font-semibold text-[rgb(52,69,157)] mb-2">Existing Stores</h3>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-[rgb(52,69,157)] mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading stores…</p>
              </div>
            ) : locations.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm border rounded bg-gray-50">
                No stores yet.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-b px-3 py-2 text-left">Name</th>
                      <th className="border-b px-3 py-2 text-left">Address</th>
                      <th className="border-b px-3 py-2 text-left">Sort</th>
                      <th className="border-b px-3 py-2 text-center">Primary</th>
                      <th className="border-b px-3 py-2 text-center">Active</th>
                      <th className="border-b px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => {
                      const isEditing = editingId === loc.id;
                      return (
                        <tr key={loc.id} className="hover:bg-gray-50">
                          <td className="border-b px-3 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft.name}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, name: e.target.value })
                                }
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            ) : (
                              loc.name
                            )}
                          </td>
                          <td className="border-b px-3 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft.address}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, address: e.target.value })
                                }
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            ) : (
                              loc.address || <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="border-b px-3 py-2">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editDraft.sortOrder}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, sortOrder: e.target.value })
                                }
                                className="w-20 px-2 py-1 border rounded text-sm"
                              />
                            ) : (
                              loc.sortOrder ?? '-'
                            )}
                          </td>
                          <td className="border-b px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={editDraft.isPrimary}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, isPrimary: e.target.checked })
                                }
                              />
                            ) : loc.isPrimary ? (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500 inline" />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="border-b px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={editDraft.active}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, active: e.target.checked })
                                }
                              />
                            ) : (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs ${
                                  loc.active !== false
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {loc.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="border-b px-3 py-2 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(loc.id)}
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
                                  onClick={() => startEdit(loc)}
                                  className="p-1 text-[rgb(52,69,157)] hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(loc)}
                                  disabled={deletingId === loc.id}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingId === loc.id ? (
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

AccessoryLocationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLocationsChanged: PropTypes.func
};

export default AccessoryLocationModal;
