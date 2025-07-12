{/* Part 1 Start - Imports */}
import { useState } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
{/* Part 1 End - Imports */}

{/* Part 2 Start - Component Definition */}
const PhoneAdvancedSearch = ({ isOpen, onClose, onSearch, manufacturers }) => {
{/* Part 2 End - Component Definition */}

  {/* Part 3 Start - State Management */}
  const [searchCriteria, setSearchCriteria] = useState({
    manufacturer: '',
    model: '',
    ram: '',
    storage: '',
    display: '',
    battery: { min: '', max: '' },
    chipset: ''
  });
  {/* Part 3 End - State Management */}

  {/* Part 4 Start - Early Return */}
  if (!isOpen) return null;
  {/* Part 4 End - Early Return */}

  {/* Part 5 Start - Event Handlers */}
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      // Handle nested fields like battery.min
      const [parent, child] = name.split('.');
      setSearchCriteria(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setSearchCriteria(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchCriteria);
    onClose();
  };

  const handleReset = () => {
    setSearchCriteria({
      manufacturer: '',
      model: '',
      ram: '',
      storage: '',
      display: '',
      battery: { min: '', max: '' },
      chipset: ''
    });
  };
  {/* Part 5 End - Event Handlers */}

  {/* Part 6 Start - Component Render */}
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-xl w-full">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[rgb(52,69,157)]">Advanced Search</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manufacturer
                </label>
                <select
                  name="manufacturer"
                  value={searchCriteria.manufacturer}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Any Manufacturer</option>
                  {manufacturers.map(manufacturer => (
                    <option key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  name="model"
                  value={searchCriteria.model}
                  onChange={handleInputChange}
                  placeholder="e.g. Galaxy S25"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RAM
                </label>
                <input
                  type="text"
                  name="ram"
                  value={searchCriteria.ram}
                  onChange={handleInputChange}
                  placeholder="e.g. 8GB"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage
                </label>
                <input
                  type="text"
                  name="storage"
                  value={searchCriteria.storage}
                  onChange={handleInputChange}
                  placeholder="e.g. 256GB"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Type
                </label>
                <input
                  type="text"
                  name="display"
                  value={searchCriteria.display}
                  onChange={handleInputChange}
                  placeholder="e.g. AMOLED"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chipset
                </label>
                <input
                  type="text"
                  name="chipset"
                  value={searchCriteria.chipset}
                  onChange={handleInputChange}
                  placeholder="e.g. Snapdragon"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Battery Capacity (mAh)
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      name="battery.min"
                      value={searchCriteria.battery.min}
                      onChange={handleInputChange}
                      placeholder="Min"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      name="battery.max"
                      value={searchCriteria.battery.max}
                      onChange={handleInputChange}
                      placeholder="Max"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
{/* Part 6 End - Component Render */}

{/* Part 7 Start - PropTypes Definition */}
PhoneAdvancedSearch.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  manufacturers: PropTypes.array.isRequired
};
{/* Part 7 End - PropTypes Definition */}

{/* Part 8 Start - Export */}
export default PhoneAdvancedSearch;
{/* Part 8 End - Export */}