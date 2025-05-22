// Get current date in MM/DD/YYYY format
export function getCurrentDate() {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() is zero-based
    const day = today.getDate();
    const year = today.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  // Calculate markup percentage
  export const calculateMarkup = (dealersPrice, retailPrice) => {
    const dPrice = parseFloat(dealersPrice.replace(/,/g, '')) || 0;
    const rPrice = parseFloat(retailPrice.replace(/,/g, '')) || 0;
    
    if (dPrice <= 0) return '0.00';
    
    const markup = ((rPrice - dPrice) / dPrice) * 100;
    return markup.toFixed(2);
  };
  
  // Calculate profit amount
  export const calculateProfit = (dealersPrice, retailPrice) => {
    const dPrice = parseFloat(dealersPrice.replace(/,/g, '')) || 0;
    const rPrice = parseFloat(retailPrice.replace(/,/g, '')) || 0;
    
    const profit = rPrice - dPrice;
    return profit.toFixed(2);
  };
  
  // Format numbers with commas
  export const formatNumberWithCommas = (value) => {
    // Remove any non-digits except for decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // If there's no decimal point, format with commas
    if (!cleanValue.includes('.')) {
      return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    // Split at decimal point and format the whole number part
    const parts = cleanValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Join back with decimal point and limit to 2 decimal places
    return parts[0] + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '');
  };
  
  // Validation function for IMEI
  export const validateImei = (value) => {
    // Only allow digits, max 15 characters
    return value.replace(/[^\d]/g, '').slice(0, 15);
  };
  
  // Validation function for price
  export const validatePrice = (value) => {
    // Only allow digits and one decimal point
    return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  };
  
  // Create a unique inventory ID
  export const createInventoryId = (manufacturer, model, ram, storage, color) => {
    return `${manufacturer}_${model}_${ram}_${storage}_${color}`.replace(/\s+/g, '_').toLowerCase();
  };
  
  // Parse price value for filters
  export const parsePrice = (value) => {
    if (!value) return '';
    return value.replace(/,/g, '');
  };
  
  // Helper to prevent form submission on Enter key
  export const handleKeyDown = (e) => {
    // Prevent Enter key from submitting the form
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };