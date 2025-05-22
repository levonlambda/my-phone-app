import PropTypes from 'prop-types';
import { X, Monitor, Cpu, Camera, Battery, Palette } from 'lucide-react';

const PhoneDetailModal = ({ isOpen, phone, onClose }) => {
  if (!isOpen || !phone) return null;

  const SpecRow = ({ label, value }) => (
    <div className="flex items-center py-0.5">
      <p className="text-[rgb(52,69,157)] w-36 text-sm">{label}:</p>
      <p className="text-sm">{value}</p>
    </div>
  );
  
  SpecRow.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  };

  const formatArray = (arr) => {
    if (!arr || !Array.isArray(arr)) return '-';
    return arr.join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[rgb(52,69,157)]">
            {phone.manufacturer} {phone.model}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Display Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Display</h3>
            </div>
            <div className="ml-7">
              <SpecRow label="Type" value={phone.display || '-'} />
              <SpecRow label="Resolution" value={phone.resolution || '-'} />
              {phone.resolution_extra && (
                <SpecRow label="Refresh Rate" value={`${phone.resolution_extra} Hz`} />
              )}
              {phone.resolution_extra2 && (
                <SpecRow label="Pixel Density" value={`${phone.resolution_extra2} ppi`} />
              )}
              <SpecRow label="Protection" value={phone.protection || '-'} />
            </div>
          </div>

          {/* Performance Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Performance</h3>
            </div>
            <div className="ml-7">
              <SpecRow label="OS" value={phone.os || '-'} />
              <SpecRow label="Chipset" value={phone.chipset || '-'} />
              {phone.chipset_extra && (
                <SpecRow label="Benchmark" value={phone.chipset_extra} />
              )}
              <SpecRow label="CPU" value={phone.cpu || '-'} />
              <SpecRow label="GPU" value={phone.gpu || '-'} />
              <SpecRow label="RAM" value={formatArray(phone.storage_extra)} />
              <SpecRow label="Storage" value={formatArray(phone.storage)} />
            </div>
          </div>

          {/* Camera Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Camera</h3>
            </div>
            <div className="ml-7">
              <SpecRow label="Rear Camera" value={phone.rearCamera || '-'} />
              <SpecRow label="Front Camera" value={phone.frontCamera || '-'} />
            </div>
          </div>

          {/* Battery Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Battery className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Battery</h3>
            </div>
            <div className="ml-7">
              <SpecRow label="Capacity" value={phone.battery ? `${phone.battery} mAh` : '-'} />
              <SpecRow label="Wired Charging" value={phone.wiredCharging ? `${phone.wiredCharging}W` : '-'} />
              <SpecRow label="Wireless Charging" value={phone.wirelessCharging ? `${phone.wirelessCharging}W` : '-'} />
            </div>
          </div>

          {/* Misc Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Additional Info</h3>
            </div>
            <div className="ml-7">
              <SpecRow label="Released" value={phone.released || '-'} />
              <SpecRow label="Weight" value={phone.weight ? `${phone.weight}g` : '-'} />
              
              {/* Colors Section */}
              <div className="flex py-0.5">
                <p className="text-[rgb(52,69,157)] w-36 text-sm">Colors:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(phone.colors) && phone.colors.length > 0 ? (
                    phone.colors.map((color, index) => (
                      <span 
                        key={index} 
                        className="inline-block px-2 py-1 text-xs bg-gray-100 rounded-full"
                      >
                        {color}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

PhoneDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  phone: PropTypes.object,
  onClose: PropTypes.func.isRequired
};

export default PhoneDetailModal;