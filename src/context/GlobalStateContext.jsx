// src/context/GlobalStateContext.jsx
import PropTypes from 'prop-types';
import { createContext, useState, useContext } from 'react';

// Create context
export const GlobalStateContext = createContext();

// Custom hook for easier context usage
export const useGlobalState = () => useContext(GlobalStateContext);

// Create provider
export const GlobalStateProvider = ({ children }) => {
  const [phoneToEdit, setPhoneToEdit] = useState(null);
  const [activeComponent, setActiveComponent] = useState('summary'); // Changed back to 'summary'
  
  // Function to set a phone for editing and switch to form
  const editPhone = (phone) => {
    console.log("GlobalStateContext: Setting phone to edit", phone?.id);
    setPhoneToEdit(phone);
    setActiveComponent('form');
  };
  
  // Function to clear the selected phone
  const clearPhoneToEdit = () => {
    setPhoneToEdit(null);
  };
  
  // Create a value object with all the state and functions
  const contextValue = {
    phoneToEdit,
    editPhone,
    clearPhoneToEdit,
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

// Also provide a default export for the hook for backward compatibility
export default useGlobalState;