import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Battery, Camera, Cpu, Monitor, Palette, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useGlobalState } from '../context/GlobalStateContext';

// Add capitalizeWords helper function
const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to clean and validate numeric input during typing
const validateNumericInput = (value) => {
  if (!value) return '';
  // Only allow digits, one decimal point, and commas in proper positions
  const cleaned = value
    // Remove anything that's not a digit, comma, or decimal
    .replace(/[^0-9,.]|\.(?=.*\.)/g, '')
    // Remove commas that aren't followed by 3 digits
    .replace(/,(?![0-9]{3})/g, '')
    // Remove multiple consecutive commas
    .replace(/,+/g, ',');
    
  return cleaned;
};

// Helper function to process numeric value before saving to Firebase
const processNumericValue = (value) => {
  if (!value) return null;
  // Remove commas and convert to number
  const cleanValue = value.replace(/,/g, '');
  return cleanValue ? Number(cleanValue) : null;
};

const InputField = ({ label, name, value, width = "w-40", onChange }) => (
  <div className="flex items-center py-0.5">
    <p className={`text-[rgb(52,69,157)] ${width} text-base`}>{label}:</p>
    <input
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      className="text-base flex-1 border rounded px-2 py-1"
    />
  </div>
);

const InputFieldWithExtra = ({ label, name, value, extraValue, extraPlaceholder, mainPlaceholder = "", onChange, width = "w-40" }) => (
  <div className="flex items-center py-0.5">
    <p className={`text-[rgb(52,69,157)] ${width} text-base`}>{label}:</p>
    <div className="flex-1 flex gap-2">
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="text-base flex-1 border rounded px-2 py-1"
        placeholder={mainPlaceholder}
      />
      <div className="w-32">
        <input
          type="text"
          name={`${name}_extra`}
          value={extraValue || ''}
          onChange={onChange}
          className="text-base w-full border rounded px-2 py-1"
          placeholder={extraPlaceholder}
        />
      </div>
    </div>
  </div>
);

const InputFieldWithTwoExtras = ({ label, name, value, extraValue, extraValue2, extraPlaceholder, extraPlaceholder2, mainPlaceholder = "", onChange, width = "w-40" }) => (
  <div className="flex items-center py-0.5">
    <p className={`text-[rgb(52,69,157)] ${width} text-base`}>{label}:</p>
    <div className="flex-1 flex gap-2">
      <div className="flex-1">
        <input
          type="text"
          name={name}
          value={value || ''}
          onChange={onChange}
          className="text-base w-full border rounded px-2 py-1" 
          placeholder={mainPlaceholder}
        />
      </div>
      <div className="w-32">
        <input
          type="text"
          name={`${name}_extra`}
          value={extraValue || ''}
          onChange={onChange}
          className="text-base w-full border rounded px-2 py-1"
          placeholder={extraPlaceholder}
        />
      </div>
      <div className="w-32">
        <input
          type="text"
          name={`${name}_extra2`}
          value={extraValue2 || ''}
          onChange={onChange}
          className="text-base w-full border rounded px-2 py-1"
          placeholder={extraPlaceholder2}
        />
      </div>
    </div>
  </div>
);

InputFieldWithExtra.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  extraValue: PropTypes.string,
  extraPlaceholder: PropTypes.string.isRequired,
  mainPlaceholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  width: PropTypes.string
};

InputFieldWithTwoExtras.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  extraValue: PropTypes.string,
  extraValue2: PropTypes.string,
  extraPlaceholder: PropTypes.string.isRequired,
  extraPlaceholder2: PropTypes.string.isRequired,
  mainPlaceholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  width: PropTypes.string
};

InputField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  width: PropTypes.string,
  onChange: PropTypes.func.isRequired
};

InputField.defaultProps = {
  width: "w-40"
};

