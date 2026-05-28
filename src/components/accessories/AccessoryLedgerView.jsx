import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  User,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar
} from 'lucide-react';
import { getAllSuppliers } from '../../services/supplierService';
import { getAccessoryLedgerBySupplier } from '../../services/accessoryService';
import { formatNumberWithCommas } from '../phone-selection/utils/phoneUtils';

const AccessoryLedgerView = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [suppliersError, setSuppliersError] = useState(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [ledger, setLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    setSuppliersError(null);
    try {
      const res = await getAllSuppliers();
      if (res.success) {
        const list = (res.suppliers || []).sort((a, b) =>
          (a.supplierName || '').localeCompare(b.supplierName || '')
        );
        setSuppliers(list);
      } else {
        setSuppliersError(res.error || 'Failed to load suppliers');
      }
    } catch (err) {
      setSuppliersError(err.message);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const loadLedger = useCallback(async (supplierId) => {
    if (!supplierId) {
      setLedger([]);
      return;
    }
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const res = await getAccessoryLedgerBySupplier(supplierId);
      if (res.success) {
        setLedger(res.ledgerEntries || []);
      } else {
        setLedgerError(res.error || 'Failed to load ledger');
      }
    } catch (err) {
      setLedgerError(err.message);
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  useEffect(() => {
    loadLedger(selectedSupplierId);
  }, [selectedSupplierId, loadLedger]);

  /* ========== SUMMARY ========== */

  const summary = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    let lastPurchase = null;
    let lastPayment = null;

    ledger.forEach((e) => {
      if (e.isDeleted) return;
      if (e.entryType === 'purchase') {
        totalDue += e.amountDue || 0;
        if (!lastPurchase || (e.entryDate || '') > lastPurchase) {
          lastPurchase = e.entryDate || null;
        }
      } else if (e.entryType === 'payment') {
        totalPaid += e.amountPaid || 0;
        if (!lastPayment || (e.entryDate || '') > lastPayment) {
          lastPayment = e.entryDate || null;
        }
      }
    });

    // Outstanding balance comes from the last non-deleted entry's runningBalance
    let outstanding = 0;
    for (let i = ledger.length - 1; i >= 0; i -= 1) {
      if (!ledger[i].isDeleted) {
        outstanding = ledger[i].runningBalance || 0;
        break;
      }
    }

    return {
      totalDue,
      totalPaid,
      outstanding,
      lastPurchase,
      lastPayment
    };
  }, [ledger]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId]
  );

  /* ========== RENDER ========== */

  const formatMoney = (val) => `₱${formatNumberWithCommas((val || 0).toFixed(2))}`;

  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[1400px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-white" />
            <CardTitle className="text-2xl text-white">Accessory Supplier Ledger</CardTitle>
          </div>
          <button
            onClick={() => {
              loadSuppliers();
              if (selectedSupplierId) loadLedger(selectedSupplierId);
            }}
            className="flex items-center gap-1 bg-white text-[rgb(52,69,157)] px-4 py-2 rounded text-base font-medium"
          >
            <RefreshCw className="h-5 w-5 mr-1" />
            <span>Refresh</span>
          </button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {suppliersError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{suppliersError}</span>
            </div>
          )}

          {/* Supplier picker */}
          <div className="p-4 bg-gray-50 border rounded">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="h-4 w-4 inline mr-1" />
              Supplier
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              disabled={loadingSuppliers}
              className="w-full p-2 border rounded bg-white"
            >
              <option value="">
                {loadingSuppliers
                  ? 'Loading suppliers…'
                  : suppliers.length === 0
                  ? 'No suppliers found'
                  : 'Select a supplier to view their accessory ledger'}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierName || s.name || s.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This ledger is independent from the phone supplier ledger. Only accessory
              procurement activity is shown here.
            </p>
          </div>

          {/* Summary cards */}
          {selectedSupplierId && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-white border border-blue-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                    Total Purchases
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-700 mt-1">
                  {formatMoney(summary.totalDue)}
                </p>
              </div>
              <div className="bg-white border border-green-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5 text-green-600" />
                    Total Payments
                  </p>
                </div>
                <p className="text-xl font-bold text-green-700 mt-1">
                  {formatMoney(summary.totalPaid)}
                </p>
              </div>
              <div
                className={`bg-white border rounded-lg p-3 ${
                  summary.outstanding > 0 ? 'border-red-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-gray-600" />
                    Outstanding Balance
                  </p>
                </div>
                <p
                  className={`text-xl font-bold mt-1 ${
                    summary.outstanding > 0 ? 'text-red-700' : 'text-gray-700'
                  }`}
                >
                  {formatMoney(summary.outstanding)}
                </p>
              </div>
              <div className="bg-white border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-600" />
                    Last Activity
                  </p>
                </div>
                <div className="mt-1 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Purchase: </span>
                    <span className="font-medium">{summary.lastPurchase || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Payment: </span>
                    <span className="font-medium">{summary.lastPayment || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ledger table */}
          {selectedSupplierId && (
            <>
              {ledgerError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{ledgerError}</span>
                </div>
              )}

              {loadingLedger ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(52,69,157)]"></div>
                  <p className="mt-2 text-gray-600">Loading ledger…</p>
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    No accessory ledger activity
                  </h3>
                  <p className="text-gray-500">
                    No accessory procurements or payments exist yet for{' '}
                    {selectedSupplier?.supplierName || 'this supplier'}.
                  </p>
                </div>
              ) : (
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        <th className="px-3 py-3 text-left">Date</th>
                        <th className="px-3 py-3 text-left">Type</th>
                        <th className="px-3 py-3 text-left">Reference</th>
                        <th className="px-3 py-3 text-left">Description</th>
                        <th className="px-3 py-3 text-right">Amount Due</th>
                        <th className="px-3 py-3 text-right">Amount Paid</th>
                        <th className="px-3 py-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {ledger.map((entry, idx) => {
                        const deleted = entry.isDeleted;
                        const isPurchase = entry.entryType === 'purchase';
                        const balance = entry.runningBalance || 0;
                        return (
                          <tr
                            key={entry.id}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            } ${deleted ? 'opacity-60' : ''}`}
                          >
                            <td className="px-3 py-2 text-sm">{entry.entryDate || '-'}</td>
                            <td className="px-3 py-2 text-sm">
                              {isPurchase ? (
                                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                  Purchase
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                  Payment
                                </span>
                              )}
                              {deleted && (
                                <span className="ml-1 inline-block px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                                  Deleted
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm font-mono text-xs">
                              {entry.reference || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm">{entry.description || '-'}</td>
                            <td className="px-3 py-2 text-sm text-right">
                              {entry.amountDue > 0 ? (
                                <span className="text-red-700 font-medium">
                                  {formatMoney(entry.amountDue)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-right">
                              {entry.amountPaid > 0 ? (
                                <span className="text-green-700 font-medium">
                                  {formatMoney(entry.amountPaid)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td
                              className={`px-3 py-2 text-sm text-right font-bold ${
                                balance > 0 ? 'text-red-700' : 'text-green-700'
                              }`}
                            >
                              {formatMoney(balance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="px-4 py-3 text-sm text-gray-600 border-t bg-gray-50">
                    {ledger.length} entr{ledger.length !== 1 ? 'ies' : 'y'}
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedSupplierId && !loadingSuppliers && suppliers.length > 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Pick a supplier</h3>
              <p className="text-gray-500">
                Choose a supplier above to see their accessory purchase and payment history.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoryLedgerView;
