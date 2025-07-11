import PropTypes from 'prop-types';
import { Edit, Trash2, FileEdit } from 'lucide-react';

const InventoryRow = ({
  item,
  handleEditClick,
  handleDeleteClick,
  handleEditDetailsClick // NEW: Add handler for edit details
}) => {
  // Helper function to get status display
  const getStatusDisplay = (status) => {
    const statusMap = {
      'On-Hand': 'Stock',
      'On-Display': 'On-Display',
      'Sold': 'Sold',
      'Reserved': 'Reserved',
      'Defective': 'Defective'
    };
    return statusMap[status] || status;
  };
  
  // Format price with peso sign and commas
  const formatPrice = (price) => {
    return `₱${(price || 0).toLocaleString()}`;
  };
  
  return (
    <tr className="hover:bg-gray-50">
      <td className="border px-2 py-3 whitespace-nowrap text-sm font-medium">{item.manufacturer}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.model}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-center">{item.ram}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-center">{item.storage}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.color}</td>
      <td className="border px-2 py-3 whitespace-nowrap font-mono text-xs">{item.imei1}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-xs font-mono uppercase">{item.barcode || '-'}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-right">
        <span className="text-gray-600 font-medium">
          {formatPrice(item.retailPrice)}
        </span>
      </td>
      <td className="border px-2 py-3 whitespace-nowrap text-xs text-gray-500">
        {item.lastUpdated || '-'}
      </td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          item.status === 'On-Hand' ? 'bg-blue-100 text-blue-800' :
          item.status === 'On-Display' ? 'bg-yellow-100 text-yellow-800' :
          item.status === 'Sold' ? 'bg-purple-100 text-purple-800' :
          item.status === 'Reserved' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {getStatusDisplay(item.status)}
        </span>
      </td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => handleEditClick(item)}
            className="p-1 text-blue-600 hover:text-blue-800"
            title="Quick edit"
          >
            <Edit className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleEditDetailsClick(item)}
            className="p-1 text-green-600 hover:text-green-800"
            title="Edit full details"
          >
            <FileEdit className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDeleteClick(item.id)}
            className="p-1 text-red-600 hover:text-red-800"
            title="Delete item"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

InventoryRow.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    manufacturer: PropTypes.string.isRequired,
    model: PropTypes.string.isRequired,
    ram: PropTypes.string.isRequired,
    storage: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    imei1: PropTypes.string.isRequired,
    barcode: PropTypes.string,
    retailPrice: PropTypes.number, // NEW: Added retailPrice prop
    status: PropTypes.string.isRequired,
    lastUpdated: PropTypes.string
  }).isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired,
  handleEditDetailsClick: PropTypes.func.isRequired // NEW: Add prop type
};

export default InventoryRow;