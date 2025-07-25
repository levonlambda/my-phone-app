{/* Part 1 Start - Imports and Context Creation */}
// src/context/GlobalStateContext.jsx
import PropTypes from 'prop-types';
import { createContext, useState, useContext } from 'react';

// Create context
export const GlobalStateContext = createContext();

// Custom hook for easier context usage
export const useGlobalState = () => useContext(GlobalStateContext);
{/* Part 1 End - Imports and Context Creation */}

{/* Part 2 Start - GlobalStateProvider Component */}
// Create provider
export const GlobalStateProvider = ({ children }) => {
  // ====== STATE DEFINITIONS ======
  const [phoneToEdit, setPhoneToEdit] = useState(null);
  const [procurementToEdit, setProcurementToEdit] = useState(null);
  const [inventoryItemToEdit, setInventoryItemToEdit] = useState(null); // NEW: State for inventory editing
  const [activeComponent, setActiveComponent] = useState('summary');
  const [isViewingProcurement, setIsViewingProcurement] = useState(false); // Track view vs edit mode
  const [procurementMode, setProcurementMode] = useState(''); // NEW: Track procurement mode ('view', 'edit', 'payment')
  const [procurementForReceiving, setProcurementForReceiving] = useState(null); // NEW: State for stock receiving
  
  // ====== PHONE EDITING FUNCTIONS ======
  // Function to set a phone for editing and switch to form
  const editPhone = (phone) => {
    setPhoneToEdit(phone);
    setActiveComponent('form');
  };
  
  // Function to clear the selected phone
  const clearPhoneToEdit = () => {
    setPhoneToEdit(null);
  };
  
  // ====== INVENTORY EDITING FUNCTIONS - NEW ======
  // Function to set an inventory item for editing and switch to selection form
  const editInventoryItem = (item) => {
    setInventoryItemToEdit(item);
    setActiveComponent('selection');
  };
  
  // Function to clear the selected inventory item
  const clearInventoryItemToEdit = () => {
    setInventoryItemToEdit(null);
  };
  
  // ====== PROCUREMENT EDITING FUNCTIONS ======
  // Function to set a procurement for editing and switch to procurement form
  const editProcurement = (procurement) => {
    setProcurementToEdit(procurement);
    setIsViewingProcurement(false); // Set to edit mode
    setProcurementMode('edit'); // NEW: Set mode to edit
    setActiveComponent('procurement');
  };
  
  // Function to set a procurement for viewing (read-only)
  const viewProcurement = (procurement) => {
    setProcurementToEdit(procurement);
    setIsViewingProcurement(true); // Set to view mode
    setProcurementMode('view'); // NEW: Set mode to view
    setActiveComponent('procurement');
  };
  
  // NEW: Function to set a procurement for payment entry
  const paymentProcurement = (procurement) => {
    setProcurementToEdit(procurement);
    setIsViewingProcurement(false); // Not in pure view mode
    setProcurementMode('payment'); // Set mode to payment
    setActiveComponent('procurement');
  };
  
  // NEW: Function to open stock receiving form with procurement data
  const receiveProcurement = (procurement) => {
    setProcurementForReceiving(procurement);
    setActiveComponent('stockreceiving');
  };
  
  // Function to clear the selected procurement
  const clearProcurementToEdit = () => {
    setProcurementToEdit(null);
    setIsViewingProcurement(false); // Reset view mode
    setProcurementMode(''); // NEW: Reset mode
  };
  
  // NEW: Function to clear procurement for receiving
  const clearProcurementForReceiving = () => {
    setProcurementForReceiving(null);
  };
  
  // ====== CONTEXT VALUE OBJECT ======
  // Create a value object with all the state and functions
  const contextValue = {
    phoneToEdit,
    editPhone,
    clearPhoneToEdit,
    inventoryItemToEdit, // NEW: Add inventory item state
    editInventoryItem, // NEW: Add inventory edit function
    clearInventoryItemToEdit, // NEW: Add inventory clear function
    procurementToEdit,
    editProcurement,
    viewProcurement,
    paymentProcurement, // NEW: Add payment function
    receiveProcurement, // NEW: Add receive function
    clearProcurementToEdit,
    isViewingProcurement,
    procurementMode, // NEW: Add procurement mode state
    procurementForReceiving, // NEW: Add procurement for receiving state
    clearProcurementForReceiving, // NEW: Add clear function
    activeComponent,
    setActiveComponent
  };
  
  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// Add prop types for validation
GlobalStateProvider.propTypes = {
  children: PropTypes.node.isRequired
};
{/* Part 2 End - GlobalStateProvider Component */}

{/* Part 3 Start - Export Default Hook */}
// Also provide a default export for the hook for backward compatibility
export default useGlobalState;
{/* Part 3 End - Export Default Hook */}