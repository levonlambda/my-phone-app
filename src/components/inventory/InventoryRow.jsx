{/* Part 1 Start - Imports */}
import PropTypes from 'prop-types';
import { Edit, Trash2, FileEdit } from 'lucide-react';
import { useState, useEffect } from 'react';
import supplierService from '../../services/supplierService';
{/* Part 1 End - Imports */}

{/* Part 2 Start - Component Definition */}
const InventoryRow = ({
  item,
  handleEditClick,
  handleDeleteClick,
  handleEditDetailsClick // NEW: Add handler for edit details
}) => {
{/* Part 2 End - Component Definition */}

  {/* Part 3 Start - Helper Functions */}
  // State for supplier name lookup
  const [supplierName, setSupplierName] = useState('N/A');
  
  // Fetch supplier name when component mounts or supplier changes
  useEffect(() => {
    async function fetchSupplierName() {
      if (item.supplier) {
        try {
          const result = await supplierService.getSupplierById(item.supplier);
          if (result.success && result.supplier) {
            setSupplierName(result.supplier.supplierName);
          } else {
            setSupplierName('N/A');
          }
        } catch (error) {
          console.error('Error fetching supplier name:', error);
          setSupplierName('N/A');
        }
      } else {
        setSupplierName('N/A');
      }
    }
    
    fetchSupplierName();
  }, [item.supplier]);

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
  {/* Part 3 End - Helper Functions */}
  
  {/* Part 4 Start - Component Render */}
  return (
    <tr className="hover:bg-gray-50">
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.manufacturer}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.model}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-center">{item.ram}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-center">{item.storage}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.color}</td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm">{item.imei1}</td>
      {/* UPDATED: Replaced barcode with serial number */}
      <td className="border px-2 py-3 whitespace-nowrap text-sm uppercase">
        {item.serialNumber || 'N/A'}
      </td>
      {/* NEW: Added supplier column */}
      <td className="border px-2 py-3 whitespace-nowrap text-sm">
        {supplierName}
      </td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-right">
        <span className="text-gray-600">
          {formatPrice(item.retailPrice)}
        </span>
      </td>
      <td className="border px-2 py-3 whitespace-nowrap text-sm text-gray-500">
        {item.lastUpdated || '-'}
      </td>
      <td className="border px-2 py-3 text-center whitespace-nowrap">
        <span className={`px-2 py-1 text-sm rounded-full ${
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
{/* Part 4 End - Component Render */}

{/* Part 5 Start - PropTypes Definition */}
InventoryRow.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    manufacturer: PropTypes.string.isRequired,
    model: PropTypes.string.isRequired,
    ram: PropTypes.string.isRequired,
    storage: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    imei1: PropTypes.string.isRequired,
    serialNumber: PropTypes.string, // FIXED: Added serialNumber
    supplier: PropTypes.string, // FIXED: Added supplier
    retailPrice: PropTypes.number, // NEW: Added retailPrice prop
    status: PropTypes.string.isRequired,
    lastUpdated: PropTypes.string
  }).isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired,
  handleEditDetailsClick: PropTypes.func.isRequired // NEW: Add prop type
};
{/* Part 5 End - PropTypes Definition */}

{/* Part 6 Start - Export */}
export default InventoryRow;
{/* Part 6 End - Export */}