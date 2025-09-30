import { useState } from 'react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const PriceConfigurationRepair = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [scanResults, setScanResults] = useState(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState('');
  const [repairComplete, setRepairComplete] = useState(false);

  // Helper function to get current date
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Scan for missing price configurations
  const scanForMissingConfigs = async () => {
    setIsScanning(true);
    setScanProgress('Starting scan...');
    setScanResults(null);
    setRepairComplete(false);

    try {
      // Step 1: Get all inventory items
      setScanProgress('Fetching inventory items...');
      const inventoryRef = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryRef);
      
      // Group inventory by unique configurations
      const inventoryConfigs = new Map();
      
      inventorySnapshot.forEach(doc => {
        const item = doc.data();
        if (item.manufacturer && item.model && item.ram && item.storage) {
          // Base configuration key
          const baseKey = `${item.manufacturer}_${item.model}_${item.ram}_${item.storage}`.replace(/\s+/g, '_').toLowerCase();
          
          // Color-specific key
          if (item.color) {
            const colorKey = `${baseKey}_${item.color}`.replace(/\s+/g, '_').toLowerCase();
            
            // Store unique configurations with their prices
            if (!inventoryConfigs.has(baseKey)) {
              inventoryConfigs.set(baseKey, {
                manufacturer: item.manufacturer,
                model: item.model,
                ram: item.ram,
                storage: item.storage,
                dealersPrice: item.dealersPrice || 0,
                retailPrice: item.retailPrice || 0,
                colors: new Set(),
                items: []
              });
            }
            
            // Add color to the base config
            inventoryConfigs.get(baseKey).colors.add(item.color);
            inventoryConfigs.get(baseKey).items.push(item);
            
            // Store color-specific configuration
            if (!inventoryConfigs.has(colorKey)) {
              inventoryConfigs.set(colorKey, {
                manufacturer: item.manufacturer,
                model: item.model,
                ram: item.ram,
                storage: item.storage,
                color: item.color,
                dealersPrice: item.dealersPrice || 0,
                retailPrice: item.retailPrice || 0,
                isColorSpecific: true,
                items: [item]
              });
            } else {
              inventoryConfigs.get(colorKey).items.push(item);
            }
          }
        }
      });

      setScanProgress(`Found ${inventoryConfigs.size} unique configurations in inventory`);

      // Step 2: Check which configurations are missing from price_configurations
      setScanProgress('Checking for missing price configurations...');
      const priceConfigRef = collection(db, 'price_configurations');
      const priceConfigSnapshot = await getDocs(priceConfigRef);
      
      const existingConfigs = new Set();
      priceConfigSnapshot.forEach(doc => {
        existingConfigs.add(doc.id);
      });

      // Find missing configurations
      const missingConfigs = [];
      const existingButNeedUpdate = [];
      
      for (const [configId, configData] of inventoryConfigs) {
        if (!existingConfigs.has(configId)) {
          missingConfigs.push({ configId, ...configData });
        } else {
          // Check if existing config needs price update
          const existingDoc = await getDoc(doc(db, 'price_configurations', configId));
          if (existingDoc.exists()) {
            const existingData = existingDoc.data();
            // If existing prices are 0 but inventory has prices, mark for update
            if ((existingData.dealersPrice === 0 || !existingData.dealersPrice) && 
                configData.dealersPrice > 0) {
              existingButNeedUpdate.push({ configId, ...configData });
            }
          }
        }
      }

      const results = {
        totalInventoryConfigs: inventoryConfigs.size,
        totalExistingConfigs: existingConfigs.size,
        missingConfigs: missingConfigs,
        needsUpdate: existingButNeedUpdate,
        inventoryItemsCount: inventorySnapshot.size
      };

      setScanResults(results);
      setScanProgress('Scan complete!');
      setIsScanning(false);

      return results;

    } catch (error) {
      console.error('Error scanning configurations:', error);
      setScanProgress(`Error: ${error.message}`);
      setIsScanning(false);
      return null;
    }
  };

  // Repair missing configurations
  const repairMissingConfigs = async () => {
    if (!scanResults || (scanResults.missingConfigs.length === 0 && scanResults.needsUpdate.length === 0)) {
      alert('No configurations to repair!');
      return;
    }

    setIsRepairing(true);
    setRepairProgress('Starting repair process...');

    try {
      let created = 0;
      let updated = 0;
      const totalToProcess = scanResults.missingConfigs.length + scanResults.needsUpdate.length;

      // Create missing configurations
      for (const config of scanResults.missingConfigs) {
        setRepairProgress(`Creating configuration ${created + updated + 1} of ${totalToProcess}...`);
        
        const configDoc = {
          manufacturer: config.manufacturer,
          model: config.model,
          ram: config.ram,
          storage: config.storage,
          color: config.color || null,
          dealersPrice: config.dealersPrice || 0,
          retailPrice: config.retailPrice || 0,
          lastUpdated: getCurrentDate()
        };

        await setDoc(doc(db, 'price_configurations', config.configId), configDoc);
        created++;
        
        console.log(`Created price configuration: ${config.configId}`);
      }

      // Update existing configurations with zero prices
      for (const config of scanResults.needsUpdate) {
        setRepairProgress(`Updating configuration ${created + updated + 1} of ${totalToProcess}...`);
        
        const configDoc = {
          manufacturer: config.manufacturer,
          model: config.model,
          ram: config.ram,
          storage: config.storage,
          color: config.color || null,
          dealersPrice: config.dealersPrice || 0,
          retailPrice: config.retailPrice || 0,
          lastUpdated: getCurrentDate()
        };

        await setDoc(doc(db, 'price_configurations', config.configId), configDoc, { merge: true });
        updated++;
        
        console.log(`Updated price configuration: ${config.configId}`);
      }

      setRepairProgress(`Repair complete! Created ${created} and updated ${updated} configurations.`);
      setIsRepairing(false);
      setRepairComplete(true);

      // Re-scan to verify
      setTimeout(() => {
        scanForMissingConfigs();
      }, 2000);

    } catch (error) {
      console.error('Error repairing configurations:', error);
      setRepairProgress(`Error: ${error.message}`);
      setIsRepairing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Wrench className="h-6 w-6 mr-2" />
            Price Configuration Repair Utility
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Introduction */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">About This Tool</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    This utility scans your inventory for items that don't have corresponding price configurations. 
                    This can happen if items were added to inventory before the price configuration system was implemented.
                  </p>
                </div>
              </div>
            </div>

            {/* Scan Button */}
            <div className="flex justify-center">
              <button
                onClick={scanForMissingConfigs}
                disabled={isScanning || isRepairing}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                  isScanning || isRepairing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[rgb(52,69,157)] text-white hover:bg-[rgb(52,69,157)]/90'
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5" />
                    Scan for Missing Configurations
                  </>
                )}
              </button>
            </div>

            {/* Progress Messages */}
            {(scanProgress || repairProgress) && (
              <div className="text-center text-sm text-gray-600">
                {scanProgress || repairProgress}
              </div>
            )}

            {/* Scan Results */}
            {scanResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700">Inventory Items</h4>
                    <p className="text-2xl font-bold text-gray-900">{scanResults.inventoryItemsCount}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700">Unique Configurations</h4>
                    <p className="text-2xl font-bold text-gray-900">{scanResults.totalInventoryConfigs}</p>
                  </div>
                </div>

                {/* Missing Configurations */}
                <div className={`rounded-lg p-4 ${
                  scanResults.missingConfigs.length > 0 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <h4 className={`font-semibold ${
                    scanResults.missingConfigs.length > 0 ? 'text-red-700' : 'text-green-700'
                  }`}>
                    Missing Price Configurations
                  </h4>
                  <p className={`text-2xl font-bold ${
                    scanResults.missingConfigs.length > 0 ? 'text-red-900' : 'text-green-900'
                  }`}>
                    {scanResults.missingConfigs.length}
                  </p>
                  
                  {scanResults.missingConfigs.length > 0 && (
                    <div className="mt-3">
                      <div className="max-h-60 overflow-y-auto border border-red-200 rounded p-2 bg-white">
                        <div className="text-xs space-y-1">
                          {scanResults.missingConfigs.map((config, idx) => (
                            <div key={idx} className="text-red-700 py-0.5 hover:bg-red-50 px-1 rounded">
                              • {config.manufacturer} {config.model} {config.ram}GB {config.storage}GB {config.color || '(base)'}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-red-600">
                        Total: {scanResults.missingConfigs.length} missing configurations
                      </div>
                    </div>
                  )}
                </div>

                {/* Configurations Needing Update */}
                {scanResults.needsUpdate.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-700">
                      Configurations with Zero Prices (Need Update)
                    </h4>
                    <p className="text-2xl font-bold text-yellow-900">
                      {scanResults.needsUpdate.length}
                    </p>
                  </div>
                )}

                {/* Repair Button */}
                {(scanResults.missingConfigs.length > 0 || scanResults.needsUpdate.length > 0) && !repairComplete && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={repairMissingConfigs}
                      disabled={isRepairing}
                      className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                        isRepairing
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isRepairing ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          Repairing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          Repair Missing Configurations
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Success Message */}
                {repairComplete && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <h4 className="font-semibold text-green-700">Repair Complete!</h4>
                        <p className="text-sm text-green-600">
                          All missing price configurations have been created. You can now see these items in Price Management.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceConfigurationRepair;