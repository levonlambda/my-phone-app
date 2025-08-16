{/* Part 1 Start - Imports and Dependencies */}
import PropTypes from 'prop-types';
{/* Part 1 End - Imports and Dependencies */}

{/* Part 2 Start - Component Definition */}
const PhoneAdditionalInfo = ({
  imei1,
  imei2,
  barcode,
  serialNumber,
  location,
  supplier,
  suppliers,
  status,
  lastUpdated,
  handleImei1Change,
  handleImei2Change,
  handleBarcodeChange,
  handleSerialNumberChange,
  handleLocationChange,
  handleSupplierChange,
  handleStatusChange,
  imei1Error,
  imei2Error,
}) => {
{/* Part 2 End - Component Definition */}

{/* Part 3 Start - Component Render */}
  return (
    <div className="pt-4 border-t border-gray-300 space-y-4">
      <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Additional Details</h3>
      
      {/* IMEI Fields */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">
            IMEI 1: <span className="text-gray-500 font-normal text-sm">(Required if no Serial Number)</span>
          </label>
          <input 
            type="text" 
            className={`w-full p-2 border rounded ${imei1Error ? 'border-red-500' : ''}`}
            value={imei1}
            onChange={handleImei1Change}
            placeholder="15-digit IMEI number"
            maxLength={15}
          />
          {imei1Error && (
            <p className="text-red-500 text-sm mt-1">{imei1Error}</p>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">IMEI 2:</label>
          <input 
            type="text" 
            className={`w-full p-2 border rounded ${imei2Error ? 'border-red-500' : ''}`}
            value={imei2}
            onChange={handleImei2Change}
            placeholder="Optional"
            maxLength={15}
          />
          {imei2Error && (
            <p className="text-red-500 text-sm mt-1">{imei2Error}</p>
          )}
        </div>
      </div>
      
      {/* Barcode and Serial Number */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Barcode:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={barcode}
            onChange={handleBarcodeChange}
            placeholder="Product barcode"
            required
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">
            Serial Number: <span className="text-gray-500 font-normal text-sm">(Required if no IMEI1)</span>
          </label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={serialNumber}
            onChange={handleSerialNumberChange}
            placeholder="Device serial number"
          />
        </div>
      </div>
      
      {/* Location and Supplier Fields - NEW */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Location:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={location}
            onChange={handleLocationChange}
            placeholder="Enter location"
            required
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Supplier:</label>
          <select
            className="w-full p-2 border rounded"
            value={supplier}
            onChange={handleSupplierChange}
            required
          >
            <option value="">-- Select Supplier --</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>
                {sup.supplierName}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Status and Last Updated Fields */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Status:</label>
          <select
            className="w-full p-2 border rounded"
            value={status}
            onChange={handleStatusChange}
            required
          >
            <option value="On-Hand">Stock</option>
            <option value="On-Display">On-Display</option>
            <option value="Sold">Sold</option>
            <option value="Reserved">Reserved</option>
            <option value="Defective">Defective</option>
          </select>
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Last Updated:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded bg-gray-100"
            value={lastUpdated}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};
{/* Part 3 End - Component Render */}

{/* Part 4 Start - PropTypes Validation */}
PhoneAdditionalInfo.propTypes = {
  imei1: PropTypes.string.isRequired,
  imei2: PropTypes.string.isRequired,
  barcode: PropTypes.string.isRequired,
  serialNumber: PropTypes.string.isRequired,
  location: PropTypes.string.isRequired,
  supplier: PropTypes.string.isRequired,
  suppliers: PropTypes.array.isRequired,
  status: PropTypes.string.isRequired,
  lastUpdated: PropTypes.string.isRequired,
  handleImei1Change: PropTypes.func.isRequired,
  handleImei2Change: PropTypes.func.isRequired,
  handleBarcodeChange: PropTypes.func.isRequired,
  handleSerialNumberChange: PropTypes.func.isRequired,
  handleLocationChange: PropTypes.func.isRequired,
  handleSupplierChange: PropTypes.func.isRequired,
  handleStatusChange: PropTypes.func.isRequired,
  imei1Error: PropTypes.string,
  imei2Error: PropTypes.string
};
{/* Part 4 End - PropTypes Validation */}

{/* Part 5 Start - Export */}
export default PhoneAdditionalInfo;
{/* Part 5 End - Export */}