import PropTypes from 'prop-types';
import { Edit } from 'lucide-react';
import { Trash2 } from 'lucide-react';

const InventoryRow = ({ 
  item, 
  handleEditClick, 
  handleDeleteClick 
}) => {
  // Function to format the date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // If it's already in MM/DD/YYYY format, return as is
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      return dateString;
    }
    // Otherwise try to parse and format
    try {
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return dateString;
    }
  };
  
  // Function to get status display text
  const getStatusDisplay = (status) => {
    return status === 'On-Hand' ? 'Stock' : status;
  };
  
  return (
    <tr className="hover:bg-gray-50">
      <td className="border px-2 py-3 whitespace-nowrap">{item.manufacturer}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.model}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.ram}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.storage}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.color}</td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">{item.imei1}</td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">{item.barcode || '-'}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-xs">{formatDate(item.lastUpdated)}</td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${
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
            title="Edit item"
          >
            <Edit className="h-5 w-5" />
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
    status: PropTypes.string.isRequired,
    lastUpdated: PropTypes.string
  }).isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired
};

export default InventoryRow;