const PhoneSpecForm = () => {
  // Access the global state for editing
  const { phoneToEdit, clearPhoneToEdit } = useGlobalState();

  const [formData, setFormData] = useState({
    manufacturer: "",
    model: "",
    released: "",
    weight: "",    
    display: "",
    resolution: "",
    resolution_extra: "",
    resolution_extra2: "", 
    protection: "",
    os: "",
    chipset: "",
    chipset_extra: "",
    cpu: "",
    gpu: "",
    storage: "",
    storage_extra: "",
    rearCamera: "",
    frontCamera: "",
    battery: "",
    wiredCharging: "",
    wirelessCharging: "",
    colors: ""
  });
  
  // State to track if we're editing an existing phone
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Update form data when phoneToEdit changes
  useEffect(() => {
    if (phoneToEdit) {
      // We're in edit mode
      setIsEditing(true);
      setEditId(phoneToEdit.id);
      
      // Format the data for the form
      const formattedData = {
        ...phoneToEdit,
        // Convert arrays to comma-separated strings
        storage: Array.isArray(phoneToEdit.storage) ? phoneToEdit.storage.join(', ') : '',
        storage_extra: Array.isArray(phoneToEdit.storage_extra) ? phoneToEdit.storage_extra.join(', ') : '',
        colors: Array.isArray(phoneToEdit.colors) ? phoneToEdit.colors.join(', ') : '',
        
        // Handle potentially undefined numeric values
        battery: phoneToEdit.battery?.toString() || '',
        wiredCharging: phoneToEdit.wiredCharging?.toString() || '',
        wirelessCharging: phoneToEdit.wirelessCharging?.toString() || '',
        weight: phoneToEdit.weight?.toString() || '',
        resolution_extra: phoneToEdit.resolution_extra?.toString() || '',
        resolution_extra2: phoneToEdit.resolution_extra2?.toString() || '',
        chipset_extra: phoneToEdit.chipset_extra?.toString() || ''
      };
      
      setFormData(formattedData);
    } else {
      // Reset edit state when there's no phone to edit
      setIsEditing(false);
      setEditId(null);
    }
  }, [phoneToEdit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // List of fields that should be numeric
    const numericFields = [
      'price',
      'chipset_extra', // Benchmark
      'battery',     
      'wiredCharging',
      'wirelessCharging',
      'weight',
      'resolution_extra', // Refresh Rate
      'resolution_extra2', // PPI
    ];
  
    // List of fields that can accept any input (documenting for clarity)
    const freeformFields = [
      'resolution',
      'rearCamera',
      'frontCamera',
      'storage',
      'storage_extra', // RAM
    ];
  
    // List of fields that should be uppercase
    const uppercaseFields = [
      'barcode',
      'display' 
    ];
  
    // If it's a numeric field, validate the input
    if (numericFields.includes(name)) {
      const validatedValue = validateNumericInput(value);
      setFormData(prev => ({
        ...prev,
        [name]: validatedValue
      }));
    } 
    // If it's an uppercase field, convert to uppercase while typing
    else if (uppercaseFields.includes(name)) {
      setFormData(prev => ({
        ...prev,
        [name]: value.toUpperCase()
      }));
    }
    // For freeform fields and all others
    else {
      if (freeformFields.includes(name)) {
        console.log(`Processing freeform field: ${name}`);
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const processedData = {
        ...formData,
        // String capitalizations
        manufacturer: capitalizeWords(formData.manufacturer),
        model: capitalizeWords(formData.model),
        released: capitalizeWords(formData.released),
        protection: capitalizeWords(formData.protection),
        os: capitalizeWords(formData.os),
        chipset: capitalizeWords(formData.chipset),
        cpu: capitalizeWords(formData.cpu),
        gpu: capitalizeWords(formData.gpu),
        // Ensure display is uppercase
        display: formData.display?.toUpperCase() || '',
        
        // Numeric conversions
        chipset_extra: processNumericValue(formData.chipset_extra),
        battery: processNumericValue(formData.battery),
        wiredCharging: processNumericValue(formData.wiredCharging),
        wirelessCharging: processNumericValue(formData.wirelessCharging),
        weight: processNumericValue(formData.weight),
        resolution_extra: processNumericValue(formData.resolution_extra),
        resolution_extra2: processNumericValue(formData.resolution_extra2),

        // Array processing for storage and RAM
        storage: formData.storage
          ? formData.storage.split(',').map(item => item.trim()).filter(item => item !== '')
          : [],
        
        storage_extra: formData.storage_extra
          ? formData.storage_extra.split(',').map(item => item.trim()).filter(item => item !== '')
          : [],

        // Array processing for colors
        colors: formData.colors
          ? formData.colors.split(',').map(color => color.trim()).filter(color => color !== '').map(color => capitalizeWords(color))
          : []
      };
  
      if (isEditing && editId) {
        // Update existing document
        const phoneRef = doc(db, 'phones', editId);
        await updateDoc(phoneRef, processedData);
        console.log("Document updated with ID: ", editId);
      } else {
        // Add new document
        const docRef = await addDoc(collection(db, 'phones'), processedData);
        console.log("Document written with ID: ", docRef.id);
      }
      
      // Clear form after successful submission
      setFormData({
        manufacturer: "",
        model: "",
        released: "",
        weight: "",   
        display: "",
        resolution: "",
        resolution_extra: "",
        resolution_extra2: "", 
        protection: "",
        os: "",
        chipset: "",
        chipset_extra: "",
        cpu: "",
        gpu: "",
        storage: "",
        storage_extra: "",
        rearCamera: "",
        frontCamera: "",
        battery: "",
        wiredCharging: "",
        wirelessCharging: "",
        colors: ""
      });
      
      // Reset edit state
      setIsEditing(false);
      setEditId(null);
      clearPhoneToEdit();
  
      alert(`Phone ${isEditing ? 'updated' : 'added'} successfully!`);
    } catch (error) {
      console.error("Error adding/updating document: ", error);
      alert(`Error ${isEditing ? 'updating' : 'adding'} phone. Please try again.`);
    }
  };
  
  // Handle cancel edit
  const handleCancel = () => {
    // Clear form and exit edit mode
    setFormData({
      manufacturer: "",
      model: "",
      released: "",
      weight: "",   
      display: "",
      resolution: "",
      resolution_extra: "",
      resolution_extra2: "", 
      protection: "",
      os: "",
      chipset: "",
      chipset_extra: "",
      cpu: "",
      gpu: "",
      storage: "",
      storage_extra: "",
      rearCamera: "",
      frontCamera: "",
      battery: "",
      wiredCharging: "",
      wirelessCharging: "",
      colors: ""
    });
    
    setIsEditing(false);
    setEditId(null);
    clearPhoneToEdit();
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-[640px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white">
              {isEditing ? 'Edit Phone' : 'Add New Phone'}
            </CardTitle>
          </CardHeader>

          <CardContent className="bg-white p-4 space-y-4">
            {/* Device Info Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Device Info</h3>
              </div>
              <div>
                <InputField label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleInputChange} />
                <InputField label="Model" name="model" value={formData.model} onChange={handleInputChange} />
                <InputField label="Release Date" name="released" value={formData.released} onChange={handleInputChange} />
                <InputField label="Weigh (grams)" name="weight" value={formData.weight} onChange={handleInputChange} />                
              </div>
            </div>

            {/* Display Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Monitor className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Display</h3>
              </div>
              <div>
                <InputFieldWithTwoExtras 
                  label="Resolution" 
                  name="resolution" 
                  value={formData.resolution} 
                  extraValue={formData.resolution_extra}
                  extraValue2={formData.resolution_extra2}
                  extraPlaceholder="Refresh Rate"
                  extraPlaceholder2="PPI"
                  onChange={handleInputChange} 
                />
                <InputField label="Type" name="display" value={formData.display} onChange={handleInputChange} />
                <InputField label="Protection" name="protection" value={formData.protection} onChange={handleInputChange} />
              </div>
            </div>

            {/* Performance Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cpu className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Performance</h3>
              </div>
              <div>
                <InputField label="OS" name="os" value={formData.os} onChange={handleInputChange} />
                <InputFieldWithExtra 
                  label="Chipset" 
                  name="chipset" 
                  value={formData.chipset} 
                  extraValue={formData.chipset_extra}
                  extraPlaceholder="Benchmark"
                  onChange={handleInputChange} 
                />
                <InputField label="CPU" name="cpu" value={formData.cpu} onChange={handleInputChange} />
                <InputField label="GPU" name="gpu" value={formData.gpu} onChange={handleInputChange} />
                
                {/* Custom RAM & Storage field with equal widths and reversed order */}
                <div className="flex items-center py-0.5">
                  <p className="text-[rgb(52,69,157)] w-40 text-base">RAM & Storage:</p>
                  <div className="flex-1 flex gap-2">
                    <div className="w-1/2">
                      <input
                        type="text"
                        name="storage_extra"
                        value={formData.storage_extra || ''}
                        onChange={handleInputChange}
                        className="text-base w-full border rounded px-2 py-1"
                        placeholder="RAM"
                      />
                    </div>
                    <div className="w-1/2">
                      <input
                        type="text"
                        name="storage"
                        value={formData.storage || ''}
                        onChange={handleInputChange}
                        className="text-base w-full border rounded px-2 py-1"
                        placeholder="Storage"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Camera Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Camera className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Camera</h3>
              </div>
              <div>
                <InputField label="Rear Camera" name="rearCamera" value={formData.rearCamera} onChange={handleInputChange} />
                <InputField label="Front Camera" name="frontCamera" value={formData.frontCamera} onChange={handleInputChange} />
              </div>
            </div>

            {/* Battery Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Battery className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Battery</h3>
              </div>
              <div>
                <InputField label="Capacity" name="battery" value={formData.battery} onChange={handleInputChange} />
                <InputField label="Wired Charging" name="wiredCharging" value={formData.wiredCharging} onChange={handleInputChange} />
                <InputField label="Wireless Charging" name="wirelessCharging" value={formData.wirelessCharging} onChange={handleInputChange} />
              </div>
            </div>

            {/* Colors Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Palette className="w-6 h-6 text-[rgb(52,69,157)]" />
                <h3 className="text-xl font-semibold">Available Colors</h3>
              </div>
              <div>
                <InputField 
                  label="Colors" 
                  name="colors" 
                  value={formData.colors} 
                  onChange={handleInputChange}
                  placeholder="Enter colors separated by commas"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-1/3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`${isEditing ? 'w-2/3' : 'w-full'} py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90`}
              >
                {isEditing ? 'Update Phone' : 'Save Phone'}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PhoneSpecForm;