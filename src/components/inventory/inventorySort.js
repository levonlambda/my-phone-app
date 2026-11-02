// Mirror of the sort comparator in InventoryTable.jsx (Part 5 - Sorting Logic).
// Used by the Inventory List clipboard copy so copied rows match the on-screen order.
// InventoryTable.jsx keeps its own inline sort; if that sort changes, update this to match.
export const sortInventoryItems = (items, sortField, sortDirection) => {
  return [...items].sort((a, b) => {
    // Handle numeric fields
    if (sortField === 'retailPrice') {
      return sortDirection === 'asc'
        ? a.retailPrice - b.retailPrice
        : b.retailPrice - a.retailPrice;
    }

    // Handle date field (lastUpdated)
    if (sortField === 'lastUpdated') {
      const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
      const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // Handle string fields (including serialNumber and supplier)
    if (sortDirection === 'asc') {
      return (a[sortField] || '').localeCompare(b[sortField] || '');
    }
    return (b[sortField] || '').localeCompare(a[sortField] || '');
  });
};
