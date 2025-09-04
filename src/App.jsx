// src/App.jsx
import { useEffect } from 'react';
import PhoneSpecForm from './components/PhoneSpecForm';
import PhoneSelectionForm from './components/phone-selection/PhoneSelectionForm';
import InventoryListForm from './components/InventoryListForm';
import PhoneListForm from './components/PhoneListForm';
import InventorySummaryForm from './components/InventorySummaryForm';
import PriceManagementForm from './components/PriceManagementForm';
import PhoneProcurementForm from './components/PhoneProcurementForm';
import SupplierManagementForm from './components/SupplierManagementForm';
import ProcurementManagementForm from './components/ProcurementManagementForm';
import StockReceivingForm from './components/StockReceivingForm';
import Login from './components/Login';
import { useGlobalState } from './context/GlobalStateContext';
import { useAuth } from './context/AuthContext';
import { LogOut, User, Shield } from 'lucide-react';
import ArchivePreview from './components/ArchivePreview';
import BackupTestingPanel from './components/BackupTestingPanel';

function App() {
  const { activeComponent, setActiveComponent, phoneToEdit } = useGlobalState();
  const { currentUser, userRole, loading, logout, getAccessibleComponents, hasPermission } = useAuth();
  
  // For debugging
  useEffect(() => {
    console.log("App: Active component changed to:", activeComponent);
    console.log("App: phoneToEdit:", phoneToEdit ? phoneToEdit.id : 'none');
    console.log("App: User role:", userRole);
  }, [activeComponent, phoneToEdit, userRole]);

  // Set default component based on user role when authenticated
  useEffect(() => {
    if (currentUser && !activeComponent) {
      const accessibleComponents = getAccessibleComponents();
      if (accessibleComponents.length > 0) {
        setActiveComponent(accessibleComponents[0].key);
      }
    }
  }, [currentUser, activeComponent, getAccessibleComponents, setActiveComponent]);

  // Handle logout
  const handleLogout = async () => {
    await logout();
    setActiveComponent('');
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(52,69,157)]"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!currentUser) {
    return <Login />;
  }

  // Get accessible components for the current user
  const accessibleComponents = getAccessibleComponents();

  // Component permission map
  const componentPermissions = {
    'summary': 'user',
    'inventory': 'user',
    'selection': 'user',
    'procurement': 'admin',
    'procurementmgmt': 'admin',
    'stockreceiving': 'admin',
    'suppliers': 'admin',
    'form': 'user',
    'phonelist': 'user',
    'prices': 'admin',
    'archive-preview': 'admin',
    'backup-testing': 'admin'  
  };

  // Check if user has permission for current component
  const canAccessCurrentComponent = !activeComponent || hasPermission(componentPermissions[activeComponent]);

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4 bg-[rgb(52,69,157)] text-white">
        <div className="max-w-7xl mx-auto">
          {/* Header with user info and logout */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">Tech City Inventory System</h1>
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                {userRole === 'admin' ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {userRole === 'admin' ? 'Administrator' : 'User'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">{currentUser.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex flex-wrap gap-2">
            {accessibleComponents.map(component => (
              <button
                key={component.key}
                className={`px-4 py-2 rounded transition-colors ${
                  activeComponent === component.key 
                    ? 'bg-white text-[rgb(52,69,157)]' 
                    : 'bg-transparent hover:bg-white/20'
                }`}
                onClick={() => setActiveComponent(component.key)}
              >
                {component.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="p-4">
        {!canAccessCurrentComponent ? (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
              <p className="text-red-700">
                You don&apos;t have permission to access this section. 
                {userRole !== 'admin' && ' This feature is only available to administrators.'}
              </p>
              <button
                onClick={() => {
                  const firstAccessible = accessibleComponents[0];
                  if (firstAccessible) {
                    setActiveComponent(firstAccessible.key);
                  }
                }}
                className="mt-4 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
              >
                Go to Home
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeComponent === 'summary' && <InventorySummaryForm />}
            {activeComponent === 'selection' && <PhoneSelectionForm />}
            {activeComponent === 'procurement' && <PhoneProcurementForm />}
            {activeComponent === 'procurementmgmt' && <ProcurementManagementForm />}
            {activeComponent === 'stockreceiving' && <StockReceivingForm />}
            {activeComponent === 'suppliers' && <SupplierManagementForm />}
            {activeComponent === 'form' && <PhoneSpecForm />}
            {activeComponent === 'inventory' && <InventoryListForm />}
            {activeComponent === 'phonelist' && <PhoneListForm />}
            {activeComponent === 'prices' && <PriceManagementForm />}
            {activeComponent === 'archive-preview' && <ArchivePreview />}
            {activeComponent === 'backup-testing' && <BackupTestingPanel />} 
          </>
        )}
      </div>
    </div>
  );
}

export default App;