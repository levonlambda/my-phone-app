import PropTypes from 'prop-types';
import { Edit } from 'lucide-react';
import { Trash2 } from 'lucide-react';

const InventoryRow = ({ 
  item, 
  formatNumberWithCommas, 
  handleEditClick, 
  handleDeleteClick 
}) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="border px-2 py-3 whitespace-nowrap">{item.manufacturer}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.model}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.ram}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.storage}</td>
      <td className="border px-2 py-3 whitespace-nowrap">{item.color}</td>
      <td className="border px-2 py-3 text-right whitespace-nowrap">
        {formatNumberWithCommas(item.retailPrice)}
      </td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">{item.imei1}</td>
      <td className="border px-2 py-3 font-mono whitespace-nowrap">{item.barcode || '-'}</td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${
          item.status === 'On-Hand' ? 'bg-green-100 text-green-800' :
          item.status === 'On-Display' ? 'bg-blue-100 text-blue-800' :
          item.status === 'Sold' ? 'bg-red-100 text-red-800' :
          item.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {item.status}
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
    retailPrice: PropTypes.number.isRequired,
    imei1: PropTypes.string.isRequired,
    barcode: PropTypes.string,
    status: PropTypes.string.isRequired
  }).isRequired,
  formatNumberWithCommas: PropTypes.func.isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired
};

export default InventoryRow;