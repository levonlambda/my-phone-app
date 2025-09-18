// BackupTestingPanel.jsx - Admin UI for Backup & Testing Operations
// Phase 2: Admin interface for backup and test environment management
console.log('BackupTestingPanel loaded - VERSION 2');
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Download, 
  Database, 
  AlertCircle, 
  CheckCircle,
  Trash2,
  Copy,
  BarChart,
  Shield,
  RefreshCw,
  Upload,
  FileCheck
} from 'lucide-react';
import exportInventoryService from '../services/exportInventory';
import testEnvironmentService from '../services/testEnvironmentService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const BackupTestingPanel = () => {
  // VISIBILITY CONTROL - Set to true to show Test Environment tab
  const showTestEnvironment = false; // ONLY CHANGE: Added this flag to hide Test Environment
  
  // State management
  const [activeTab, setActiveTab] = useState('backup');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [testStats, setTestStats] = useState(null);
  const [backupResult, setBackupResult] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);

  // Handle backup export
  const handleBackupExport = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const result = await exportInventoryService.exportInventory();
      setBackupResult(result);
      setMessage({
        type: 'success',
        text: `Backup completed! ${result.metadata.documentCount} items exported to ${result.filename}`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Backup failed: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle backup file upload and verification
  const handleBackupVerification = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsComparing(true);
    setMessage(null);
    setComparisonResult(null);
    
    try {
      const result = await exportInventoryService.loadAndVerifyBackup(file);
      setComparisonResult(result.comparison);
      
      // Set appropriate message based on comparison status
      if (result.comparison.status === 'PERFECT_MATCH') {
        setMessage({
          type: 'success',
          text: result.comparison.message
        });
      } else {
        setMessage({
          type: 'warning',
          text: result.comparison.message
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Verification failed: ${error.message}`
      });
    } finally {
      setIsComparing(false);
      // Reset file input
      event.target.value = '';
    }
  };
  
  // Download comparison report with supplier name resolution
  const handleDownloadReport = async () => {
  if (comparisonResult) {
    try {
      setMessage({ type: 'info', text: 'Generating enhanced report...' });
      
      // Fetch ALL suppliers - ensure no limits
      console.log('Starting complete supplier fetch...');
      const suppliersRef = collection(db, 'suppliers');
      const querySnapshot = await getDocs(suppliersRef);
      
      console.log(`Total suppliers in database: ${querySnapshot.size}`);
      const suppliers = {};
      let processedCount = 0;
      
      // Process ALL documents
      for (const docSnapshot of querySnapshot.docs) {
        processedCount++;
        const docId = docSnapshot.id;
        const data = docSnapshot.data();
        
        // Log first few for debugging
        if (processedCount <= 5 || docId === 'myvzHq08FqyQuGPW2sqp' || docId === 'XKiX0kHyLRECHFzOvVMq') {
          console.log(`Supplier ${processedCount}/${querySnapshot.size} - ${docId}:`, data);
        }
        
        // Try to find the supplier name from any possible field
        let name = null;
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.length > 0 && 
              (key.toLowerCase().includes('name') || key.toLowerCase().includes('supplier'))) {
            name = value;
            break;
          }
        }
        
        // If no name field found, use the first non-empty string field
        if (!name) {
          for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && value.length > 2 && 
                !key.toLowerCase().includes('id') && 
                !key.toLowerCase().includes('date') &&
                !key.toLowerCase().includes('account')) {
              name = value;
              break;
            }
          }
        }
        
        suppliers[docId] = name || `Supplier (${docId.substring(0, 8)}...)`;
      }
      
      console.log(`Processed all ${processedCount} suppliers`);
      console.log('Verification - checking if problem IDs are now found:');
      console.log('myvzHq08FqyQuGPW2sqp:', suppliers['myvzHq08FqyQuGPW2sqp']);
      console.log('XKiX0kHyLRECHFzOvVMq:', suppliers['XKiX0kHyLRECHFzOvVMq']);
      
      // Add suppliers to comparison result
      const enhancedComparison = {
        ...comparisonResult,
        supplierNames: suppliers
      };
      
      // Generate and download report with supplier names
      await exportInventoryService.downloadComparisonReport(enhancedComparison);
      
      setMessage({
        type: 'success',
        text: 'Enhanced comparison report downloaded successfully'
      });
    } catch (error) {
      console.error('Report generation error:', error);
      setMessage({
        type: 'error',
        text: `Failed to generate report: ${error.message}`
      });
    }
  }
};

  // Handle test environment setup
  const handleTestSetup = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const result = await testEnvironmentService.setupTestEnvironment();
      await loadTestStats();
      setMessage({
        type: 'success',
        text: `Test environment ready! Copied ${result.itemsCopied} items in ${result.duration}ms`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Setup failed: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Load test environment statistics
  const loadTestStats = async () => {
    try {
      const stats = await testEnvironmentService.getTestStatistics();
      setTestStats(stats);
    } catch (error) {
      console.error('Failed to load test stats:', error);
    }
  };

  // Handle test environment cleanup
  const handleTestCleanup = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const result = await testEnvironmentService.cleanupTestEnvironment();
      if (result.cancelled) {
        setMessage({
          type: 'info',
          text: 'Cleanup cancelled'
        });
      } else {
        setTestStats(null);
        setMessage({
          type: 'success',
          text: `Cleanup complete! Deleted ${result.deletedCount} documents`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Cleanup failed: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        
        {/* Header */}
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Shield className="h-6 w-6 mr-2" />
            Backup & Testing Panel
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-white p-4 space-y-6">
          
          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg flex items-center ${
              message.type === 'success' ? 'bg-green-50 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 border border-red-200' :
              message.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              ) : message.type === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              ) : message.type === 'warning' ? (
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
              )}
              <span className={
                message.type === 'success' ? 'text-green-800' :
                message.type === 'error' ? 'text-red-800' :
                message.type === 'warning' ? 'text-yellow-800' :
                'text-blue-800'
              }>
                {message.text}
              </span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('backup')}
              className={`pb-2 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'backup'
                  ? 'text-[rgb(52,69,157)] border-b-2 border-[rgb(52,69,157)]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Backup Operations
            </button>
            {showTestEnvironment && ( // ONLY CHANGE: Wrapped in conditional
              <button
                onClick={() => setActiveTab('testing')}
                className={`pb-2 px-4 text-sm font-semibold transition-colors ${
                  activeTab === 'testing'
                    ? 'text-[rgb(52,69,157)] border-b-2 border-[rgb(52,69,157)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Test Environment
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            
            {/* Backup Tab */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                
                {/* Backup Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Backup Instructions
                  </h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Always create a backup before making any archive operations</li>
                    <li>• Backups are downloaded as JSON files with timestamps</li>
                    <li>• Store backups in a safe location for at least 30 days</li>
                    <li>• Each backup includes data integrity checksums</li>
                  </ul>
                </div>

                {/* Backup Actions - NOW WITH ALL 3 CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Card 1: Export Backup */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center mb-4">
                      <Download className="h-8 w-8 text-[rgb(52,69,157)] mr-3" />
                      <div>
                        <h4 className="text-lg font-semibold">Export Backup</h4>
                        <p className="text-sm text-gray-600">
                          Download complete inventory as JSON
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleBackupExport}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creating Backup...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Create Backup Now
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card 2: Verify Backup - THIS WAS MISSING! */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center mb-4">
                      <FileCheck className="h-8 w-8 text-purple-600 mr-3" />
                      <div>
                        <h4 className="text-lg font-semibold">Verify Backup</h4>
                        <p className="text-sm text-gray-600">
                          Compare backup with database
                        </p>
                      </div>
                    </div>
                    <label className="w-full block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleBackupVerification}
                        disabled={isComparing}
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        onClick={(e) => e.currentTarget.parentElement.querySelector('input').click()}
                        disabled={isComparing}
                      >
                        {isComparing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Comparing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload & Verify
                          </>
                        )}
                      </button>
                    </label>
                  </div>

                  {/* Card 3: Backup Statistics */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center mb-4">
                      <BarChart className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <h4 className="text-lg font-semibold">Backup Statistics</h4>
                        <p className="text-sm text-gray-600">
                          Last backup information
                        </p>
                      </div>
                    </div>
                    {backupResult ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Documents:</span>
                          <span className="font-medium">{backupResult.metadata.documentCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{backupResult.metadata.exportDuration}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Checksum:</span>
                          <span className="font-mono text-xs">{backupResult.metadata.checksum}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No backup created yet</p>
                    )}
                  </div>
                </div>

                {/* Backup History Note */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    <p className="text-sm text-yellow-800">
                      Backups are saved to your Downloads folder. Keep them for at least 30 days after any archive operation.
                    </p>
                  </div>
                </div>

                {/* Comparison Results - Shows after verification */}
                {comparisonResult && (
                  <div className="bg-white rounded-lg border border-gray-300 p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold">Backup Comparison Results</h4>
                      <button
                        onClick={handleDownloadReport}
                        className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm flex items-center"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download Report
                      </button>
                    </div>
                    
                    {/* Integrity Score */}
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-gray-600 mr-2">Integrity Score:</span>
                        <span className={`text-2xl font-bold ${
                          comparisonResult.integrityScore === 100 ? 'text-green-600' :
                          comparisonResult.integrityScore >= 90 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {comparisonResult.integrityScore}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            comparisonResult.integrityScore === 100 ? 'bg-green-600' :
                            comparisonResult.integrityScore >= 90 ? 'bg-yellow-600' :
                            'bg-red-600'
                          }`}
                          style={{ width: `${comparisonResult.integrityScore}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Comparison Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-xs text-gray-600">Backup Items</p>
                        <p className="text-xl font-bold">{comparisonResult.counts.backup}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-xs text-gray-600">Current Items</p>
                        <p className="text-xl font-bold">{comparisonResult.counts.current}</p>
                      </div>
                      <div className="bg-green-50 rounded p-3">
                        <p className="text-xs text-gray-600">Matching</p>
                        <p className="text-xl font-bold text-green-600">{comparisonResult.counts.matching}</p>
                      </div>
                      <div className="bg-yellow-50 rounded p-3">
                        <p className="text-xs text-gray-600">Modified</p>
                        <p className="text-xl font-bold text-yellow-600">{comparisonResult.counts.modified}</p>
                      </div>
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-xs text-gray-600">New Items</p>
                        <p className="text-xl font-bold text-blue-600">{comparisonResult.counts.added}</p>
                      </div>
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-xs text-gray-600">Deleted</p>
                        <p className="text-xl font-bold text-red-600">{comparisonResult.counts.deleted}</p>
                      </div>
                    </div>
                    
                    {/* Field Change Summary */}
                    {comparisonResult.fieldMismatches && comparisonResult.fieldMismatches.length > 0 && (
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Most Changed Fields:</h5>
                        <div className="space-y-1">
                          {comparisonResult.fieldMismatches.slice(0, 5).map((field, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600">{field.field}:</span>
                              <span className="font-medium">{field.count} changes</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Testing Tab - ALL CODE PRESERVED, just hidden when showTestEnvironment is false */}
            {activeTab === 'testing' && showTestEnvironment && ( // ONLY CHANGE: Added showTestEnvironment condition
              <div className="space-y-6">
                
                {/* Test Environment Instructions */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    Test Environment
                  </h3>
                  <ul className="space-y-1 text-sm text-green-800">
                    <li>• Test collections mirror production data for safe testing</li>
                    <li>• All archive operations should be tested here first</li>
                    <li>• Test collections: inventory_test, inventory_archives_test</li>
                    <li>• Changes in test environment don&apos;t affect production</li>
                  </ul>
                </div>

                {/* Test Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Setup Test Environment */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <Copy className="h-8 w-8 text-blue-600 mb-3" />
                    <h4 className="text-lg font-semibold mb-2">Setup Test</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Copy production to test
                    </p>
                    <button
                      onClick={handleTestSetup}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Setting up...' : 'Setup Environment'}
                    </button>
                  </div>

                  {/* View Statistics */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <Database className="h-8 w-8 text-green-600 mb-3" />
                    <h4 className="text-lg font-semibold mb-2">Statistics</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      View test data stats
                    </p>
                    <button
                      onClick={loadTestStats}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Loading...' : 'Load Statistics'}
                    </button>
                  </div>

                  {/* Cleanup Test Environment */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <Trash2 className="h-8 w-8 text-red-600 mb-3" />
                    <h4 className="text-lg font-semibold mb-2">Cleanup</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Delete test collections
                    </p>
                    <button
                      onClick={handleTestCleanup}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Cleaning...' : 'Clean Environment'}
                    </button>
                  </div>
                </div>

                {/* Test Statistics Display */}
                {testStats && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h4 className="text-lg font-semibold mb-4">Test Environment Statistics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(testStats).map(([key, stats]) => (
                        <div key={key} className="bg-white rounded-lg p-4 border border-gray-300">
                          <h5 className="font-semibold text-gray-700 mb-2">
                            {stats.collection}
                          </h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Documents:</span>
                              <span className="font-medium">{stats.documentCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Size (KB):</span>
                              <span className="font-medium">{stats.estimatedSize}</span>
                            </div>
                            {stats.statusBreakdown && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-semibold text-gray-600 mb-1">Status Breakdown:</p>
                                {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                                  <div key={status} className="flex justify-between text-xs">
                                    <span className="text-gray-500">{status}:</span>
                                    <span>{count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning Note */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
                    <p className="text-sm text-orange-800">
                      Always test archive operations in the test environment before running on production data.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupTestingPanel;