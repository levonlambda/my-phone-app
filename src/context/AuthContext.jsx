// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import PropTypes from 'prop-types';

// Create the context
const AuthContext = createContext({});

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Login function
  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role || 'user');
        return { success: true, role: userData.role || 'user' };
      } else {
        // If no user document exists, create one with default role
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
        setUserRole('user');
        return { success: true, role: 'user' };
      }
    } catch (error) {
      setError(error.message);
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // Register function (for creating new users)
  const register = async (email, password, role = 'user') => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore with role
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: userCredential.user.email,
        role: role,
        createdAt: new Date().toISOString()
      });
      
      setUserRole(role);
      return { success: true };
    } catch (error) {
      setError(error.message);
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUserRole(null);
      return { success: true };
    } catch (error) {
      setError(error.message);
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Check if user has permission to access a component
  const hasPermission = (requiredRole) => {
    if (!currentUser) return false;
    if (userRole === 'admin') return true; // Admins can access everything
    if (requiredRole === 'admin' && userRole !== 'admin') return false;
    return true; // Regular users can access non-admin components
  };

  // Get accessible components based on user role
  const getAccessibleComponents = () => {
    if (!currentUser) return [];
    
    const allComponents = [
      { key: 'summary', label: 'Inventory Summary', requiredRole: 'user' },
      { key: 'inventory', label: 'Inventory List', requiredRole: 'admin' },
      { key: 'selection', label: 'Add Device to Inventory', requiredRole: 'admin' },
      { key: 'procurement', label: 'Phone Procurement', requiredRole: 'admin' },
      { key: 'procurementmgmt', label: 'Procurement Management', requiredRole: 'admin' },
      { key: 'stockreceiving', label: 'Stock Receiving', requiredRole: 'admin' },
      { key: 'suppliers', label: 'Supplier Management', requiredRole: 'admin' },
      { key: 'form', label: 'Add Device Model', requiredRole: 'user' }, // Changed from 'admin' to 'user'
      { key: 'phonelist', label: 'Device Models', requiredRole: 'admin' },
      { key: 'prices', label: 'Price Management', requiredRole: 'admin' },
      { key: 'archive-preview', label: 'Archive Preview', requiredRole: 'admin' }
    ];

    if (userRole === 'admin') {
      return allComponents;
    }

    // Regular users can see components with requiredRole: 'user'
    return allComponents.filter(component => component.requiredRole === 'user');
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role || 'user');
          } else {
            // Create user document if it doesn't exist
            await setDoc(doc(db, 'users', user.uid), {
              email: user.email,
              role: 'user',
              createdAt: new Date().toISOString()
            });
            setUserRole('user');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('user');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    loading,
    error,
    login,
    register,
    logout,
    hasPermission,
    getAccessibleComponents
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthContext;