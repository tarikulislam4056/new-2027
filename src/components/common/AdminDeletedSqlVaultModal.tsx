import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Clock,
  Database,
  Download,
  Eye,
  FileCode,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminDeletedRecord, parseAdminDeletedSqlDump } from '../../utils/sqlExporter';

export type VaultCategoryFilter = 'ALL' | 'SALE' | 'PURCHASE' | 'PRODUCT' | 'PARTY' | 'OTHER';

interface AdminDeletedSqlVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: VaultCategoryFilter;
}

const getEntityGroup = (entityType: string): VaultCategoryFilter => {
  const t = String(entityType || '').toUpperCase();
  if (t.includes('SALE_INVOICE') || t === 'SALE_RETURN') return 'SALE';
  if (t.includes('PURCHASE_INVOICE') || t === 'PURCHASE_RETURN') return 'PURCHASE';
  if (t === 'PRODUCT' || t === 'PRODUCT_BATCH' || t === 'CATEGORY') return 'PRODUCT';
  if (t === 'CUSTOMER' || t === 'SUPPLIER') return 'PARTY';
  return 'OTHER';
};

const getEntityLabel = (entityType: string, language: 'bn' | 'en'): string => {
  const t = String(entityType || '').toUpperCase();
  switch (t) {
    case 'ARCHIVED_SALE_INVOICE':
    case 'SALE_INVOICE':
      return language === 'bn' ? 'বিক্রয় চালান' : 'Sale Invoice';
    case 'ARCHIVED_PURCHASE_INVOICE':
    case 'PURCHASE_INVOICE':
      return language === 'bn' ? 'ক্রয় চালান' : 'Purchase Bill';
    case 'SALE_RETURN':
      return language === 'bn' ? 'বিক্রয় ফেরত' : 'Sale Return';
    case 'PURCHASE_RETURN':
      return language === 'bn' ? 'ক্রয় ফেরত' : 'Purchase Return';
    case 'PRODUCT':
      return language === 'bn' ? 'পণ্য' : 'Product';
    case 'PRODUCT_BATCH':
      return language === 'bn' ? 'পণ্য ব্যাচ' : 'Product Batch';
    case 'CATEGORY':
      return language === 'bn' ? 'ক্যাটাগরি' : 'Category';
    case 'CUSTOMER':
      return language === 'bn' ? 'কাস্টমার' : 'Customer';
    case 'SUPPLIER':
      return language === 'bn' ? 'সাপ্লায়ার' : 'Supplier';
    case 'EXPENSE_VOUCHER':
      return language === 'bn' ? 'খরচের ভাউচার' : 'Expense';
    case 'INSTALLMENT_SCHEME':
      return language === 'bn' ? 'কিস্তি স্কিম' : 'EMI Scheme';
    case 'CASH_ADJUSTMENT':
      return language === 'bn' ? 'ক্যাশ অ্যাডজাস্টমেন্ট' : 'Cash Adjust';
    default:
      return entityType || 'RECORD';
  }
};

