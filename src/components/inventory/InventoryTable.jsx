import { useGlobalState } from '../../context/GlobalStateContext'; // NEW: Import global state
import { useState } from 'react';
import PropTypes from 'prop-types';
import { doc, updateDoc, runTransaction, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import InventoryRow from './InventoryRow';
import InventoryEditForm from './InventoryEditForm';
import DeleteConfirmationModal from './DeleteConfirmationModal';
// Import getCurrentDate utility function
import { getCurrentDate } from '../phone-selection/utils/phoneUtils';

const InventoryTable = ({ 
  inventoryItems, 
  handleSort, 
  sortField, 
  sortDirection, 
  allItems,
  setAllItems,
  setInventoryItems,
  applyFilters
}) => {
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    manufacturer: '',
    model: '',
    ram: '',
    storage: '',
    color: '',
    imei1: '',
    barcode: '',
    status: '',
    retailPrice: 0 // NEW: Added retailPrice to initial state
  });
  const [savingItemId, setSavingItemId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Get global state function for editing inventory items
  const { editInventoryItem } = useGlobalState(); // NEW: Get edit function from context

  // NEW: Handle edit details click
  const handleEditDetailsClick = (item) => {
    editInventoryItem(item);
  };
  // Handle edit button click
  const handleEditClick = (item) => {
    // If we're already editing, cancel it first
    if (editingItemId) {
      setEditingItemId(null);
    }
    
    // Set the item to edit
    setEditingItemId(item.id);
    
    // Populate form with item data
    setEditFormData({
      manufacturer: item.manufacturer,
      model: item.model,
      ram: item.ram,
      storage: item.storage,
      color: item.color,
      imei1: item.imei1,
      barcode: item.barcode || '',
      status: item.status,
      retailPrice: item.retailPrice // NEW: Added retailPrice to edit form data
    });
  };

  // Handle delete button click
  const handleDeleteClick = (itemId) => {
    const item = allItems.find(item => item.id === itemId);
    if (item) {
      setItemToDelete(item);
      setIsDeleteModalOpen(true);
    }
  };

  // Handle delete confirmation - PRESERVED: Original working delete logic
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Get a reference to the document
      const itemRef = doc(db, 'inventory', itemToDelete.id);
      
      // Delete the document
      await deleteDoc(itemRef);
      
      // Update inventory counts
      const inventoryId = `${itemToDelete.manufacturer}_${itemToDelete.model}_${itemToDelete.ram}_${itemToDelete.storage}_${itemToDelete.color}`.replace(/\s+/g, '_').toLowerCase();
      
      // Reference to the inventory count doc
      const inventoryRef = doc(db, 'inventory_counts', inventoryId);
      
      // Update inventory counts based on the item's status
      await runTransaction(db, async (transaction) => {
        const inventoryDoc = await transaction.get(inventoryRef);
        
        if (inventoryDoc.exists()) {
          // Determine which field to decrement based on status
          const decrementField = 
            itemToDelete.status === 'On-Hand' ? 'onHand' : 
            itemToDelete.status === 'On-Display' ? 'onDisplay' : 
            itemToDelete.status === 'Sold' ? 'sold' : 
            itemToDelete.status === 'Reserved' ? 'reserved' : 
            'defective';
          
          // Decrement total and status count
          transaction.update(inventoryRef, {
            total: increment(-1),
            [decrementField]: increment(-1),
            lastUpdated: new Date().toLocaleDateString()
          });
        }
      });
      
      // Update local state by removing the deleted item
      const updatedItems = allItems.filter(item => item.id !== itemToDelete.id);
      setAllItems(updatedItems);
      
      // Re-apply filters
      const filteredItems = applyFilters(updatedItems);
      setInventoryItems(filteredItems);
      
      // Close the modal and reset state
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setIsDeleting(false);
      
    } catch (error) {
      console.error("Error deleting item:", error);
      alert(`Error deleting item: ${error.message}`);
      setIsDeleting(false);
    }
  };

  // Handle cancel delete
  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData({
      manufacturer: '',
      model: '',
      ram: '',
      storage: '',
      color: '',
      imei1: '',
      barcode: '',
      status: '',
      retailPrice: 0 // NEW: Added retailPrice to reset state
    });
  };

  // Handle edit form input changes
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle save edits - includes lastUpdated
  const handleSaveEdit = async (id) => {
    setSavingItemId(id);
    
    try {
      // Create an update object with the edited fields
      const updateData = {
        manufacturer: editFormData.manufacturer,
        model: editFormData.model,
        ram: editFormData.ram,
        storage: editFormData.storage,
        color: editFormData.color,
        imei1: editFormData.imei1,
        barcode: editFormData.barcode,
        status: editFormData.status,
        lastUpdated: getCurrentDate() // Update lastUpdated when item is edited
      };
      
      // Get a reference to the document
      const itemRef = doc(db, 'inventory', id);
      
      // Update the document
      await updateDoc(itemRef, updateData);
      
      // If the status was changed, update the inventory counts
      const originalItem = allItems.find(item => item.id === id);
      if (originalItem && originalItem.status !== editFormData.status) {
        // Create a unique ID for this inventory item type
        const inventoryId = `${editFormData.manufacturer}_${editFormData.model}_${editFormData.ram}_${editFormData.storage}_${editFormData.color}`.replace(/\s+/g, '_').toLowerCase();
        
        // Reference to the inventory count doc
        const inventoryRef = doc(db, 'inventory_counts', inventoryId);
        
        // Run as a transaction to ensure data consistency
        await runTransaction(db, async (transaction) => {
          const inventoryDoc = await transaction.get(inventoryRef);
          
          if (inventoryDoc.exists()) {
            // Decrement the old status count
            const decrementField = 
              originalItem.status === 'On-Hand' ? 'onHand' : 
              originalItem.status === 'On-Display' ? 'onDisplay' : 
              originalItem.status === 'Sold' ? 'sold' : 
              originalItem.status === 'Reserved' ? 'reserved' : 
              'defective';
            
            // Increment the new status count
            const incrementField = 
              editFormData.status === 'On-Hand' ? 'onHand' : 
              editFormData.status === 'On-Display' ? 'onDisplay' : 
              editFormData.status === 'Sold' ? 'sold' : 
              editFormData.status === 'Reserved' ? 'reserved' : 
              'defective';
            
            // Update counters
            transaction.update(inventoryRef, {
              [decrementField]: increment(-1),
              [incrementField]: increment(1),
              lastUpdated: new Date().toLocaleDateString()
            });
          }
        });
      }
      
      // Update local state - includes lastUpdated
      setAllItems(prevItems => 
        prevItems.map(item => 
          item.id === id 
            ? { 
                ...item, 
                ...updateData,
                // Keep original prices since we're not editing them
                dealersPrice: item.dealersPrice,
                retailPrice: item.retailPrice
              } 
            : item
        )
      );
      
      // Reset editing state
      setEditingItemId(null);
      setSavingItemId(null);
      
      // Re-apply filters to update the displayed inventory items - includes lastUpdated
      const updatedItems = allItems.map(item => 
        item.id === id 
          ? { 
              ...item, 
              ...updateData,
              // Keep original prices since we're not editing them
              dealersPrice: item.dealersPrice,
              retailPrice: item.retailPrice
            } 
          : item
      );
      const filteredItems = applyFilters(updatedItems);
      setInventoryItems(filteredItems);
      
    } catch (error) {
      console.error("Error updating item:", error);
      alert(`Error updating item: ${error.message}`);
      setSavingItemId(null);
    }
  };
  
  // UPDATED: Enhanced sorting logic for new sortable columns
  const sortedInventoryItems = [...inventoryItems].sort((a, b) => {
    // Handle numeric fields
    if (sortField === 'retailPrice') {
      if (sortDirection === 'asc') {
        return a.retailPrice - b.retailPrice;
      } else {
        return b.retailPrice - a.retailPrice;
      }
    }
    
    // Handle date field (lastUpdated)
    if (sortField === 'lastUpdated') {
      const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
      const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
      
      if (sortDirection === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    }
    
    // Handle string fields
    if (sortDirection === 'asc') {
      return a[sortField]?.localeCompare(b[sortField] || '');
    } else {
      return b[sortField]?.localeCompare(a[sortField] || '');
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="bg-gray-100">
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold"
              onClick={() => handleSort('manufacturer')}
              style={{ width: '12%' }}
            >
              Manufacturer
              {sortField === 'manufacturer' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold"
              onClick={() => handleSort('model')}
              style={{ width: '12%' }}
            >
              Model
              {sortField === 'model' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('ram')}
              style={{ width: '7%' }}
            >
              RAM
              {sortField === 'ram' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('storage')}
              style={{ width: '7%' }}
            >
              Storage
              {sortField === 'storage' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('color')}
              style={{ width: '12%' }}
            >
              Color
              {sortField === 'color' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('imei1')}
              style={{ width: '15%' }}
            >
              IMEI1
              {sortField === 'imei1' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('barcode')}
              style={{ width: '15%' }}
            >
              Barcode
              {sortField === 'barcode' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            {/* NEW: Added Retail Price column */}
            <th 
              className="border px-2 py-3 text-right cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('retailPrice')}
              style={{ width: '10%' }}
            >
              Price
              {sortField === 'retailPrice' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-left cursor-pointer hover:bg-gray-200 font-semibold" 
              onClick={() => handleSort('lastUpdated')}
              style={{ width: '8%' }}
            >
              Date
              {sortField === 'lastUpdated' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="border px-2 py-3 text-center cursor-pointer hover:bg-gray-200 font-semibold"
              onClick={() => handleSort('status')}
              style={{ width: '8%' }}
            >
              Status
              {sortField === 'status' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th className="border px-2 py-3 text-center font-semibold" style={{ width: '6%' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedInventoryItems.map((item) => (
            editingItemId === item.id ? (
              <InventoryEditForm 
                key={item.id}
                itemId={item.id}
                editFormData={editFormData}
                handleEditInputChange={handleEditInputChange}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                savingItemId={savingItemId}
              />
            ) : (
             <InventoryRow 
                key={item.id}
                item={item}
                handleEditClick={handleEditClick}
                handleDeleteClick={handleDeleteClick}
                handleEditDetailsClick={handleEditDetailsClick}
              />
            )
          ))}
        </tbody>
      </table>

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        itemToDelete={itemToDelete}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
};

InventoryTable.propTypes = {
  inventoryItems: PropTypes.array.isRequired,
  handleSort: PropTypes.func.isRequired,
  sortField: PropTypes.string.isRequired,
  sortDirection: PropTypes.string.isRequired,
  allItems: PropTypes.array.isRequired,
  setAllItems: PropTypes.func.isRequired,
  setInventoryItems: PropTypes.func.isRequired,
  applyFilters: PropTypes.func.isRequired
};

export default InventoryTable;