// src/App.jsx
import { useEffect } from 'react';
import PhoneSpecForm from './components/PhoneSpecForm';
import PhoneSelectionForm from './components/phone-selection/PhoneSelectionForm';
import InventoryListForm from './components/InventoryListForm';
import PhoneListForm from './components/PhoneListForm';
import InventorySummaryForm from './components/InventorySummaryForm';
import PriceManagementForm from './components/PriceManagementForm';
import PhoneProcurementForm from './components/PhoneProcurementForm';
import SupplierManagementForm from './components/SupplierManagementForm'; // NEW: Added supplier management import
// Import the hook from our consolidated file
import { useGlobalState } from './context/GlobalStateContext';

function App() {
  const { activeComponent, setActiveComponent, phoneToEdit } = useGlobalState();
  
  // For debugging
  useEffect(() => {
    console.log("App: Active component changed to:", activeComponent);
    console.log("App: phoneToEdit:", phoneToEdit ? phoneToEdit.id : 'none');
  }, [activeComponent, phoneToEdit]);

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4 bg-[rgb(52,69,157)] text-white">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4">
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'summary' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('summary')}
          >
            Inventory Summary
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'inventory' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('inventory')}
          >
            Inventory List
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'selection' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('selection')}
          >
            Add Phone Inventory
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'procurement' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('procurement')}
          >
            Phone Procurement
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'suppliers' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('suppliers')}
          >
            Supplier Management
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'form' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('form')}
          >
            Add Phone Model
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'phonelist' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('phonelist')}
          >
            Phone Models
          </button>
          <button 
            className={`px-4 py-2 rounded ${activeComponent === 'prices' ? 'bg-white text-[rgb(52,69,157)]' : 'bg-transparent'}`}
            onClick={() => setActiveComponent('prices')}
          >
            Price Management
          </button>
        </div>
      </div>
      
      {activeComponent === 'summary' && <InventorySummaryForm />}
      {activeComponent === 'selection' && <PhoneSelectionForm />}
      {activeComponent === 'procurement' && <PhoneProcurementForm />}
      {activeComponent === 'suppliers' && <SupplierManagementForm />}
      {activeComponent === 'form' && <PhoneSpecForm />}
      {activeComponent === 'inventory' && <InventoryListForm />}
      {activeComponent === 'phonelist' && <PhoneListForm />}
      {activeComponent === 'prices' && <PriceManagementForm />}
    </div>
  );
}

export default App;