{/* Part 1 Start - Imports and Component Definition */}
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Calendar, 
  Building2,
  MapPin,
  X
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalStateContext';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

const StockReceivingForm = () => {
  // Get procurement data from global state
  const { procurementForReceiving, clearProcurementForReceiving, setActiveComponent } = useGlobalState();
{/* Part 1 End - Imports and Component Definition */}

{/* Part 2 Start - State and Data Setup */}
  // Form state
  const [dateDelivered, setDateDelivered] = useState(new Date().toISOString().split('T')[0]);
  const [bulkLocation, setBulkLocation] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  
  // State for group barcodes
  const [groupBarcodes, setGroupBarcodes] = useState({});
  
  // State for barcode edit mode
  const [barcodeEditMode, setBarcodeEditMode] = useState({});
  
  // State for view-only mode
  const [isViewOnly, setIsViewOnly] = useState(false);
  
  // Use actual procurement data or dummy data for testing - wrapped in useMemo to prevent recreating on every render
  const procurementData = useMemo(() => {
    const data = procurementForReceiving || {
      id: 'PROC-2024-001',
      reference: 'PO-2024-0156',
      supplierName: 'TechHub Electronics Inc.',
      supplierId: 'SUPP-001',
      purchaseDate: '2024-12-15',
      deliveryStatus: 'pending',
      items: [
        {
          manufacturer: 'Apple',
          model: 'iPhone 15 Pro',
          ram: '8GB',
          storage: '256GB',
          color: 'Natural Titanium',
          quantity: 3,
          dealersPrice: 75000,
          retailPrice: 85000,
          barcode: ''
        },
        {
          manufacturer: 'Samsung',
          model: 'Galaxy S24 Ultra',
          ram: '12GB',
          storage: '512GB',
          color: 'Titanium Gray',
          quantity: 2,
          dealersPrice: 65000,
          retailPrice: 75000,
          barcode: ''
        }
      ]
    };
    console.log('📦 Procurement Data:', data);
    console.log('📦 Procurement Items:', data.items);
    return data;
  }, [procurementForReceiving]);

  // Set view-only mode based on delivery status
  useEffect(() => {
    if (procurementData.deliveryStatus === 'delivered' || procurementData.isReceived === true) {
      setIsViewOnly(true);
    }
  }, [procurementData]);

  // Initialize receiving items state
  const [receivingItems, setReceivingItems] = useState([]);
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('🔄 Group Barcodes State Updated:', groupBarcodes);
  }, [groupBarcodes]);
  
  useEffect(() => {
    console.log('🔄 Receiving Items State Updated:', receivingItems);
  }, [receivingItems]);
  
  // Initialize receiving items and fetch barcodes when procurementData changes
  useEffect(() => {
    const initializeItemsWithBarcodes = async () => {
      console.log('🚀 Starting initializeItemsWithBarcodes');
      const rows = [];
      let rowId = 1;
      const newGroupBarcodes = {};
      
      // Process each item group and fetch barcodes
      for (let groupIndex = 0; groupIndex < procurementData.items.length; groupIndex++) {
        const item = procurementData.items[groupIndex];
        console.log(`\n🔍 Processing Group ${groupIndex}:`, item);
        
        // Start with barcode from procurement if available
        let barcode = item.barcode || '';
        console.log(`📊 Initial barcode from procurement: "${barcode}"`);
        
        // If no barcode in procurement, try to fetch from existing inventory
        if (!barcode && item.manufacturer && item.model && item.ram && item.storage && item.color) {
          try {
            console.log(`🔎 Fetching barcode for: ${item.manufacturer} ${item.model} ${item.ram} ${item.storage} ${item.color}`);
            
            const inventoryRef = collection(db, 'inventory');
            const q = query(
              inventoryRef,
              where("manufacturer", "==", item.manufacturer),
              where("model", "==", item.model),
              where("ram", "==", item.ram),
              where("storage", "==", item.storage),
              where("color", "==", item.color),
              limit(1)
            );
            
            console.log('🔍 Query constraints:', {
              manufacturer: item.manufacturer,
              model: item.model,
              ram: item.ram,
              storage: item.storage,
              color: item.color
            });
            
            const snapshot = await getDocs(q);
            console.log(`📋 Query results: ${snapshot.size} documents found`);
            
            if (!snapshot.empty) {
              const existingItem = snapshot.docs[0].data();
              console.log('✅ Found inventory item:', existingItem);
              if (existingItem.barcode) {
                barcode = existingItem.barcode;
                console.log(`✅ Found barcode: "${barcode}"`);
              } else {
                console.log('⚠️ Inventory item has no barcode');
              }
            } else {
              console.log('❌ No matching inventory item found');
            }
          } catch (error) {
            console.error('❌ Error fetching barcode:', error);
          }
        } else if (!barcode) {
          console.log('⚠️ Missing required fields for barcode fetch:', {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            color: item.color
          });
        }
        
        // Store the barcode for this group
        newGroupBarcodes[groupIndex] = barcode;
        console.log(`💾 Storing barcode for group ${groupIndex}: "${barcode}"`);
        
        // Create rows for each quantity
        for (let i = 0; i < item.quantity; i++) {
          rows.push({
            id: rowId++,
            groupId: groupIndex,
            ...item,
            barcode: barcode, // Use the fetched or existing barcode
            // Individual item fields
            imei1: '',
            imei2: '',
            serialNumber: '',
            location: '',
            status: 'Stock'
          });
        }
      }
      
      console.log('📦 Final newGroupBarcodes:', newGroupBarcodes);
      console.log('📦 Final rows:', rows);
      
      // Update states with the processed data
      setGroupBarcodes(newGroupBarcodes);
      setReceivingItems(rows);
    };
    
    // Call the async function
    initializeItemsWithBarcodes();
  }, [procurementData]);
  
  // Group items by product model
  const groupedItems = useMemo(() => {
    console.log('🔄 Recalculating groupedItems');
    console.log('Current receivingItems:', receivingItems);
    console.log('Current groupBarcodes:', groupBarcodes);
    
    const groups = receivingItems.reduce((groups, item) => {
      const groupKey = item.groupId;
      if (!groups[groupKey]) {
        const barcode = groupBarcodes[groupKey] || item.barcode || '';
        console.log(`Creating group ${groupKey} with barcode: "${barcode}"`);
        groups[groupKey] = {
          product: {
            manufacturer: item.manufacturer,
            model: item.model,
            ram: item.ram,
            storage: item.storage,
            color: item.color,
            dealersPrice: item.dealersPrice,
            retailPrice: item.retailPrice,
            barcode: barcode
          },
          items: []
        };
      }
      groups[groupKey].items.push(item);
      return groups;
    }, {});
    
    console.log('📦 Final groupedItems:', groups);
    return groups;
  }, [receivingItems, groupBarcodes]); // Added groupBarcodes as dependency
{/* Part 2 End - State and Data Setup */}