export const AdminDeletedSqlVaultModal: React.FC<AdminDeletedSqlVaultModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'ALL',
}) => {
  const {
    language,
    currentUser,
    formatCurrency,
    fetchAdminDeletedArchive,
    downloadAdminDeletedSqlFile,
    restoreFromAdminDeletedArchive,
    restoreMultipleFromAdminDeletedArchive,
    showToast,
  } = useApp();

  const [records, setRecords] = useState<AdminDeletedRecord[]>([]);
  const [serverIds, setServerIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<VaultCategoryFilter>(initialFilter);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAdminDeletedArchive();
      setRecords(list);
      setServerIds(new Set(list.map(r => r.archiveId)));
      setUploadedFileName(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCategoryFilter(initialFilter);
      setSearchQuery('');
      setPreviewRecordId(null);
      loadRecords();
    }
  }, [isOpen, initialFilter]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter(rec => {
      if (categoryFilter !== 'ALL' && getEntityGroup(rec.entityType) !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(rec.title || '').toLowerCase().includes(q) ||
        String(rec.referenceNo || '').toLowerCase().includes(q) ||
        String(rec.deletionReason || '').toLowerCase().includes(q) ||
        String(rec.deletedByName || '').toLowerCase().includes(q) ||
        String(rec.entityType || '').toLowerCase().includes(q)
      );
    });
  }, [records, categoryFilter, searchQuery]);

  if (!isOpen || currentUser?.role !== 'ADMIN') return null;

  const handleUploadSqlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = parseAdminDeletedSqlDump(content);
      if (parsed.length === 0) {
        showToast(
          language === 'bn'
            ? 'নির্বাচিত .sql ফাইলে কোনো অ্যাডমিন ডিলিট রেকর্ড পাওয়া যায়নি!'
            : 'No valid admin_deleted_records found in the selected .sql file!',
          'warning'
        );
        return;
      }

      setRecords(prev => {
        const byId = new Map<string, AdminDeletedRecord>();
        prev.forEach(r => byId.set(r.archiveId, r));
        parsed.forEach(r => byId.set(r.archiveId, r));
        return Array.from(byId.values()).sort((a, b) =>
          String(b.deletedAtIso || '').localeCompare(String(a.deletedAtIso || ''))
        );
      });
      setUploadedFileName(file.name);

      showToast(
        language === 'bn'
          ? `${file.name} থেকে ${parsed.length}টি রেকর্ড লোড করা হয়েছে। এখন প্রয়োজনমতো ব্যাক আনুন!`
          : `Loaded ${parsed.length} record(s) from ${file.name}. Click Restore to bring them back!`,
        'success'
      );
    } catch {
      showToast(
        language === 'bn' ? '.sql ফাইল পড়া যায়নি!' : 'Failed to read .sql file!',
        'error'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestoreSingle = async (rec: AdminDeletedRecord) => {
    setRestoringId(rec.archiveId);
    try {
      const isFromServer = serverIds.has(rec.archiveId);
      const ok = await restoreFromAdminDeletedArchive(rec, { removeFromArchive: isFromServer });
      if (ok) {
        setRecords(prev => prev.filter(r => r.archiveId !== rec.archiveId));
      }
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreAllFiltered = async () => {
    if (filteredRecords.length === 0) return;
    setIsBulkRestoring(true);
    try {
      const serverMatches = filteredRecords.filter(r => serverIds.has(r.archiveId));
      const uploadedMatches = filteredRecords.filter(r => !serverIds.has(r.archiveId));

      let totalRestored = 0;
      if (serverMatches.length > 0) {
        totalRestored += await restoreMultipleFromAdminDeletedArchive(serverMatches, {
          removeFromArchive: true,
        });
      }
      if (uploadedMatches.length > 0) {
        totalRestored += await restoreMultipleFromAdminDeletedArchive(uploadedMatches, {
          removeFromArchive: false,
        });
      }

      if (totalRestored > 0) {
        const restoredSet = new Set(filteredRecords.map(r => r.archiveId));
        setRecords(prev => prev.filter(r => !restoredSet.has(r.archiveId)));
      }
    } finally {
      setIsBulkRestoring(false);
    }
  };

  const extractPreviewSummary = (rec: AdminDeletedRecord): Array<{ label: string; value: string }> => {
    const snap = rec.recordSnapshot || {};
    const inv = snap.invoiceSnapshot || snap;
    const rows: Array<{ label: string; value: string }> = [];
    if (inv.date) rows.push({ label: language === 'bn' ? 'মূল তারিখ' : 'Orig. Date', value: String(inv.date) });
    if (inv.customerName) rows.push({ label: language === 'bn' ? 'কাস্টমার' : 'Customer', value: String(inv.customerName) });
    if (inv.supplierName) rows.push({ label: language === 'bn' ? 'সাপ্লায়ার' : 'Supplier', value: String(inv.supplierName) });
    if (Array.isArray(inv.items)) {
      rows.push({
        label: language === 'bn' ? 'আইটেম সংখ্যা' : 'Items',
        value: `${inv.items.length} (${inv.items.map((i: any) => `${i.name || i.productName} x${i.quantity}`).slice(0, 3).join(', ')}${inv.items.length > 3 ? '...' : ''})`,
      });
    }
    if (typeof inv.paidAmount === 'number') {
      rows.push({ label: language === 'bn' ? 'পরিশোধিত' : 'Paid', value: formatCurrency(inv.paidAmount) });
    }
    if (typeof inv.dueAmount === 'number' && inv.dueAmount > 0) {
      rows.push({ label: language === 'bn' ? 'বকেয়া' : 'Due', value: formatCurrency(inv.dueAmount) });
    }
    if (snap.sku || snap.barcode) {
      rows.push({ label: 'SKU/Barcode', value: String(snap.sku || snap.barcode) });
    }
    if (typeof snap.stock === 'number') {
      rows.push({ label: language === 'bn' ? 'স্টক' : 'Stock', value: `${snap.stock} ${snap.unit || 'Pcs'}` });
    }
    return rows;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-rose-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold">
                  {language === 'bn'
                    ? 'আলাদা SQL ডিলিট আর্কাইভ ও ব্যাকআপ রিস্টোর (admin_deleted_records.sql)'
                    : 'Separate Admin SQL Archive & Restore Vault'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 border border-rose-400/40 text-rose-200 font-mono">
                  {records.length} {language === 'bn' ? 'টি রেকর্ড' : 'records'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {language === 'bn'
                  ? 'ডিলিট লিস্ট থেকে মুছে ফেলা রেকর্ডগুলো এখানে আলাদা SQL ফাইলে জমা আছে। প্রয়োজনে যেকোনো সময় সরাসরি বা .sql ফাইল আপলোড করে ব্যাক আনুন।'
                  : 'Records removed from the Delete List are preserved in this separate SQL file and can be restored anytime directly or by importing a .sql file.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', bn: 'সব রেকর্ড', en: 'All' },
                  { id: 'SALE', bn: 'বিক্রয় চালান', en: 'Sales' },
                  { id: 'PURCHASE', bn: 'ক্রয় চালান', en: 'Purchases' },
                  { id: 'PRODUCT', bn: 'পণ্য ও ব্যাচ', en: 'Products' },
                  { id: 'PARTY', bn: 'কাস্টমার/সাপ্লায়ার', en: 'Parties' },
                  { id: 'OTHER', bn: 'অন্যান্য', en: 'Others' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {language === 'bn' ? tab.bn : tab.en}
                </button>
              ))}
            </div>

            {/* File Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                onChange={handleUploadSqlFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? '.sql ফাইল আপলোড' : 'Import .sql File'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadAdminDeletedSqlFile()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'SQL ডাউনলোড' : 'Download SQL'}</span>
              </button>

              <button
                type="button"
                onClick={loadRecords}
                disabled={isLoading}
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                title={language === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & Bulk Restore */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'ইনভয়েস নম্বর, শিরোনাম, কারণ বা ডিলিটকারী খুঁজুন...'
                    : 'Search reference #, title, reason, deleted by...'
                }
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreAllFiltered}
                disabled={isBulkRestoring}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                <span>
                  {isBulkRestoring
                    ? language === 'bn'
                      ? 'ব্যাক আনা হচ্ছে...'
                      : 'Restoring...'
                    : language === 'bn'
                      ? `সব ব্যাক আনুন (${filteredRecords.length})`
                      : `Restore All (${filteredRecords.length})`}
                </span>
              </button>
            )}
          </div>

          {uploadedFileName && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  {language === 'bn'
                    ? `আপলোড করা ফাইল: "${uploadedFileName}" থেকে রেকর্ড যুক্ত করা হয়েছে।`
                    : `Showing imported records merged from "${uploadedFileName}".`}
                </span>
              </div>
              <button
                type="button"
                onClick={loadRecords}
                className="text-xs font-bold underline cursor-pointer"
              >
                {language === 'bn' ? 'সার্ভারের তালিকা দেখুন' : 'Reset to Server List'}
              </button>
            </div>
          )}
        </div>

        {/* Body List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-500" />
              <span className="text-xs font-semibold">
                {language === 'bn' ? 'আলাদা SQL ফাইল লোড হচ্ছে...' : 'Loading separate SQL archive...'}
              </span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
              <Shield className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {language === 'bn'
                  ? 'SQL আর্কাইভে কোনো রেকর্ড পাওয়া যায়নি'
                  : 'No archived records found in admin_deleted_records.sql'}
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                {language === 'bn'
                  ? 'ডিলিট লিস্ট থেকে কোনো রেকর্ড স্থায়ীভাবে ডিলিট করলে তা এই আলাদা SQL ফাইলে জমা হবে। চাইলে আপনার কম্পিউটারে থাকা আগের .sql ফাইলও উপরে "Import .sql File" দিয়ে আপলোড করে ব্যাক আনতে পারবেন।'
                  : 'Records permanently deleted from the Delete List are saved to this SQL file. You can also import a previously downloaded admin_deleted_records.sql file above.'}
              </p>
            </div>
          ) : (
            filteredRecords.map(rec => {
              const previewRows = extractPreviewSummary(rec);
              const isExpanded = previewRecordId === rec.archiveId;
              return (
                <div
                  key={rec.archiveId}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {getEntityLabel(rec.entityType, language)}
                        </span>
                        {rec.referenceNo && (
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            #{rec.referenceNo}
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {rec.title}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-rose-500" />
                          {rec.deletedAt || rec.deletedAtIso}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-indigo-500" />
                          {rec.deletedByName || rec.deletedByUsername || 'Admin'}
                        </span>
                        {rec.deletionReason && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            "{rec.deletionReason}"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {Number(rec.amount || 0) > 0 && (
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white mr-1">
                          {formatCurrency(Number(rec.amount || 0))}
                        </span>
                      )}

                      {previewRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewRecordId(isExpanded ? null : rec.archiveId)}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                          title={language === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRestoreSingle(rec)}
                        disabled={restoringId === rec.archiveId}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringId === rec.archiveId ? 'animate-spin' : ''}`} />
                        <span>
                          {restoringId === rec.archiveId
                            ? language === 'bn'
                              ? 'ফিরছে...'
                              : 'Restoring...'
                            : language === 'bn'
                              ? 'ব্যাক আনুন'
                              : 'Restore'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && previewRows.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {previewRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60"
                        >
                          <span className="text-[10px] font-semibold text-slate-400 block">{row.label}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
