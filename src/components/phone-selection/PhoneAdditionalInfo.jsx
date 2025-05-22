import PropTypes from 'prop-types';

const PhoneAdditionalInfo = ({
  imei1,
  imei2,
  barcode,
  status,
  lastUpdated,
  handleImei1Change,
  handleImei2Change,
  handleBarcodeChange,
  handleStatusChange,
  imei1Error,
  imei2Error,
}) => {
  return (
    <div className="pt-4 border-t border-gray-300 space-y-4">
      <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Additional Details</h3>
      
      {/* IMEI Fields */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">IMEI 1:</label>
          <input 
            type="text" 
            className={`w-full p-2 border rounded ${imei1Error ? 'border-red-500' : ''}`}
            value={imei1}
            onChange={handleImei1Change}
            placeholder="15-digit IMEI number"
            maxLength={15}
            required
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
      
      {/* Barcode */}
      <div className="space-y-2">
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
            <option value="On-Hand">On-Hand</option>
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

PhoneAdditionalInfo.propTypes = {
  imei1: PropTypes.string.isRequired,
  imei2: PropTypes.string.isRequired,
  barcode: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  lastUpdated: PropTypes.string.isRequired,
  handleImei1Change: PropTypes.func.isRequired,
  handleImei2Change: PropTypes.func.isRequired,
  handleBarcodeChange: PropTypes.func.isRequired,
  handleStatusChange: PropTypes.func.isRequired,
  imei1Error: PropTypes.string,
  imei2Error: PropTypes.string
};

export default PhoneAdditionalInfo;