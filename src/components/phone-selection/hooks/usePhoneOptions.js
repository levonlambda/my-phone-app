import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';

export const usePhoneOptions = () => {
  // State for available options
  const [manufacturers, setManufacturers] = useState([]);
  const [models, setModels] = useState([]);
  const [colors, setColors] = useState([]);
  const [storage, setStorage] = useState([]);
  const [ram, setRam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch manufacturers
  const fetchManufacturers = async () => {
    setLoading(true);
    try {
      console.log("Attempting to fetch manufacturers...");
      const phonesRef = collection(db, 'phones');
      const snapshot = await getDocs(phonesRef);
      
      // Extract unique manufacturers
      const uniqueManufacturers = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.manufacturer) {
          uniqueManufacturers.add(data.manufacturer);
        }
      });
      
      const manufacturerArray = Array.from(uniqueManufacturers).sort();
      console.log("Manufacturers fetched:", manufacturerArray);
      setManufacturers(manufacturerArray);
      setLoading(false);
      return manufacturerArray;
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      setError(`Error fetching manufacturers: ${error.message}`);
      setLoading(false);
      return [];
    }
  };

  // Fetch models for a specific manufacturer
  const fetchModels = async (manufacturer) => {
    if (!manufacturer) {
      setModels([]);
      return [];
    }
    
    setLoading(true);
    try {
      console.log(`Fetching models for ${manufacturer}...`);
      const phonesRef = collection(db, 'phones');
      const q = query(phonesRef, where("manufacturer", "==", manufacturer));
      const snapshot = await getDocs(q);
      
      // Extract unique models
      const uniqueModels = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.model) {
          uniqueModels.add(data.model);
        }
      });
      
      const modelArray = Array.from(uniqueModels).sort();
      console.log("Models fetched:", modelArray);
      setModels(modelArray);
      setLoading(false);
      return modelArray;
    } catch (error) {
      console.error(`Error fetching models for ${manufacturer}:`, error);
      setError(`Error fetching models: ${error.message}`);
      setLoading(false);
      return [];
    }
  };

  // Fetch options (colors, storage, RAM) for a specific model
  const fetchOptions = async (manufacturer, model) => {
    if (!manufacturer || !model) {
      setColors([]);
      setStorage([]);
      setRam([]);
      return { colors: [], storage: [], ram: [] };
    }
    
    setLoading(true);
    try {
      console.log(`Fetching options for ${manufacturer} ${model}...`);
      const phonesRef = collection(db, 'phones');
      const q = query(
        phonesRef, 
        where("manufacturer", "==", manufacturer),
        where("model", "==", model)
      );
      const snapshot = await getDocs(q);
      
      let colorsArray = [];
      let storageArray = [];
      let ramArray = [];
      
      // Get the first matching document
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        
        // Set colors, storage and RAM options
        colorsArray = Array.isArray(data.colors) ? data.colors : [];
        storageArray = Array.isArray(data.storage) ? data.storage : [];
        ramArray = Array.isArray(data.storage_extra) ? data.storage_extra : [];
        
        setColors(colorsArray);
        setStorage(storageArray);
        setRam(ramArray);
        
        console.log("Options fetched:", {
          colors: colorsArray,
          storage: storageArray,
          ram: ramArray
        });
      }
      
      setLoading(false);
      return { colors: colorsArray, storage: storageArray, ram: ramArray };
    } catch (error) {
      console.error(`Error fetching options for ${manufacturer} ${model}:`, error);
      setError(`Error fetching options: ${error.message}`);
      setLoading(false);
      return { colors: [], storage: [], ram: [] };
    }
  };
  
  return {
    manufacturers,
    models,
    colors,
    storage,
    ram,
    loading,
    error,
    fetchManufacturers,
    fetchModels,
    fetchOptions
  };
};

export default usePhoneOptions;