{/* Part 3 Start - Handler Functions */}
  // Handle individual field changes
  const handleItemChange = (itemId, field, value) => {
    setReceivingItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  // Handle bulk location set
  const handleBulkLocationSet = () => {
    if (!bulkLocation.trim()) return;
    
    setReceivingItems(prevItems =>
      prevItems.map(item => ({ ...item, location: bulkLocation }))
    );
  };

  // Handle barcode change for a group
  const handleGroupBarcodeChange = (groupId, value) => {
    setGroupBarcodes(prev => ({
      ...prev,
      [groupId]: value.toUpperCase()
    }));
    
    // Update all items in the group with the new barcode
    setReceivingItems(prevItems =>
      prevItems.map(item =>
        item.groupId === groupId ? { ...item, barcode: value.toUpperCase() } : item
      )
    );
  };

  // Toggle barcode edit mode
  const toggleBarcodeEditMode = (groupId) => {
    setBarcodeEditMode(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Handle Enter key navigation
  const handleKeyDown = (e, groupKey, itemIndex, fieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const group = groupedItems[groupKey];
      const totalItemsInGroup = group.items.length;
      
      // Define field order for navigation
      const fieldOrder = ['imei1', 'imei2', 'serialNumber'];
      const currentFieldIndex = fieldOrder.indexOf(fieldName);
      
      let nextField = null;
      let nextItemIndex = itemIndex;
      
      // Determine next field and item
      if (currentFieldIndex < fieldOrder.length - 1) {
        // Move to next field in same row
        nextField = fieldOrder[currentFieldIndex + 1];
      } else if (itemIndex < totalItemsInGroup - 1) {
        // Move to first field of next row
        nextField = fieldOrder[0];
        nextItemIndex = itemIndex + 1;
      }
      
      // Focus on the next input if found
      if (nextField) {
        const nextInput = document.querySelector(
          `input[data-group="${groupKey}"][data-item="${nextItemIndex}"][data-field="${nextField}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting receiving items:', receivingItems);
    console.log('Procurement ID:', procurementData.id);
    console.log('Date Delivered:', dateDelivered);
    console.log('Delivery Reference:', deliveryReference);
    // TODO: Implement actual submission logic
  };

  // Handle cancel - return to procurement management
  const handleCancel = () => {
    console.log('Cancelling stock receiving');
    clearProcurementForReceiving();
    setActiveComponent('procurementmgmt');
  };

  // Format price with commas
  const formatPrice = (value) => {
    if (!value) return '0.00';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
{/* Part 3 End - Handler Functions */}

{/* Part 4 Start - Form Header */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl text-white flex items-center">
              <Package className="h-6 w-6 mr-2" />
              Stock Receiving {isViewOnly && '(View Only)'}
            </CardTitle>
            
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center text-sm"
              title="Cancel and return to procurement management"
            >
              <X className="h-4 w-4 mr-1" />
              {isViewOnly ? 'Close' : 'Cancel'}
            </button>
          </div>
        </CardHeader>

        <CardContent className="bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Procurement Info Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex flex-wrap gap-4">
                {/* Date Delivered */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[150px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Date Delivered:
                  </label>
                  <input
                    type="date"
                    value={dateDelivered}
                    onChange={(e) => setDateDelivered(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                    required
                    disabled={isViewOnly}
                  />
                </div>

                {/* Reference - Now Editable and Repositioned */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[160px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Reference:
                  </label>
                  <input
                    type="text"
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="Delivery Receipt #"
                    disabled={isViewOnly}
                  />
                </div>

                {/* Bulk Location */}
                <div className="space-y-2 flex-1 min-w-[240px] max-w-[320px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Set all locations to:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bulkLocation}
                      onChange={(e) => setBulkLocation(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded text-sm"
                      placeholder="e.g. Stockroom A"
                      disabled={isViewOnly}
                    />
                    <button
                      type="button"
                      onClick={handleBulkLocationSet}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                      disabled={isViewOnly}
                    >
                      Apply to All
                    </button>
                  </div>
                </div>

                {/* Supplier */}
                <div className="space-y-2 flex-1 min-w-[180px] max-w-[220px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Supplier:
                  </label>
                  <input
                    type="text"
                    value={procurementData.supplierName}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Purchase Date */}
                <div className="space-y-2 flex-1 min-w-[100px] max-w-[130px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Purchase Date:
                  </label>
                  <input
                    type="text"
                    value={procurementData.purchaseDate}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>

                {/* Procurement Reference */}
                <div className="space-y-2 flex-1 min-w-[120px] max-w-[150px]">
                  <label className="block text-sm font-semibold text-[rgb(52,69,157)]">
                    Procurement Ref:
                  </label>
                  <input
                    type="text"
                    value={procurementData.reference || procurementData.id}
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    disabled
                  />
                </div>
              </div>
            </div>
{/* Part 4 End - Form Header */}

{/* Part 5 Start - Items Table */}
            {/* Receiving Items Table */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">
                {isViewOnly ? 'Received Items' : 'Items to Receive'}
              </h3>
              
              {Object.entries(groupedItems).map(([groupKey, group]) => (
                <div key={groupKey} className="border rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div className="bg-gray-100 p-4 border-b">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-base font-semibold items-center">
                      <span>{group.product.manufacturer}</span>
                      <span className="text-gray-600">•</span>
                      <span>({group.items.length} {group.items.length === 1 ? 'pc' : 'pcs'})</span>
                      <span className="text-gray-600">•</span>
                      <span>{group.product.model}</span>
                      <span className="text-gray-600">•</span>
                      <span>{group.product.ram} / {group.product.storage}</span>
                      <span className="text-gray-600">•</span>
                      <span>{group.product.color}</span>
                      <span className="text-gray-600">•</span>
                      <span>Retail Price: ₱{formatPrice(group.product.retailPrice)}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => toggleBarcodeEditMode(groupKey)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                          disabled={isViewOnly}
                        >
                          {barcodeEditMode[groupKey] ? 'Save' : 'Barcode'}
                        </button>
                        <span className="font-mono text-sm">
                          {barcodeEditMode[groupKey] ? (
                            <input
                              type="text"
                              value={groupBarcodes[groupKey] || ''}
                              onChange={(e) => handleGroupBarcodeChange(groupKey, e.target.value)}
                              className="px-2 py-1 border rounded text-sm font-mono uppercase"
                              placeholder="Enter barcode"
                              autoFocus
                              disabled={isViewOnly}
                            />
                          ) : (
                            <span className="bg-gray-200 px-2 py-1 rounded">
                              {groupBarcodes[groupKey] || 'NO BARCODE'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border px-3 py-2 text-left font-semibold w-12">#</th>
                          <th className="border px-3 py-2 text-left font-semibold">IMEI 1</th>
                          <th className="border px-3 py-2 text-left font-semibold">IMEI 2</th>
                          <th className="border px-3 py-2 text-left font-semibold">Serial Number</th>
                          <th className="border px-3 py-2 text-left font-semibold">Location</th>
                          <th className="border px-3 py-2 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, index) => (
                          <tr key={item.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                            <td className="px-3 py-3 text-sm">{index + 1}</td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={item.imei1}
                                onChange={(e) => handleItemChange(item.id, 'imei1', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'imei1')}
                                data-group={groupKey}
                                data-item={index}
                                data-field="imei1"
                                className="w-full px-2 py-1.5 border rounded text-sm"
                                placeholder="15-digit IMEI"
                                maxLength={15}
                                required
                                disabled={isViewOnly}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={item.imei2}
                                onChange={(e) => handleItemChange(item.id, 'imei2', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'imei2')}
                                data-group={groupKey}
                                data-item={index}
                                data-field="imei2"
                                className="w-full px-2 py-1.5 border rounded text-sm"
                                placeholder="Optional"
                                maxLength={15}
                                disabled={isViewOnly}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={item.serialNumber}
                                onChange={(e) => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, groupKey, index, 'serialNumber')}
                                data-group={groupKey}
                                data-item={index}
                                data-field="serialNumber"
                                className="w-full px-2 py-1.5 border rounded text-sm"
                                placeholder="Optional"
                                disabled={isViewOnly}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={item.location}
                                onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
                                className="w-full px-2 py-1.5 border rounded text-sm"
                                placeholder="Location"
                                required
                                disabled={isViewOnly}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={item.status}
                                onChange={(e) => handleItemChange(item.id, 'status', e.target.value)}
                                className={`w-full px-2 py-1.5 border rounded text-sm font-medium ${
                                  item.status === 'Stock' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  item.status === 'On-Display' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                  item.status === 'Sold' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                  item.status === 'Reserved' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                  item.status === 'Defective' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-white'
                                }`}
                                required
                                disabled={isViewOnly}
                              >
                                <option value="Stock">Stock</option>
                                <option value="On-Display">On-Display</option>
                                <option value="Sold">Sold</option>
                                <option value="Reserved">Reserved</option>
                                <option value="Defective">Defective</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
{/* Part 5 End - Items Table */}

{/* Part 6 Start - Form Submission and Export */}
            {/* Submit Buttons */}
            {!isViewOnly && (
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90 text-sm font-medium"
                >
                  Receive Items ({receivingItems.length} units)
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReceivingForm;
{/* Part 6 End - Form Submission and Export */}