{/* Part 1 Start - Imports */}
import PropTypes from 'prop-types';
import { RefreshCw, Save, XCircle } from 'lucide-react';
{/* Part 1 End - Imports */}

{/* Part 2 Start - Component Definition */}
const InventoryEditForm = ({ 
  editFormData, 
  handleEditInputChange, 
  handleSaveEdit, 
  handleCancelEdit, 
  itemId, 
  savingItemId 
}) => {
{/* Part 2 End - Component Definition */}

  {/* Part 3 Start - Helper Functions */}
  // NEW: Function to format price with currency - read-only display
  const formatPrice = (price) => {
    if (!price && price !== 0) return '-';
    return `₱${price.toLocaleString()}`;
  };
  {/* Part 3 End - Helper Functions */}

  {/* Part 4 Start - Component Render */}
  return (
    <tr className="hover:bg-gray-50">
      <td className="border px-2 py-3 whitespace-nowrap">
        <input
          type="text"
          name="manufacturer"
          value={editFormData.manufacturer}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded"
        />
      </td>
      <td className="border px-2 py-3 whitespace-nowrap">
        <input
          type="text"
          name="model"
          value={editFormData.model}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded"
        />
      </td>
      <td className="border px-2 py-3 whitespace-nowrap">
        <input
          type="text"
          name="ram"
          value={editFormData.ram}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded"
        />
      </td>
      <td className="border px-2 py-3 whitespace-nowrap">
        <input
          type="text"
          name="storage"
          value={editFormData.storage}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded"
        />
      </td>
      <td className="border px-2 py-3 whitespace-nowrap">
        <input
          type="text"
          name="color"
          value={editFormData.color}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded"
        />
      </td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">
        <input
          type="text"
          name="imei1"
          value={editFormData.imei1}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded font-mono"
        />
      </td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">
        <input
          type="text"
          name="barcode"
          value={editFormData.barcode}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded font-mono"
        />
      </td>
      {/* NEW: Added retail price column - read-only display */}
      <td className="border px-2 py-3 whitespace-nowrap text-right">
        <span className="text-gray-600 font-medium">
          {formatPrice(editFormData.retailPrice)}
        </span>
      </td>
      <td className="border px-2 py-3 whitespace-nowrap text-xs text-gray-500">
        {new Date().toLocaleDateString('en-US')}
      </td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <select
          name="status"
          value={editFormData.status}
          onChange={handleEditInputChange}
          className="w-full p-1 border rounded text-center"
        >
          <option value="On-Hand">Stock</option>
          <option value="On-Display">On-Display</option>
          <option value="Sold">Sold</option>
          <option value="Reserved">Reserved</option>
          <option value="Defective">Defective</option>
        </select>
      </td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => handleSaveEdit(itemId)}
            disabled={savingItemId === itemId}
            className="p-1 text-green-600 hover:text-green-800"
            title="Save changes"
          >
            {savingItemId === itemId ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 text-red-600 hover:text-red-800"
            title="Cancel edit"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
{/* Part 4 End - Component Render */}

{/* Part 5 Start - PropTypes Definition */}
InventoryEditForm.propTypes = {
  editFormData: PropTypes.object.isRequired,
  handleEditInputChange: PropTypes.func.isRequired,
  handleSaveEdit: PropTypes.func.isRequired,
  handleCancelEdit: PropTypes.func.isRequired,
  itemId: PropTypes.string.isRequired,
  savingItemId: PropTypes.string
};
{/* Part 5 End - PropTypes Definition */}

{/* Part 6 Start - Export */}
export default InventoryEditForm;
{/* Part 6 End - Export */}