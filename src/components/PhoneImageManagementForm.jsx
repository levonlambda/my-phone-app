{/* Part 1 Start - Imports and Initial State */}
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Image, 
  Upload, 
  Trash2, 
  Save, 
  RefreshCw, 
  Check,
  X,
  AlertCircle,
  Palette
} from 'lucide-react';
import {
  fetchManufacturers,
  fetchModelsForManufacturer,
  fetchPhoneImagesDocument,
  uploadPhoneImage,
  updateHexColor,
  deletePhoneImage
} from '../services/phoneImageService';

const PhoneImageManagementForm = () => {
  // ====== SELECTION STATE ======
  const [manufacturers, setManufacturers] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedModel, setSelectedModel] = useState(null); // { model, docId, colors }
  
  // ====== IMAGE DATA STATE ======
  const [colorData, setColorData] = useState({}); // Data from phone_images collection
  const [editedHexColors, setEditedHexColors] = useState({}); // Locally edited hex colors
  
  // ====== UI STATE ======  
  const [loadingManufacturers, setLoadingManufacturers] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingColor, setUploadingColor] = useState(null); // Which color is currently uploading
  const [uploadingType, setUploadingType] = useState(null); // 'high' or 'low'
  const [savingHexColor, setSavingHexColor] = useState(null); // Which color hex is being saved
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
{/* Part 1 End - Imports and Initial State */}

