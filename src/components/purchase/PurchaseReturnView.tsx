import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/translations';
import { PurchaseInvoice, PurchaseReturn } from '../../types';
import { canUserDelete, canUserReturn } from '../../utils/permissions';
import {
  RotateCcw,
  Package,
  Printer,
  Download,
  Filter,
  Trash2,
  Clock,
  ArrowRight,
  Wallet,
  TrendingDown,
  Receipt,
  AlertTriangle,
  X,
} from 'lucide-react';
import { getEffectiveConversionFactor, formatCleanNumber } from '../../utils/unitConversion';

interface PurchaseReturnViewProps {
  initialInvoice?: PurchaseInvoice | null;
  onClose?: () => void;
}

export const PurchaseReturnView: React.FC<PurchaseReturnViewProps> = ({ initialInvoice, onClose }) => {
  const {
    language,
    purchaseInvoices,
    purchaseReturns,
    products,
    parties,
    wallets,
    users,
    currentUser,
    formatCurrency,
    createPurchaseReturn,
    deletePurchaseReturn,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();
  const { t } = useTranslation(language);

  const hasDeletePermission = canUserDelete(currentUser, 'purchase');
  const hasReturnPermission = canUserReturn(currentUser, 'purchase');

  const suppliers = parties.filter(p => p.type === 'SUPPLIER');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [returnToDelete, setReturnToDelete] = useState<PurchaseReturn | null>(null);

  // Helper to resolve creator / cashier info
  const getCreatorInfo = (ret: PurchaseReturn) => {
    const user = users.find(
      u =>
        u.id === ret.createdBy ||
        u.username.toLowerCase() === (ret.createdBy || '').toLowerCase() ||
        u.fullName.toLowerCase() === (ret.createdBy || '').toLowerCase()
    );
    const name = user?.fullName || ret.createdBy || currentUser?.fullName || 'Admin';
    const role = user?.role || (name.toLowerCase().includes('cashier') ? 'CASHIER' : 'ADMIN');
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'AD';
    return { name, role, initials, user };
  };

  const filteredPurchaseReturns = useMemo(() => {
    if (selectedSupplierId === 'ALL') return purchaseReturns;
    return purchaseReturns.filter(ret => ret.supplierId === selectedSupplierId);
  }, [purchaseReturns, selectedSupplierId]);

  const handlePrintReport = (autoDownloadPdf = false) => {
    const printDate = new Date().toLocaleDateString('en-GB');
    const selectedSup = suppliers.find(s => s.id === selectedSupplierId);
    const reportTitle = language === 'bn' ? 'ক্রয় ফেরত খাতা ও রিপোর্ট' : 'PURCHASE RETURN REPORT';
    const totalRefundAmt = filteredPurchaseReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalDueAdj = filteredPurchaseReturns.reduce((sum, r) => sum + (r.dueAdjusted || 0), 0);
    const totalCashRef = filteredPurchaseReturns.reduce(
      (sum, r) => sum + (r.cashRefunded !== undefined ? r.cashRefunded : r.totalAmount || 0),
      0
    );

    openPrintModal({
      type: 'REPORT',
      title: reportTitle,
      autoDownloadPdf,
      data: {
        reportTitle,
        period: `${language === 'bn' ? 'তৈরির তারিখ:' : 'Report Date:'} ${printDate}`,
        filters: [
          {
            label: language === 'bn' ? 'সাপ্লায়ার' : 'Supplier',
            value:
              selectedSupplierId === 'ALL'
                ? language === 'bn'
                  ? 'সকল সাপ্লায়ার'
                  : 'All Suppliers'
                : selectedSup?.name || selectedSupplierId,
          },
        ],
        kpis: [
          { label: language === 'bn' ? 'মোট ফেরত এন্ট্রি' : 'Total Return Count', value: `${filteredPurchaseReturns.length}` },
          { label: language === 'bn' ? 'মোট ফেরত মূল্য' : 'Total Return Value', value: totalRefundAmt },
          { label: language === 'bn' ? 'দেনা সমন্বয় (Payable)' : 'Payable Adjusted', value: totalDueAdj },
          { label: language === 'bn' ? 'নগদ রিফান্ড' : 'Cash Received', value: totalCashRef },
        ],
        columns: [
          { header: 'Return #', key: 'returnNumber' },
          { header: language === 'bn' ? 'তারিখ ও সময়' : 'Date & Time', key: 'date' },
          { header: language === 'bn' ? 'মূল ক্রয় বিল নং' : 'Original Bill #', key: 'originalBillNumber' },
          { header: language === 'bn' ? 'সাপ্লায়ার' : 'Supplier', key: 'supplierName' },
          { header: language === 'bn' ? 'ফেরতকৃত পণ্যসমূহ' : 'Returned Items', key: 'returnedItems' },
          { header: language === 'bn' ? 'দেনা সমন্বয়' : 'Payable Adjusted', key: 'dueAdjusted', align: 'right', format: 'currency' },
          { header: language === 'bn' ? 'নগদ রিফান্ড' : 'Cash Refund', key: 'cashRefunded', align: 'right', format: 'currency' },
          { header: language === 'bn' ? 'মোট ফেরত' : 'Return Total', key: 'totalRefund', align: 'right', format: 'currency' },
        ],
        rows: filteredPurchaseReturns.map(r => ({
          returnNumber: r.returnNumber,
          date: r.createdAt || r.date,
          originalBillNumber: `#${r.originalBillNumber}`,
          supplierName: r.supplierName,
          returnedItems: r.items.map(it => `${it.productName} (${it.returnQuantity} ${it.unit})`).join(', '),
          dueAdjusted: r.dueAdjusted || 0,
          cashRefunded: r.cashRefunded !== undefined ? r.cashRefunded : r.totalAmount,
          totalRefund: r.totalAmount,
        })),
        totals: {
          supplierName: 'TOTAL',
          dueAdjusted: totalDueAdj,
          cashRefunded: totalCashRef,
          totalRefund: totalRefundAmt,
        },
      },
    });
  };

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(initialInvoice?.id || '');
  const [returnItems, setReturnItems] = useState<{ [rowKey: string]: number }>({});
  const [refundWalletId, setRefundWalletId] = useState<string>(wallets[0]?.id || '');
  const [settlementMode, setSettlementMode] = useState<'AUTO' | 'CASH_REFUND'>('AUTO');
  const [reason, setReason] = useState<string>('Defective goods or supplier return');

  const selectedInvoice = purchaseInvoices.find(i => i.id === selectedInvoiceId);

  const selectedSupplier = useMemo(() => {
    if (!selectedInvoice || !selectedInvoice.supplierId) return undefined;
    return parties.find(p => p.id === selectedInvoice.supplierId);
  }, [selectedInvoice, parties]);

  // Previously returned quantity per productId for the selected purchase bill
  const previouslyReturnedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedInvoice) return map;
    purchaseReturns
      .filter(r => r.purchaseId === selectedInvoice.id)
      .forEach(ret => {
        ret.items.forEach(it => {
          map.set(it.productId, Number(((map.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4)));
        });
      });
    return map;
  }, [selectedInvoice, purchaseReturns]);

  // Remaining returnable quantity per row
  const rowReturnLimits = useMemo(() => {
    if (!selectedInvoice) return [] as { alreadyReturned: number; remaining: number }[];
    const consumedPrev = new Map<string, number>();
    return selectedInvoice.items.map(item => {
      const totalPrev = previouslyReturnedByProduct.get(item.productId) || 0;
      const usedPrev = consumedPrev.get(item.productId) || 0;
      const availPrevForRow = Math.max(0, Number((totalPrev - usedPrev).toFixed(4)));
      const rowPrev = Math.min(Number(item.quantity || 0), availPrevForRow);
      consumedPrev.set(item.productId, Number((usedPrev + rowPrev).toFixed(4)));
      const remaining = Math.max(0, Number((Number(item.quantity || 0) - rowPrev).toFixed(4)));
      return { alreadyReturned: rowPrev, remaining };
    });
  }, [selectedInvoice, previouslyReturnedByProduct]);

  const getRowKey = (productId: string, idx: number) => `${productId}::${idx}`;

  const handleQtyChange = (rowKey: string, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(qty, maxQty));
    setReturnItems(prev => ({
      ...prev,
      [rowKey]: validQty,
    }));
  };

  const handleReturnAllRemaining = () => {
    if (!selectedInvoice) return;
    const next: { [rowKey: string]: number } = {};
    selectedInvoice.items.forEach((item, idx) => {
      const lim = rowReturnLimits[idx]?.remaining || 0;
      if (lim > 0) {
        next[getRowKey(item.productId, idx)] = lim;
      }
    });
    setReturnItems(next);
  };

  const calculatedRefund = selectedInvoice
    ? Number(
        selectedInvoice.items
          .reduce((sum, item, idx) => {
            const retQty = returnItems[getRowKey(item.productId, idx)] || 0;
            return sum + retQty * item.purchasePrice;
          }, 0)
          .toFixed(2)
      )
    : 0;

  const totalBaseStockToDeduct = useMemo(() => {
    if (!selectedInvoice) return 0;
    return Number(
      selectedInvoice.items
        .reduce((sum, item, idx) => {
          const retQty = returnItems[getRowKey(item.productId, idx)] || 0;
          if (retQty <= 0) return sum;
          const prod = products.find(p => p.id === item.productId);
          const factor = getEffectiveConversionFactor(item, prod);
          return sum + retQty * factor;
        }, 0)
        .toFixed(4)
    );
  }, [selectedInvoice, returnItems, products]);

  // Live preview of automatic Total Payable, Bill Amount & Cash Refund (mirrors AppContext)
  const settlementPreview = useMemo(() => {
    const returnAmount = calculatedRefund;
    const currentSupplierPayable = selectedSupplier ? Math.max(0, Number(selectedSupplier.currentBalance || 0)) : 0;

    if (!selectedInvoice || returnAmount <= 0) {
      return {
        dueAdjusted: 0,
        cashRefunded: 0,
        currentSupplierPayable,
        newSupplierPayable: currentSupplierPayable,
        newGrandTotal: selectedInvoice?.grandTotal || 0,
        newBillDue: selectedInvoice?.dueAmount || 0,
      };
    }

    const billDue = Math.max(0, Number(selectedInvoice.dueAmount || 0));
    const billPaid = Math.max(0, Number(selectedInvoice.paidAmount || 0));

    let partyDueReduced = 0;
    let billOnlyDueReduced = 0;
    let cashRefunded = 0;

    if (settlementMode === 'CASH_REFUND') {
      const maxCashFromBill = Math.min(returnAmount, billPaid);
      cashRefunded = Number(maxCashFromBill.toFixed(2));
      const unpaidPortion = Number(Math.max(0, returnAmount - cashRefunded).toFixed(2));
      if (unpaidPortion > 0) {
        if (selectedSupplier && currentSupplierPayable > 0) {
          partyDueReduced = Number(Math.min(unpaidPortion, currentSupplierPayable).toFixed(2));
        } else if (!selectedSupplier && billDue > 0) {
          billOnlyDueReduced = Number(Math.min(unpaidPortion, billDue).toFixed(2));
        }
        const adjusted = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));
        cashRefunded = Number(Math.max(0, returnAmount - adjusted).toFixed(2));
      }
    } else {
      if (selectedSupplier && currentSupplierPayable > 0) {
        partyDueReduced = Number(Math.min(returnAmount, currentSupplierPayable).toFixed(2));
      } else if (!selectedSupplier && billDue > 0) {
        billOnlyDueReduced = Number(Math.min(returnAmount, billDue).toFixed(2));
      }
      const totalPayableOffset = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));
      cashRefunded = Number(Math.max(0, returnAmount - totalPayableOffset).toFixed(2));
    }

    const dueAdjusted = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));
    const newSupplierPayable = Math.max(0, Number((currentSupplierPayable - partyDueReduced).toFixed(2)));
    const billGrandDelta = Math.min(selectedInvoice.grandTotal, returnAmount);
    const billDueDelta = Math.min(selectedInvoice.dueAmount, dueAdjusted);

    return {
      dueAdjusted,
      cashRefunded,
      currentSupplierPayable,
      newSupplierPayable,
      newGrandTotal: Math.max(0, Number((selectedInvoice.grandTotal - billGrandDelta).toFixed(2))),
      newBillDue: Math.max(0, Number((selectedInvoice.dueAmount - billDueDelta).toFixed(2))),
    };
  }, [selectedInvoice, calculatedRefund, selectedSupplier, settlementMode]);

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasReturnPermission) {
      showToast(
        language === 'bn' ? 'পণ্য ফেরত দেওয়ার অনুমতি আপনার নেই।' : 'You do not have permission to process returns.',
        'error'
      );
      return;
    }
    if (!selectedInvoice) return;

    const itemsToReturn = selectedInvoice.items
      .map((i, idx) => ({ item: i, retQty: returnItems[getRowKey(i.productId, idx)] || 0 }))
      .filter(entry => entry.retQty > 0)
      .map(({ item: i, retQty }) => {
        const prod = products.find(p => p.id === i.productId);
        const factor = getEffectiveConversionFactor(i, prod);
        return {
          productId: i.productId,
          productName: i.productName,
          unit: i.unit,
          conversionFactor: factor,
          baseQuantity: Number((retQty * factor).toFixed(4)),
          purchasePrice: i.purchasePrice,
          returnQuantity: retQty,
          totalAmount: Number((retQty * i.purchasePrice).toFixed(2)),
          batchNumber: i.batchNumber,
          expDate: i.expDate,
        };
      });

    if (itemsToReturn.length === 0) {
      showToast(
        language === 'bn'
          ? 'ফেরতের জন্য অন্তত একটি পণ্যের পরিমাণ দিন!'
          : 'Please specify return quantity for at least one item!',
        'warning'
      );
      return;
    }

    const success = createPurchaseReturn({
      purchaseId: selectedInvoice.id,
      originalBillNumber: selectedInvoice.billNumber,
      supplierId: selectedInvoice.supplierId,
      supplierName: selectedInvoice.supplierName,
      items: itemsToReturn,
      totalAmount: calculatedRefund,
      refundWalletId,
      reason,
      settlementMode,
    });

    if (success) {
      if (onClose) {
        onClose();
      } else {
        setSelectedInvoiceId('');
        setReturnItems({});
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <span>{language === 'bn' ? 'ক্রয় ফেরত (Purchase Returns)' : 'Purchase Returns'}</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {language === 'bn'
              ? 'ক্রয় রিটার্নে অটো স্টক আপডেট, বিল এমাউন্ট সমন্বয় এবং Total Payable অটোমেটিক আপডেট হবে'
              : 'Auto-deduct inventory, update original bill amounts & auto-adjust Total Payable'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('purchase-list')}
          className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer"
        >
          ← {language === 'bn' ? 'ক্রয় তালিকা' : 'Purchase List'}
        </button>
      </div>

      {/* Return Creation Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          {language === 'bn' ? 'নতুন ক্রয় ফেরত প্রক্রিয়া' : 'Process New Purchase Return'}
        </h3>

        <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                {language === 'bn' ? 'মূল ক্রয় বিল সিলেক্ট করুন *' : 'Select Original Purchase Bill *'}
              </label>
              <select
                value={selectedInvoiceId}
                onChange={e => {
                  setSelectedInvoiceId(e.target.value);
                  setReturnItems({});
                }}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono"
              >
                <option value="">{language === 'bn' ? '-- ক্রয় বিল বাছাই করুন --' : '-- Choose Purchase Bill --'}</option>
                {purchaseInvoices.map(inv => {
                  const isFullRet = inv.returnStatus === 'FULL';
                  return (
                    <option key={inv.id} value={inv.id} disabled={isFullRet}>
                      {inv.billNumber} • {inv.supplierName} ({inv.date}) • ৳{inv.grandTotal.toLocaleString()}
                      {inv.dueAmount > 0 ? ` [Due: ৳${inv.dueAmount.toLocaleString()}]` : ''}
                      {isFullRet ? ' [Full Returned]' : inv.returnStatus === 'PARTIAL' ? ' [Partial Return]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                {language === 'bn' ? 'সমন্বয় পদ্ধতি (Payable / Refund)' : 'Adjustment Mode (Payable / Cash)'}
              </label>
              <select
                value={settlementMode}
                onChange={e => setSettlementMode(e.target.value as 'AUTO' | 'CASH_REFUND')}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium"
              >
                <option value="AUTO">
                  {language === 'bn'
                    ? 'অটো: আগে দেনা (Payable) কমবে, বাকিটা ক্যাশ রিসিভ'
                    : 'Auto: Reduce Total Payable First, Rest Cash'}
                </option>
                <option value="CASH_REFUND">
                  {language === 'bn'
                    ? 'নগদ রিফান্ড (পরিশোধিত টাকার মধ্যে ক্যাশ রিসিভ)'
                    : 'Cash Refund First (Up to Bill Paid Amount)'}
                </option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                {language === 'bn' ? 'রিফান্ড / ক্যাশ রিসিভ অ্যাকাউন্ট' : 'Refund Wallet / Account'}
                {settlementPreview.cashRefunded > 0 && <span className="text-amber-500"> *</span>}
              </label>
              <select
                value={refundWalletId}
                onChange={e => setRefundWalletId(e.target.value)}
                disabled={selectedInvoice !== undefined && calculatedRefund > 0 && settlementPreview.cashRefunded === 0}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs disabled:opacity-60"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({language === 'bn' ? 'ব্যালেন্স' : 'Balance'}: ৳{w.balance.toLocaleString()})
                  </option>
                ))}
              </select>
              {selectedInvoice && calculatedRefund > 0 && settlementPreview.cashRefunded === 0 && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  {language === 'bn'
                    ? 'সম্পূর্ণ টাকা মহাজনের দেনা (Payable) থেকে অটো সমন্বয় হবে — ক্যাশে যোগ হবে না।'
                    : 'Full amount auto-adjusts against Supplier Payable — no cash wallet change.'}
                </p>
              )}
            </div>
          </div>

          {/* Bill Summary & Items */}
          {selectedInvoice && (
            <div className="mt-4 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-850 p-3 flex flex-wrap justify-between items-center text-xs font-medium gap-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">{language === 'bn' ? 'ক্রয় বিল নং:' : 'Bill:'}</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                      #{selectedInvoice.billNumber}
                    </span>
                  </div>
                  <div>
                    {language === 'bn' ? 'সাপ্লায়ার:' : 'Supplier:'}{' '}
                    <strong className="text-zinc-900 dark:text-white">{selectedInvoice.supplierName}</strong>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {language === 'bn' ? 'বিল:' : 'Total:'} ৳{selectedInvoice.grandTotal.toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                      {language === 'bn' ? 'পরিশোধ:' : 'Paid:'} ৳{selectedInvoice.paidAmount.toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-100/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {language === 'bn' ? 'বিল বাকি:' : 'Bill Due:'} ৳{selectedInvoice.dueAmount.toLocaleString()}
                    </span>
                    {selectedSupplier && (
                      <span className="px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                        {language === 'bn' ? 'মোট দেনা (Payable):' : 'Total Payable:'} ৳
                        {Math.max(0, Number(selectedSupplier.currentBalance || 0)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReturnAllRemaining}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-[11px] font-bold cursor-pointer"
                >
                  {language === 'bn' ? 'সব অবশিষ্ট পণ্য রিটার্ন দিন' : 'Return All Remaining'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="py-2.5 px-3">{language === 'bn' ? 'পণ্যের বিবরণ' : 'Item Description'}</th>
                      <th className="py-2.5 px-3 text-center">{language === 'bn' ? 'ক্রয়কৃত' : 'Purchased Qty'}</th>
                      <th className="py-2.5 px-3 text-center">{language === 'bn' ? 'অবশিষ্ট' : 'Returnable'}</th>
                      <th className="py-2.5 px-3 text-right">{language === 'bn' ? 'ক্রয় দর' : 'Purchase Price'}</th>
                      <th className="py-2.5 px-3 text-center w-36">{language === 'bn' ? 'ফেরত পরিমাণ' : 'Return Qty'}</th>
                      <th className="py-2.5 px-3 text-right">{language === 'bn' ? 'ফেরত এমাউন্ট' : 'Return Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {selectedInvoice.items.map((item, idx) => {
                      const rKey = getRowKey(item.productId, idx);
                      const retQty = returnItems[rKey] || 0;
                      const prod = products.find(p => p.id === item.productId);
                      const factor = getEffectiveConversionFactor(item, prod);
                      const limit = rowReturnLimits[idx] || { alreadyReturned: 0, remaining: item.quantity };
                      return (
                        <tr key={rKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                            <div>{item.productName}</div>
                            {prod && (
                              <div className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                                {language === 'bn' ? 'বর্তমান স্টক:' : 'Current Stock:'}{' '}
                                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                  {formatCleanNumber(prod.stock)} {prod.unit}
                                </span>
                                {factor > 1 && (
                                  <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                                    (1 {item.unit} = {factor} {prod.unit})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <div>
                              {item.quantity} {item.unit}
                            </div>
                            {limit.alreadyReturned > 0 && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                ({language === 'bn' ? 'ফেরত:' : 'Ret:'} {formatCleanNumber(limit.alreadyReturned)})
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-200">
                            {formatCleanNumber(limit.remaining)} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">৳{item.purchasePrice.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              max={limit.remaining}
                              disabled={limit.remaining <= 0}
                              value={retQty}
                              onChange={e => handleQtyChange(rKey, parseFloat(e.target.value) || 0, limit.remaining)}
                              className="w-20 p-1 text-center font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded disabled:opacity-50"
                            />
                            {prod && retQty > 0 && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5 font-semibold">
                                -{formatCleanNumber(retQty * factor)} {prod.unit} {language === 'bn' ? 'স্টক কমবে' : 'stock'}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            ৳{(retQty * item.purchasePrice).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Live Automatic Accounting & Stock Impact Preview */}
              {calculatedRefund > 0 && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-900/60">
                  <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-2">
                    {language === 'bn'
                      ? 'অটো আপডেট প্রিভিউ (স্টক, বিল এমাউন্ট ও Total Payable)'
                      : 'Automatic Update Preview (Stock, Bill Amount & Total Payable)'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-amber-200 dark:border-amber-900/60">
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-semibold">
                        <Package className="w-3 h-3 text-amber-600" />
                        <span>{language === 'bn' ? 'অটো স্টক আপডেট' : 'Auto Stock Deduct'}</span>
                      </div>
                      <div className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                        -{formatCleanNumber(totalBaseStockToDeduct)} {language === 'bn' ? 'ইউনিট' : 'base units'}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-semibold">
                        <Receipt className="w-3 h-3 text-blue-600" />
                        <span>{language === 'bn' ? 'বিল এমাউন্ট আপডেট' : 'Bill Amount Update'}</span>
                      </div>
                      <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-xs mt-1 flex items-center gap-1 flex-wrap">
                        <span>৳{selectedInvoice.grandTotal.toLocaleString()}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="text-blue-600 dark:text-blue-400 font-black">
                          ৳{settlementPreview.newGrandTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {language === 'bn' ? 'বিল বাকি:' : 'Bill Due:'} ৳{selectedInvoice.dueAmount.toLocaleString()} → ৳
                        {settlementPreview.newBillDue.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-rose-200 dark:border-rose-900/60">
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-semibold">
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                        <span>{language === 'bn' ? 'Total Payable সমন্বয়' : 'Total Payable Auto-Adjust'}</span>
                      </div>
                      <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm mt-0.5">
                        {settlementPreview.dueAdjusted > 0
                          ? `-৳${settlementPreview.dueAdjusted.toLocaleString()}`
                          : '৳0'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        ৳{settlementPreview.currentSupplierPayable.toLocaleString()} → ৳
                        {settlementPreview.newSupplierPayable.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-900/60">
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-semibold">
                        <Wallet className="w-3 h-3 text-emerald-600" />
                        <span>{language === 'bn' ? 'নগদ / ওয়ালেট রিসিভ' : 'Cash / Wallet Refund'}</span>
                      </div>
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                        {formatCurrency(settlementPreview.cashRefunded)}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {settlementPreview.cashRefunded > 0
                          ? wallets.find(w => w.id === refundWalletId)?.name || 'Wallet'
                          : language === 'bn'
                            ? 'দেনা থেকে সমন্বয়'
                            : 'Adjusted vs Payable'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-zinc-50 dark:bg-zinc-850 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-zinc-500 block mb-0.5">
                    {language === 'bn' ? 'রিটার্নের কারণ / নোট:' : 'Return Reason Note:'}
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={language === 'bn' ? 'ফেরতের কারণ লিখুন...' : 'Reason for return...'}
                    className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs w-full sm:w-80"
                  />
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-zinc-500 font-semibold">
                    {language === 'bn' ? 'মোট রিটার্ন এমাউন্ট:' : 'Total Return Amount:'}
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                    {formatCurrency(calculatedRefund)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          {selectedInvoice && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={calculatedRefund <= 0}
                className={`px-5 py-2.5 rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 ${
                  calculatedRefund <= 0
                    ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {language === 'bn'
                    ? 'ক্রয় রিটার্ন কনফার্ম ও অটো আপডেট করুন'
                    : 'Confirm Purchase Return & Auto-Update Stock / Payable'}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Purchase Return History Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
            <span>{language === 'bn' ? 'পূর্ববর্তী ক্রয় ফেরতের তালিকা ও রিপোর্ট' : 'Purchase Return History & Reports'}</span>
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] rounded-full font-mono">
              {filteredPurchaseReturns.length}
            </span>
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="py-1.5 px-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
              >
                <option value="ALL">{language === 'bn' ? 'সকল সাপ্লায়ার (All Suppliers)' : 'All Suppliers'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handlePrintReport(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintReport(false)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'প্রিন্ট রিপোর্ট' : 'Print Report'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Return #</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'তারিখ ও সময়' : 'Date & Time'}</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'মূল ক্রয় বিল নং' : 'Original Bill #'}</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'সাপ্লায়ার' : 'Supplier Name'}</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'ইউজার / ক্যাশিয়ার' : 'Created By'}</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'ফেরতকৃত পণ্যসমূহ' : 'Returned Products & Qty'}</th>
                <th className="py-2.5 px-3">{language === 'bn' ? 'কারণ' : 'Reason'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'bn' ? 'রিটার্ন ও সমন্বয়' : 'Return & Settlement'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredPurchaseReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    {language === 'bn' ? 'কোনো ক্রয় ফেরতের রেকর্ড নেই।' : 'No purchase return records found.'}
                  </td>
                </tr>
              ) : (
                filteredPurchaseReturns.map(ret => {
                  const creator = getCreatorInfo(ret);
                  const dueAdj = Number(ret.dueAdjusted || 0);
                  const cashRef = ret.cashRefunded !== undefined ? Number(ret.cashRefunded) : Number(ret.totalAmount || 0);
                  return (
                    <tr key={ret.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-600">{ret.returnNumber}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">{ret.date}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{ret.createdAt || ret.date}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900 text-xs">
                          #{ret.originalBillNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">{ret.supplierName}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[9px] flex items-center justify-center shrink-0">
                            {creator.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">{creator.name}</div>
                            <div className="text-[9px] text-zinc-400 font-mono">{creator.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="text-zinc-700 dark:text-zinc-300 font-medium">
                              • {it.productName} —{' '}
                              <strong className="font-mono text-amber-600">
                                {it.returnQuantity} {it.unit}
                              </strong>{' '}
                              (@৳{it.purchasePrice})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500 italic">{ret.reason}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(ret.totalAmount)}
                        </div>
                        <div className="text-[10px] space-y-0.5 mt-0.5 font-mono">
                          {dueAdj > 0 && (
                            <div className="text-rose-600 dark:text-rose-400 font-semibold">
                              {language === 'bn' ? 'Payable কমেছে:' : 'Payable -'} ৳{dueAdj.toLocaleString()}
                            </div>
                          )}
                          {cashRef > 0 && (
                            <div className="text-emerald-600 dark:text-emerald-400">
                              {language === 'bn' ? 'ক্যাশ রিসিভ:' : 'Cash:'} ৳{cashRef.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const printData = {
                                billNumber: ret.returnNumber,
                                originalBillNumber: ret.originalBillNumber,
                                date: ret.createdAt || ret.date,
                                supplierName: ret.supplierName,
                                cashierName: creator.name,
                                createdBy: ret.createdBy,
                                items: ret.items.map(i => ({
                                  name: i.productName,
                                  quantity: i.returnQuantity,
                                  unitPrice: i.purchasePrice,
                                })),
                                grandTotal: ret.totalAmount,
                                paidAmount: cashRef,
                                dueAmount: dueAdj,
                                documentTitle: language === 'bn' ? 'ক্রয় ফেরত ভাউচার' : 'PURCHASE RETURN',
                              };
                              openPrintModal({ type: 'PURCHASE_VOUCHER', title: 'Purchase Return', data: printData });
                            }}
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded cursor-pointer transition-colors"
                            title={language === 'bn' ? 'প্রিন্ট করুন' : 'Print'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {hasDeletePermission && (
                            <button
                              type="button"
                              onClick={() => setReturnToDelete(ret)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded cursor-pointer transition-colors"
                              title={language === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {returnToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                    {language === 'bn' ? 'ক্রয় রিটার্ন ডিলিট নিশ্চিত করুন' : 'Confirm Delete Purchase Return'}
                  </h4>
                  <p className="text-xs text-zinc-500 font-mono">
                    {returnToDelete.returnNumber} (#{returnToDelete.originalBillNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnToDelete(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {language === 'bn'
                ? 'এই রিটার্নটি ডিলিট করলে পণ্যের স্টক, মূল বিলের এমাউন্ট, সাপ্লায়ারের দেনা (Total Payable) এবং ক্যাশ ব্যালেন্স আগের অবস্থায় ফিরে যাবে।'
                : 'Deleting this return will automatically revert product stock, original bill amounts, supplier Total Payable, and wallet balance.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnToDelete(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                {language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePurchaseReturn(returnToDelete.id || returnToDelete.returnNumber);
                  setReturnToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {language === 'bn' ? 'ডিলিট ও রিস্টোর করুন' : 'Delete & Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
