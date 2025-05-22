import PropTypes from 'prop-types';

const PhoneBasicInfo = ({ 
  selectedManufacturer, 
  selectedModel,
  selectedRam,
  selectedStorage,
  manufacturers,
  models,
  ram,
  storage,
  handleRamChange,
  handleStorageChange,
  handleManufacturerChange,
  handleModelChange
}) => {
  return (
    <>
      {/* Manufacturer Selection */}
      <div className="space-y-2">
        <label className="block text-[rgb(52,69,157)] font-semibold">Manufacturer:</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedManufacturer}
          onChange={handleManufacturerChange}
          required
        >
          <option value="">-- Select Manufacturer --</option>
          {manufacturers.map(manufacturer => (
            <option key={manufacturer} value={manufacturer}>
              {manufacturer}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block text-[rgb(52,69,157)] font-semibold">Model:</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedModel}
          onChange={handleModelChange}
          disabled={!selectedManufacturer}
          required
        >
          <option value="">-- Select Model --</option>
          {models.map(model => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {selectedModel && (
        <div className="flex gap-4">
          {/* RAM Selection */}
          <div className="flex-1 space-y-2">
            <label className="block text-[rgb(52,69,157)] font-semibold">RAM:</label>
            <select 
              className="w-full p-2 border rounded"
              value={selectedRam}
              onChange={handleRamChange}
              required={ram.length > 0}
            >
              <option value="">-- Select RAM --</option>
              {ram.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Storage Selection */}
          <div className="flex-1 space-y-2">
            <label className="block text-[rgb(52,69,157)] font-semibold">Storage:</label>
            <select 
              className="w-full p-2 border rounded"
              value={selectedStorage}
              onChange={handleStorageChange}
              required={storage.length > 0}
            >
              <option value="">-- Select Storage --</option>
              {storage.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
};

PhoneBasicInfo.propTypes = {
  selectedManufacturer: PropTypes.string.isRequired,
  selectedModel: PropTypes.string.isRequired,
  selectedRam: PropTypes.string.isRequired,
  selectedStorage: PropTypes.string.isRequired,
  manufacturers: PropTypes.array.isRequired,
  models: PropTypes.array.isRequired,
  ram: PropTypes.array.isRequired,
  storage: PropTypes.array.isRequired,
  handleRamChange: PropTypes.func.isRequired,
  handleStorageChange: PropTypes.func.isRequired,
  handleManufacturerChange: PropTypes.func.isRequired,
  handleModelChange: PropTypes.func.isRequired
};

export default PhoneBasicInfo;