{/* Part 2 Start - Data Fetching Functions */}
  // ====== FETCH MANUFACTURERS ======
  const loadManufacturers = useCallback(async () => {
    setLoadingManufacturers(true);
    setError(null);
    
    try {
      const result = await fetchManufacturers();
      
      if (result.success) {
        setManufacturers(result.data);
      } else {
        setError(`Failed to load manufacturers: ${result.error}`);
      }
    } catch (err) {
      setError(`Error loading manufacturers: ${err.message}`);
    } finally {
      setLoadingManufacturers(false);
    }
  }, []);

  // ====== FETCH MODELS FOR MANUFACTURER ======
  const loadModels = useCallback(async (manufacturer) => {
    if (!manufacturer) {
      setModels([]);
      return;
    }
    
    setLoadingModels(true);
    setError(null);
    
    try {
      const result = await fetchModelsForManufacturer(manufacturer);
      
      if (result.success) {
        setModels(result.data);
      } else {
        setError(`Failed to load models: ${result.error}`);
      }
    } catch (err) {
      setError(`Error loading models: ${err.message}`);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // ====== FETCH IMAGE DATA FOR SELECTED MODEL ======
  const loadImageData = useCallback(async (phoneDocId) => {
    if (!phoneDocId) {
      setColorData({});
      return;
    }
    
    setLoadingImages(true);
    setError(null);
    
    try {
      const result = await fetchPhoneImagesDocument(phoneDocId);
      
      if (result.success) {
        if (result.exists && result.data?.colors) {
          setColorData(result.data.colors);
          // Initialize edited hex colors with existing values
          const hexColors = {};
          Object.entries(result.data.colors).forEach(([color, data]) => {
            hexColors[color] = data.hexColor || '';
          });
          setEditedHexColors(hexColors);
        } else {
          setColorData({});
          setEditedHexColors({});
        }
      } else {
        setError(`Failed to load image data: ${result.error}`);
      }
    } catch (err) {
      setError(`Error loading image data: ${err.message}`);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  // ====== INITIAL LOAD ======
  useEffect(() => {
    loadManufacturers();
  }, [loadManufacturers]);

  // ====== LOAD MODELS WHEN MANUFACTURER CHANGES ======
  useEffect(() => {
    if (selectedManufacturer) {
      loadModels(selectedManufacturer);
      setSelectedModel(null);
      setColorData({});
      setEditedHexColors({});
    } else {
      setModels([]);
      setSelectedModel(null);
      setColorData({});
      setEditedHexColors({});
    }
  }, [selectedManufacturer, loadModels]);

  // ====== LOAD IMAGE DATA WHEN MODEL CHANGES ======
  useEffect(() => {
    if (selectedModel?.docId) {
      loadImageData(selectedModel.docId);
    } else {
      setColorData({});
      setEditedHexColors({});
    }
  }, [selectedModel, loadImageData]);
{/* Part 2 End - Data Fetching Functions */}

{/* Part 3 Start - Event Handlers */}
  // ====== MANUFACTURER CHANGE HANDLER ======
  const handleManufacturerChange = (e) => {
    setSelectedManufacturer(e.target.value);
    setSuccessMessage('');
  };

  // ====== MODEL CHANGE HANDLER ======
  const handleModelChange = (e) => {
    const modelName = e.target.value;
    if (modelName) {
      const modelData = models.find(m => m.model === modelName);
      setSelectedModel(modelData || null);
    } else {
      setSelectedModel(null);
    }
    setSuccessMessage('');
  };

  // ====== HEX COLOR CHANGE HANDLER ======
  const handleHexColorChange = (colorName, value) => {
    // Ensure it starts with # if not empty
    let hexValue = value;
    if (hexValue && !hexValue.startsWith('#')) {
      hexValue = '#' + hexValue;
    }
    // Limit to 7 characters (#RRGGBB)
    hexValue = hexValue.slice(0, 7);
    
    setEditedHexColors(prev => ({
      ...prev,
      [colorName]: hexValue
    }));
  };

  // ====== SAVE HEX COLOR HANDLER ======
  const handleSaveHexColor = async (colorName) => {
    if (!selectedModel?.docId) return;
    
    setSavingHexColor(colorName);
    setError(null);
    
    try {
      const result = await updateHexColor(
        selectedModel.docId,
        colorName,
        editedHexColors[colorName] || '',
        selectedManufacturer,
        selectedModel.model
      );
      
      if (result.success) {
        // Update local colorData
        setColorData(prev => ({
          ...prev,
          [colorName]: {
            ...prev[colorName],
            hexColor: editedHexColors[colorName] || ''
          }
        }));
        setSuccessMessage(`Hex color for ${colorName} saved successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(`Failed to save hex color: ${result.error}`);
      }
    } catch (err) {
      setError(`Error saving hex color: ${err.message}`);
    } finally {
      setSavingHexColor(null);
    }
  };

  // ====== IMAGE UPLOAD HANDLER ======
  const handleImageUpload = async (colorName, isHighRes, file) => {
    if (!file || !selectedModel?.docId) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    
    setUploadingColor(colorName);
    setUploadingType(isHighRes ? 'high' : 'low');
    setError(null);
    
    try {
      const result = await uploadPhoneImage(
        selectedModel.docId,
        colorName,
        isHighRes,
        file,
        selectedManufacturer,
        selectedModel.model
      );
      
      if (result.success) {
        // Update local colorData with new URL
        setColorData(prev => ({
          ...prev,
          [colorName]: {
            ...prev[colorName],
            [isHighRes ? 'highRes' : 'lowRes']: result.url,
            hexColor: prev[colorName]?.hexColor || ''
          }
        }));
        setSuccessMessage(`${isHighRes ? 'High-res' : 'Low-res'} image for ${colorName} uploaded successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(`Failed to upload image: ${result.error}`);
      }
    } catch (err) {
      setError(`Error uploading image: ${err.message}`);
    } finally {
      setUploadingColor(null);
      setUploadingType(null);
    }
  };

  // ====== IMAGE DELETE HANDLER ======
  const handleDeleteImage = async (colorName, isHighRes) => {
    if (!selectedModel?.docId) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${isHighRes ? 'high-res' : 'low-res'} image for ${colorName}?`
    );
    
    if (!confirmDelete) return;
    
    setUploadingColor(colorName);
    setUploadingType(isHighRes ? 'high' : 'low');
    setError(null);
    
    try {
      const result = await deletePhoneImage(
        selectedModel.docId,
        colorName,
        isHighRes
      );
      
      if (result.success) {
        // Update local colorData to remove URL
        setColorData(prev => ({
          ...prev,
          [colorName]: {
            ...prev[colorName],
            [isHighRes ? 'highRes' : 'lowRes']: ''
          }
        }));
        setSuccessMessage(`${isHighRes ? 'High-res' : 'Low-res'} image for ${colorName} deleted successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(`Failed to delete image: ${result.error}`);
      }
    } catch (err) {
      setError(`Error deleting image: ${err.message}`);
    } finally {
      setUploadingColor(null);
      setUploadingType(null);
    }
  };

  // ====== REFRESH DATA HANDLER ======
  const handleRefresh = () => {
    if (selectedModel?.docId) {
      loadImageData(selectedModel.docId);
    }
  };
{/* Part 3 End - Event Handlers */}

{/* Part 4 Start - Helper Components */}
  // ====== COLOR CARD COMPONENT ======
  const ColorCard = ({ colorName }) => {
    const data = colorData[colorName] || { highRes: '', lowRes: '', hexColor: '' };
    const isUploading = uploadingColor === colorName;
    const isSavingHex = savingHexColor === colorName;
    const currentHexColor = editedHexColors[colorName] || '';
    const hasHexChanged = currentHexColor !== (data.hexColor || '');
    
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        {/* Color Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded border border-gray-300"
              style={{ 
                backgroundColor: currentHexColor || '#CCCCCC'
              }}
            />
            <h3 className="font-medium text-gray-900">{colorName}</h3>
          </div>
          {(data.highRes || data.lowRes) && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Has images
            </span>
          )}
        </div>

        {/* Hex Color Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Palette className="h-4 w-4 inline mr-1" />
            Hex Color
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentHexColor}
              onChange={(e) => handleHexColorChange(colorName, e.target.value)}
              placeholder="#000000"
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
              maxLength={7}
            />
            <button
              onClick={() => handleSaveHexColor(colorName)}
              disabled={!hasHexChanged || isSavingHex}
              className={`px-3 py-2 rounded flex items-center gap-1 text-sm ${
                hasHexChanged && !isSavingHex
                  ? 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSavingHex ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Image Upload Sections */}
        <div className="grid grid-cols-2 gap-4">
          {/* High-Res Image */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              High Resolution
            </label>
            {data.highRes ? (
              <div className="relative group">
                <img 
                  src={data.highRes} 
                  alt={`${colorName} high-res`}
                  className="w-full h-24 object-contain border rounded bg-white"
                />
                <button
                  onClick={() => handleDeleteImage(colorName, true)}
                  disabled={isUploading}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded cursor-pointer transition-colors ${
                isUploading && uploadingType === 'high'
                  ? 'border-[rgb(52,69,157)] bg-blue-50'
                  : 'border-gray-300 hover:border-[rgb(52,69,157)] hover:bg-gray-100'
              }`}>
                {isUploading && uploadingType === 'high' ? (
                  <RefreshCw className="h-6 w-6 text-[rgb(52,69,157)] animate-spin" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleImageUpload(colorName, true, e.target.files[0])}
                />
              </label>
            )}
          </div>

          {/* Low-Res Image */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Low Resolution
            </label>
            {data.lowRes ? (
              <div className="relative group">
                <img 
                  src={data.lowRes} 
                  alt={`${colorName} low-res`}
                  className="w-full h-24 object-contain border rounded bg-white"
                />
                <button
                  onClick={() => handleDeleteImage(colorName, false)}
                  disabled={isUploading}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded cursor-pointer transition-colors ${
                isUploading && uploadingType === 'low'
                  ? 'border-[rgb(52,69,157)] bg-blue-50'
                  : 'border-gray-300 hover:border-[rgb(52,69,157)] hover:bg-gray-100'
              }`}>
                {isUploading && uploadingType === 'low' ? (
                  <RefreshCw className="h-6 w-6 text-[rgb(52,69,157)] animate-spin" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleImageUpload(colorName, false, e.target.files[0])}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    );
  };
{/* Part 4 End - Helper Components */}

{/* Part 5 Start - Loading and Error States */}
  // ====== LOADING STATE ======
  if (loadingManufacturers) {
    return (
      <div className="min-h-screen bg-white p-4">
        <Card className="w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
          <CardHeader className="bg-[rgb(52,69,157)] py-3">
            <CardTitle className="text-2xl text-white flex items-center">
              <Image className="h-6 w-6 mr-2" />
              Image Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
              <p className="mt-2 text-gray-600">Loading manufacturers...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
{/* Part 5 End - Loading and Error States */}

{/* Part 6 Start - Main Component Render */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Image className="h-6 w-6 mr-2" />
            Image Management
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
              <Check className="h-5 w-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Selection Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Manufacturer Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer
              </label>
              <select
                value={selectedManufacturer}
                onChange={handleManufacturerChange}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select Manufacturer</option>
                {manufacturers.map(mfr => (
                  <option key={mfr} value={mfr}>{mfr}</option>
                ))}
              </select>
            </div>

            {/* Model Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                value={selectedModel?.model || ''}
                onChange={handleModelChange}
                disabled={!selectedManufacturer || loadingModels}
                className="w-full px-3 py-2 border rounded disabled:bg-gray-100"
              >
                <option value="">
                  {loadingModels ? 'Loading models...' : 'Select Model'}
                </option>
                {models.map(m => (
                  <option key={m.docId} value={m.model}>{m.model}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Model Info */}
          {selectedModel && (
            <div className="flex items-center justify-between bg-blue-50 px-4 py-2 rounded">
              <div>
                <span className="text-sm text-gray-600">Selected: </span>
                <span className="font-medium">{selectedManufacturer} {selectedModel.model}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({selectedModel.colors?.length || 0} colors available)
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loadingImages}
                className="p-2 text-[rgb(52,69,157)] hover:bg-blue-100 rounded"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${loadingImages ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Color Cards Grid */}
          {selectedModel && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Color Variants ({selectedModel.colors?.length || 0})
              </h2>
              
              {loadingImages ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[rgb(52,69,157)]"></div>
                  <p className="mt-2 text-gray-600 text-sm">Loading image data...</p>
                </div>
              ) : selectedModel.colors?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedModel.colors.map(colorName => (
                    <ColorCard key={colorName} colorName={colorName} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Image className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No colors defined for this model.</p>
                  <p className="text-sm">Add colors in the Device Model form first.</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!selectedModel && (
            <div className="text-center py-12 text-gray-500">
              <Image className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a manufacturer and model to manage images</p>
              <p className="text-sm mt-2">
                Upload high-res and low-res images for each color variant
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneImageManagementForm;
{/* Part 6 End - Main Component Render */}