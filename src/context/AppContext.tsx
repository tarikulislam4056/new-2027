import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getCustomerTotalDue, checkCustomerCreditLimit } from '../utils/dueHelpers';
import {
  Language,
  Theme,
  Product,
  ProductBatch,
  Category,
  Party,
  SaleInvoice,
  InvoiceStatus,
  DeletedSaleInvoice,
  SaleReturn,
  PurchaseInvoice,
  DeletedPurchaseInvoice,
  PurchaseReturn,
  PurchaseOrder,
  PurchaseItem,
  POStatus,
  Quotation,
  QuotationStatus,
  QuotationItem,
  SalesOrder,
  SalesOrderStatus,
  SalesOrderItem,
  InstallmentScheme,
  Wallet,
  ExpenseCategory,
  ExpenseVoucher,
  Employee,
  AdvanceSalary,
  PayrollEntry,
  UserAccount,
  CompanySettings,
  DayBookEntry,
  CashAdjustment,
  ViewTab,
  HrSubTab,
  InstallmentSubTab,
  CartItem,
  PaymentMethod,
  ExpiredReturnLog,
  ActivityLog,
  SmsConfig,
  SmsLog,
  WarrantyPolicy,
  WarrantyRecord,
  WarrantyClaim,
  WarrantyClaimStatus,
  WarrantyPeriodType,
  WarrantyType,
  PartyType,
  DiseaseMasterEntry,
  DiseaseCategoryItem,
} from '../types';
import { INITIAL_DISEASE_MASTER } from '../data/diseaseMasterData';
import { generatePartySerialNumber, findDuplicatePartySerial } from '../utils/partyHelpers';
import {
  generateSaleInvoiceNumber,
  generatePurchaseBillNumber,
  checkDuplicateSaleInvoice,
  checkDuplicatePurchaseInvoice,
} from '../utils/invoiceHelpers';
import {
  DEFAULT_SMS_CONFIG,
  sendSmsViaGateway,
  formatSmsTemplate,
} from '../utils/smsService';
import {
  initialCompanySettings,
  initialCategories,
  initialWallets,
  initialProducts,
  initialParties,
  initialSaleInvoices,
  initialDeletedSaleInvoices,
  initialPurchaseInvoices,
  initialDeletedPurchaseInvoices,
  initialPurchaseOrders,
  initialInstallmentSchemes,
  initialEmployees,
  initialAdvanceSalaries,
  initialPayrollHistory,
  initialExpenseCategories,
  initialExpenseVouchers,
  initialDayBookEntries,
  initialCashAdjustments,
  initialUsers,
  initialActivityLogs,
  initialWarrantyPolicies,
  initialWarrantyRecords,
  initialWarrantyClaims,
} from '../data/mockInitialData';
import { getFirstAllowedTab, isTabAllowed } from '../utils/permissions';
import { isExpiredDate, normalizeDateToISO } from '../utils/dateUtils';
import { getCachedClientDeviceInfo, fetchClientDeviceInfo, ClientDeviceInfo } from '../utils/clientDevice';
import {
  getBaseQuantity,
  getEffectiveConversionFactor,
  computeNormalizedItemCost,
  formatCleanNumber,
} from '../utils/unitConversion';
import {
  AdminDeletedRecord,
  generateAdminDeletedSqlDump,
  downloadSqlFile,
} from '../utils/sqlExporter';

export type PrintableDocumentType =
  | 'INVOICE_A4'
  | 'POS_80MM'
  | 'MONEY_RECEIPT'
  | 'PAYMENT_OUT_VOUCHER'
  | 'PURCHASE_VOUCHER'
  | 'PAYSLIP'
  | 'EMI_RECEIPT'
  | 'EXPENSE_VOUCHER'
  | 'CASH_ADJUSTMENT_VOUCHER'
  | 'WALLET_TRANSFER_VOUCHER'
  | 'REPORT'
  | 'LEDGER_STATEMENT'
  | 'CUSTOMER_STATEMENT'
  | 'SUPPLIER_STATEMENT'
  | 'BATCH_STATEMENT'
  | 'BATCH_EXPIRY_REPORT'
  | 'BATCH_DETAILED_LEDGER'
  | 'EMI_AMORTIZATION_SCHEDULE'
  | 'DAY_BOOK'
  | 'STATEMENT'
  | 'BARCODE_SHEET'
  | 'PRODUCT_LIST'
  | 'BATCH_TRACEABILITY_SLIP'
  | 'WARRANTY_CARD'
  | 'SALES_ORDER';

export interface PrintableDocumentData {
  type: PrintableDocumentType;
  title: string;
  data: any;
  autoDownloadPdf?: boolean;
}

// Multi-device smart union merge by item ID: guarantees zero data loss across devices
export const mergeEntitiesById = <T extends { id?: string | number }>(localArr: T[], serverArr?: T[]): T[] => {
  if (!Array.isArray(serverArr) || serverArr.length === 0) return Array.isArray(localArr) ? localArr : [];
  if (!Array.isArray(localArr) || localArr.length === 0) return serverArr;

  const map = new Map<string, T>();
  // 1. Insert server records
  for (const item of serverArr) {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(String(item.id), item);
    }
  }
  // 2. Keep local records that are not yet on server, or merge newer fields
  for (const item of localArr) {
    if (item && item.id !== undefined && item.id !== null) {
      const existing = map.get(String(item.id));
      if (existing) {
        map.set(String(item.id), { ...existing, ...item });
      } else {
        map.set(String(item.id), item);
      }
    }
  }
  return Array.from(map.values());
};

export const dedupeById = <T extends { id?: string | number }>(arr: T[]): T[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    if (!item || item.id === undefined || item.id === null) continue;
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

export const dedupeTransactionDayBookEntries = (
  entries: DayBookEntry[],
  sales: SaleInvoice[],
  purchases: PurchaseInvoice[]
): { cleaned: DayBookEntry[]; removedIds: string[] } => {
  const uniqueEntries = dedupeById(entries);
  const removedIds: string[] = [];

  const saleById = new Map<string, SaleInvoice>();
  const saleByNo = new Map<string, SaleInvoice>();
  for (const s of sales) {
    saleById.set(s.id, s);
    if (s.invoiceNumber) saleByNo.set(s.invoiceNumber.trim().toLowerCase(), s);
  }

  const purchaseById = new Map<string, PurchaseInvoice>();
  const purchaseByNo = new Map<string, PurchaseInvoice>();
  for (const p of purchases) {
    purchaseById.set(p.id, p);
    if (p.billNumber) purchaseByNo.set(p.billNumber.trim().toLowerCase(), p);
    if (p.supplierInvoiceNo) purchaseByNo.set(p.supplierInvoiceNo.trim().toLowerCase(), p);
  }

  const seenSaleRef = new Set<string>();
  const seenPurchaseRef = new Set<string>();
  const cleaned: DayBookEntry[] = [];

  for (const entry of uniqueEntries) {
    if (entry.type === 'SALE') {
      const vNo = (entry.voucherNo || '').trim().toLowerCase();
      const rNo = (entry.referenceNo || '').trim().toLowerCase();
      const idFromSynth = entry.id.startsWith('db-sale-') ? entry.id.slice('db-sale-'.length) : undefined;
      const matchedSale =
        (entry.referenceId ? saleById.get(entry.referenceId) : undefined) ||
        (idFromSynth ? saleById.get(idFromSynth) : undefined) ||
        (vNo ? saleByNo.get(vNo) : undefined) ||
        (rNo ? saleByNo.get(rNo) : undefined);

      if (matchedSale) {
        if (seenSaleRef.has(matchedSale.id)) {
          removedIds.push(entry.id);
          continue;
        }
        seenSaleRef.add(matchedSale.id);
        const netSalePaid = Math.max(0, Number(matchedSale.paidAmount || 0));
        const resolvedWalletId =
          netSalePaid > 0
            ? matchedSale.walletId && matchedSale.walletId !== 'due' && matchedSale.walletId !== 'credit'
              ? matchedSale.walletId
              : entry.walletId && entry.walletId !== 'due' && entry.walletId !== 'credit'
                ? entry.walletId
                : 'w-cash'
            : 'due';
        const resolvedWalletName =
          netSalePaid > 0
            ? (matchedSale.walletName && matchedSale.walletName !== 'Credit / বাকি'
                ? matchedSale.walletName
                : entry.walletName && entry.walletName !== 'Credit / বাকি'
                  ? entry.walletName
                  : 'Cash')
            : 'Credit / বাকি';
        cleaned.push({
          ...entry,
          referenceId: matchedSale.id,
          voucherNo: matchedSale.invoiceNumber,
          referenceNo: matchedSale.invoiceNumber,
          amount: netSalePaid,
          walletId: resolvedWalletId,
          walletName: resolvedWalletName,
        });
        continue;
      }
    } else if (entry.type === 'SALE_RETURN') {
      const refInvNo = entry.referenceNo || '';
      cleaned.push({
        ...entry,
        amount: 0,
        walletId: 'adjusted',
        walletName: refInvNo ? `Adjusted in #${refInvNo}` : 'Adjusted in Invoice',
      });
      continue;
    } else if (entry.type === 'PURCHASE') {
      const vNo = (entry.voucherNo || '').trim().toLowerCase();
      const rNo = (entry.referenceNo || '').trim().toLowerCase();
      const idFromSynth = entry.id.startsWith('db-pur-') ? entry.id.slice('db-pur-'.length) : undefined;
      const matchedPurchase =
        (entry.referenceId ? purchaseById.get(entry.referenceId) : undefined) ||
        (idFromSynth ? purchaseById.get(idFromSynth) : undefined) ||
        (vNo ? purchaseByNo.get(vNo) : undefined) ||
        (rNo ? purchaseByNo.get(rNo) : undefined);

      if (matchedPurchase) {
        if (seenPurchaseRef.has(matchedPurchase.id)) {
          removedIds.push(entry.id);
          continue;
        }
        seenPurchaseRef.add(matchedPurchase.id);
        cleaned.push({
          ...entry,
          referenceId: matchedPurchase.id,
          voucherNo: matchedPurchase.billNumber,
          referenceNo: matchedPurchase.billNumber,
        });
        continue;
      }
    }

    cleaned.push(entry);
  }

  return { cleaned, removedIds };
};

interface AppContextType {
  // Localization & Theme
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  activeHrSubTab: HrSubTab;
  setActiveHrSubTab: (subTab: HrSubTab) => void;
  activeInstallmentSubTab: InstallmentSubTab;
  setActiveInstallmentSubTab: (subTab: InstallmentSubTab) => void;
  
  // Master Entities
  companySettings: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  
  products: Product[];
  categories: Category[];
  parties: Party[];
  wallets: Wallet[];
  saleInvoices: SaleInvoice[];
  deletedSaleInvoices: DeletedSaleInvoice[];
  saleReturns: SaleReturn[];
  purchaseInvoices: PurchaseInvoice[];
  purchaseReturns: PurchaseReturn[];
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt'>) => PurchaseOrder;
  updatePurchaseOrderStatus: (id: string, status: POStatus) => void;
  convertPOToPurchaseBill: (poId: string, finalItems: PurchaseItem[], finalDiscount?: number, paidAmount?: number, walletId?: string, customBillNumber?: string) => PurchaseInvoice | null;
  deletePurchaseOrder: (id: string) => void;
  
  quotations: Quotation[];
  addQuotation: (qData: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => Quotation;
  updateQuotationStatus: (id: string, status: QuotationStatus) => void;
  convertQuotationToSale: (qId: string, paidAmount: number, walletId: string, paymentMethod: PaymentMethod, customInvoiceNumber?: string) => SaleInvoice | null;
  deleteQuotation: (id: string) => void;

  salesOrders: SalesOrder[];
  addSalesOrder: (oData: Omit<SalesOrder, 'id' | 'orderNumber' | 'createdAt'>) => SalesOrder;
  updateSalesOrder: (id: string, oData: Partial<SalesOrder>) => void;
  updateSalesOrderStatus: (id: string, status: SalesOrderStatus) => void;
  convertSalesOrderToSale: (orderId: string, paidAmount: number, walletId: string, paymentMethod: PaymentMethod, customInvoiceNumber?: string) => SaleInvoice | null;
  deleteSalesOrder: (id: string) => void;
  
  expiredReturnLogs: ExpiredReturnLog[];
  installmentSchemes: InstallmentScheme[];
  employees: Employee[];
  advanceSalaries: AdvanceSalary[];
  payrollHistory: PayrollEntry[];
  expenseCategories: ExpenseCategory[];
  expenseVouchers: ExpenseVoucher[];
  dayBookEntries: DayBookEntry[];
  cashAdjustments: CashAdjustment[];
  activityLogs: ActivityLog[];
  logActivity: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'userId' | 'userName' | 'role'>) => void;
  clientDeviceInfo: ClientDeviceInfo;
  refreshDeviceLocation: () => Promise<ClientDeviceInfo>;
  users: UserAccount[];
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;

  // Print Modal State
  printableDoc: PrintableDocumentData | null;
  openPrintModal: (doc: PrintableDocumentData) => void;
  closePrintModal: () => void;

  // Toast / Notification
  toastMessage: { text: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

  // Actions - Products & Categories
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string, force?: boolean) => void;
  deleteAllProducts: () => void;
  deletedProductIds: string[];
  updateProductBatches: (productId: string, batches: ProductBatch[]) => void;
  addProductBatch: (productId: string, batch: Omit<ProductBatch, 'id'>) => void;
  deleteProductBatch: (productId: string, batchId: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  bulkImportProducts: (newProducts: Omit<Product, 'id' | 'createdAt'>[]) => number;

  // Actions - Parties (Customers & Suppliers)
  getNextPartySerialNumber: (type: PartyType) => string;
  addParty: (party: Omit<Party, 'id' | 'currentBalance' | 'createdAt'>) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  deleteParty: (id: string) => void;

  // Actions - Sales & POS
  getNextSaleInvoiceNumber: () => string;
  createSaleInvoice: (invoiceData: {
    invoiceNumber?: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'flat';
    vatAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    isInstallmentSale?: boolean;
    installmentPlanId?: string;
    date?: string;
  }) => SaleInvoice | null;
  updateSaleInvoice: (invoiceId: string, invoiceData: {
    invoiceNumber?: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'flat';
    vatAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    isInstallmentSale?: boolean;
    installmentPlanId?: string;
    date?: string;
  }) => SaleInvoice | null;
  deleteSaleInvoice: (invoiceId: string, reason?: string) => boolean;
  restoreDeletedSaleInvoice: (deletedInvoiceId: string) => boolean;
  permanentlyDeleteArchivedInvoice: (deletedInvoiceId: string) => boolean;
  clearAllDeletedInvoices: () => void;
  exportDeletedInvoicesToFile: () => void;
  exportSingleDeletedInvoiceToFile: (invoice: DeletedSaleInvoice) => void;
  createSaleReturn: (returnData: {
    invoiceId: string;
    originalInvoiceNumber: string;
    customerId: string;
    customerName: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      unitPrice: number;
      returnQuantity: number;
      totalRefund: number;
      batchNumber?: string;
      expDate?: string;
    }[];
    totalRefund: number;
    refundWalletId: string;
    reason: string;
    settlementMode?: 'AUTO' | 'CASH_REFUND';
  }) => boolean;
  deleteSaleReturn: (returnId: string) => void;
  recordPaymentIn: (data: {
    partyId: string;
    amount: number;
    walletId: string;
    date: string;
    remarks: string;
  }) => boolean;

  // Actions - Purchases
  deletedPurchaseInvoices: DeletedPurchaseInvoice[];
  getNextPurchaseBillNumber: () => string;
  createPurchaseInvoice: (purchaseData: {
    billNumber?: string;
    supplierId: string;
    supplierName: string;
    supplierPhone: string;
    supplierInvoiceNo?: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      quantity: number;
      purchasePrice: number;
      total: number;
      batchNumber?: string;
      expDate?: string;
      mfgDate?: string;
      salesPrice?: number;
    }[];
    subtotal: number;
    discount: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    date?: string;
  }) => PurchaseInvoice | null;
  updatePurchaseInvoice: (invoiceId: string, purchaseData: {
    billNumber?: string;
    supplierId: string;
    supplierName: string;
    supplierPhone: string;
    supplierInvoiceNo?: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      quantity: number;
      purchasePrice: number;
      total: number;
      batchNumber?: string;
      expDate?: string;
      mfgDate?: string;
      salesPrice?: number;
    }[];
    subtotal: number;
    discount: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    date?: string;
  }) => PurchaseInvoice | null;
  deletePurchaseInvoice: (invoiceId: string, reason?: string) => boolean;
  restoreDeletedPurchaseInvoice: (deletedPurchaseId: string) => boolean;
  permanentlyDeleteArchivedPurchase: (deletedPurchaseId: string) => boolean;
  clearAllDeletedPurchases: () => void;
  exportDeletedPurchasesToFile: () => void;
  exportSingleDeletedPurchaseToFile: (purchase: DeletedPurchaseInvoice) => void;
  createPurchaseReturn: (returnData: {
    purchaseId: string;
    originalBillNumber: string;
    supplierId: string;
    supplierName: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      purchasePrice: number;
      returnQuantity: number;
      totalAmount: number;
      batchNumber?: string;
      expDate?: string;
    }[];
    totalAmount: number;
    refundWalletId: string;
    reason: string;
    settlementMode?: 'AUTO' | 'CASH_REFUND';
  }) => boolean;
  deletePurchaseReturn: (returnId: string) => void;
  addExpiredReturnLog: (logData: Omit<ExpiredReturnLog, 'id' | 'date'> & { date?: string }) => void;
  deleteExpiredReturnLog: (id: string) => void;
  recordPaymentOut: (data: {
    partyId: string;
    amount: number;
    walletId: string;
    date: string;
    remarks: string;
  }) => boolean;

  // Actions - Installment & EMI
  createInstallmentScheme: (
    scheme: Omit<InstallmentScheme, 'id' | 'schemeNumber' | 'createdAt'>,
    options?: { skipDayBookAndWallet?: boolean }
  ) => InstallmentScheme;
  collectInstallment: (schemeId: string, installmentNo: number, amount: number, penalty: number, walletId: string, paymentMethod: string) => void;
  deleteInstallmentScheme: (id: string) => void;

  // Actions - Cash & Wallets
  addCashAdjustment: (adj: Omit<CashAdjustment, 'id' | 'voucherNo' | 'createdAt'>) => void;
  adjustCash: (data: { walletId: string; type: 'ADD' | 'WITHDRAW'; amount: number; reason: string }) => void;
  deleteCashAdjustment: (id: string) => void;
  addWallet: (wallet: Omit<Wallet, 'id'>) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;
  transferWalletFunds: (fromWalletId: string, toWalletId: string, amount: number, notes?: string) => void;
  transferBetweenWallets: (fromWalletId: string, toWalletId: string, amount: number, notes?: string) => void;

  // Actions - Expenses
  addExpenseCategory: (cat: Omit<ExpenseCategory, 'id'>) => void;
  updateExpenseCategory: (id: string, updates: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (id: string) => void;
  addExpenseVoucher: (voucher: Omit<ExpenseVoucher, 'id' | 'voucherNo' | 'createdAt'>) => ExpenseVoucher;
  deleteExpenseVoucher: (id: string) => void;

  // Actions - HR & Payroll
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  resignEmployee: (
    id: string,
    data: {
      resignedDate: string;
      resignationReason: string;
      settlementNotes?: string;
      finalSettlementAmount?: number;
      finalSettlementPaid?: boolean;
      refundWalletId?: string;
    }
  ) => void;
  rejoinEmployee: (id: string) => void;
  addAdvanceSalary: (adv: Omit<AdvanceSalary, 'id' | 'voucherNo' | 'createdAt' | 'isDeducted'>) => void;
  giveAdvanceSalary: (adv: { employeeId: string; amount: number; walletId: string; reason: string; date: string }) => void;
  payEmployeeSalary: (payment: {
    employeeId: string;
    payrollMonth: string;
    amount: number;
    walletId: string;
    bonus?: number;
    fineDeduction?: number;
    notes?: string;
    paymentDate?: string;
  }) => boolean;
  processMonthlyPayroll: (monthStr: string, walletId: string) => void;

  // Actions - Users & Roles
  addUser: (user: Omit<UserAccount, 'id'>) => void;
  updateUser: (id: string, updates: Partial<UserAccount>) => void;
  deleteUser: (id: string) => void;
  isLoggedIn: boolean;
  logout: () => void;
  login: (username: string, password?: string) => boolean;
  switchUser: (targetUserId: string, password?: string) => boolean;

  // SMS Gateway & Notifications
  smsConfig: SmsConfig;
  setSmsConfig: React.Dispatch<React.SetStateAction<SmsConfig>>;
  updateSmsConfig: (updates: Partial<SmsConfig>) => void;
  smsLogs: SmsLog[];
  sendManualSms: (recipientPhone: string, recipientName: string, message: string, type?: SmsLog['type']) => Promise<boolean>;
  sendSaleSms: (invoice: SaleInvoice) => Promise<boolean>;
  sendPaymentInSms: (party: Party, amount: number, remainingDue: number, voucherNo: string) => Promise<boolean>;

  // Warranty Management
  warrantyPolicies: WarrantyPolicy[];
  warrantyRecords: WarrantyRecord[];
  warrantyClaims: WarrantyClaim[];
  addWarrantyPolicy: (policy: Omit<WarrantyPolicy, 'id'>) => WarrantyPolicy;
  updateWarrantyPolicy: (id: string, updates: Partial<WarrantyPolicy>) => void;
  deleteWarrantyPolicy: (id: string) => void;
  addWarrantyRecord: (record: Omit<WarrantyRecord, 'id' | 'createdAt'>) => WarrantyRecord;
  updateWarrantyRecord: (id: string, updates: Partial<WarrantyRecord>) => void;
  deleteWarrantyRecord: (id: string) => void;
  addWarrantyClaim: (claim: Omit<WarrantyClaim, 'id' | 'createdAt' | 'actionsHistory'>) => WarrantyClaim;
  updateWarrantyClaimStatus: (id: string, status: WarrantyClaimStatus, note?: string, updates?: Partial<WarrantyClaim>) => void;
  deleteWarrantyClaim: (id: string) => void;
  sendDueReminderSms: (party: Party, customDueAmount?: number) => Promise<boolean>;
  sendWarrantyClaimSms: (claim: WarrantyClaim, customNote?: string) => Promise<boolean>;
  deleteSmsLog: (id: string) => void;
  clearSmsLogs: () => void;

  // Medicine Diseases Template
  diseaseMaster: DiseaseMasterEntry[];
  setDiseaseMaster: React.Dispatch<React.SetStateAction<DiseaseMasterEntry[]>>;
  diseaseCategories: DiseaseCategoryItem[];
  setDiseaseCategories: React.Dispatch<React.SetStateAction<DiseaseCategoryItem[]>>;

  // Global Helpers
  resetToDemoData: () => void;
  formatCurrency: (amount: number) => string;

  // Cloud & Multi-Device Auto-Sync
  isSyncingWithServer: boolean;
  lastServerSyncTime: string | null;
  serverSyncStatus: { success: boolean; message: string; timestamp?: string } | null;
  syncCountdown: number;
  autoSyncIntervalSeconds: number;
  setAutoSyncIntervalSeconds: (seconds: number) => void;
  isAutoSyncEnabled: boolean;
  setIsAutoSyncEnabled: (enabled: boolean) => void;
  triggerServerPush: (customUrl?: string, silent?: boolean) => Promise<boolean>;
  triggerServerPull: (customUrl?: string, quiet?: boolean) => Promise<boolean>;
  triggerSyncNow: () => Promise<boolean>;
  saveApiEndpoint: (url: string, autoSync?: boolean, intervalSeconds?: number) => Promise<boolean>;
  downloadAdminDeletedSqlFile: () => Promise<void>;
  fetchAdminDeletedArchive: () => Promise<AdminDeletedRecord[]>;
  restoreFromAdminDeletedArchive: (
    record: AdminDeletedRecord,
    options?: { removeFromArchive?: boolean; silent?: boolean }
  ) => Promise<boolean>;
  restoreMultipleFromAdminDeletedArchive: (
    records: AdminDeletedRecord[],
    options?: { removeFromArchive?: boolean }
  ) => Promise<number>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'DOKANPRO_ERP_DATA_V1';

// Helper to safely load persisted data from localStorage synchronously on initial state evaluation
function getPersistedData<T>(fieldKey: string, fallback: T): T {
  try {
    if (fieldKey === 'products') {
      try {
        const prodBackup = localStorage.getItem('DOKANPRO_PRODUCTS_BACKUP');
        if (prodBackup) {
          const parsedBackup = JSON.parse(prodBackup);
          if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            return parsedBackup as unknown as T;
          }
        }
      } catch {}
    }

    // 1. Check dedicated standalone key first (e.g. 'companySettings')
    const standalone = localStorage.getItem(fieldKey);
    if (standalone) {
      try {
        const parsedStandalone = JSON.parse(standalone);
        if (parsedStandalone !== undefined && parsedStandalone !== null) {
          if (fieldKey === 'companySettings' && typeof parsedStandalone === 'object') {
            const resolvedName = parsedStandalone.name || parsedStandalone.companyName || (fallback as any).name;
            return {
              ...fallback,
              ...parsedStandalone,
              name: resolvedName,
            } as T;
          }
          return parsedStandalone;
        }
      } catch {}
    }

    // 2. Check master monolithic ERP storage object
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed[fieldKey] !== undefined && parsed[fieldKey] !== null) {
        if (fieldKey === 'companySettings' && typeof parsed[fieldKey] === 'object') {
          const resolvedName = parsed[fieldKey].name || parsed[fieldKey].companyName || (fallback as any).name;
          return {
            ...fallback,
            ...parsed[fieldKey],
            name: resolvedName,
          } as T;
        }
        return parsed[fieldKey];
      }
    }
  } catch (e) {
    console.warn(`Failed to read ${fieldKey} from localStorage:`, e);
  }
  return fallback;
}

export const COMMON_DISEASE_CATEGORIES: DiseaseCategoryItem[] = [
  { id: 'ALL', name: 'সকল রোগ (All Diseases)', nameBn: 'সকল রোগ', isDefault: true },
  { id: 'General & Pain', name: 'জ্বর ও ব্যথা (Fever & Pain)', nameBn: 'জ্বর ও সাধারণ ব্যথা', isDefault: true },
  { id: 'Gastrointestinal', name: 'গ্যাস্ট্রিক ও পেট (Gastric & Stomach)', nameBn: 'গ্যাস্ট্রিক ও পরিপakতন্ত্র', isDefault: true },
  { id: 'Respiratory', name: 'সর্দি ও কাশি (Cold & Cough)', nameBn: 'শ্বাসতন্ত্র ও কাশি', isDefault: true },
  { id: 'Dermatology & Allergy', name: 'অ্যালার্জি ও চর্ম (Allergy & Skin)', nameBn: 'অ্যালার্জি ও চুলকানি', isDefault: true },
  { id: 'ENT (Ear, Nose, Throat)', name: 'নাক, কান ও গলা (ENT)', nameBn: 'নাক, কান ও গলা', isDefault: true },
  { id: 'Dental Care', name: 'দাঁত ও মাড়ি (Dental)', nameBn: 'দাঁত ও মাড়ির যত্ন', isDefault: true },
  { id: 'Cardiovascular', name: 'উচ্চ রক্তচাপ (Blood Pressure)', nameBn: 'হৃদরোগ ও রক্তচাপ', isDefault: true },
  { id: 'Endocrinology', name: 'ডায়াবেটিস (Diabetes)', nameBn: 'ডায়াবেটিস', isDefault: true },
  { id: 'Urology', name: 'প্রস্রাব ও কিডনি (UTI)', nameBn: 'মূত্রনালী ও কিডনি', isDefault: true },
  { id: 'Supplements & Nutrition', name: 'ভিটামিন ও পুষ্টি (Supplements)', nameBn: 'পুষ্টি ও দুর্বলতা', isDefault: true },
];

// Global non-negative sanitizers: ensures no wallet balance, product/batch stock, or party balance can EVER go below 0
const clampNonNegative = (val: any, decimals = 2): number => {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.max(0, Number(num.toFixed(decimals)));
};

const sanitizeWallets = (list: Wallet[]): Wallet[] =>
  (Array.isArray(list) ? list : []).map(w => ({
    ...w,
    balance: clampNonNegative(w?.balance, 2),
  }));

const NON_CASH_WALLET_IDS = new Set(['due', 'credit', 'adjusted', 'emi']);

const resolveWalletIndex = (list: Wallet[], preferredId?: string, preferredName?: string): number => {
  if (!Array.isArray(list) || list.length === 0) return -1;
  const cleanId = preferredId ? String(preferredId).trim() : '';
  if (cleanId && !NON_CASH_WALLET_IDS.has(cleanId.toLowerCase())) {
    const byId = list.findIndex(w => w.id === cleanId);
    if (byId >= 0) return byId;
  }
  const cleanName = preferredName ? String(preferredName).trim().toLowerCase() : '';
  if (cleanName) {
    const byName = list.findIndex(
      w => w.name?.trim().toLowerCase() === cleanName || w.nameBn?.trim().toLowerCase() === cleanName
    );
    if (byName >= 0) return byName;
  }
  const cashIdx = list.findIndex(w => w.type === 'CASH');
  return cashIdx >= 0 ? cashIdx : 0;
};

const deductAmountFromWallets = (
  list: Wallet[],
  amount: number,
  preferredId?: string,
  preferredName?: string
): Wallet[] => {
  const targetAmt = Number(amount || 0);
  if (!Number.isFinite(targetAmt) || targetAmt <= 0 || !Array.isArray(list) || list.length === 0) return list;
  const next = list.map(w => ({ ...w }));
  let remaining = Number(targetAmt.toFixed(2));
  const primaryIdx = resolveWalletIndex(next, preferredId, preferredName);
  if (primaryIdx >= 0 && remaining > 0) {
    const avail = Number(next[primaryIdx].balance || 0);
    const take = Math.min(avail, remaining);
    next[primaryIdx].balance = Math.max(0, Number((avail - take).toFixed(2)));
    remaining = Number((remaining - take).toFixed(2));
  }
  if (remaining > 0.005) {
    const fallbackOrder = next
      .map((w, idx) => ({ w, idx }))
      .filter(x => x.idx !== primaryIdx && Number(x.w.balance || 0) > 0)
      .sort((a, b) => (a.w.type === 'CASH' ? -1 : b.w.type === 'CASH' ? 1 : 0));
    for (const item of fallbackOrder) {
      if (remaining <= 0.005) break;
      const avail = Number(next[item.idx].balance || 0);
      const take = Math.min(avail, remaining);
      next[item.idx].balance = Math.max(0, Number((avail - take).toFixed(2)));
      remaining = Number((remaining - take).toFixed(2));
    }
  }
  return next;
};

const creditAmountToWallets = (
  list: Wallet[],
  amount: number,
  preferredId?: string,
  preferredName?: string
): Wallet[] => {
  const targetAmt = Number(amount || 0);
  if (!Number.isFinite(targetAmt) || targetAmt <= 0 || !Array.isArray(list) || list.length === 0) return list;
  const idx = resolveWalletIndex(list, preferredId, preferredName);
  if (idx < 0) return list;
  return list.map((w, i) =>
    i === idx ? { ...w, balance: Number((Number(w.balance || 0) + targetAmt).toFixed(2)) } : w
  );
};

const hasOnlyZeroCashInSources = (state: {
  deletedEntityIds?: Record<string, string[]>;
  deletedSaleInvoices?: DeletedSaleInvoice[];
  saleInvoices?: SaleInvoice[];
  cashAdjustments?: CashAdjustment[];
  installmentSchemes?: InstallmentScheme[];
  purchaseReturns?: PurchaseReturn[];
  dayBookEntries?: DayBookEntry[];
}): boolean => {
  const hasDeletedSale =
    (state.deletedEntityIds?.saleInvoices?.length || 0) > 0 || (state.deletedSaleInvoices?.length || 0) > 0;
  if (!hasDeletedSale) return false;
  const hasPaidSale = (state.saleInvoices || []).some(inv => Number(inv.paidAmount || 0) > 0);
  const hasCashAdd = (state.cashAdjustments || []).some(a => a.type === 'CASH_ADD' && Number(a.amount || 0) > 0);
  const hasEmiCash = (state.installmentSchemes || []).some(
    s =>
      Number(s.downPayment || 0) > 0 ||
      (s.schedules || []).some(sc => sc.status === 'PAID' && Number(sc.paidAmount || 0) > 0)
  );
  const hasCashPurchaseReturn = (state.purchaseReturns || []).some(r => Number(r.cashRefunded || 0) > 0);
  const hasDayBookCashIn = (state.dayBookEntries || []).some(
    d => d.flow === 'IN' && d.type !== 'WALLET_TRANSFER' && Number(d.amount || 0) > 0
  );
  return !hasPaidSale && !hasCashAdd && !hasEmiCash && !hasCashPurchaseReturn && !hasDayBookCashIn;
};

const sanitizeProducts = (list: Product[]): Product[] =>
  (Array.isArray(list) ? list : []).map(p => ({
    ...p,
    stock: clampNonNegative(p?.stock, 4),
    batches: Array.isArray(p?.batches)
      ? p.batches.map(b => ({
          ...b,
          stock: clampNonNegative(b?.stock, 4),
          initialStock:
            b?.initialStock !== undefined ? clampNonNegative(b.initialStock, 4) : b?.initialStock,
        }))
      : p?.batches,
  }));

const sanitizeParties = (list: Party[]): Party[] =>
  (Array.isArray(list) ? list : []).map(p => ({
    ...p,
    openingBalance: clampNonNegative(p?.openingBalance, 2),
    currentBalance: clampNonNegative(p?.currentBalance, 2),
  }));

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Settings & Theme
  const [language, setLanguage] = useState<Language>(() => getPersistedData('language', 'en'));
  const [theme, setTheme] = useState<Theme>(() => getPersistedData('theme', 'light'));
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [activeHrSubTab, setActiveHrSubTab] = useState<HrSubTab>('employees');
  const [activeInstallmentSubTab, setActiveInstallmentSubTab] = useState<InstallmentSubTab>('schemes');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  const [printableDoc, setPrintableDoc] = useState<PrintableDocumentData | null>(null);

  // Core Data States with Lazy Initialization from Local Storage
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    const persisted = getPersistedData('companySettings', initialCompanySettings);
    if (!persisted || !persisted.name || persisted.name.includes('Super Store') || persisted.name.includes('fghgh')) {
      return {
        ...initialCompanySettings,
        ...(persisted || {}),
        name: 'Silva Electronics & IT',
        nameBn: persisted?.nameBn || initialCompanySettings.nameBn,
        address: persisted?.address && !persisted.address.includes('Motijheel') ? persisted.address : initialCompanySettings.address,
        email: persisted?.email && !persisted.email.includes('info@dokanprobd.com') ? persisted.email : initialCompanySettings.email,
        logoUrl: persisted?.logoUrl || initialCompanySettings.logoUrl,
        businessModule: persisted?.businessModule || initialCompanySettings.businessModule || 'dokan',
        invoiceTemplate: (persisted?.invoiceTemplate as any) || initialCompanySettings.invoiceTemplate || 'COMPACT_BILL',
      };
    }
    return { ...initialCompanySettings, ...persisted };
  });
  const [products, _setProducts] = useState<Product[]>(() =>
    sanitizeProducts(getPersistedData('products', initialProducts))
  );
  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  const setProducts: React.Dispatch<React.SetStateAction<Product[]>> = useCallback(action => {
    _setProducts(prev => {
      const next = sanitizeProducts(typeof action === 'function' ? action(prev) : action);
      productsRef.current = next;
      return next;
    });
  }, []);
  const [deletedProductIds, setDeletedProductIds] = useState<string[]>(() => {
    const isLikelyProductId = (v: any) => typeof v === 'string' && v.startsWith('prod-');
    try {
      const raw = localStorage.getItem('DOKANPRO_DELETED_PRODUCT_IDS');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(isLikelyProductId);
      }
    } catch {}
    return [];
  });
  const [deletedEntityIds, setDeletedEntityIds] = useState<Record<string, string[]>>(() => {
    const sanitizeMap = (m: any): Record<string, string[]> => {
      if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
      const out: Record<string, string[]> = { ...m };
      if (Array.isArray(out.products)) {
        out.products = out.products.filter(v => typeof v === 'string' && v.startsWith('prod-'));
      }
      return out;
    };
    try {
      const raw = localStorage.getItem('DOKANPRO_DELETED_ENTITY_IDS');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return sanitizeMap(parsed);
      }
    } catch {}
    const fromMaster = getPersistedData<Record<string, string[]>>('deletedEntityIds', {});
    return sanitizeMap(fromMaster);
  });
  const deletedEntityIdsRef = useRef<Record<string, string[]>>(deletedEntityIds);
  useEffect(() => {
    deletedEntityIdsRef.current = deletedEntityIds;
  }, [deletedEntityIds]);
  const [categories, setCategories] = useState<Category[]>(() => getPersistedData('categories', initialCategories));
  const [parties, _setParties] = useState<Party[]>(() => {
    const raw: Party[] = getPersistedData('parties', initialParties);
    return sanitizeParties(
      raw.map((p, idx) => ({
        ...p,
        serialNumber: p.serialNumber || `${p.type === 'SUPPLIER' ? 'SUPP' : 'CUST'}-${String(idx + 1).padStart(4, '0')}`,
      }))
    );
  });
  const setParties: React.Dispatch<React.SetStateAction<Party[]>> = useCallback(action => {
    _setParties(prev => sanitizeParties(typeof action === 'function' ? action(prev) : action));
  }, []);
  const [wallets, _setWallets] = useState<Wallet[]>(() =>
    sanitizeWallets(getPersistedData('wallets', initialWallets))
  );
  const setWallets: React.Dispatch<React.SetStateAction<Wallet[]>> = useCallback(action => {
    _setWallets(prev => sanitizeWallets(typeof action === 'function' ? action(prev) : action));
  }, []);
  const [saleInvoices, setSaleInvoices] = useState<SaleInvoice[]>(() => getPersistedData('saleInvoices', initialSaleInvoices));
  const [deletedSaleInvoices, setDeletedSaleInvoices] = useState<DeletedSaleInvoice[]>(() => getPersistedData('deletedSaleInvoices', initialDeletedSaleInvoices));
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>(() => getPersistedData('saleReturns', []));
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(() => getPersistedData('purchaseInvoices', initialPurchaseInvoices));
  const [deletedPurchaseInvoices, setDeletedPurchaseInvoices] = useState<DeletedPurchaseInvoice[]>(() => {
    // Try dedicated archive first, fallback to main persisted
    try {
      const standalone = localStorage.getItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE');
      if (standalone) {
        const parsed = JSON.parse(standalone);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return getPersistedData('deletedPurchaseInvoices', initialDeletedPurchaseInvoices);
  });
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>(() => getPersistedData('purchaseReturns', []));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getPersistedData('purchaseOrders', initialPurchaseOrders));
  const [quotations, setQuotations] = useState<Quotation[]>(() => getPersistedData('quotations', []));
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(() => getPersistedData('salesOrders', []));

  // Warranty States
  const [warrantyPolicies, setWarrantyPolicies] = useState<WarrantyPolicy[]>(() =>
    getPersistedData('warrantyPolicies', initialWarrantyPolicies)
  );
  const [warrantyRecords, setWarrantyRecords] = useState<WarrantyRecord[]>(() =>
    getPersistedData('warrantyRecords', initialWarrantyRecords)
  );
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaim[]>(() =>
    getPersistedData('warrantyClaims', initialWarrantyClaims)
  );

  // Warranty Handlers
  const addWarrantyPolicy = (policy: Omit<WarrantyPolicy, 'id'>): WarrantyPolicy => {
    const newPol: WarrantyPolicy = {
      ...policy,
      id: `war-pol-${Date.now()}`,
    };
    setWarrantyPolicies(prev => [newPol, ...prev]);
    showToast(language === 'bn' ? 'ওয়ারেন্টি পলিসি সফলভাবে তৈরি করা হয়েছে' : 'Warranty policy created successfully', 'success');
    return newPol;
  };

  const updateWarrantyPolicy = (id: string, updates: Partial<WarrantyPolicy>) => {
    setWarrantyPolicies(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    showToast(language === 'bn' ? 'ওয়ারেন্টি পলিসি আপডেট করা হয়েছে' : 'Warranty policy updated', 'success');
  };

  const deleteWarrantyPolicy = (id: string) => {
    const pol = warrantyPolicies.find(p => p.id === id);
    setWarrantyPolicies(prev => prev.filter(p => p.id !== id));
    recordDeletedTombstones('warrantyPolicies', [id]);

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'WARRANTY_POLICY',
          sourceTable: 'warranty_policies',
          recordId: id,
          title: `Warranty Policy '${pol?.name || id}'`,
          snapshot: pol || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? `ওয়ারেন্টি পলিসি সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Warranty policy removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Warranty Policy '${pol?.name || id}'`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted warranty policy '${pol?.name || id}' on ${nowStr}.`,
      severity: 'danger',
      targetId: id,
      targetName: `Warranty Policy '${pol?.name || id}'`,
    });
    showToast(language === 'bn' ? `ওয়ারেন্টি পলিসি (${nowStr}) মুছে ফেলা হয়েছে` : `Warranty policy deleted on ${nowStr}`, 'info');
  };

  const addWarrantyRecord = (record: Omit<WarrantyRecord, 'id' | 'createdAt'>): WarrantyRecord => {
    if (record.serialNumber && record.serialNumber.trim()) {
      const serial = record.serialNumber.trim();
      const duplicateRecord = warrantyRecords.find(
        r => r.serialNumber && r.serialNumber.trim().toLowerCase() === serial.toLowerCase()
      );
      if (duplicateRecord) {
        showToast(
          language === 'bn'
            ? `এই সিরিয়াল / IMEI (${serial}) আগে থেকেই চালান #${duplicateRecord.invoiceNumber} (${duplicateRecord.productName})-এ বিদ্যমান! একই সিরিয়াল দিয়ে পুনরায় এন্ট্রি হবে না।`
            : `Serial / IMEI (${serial}) already exists for invoice #${duplicateRecord.invoiceNumber} (${duplicateRecord.productName})! Duplicate entry is not allowed.`,
          'error'
        );
        return duplicateRecord;
      }
    }

    const newRec: WarrantyRecord = {
      ...record,
      id: `war-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toLocaleString(),
    };
    setWarrantyRecords(prev => [newRec, ...prev]);
    showToast(language === 'bn' ? 'ওয়ারেন্টি কার্ড রেজিস্টার করা হয়েছে' : 'Warranty card registered successfully', 'success');
    return newRec;
  };

  const updateWarrantyRecord = (id: string, updates: Partial<WarrantyRecord>) => {
    if (updates.serialNumber && updates.serialNumber.trim()) {
      const serial = updates.serialNumber.trim();
      const duplicateRecord = warrantyRecords.find(
        r => r.id !== id && r.serialNumber && r.serialNumber.trim().toLowerCase() === serial.toLowerCase()
      );
      if (duplicateRecord) {
        showToast(
          language === 'bn'
            ? `এই সিরিয়াল / IMEI (${serial}) অন্য ওয়ারেন্টি রেকর্ডে ব্যবহৃত! পরিবর্তন করা যাবে না।`
            : `Serial / IMEI (${serial}) is already used in another record! Duplicate not allowed.`,
          'error'
        );
        return;
      }
    }
    setWarrantyRecords(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
    showToast(language === 'bn' ? 'ওয়ারেন্টি রেকর্ড আপডেট করা হয়েছে' : 'Warranty record updated', 'success');
  };

  const deleteWarrantyRecord = (id: string) => {
    const rec = warrantyRecords.find(r => r.id === id);
    const linkedClaims = warrantyClaims.filter(c => c.warrantyRecordId === id);
    setWarrantyRecords(prev => prev.filter(r => r.id !== id));
    setWarrantyClaims(prev => prev.filter(c => c.warrantyRecordId !== id));
    recordDeletedTombstones('warrantyRecords', [id]);
    if (linkedClaims.length > 0) {
      recordDeletedTombstones('warrantyClaims', linkedClaims.map(c => c.id));
    }

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'WARRANTY_RECORD',
          sourceTable: 'warranty_records',
          recordId: id,
          referenceNo: rec?.warrantyCode || rec?.invoiceNumber,
          title: `Warranty Record #${rec?.warrantyCode || id} (${rec?.productName || ''})`,
          snapshot: { record: rec || { id }, linkedClaims },
        },
      ]);
      showToast(
        language === 'bn'
          ? `ওয়ারেন্টি রেকর্ড সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Warranty record removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Warranty Record #${rec?.warrantyCode || id}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted warranty record #${rec?.warrantyCode || id} (${rec?.productName || ''}) on ${nowStr}.`,
      severity: 'danger',
      targetId: id,
      targetName: `Warranty Record #${rec?.warrantyCode || id}`,
    });

    showToast(language === 'bn' ? `ওয়ারেন্টি রেকর্ড (${nowStr}) মুছে ফেলা হয়েছে` : `Warranty record deleted on ${nowStr}`, 'info');
  };

  const addWarrantyClaim = (claim: Omit<WarrantyClaim, 'id' | 'createdAt' | 'actionsHistory'>): WarrantyClaim => {
    const newClaim: WarrantyClaim = {
      ...claim,
      id: `war-clm-${Date.now()}`,
      actionsHistory: [
        {
          id: `act-${Date.now()}`,
          date: new Date().toLocaleString(),
          status: claim.status || 'RECEIVED',
          note: 'Claim initiated & product received for service.',
          updatedBy: currentUser?.fullName || 'Staff',
        },
      ],
      createdAt: new Date().toLocaleString(),
    };
    setWarrantyClaims(prev => [newClaim, ...prev]);
    if (claim.warrantyRecordId) {
      setWarrantyRecords(prev => prev.map(r => r.id === claim.warrantyRecordId ? { ...r, status: 'CLAIMED' } : r));
    }
    showToast(language === 'bn' ? `ওয়ারেন্টি ক্লেইম টিকিট ${newClaim.claimTicketNo} সাকসেসফুল!` : `Warranty claim ticket ${newClaim.claimTicketNo} registered`, 'success');
    return newClaim;
  };

  const updateWarrantyClaimStatus = (id: string, status: WarrantyClaimStatus, note?: string, updates?: Partial<WarrantyClaim>) => {
    let updatedClaimObj: WarrantyClaim | undefined;
    setWarrantyClaims(prev => prev.map(c => {
      if (c.id === id) {
        const newAction = {
          id: `act-${Date.now()}`,
          date: new Date().toLocaleString(),
          status,
          note: note || `Status updated to ${status}`,
          updatedBy: currentUser?.fullName || 'Staff',
        };
        const updated = {
          ...c,
          ...updates,
          status,
          actionsHistory: [newAction, ...(c.actionsHistory || [])],
        };
        updatedClaimObj = updated;
        return updated;
      }
      return c;
    }));
    showToast(language === 'bn' ? `ক্লেইম স্ট্যাটাস পরিবর্তিত হয়ে "${status}" হয়েছে` : `Claim status updated to "${status}"`, 'success');

    // Auto SMS on Warranty Resolved
    const resolvedStatuses: WarrantyClaimStatus[] = ['REPAIRED', 'REPLACED', 'DELIVERED', 'REFUNDED'];
    if (
      updatedClaimObj &&
      resolvedStatuses.includes(status) &&
      smsConfig.enabled &&
      smsConfig.autoSendOnWarrantyResolved !== false &&
      updatedClaimObj.customerPhone
    ) {
      sendWarrantyClaimSms(updatedClaimObj, note).catch(err => console.warn('Warranty Resolved SMS trigger error:', err));
    }
  };

  const deleteWarrantyClaim = (id: string) => {
    const claim = warrantyClaims.find(c => c.id === id);
    setWarrantyClaims(prev => prev.filter(c => c.id !== id));
    recordDeletedTombstones('warrantyClaims', [id]);

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'WARRANTY_CLAIM',
          sourceTable: 'warranty_claims',
          recordId: id,
          referenceNo: claim?.claimTicketNo,
          title: `Warranty Claim #${claim?.claimTicketNo || id} (${claim?.productName || ''})`,
          snapshot: claim || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? `ওয়ারেন্টি ক্লেইম টিকেট সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Warranty claim removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Warranty Claim Ticket #${claim?.claimTicketNo || id}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted warranty claim ticket #${claim?.claimTicketNo || id} (${claim?.productName || ''}) on ${nowStr}.`,
      severity: 'danger',
      targetId: id,
      targetName: `Warranty Claim Ticket #${claim?.claimTicketNo || id}`,
    });

    showToast(language === 'bn' ? `ওয়ারেন্টি ক্লেইম টিকেট (${nowStr}) মুছে ফেলা হয়েছে` : `Warranty claim ticket deleted on ${nowStr}`, 'info');
  };

  const addPurchaseOrder = (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt'>) => {
    const poNumber = `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, '0')}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const creatorName = currentUser?.fullName || currentUser?.username || 'Admin';
    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}`,
      poNumber,
      createdAt: `${poData.date} ${nowTime}`,
      createdBy: creatorName,
      contributors: [
        {
          action: 'Created PO',
          actionBn: 'ক্রয় আদেশ তৈরি',
          userName: creatorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${poData.date} ${nowTime}`,
        },
      ],
    };
    setPurchaseOrders(prev => [newPO, ...prev]);
    showToast(language === 'bn' ? `ক্রয় আদেশ ${poNumber} তৈরি করা হয়েছে।` : `Purchase Order ${poNumber} created successfully.`, 'success');
    return newPO;
  };

  const updatePurchaseOrderStatus = (id: string, status: POStatus) => {
    const approverName = currentUser?.fullName || currentUser?.username || 'Admin';
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().split('T')[0];

    setPurchaseOrders(prev => prev.map(po => {
      if (po.id === id) {
        const update: Partial<PurchaseOrder> = { status };
        const existingContributors = po.contributors || [
          {
            action: 'Created PO',
            actionBn: 'ক্রয় আদেশ তৈরি',
            userName: po.createdBy || 'Admin',
            timestamp: po.createdAt,
          },
        ];

        if (status === 'APPROVED') {
          update.approvedBy = approverName;
          update.contributors = [
            ...existingContributors,
            {
              action: 'Approved PO',
              actionBn: 'অনুমোদন কারী',
              userName: approverName,
              userId: currentUser?.id,
              userRole: currentUser?.role,
              timestamp: `${today} ${nowTime}`,
            },
          ];
        } else if (status === 'CANCELLED') {
          update.contributors = [
            ...existingContributors,
            {
              action: 'Cancelled PO',
              actionBn: 'বাতিল কারী',
              userName: approverName,
              userId: currentUser?.id,
              userRole: currentUser?.role,
              timestamp: `${today} ${nowTime}`,
            },
          ];
        }
        return { ...po, ...update };
      }
      return po;
    }));
    showToast(language === 'bn' ? 'ক্রয় আদেশের স্ট্যাটাস আপডেট করা হয়েছে।' : 'Purchase Order status updated.', 'success');
  };

  const deletePurchaseOrder = (id: string) => {
    const po = purchaseOrders.find(p => p.id === id);
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
    recordDeletedTombstones('purchaseOrders', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'PURCHASE_ORDER',
          sourceTable: 'purchase_orders',
          recordId: id,
          referenceNo: po?.poNumber,
          title: `Purchase Order #${po?.poNumber || id}${po?.supplierName ? ` - ${po.supplierName}` : ''}`,
          amount: po?.grandTotal,
          snapshot: po || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? `ক্রয় আদেশ সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Purchase order removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }
    if (po) {
      logActivity({
        actionType: 'DELETE',
        title: `Deleted Purchase Order #${po.poNumber}`,
        description: `Removed purchase order for ${po.supplierName} amounting to ৳${po.grandTotal.toLocaleString()}.`,
        severity: 'warning',
        targetId: po.id,
        targetName: `PO #${po.poNumber}`,
      });
    }
    showToast(language === 'bn' ? 'ক্রয় আদেশ মুছে ফেলা হয়েছে।' : 'Purchase order deleted.', 'info');
  };

  const addQuotation = (qData: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => {
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(quotations.length + 1).padStart(3, '0')}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const creatorName = currentUser?.fullName || currentUser?.username || 'Admin';
    const newQuotation: Quotation = {
      ...qData,
      id: `qt-${Date.now()}`,
      quotationNumber,
      createdAt: `${qData.date} ${nowTime}`,
      createdBy: creatorName,
      contributors: [
        {
          action: 'Created Quotation',
          actionBn: 'কোটেশন প্রস্তুত',
          userName: creatorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${qData.date} ${nowTime}`,
        },
      ],
    };
    setQuotations(prev => [newQuotation, ...prev]);
    showToast(language === 'bn' ? `কোটেশন ${quotationNumber} তৈরি করা হয়েছে।` : `Quotation ${quotationNumber} created successfully.`, 'success');
    return newQuotation;
  };

  const updateQuotationStatus = (id: string, status: QuotationStatus) => {
    const approverName = currentUser?.fullName || currentUser?.username || 'Admin';
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().split('T')[0];

    setQuotations(prev => prev.map(q => {
      if (q.id === id) {
        const update: Partial<Quotation> = { status };
        const existingContributors = q.contributors || [
          {
            action: 'Created Quotation',
            actionBn: 'কোটেশন প্রস্তুত',
            userName: q.createdBy || 'Admin',
            timestamp: q.createdAt,
          },
        ];

        if (status === 'APPROVED') {
          update.approvedBy = approverName;
          update.approvedAt = new Date().toISOString();
          update.contributors = [
            ...existingContributors,
            {
              action: 'Approved Quotation',
              actionBn: 'অনুমোদন কারী',
              userName: approverName,
              userId: currentUser?.id,
              userRole: currentUser?.role,
              timestamp: `${today} ${nowTime}`,
            },
          ];
        } else if (status === 'CANCELLED') {
          update.contributors = [
            ...existingContributors,
            {
              action: 'Cancelled Quotation',
              actionBn: 'বাতিল কারী',
              userName: approverName,
              userId: currentUser?.id,
              userRole: currentUser?.role,
              timestamp: `${today} ${nowTime}`,
            },
          ];
        }
        return { ...q, ...update };
      }
      return q;
    }));
    showToast(language === 'bn' ? 'কোটেশন স্ট্যাটাস আপডেট করা হয়েছে।' : 'Quotation status updated.', 'success');
  };

  const deleteQuotation = (id: string) => {
    const q = quotations.find(item => item.id === id);
    setQuotations(prev => prev.filter(item => item.id !== id));
    recordDeletedTombstones('quotations', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'QUOTATION',
          sourceTable: 'quotations',
          recordId: id,
          referenceNo: q?.quotationNumber,
          title: `Quotation #${q?.quotationNumber || id}${q?.customerName ? ` - ${q.customerName}` : ''}`,
          amount: q?.grandTotal,
          snapshot: q || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? `কোটেশন সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Quotation removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }
    if (q) {
      logActivity({
        actionType: 'DELETE',
        title: `Deleted Quotation #${q.quotationNumber}`,
        description: `Removed quotation for ${q.customerName} amounting to ৳${q.grandTotal.toLocaleString()}.`,
        severity: 'warning',
        targetId: q.id,
        targetName: `QT #${q.quotationNumber}`,
      });
    }
    showToast(language === 'bn' ? 'কোটেশন মুছে ফেলা হয়েছে।' : 'Quotation deleted.', 'info');
  };

  const convertQuotationToSale = (qId: string, paidAmount: number, walletId: string, paymentMethod: PaymentMethod, customInvoiceNumber?: string): SaleInvoice | null => {
    const quotation = quotations.find(q => q.id === qId);
    if (!quotation) {
      showToast(language === 'bn' ? 'কোটেশন পাওয়া যায়নি!' : 'Quotation not found!', 'error');
      return null;
    }

    if (quotation.status === 'CONVERTED_TO_SALE') {
      showToast(language === 'bn' ? 'এই কোটেশনটি আগেই বিক্রয়ে রূপান্তরিত হয়েছে।' : 'This quotation has already been converted to a sale.', 'warning');
      return null;
    }

    const converterName = currentUser?.fullName || currentUser?.username || 'Admin';
    const quoteCreatorName = quotation.createdBy || 'Admin';
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().split('T')[0];

    const dueAmount = Math.max(0, quotation.grandTotal - paidAmount);

    const saleInvoice = createSaleInvoice({
      invoiceNumber: customInvoiceNumber?.trim() || undefined,
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      customerAddress: quotation.customerAddress,
      items: quotation.items.map(item => {
        const prod = products.find(p => p.id === item.productId);
        const factor = getEffectiveConversionFactor(item, prod);
        return {
          ...item,
          barcode: prod?.barcode || '',
          unit: item.unit,
          conversionFactor: factor,
          baseQuantity: getBaseQuantity(item, prod),
          purchasePrice: prod?.purchasePrice || 0,
          stock: prod?.stock || 0,
          total: item.total,
        };
      }),
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      discountType: quotation.discountType,
      vatAmount: quotation.taxAmount,
      grandTotal: quotation.grandTotal,
      paidAmount,
      dueAmount,
      paymentMethod,
      walletId,
      notes: `Converted from Quotation #${quotation.quotationNumber}. ${quotation.notes || ''}`,
    });

    if (saleInvoice) {
      // Update the Sale Invoice with Quotation Creator + Converter audit trail
      setSaleInvoices(prev =>
        prev.map(inv => {
          if (inv.id === saleInvoice.id) {
            return {
              ...inv,
              createdBy: quoteCreatorName,
              completedBy: converterName,
              convertedBy: converterName,
              approvedBy: quotation.approvedBy,
              contributors: [
                {
                  action: 'Quotation Created',
                  actionBn: 'কোটেশন তৈরি',
                  userName: quoteCreatorName,
                  timestamp: quotation.createdAt,
                },
                ...(quotation.approvedBy
                  ? [
                      {
                        action: 'Quotation Approved',
                        actionBn: 'কোটেশন অনুমোদন',
                        userName: quotation.approvedBy,
                        timestamp: quotation.approvedAt,
                      },
                    ]
                  : []),
                {
                  action: 'Converted & Finalized Sale',
                  actionBn: 'বিক্রয়ে রূপান্তর ও চালান চূড়ান্ত',
                  userName: converterName,
                  userId: currentUser?.id,
                  userRole: currentUser?.role,
                  timestamp: `${today} ${nowTime}`,
                },
              ],
            };
          }
          return inv;
        })
      );

      // Update Quotation with conversion details
      const existingQuoteContributors = quotation.contributors || [
        {
          action: 'Created Quotation',
          actionBn: 'কোটেশন প্রস্তুত',
          userName: quoteCreatorName,
          timestamp: quotation.createdAt,
        },
      ];

      setQuotations(prev =>
        prev.map(q =>
          q.id === qId
            ? {
                ...q,
                status: 'CONVERTED_TO_SALE',
                convertedSaleInvoiceId: saleInvoice.id,
                convertedBy: converterName,
                completedBy: converterName,
                contributors: [
                  ...existingQuoteContributors,
                  {
                    action: 'Converted to Sale Invoice',
                    actionBn: 'বিক্রয় চালানে রূপান্তর',
                    userName: converterName,
                    userId: currentUser?.id,
                    userRole: currentUser?.role,
                    timestamp: `${today} ${nowTime}`,
                  },
                ],
              }
            : q
        )
      );
      showToast(language === 'bn' ? 'কোটেশনটি সফলভাবে বিক্রয়ে রূপান্তরিত হয়েছে।' : 'Quotation successfully converted to sale.', 'success');
    }

    return saleInvoice;
  };

  const addSalesOrder = (oData: Omit<SalesOrder, 'id' | 'orderNumber' | 'createdAt'>) => {
    const orderNumber = `SO-${new Date().getFullYear()}-${String(salesOrders.length + 1).padStart(3, '0')}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const creatorName = currentUser?.fullName || currentUser?.username || 'Admin';
    const newOrder: SalesOrder = {
      ...oData,
      id: `so-${Date.now()}`,
      orderNumber,
      createdAt: `${oData.date} ${nowTime}`,
      createdBy: creatorName,
    };
    setSalesOrders(prev => [newOrder, ...prev]);
    showToast(language === 'bn' ? `সেলস অর্ডার ${orderNumber} তৈরি করা হয়েছে।` : `Sales Order ${orderNumber} created successfully.`, 'success');
    return newOrder;
  };

  const updateSalesOrderStatus = (id: string, status: SalesOrderStatus) => {
    setSalesOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    showToast(language === 'bn' ? 'সেলস অর্ডার স্ট্যাটাস আপডেট করা হয়েছে।' : 'Sales order status updated.', 'success');
  };

  const updateSalesOrder = (id: string, oData: Partial<SalesOrder>) => {
    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;
    setSalesOrders(prev => prev.map(o => o.id === id ? { ...o, ...oData } : o));
    const ord = salesOrders.find(item => item.id === id);
    if (ord) {
      logActivity({
        actionType: 'USER_ACTION',
        title: `Updated Sales Order #${ord.orderNumber}`,
        description: `Updated sales order for ${ord.customerName} amounting to ৳${(oData.grandTotal ?? ord.grandTotal).toLocaleString()}.`,
        severity: 'info',
        targetId: ord.id,
        targetName: `SO #${ord.orderNumber}`,
      });
    }
    showToast(language === 'bn' ? 'সেলস অর্ডার সফলভাবে আপডেট করা হয়েছে।' : 'Sales order updated successfully.', 'success');
  };

  const deleteSalesOrder = (id: string) => {
    const ord = salesOrders.find(item => item.id === id);
    setSalesOrders(prev => prev.filter(item => item.id !== id));
    recordDeletedTombstones('salesOrders', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'SALES_ORDER',
          sourceTable: 'sales_orders',
          recordId: id,
          referenceNo: ord?.orderNumber,
          title: `Sales Order #${ord?.orderNumber || id}${ord?.customerName ? ` - ${ord.customerName}` : ''}`,
          amount: ord?.grandTotal,
          snapshot: ord || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? `সেলস অর্ডার সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Sales order removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }
    if (ord) {
      logActivity({
        actionType: 'DELETE',
        title: `Deleted Sales Order #${ord.orderNumber}`,
        description: `Removed sales order for ${ord.customerName} amounting to ৳${ord.grandTotal.toLocaleString()}.`,
        severity: 'warning',
        targetId: ord.id,
        targetName: `SO #${ord.orderNumber}`,
      });
    }
    showToast(language === 'bn' ? 'সেলস অর্ডার মুছে ফেলা হয়েছে।' : 'Sales order deleted.', 'info');
  };

  const convertSalesOrderToSale = (orderId: string, paidAmount: number, walletId: string, paymentMethod: PaymentMethod, customInvoiceNumber?: string): SaleInvoice | null => {
    const order = salesOrders.find(o => o.id === orderId);
    if (!order) {
      showToast(language === 'bn' ? 'সেলস অর্ডার পাওয়া যায়নি!' : 'Sales Order not found!', 'error');
      return null;
    }

    if (order.status === 'CONVERTED_TO_SALE') {
      showToast(language === 'bn' ? 'এই সেলস অর্ডারটি আগেই বিক্রয়ে রূপান্তরিত হয়েছে।' : 'This sales order has already been converted to a sale.', 'warning');
      return null;
    }

    const saleItems: CartItem[] = order.items.map(i => {
      const prod = products.find(p => p.id === i.productId);
      const factor = getEffectiveConversionFactor(i, prod);
      return {
        productId: i.productId,
        name: i.name,
        nameBn: i.nameBn || i.name,
        barcode: prod?.barcode || '',
        unit: i.unit,
        conversionFactor: factor,
        baseQuantity: getBaseQuantity(i, prod),
        purchasePrice: prod?.purchasePrice || 0,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        discount: i.discount,
        discountType: i.discountType,
        taxPercent: i.taxPercent,
        stock: prod?.stock || 0,
        total: i.total,
        dosageForm: i.dosageForm,
        strength: i.strength,
      };
    });

    let finalCustomerId = order.customerId;
    if (!finalCustomerId || finalCustomerId === 'walk-in') {
      const matchedParty = parties.find(p => p.type === 'CUSTOMER' && ((order.customerPhone && p.phone && p.phone === order.customerPhone) || (order.customerName && p.name.toLowerCase() === order.customerName.toLowerCase())));
      if (matchedParty) {
        finalCustomerId = matchedParty.id;
      }
    }

    const invoice = createSaleInvoice({
      invoiceNumber: customInvoiceNumber,
      date: new Date().toISOString().split('T')[0],
      customerId: finalCustomerId || order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      items: saleItems,
      subtotal: order.subtotal,
      discount: order.discount,
      discountType: order.discountType,
      vatAmount: order.taxAmount,
      grandTotal: order.grandTotal,
      paidAmount,
      dueAmount: Math.max(0, order.grandTotal - paidAmount),
      paymentMethod,
      walletId,
      notes: `Converted from Sales Order #${order.orderNumber}. ${order.notes || ''}`,
    });

    if (invoice) {
      setSalesOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CONVERTED_TO_SALE', convertedSaleInvoiceId: invoice.id } : o));
      showToast(language === 'bn' ? `সেলস অর্ডার সফলভাবে ইনভয়েজে রূপান্তরিত হয়েছে #${invoice.invoiceNumber}` : `Sales order converted to invoice #${invoice.invoiceNumber}`, 'success');
      return invoice;
    }
    return null;
  };

  const convertPOToPurchaseBill = (poId: string, finalItems: PurchaseItem[], finalDiscount: number = 0, paidAmount: number = 0, walletId?: string, customBillNumber?: string): PurchaseInvoice | null => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) {
      showToast(language === 'bn' ? 'ক্রয় আদেশ পাওয়া যায়নি!' : 'Purchase Order not found!', 'error');
      return null;
    }

    const converterName = currentUser?.fullName || currentUser?.username || 'Admin';
    const poCreatorName = po.createdBy || 'Admin';

    const safePaidAmount = Number(paidAmount || 0);
    if (safePaidAmount < 0) {
      showToast(language === 'bn' ? 'পরিশোধের পরিমাণ ঋণাত্মক হতে পারে না!' : 'Paid amount cannot be negative!', 'error');
      return null;
    }

    const finalSubtotal = finalItems.reduce((acc, item) => acc + item.total, 0);
    const finalGrandTotal = Math.max(0, finalSubtotal - finalDiscount);
    const dueAmount = Math.max(0, finalGrandTotal - safePaidAmount);

    let finalWalletId = walletId || wallets[0]?.id || 'w-cash';
    let walletName = 'Cash';

    if (safePaidAmount > 0) {
      const selectedWallet = wallets.find(w => w.id === finalWalletId);
      if (!selectedWallet) {
        showToast(language === 'bn' ? 'পেমেন্ট ওয়ালেট খুঁজে পাওয়া যায়নি!' : 'Payment wallet not found!', 'error');
        return null;
      }
      if (selectedWallet.balance < paidAmount) {
        showToast(
          language === 'bn'
            ? `নির্বাচিত ওয়ালেটে (${selectedWallet.name}) পর্যাপ্ত ব্যালেন্স নেই! বর্তমান ব্যালেন্স: ৳${selectedWallet.balance.toLocaleString()} | পরিশোধ: ৳${paidAmount.toLocaleString()}।`
            : `Insufficient balance in ${selectedWallet.name}! Available: ৳${selectedWallet.balance.toLocaleString()} | Trying to pay: ৳${paidAmount.toLocaleString()}.`,
          'error'
        );
        return null;
      }
      walletName = selectedWallet.name;
    }

    let billNum = customBillNumber?.trim() || generatePurchaseBillNumber(purchaseInvoices);
    const duplicateBill = checkDuplicatePurchaseInvoice(billNum, purchaseInvoices);
    if (duplicateBill) {
      billNum = generatePurchaseBillNumber(purchaseInvoices);
      showToast(
        language === 'bn'
          ? `⚠️ পূর্বের বিল নং ডুপ্লিকেট থাকায় স্বয়ংক্রিয়ভাবে নতুন বিল নং (${billNum}) জেনারেট করা হয়েছে।`
          : `⚠️ Previous bill number was duplicate, automatically generated new bill number (${billNum}).`,
        'info'
      );
    }

    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const purDate = new Date().toISOString().split('T')[0];

    const newPurchase: PurchaseInvoice = {
      id: `pur-${Date.now()}`,
      billNumber: billNum,
      supplierInvoiceNo: customBillNumber?.trim() || po.poNumber,
      date: purDate,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      supplierPhone: po.supplierPhone,
      items: finalItems.map(i => ({ ...i })),
      subtotal: finalSubtotal,
      discount: finalDiscount,
      taxAmount: po.taxAmount,
      grandTotal: finalGrandTotal,
      paidAmount: paidAmount,
      dueAmount: dueAmount,
      paymentMethod: paidAmount === 0 ? 'DUE' : 'CASH',
      walletId: paidAmount === 0 ? undefined : finalWalletId,
      walletName: paidAmount === 0 ? 'Credit / বাকি' : walletName,
      status: dueAmount === 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'DUE'),
      notes: `Converted from PO #${po.poNumber}. ${po.notes || ''}`,
      createdBy: poCreatorName,
      completedBy: converterName,
      convertedBy: converterName,
      approvedBy: po.approvedBy,
      contributors: [
        {
          action: 'Purchase Order Issued',
          actionBn: 'ক্রয় আদেশ প্রদান',
          userName: poCreatorName,
          timestamp: po.createdAt,
        },
        ...(po.approvedBy
          ? [
              {
                action: 'Purchase Order Approved',
                actionBn: 'ক্রয় আদেশ অনুমোদন',
                userName: po.approvedBy,
              },
            ]
          : []),
        {
          action: 'Received & Billed',
          actionBn: 'পণ্য রিসিভ ও বিল এন্ট্রি',
          userName: converterName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${purDate} ${nowTime}`,
        },
      ],
      createdAt: `${purDate} ${nowTime}`,
    };

    setProducts(prevProds =>
      prevProds.map(prod => {
        const boughtItems = finalItems.filter(i => i.productId === prod.id);
        if (boughtItems.length === 0) return prod;

        let newStock = Number(prod.stock || 0);
        let latestPurchasePrice = prod.purchasePrice;
        let latestBatchNumber = prod.batchNumber;
        let latestExpDate = prod.expDate;
        const updatedBatches = prod.batches ? [...prod.batches.map(b => ({ ...b }))] : [];

        for (const itemPurchased of boughtItems) {
          const factor = getEffectiveConversionFactor(itemPurchased, prod);
          const addedBaseQty = getBaseQuantity(itemPurchased, prod);
          const basePurchasePrice =
            Number(itemPurchased.purchasePrice || 0) > 0
              ? computeNormalizedItemCost(Number(itemPurchased.purchasePrice), factor)
              : prod.purchasePrice;
          const baseSalesPrice = itemPurchased.salesPrice
            ? computeNormalizedItemCost(Number(itemPurchased.salesPrice), factor)
            : prod.salesPrice;

          newStock += addedBaseQty;
          latestPurchasePrice = basePurchasePrice;
          if (itemPurchased.batchNumber) latestBatchNumber = itemPurchased.batchNumber;
          if (itemPurchased.expDate) latestExpDate = itemPurchased.expDate;

          updatedBatches.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            batchNumber: itemPurchased.batchNumber || `BN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            purchaseInvoiceNo: billNum,
            mfgDate: itemPurchased.mfgDate || purDate,
            expDate: itemPurchased.expDate || '',
            stock: addedBaseQty,
            initialStock: addedBaseQty,
            purchasePrice: basePurchasePrice,
            salesPrice: baseSalesPrice,
            supplierName: po.supplierName,
            supplierId: po.supplierId,
          });
        }

        return {
          ...prod,
          stock: newStock,
          purchasePrice: latestPurchasePrice,
          batchNumber: latestBatchNumber,
          expDate: latestExpDate,
          batches: updatedBatches,
        };
      })
    );

    if (po.supplierId && dueAmount > 0) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === po.supplierId) {
            return {
              ...p,
              currentBalance: Number(p.currentBalance || 0) + dueAmount,
            };
          }
          return p;
        })
      );
    }

    if (paidAmount > 0) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          if (w.id === finalWalletId) {
            return {
              ...w,
              balance: Math.max(0, Number((w.balance - paidAmount).toFixed(2))),
            };
          }
          return w;
        })
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const dayBookEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: billNum,
      date: purDate,
      type: 'PURCHASE',
      flow: 'OUT',
      partyId: po.supplierId,
      partyName: po.supplierName,
      partyType: 'SUPPLIER',
      amount: Number(paidAmount || 0),
      walletId: paidAmount > 0 ? finalWalletId : 'credit',
      walletName: paidAmount > 0 ? walletName : 'Credit / বাকি',
      referenceId: newPurchase.id,
      referenceNo: billNum,
      remarks: po.notes 
        ? `Converted from PO #${po.poNumber}. ${po.notes}`
        : paidAmount > 0
          ? `Purchase payment to ${po.supplierName} via PO #${po.poNumber} (Total: ৳${finalGrandTotal.toLocaleString()}, Paid: ৳${paidAmount.toLocaleString()}${dueAmount > 0 ? `, Remaining Due: ৳${dueAmount.toLocaleString()}` : ''})`
          : `Credit Purchase via PO #${po.poNumber} from ${po.supplierName} (Total: ৳${finalGrandTotal.toLocaleString()}, Due: ৳${dueAmount.toLocaleString()})`,
      createdBy: currentUser?.id || 'usr-1',
      approvedBy: po.approvedBy,
      createdAt: `${purDate} ${nowTime}`,
    };
    setDayBookEntries(prev => [dayBookEntry, ...prev]);

    setPurchaseOrders(prev => prev.map(p => p.id === poId ? { ...p, status: 'FULLY_RECEIVED' } : p));
    setPurchaseInvoices(prev => [newPurchase, ...prev.filter(p => p.id !== newPurchase.id)]);

    logActivity({
      actionType: 'STOCK_ADJUSTMENT',
      title: `Converted PO #${po.poNumber} to Bill #${billNum}`,
      description: `Converted Purchase Order #${po.poNumber} for ${po.supplierName} (৳${finalGrandTotal.toLocaleString()}). Paid: ৳${paidAmount.toLocaleString()}, Due: ৳${dueAmount.toLocaleString()}.`,
      severity: 'info',
      targetId: newPurchase.id,
      targetName: `Bill #${billNum}`,
    });

    showToast(language === 'bn' ? `ক্রয় আদেশ সফলভাবে ক্রয় বিলে রূপান্তর করা হয়েছে (${billNum})!` : `PO converted to Purchase Bill ${billNum} successfully!`, 'success');
    return newPurchase;
  };
  const [expiredReturnLogs, setExpiredReturnLogs] = useState<ExpiredReturnLog[]>(() => getPersistedData('expiredReturnLogs', []));
  const [diseaseMaster, setDiseaseMaster] = useState<DiseaseMasterEntry[]>(() =>
    getPersistedData('diseaseMaster', INITIAL_DISEASE_MASTER)
  );
  const [diseaseCategories, setDiseaseCategories] = useState<DiseaseCategoryItem[]>(() =>
    getPersistedData('diseaseCategories', COMMON_DISEASE_CATEGORIES)
  );

  const addExpiredReturnLog = (logData: Omit<ExpiredReturnLog, 'id' | 'date'> & { date?: string }) => {
    const creator = currentUser?.fullName || currentUser?.username || currentUser?.id || 'Admin';
    const newLog: ExpiredReturnLog = {
      ...logData,
      id: `expret-${Date.now()}`,
      date: logData.date || new Date().toISOString().split('T')[0],
      createdBy: logData.createdBy || creator,
    };
    setExpiredReturnLogs(prev => [newLog, ...prev]);
    showToast(
      logData.actionType === 'RETURN_SUPPLIER'
        ? (language === 'bn' ? 'মহাজনে ফেরত হিসাব রেকর্ড করা হয়েছে।' : 'Supplier return recorded.')
        : logData.actionType === 'REPLACEMENT'
        ? (language === 'bn' ? 'পণ্য রিপ্লেসমেন্ট (Replace) হিসাব সফলভাবে রেকর্ড করা হয়েছে।' : 'Product replacement recorded.')
        : (language === 'bn' ? 'নষ্ট/অবলোপন (Write-off) হিসাব রেকর্ড করা হয়েছে।' : 'Write-off record saved.'),
      'success'
    );
  };

  const deleteExpiredReturnLog = (id: string) => {
    const logItem = expiredReturnLogs.find(l => l.id === id);
    setExpiredReturnLogs(prev => prev.filter(l => l.id !== id));
    recordDeletedTombstones('expiredReturnLogs', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'EXPIRED_RETURN_LOG',
          sourceTable: 'expired_return_logs',
          recordId: id,
          title: `Expired Return Log - ${logItem?.productName || id}`,
          amount: logItem?.totalValue,
          snapshot: logItem || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'রেকর্ড সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Record removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(language === 'bn' ? 'রেকর্ড মুছে ফেলা হয়েছে।' : 'Record deleted.', 'info');
  };
  const [smsConfig, setSmsConfig] = useState<SmsConfig>(() => getPersistedData('smsConfig', DEFAULT_SMS_CONFIG));
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>(() => getPersistedData('smsLogs', []));

  const [installmentSchemes, setInstallmentSchemes] = useState<InstallmentScheme[]>(() => getPersistedData('installmentSchemes', initialInstallmentSchemes));
  const [employees, setEmployees] = useState<Employee[]>(() => getPersistedData('employees', initialEmployees));
  const [advanceSalaries, setAdvanceSalaries] = useState<AdvanceSalary[]>(() => getPersistedData('advanceSalaries', initialAdvanceSalaries));
  const [payrollHistory, setPayrollHistory] = useState<PayrollEntry[]>(() => getPersistedData('payrollHistory', initialPayrollHistory));
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => getPersistedData('expenseCategories', initialExpenseCategories));
  const [expenseVouchers, setExpenseVouchers] = useState<ExpenseVoucher[]>(() => getPersistedData('expenseVouchers', initialExpenseVouchers));
  const [dayBookEntries, setDayBookEntries] = useState<DayBookEntry[]>(() => {
    const raw: DayBookEntry[] = getPersistedData('dayBookEntries', initialDayBookEntries);
    const purchases: PurchaseInvoice[] = getPersistedData('purchaseInvoices', initialPurchaseInvoices);
    const sales: SaleInvoice[] = getPersistedData('saleInvoices', initialSaleInvoices);
    
    let entries = Array.isArray(raw) ? dedupeById([...raw]) : [];

    // Ensure all purchases are represented in DayBook
    purchases.forEach(pur => {
      const exists = entries.some(
        e =>
          e.type === 'PURCHASE' &&
          (e.referenceId === pur.id ||
            e.voucherNo === pur.billNumber ||
            e.referenceNo === pur.billNumber ||
            (pur.supplierInvoiceNo && (e.voucherNo === pur.supplierInvoiceNo || e.referenceNo === pur.supplierInvoiceNo)))
      );
      if (!exists) {
        entries.push({
          id: `db-pur-${pur.id}`,
          voucherNo: pur.billNumber,
          date: pur.date,
          type: 'PURCHASE',
          flow: 'OUT',
          partyId: pur.supplierId,
          partyName: pur.supplierName,
          partyType: 'SUPPLIER',
          amount: Number(pur.paidAmount || 0), // ONLY the paid amount! (0 if credit)
          walletId: pur.paidAmount > 0 ? (pur.walletId || 'w-cash') : 'credit',
          walletName: pur.paidAmount > 0 ? (pur.walletName || 'Cash') : 'Credit / বাকি',
          referenceId: pur.id,
          referenceNo: pur.billNumber,
          remarks: pur.notes
            ? `Purchase from ${pur.supplierName} (${pur.notes})`
            : pur.paidAmount > 0
              ? `Purchase from ${pur.supplierName} (Total: ৳${pur.grandTotal.toLocaleString()}, Paid: ৳${pur.paidAmount.toLocaleString()}${pur.dueAmount > 0 ? `, Due: ৳${pur.dueAmount.toLocaleString()}` : ''})`
              : `Credit Purchase / বাকি ক্রয় from ${pur.supplierName} (Total: ৳${pur.grandTotal.toLocaleString()}, Due: ৳${pur.dueAmount.toLocaleString()})`,
          createdBy: 'Admin',
          createdAt: pur.createdAt || `${pur.date} 00:00:00`,
        });
      }
    });

    // Ensure all sales are represented in DayBook
    sales.forEach(sale => {
      const exists = entries.some(
        e =>
          e.type === 'SALE' &&
          (e.referenceId === sale.id ||
            e.voucherNo === sale.invoiceNumber ||
            e.referenceNo === sale.invoiceNumber)
      );
      if (!exists) {
        entries.push({
          id: `db-sale-${sale.id}`,
          voucherNo: sale.invoiceNumber,
          date: sale.date,
          type: 'SALE',
          flow: 'IN',
          partyId: sale.customerId,
          partyName: sale.customerName,
          partyType: 'CUSTOMER',
          amount: Number(sale.paidAmount || 0), // ONLY the received amount! (0 if credit)
          walletId: sale.paidAmount > 0 ? (sale.walletId || 'w-cash') : 'due',
          walletName: sale.paidAmount > 0 ? (sale.walletName || 'Cash') : 'Credit / বাকি',
          referenceId: sale.id,
          referenceNo: sale.invoiceNumber,
          remarks: sale.notes
            ? `Sale to ${sale.customerName} (${sale.notes})`
            : sale.paidAmount > 0
              ? `POS Sale to ${sale.customerName} (Total: ৳${sale.grandTotal.toLocaleString()}, Received: ৳${sale.paidAmount.toLocaleString()}${sale.dueAmount > 0 ? `, Due: ৳${sale.dueAmount.toLocaleString()}` : ''})`
              : `Credit Sale / বাকি বিক্রয় to ${sale.customerName} (Total: ৳${sale.grandTotal.toLocaleString()}, Due: ৳${sale.dueAmount.toLocaleString()})`,
          createdBy: sale.cashierName || 'Admin',
          createdAt: sale.createdAt || `${sale.date} 00:00:00`,
        });
      }
    });

    // Normalize any past entries & deduplicate linked sale/purchase entries
    const normalized = entries.map(entry => {
      if (entry.type === 'PURCHASE') {
        const matchingPur = purchases.find(
          p =>
            p.id === entry.referenceId ||
            p.billNumber === entry.voucherNo ||
            p.billNumber === entry.referenceNo ||
            (p.supplierInvoiceNo && (p.supplierInvoiceNo === entry.voucherNo || p.supplierInvoiceNo === entry.referenceNo))
        );
        if (matchingPur) {
          return {
            ...entry,
            referenceId: matchingPur.id,
            voucherNo: matchingPur.billNumber,
            referenceNo: matchingPur.billNumber,
            amount: Number(matchingPur.paidAmount || 0),
            walletName: matchingPur.paidAmount > 0 ? (entry.walletName || matchingPur.walletName || 'Cash') : 'Credit / বাকি',
          };
        }
      }
      if (entry.type === 'SALE') {
        const matchingSale = sales.find(
          s =>
            s.id === entry.referenceId ||
            s.invoiceNumber === entry.voucherNo ||
            s.invoiceNumber === entry.referenceNo
        );
        if (matchingSale) {
          return {
            ...entry,
            referenceId: matchingSale.id,
            voucherNo: matchingSale.invoiceNumber,
            referenceNo: matchingSale.invoiceNumber,
            amount: Number(matchingSale.paidAmount || 0),
            walletName: matchingSale.paidAmount > 0 ? (entry.walletName || matchingSale.walletName || 'Cash') : 'Credit / বাকি',
          };
        }
      }
      return entry;
    });

    return dedupeTransactionDayBookEntries(normalized, sales, purchases).cleaned;
  });
  const [cashAdjustments, setCashAdjustments] = useState<CashAdjustment[]>(() => getPersistedData('cashAdjustments', initialCashAdjustments));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => getPersistedData('activityLogs', initialActivityLogs));

  const formatDeletionTimestamp = (dateInput?: Date | string | number): string => {
    const date = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(date.getTime())) {
      return String(dateInput || '');
    }
    
    const year = date.getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    
    return `${day} ${month} ${year}, ${strHours}:${minutes}:${seconds} ${ampm}`;
  };

  const [clientDeviceInfo, setClientDeviceInfo] = useState<ClientDeviceInfo>(() => getCachedClientDeviceInfo());

  const handleRefreshDeviceLocation = async (): Promise<ClientDeviceInfo> => {
    const info = await fetchClientDeviceInfo(true);
    setClientDeviceInfo(info);
    return info;
  };

  useEffect(() => {
    fetchClientDeviceInfo(true)
      .then(info => setClientDeviceInfo(info))
      .catch(() => {});
  }, []);

  const [users, setUsers] = useState<UserAccount[]>(() => getPersistedData('users', initialUsers));
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const savedUserStr = sessionStorage.getItem('DOKANPRO_CURRENT_USER');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.username) return parsed;
      }
    } catch {}
    const loadedUsers = getPersistedData('users', initialUsers);
    return loadedUsers[0] || initialUsers[0];
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const sessionAuth = sessionStorage.getItem('DOKANPRO_IS_LOGGED_IN');
      return sessionAuth === 'true';
    } catch {
      return false;
    }
  });

  // Auto-logout and record audit entry when user leaves / closes the site ("সাইট থেকে বের হলে লগআউট দেখাবে")
  useEffect(() => {
    const handleSiteExit = () => {
      try {
        const isAuth = sessionStorage.getItem('DOKANPRO_IS_LOGGED_IN') === 'true';
        if (isAuth && currentUser) {
          const clientInfo = getCachedClientDeviceInfo();
          const exitTime = formatDeletionTimestamp(new Date());
          const exitLog: ActivityLog = {
            id: `act-exit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: exitTime,
            actionType: 'LOGOUT',
            title: language === 'bn' ? 'লগআউট (সাইট ত্যাগ / Exit)' : 'User Logged Out (Site Exit)',
            description: language === 'bn'
              ? `ইউজার '${currentUser.fullName}' (${currentUser.username}) সাইট থেকে বের হয়েছেন এবং সেশন সমাপ্ত হয়েছে। আইপি: ${clientInfo.ip}, লোকেশন: ${clientInfo.location}, ডিভাইস: ${clientInfo.device}`
              : `User '${currentUser.fullName}' (${currentUser.username}) exited the site and session was logged out. IP: ${clientInfo.ip}, Location: ${clientInfo.location}, Device: ${clientInfo.device}`,
            severity: 'info',
            userId: currentUser.id,
            userName: currentUser.fullName,
            role: currentUser.role,
            ip: clientInfo.ip,
            location: clientInfo.location,
            device: clientInfo.device,
            browser: clientInfo.browser,
            os: clientInfo.os,
          };

          // Synchronously clear session auth so reopening shows logged out
          sessionStorage.removeItem('DOKANPRO_IS_LOGGED_IN');
          sessionStorage.removeItem('DOKANPRO_CURRENT_USER');

          // Synchronously save exit logout to localStorage
          try {
            const rawLogs = localStorage.getItem('DOKANPRO_activityLogs');
            const existingLogs: ActivityLog[] = rawLogs ? JSON.parse(rawLogs) : [];
            const updated = [exitLog, ...existingLogs.filter(l => l.id !== exitLog.id)];
            localStorage.setItem('DOKANPRO_activityLogs', JSON.stringify(updated));
          } catch {}
        }
      } catch {}
    };

    // window.addEventListener('pagehide', handleSiteExit);
    // window.addEventListener('beforeunload', handleSiteExit);

    return () => {
      // window.removeEventListener('pagehide', handleSiteExit);
      // window.removeEventListener('beforeunload', handleSiteExit);
    };
  }, [currentUser, language]);

  const logActivity = (logData: Omit<ActivityLog, 'id' | 'timestamp' | 'userId' | 'userName' | 'role'>) => {
    const now = new Date();
    const formattedTime = formatDeletionTimestamp(now);
    const clientInfo = getCachedClientDeviceInfo();
    const newLog: ActivityLog = {
      ...logData,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formattedTime,
      userId: currentUser?.id || 'usr-1',
      userName: currentUser?.fullName || 'Mohammad Shafiul Islam',
      role: currentUser?.role || 'ADMIN',
      ip: logData.ip || clientInfo.ip,
      location: logData.location || clientInfo.location,
      device: logData.device || clientInfo.device,
      browser: logData.browser || clientInfo.browser,
      os: logData.os || clientInfo.os,
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  const logout = () => {
    const clientInfo = getCachedClientDeviceInfo();
    const logoutLog: ActivityLog = {
      id: `act-logout-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formatDeletionTimestamp(new Date()),
      actionType: 'LOGOUT',
      title: language === 'bn' ? 'লগআউট (User Logout)' : 'User Logout',
      description: language === 'bn'
        ? `ইউজার '${currentUser?.fullName || 'User'}' সফলভাবে লগআউট করেছেন।`
        : `User '${currentUser?.fullName || 'User'}' logged out from the system.`,
      severity: 'info',
      userId: currentUser?.id,
      userName: currentUser?.fullName,
      role: currentUser?.role,
      ip: clientInfo.ip,
      location: clientInfo.location,
      device: clientInfo.device,
      browser: clientInfo.browser,
      os: clientInfo.os,
    };
    setActivityLogs(prev => [logoutLog, ...prev]);

    try {
      sessionStorage.removeItem('DOKANPRO_IS_LOGGED_IN');
      sessionStorage.removeItem('DOKANPRO_CURRENT_USER');
      localStorage.setItem('DOKANPRO_HAS_UNSYNCED_CHANGES', 'false');
      hasUnsyncedChangesRef.current = false;
    } catch {}
    setIsLoggedIn(false);
    showToast(language === 'bn' ? 'সফলভাবে লগআউট করা হয়েছে।' : 'Logged out successfully.', 'success');
  };

  const login = (username: string, password?: string): boolean => {
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (found) {
      if (!found.isActive) {
        showToast(language === 'bn' ? 'এই ইউজার অ্যাকাউন্ট নিষ্ক্রিয় রয়েছে।' : 'This user account is inactive.', 'error');
        return false;
      }
      // Strict password verification on login
      if (found.password) {
        if (!password || found.password.trim() !== password.trim()) {
          showToast(language === 'bn' ? 'ভুল পাসওয়ার্ড!' : 'Incorrect password!', 'error');
          return false;
        }
      }
      setCurrentUser(found);
      setIsLoggedIn(true);
      try {
        sessionStorage.setItem('DOKANPRO_IS_LOGGED_IN', 'true');
        sessionStorage.setItem('DOKANPRO_CURRENT_USER', JSON.stringify(found));
      } catch {}
      if (!isTabAllowed(found, activeTab)) {
        setActiveTab(getFirstAllowedTab(found));
      }

      // Record Activity Log with IP, Location & Device
      const clientInfo = getCachedClientDeviceInfo();
      const loginLog: ActivityLog = {
        id: `act-login-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: formatDeletionTimestamp(new Date()),
        actionType: 'LOGIN',
        title: language === 'bn' ? 'সফল লগইন (User Login)' : 'User Login Successful',
        description: language === 'bn'
          ? `ইউজার '${found.fullName}' (${found.username}) সফলভাবে সিস্টেমে লগইন করেছেন। আইপি: ${clientInfo.ip}, লোকেশন: ${clientInfo.location}, ডিভাইস: ${clientInfo.device}`
          : `User '${found.fullName}' (${found.username}) successfully logged in. IP: ${clientInfo.ip}, Location: ${clientInfo.location}, Device: ${clientInfo.device}`,
        severity: 'info',
        userId: found.id,
        userName: found.fullName,
        role: found.role,
        targetId: found.id,
        targetName: found.fullName,
        ip: clientInfo.ip,
        location: clientInfo.location,
        device: clientInfo.device,
        browser: clientInfo.browser,
        os: clientInfo.os,
      };
      setActivityLogs(prev => [loginLog, ...prev]);

      showToast(language === 'bn' ? `স্বাগতম, ${found.fullName}!` : `Welcome back, ${found.fullName}!`, 'success');
      return true;
    }
    showToast(language === 'bn' ? 'ইউজার পাওয়া যায়নি।' : 'User not found.', 'error');
    return false;
  };

  const switchUser = (targetUserId: string, password?: string): boolean => {
    const targetUser = users.find(
      u => u.id === targetUserId || u.username.toLowerCase() === targetUserId.toLowerCase()
    );
    if (!targetUser) {
      showToast(language === 'bn' ? 'ইউজার পাওয়া যায়নি।' : 'User not found.', 'error');
      return false;
    }
    if (!targetUser.isActive) {
      showToast(language === 'bn' ? 'এই ইউজার অ্যাকাউন্ট নিষ্ক্রিয় রয়েছে।' : 'This user account is inactive.', 'error');
      return false;
    }

    // 1. If currently logged in user is ADMIN:
    // Admin can freely switch to ANY user without password or ID prompt
    if (currentUser.role === 'ADMIN') {
      setCurrentUser(targetUser);
      setIsLoggedIn(true);
      try {
        sessionStorage.setItem('DOKANPRO_IS_LOGGED_IN', 'true');
        sessionStorage.setItem('DOKANPRO_CURRENT_USER', JSON.stringify(targetUser));
      } catch {}
      if (!isTabAllowed(targetUser, activeTab)) {
        setActiveTab(getFirstAllowedTab(targetUser));
      }

      const clientInfo = getCachedClientDeviceInfo();
      const switchLog: ActivityLog = {
        id: `act-switch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: formatDeletionTimestamp(new Date()),
        actionType: 'USER_ACTION',
        title: language === 'bn' ? 'ইউজার পরিবর্তন (User Switch)' : 'User Switched',
        description: language === 'bn'
          ? `'${currentUser.fullName}' হতে '${targetUser.fullName}' ইউজারে সুইচ করা হয়েছে। আইপি: ${clientInfo.ip}, লোকেশন: ${clientInfo.location}, ডিভাইস: ${clientInfo.device}`
          : `Switched user from '${currentUser.fullName}' to '${targetUser.fullName}'. IP: ${clientInfo.ip}, Location: ${clientInfo.location}, Device: ${clientInfo.device}`,
        severity: 'info',
        userId: targetUser.id,
        userName: targetUser.fullName,
        role: targetUser.role,
        targetId: targetUser.id,
        targetName: targetUser.fullName,
        ip: clientInfo.ip,
        location: clientInfo.location,
        device: clientInfo.device,
        browser: clientInfo.browser,
        os: clientInfo.os,
      };
      setActivityLogs(prev => [switchLog, ...prev]);

      showToast(
        language === 'bn'
          ? `এডমিন হিসেবে '${targetUser.fullName}' আইডিতে সরাসরি লগইন করা হয়েছে।`
          : `Switched to '${targetUser.fullName}' (Admin Privilege - No password needed).`,
        'success'
      );
      return true;
    }

    // 2. If currently logged in user is NOT ADMIN:
    // User CANNOT switch to any other user without valid credentials!
    if (targetUser.password) {
      if (!password || password.trim() !== targetUser.password.trim()) {
        showToast(
          language === 'bn'
            ? 'ভুল পাসওয়ার্ড! এডমিন ব্যতীত অন্য ইউজারে পরিবর্তন করতে সঠিক পাসওয়ার্ড আবশ্যক।'
            : 'Incorrect password! Password required to switch user.',
          'error'
        );
        return false;
      }
    }

    setCurrentUser(targetUser);
    setIsLoggedIn(true);
    try {
      sessionStorage.setItem('DOKANPRO_IS_LOGGED_IN', 'true');
      sessionStorage.setItem('DOKANPRO_CURRENT_USER', JSON.stringify(targetUser));
    } catch {}
    if (!isTabAllowed(targetUser, activeTab)) {
      setActiveTab(getFirstAllowedTab(targetUser));
    }

    const clientInfo = getCachedClientDeviceInfo();
    const switchLog: ActivityLog = {
      id: `act-switch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formatDeletionTimestamp(new Date()),
      actionType: 'USER_ACTION',
      title: language === 'bn' ? 'ইউজার পরিবর্তন (User Switch)' : 'User Switched',
      description: language === 'bn'
        ? `'${currentUser.fullName}' হতে '${targetUser.fullName}' ইউজারে সুইচ করা হয়েছে। আইপি: ${clientInfo.ip}, লোকেশন: ${clientInfo.location}, ডিভাইস: ${clientInfo.device}`
        : `Switched user from '${currentUser.fullName}' to '${targetUser.fullName}'. IP: ${clientInfo.ip}, Location: ${clientInfo.location}, Device: ${clientInfo.device}`,
      severity: 'info',
      userId: targetUser.id,
      userName: targetUser.fullName,
      role: targetUser.role,
      targetId: targetUser.id,
      targetName: targetUser.fullName,
      ip: clientInfo.ip,
      location: clientInfo.location,
      device: clientInfo.device,
      browser: clientInfo.browser,
      os: clientInfo.os,
    };
    setActivityLogs(prev => [switchLog, ...prev]);

    showToast(
      language === 'bn'
        ? `সফলভাবে '${targetUser.fullName}' হিসেবে লগইন করা হয়েছে।`
        : `Switched to '${targetUser.fullName}'.`,
      'success'
    );
    return true;
  };

  // Save changes to local storage
  useEffect(() => {
    try {
      const payload = {
        companySettings,
        products,
        deletedProductIds,
        deletedEntityIds,
        categories,
        parties,
        wallets,
        saleInvoices,
        deletedSaleInvoices,
        saleReturns,
        purchaseInvoices,
        deletedPurchaseInvoices,
        purchaseReturns,
        purchaseOrders,
        quotations,
        salesOrders,
        expiredReturnLogs,
        installmentSchemes,
        employees,
        advanceSalaries,
        payrollHistory,
        expenseCategories,
        expenseVouchers,
        dayBookEntries,
        cashAdjustments,
        activityLogs,
        users,
        smsConfig,
        smsLogs,
        warrantyPolicies,
        warrantyRecords,
        warrantyClaims,
        diseaseMaster,
        diseaseCategories,
        language,
        theme,
        lastUpdatedEpoch: Date.now(),
      };

      try {
        localStorage.setItem('DOKANPRO_PRODUCTS_BACKUP', JSON.stringify(products));
      } catch {}

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      } catch (quotaErr) {
        // Quota exceeded protection: trim bulky logs and retry saving
        const trimmedPayload = {
          ...payload,
          activityLogs: activityLogs.slice(0, 40),
          smsLogs: smsLogs.slice(0, 40),
          deletedSaleInvoices: deletedSaleInvoices.slice(0, 40),
          deletedPurchaseInvoices: deletedPurchaseInvoices.slice(0, 40),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmedPayload));
      }

      localStorage.setItem('companySettings', JSON.stringify(companySettings));
      localStorage.setItem('dokanpro_disease_master', JSON.stringify(diseaseMaster));
      localStorage.setItem('dokanpro_disease_categories', JSON.stringify(diseaseCategories));
      localStorage.setItem('DOKANPRO_LAST_LOCAL_UPDATE_EPOCH', String(Date.now()));
      localHasRecordsRef.current =
        products.length > 0 ||
        saleInvoices.length > 0 ||
        purchaseInvoices.length > 0 ||
        parties.length > 0 ||
        expenseVouchers.length > 0 ||
        salesOrders.length > 0 ||
        dayBookEntries.length > 0;

      // If this change was NOT from a server pull, and it's not the initial mount, mark as unsynced
      if (isMountedRef.current && !isIncomingSyncRef.current) {
        if (!hasUnsyncedChangesRef.current) {
          hasUnsyncedChangesRef.current = true;
          localStorage.setItem('DOKANPRO_HAS_UNSYNCED_CHANGES', 'true');
        }
      }
      isMountedRef.current = true;
    } catch (e) {
      console.warn('Failed to save to local storage', e);
      try {
        localStorage.setItem('companySettings', JSON.stringify(companySettings));
        localStorage.setItem('DOKANPRO_PRODUCTS_BACKUP', JSON.stringify(products));
      } catch {}
    }
  }, [
    companySettings,
    products,
    deletedProductIds,
    deletedEntityIds,
    categories,
    parties,
    wallets,
    saleInvoices,
    deletedSaleInvoices,
    saleReturns,
    purchaseInvoices,
    deletedPurchaseInvoices,
    purchaseReturns,
    purchaseOrders,
    quotations,
    salesOrders,
    expiredReturnLogs,
    installmentSchemes,
    employees,
    advanceSalaries,
    payrollHistory,
    expenseCategories,
    expenseVouchers,
    dayBookEntries,
    cashAdjustments,
    activityLogs,
    users,
    smsConfig,
    smsLogs,
    warrantyPolicies,
    warrantyRecords,
    warrantyClaims,
    diseaseMaster,
    diseaseCategories,
    language,
    theme,
  ]);

  // Reconcile stale Cash In Hand balance if invoices/returns were deleted leaving zero cash-in ledger sources
  const hasReconciledOrphanCashRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasReconciledOrphanCashRef.current) return;
    hasReconciledOrphanCashRef.current = true;
    const hasPositiveBalance = wallets.some(w => Number(w.balance || 0) > 0);
    if (
      hasPositiveBalance &&
      hasOnlyZeroCashInSources({
        deletedEntityIds: deletedEntityIdsRef.current,
        deletedSaleInvoices,
        saleInvoices,
        cashAdjustments,
        installmentSchemes,
        purchaseReturns,
        dayBookEntries,
      })
    ) {
      lastPushTimeRef.current = Date.now();
      hasUnsyncedChangesRef.current = true;
      setWallets(prev => prev.map(w => ({ ...w, balance: 0 })));
    }
  }, []);

  // Apply dark mode class to HTML root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // -------------------------------------------------------------
  // Cloud & Multi-Device Auto-Sync Implementation
  // -------------------------------------------------------------
  const [isSyncingWithServer, setIsSyncingWithServer] = useState(false);
  const lastPushTimeRef = useRef<number>(0);
  const lastServerUpdatedEpochRef = useRef<number>(
    (() => {
      try {
        const savedEpoch = localStorage.getItem('DOKANPRO_LAST_LOCAL_UPDATE_EPOCH');
        if (savedEpoch) return Number(savedEpoch) || 0;
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.lastUpdatedEpoch) return Number(parsed.lastUpdatedEpoch) || 0;
        }
      } catch {}
      return 0;
    })()
  );
  const isMountedRef = useRef<boolean>(false);
  const isPullingRef = useRef<boolean>(false);
  const isIncomingSyncRef = useRef<boolean>(false);
  const hasCompletedInitialServerSyncRef = useRef<boolean>(false);
  const localHasRecordsRef = useRef<boolean>(
    products.length > 0 ||
      saleInvoices.length > 0 ||
      purchaseInvoices.length > 0 ||
      parties.length > 0 ||
      expenseVouchers.length > 0 ||
      salesOrders.length > 0 ||
      dayBookEntries.length > 0
  );
  const hasUnsyncedChangesRef = useRef<boolean>(
    (() => {
      try {
        return localStorage.getItem('DOKANPRO_HAS_UNSYNCED_CHANGES') === 'true';
      } catch {
        return false;
      }
    })()
  );
  const [lastServerSyncTime, setLastServerSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('DOKANPRO_LAST_SYNC_TIME');
    } catch {
      return null;
    }
  });
  const [serverSyncStatus, setServerSyncStatus] = useState<{ success: boolean; message: string; timestamp?: string } | null>(null);

  const autoSyncIntervalSeconds = companySettings.autoSyncIntervalSeconds || 30;
  const isAutoSyncEnabled = companySettings.autoSyncEnabled !== false;
  const [syncCountdown, setSyncCountdown] = useState<number>(autoSyncIntervalSeconds);

  const setAutoSyncIntervalSeconds = (seconds: number) => {
    setCompanySettings(prev => ({
      ...prev,
      autoSyncIntervalSeconds: seconds,
    }));
    setSyncCountdown(seconds);
  };

  const setIsAutoSyncEnabled = (enabled: boolean) => {
    setCompanySettings(prev => ({
      ...prev,
      autoSyncEnabled: enabled,
    }));
  };

  // Helper to determine active endpoint
  const getActiveApiEndpoint = (overrideUrl?: string): string => {
    if (overrideUrl && overrideUrl.trim()) return overrideUrl.trim();
    if (companySettings.apiEndpoint && companySettings.apiEndpoint.trim()) {
      return companySettings.apiEndpoint.trim();
    }
    try {
      const saved = localStorage.getItem('DOKANPRO_ERP_API_ENDPOINT');
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      const pathname = window.location.pathname;
      const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
      const cleanDir = dir.endsWith('/') ? dir : `${dir}/`;
      return `${window.location.origin}${cleanDir}api.php`;
    }
    return 'api.php';
  };

  // Reload local state from localStorage for multi-tab sync
  const reloadFromLocalStorage = () => {
    try {
      try {
        const prodBackup = localStorage.getItem('DOKANPRO_PRODUCTS_BACKUP');
        if (prodBackup) {
          const parsedProds = JSON.parse(prodBackup);
          if (Array.isArray(parsedProds) && parsedProds.length > 0) {
            setProducts(parsedProds);
          }
        }
      } catch {}

      // Check dedicated companySettings first
      try {
        const standaloneSettings = localStorage.getItem('companySettings');
        if (standaloneSettings) {
          const parsedSettings = JSON.parse(standaloneSettings);
          if (parsedSettings) setCompanySettings(parsedSettings);
        }
      } catch {}

      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data) {
        if (data.companySettings && !localStorage.getItem('companySettings')) setCompanySettings(data.companySettings);
        if (Array.isArray(data.products) && data.products.length > 0) setProducts(data.products);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.parties)) setParties(data.parties);
        if (Array.isArray(data.wallets)) {
          const shouldZeroLocalWallets = hasOnlyZeroCashInSources({
            deletedEntityIds: data.deletedEntityIds || deletedEntityIdsRef.current,
            deletedSaleInvoices: Array.isArray(data.deletedSaleInvoices) ? data.deletedSaleInvoices : [],
            saleInvoices: Array.isArray(data.saleInvoices) ? data.saleInvoices : [],
            cashAdjustments: Array.isArray(data.cashAdjustments) ? data.cashAdjustments : [],
            installmentSchemes: Array.isArray(data.installmentSchemes) ? data.installmentSchemes : [],
            purchaseReturns: Array.isArray(data.purchaseReturns) ? data.purchaseReturns : [],
            dayBookEntries: Array.isArray(data.dayBookEntries) ? data.dayBookEntries : [],
          });
          setWallets(shouldZeroLocalWallets ? (data.wallets as Wallet[]).map(w => ({ ...w, balance: 0 })) : data.wallets);
        }
        if (Array.isArray(data.saleInvoices)) setSaleInvoices(data.saleInvoices);
        if (Array.isArray(data.deletedSaleInvoices)) setDeletedSaleInvoices(data.deletedSaleInvoices);
        if (Array.isArray(data.saleReturns)) setSaleReturns(data.saleReturns);
        if (Array.isArray(data.purchaseInvoices)) setPurchaseInvoices(data.purchaseInvoices);
        if (Array.isArray(data.deletedPurchaseInvoices)) setDeletedPurchaseInvoices(data.deletedPurchaseInvoices);
        if (Array.isArray(data.purchaseReturns)) setPurchaseReturns(data.purchaseReturns);
        if (Array.isArray(data.purchaseOrders)) setPurchaseOrders(data.purchaseOrders);
        if (Array.isArray(data.quotations)) setQuotations(data.quotations);
        if (Array.isArray(data.salesOrders)) setSalesOrders(data.salesOrders);
        if (Array.isArray(data.expiredReturnLogs)) setExpiredReturnLogs(data.expiredReturnLogs);
        if (Array.isArray(data.installmentSchemes)) setInstallmentSchemes(data.installmentSchemes);
        if (Array.isArray(data.employees)) setEmployees(data.employees);
        if (Array.isArray(data.advanceSalaries)) setAdvanceSalaries(data.advanceSalaries);
        if (Array.isArray(data.payrollHistory)) setPayrollHistory(data.payrollHistory);
        if (Array.isArray(data.expenseCategories)) setExpenseCategories(data.expenseCategories);
        if (Array.isArray(data.expenseVouchers)) setExpenseVouchers(data.expenseVouchers);
        if (Array.isArray(data.dayBookEntries)) {
          const parsedSales = Array.isArray(data.saleInvoices) ? data.saleInvoices : [];
          const parsedPurchases = Array.isArray(data.purchaseInvoices) ? data.purchaseInvoices : [];
          setDayBookEntries(dedupeTransactionDayBookEntries(data.dayBookEntries, parsedSales, parsedPurchases).cleaned);
        }
        if (Array.isArray(data.cashAdjustments)) setCashAdjustments(data.cashAdjustments);
        if (Array.isArray(data.activityLogs)) setActivityLogs(data.activityLogs);
        if (Array.isArray(data.users)) setUsers(data.users);
        if (Array.isArray(data.warrantyPolicies)) setWarrantyPolicies(data.warrantyPolicies);
        if (Array.isArray(data.warrantyRecords)) setWarrantyRecords(data.warrantyRecords);
        if (Array.isArray(data.warrantyClaims)) setWarrantyClaims(data.warrantyClaims);
        if (data.deletedEntityIds && typeof data.deletedEntityIds === 'object' && !Array.isArray(data.deletedEntityIds)) {
          deletedEntityIdsRef.current = data.deletedEntityIds;
          setDeletedEntityIds(data.deletedEntityIds);
        }
      }
    } catch {}
  };

  // -------------------------------------------------------------
  // Admin Separate SQL Deletion Archive & Tombstone Helpers
  // -------------------------------------------------------------
  const isAdminUser = (): boolean => currentUser?.role === 'ADMIN';

  const recordDeletedTombstones = (collectionKey: string, ids: (string | undefined | null)[]) => {
    const cleanIds = ids.map(v => (v ? String(v) : '')).filter(Boolean);
    if (cleanIds.length === 0) return;

    const currentMap = deletedEntityIdsRef.current || {};
    const existing = Array.isArray(currentMap[collectionKey]) ? currentMap[collectionKey] : [];
    const mergedList = Array.from(new Set([...existing, ...cleanIds]));
    const nextMap: Record<string, string[]> = { ...currentMap, [collectionKey]: mergedList };

    deletedEntityIdsRef.current = nextMap;
    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;
    try {
      localStorage.setItem('DOKANPRO_DELETED_ENTITY_IDS', JSON.stringify(nextMap));
      localStorage.setItem('DOKANPRO_HAS_UNSYNCED_CHANGES', 'true');
    } catch {}
    setDeletedEntityIds(nextMap);
  };

  const removeDeletedTombstones = (collectionKey: string, ids: (string | undefined | null)[]) => {
    const removeSet = new Set(ids.map(v => (v ? String(v) : '')).filter(Boolean));
    if (removeSet.size === 0) return;

    const currentMap = deletedEntityIdsRef.current || {};
    const existing = Array.isArray(currentMap[collectionKey]) ? currentMap[collectionKey] : [];
    const filtered = existing.filter(id => !removeSet.has(String(id)));
    const nextMap: Record<string, string[]> = { ...currentMap, [collectionKey]: filtered };

    deletedEntityIdsRef.current = nextMap;
    lastPushTimeRef.current = Date.now();
    try {
      localStorage.setItem('DOKANPRO_DELETED_ENTITY_IDS', JSON.stringify(nextMap));
    } catch {}
    setDeletedEntityIds(nextMap);
  };

  const archiveAdminDeletion = (
    items: Array<{
      entityType: string;
      sourceTable: string;
      recordId: string;
      referenceNo?: string;
      title: string;
      amount?: number;
      reason?: string;
      snapshot: any;
    }>
  ) => {
    if (!isAdminUser() || !Array.isArray(items) || items.length === 0) return;

    const nowDate = new Date();
    const formattedNow = formatDeletionTimestamp(nowDate);
    const isoNow = nowDate.toISOString();

    const records: AdminDeletedRecord[] = items.map((item, idx) => {
      let safeSnapshot: any = null;
      try {
        safeSnapshot = JSON.parse(JSON.stringify(item.snapshot ?? null));
      } catch {
        safeSnapshot = { id: item.recordId };
      }
      return {
        archiveId: `adm-del-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        entityType: item.entityType,
        sourceTable: item.sourceTable,
        recordId: String(item.recordId),
        referenceNo: item.referenceNo || '',
        title: item.title,
        amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : 0,
        deletedAt: formattedNow,
        deletedAtIso: isoNow,
        deletedById: currentUser?.id || 'usr-1',
        deletedByUsername: currentUser?.username || 'admin',
        deletedByName: currentUser?.fullName || 'Super Admin',
        deletedByRole: 'ADMIN',
        deletionReason: item.reason?.trim() || '',
        shopName: companySettings.name || 'DokanPro ERP',
        recordSnapshot: safeSnapshot,
      };
    });

    // 1. Silent offline fallback archive (never rendered anywhere inside the software UI)
    try {
      const raw = localStorage.getItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE');
      const existing: AdminDeletedRecord[] = raw ? JSON.parse(raw) : [];
      const byId = new Map<string, AdminDeletedRecord>();
      if (Array.isArray(existing)) {
        existing.forEach(r => {
          if (r && r.archiveId) byId.set(String(r.archiveId), r);
        });
      }
      records.forEach(r => byId.set(String(r.archiveId), r));
      localStorage.setItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE', JSON.stringify(Array.from(byId.values())));
    } catch {}

    // 2. Immediately persist to separate SQL file (admin_deleted_records.sql) on server
    const payloadStr = JSON.stringify({ records });
    const postTo = async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
          keepalive: true,
        });
        if (!res.ok) return false;
        const json = await res.json();
        return Boolean(json && json.success);
      } catch {
        return false;
      }
    };

    (async () => {
      const savedOnPrimary = await postTo('/api/admin-deleted-archive');
      const activeUrl = getActiveApiEndpoint();
      const customEndpoint = (companySettings.apiEndpoint || localStorage.getItem('DOKANPRO_ERP_API_ENDPOINT') || '').trim();
      const phpEndpoint = activeUrl
        ? (activeUrl.includes('?') ? `${activeUrl}&action=archive_admin_deleted` : `${activeUrl}?action=archive_admin_deleted`)
        : '';

      if (!savedOnPrimary && phpEndpoint) {
        await postTo(phpEndpoint);
      } else if (customEndpoint && !customEndpoint.startsWith('/api/')) {
        const customArchiveUrl = customEndpoint.includes('?')
          ? `${customEndpoint}&action=archive_admin_deleted`
          : `${customEndpoint}?action=archive_admin_deleted`;
        if (customArchiveUrl !== phpEndpoint || !savedOnPrimary) {
          await postTo(customArchiveUrl);
        }
      }
    })();
  };

  const getAdminRequestHeaders = (): Record<string, string> => ({
    'x-admin-id': currentUser?.id || '',
    'x-admin-username': currentUser?.username || '',
    'x-admin-role': currentUser?.role || '',
  });

  const fetchAdminDeletedArchive = async (): Promise<AdminDeletedRecord[]> => {
    if (!isAdminUser()) return [];

    let localRecords: AdminDeletedRecord[] = [];
    try {
      const raw = localStorage.getItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localRecords = parsed;
      }
    } catch {}

    const activeUrl = getActiveApiEndpoint();
    const candidateUrls = [
      '/api/admin-deleted-archive',
      ...(activeUrl
        ? [activeUrl.includes('?') ? `${activeUrl}&action=get_admin_deleted_archive` : `${activeUrl}?action=get_admin_deleted_archive`]
        : []),
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            ...getAdminRequestHeaders(),
          },
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.success && Array.isArray(json.records)) {
          const byId = new Map<string, AdminDeletedRecord>();
          localRecords.forEach(r => {
            if (r?.archiveId) byId.set(String(r.archiveId), r);
          });
          json.records.forEach((r: AdminDeletedRecord) => {
            if (r?.archiveId) byId.set(String(r.archiveId), r);
          });
          // Prefer server's authoritative list if server returned records or local was empty
          const resolved = json.records.length > 0 ? json.records : Array.from(byId.values());
          try {
            localStorage.setItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE', JSON.stringify(resolved));
          } catch {}
          return [...resolved].sort((a, b) =>
            String(b.deletedAtIso || '').localeCompare(String(a.deletedAtIso || ''))
          );
        }
      } catch {}
    }

    return [...localRecords].sort((a, b) =>
      String(b.deletedAtIso || '').localeCompare(String(a.deletedAtIso || ''))
    );
  };

  const removeAdminDeletedArchiveRecords = async (archiveIds: string[]): Promise<void> => {
    if (!isAdminUser() || !Array.isArray(archiveIds) || archiveIds.length === 0) return;
    const removeSet = new Set(archiveIds.map(String));

    try {
      const raw = localStorage.getItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (r: AdminDeletedRecord) => r?.archiveId && !removeSet.has(String(r.archiveId))
          );
          localStorage.setItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE', JSON.stringify(remaining));
        }
      }
    } catch {}

    const payload = JSON.stringify({ archiveIds });
    const postRemove = async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAdminRequestHeaders(),
          },
          body: payload,
        });
        if (!res.ok) return false;
        const json = await res.json();
        return Boolean(json && json.success);
      } catch {
        return false;
      }
    };

    const okPrimary = await postRemove('/api/admin-deleted-archive/remove');
    if (!okPrimary) {
      const activeUrl = getActiveApiEndpoint();
      if (activeUrl) {
        const phpUrl = activeUrl.includes('?')
          ? `${activeUrl}&action=remove_admin_deleted_archive`
          : `${activeUrl}?action=remove_admin_deleted_archive`;
        await postRemove(phpUrl);
      }
    }
  };

  const downloadAdminDeletedSqlFile = async (): Promise<void> => {
    if (!isAdminUser()) {
      showToast(
        language === 'bn'
          ? 'অনুমতি নেই! শুধুমাত্র অ্যাডমিন আলাদা ডিলিট SQL ফাইল ডাউনলোড করতে পারবেন।'
          : 'Access denied! Only Admin users can download the separate deleted SQL archive.',
        'error'
      );
      return;
    }

    const activeUrl = getActiveApiEndpoint();
    const candidateUrls = [
      '/api/download-admin-deleted-sql',
      ...(activeUrl
        ? [activeUrl.includes('?') ? `${activeUrl}&action=download_admin_deleted_sql` : `${activeUrl}?action=download_admin_deleted_sql`]
        : []),
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            ...getAdminRequestHeaders(),
          },
        });
        if (!res.ok) continue;
        const text = await res.text();
        if (text && !text.trim().startsWith('<') && text.includes('admin_deleted_records')) {
          downloadSqlFile(text, 'admin_deleted_records.sql');
          showToast(
            language === 'bn'
              ? 'আলাদা অ্যাডমিন ডিলিট SQL ফাইল (admin_deleted_records.sql) সফলভাবে ডাউনলোড হয়েছে!'
              : 'Separate Admin Deleted SQL file (admin_deleted_records.sql) downloaded successfully!',
            'success'
          );
          return;
        }
      } catch {}
    }

    // Offline fallback: generate valid SQL dump directly from silent local backup
    let localRecords: AdminDeletedRecord[] = [];
    try {
      const raw = localStorage.getItem('DOKANPRO_ADMIN_DELETED_SQL_ARCHIVE');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localRecords = parsed;
      }
    } catch {}

    const sqlDump = generateAdminDeletedSqlDump(localRecords, companySettings.name || 'DokanPro ERP');
    downloadSqlFile(sqlDump, 'admin_deleted_records.sql');
    showToast(
      language === 'bn'
        ? 'আলাদা অ্যাডমিন ডিলিট SQL ফাইল (admin_deleted_records.sql) সফলভাবে ডাউনলোড হয়েছে!'
        : 'Separate Admin Deleted SQL file (admin_deleted_records.sql) downloaded successfully!',
      'success'
    );
  };

  // Push full ERP state to API endpoint
  const triggerServerPush = async (customUrl?: string, silent = false): Promise<boolean> => {
    const targetUrl = getActiveApiEndpoint(customUrl);
    if (!targetUrl) return false;

    if (!silent) {
      setIsSyncingWithServer(true);
    }
    const pushTimestamp = Date.now();
    lastPushTimeRef.current = pushTimestamp;

    try {
      const fullState = {
        companySettings,
        products: productsRef.current,
        deletedProductIds,
        deletedEntityIds: deletedEntityIdsRef.current,
        categories,
        parties,
        wallets,
        saleInvoices,
        deletedSaleInvoices,
        saleReturns,
        purchaseInvoices,
        deletedPurchaseInvoices,
        purchaseReturns,
        purchaseOrders,
        quotations,
        salesOrders,
        expiredReturnLogs,
        installmentSchemes,
        employees,
        advanceSalaries,
        payrollHistory,
        expenseCategories,
        expenseVouchers,
        dayBookEntries,
        cashAdjustments,
        activityLogs,
        users,
        smsConfig,
        smsLogs,
        warrantyPolicies,
        warrantyRecords,
        warrantyClaims,
        diseaseMaster,
        diseaseCategories,
        language,
        theme,
        is_reset_wipe: false,
        lastUpdatedEpoch: pushTimestamp,
      };

      const endpoint = targetUrl.includes('?') ? `${targetUrl}&action=sync_all` : `${targetUrl}?action=sync_all`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullState),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (json && json.success) {
        lastServerUpdatedEpochRef.current = pushTimestamp;
        hasUnsyncedChangesRef.current = false;
        try {
          localStorage.setItem('DOKANPRO_HAS_UNSYNCED_CHANGES', 'false');
        } catch {}
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSyncTime(now);
        try {
          localStorage.setItem('DOKANPRO_LAST_SYNC_TIME', now);
        } catch {}
        if (!silent) {
          setServerSyncStatus({
            success: true,
            message: language === 'bn' ? 'হোস্ティング সার্ভারে সমস্ত ডাটা সফলভাবে সিঙ্ক ও সেভ হয়েছে।' : 'All ERP data synced to cloud successfully.',
            timestamp: now,
          });
        }

        // Broadcast to other open tabs on same device
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('DOKANPRO_CROSS_TAB_CHANNEL');
            bc.postMessage({ type: 'STATE_UPDATED', timestamp: Date.now() });
            bc.close();
          }
        } catch {}

        return true;
      } else {
        if (!silent) {
          setServerSyncStatus({
            success: false,
            message: json?.message || 'Push sync failed',
          });
        }
        return false;
      }
    } catch (err: any) {
      if (!silent) {
        setServerSyncStatus({
          success: false,
          message: err?.message || 'Server connection error during sync',
        });
      }
      return false;
    } finally {
      if (!silent) {
        setIsSyncingWithServer(false);
      }
    }
  };

  // Pull latest snapshot from server to sync all devices in real-time
  const triggerServerPull = async (customUrl?: string, quiet = false): Promise<boolean> => {
    const targetUrl = getActiveApiEndpoint(customUrl);
    if (!targetUrl) return false;

    // Prevent overlapping pull calls
    if (isPullingRef.current) return false;

    // Safety guard: if local device made an entry/edit or pushed within the last 4.5s, or has unsynced edits during a quiet pull, don't overwrite with older server data
    if (Date.now() - lastPushTimeRef.current < 4500 || (hasUnsyncedChangesRef.current && quiet)) {
      return false;
    }

    isPullingRef.current = true;
    if (!quiet) {
      setIsSyncingWithServer(true);
    }

    try {
      const endpoint = targetUrl.includes('?') ? `${targetUrl}&action=sync_all` : `${targetUrl}?action=sync_all`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();

      if (json && (json.products || json.saleInvoices || json.companySettings || json.data)) {
        isIncomingSyncRef.current = true;
        const data = json.data ? json.data : json;
        const serverEpoch = Number(data.lastUpdatedEpoch) || 0;

        // Compare if incoming data has meaningful changes / new entries
        let hasNewIncomingEntries = false;
        if (
          (Array.isArray(data.saleInvoices) && data.saleInvoices.length !== saleInvoices.length) ||
          (Array.isArray(data.products) && data.products.length !== products.length) ||
          (Array.isArray(data.parties) && data.parties.length !== parties.length) ||
          (Array.isArray(data.purchaseInvoices) && data.purchaseInvoices.length !== purchaseInvoices.length) ||
          (Array.isArray(data.expenseVouchers) && data.expenseVouchers.length !== expenseVouchers.length) ||
          (Array.isArray(data.salesOrders) && data.salesOrders.length !== salesOrders.length) ||
          (Array.isArray(data.dayBookEntries) && data.dayBookEntries.length !== dayBookEntries.length)
        ) {
          hasNewIncomingEntries = true;
        }

        const serverHasRecords =
          (Array.isArray(data.products) && data.products.length > 0) ||
          (Array.isArray(data.saleInvoices) && data.saleInvoices.length > 0) ||
          (Array.isArray(data.purchaseInvoices) && data.purchaseInvoices.length > 0) ||
          (Array.isArray(data.parties) && data.parties.length > 0) ||
          (Array.isArray(data.expenseVouchers) && data.expenseVouchers.length > 0) ||
          (Array.isArray(data.salesOrders) && data.salesOrders.length > 0) ||
          (Array.isArray(data.dayBookEntries) && data.dayBookEntries.length > 0);

        // Anti-Wipe Guard: If server returns an empty non-reset snapshot while local storage has real records
        // (e.g., after a deployment where server files were re-uploaded), preserve local data and restore server!
        if (!data.is_reset_wipe && !serverHasRecords && localHasRecordsRef.current) {
          hasCompletedInitialServerSyncRef.current = true;
          isIncomingSyncRef.current = false;
          triggerServerPush(targetUrl, true);
          return true;
        }

        if (serverEpoch > 0 && serverEpoch <= lastServerUpdatedEpochRef.current && !hasNewIncomingEntries && quiet) {
          // Already have the latest or newer version
          hasCompletedInitialServerSyncRef.current = true;
          isIncomingSyncRef.current = false;
          return true;
        }

        // Smart multi-device merge logic:
        // Never overwrite existing local business records unless it is an intentional factory reset wipe.
        const shouldMerge = hasUnsyncedChangesRef.current || hasCompletedInitialServerSyncRef.current || localHasRecordsRef.current;

        // Safe merge for companySettings: never allow name, phone, address to be wiped
        if (data.companySettings) {
          setCompanySettings(prev => {
            const raw = data.companySettings;
            const resolvedName = raw.name || raw.companyName || prev.name || initialCompanySettings.name;
            const merged: CompanySettings = {
              ...initialCompanySettings,
              ...prev,
              ...raw,
              name: resolvedName,
              phone: raw.phone || prev.phone || initialCompanySettings.phone || '',
              address: raw.address || prev.address || initialCompanySettings.address || '',
              email: raw.email || prev.email || initialCompanySettings.email || '',
            };
            try {
              localStorage.setItem('companySettings', JSON.stringify(merged));
              if (merged.apiEndpoint) {
                localStorage.setItem('DOKANPRO_ERP_API_ENDPOINT', merged.apiEndpoint);
              }
            } catch {}
            return merged;
          });
        }

        const mergedDeletedEntityMap: Record<string, string[]> = {};
        const localDeletedMap = deletedEntityIdsRef.current || {};
        const serverDeletedMap =
          data.deletedEntityIds && typeof data.deletedEntityIds === 'object' && !Array.isArray(data.deletedEntityIds)
            ? data.deletedEntityIds
            : {};
        const allTombstoneKeys = new Set<string>([...Object.keys(localDeletedMap), ...Object.keys(serverDeletedMap)]);
        allTombstoneKeys.forEach(k => {
          const lArr = Array.isArray(localDeletedMap[k]) ? localDeletedMap[k] : [];
          const sArr = Array.isArray(serverDeletedMap[k]) ? serverDeletedMap[k] : [];
          mergedDeletedEntityMap[k] = Array.from(new Set([...lArr.map(String), ...sArr.map(String)].filter(Boolean)));
        });

        const getTombstoneSet = (key: string) => new Set<string>(mergedDeletedEntityMap[key] || []);

        const allDeletedSaleIds = new Set<string>([
          ...deletedSaleInvoices.map(d => String(d.id || d.originalInvoiceId || '')),
          ...((data.deletedSaleInvoices || []).map((d: any) => String(d.id || d.originalInvoiceId || ''))),
          ...(mergedDeletedEntityMap.saleInvoices || []),
        ].filter(Boolean));

        const allDeletedPurchaseIds = new Set<string>([
          ...deletedPurchaseInvoices.map(d => String(d.id || d.originalPurchaseId || d.billNumber || '')),
          ...((data.deletedPurchaseInvoices || []).map((d: any) => String(d.id || d.originalPurchaseId || d.billNumber || ''))),
          ...(mergedDeletedEntityMap.purchaseInvoices || []),
        ].filter(Boolean));

        const allDeletedProductIds = new Set<string>([
          ...deletedProductIds.map(String),
          ...((data.deletedProductIds || []).map((d: any) => String(d))),
          ...(mergedDeletedEntityMap.products || []),
        ].filter(Boolean));
        
        // If server sent a reset / wipe snapshot, directly set clean empty states
        if (data.is_reset_wipe) {
          setProducts(Array.isArray(data.products) ? data.products : []);
          setDeletedProductIds([]);
          deletedEntityIdsRef.current = {};
          setDeletedEntityIds({});
          try {
            localStorage.removeItem('DOKANPRO_DELETED_ENTITY_IDS');
          } catch {}
          setCategories(Array.isArray(data.categories) ? data.categories : []);
          setParties(Array.isArray(data.parties) ? data.parties : []);
          setWallets(Array.isArray(data.wallets) ? data.wallets : initialWallets);
          setSaleInvoices(Array.isArray(data.saleInvoices) ? data.saleInvoices : []);
          setDeletedSaleInvoices([]);
          setSaleReturns(Array.isArray(data.saleReturns) ? data.saleReturns : []);
          setPurchaseInvoices(Array.isArray(data.purchaseInvoices) ? data.purchaseInvoices : []);
          setDeletedPurchaseInvoices([]);
          setPurchaseReturns(Array.isArray(data.purchaseReturns) ? data.purchaseReturns : []);
          setPurchaseOrders(Array.isArray(data.purchaseOrders) ? data.purchaseOrders : []);
          setQuotations(Array.isArray(data.quotations) ? data.quotations : []);
          setSalesOrders(Array.isArray(data.salesOrders) ? data.salesOrders : []);
          setExpiredReturnLogs(Array.isArray(data.expiredReturnLogs) ? data.expiredReturnLogs : []);
          setInstallmentSchemes(Array.isArray(data.installmentSchemes) ? data.installmentSchemes : []);
          setEmployees(Array.isArray(data.employees) ? data.employees : []);
          setAdvanceSalaries(Array.isArray(data.advanceSalaries) ? data.advanceSalaries : []);
          setPayrollHistory(Array.isArray(data.payrollHistory) ? data.payrollHistory : []);
          setExpenseCategories(Array.isArray(data.expenseCategories) ? data.expenseCategories : initialExpenseCategories);
          setExpenseVouchers(Array.isArray(data.expenseVouchers) ? data.expenseVouchers : []);
          setDayBookEntries(
            Array.isArray(data.dayBookEntries)
              ? dedupeTransactionDayBookEntries(
                  data.dayBookEntries,
                  Array.isArray(data.saleInvoices) ? data.saleInvoices : [],
                  Array.isArray(data.purchaseInvoices) ? data.purchaseInvoices : []
                ).cleaned
              : []
          );
          setCashAdjustments(Array.isArray(data.cashAdjustments) ? data.cashAdjustments : []);
          setActivityLogs(Array.isArray(data.activityLogs) ? data.activityLogs : []);
          setUsers(Array.isArray(data.users) && data.users.length > 0 ? data.users : initialUsers);
          setSmsLogs(Array.isArray(data.smsLogs) ? data.smsLogs : []);
          setWarrantyPolicies(Array.isArray(data.warrantyPolicies) ? data.warrantyPolicies : initialWarrantyPolicies);
          setWarrantyRecords(Array.isArray(data.warrantyRecords) ? data.warrantyRecords : []);
          setWarrantyClaims(Array.isArray(data.warrantyClaims) ? data.warrantyClaims : []);
        } else {
          // Persist merged tombstones so Admin deletions never reappear across reloads or devices
          deletedEntityIdsRef.current = mergedDeletedEntityMap;
          setDeletedEntityIds(mergedDeletedEntityMap);
          try {
            localStorage.setItem('DOKANPRO_DELETED_ENTITY_IDS', JSON.stringify(mergedDeletedEntityMap));
          } catch {}

          const filterByTombstone = <T extends { id?: string | number }>(arr: T[], key: string): T[] => {
            const set = getTombstoneSet(key);
            if (set.size === 0) return arr;
            return arr.filter(item => item && !set.has(String(item.id)));
          };

          // Smart multi-device union merge: never overwrite or wipe local unsynced entries, and honor tombstones
          if (Array.isArray(data.products)) {
            setProducts(prev => {
              const merged = shouldMerge ? mergeEntitiesById(prev, data.products) : data.products;
              return (merged as Product[]).filter(p => p && !allDeletedProductIds.has(String(p.id)));
            });
          }
          if (Array.isArray(data.categories)) {
            setCategories(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.categories) : data.categories, 'categories'));
          }
          if (Array.isArray(data.parties)) {
            setParties(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.parties) : data.parties, 'parties'));
          }
          if (Array.isArray(data.wallets) && data.wallets.length > 0) {
            const shouldZeroPulledWallets = hasOnlyZeroCashInSources({
              deletedEntityIds: mergedDeletedEntityMap,
              deletedSaleInvoices: Array.isArray(data.deletedSaleInvoices) ? data.deletedSaleInvoices : deletedSaleInvoices,
              saleInvoices: Array.isArray(data.saleInvoices) ? data.saleInvoices : saleInvoices,
              cashAdjustments: Array.isArray(data.cashAdjustments) ? data.cashAdjustments : cashAdjustments,
              installmentSchemes: Array.isArray(data.installmentSchemes) ? data.installmentSchemes : installmentSchemes,
              purchaseReturns: Array.isArray(data.purchaseReturns) ? data.purchaseReturns : purchaseReturns,
              dayBookEntries: Array.isArray(data.dayBookEntries) ? data.dayBookEntries : dayBookEntries,
            });
            setWallets(prev => {
              const mergedW = filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.wallets) : data.wallets, 'wallets');
              return shouldZeroPulledWallets ? mergedW.map(w => ({ ...w, balance: 0 })) : mergedW;
            });
          }
          const mergedSalesList: SaleInvoice[] = Array.isArray(data.saleInvoices)
            ? dedupeById(
                (shouldMerge ? mergeEntitiesById(saleInvoices, data.saleInvoices) : data.saleInvoices) as SaleInvoice[]
              ).filter(
                inv => !allDeletedSaleIds.has(String(inv.id)) && (!inv.invoiceNumber || !allDeletedSaleIds.has(String(inv.invoiceNumber)))
              )
            : saleInvoices;

          if (Array.isArray(data.saleInvoices)) {
            setSaleInvoices(prev => {
              const merged = shouldMerge ? mergeEntitiesById(prev, data.saleInvoices) : data.saleInvoices;
              return dedupeById(merged as SaleInvoice[]).filter(
                inv => !allDeletedSaleIds.has(String(inv.id)) && (!inv.invoiceNumber || !allDeletedSaleIds.has(String(inv.invoiceNumber)))
              );
            });
          }
          if (Array.isArray(data.deletedSaleInvoices)) {
            setDeletedSaleInvoices(prev =>
              filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.deletedSaleInvoices) : data.deletedSaleInvoices, 'deletedSaleInvoices')
            );
          }
          if (Array.isArray(data.saleReturns)) {
            setSaleReturns(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.saleReturns) : data.saleReturns, 'saleReturns'));
          }

          const mergedPurchasesList: PurchaseInvoice[] = Array.isArray(data.purchaseInvoices)
            ? dedupeById(
                (shouldMerge ? mergeEntitiesById(purchaseInvoices, data.purchaseInvoices) : data.purchaseInvoices) as PurchaseInvoice[]
              ).filter(
                inv => !allDeletedPurchaseIds.has(String(inv.id)) && (!inv.billNumber || !allDeletedPurchaseIds.has(String(inv.billNumber)))
              )
            : purchaseInvoices;

          if (Array.isArray(data.purchaseInvoices)) {
            setPurchaseInvoices(prev => {
              const merged = shouldMerge ? mergeEntitiesById(prev, data.purchaseInvoices) : data.purchaseInvoices;
              return dedupeById(merged as PurchaseInvoice[]).filter(
                inv => !allDeletedPurchaseIds.has(String(inv.id)) && (!inv.billNumber || !allDeletedPurchaseIds.has(String(inv.billNumber)))
              );
            });
          }
          if (Array.isArray(data.deletedPurchaseInvoices)) {
            setDeletedPurchaseInvoices(prev =>
              filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.deletedPurchaseInvoices) : data.deletedPurchaseInvoices, 'deletedPurchaseInvoices')
            );
          }
          if (Array.isArray(data.purchaseReturns)) {
            setPurchaseReturns(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.purchaseReturns) : data.purchaseReturns, 'purchaseReturns'));
          }
          if (Array.isArray(data.purchaseOrders)) {
            setPurchaseOrders(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.purchaseOrders) : data.purchaseOrders, 'purchaseOrders'));
          }
          if (Array.isArray(data.quotations)) {
            setQuotations(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.quotations) : data.quotations, 'quotations'));
          }
          if (Array.isArray(data.salesOrders)) {
            setSalesOrders(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.salesOrders) : data.salesOrders, 'salesOrders'));
          }
          if (Array.isArray(data.expiredReturnLogs)) {
            setExpiredReturnLogs(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.expiredReturnLogs) : data.expiredReturnLogs, 'expiredReturnLogs'));
          }
          if (Array.isArray(data.installmentSchemes)) {
            setInstallmentSchemes(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.installmentSchemes) : data.installmentSchemes, 'installmentSchemes'));
          }
          if (Array.isArray(data.employees)) {
            setEmployees(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.employees) : data.employees, 'employees'));
          }
          if (Array.isArray(data.advanceSalaries)) {
            setAdvanceSalaries(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.advanceSalaries) : data.advanceSalaries, 'advanceSalaries'));
          }
          if (Array.isArray(data.payrollHistory)) {
            setPayrollHistory(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.payrollHistory) : data.payrollHistory, 'payrollHistory'));
          }
          if (Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0) {
            setExpenseCategories(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.expenseCategories) : data.expenseCategories, 'expenseCategories'));
          }
          if (Array.isArray(data.expenseVouchers)) {
            setExpenseVouchers(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.expenseVouchers) : data.expenseVouchers, 'expenseVouchers'));
          }
          if (Array.isArray(data.dayBookEntries)) {
            setDayBookEntries(prev => {
              const filtered = filterByTombstone<DayBookEntry>(
                shouldMerge
                  ? mergeEntitiesById(prev, data.dayBookEntries as DayBookEntry[])
                  : (data.dayBookEntries as DayBookEntry[]),
                'dayBookEntries'
              );
              return dedupeTransactionDayBookEntries(filtered, mergedSalesList, mergedPurchasesList).cleaned;
            });
          }
          if (Array.isArray(data.cashAdjustments)) {
            setCashAdjustments(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.cashAdjustments) : data.cashAdjustments, 'cashAdjustments'));
          }
          if (Array.isArray(data.activityLogs)) {
            setActivityLogs(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.activityLogs) : data.activityLogs, 'activityLogs'));
          }
          if (Array.isArray(data.users) && data.users.length > 0) {
            setUsers(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.users) : data.users, 'users'));
          }
          if (data.smsConfig) {
            setSmsConfig(prev => ({ ...prev, ...data.smsConfig }));
          }
          if (Array.isArray(data.smsLogs)) {
            setSmsLogs(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.smsLogs) : data.smsLogs, 'smsLogs'));
          }
          if (Array.isArray(data.warrantyPolicies) && data.warrantyPolicies.length > 0) {
            setWarrantyPolicies(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.warrantyPolicies) : data.warrantyPolicies, 'warrantyPolicies'));
          }
          if (Array.isArray(data.warrantyRecords)) {
            setWarrantyRecords(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.warrantyRecords) : data.warrantyRecords, 'warrantyRecords'));
          }
          if (Array.isArray(data.warrantyClaims)) {
            setWarrantyClaims(prev => filterByTombstone(shouldMerge ? mergeEntitiesById(prev, data.warrantyClaims) : data.warrantyClaims, 'warrantyClaims'));
          }
          if (Array.isArray(data.diseaseMaster) && data.diseaseMaster.length > 0) {
            setDiseaseMaster(prev => shouldMerge ? mergeEntitiesById(prev, data.diseaseMaster) : data.diseaseMaster);
          }
          if (Array.isArray(data.diseaseCategories) && data.diseaseCategories.length > 0) {
            setDiseaseCategories(prev => shouldMerge ? mergeEntitiesById(prev, data.diseaseCategories) : data.diseaseCategories);
          }
        }

        const appliedEpoch = serverEpoch || Date.now();
        lastServerUpdatedEpochRef.current = appliedEpoch;
        hasCompletedInitialServerSyncRef.current = true;
        // After state update, we reset the incoming sync ref with a small delay to allow useEffects to run
        setTimeout(() => {
          isIncomingSyncRef.current = false;
        }, 1000);

        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSyncTime(now);
        try {
          localStorage.setItem('DOKANPRO_LAST_SYNC_TIME', now);
          localStorage.setItem('DOKANPRO_LAST_LOCAL_UPDATE_EPOCH', String(appliedEpoch));
        } catch {}

        setServerSyncStatus({
          success: true,
          message: language === 'bn' ? 'সার্ভার থেকে সমস্ত লাইভ ডাটা সফলভাবে ডাউনলোড ও সিঙ্ক হয়েছে।' : 'Synced successfully from server.',
          timestamp: now,
        });

        if (!quiet) {
          showToast(language === 'bn' ? 'সার্ভার থেকে সমস্ত ডাটা সফলভাবে সিঙ্ক ও আপডেট হয়েছে!' : 'All ERP records synced and loaded from server!', 'success');
        } else if (hasNewIncomingEntries) {
          showToast(
            language === 'bn'
              ? '🔄 অন্য ডিভাইস থেকে নতুন এন্ট্রি/ডাটা সফলভাবে লাইভ সিঙ্ক হয়েছে!'
              : '🔄 Live entries synced from other device!',
            'info'
          );
        }
        return true;
      } else {
        // Server responded with empty/no-data snapshot (fresh setup or newly deployed empty server)
        hasCompletedInitialServerSyncRef.current = true;
        isIncomingSyncRef.current = false;
        if (localHasRecordsRef.current) {
          // Local browser has live business records; auto-recover server snapshot immediately
          triggerServerPush(targetUrl, true);
        }
        return true;
      }
    } catch (err: any) {
      isPullingRef.current = false;
      isIncomingSyncRef.current = false;
      hasCompletedInitialServerSyncRef.current = true; // Mark as attempted so user entries can now be tracked
      if (!quiet) {
        showToast(language === 'bn' ? `ডাটা পুল ব্যর্থ: ${err.message}` : `Data pull failed: ${err.message}`, 'warning');
      }
      return false;
    } finally {
      isPullingRef.current = false;
    }
  };

  // Manual Trigger Sync Now
  const triggerSyncNow = async (): Promise<boolean> => {
    setSyncCountdown(autoSyncIntervalSeconds);
    return await triggerServerPull(undefined, false);
  };

  // Permanently save and remember API endpoint for all devices
  const saveApiEndpoint = async (url: string, autoSync = true, intervalSeconds = 30): Promise<boolean> => {
    const trimmed = url.trim();
    try {
      localStorage.setItem('DOKANPRO_ERP_API_ENDPOINT', trimmed);
    } catch {}

    setCompanySettings(prev => ({
      ...prev,
      apiEndpoint: trimmed,
      autoSyncEnabled: autoSync,
      autoSyncIntervalSeconds: intervalSeconds,
    }));
    setSyncCountdown(intervalSeconds);

    showToast(
      language === 'bn'
        ? `API Endpoint সফলভাবে সংরক্ষিত হয়েছে! প্রতি ${intervalSeconds} সেকেন্ড পর পর অটো রিলোড ও সিঙ্ক সক্রিয়।`
        : `API Endpoint saved! Auto sync active every ${intervalSeconds}s.`,
      'success'
    );

    // Initial push test
    return await triggerServerPush(trimmed);
  };

  // Setup Multi-Device Real-time Listeners & Auto-Sync Engine
  useEffect(() => {
    // 1. Initial boot pull immediately to load all data on any device
    const initTimer = setTimeout(() => {
      triggerServerPull(undefined, true);
    }, 50);

    // 2. Multi-Device Real-Time Poller (every 3.5 seconds)
    const liveSyncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerServerPull(undefined, true);
      }
    }, 3500);

    // 3. Immediate pull when user focuses tab or switches to device
    const handleFocus = () => {
      triggerServerPull(undefined, true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerServerPull(undefined, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Same-device cross-tab BroadcastChannel & storage sync
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('DOKANPRO_CROSS_TAB_CHANNEL');
        bc.onmessage = (event) => {
          if (event.data?.type === 'STATE_UPDATED') {
            reloadFromLocalStorage();
            triggerServerPull(undefined, true);
          }
        };
      }
    } catch {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        reloadFromLocalStorage();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(initTimer);
      clearInterval(liveSyncInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
    };
  }, []);

  // Instant background Auto-Push to Server & SQL file on entries/changes
  useEffect(() => {
    if (companySettings.autoSyncEnabled === false) return;
    if (isIncomingSyncRef.current) return; // STRICTLY IGNORE CHANGES FROM SERVER PULL
    
    // Only auto-push if we have completed initial sync (cleared junk) OR have explicit unsynced changes
    if (!hasCompletedInitialServerSyncRef.current && !hasUnsyncedChangesRef.current) {
      return;
    }

    const activeUrl = companySettings.apiEndpoint || localStorage.getItem('DOKANPRO_ERP_API_ENDPOINT') || getActiveApiEndpoint();
    if (!activeUrl) return;

    // 400ms debounce ensures smooth typing experience while reliably auto-syncing to server
    const pushTimer = setTimeout(() => {
      triggerServerPush(activeUrl, true);
    }, 400);

    return () => clearTimeout(pushTimer);
  }, [
    products,
    deletedProductIds,
    deletedEntityIds,
    categories,
    parties,
    wallets,
    saleInvoices,
    deletedSaleInvoices,
    saleReturns,
    purchaseInvoices,
    deletedPurchaseInvoices,
    purchaseReturns,
    purchaseOrders,
    quotations,
    salesOrders,
    expiredReturnLogs,
    installmentSchemes,
    employees,
    advanceSalaries,
    payrollHistory,
    expenseCategories,
    expenseVouchers,
    dayBookEntries,
    cashAdjustments,
    activityLogs,
    companySettings,
    users,
    smsConfig,
    smsLogs,
    warrantyPolicies,
    warrantyRecords,
    warrantyClaims,
    diseaseMaster,
    diseaseCategories,
  ]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const openPrintModal = (doc: PrintableDocumentData) => {
    setPrintableDoc(doc);
  };

  const closePrintModal = () => {
    setPrintableDoc(null);
  };

  const formatCurrency = (amount: number) => {
    const symbol = companySettings.currencySymbol || '৳';
    return `${symbol} ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // -------------------------------------------------------------
  // Product & Category Handlers
  // -------------------------------------------------------------
  const addProduct = (prodData: Omit<Product, 'id' | 'createdAt'>): Product => {
    // Check duplicate barcode / serial
    if (prodData.barcode && prodData.barcode.trim()) {
      const dupBarcode = products.find(
        p => p.barcode && p.barcode.trim().toLowerCase() === prodData.barcode.trim().toLowerCase()
      );
      if (dupBarcode) {
        showToast(
          language === 'bn'
            ? `এই বারকোড / সিরিয়াল (${prodData.barcode}) ইতিমধ্যে "${dupBarcode.name}" পণ্যে ব্যবহৃত! একই কোড দিয়ে এন্ট্রি হবে না।`
            : `Barcode / Serial (${prodData.barcode}) already exists on "${dupBarcode.name}"! Duplicate entry not allowed.`,
          'error'
        );
        return dupBarcode;
      }
    }

    // Check duplicate SKU
    if (prodData.sku && prodData.sku.trim()) {
      const dupSku = products.find(
        p => p.sku && p.sku.trim().toLowerCase() === prodData.sku.trim().toLowerCase()
      );
      if (dupSku) {
        showToast(
          language === 'bn'
            ? `এই SKU কোড (${prodData.sku}) ইতিমধ্যে "${dupSku.name}" পণ্যে ব্যবহৃত! একই কোড দিয়ে এন্ট্রি হবে না।`
            : `SKU code (${prodData.sku}) already exists on "${dupSku.name}"! Duplicate entry not allowed.`,
          'error'
        );
        return dupSku;
      }
    }

    if (Number(prodData.stock || 0) < 0 || prodData.batches?.some(b => Number(b.stock || 0) < 0)) {
      showToast(
        language === 'bn' ? 'পণ্যের বা ব্যাচের স্টক ঋণাত্মক (-) হতে পারবে না!' : 'Product or batch stock cannot be negative!',
        'error'
      );
    }

    const safeStock = clampNonNegative(prodData.stock, 4);
    const safeBatches = prodData.batches?.map(b => ({
      ...b,
      stock: clampNonNegative(b.stock, 4),
      initialStock: b.initialStock !== undefined ? clampNonNegative(b.initialStock, 4) : b.initialStock,
    }));

    const newProductId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const categoryById = categories.find(c => c.id === prodData.categoryId);
    const categoryByName = !categoryById && prodData.categoryName
      ? categories.find(c => c.name.trim().toLowerCase() === prodData.categoryName!.trim().toLowerCase())
      : undefined;
    const resolvedCat = categoryById || categoryByName;
    const newProduct: Product = {
      ...prodData,
      name: (prodData.name || '').trim() || 'Unnamed Product',
      sku: (prodData.sku || '').trim(),
      barcode: (prodData.barcode || '').trim(),
      categoryId: resolvedCat?.id || prodData.categoryId,
      stock: safeStock,
      batches: safeBatches,
      id: newProductId,
      categoryName: resolvedCat?.name || prodData.categoryName || 'General',
      createdBy: currentUser?.id || 'usr-1',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const clearKeys = [newProductId, newProduct.sku, newProduct.name].filter(Boolean) as string[];
    if (clearKeys.length > 0) {
      const clearSet = new Set(clearKeys);
      setDeletedProductIds(prev => {
        const filtered = prev.filter(item => !clearSet.has(String(item)));
        if (filtered.length !== prev.length) {
          try {
            localStorage.setItem('DOKANPRO_DELETED_PRODUCT_IDS', JSON.stringify(filtered));
          } catch {}
        }
        return filtered;
      });
      removeDeletedTombstones('products', clearKeys);
    }
    setProducts(prev => [newProduct, ...prev]);
    setTimeout(() => {
      triggerServerPush(undefined, true);
    }, 100);
    showToast(language === 'bn' ? 'নতুন পণ্য সফলভাবে যুক্ত করা হয়েছে।' : 'Product added successfully.');
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    if (
      (updates.stock !== undefined && Number(updates.stock) < 0) ||
      updates.batches?.some(b => Number(b.stock || 0) < 0)
    ) {
      showToast(
        language === 'bn' ? 'পণ্যের বা ব্যাচের স্টক ঋণাত্মক (-) হতে পারবে না!' : 'Product or batch stock cannot be negative!',
        'error'
      );
      return;
    }

    if (updates.barcode && updates.barcode.trim()) {
      const dupBarcode = products.find(
        p => p.id !== id && p.barcode && p.barcode.trim().toLowerCase() === updates.barcode.trim().toLowerCase()
      );
      if (dupBarcode) {
        showToast(
          language === 'bn'
            ? `এই বারকোড / সিরিয়াল (${updates.barcode}) ইতিমধ্যে "${dupBarcode.name}" পণ্যে ব্যবহৃত! পরিবর্তন করা যাবে না।`
            : `Barcode (${updates.barcode}) is already used by "${dupBarcode.name}"! Duplicate not allowed.`,
          'error'
        );
        return;
      }
    }

    if (updates.sku && updates.sku.trim()) {
      const dupSku = products.find(
        p => p.id !== id && p.sku && p.sku.trim().toLowerCase() === updates.sku.trim().toLowerCase()
      );
      if (dupSku) {
        showToast(
          language === 'bn'
            ? `এই SKU কোড (${updates.sku}) ইতিমধ্যে "${dupSku.name}" পণ্যে ব্যবহৃত! পরিবর্তন করা যাবে না।`
            : `SKU (${updates.sku}) is already used by "${dupSku.name}"! Duplicate not allowed.`,
          'error'
        );
        return;
      }
    }

    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const catId = updates.categoryId || p.categoryId;
          const cat = categories.find(c => c.id === catId);

          let nextBatches = updates.batches || p.batches;
          if (!updates.batches && updates.expDate !== undefined) {
            const cleanExp = updates.expDate ? normalizeDateToISO(updates.expDate) || updates.expDate : '';
            if (nextBatches && nextBatches.length > 0) {
              nextBatches = nextBatches.map(b => ({
                ...b,
                expDate: cleanExp,
                batchNumber: updates.batchNumber || b.batchNumber,
              }));
            } else if (cleanExp) {
              const safeNextStock = clampNonNegative(updates.stock !== undefined ? updates.stock : p.stock, 4);
              nextBatches = [{
                id: `batch-${Date.now()}`,
                batchNumber: updates.batchNumber || p.batchNumber || 'B-01',
                expDate: cleanExp,
                stock: safeNextStock,
                initialStock: safeNextStock,
                purchaseDate: new Date().toISOString().split('T')[0],
                purchasePrice: updates.purchasePrice !== undefined ? updates.purchasePrice : p.purchasePrice,
                salesPrice: updates.salesPrice !== undefined ? updates.salesPrice : p.salesPrice,
              }];
            }
          }

          return {
            ...p,
            ...updates,
            stock: clampNonNegative(updates.stock !== undefined ? updates.stock : p.stock, 4),
            batches: nextBatches?.map(b => ({
              ...b,
              stock: clampNonNegative(b.stock, 4),
              initialStock: b.initialStock !== undefined ? clampNonNegative(b.initialStock, 4) : b.initialStock,
            })),
            categoryName: cat?.name || p.categoryName,
          };
        }
        return p;
      })
    );
    setTimeout(() => {
      triggerServerPush(undefined, true);
    }, 100);
    showToast(language === 'bn' ? 'পণ্যের তথ্য আপডেট করা হয়েছে।' : 'Product updated successfully.');
  };

  const deleteProduct = (id: string, _force = true) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    // Track by unique product ID in deletedProductIds & deletedEntityIds so deleted IDs do not resurrect,
    // while allowing newly added/re-imported products with the same SKU/name to persist safely.
    setDeletedProductIds(prev => {
      const updated = Array.from(new Set([...prev, id].filter(Boolean) as string[]));
      try {
        localStorage.setItem('DOKANPRO_DELETED_PRODUCT_IDS', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    recordDeletedTombstones('products', [id]);

    setProducts(prev => prev.filter(p => p.id !== id));
    setTimeout(() => {
      triggerServerPush(undefined, true);
    }, 100);
    
    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'PRODUCT',
          sourceTable: 'products',
          recordId: prod.id,
          referenceNo: prod.sku || prod.barcode || '',
          title: `Product '${prod.name}'`,
          amount: Number(prod.salesPrice || prod.purchasePrice || 0),
          snapshot: prod,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: পণ্য (${prod.name}) সফটওয়্যার থেকে সম্পূর্ণ মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: Product '${prod.name}' removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Product '${prod.name}'`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted product '${prod.name}' (SKU: ${prod.sku || 'N/A'}) on ${nowStr}.`,
      severity: 'danger',
      targetId: prod.id,
      targetName: `Product '${prod.name}'`,
    });

    showToast(
      language === 'bn' 
        ? `পণ্য (${prod.name}) সফলভাবে ডিলিট করা হয়েছে।` 
        : `Product '${prod.name}' deleted successfully.`, 
      'info'
    );
  };

  const deleteAllProducts = () => {
    if (currentUser?.role !== 'ADMIN') {
      showToast(
        language === 'bn'
          ? 'শুধুমাত্র অ্যাডমিন (ADMIN) সমস্ত পণ্য মুছে ফেলার অনুমতি রাখেন!'
          : 'Access Denied: Only ADMIN users are authorized to clear all products!',
        'error'
      );
      return;
    }
    if (products.length === 0) {
      showToast(language === 'bn' ? 'কোনো পণ্য নেই।' : 'No products found.', 'info');
      return;
    }
    const count = products.length;
    const snapshotProducts = [...products];
    const allIds = snapshotProducts.map(p => p.id).filter(Boolean) as string[];

    setDeletedProductIds(prev => {
      const updated = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('DOKANPRO_DELETED_PRODUCT_IDS', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    recordDeletedTombstones('products', allIds);

    setProducts([]);
    setTimeout(() => {
      triggerServerPush(undefined, true);
    }, 100);

    archiveAdminDeletion(
      snapshotProducts.map(prod => ({
        entityType: 'PRODUCT',
        sourceTable: 'products',
        recordId: prod.id,
        referenceNo: prod.sku || prod.barcode || '',
        title: `Product '${prod.name}' (Bulk Clear)`,
        amount: Number(prod.salesPrice || prod.purchasePrice || 0),
        reason: 'Bulk cleared all inventory products by Admin',
        snapshot: prod,
      }))
    );

    showToast(
      language === 'bn'
        ? `ইনভেন্টরির সমস্ত (${count}টি) পণ্য সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
        : `All ${count} products removed from software and saved to admin_deleted_records.sql.`,
      'success'
    );
  };

  const updateProductBatches = (productId: string, batches: ProductBatch[]) => {
    if (batches.some(b => Number(b.stock || 0) < 0)) {
      showToast(
        language === 'bn' ? 'ব্যাচের স্টক ঋণাত্মক (-) হতে পারবে না!' : 'Batch stock cannot be negative!',
        'error'
      );
      return;
    }
    const safeBatches = batches.map(b => ({
      ...b,
      stock: clampNonNegative(b.stock, 4),
      initialStock: b.initialStock !== undefined ? clampNonNegative(b.initialStock, 4) : b.initialStock,
    }));
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const totalStock = clampNonNegative(
            safeBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0),
            4
          );
          const activeBatches = safeBatches.filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatches.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestExp = activeBatches[0]?.expDate || p.expDate || '';
          const latestBatchNum = safeBatches[safeBatches.length - 1]?.batchNumber || p.batchNumber || '';
          return {
            ...p,
            batches: safeBatches,
            stock: totalStock,
            expDate: earliestExp,
            batchNumber: latestBatchNum,
          };
        }
        return p;
      })
    );
    showToast(language === 'bn' ? 'ব্যাচ তথ্য সফলভাবে আপডেট করা হয়েছে।' : 'Product batches updated successfully.');
  };

  const addProductBatch = (productId: string, batchData: Omit<ProductBatch, 'id'>) => {
    if (Number(batchData.stock || 0) < 0) {
      showToast(
        language === 'bn' ? 'ব্যাচের স্টক ঋণাত্মক (-) হতে পারবে না!' : 'Batch stock cannot be negative!',
        'error'
      );
      return;
    }
    const newBatch: ProductBatch = {
      ...batchData,
      stock: clampNonNegative(batchData.stock, 4),
      initialStock:
        batchData.initialStock !== undefined
          ? clampNonNegative(batchData.initialStock, 4)
          : clampNonNegative(batchData.stock, 4),
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdBy: currentUser?.id || 'usr-1',
    };
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const existing = p.batches ? [...p.batches] : [];
          existing.push(newBatch);
          const totalStock = clampNonNegative(
            existing.reduce((sum, b) => sum + (Number(b.stock) || 0), 0),
            4
          );
          const activeBatches = existing.filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatches.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestExp = activeBatches[0]?.expDate || p.expDate || '';
          return {
            ...p,
            batches: existing,
            stock: totalStock,
            expDate: earliestExp,
            batchNumber: newBatch.batchNumber || p.batchNumber,
          };
        }
        return p;
      })
    );
    showToast(language === 'bn' ? 'নতুন ব্যাচ সফলভাবে যুক্ত করা হয়েছে।' : 'Batch added successfully.');
  };

  const deleteProductBatch = (productId: string, batchId: string) => {
    const prod = products.find(p => p.id === productId);
    const removedBatch = prod?.batches?.find(b => b.id === batchId);

    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId && p.batches) {
          const remaining = p.batches.filter(b => b.id !== batchId);
          const totalStock = remaining.reduce((sum, b) => sum + (Number(b.stock) || 0), 0);
          const activeBatches = remaining.filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatches.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestExp = activeBatches[0]?.expDate || '';
          return {
            ...p,
            batches: remaining,
            stock: totalStock,
            expDate: earliestExp,
          };
        }
        return p;
      })
    );
    if (isAdminUser() && removedBatch) {
      archiveAdminDeletion([
        {
          entityType: 'PRODUCT_BATCH',
          sourceTable: 'product_batches',
          recordId: batchId,
          referenceNo: removedBatch.batchNumber,
          title: `Batch ${removedBatch.batchNumber} (${prod?.name || productId})`,
          amount: Number(removedBatch.purchasePrice || 0) * Number(removedBatch.stock || 0),
          snapshot: { productId, productName: prod?.name, batch: removedBatch },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'ব্যাচ সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Batch removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(language === 'bn' ? 'ব্যাচ মুছে ফেলা হয়েছে।' : 'Batch removed successfully.', 'info');
  };

  const addCategory = (categoryData: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: `cat-${Date.now()}`,
      createdBy: currentUser?.id || 'usr-1',
    };
    setCategories(prev => [...prev, newCategory]);
    showToast(language === 'bn' ? 'ক্যাটাগরি তৈরি করা হয়েছে।' : 'Category created.');
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    const existingCat = categories.find(c => c.id === id);
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    if (updates.name && updates.name.trim()) {
      const nextName = updates.name.trim();
      const oldNameLower = existingCat?.name?.trim().toLowerCase();
      setProducts(prev =>
        prev.map(p => {
          if (p.categoryId === id || (oldNameLower && p.categoryName?.trim().toLowerCase() === oldNameLower)) {
            return { ...p, categoryId: id, categoryName: nextName };
          }
          return p;
        })
      );
    }
    showToast(language === 'bn' ? 'ক্যাটাগরি আপডেট হয়েছে।' : 'Category updated.');
  };

  const deleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    setCategories(prev => prev.filter(c => c.id !== id));
    recordDeletedTombstones('categories', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'CATEGORY',
          sourceTable: 'categories',
          recordId: id,
          title: `Category '${cat?.name || id}'`,
          snapshot: cat || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'ক্যাটাগরি সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Category removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(language === 'bn' ? 'ক্যাটাগরি মুছে ফেলা হয়েছে।' : 'Category deleted.', 'info');
  };

  const bulkImportProducts = (newProducts: Omit<Product, 'id' | 'createdAt'>[]) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const isPlaceholderCode = (val?: string) => {
      const norm = (val || '').trim().toLowerCase();
      return !norm || ['-', '--', 'n/a', 'na', 'none', 'null', 'nil', '0', 'undefined'].includes(norm);
    };
    const isExcelScientificNotation = (val?: string) =>
      /^\d+(\.\d+)?e[+-]?\d+$/i.test((val || '').trim());

    const existingBarcodes = new Set(
      products
        .map(p => p.barcode?.trim().toLowerCase())
        .filter((v): v is string => Boolean(v) && !isPlaceholderCode(v) && !isExcelScientificNotation(v))
    );
    const existingSkus = new Set(
      products
        .map(p => p.sku?.trim().toLowerCase())
        .filter((v): v is string => Boolean(v) && !isPlaceholderCode(v))
    );

    const created: Product[] = [];
    let skipped = 0;

    const catMapByName = new Map<string, Category>();
    categories.forEach(c => {
      if (c.name && c.name.trim()) {
        catMapByName.set(c.name.trim().toLowerCase(), c);
      }
    });
    const newCategoriesToAdd: Category[] = [];
    const baseTime = Date.now();

    newProducts.forEach((p, idx) => {
      const rawBarcode = (p.barcode || '').trim();
      const rawSku = (p.sku || '').trim();
      const barcodeKey =
        !isPlaceholderCode(rawBarcode) && !isExcelScientificNotation(rawBarcode)
          ? rawBarcode.toLowerCase()
          : '';
      const skuKey = !isPlaceholderCode(rawSku) ? rawSku.toLowerCase() : '';

      if ((barcodeKey && existingBarcodes.has(barcodeKey)) || (skuKey && existingSkus.has(skuKey))) {
        skipped++;
        return;
      }
      if (barcodeKey) existingBarcodes.add(barcodeKey);
      if (skuKey) existingSkus.add(skuKey);

      const cleanCatName = (p.categoryName || '').trim();
      let resolvedCatId = p.categoryId;
      let resolvedCatName = cleanCatName || 'General';

      if (cleanCatName) {
        const key = cleanCatName.toLowerCase();
        let existingCat = catMapByName.get(key);
        if (!existingCat) {
          existingCat = {
            id: `cat-${baseTime}-${newCategoriesToAdd.length}`,
            name: cleanCatName,
            nameBn: cleanCatName,
            code: cleanCatName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20) || 'CAT',
            createdBy: currentUser?.id || 'usr-1',
          };
          catMapByName.set(key, existingCat);
          newCategoriesToAdd.push(existingCat);
        }
        resolvedCatId = existingCat.id;
        resolvedCatName = existingCat.name;
      } else if (p.categoryId) {
        const byId = categories.find(c => c.id === p.categoryId);
        if (byId) {
          resolvedCatId = byId.id;
          resolvedCatName = byId.name;
        }
      }

      created.push({
        ...p,
        name: (p.name || '').trim() || `Product ${idx + 1}`,
        sku: rawSku,
        barcode: rawBarcode,
        categoryId: resolvedCatId || 'cat-default',
        categoryName: resolvedCatName,
        stock: clampNonNegative(p.stock, 4),
        batches: p.batches?.map(b => ({
          ...b,
          stock: clampNonNegative(b.stock, 4),
          initialStock: b.initialStock !== undefined ? clampNonNegative(b.initialStock, 4) : b.initialStock,
        })),
        id: `prod-${baseTime}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: timestamp,
      });
    });

    if (newCategoriesToAdd.length > 0) {
      setCategories(prev => [...prev, ...newCategoriesToAdd]);
    }
    if (created.length > 0) {
      const clearKeys = created.flatMap(p => [p.id, p.sku, p.name]).filter(Boolean) as string[];
      const clearSet = new Set(clearKeys);
      setDeletedProductIds(prev => {
        const filtered = prev.filter(item => !clearSet.has(String(item)));
        if (filtered.length !== prev.length) {
          try {
            localStorage.setItem('DOKANPRO_DELETED_PRODUCT_IDS', JSON.stringify(filtered));
          } catch {}
        }
        return filtered;
      });
      removeDeletedTombstones('products', clearKeys);
      setProducts(prev => [...created, ...prev]);
      setTimeout(() => {
        triggerServerPush(undefined, true);
      }, 150);
    }
    showToast(
      language === 'bn'
        ? `${created.length} টি পণ্য সফলভাবে ইমপোর্ট হয়েছে${skipped > 0 ? ` (${skipped} টি ডুপ্লিকেট SKU/বারকোড বাদ দেওয়া হয়েছে)` : ''}।`
        : `Successfully imported ${created.length} products${skipped > 0 ? ` (${skipped} duplicate SKU/barcode rows skipped)` : ''}.`
    );
    return created.length;
  };

  // -------------------------------------------------------------
  // Party Handlers (Customer & Supplier)
  // -------------------------------------------------------------
  const getNextPartySerialNumber = (type: PartyType): string => {
    return generatePartySerialNumber(type, parties);
  };

  const addParty = (partyData: Omit<Party, 'id' | 'currentBalance' | 'createdAt'>): Party => {
    const serial = (partyData.serialNumber && partyData.serialNumber.trim())
      ? partyData.serialNumber.trim()
      : generatePartySerialNumber(partyData.type, parties);

    // Duplicate Serial Check: Ensure the serial number does not already exist
    const duplicateParty = findDuplicatePartySerial(serial, parties);

    if (duplicateParty) {
      showToast(
        language === 'bn'
          ? `আগে থেকে এই নং এন্ট্রি আছে! (${serial}) ইতিমধ্যে "${duplicateParty.name}"-এর জন্য ব্যবহৃত। একই নং দুইবার এন্ট্রি হবে না।`
          : `This number is already entered previously! Serial (${serial}) is already used by "${duplicateParty.name}". Duplicate entry not allowed.`,
        'error'
      );
      return duplicateParty;
    }

    const safeOpening = clampNonNegative(partyData.openingBalance, 2);
    const newParty: Party = {
      ...partyData,
      openingBalance: safeOpening,
      id: `${partyData.type.toLowerCase()}-${Date.now()}`,
      serialNumber: serial,
      currentBalance: safeOpening,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setParties(prev => [newParty, ...prev]);
    showToast(
      partyData.type === 'CUSTOMER'
        ? language === 'bn' ? `নতুন কাস্টমার (#${serial}) সফলভাবে যোগ করা হয়েছে!` : `Customer (#${serial}) added successfully!`
        : language === 'bn' ? `নতুন সাপ্লায়ার (#${serial}) সফলভাবে যোগ করা হয়েছে!` : `Supplier (#${serial}) added successfully!`,
      'success'
    );
    return newParty;
  };

  const updateParty = (id: string, updates: Partial<Party>) => {
    if (
      (updates.openingBalance !== undefined && Number(updates.openingBalance) < 0) ||
      (updates.currentBalance !== undefined && Number(updates.currentBalance) < 0)
    ) {
      showToast(
        language === 'bn' ? 'ব্যালেন্স ঋণাত্মক (-) হতে পারবে না!' : 'Balance cannot be negative!',
        'error'
      );
      return;
    }
    if (updates.serialNumber && updates.serialNumber.trim()) {
      const serial = updates.serialNumber.trim();
      const duplicateParty = findDuplicatePartySerial(serial, parties, id);
      if (duplicateParty) {
        showToast(
          language === 'bn'
            ? `আগে থেকে এই নং এন্ট্রি আছে! (${serial}) ইতিমধ্যে "${duplicateParty.name}"-এর জন্য ব্যবহৃত।`
            : `This number is already entered previously! Serial (${serial}) is already used by "${duplicateParty.name}".`,
          'error'
        );
        return;
      }
    }
    setParties(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              ...updates,
              openingBalance:
                updates.openingBalance !== undefined
                  ? clampNonNegative(updates.openingBalance, 2)
                  : p.openingBalance,
              currentBalance:
                updates.currentBalance !== undefined
                  ? clampNonNegative(updates.currentBalance, 2)
                  : p.currentBalance,
            }
          : p
      )
    );
    showToast(language === 'bn' ? 'তথ্য আপডেট হয়েছে।' : 'Party details updated.', 'success');
  };

  const deleteParty = (id: string) => {
    const party = parties.find(p => p.id === id);
    if (!party) return;

    if (party.type === 'CUSTOMER') {
      const hasSales = saleInvoices?.some(inv => inv.customerId === id || inv.customerPhone === party.phone || inv.customerName === party.name);
      if (hasSales || party.currentBalance !== 0) {
        showToast(
          language === 'bn'
            ? `এই কাস্টমার (${party.name})-এর বিক্রয় ইনভয়েস বা বকেয়া ব্যালেন্স (৳${party.currentBalance}) রয়েছে। ডিলিট করা সম্ভব নয়!`
            : `Customer (${party.name}) has sale invoices or outstanding balance. Cannot delete!`,
          'error'
        );
        return;
      }
    } else if (party.type === 'SUPPLIER') {
      const hasPurchases = purchaseInvoices?.some(inv => inv.supplierId === id || inv.supplierName === party.name);
      const hasOrders = purchaseOrders?.some(po => po.supplierId === id || po.supplierName === party.name);
      if (hasPurchases || hasOrders || party.currentBalance !== 0) {
        showToast(
          language === 'bn'
            ? `এই সাপ্লায়ার (${party.name})-এর ক্রয় ইনভয়েস, অর্ডার বা ব্যালেন্স (৳${party.currentBalance}) রয়েছে। ডিলিট করা যাবে না!`
            : `Supplier (${party.name}) has purchase/order history or balance. Cannot delete!`,
          'error'
        );
        return;
      }
    }

    setParties(prev => prev.filter(p => p.id !== id));
    recordDeletedTombstones('parties', [id]);
    
    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: party.type === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER',
          sourceTable: 'parties',
          recordId: party.id,
          referenceNo: party.serialNumber || party.phone || '',
          title: `${party.type === 'CUSTOMER' ? 'Customer' : 'Supplier'} '${party.name}'`,
          amount: Number(party.currentBalance || 0),
          snapshot: party,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: ${party.type === 'CUSTOMER' ? 'কাস্টমার' : 'সাপ্লায়ার'} (${party.name}) সফটওয়্যার থেকে সম্পূর্ণ মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: ${party.type} '${party.name}' removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted ${party.type === 'CUSTOMER' ? 'Customer' : 'Supplier'} '${party.name}'`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted ${party.type.toLowerCase()} '${party.name}' (Phone: ${party.phone || 'N/A'}) on ${nowStr}.`,
      severity: 'danger',
      targetId: party.id,
      targetName: `${party.type} '${party.name}'`,
    });

    showToast(
      language === 'bn' 
        ? `${party.type === 'CUSTOMER' ? 'কাস্টমার' : 'সাপ্লায়ার'} (${party.name}) ${nowStr} তারিখে ডিলিট করা হয়েছে এবং অ্যাক্টিভিটি লগে রেকর্ড করা হয়েছে।` 
        : `${party.type} '${party.name}' deleted on ${nowStr} and logged to audit.`, 
      'info'
    );
  };

  // -------------------------------------------------------------
  // SMS Service & Notifications
  // -------------------------------------------------------------
  const updateSmsConfig = (updates: Partial<SmsConfig>) => {
    setSmsConfig(prev => ({ ...prev, ...updates }));
    showToast(language === 'bn' ? 'SMS গেটওয়ে সেটিংস সংরক্ষিত হয়েছে।' : 'SMS Gateway settings updated.');
  };

  const sendManualSms = async (
    recipientPhone: string,
    recipientName: string,
    message: string,
    type: SmsLog['type'] = 'TEST'
  ): Promise<boolean> => {
    const res = await sendSmsViaGateway(smsConfig, {
      recipientPhone,
      recipientName,
      message,
      type,
    });
    setSmsLogs(prev => [res.log, ...prev]);
    if (res.success) {
      showToast(
        language === 'bn' ? `SMS সফলভাবে পাঠানো হয়েছে (${recipientPhone})!` : `SMS sent successfully to ${recipientPhone}!`,
        'success'
      );
    } else {
      showToast(
        language === 'bn' ? `SMS পাঠানো ব্যর্থ হয়েছে: ${res.message}` : `SMS failed: ${res.message}`,
        'error'
      );
    }
    return res.success;
  };

  const sendSaleSms = async (invoice: SaleInvoice): Promise<boolean> => {
    if (!invoice.customerPhone || invoice.customerId === 'walk-in') {
      return false;
    }
    const variables = {
      customer_name: invoice.customerName || 'Customer',
      invoice_no: invoice.invoiceNumber,
      total_amount: invoice.grandTotal.toLocaleString(),
      paid_amount: invoice.paidAmount.toLocaleString(),
      due_amount: invoice.dueAmount.toLocaleString(),
      store_name: companySettings.name || 'DokanPro Store',
      store_phone: companySettings.phone || '',
      date: invoice.date,
    };
    const message = formatSmsTemplate(smsConfig.saleTemplate || DEFAULT_SMS_CONFIG.saleTemplate, variables);
    const res = await sendSmsViaGateway(smsConfig, {
      recipientPhone: invoice.customerPhone,
      recipientName: invoice.customerName || 'Customer',
      message,
      type: 'SALE',
    });
    setSmsLogs(prev => [res.log, ...prev]);
    return res.success;
  };

  const sendPaymentInSms = async (
    party: Party,
    amount: number,
    remainingDue: number,
    voucherNo: string
  ): Promise<boolean> => {
    if (!party.phone) {
      return false;
    }
    const variables = {
      customer_name: party.name || 'Customer',
      paid_amount: amount.toLocaleString(),
      remaining_due: remainingDue.toLocaleString(),
      receipt_no: voucherNo,
      store_name: companySettings.name || 'DokanPro Store',
      store_phone: companySettings.phone || '',
      date: new Date().toISOString().split('T')[0],
    };
    const message = formatSmsTemplate(smsConfig.paymentInTemplate || DEFAULT_SMS_CONFIG.paymentInTemplate, variables);
    const res = await sendSmsViaGateway(smsConfig, {
      recipientPhone: party.phone,
      recipientName: party.name || 'Customer',
      message,
      type: 'PAYMENT_IN',
    });
    setSmsLogs(prev => [res.log, ...prev]);
    return res.success;
  };

  const sendDueReminderSms = async (party: Party, customDueAmount?: number): Promise<boolean> => {
    if (!party.phone) {
      showToast(
        language === 'bn' ? `কাস্টমার "${party.name}"-এর কোন ফোন নম্বর নেই!` : `No phone number for "${party.name}"!`,
        'error'
      );
      return false;
    }
    const dueVal = customDueAmount !== undefined 
      ? customDueAmount 
      : getCustomerTotalDue(party, installmentSchemes);

    const variables = {
      customer_name: party.name || 'Customer',
      current_due: dueVal.toLocaleString(),
      store_name: companySettings.name || 'DokanPro Store',
      store_phone: companySettings.phone || '',
      date: new Date().toISOString().split('T')[0],
    };
    const message = formatSmsTemplate(smsConfig.dueReminderTemplate || DEFAULT_SMS_CONFIG.dueReminderTemplate, variables);
    const res = await sendSmsViaGateway(smsConfig, {
      recipientPhone: party.phone,
      recipientName: party.name || 'Customer',
      message,
      type: 'DUE_REMINDER',
    });
    setSmsLogs(prev => [res.log, ...prev]);
    if (res.success) {
      showToast(
        language === 'bn' ? `✅ ${party.name} (${party.phone})-এ ৳${dueVal.toLocaleString()} টাকার বকেয়া তাগাদা SMS পাঠানো হয়েছে!` : `Due reminder SMS sent to ${party.name}!`,
        'success'
      );
    }
    return res.success;
  };

  const sendWarrantyClaimSms = async (claim: WarrantyClaim, customNote?: string): Promise<boolean> => {
    if (!claim.customerPhone) {
      showToast(
        language === 'bn' ? `কাস্টমার "${claim.customerName}"-এর কোনো ফোন নম্বর পাওয়া যায়নি!` : `No phone number for customer "${claim.customerName}"!`,
        'error'
      );
      return false;
    }

    const variables = {
      customer_name: claim.customerName || 'Customer',
      ticket_no: claim.claimTicketNo,
      product_name: claim.productName || 'Product',
      serial_no: claim.serialNumber || 'N/A',
      status: claim.status,
      note: customNote || claim.technicianNotes || '',
      store_name: companySettings.name || 'DokanPro Store',
      store_phone: companySettings.phone || '',
      date: new Date().toISOString().split('T')[0],
    };

    const template = smsConfig.warrantyResolvedTemplate || DEFAULT_SMS_CONFIG.warrantyResolvedTemplate;
    const message = formatSmsTemplate(template, variables);

    const res = await sendSmsViaGateway(smsConfig, {
      recipientPhone: claim.customerPhone,
      recipientName: claim.customerName || 'Customer',
      message,
      type: 'WARRANTY',
    });

    setSmsLogs(prev => [res.log, ...prev]);

    if (res.success) {
      showToast(
        language === 'bn'
          ? `✅ কাস্টমার ${claim.customerName} (${claim.customerPhone})-কে ওয়ারেন্টি SMS পাঠানো হয়েছে!`
          : `Warranty SMS sent to ${claim.customerName}!`,
        'success'
      );
    } else {
      showToast(
        language === 'bn' ? `SMS পাঠানো ব্যর্থ হয়েছে: ${res.message}` : `SMS failed: ${res.message}`,
        'error'
      );
    }

    return res.success;
  };

  const deleteSmsLog = (id: string) => {
    const targetLog = smsLogs.find(l => l.id === id);
    setSmsLogs(prev => prev.filter(l => l.id !== id));
    recordDeletedTombstones('smsLogs', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'SMS_LOG',
          sourceTable: 'sms_logs',
          recordId: id,
          referenceNo: targetLog?.recipientPhone,
          title: `SMS Log - ${targetLog?.recipientName || targetLog?.recipientPhone || id}`,
          snapshot: targetLog || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'SMS হিস্ট্রি সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'SMS log removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(language === 'bn' ? 'SMS হিস্ট্রি মুছে ফেলা হয়েছে।' : 'SMS log deleted.');
  };

  const clearSmsLogs = () => {
    const snapshotLogs = [...smsLogs];
    setSmsLogs([]);
    recordDeletedTombstones('smsLogs', snapshotLogs.map(l => l.id));
    if (isAdminUser() && snapshotLogs.length > 0) {
      archiveAdminDeletion(
        snapshotLogs.map(logItem => ({
          entityType: 'SMS_LOG',
          sourceTable: 'sms_logs',
          recordId: logItem.id,
          referenceNo: logItem.recipientPhone,
          title: `SMS Log - ${logItem.recipientName || logItem.recipientPhone || logItem.id}`,
          reason: 'Cleared all SMS logs by Admin',
          snapshot: logItem,
        }))
      );
      showToast(
        language === 'bn'
          ? 'সকল SMS হিস্ট্রি সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'All SMS logs removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(language === 'bn' ? 'সকল SMS হিস্ট্রি মুছে ফেলা হয়েছে।' : 'All SMS history cleared.');
  };

  // -------------------------------------------------------------
  // POS & Sales Logic
  // -------------------------------------------------------------
  const createSaleInvoice = (data: {
    invoiceNumber?: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'flat';
    vatAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    isInstallmentSale?: boolean;
    installmentPlanId?: string;
    date?: string;
  }): SaleInvoice => {
    const today = new Date().toISOString().split('T')[0];

    // Validate batch-level expiry and stock availability (normalized to base unit e.g. Pcs)
    const requestedByProduct = new Map<string, number>();
    const requestedByBatch = new Map<string, number>();

    for (const item of data.items) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        showToast(
          language === 'bn' ? `পণ্য পাওয়া যায়নি!` : `Product not found!`,
          'error'
        );
        return null as any;
      }

      const itemBaseQty = getBaseQuantity(item, prod);
      const totalProdRequested = (requestedByProduct.get(prod.id) || 0) + itemBaseQty;
      requestedByProduct.set(prod.id, totalProdRequested);

      // 1. If a specific batch is chosen for this item:
      if (item.batchId && prod.batches && prod.batches.length > 0) {
        const batch = prod.batches.find(b => b.id === item.batchId);
        if (!batch) {
          showToast(
            language === 'bn'
              ? `"${item.name}" পণ্যের নির্ধারিত ব্যাচ পাওয়া যায়নি!`
              : `Batch not found for "${item.name}"!`,
            'error'
          );
          return null as any;
        }

        // Check if selected batch is expired
        if (isExpiredDate(batch.expDate)) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}"-এর নির্বাচিত ব্যাচ "${batch.batchNumber}"-এর মেয়াদ শেষ (${batch.expDate})! মেয়াদোত্তীর্ণ ব্যাচ বিক্রি করা যাবে না।`
              : `⚠️ Selected batch "${batch.batchNumber}" of "${item.name}" is expired (${batch.expDate})! Expired batches cannot be sold.`,
            'error'
          );
          return null as any;
        }

        const batchReqKey = `${prod.id}::${item.batchId}`;
        const totalBatchRequested = (requestedByBatch.get(batchReqKey) || 0) + itemBaseQty;
        requestedByBatch.set(batchReqKey, totalBatchRequested);

        // Check selected batch stock in base unit
        if (batch.stock + 1e-6 < totalBatchRequested) {
          showToast(
            language === 'bn'
              ? `"${item.name}" পণ্যের ব্যাচ "${batch.batchNumber}"-এ পর্যাপ্ত মজুদ নেই (মজুদ: ${formatCleanNumber(batch.stock)} ${prod.unit}, বিক্রয় চাওয়া হয়েছে: ${formatCleanNumber(totalBatchRequested)} ${prod.unit})!`
              : `Insufficient stock in batch "${batch.batchNumber}" for "${item.name}" (Stock: ${formatCleanNumber(batch.stock)} ${prod.unit}, requested: ${formatCleanNumber(totalBatchRequested)} ${prod.unit})!`,
            'error'
          );
          return null as any;
        }
      } else if (prod.batches && prod.batches.length > 0) {
        // 2. Product has batches but no specific batch chosen (Auto FEFO):
        // Only consider valid (non-expired) batches with stock > 0
        const validBatches = prod.batches.filter(b => (b.stock || 0) > 0 && !isExpiredDate(b.expDate));
        const totalValidStock = validBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0);

        if (totalValidStock <= 0) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}" পণ্যের কোনো সচল (মেয়াদ ওকে) ব্যাচ অবশিষ্ট নেই! সমস্ত ব্যাচ মেয়াদোত্তীর্ণ হওয়ায় বিক্রয় সম্ভব নয়।`
              : `⚠️ No valid non-expired batches available for "${item.name}"! Expired batches cannot be sold.`,
            'error'
          );
          return null as any;
        }

        if (totalProdRequested > totalValidStock + 1e-6) {
          const expiredBatches = prod.batches.filter(b => (b.stock || 0) > 0 && isExpiredDate(b.expDate));
          const expiredStock = expiredBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0);
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}"-এর বিক্রয়যোগ্য (মেয়াদ ওকে) স্টক আছে মাত্র ${formatCleanNumber(totalValidStock)} ${prod.unit}${expiredStock > 0 ? ` (${formatCleanNumber(expiredStock)} ${prod.unit} মেয়াদোত্তীর্ণ ব্যাচে আটকে আছে)` : ''}। মোট বিক্রয় চাওয়া হয়েছে: ${formatCleanNumber(totalProdRequested)} ${prod.unit}!`
              : `⚠️ Insufficient valid stock for "${item.name}". Only ${formatCleanNumber(totalValidStock)} ${prod.unit} available in valid batches${expiredStock > 0 ? ` (${formatCleanNumber(expiredStock)} ${prod.unit} expired)` : ''}. Requested: ${formatCleanNumber(totalProdRequested)} ${prod.unit}`,
            'error'
          );
          return null as any;
        }
      } else {
        // 3. Simple product without multiple batches
        if (isExpiredDate(prod.expDate)) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}" পণ্যটির মেয়াদ উত্তীর্ণ হয়ে গেছে (Exp Date: ${prod.expDate})! মেয়াদোত্তীর্ণ পণ্য বিক্রয় করা যাবে না।`
              : `⚠️ "${item.name}" is expired (Exp Date: ${prod.expDate})! Expired products cannot be sold.`,
            'error'
          );
          return null as any;
        }

        if (prod.stock + 1e-6 < totalProdRequested) {
          showToast(
            language === 'bn'
              ? `অপর্যাপ্ত স্টক! "${item.name}" পণ্যের পর্যাপ্ত মজুদ নেই (মজুদ: ${formatCleanNumber(Number(prod.stock))} ${prod.unit}, চাওয়া হয়েছে: ${formatCleanNumber(totalProdRequested)} ${prod.unit})`
              : `Insufficient stock for "${item.name}". Current stock: ${formatCleanNumber(Number(prod.stock))} ${prod.unit}, requested: ${formatCleanNumber(totalProdRequested)} ${prod.unit}`,
            'error'
          );
          return null as any;
        }
      }
    }

    // Normalize pure Credit / DUE sale so Cash In Hand (wallet) is NEVER increased on credit sale
    const isPureCreditSale =
      data.paymentMethod === 'DUE' || data.walletId === 'due' || data.walletId === 'credit';
    const effectivePaidAmount = isPureCreditSale ? 0 : Math.max(0, Number(data.paidAmount || 0));
    const effectiveDueAmount = isPureCreditSale
      ? Math.max(0, Number(data.grandTotal || 0))
      : Math.max(0, Number(data.dueAmount ?? Math.max(0, Number(data.grandTotal || 0) - effectivePaidAmount)));
    const effectivePaymentMethod: PaymentMethod =
      effectivePaidAmount <= 0 && effectiveDueAmount > 0 ? 'DUE' : data.paymentMethod;
    const effectiveWalletId = effectivePaidAmount > 0 ? (data.walletId || wallets[0]?.id || 'w-cash') : 'due';

    // Customer Credit Limit Validation
    if (effectiveDueAmount > 0 && data.customerId && data.customerId !== 'walk-in') {
      const customer = parties.find(p => p.id === data.customerId);
      if (customer) {
        const creditCheck = checkCustomerCreditLimit(customer, effectiveDueAmount, installmentSchemes);
        if (!creditCheck.isAllowed) {
          showToast(
            language === 'bn'
              ? `⚠️ ক্রেডিট লিমিট অতিক্রম করেছে! গ্রাহক "${customer.name}"-এর অনুমোদিত লিমিট ৳${creditCheck.creditLimit.toLocaleString()}। বর্তমান বকেয়া ৳${creditCheck.currentDue.toLocaleString()} এবং নতুন চালান সহ মোট বকেয়া হবে ৳${creditCheck.projectedDue.toLocaleString()} (লিমিট থেকে ৳${creditCheck.exceededBy.toLocaleString()} বেশি)!`
              : `⚠️ Credit Limit Exceeded! Customer "${customer.name}" has limit of ৳${creditCheck.creditLimit.toLocaleString()}. Current due is ৳${creditCheck.currentDue.toLocaleString()} and projected total due will be ৳${creditCheck.projectedDue.toLocaleString()} (exceeds by ৳${creditCheck.exceededBy.toLocaleString()})!`,
            'error'
          );
          return null as any;
        }
      }
    }

    const rawInvNum = data.invoiceNumber?.trim();
    let invNum = rawInvNum || generateSaleInvoiceNumber(saleInvoices);

    // Duplicate Invoice No Validation - Auto-correct if duplicate
    const duplicateInv = checkDuplicateSaleInvoice(invNum, saleInvoices);
    if (duplicateInv) {
      invNum = generateSaleInvoiceNumber(saleInvoices);
      showToast(
        language === 'bn'
          ? `⚠️ পূর্বের ইনভয়েস নং ডুপ্লিকেট থাকায় স্বয়ংক্রিয়ভাবে নতুন ইনভয়েস নং (${invNum}) জেনারেট করা হয়েছে।`
          : `⚠️ Previous invoice number was duplicate, automatically generated new invoice number (${invNum}).`,
        'info'
      );
    }

    const invDate = data.date || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const selectedWallet = effectivePaidAmount > 0 ? wallets.find(w => w.id === effectiveWalletId) : undefined;

    let status: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID';
    if (effectiveDueAmount > 0 && effectivePaidAmount > 0) {
      status = 'PARTIAL';
    } else if (effectivePaidAmount === 0 && effectiveDueAmount > 0) {
      status = 'DUE';
    }

    const creatorName = currentUser?.fullName || currentUser?.username || 'Cashier';

    const newInvoice: SaleInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNum,
      date: invDate,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      discountType: data.discountType,
      vatAmount: data.vatAmount,
      grandTotal: data.grandTotal,
      paidAmount: effectivePaidAmount,
      dueAmount: effectiveDueAmount,
      paymentMethod: effectivePaymentMethod,
      walletId: effectiveWalletId,
      walletName:
        effectivePaidAmount > 0
          ? (selectedWallet?.name || 'Cash')
          : (language === 'bn' ? 'বাকী বিক্রয় (Credit)' : 'Due / Credit Sale'),
      status,
      notes: data.notes,
      cashierName: creatorName,
      createdBy: creatorName,
      completedBy: status === 'PAID' ? creatorName : undefined,
      contributors: [
        {
          action: 'Created Invoice',
          actionBn: 'চালান তৈরি',
          userName: creatorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${invDate} ${nowTime}`,
        },
        ...(status === 'PAID'
          ? [
              {
                action: 'Payment Received in Full',
                actionBn: 'সম্পূর্ণ পরিশোধিত',
                userName: creatorName,
                userId: currentUser?.id,
                userRole: currentUser?.role,
                timestamp: `${invDate} ${nowTime}`,
              },
            ]
          : []),
      ],
      isInstallmentSale: data.isInstallmentSale,
      installmentPlanId: data.installmentPlanId,
      createdAt: `${invDate} ${nowTime}`,
    };

    // 1. Decrease product stocks & deduct from specific/FEFO batches (ONLY VALID NON-EXPIRED BATCHES!)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const soldItems = data.items.filter(i => i.productId === prod.id);
        if (soldItems.length === 0) return prod;

        const updatedBatches = prod.batches ? [...prod.batches.map(b => ({ ...b }))] : [];
        let newStock = Number(prod.stock || 0);

        for (const itemSold of soldItems) {
          const soldBaseQty = getBaseQuantity(itemSold, prod);
          if (updatedBatches.length > 0) {
            let remQtyToDeduct = soldBaseQty;

            // If cashier explicitly selected a batch in the cart item
            if (itemSold.batchId) {
              const bIdx = updatedBatches.findIndex(b => b.id === itemSold.batchId);
              if (bIdx >= 0) {
                const deduct = Math.min(updatedBatches[bIdx].stock, remQtyToDeduct);
                updatedBatches[bIdx].stock = Math.max(0, Number((updatedBatches[bIdx].stock - deduct).toFixed(4)));
                remQtyToDeduct = Number((remQtyToDeduct - deduct).toFixed(4));
              }
            }

            // Deduct remaining qty using FEFO ONLY among VALID (NON-EXPIRED) batches!
            if (remQtyToDeduct > 1e-6) {
              const validBatchIndices = updatedBatches
                .map((b, idx) => ({ b, idx }))
                .filter(x => x.b.stock > 0 && !isExpiredDate(x.b.expDate))
                .sort((a, b) => {
                  if (a.b.expDate && b.b.expDate) return a.b.expDate.localeCompare(b.b.expDate);
                  if (a.b.expDate) return -1;
                  if (b.b.expDate) return 1;
                  return (a.b.purchaseDate || '').localeCompare(b.b.purchaseDate || '');
                });

              for (const batchItem of validBatchIndices) {
                if (remQtyToDeduct <= 1e-6) break;
                const available = updatedBatches[batchItem.idx].stock;
                const take = Math.min(available, remQtyToDeduct);
                updatedBatches[batchItem.idx].stock = Math.max(0, Number((available - take).toFixed(4)));
                remQtyToDeduct = Number((remQtyToDeduct - take).toFixed(4));
              }
            }
          }

          newStock = Math.max(0, Number((newStock - soldBaseQty).toFixed(4)));
        }

        const activeValidBatches = updatedBatches.filter(b => Number(b.stock) > 0 && !isExpiredDate(b.expDate));
        activeValidBatches.sort((a, b) => (a.expDate || '').localeCompare(b.expDate || ''));
        const earliestActiveExp = activeValidBatches[0]?.expDate || (prod.batches && prod.batches.length > 0 ? '' : prod.expDate) || '';

        return {
          ...prod,
          stock: newStock,
          batches: updatedBatches.length > 0 ? updatedBatches : undefined,
          expDate: earliestActiveExp,
        };
      })
    );

    // 2. Update Customer Due balance if there is due
    if (data.customerId && data.customerId !== 'walk-in' && effectiveDueAmount > 0 && effectivePaymentMethod !== 'INSTALLMENT' && !data.isInstallmentSale) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === data.customerId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + effectiveDueAmount).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Increase wallet balance (Cash In Hand) ONLY if actual cash/bank/MFS received (NEVER for DUE/Credit sale)
    if (effectivePaidAmount > 0 && !isPureCreditSale && selectedWallet) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          if (w.id === selectedWallet.id) {
            return {
              ...w,
              balance: Number((w.balance + effectivePaidAmount).toFixed(2)),
            };
          }
          return w;
        })
      );
    }

    // 4. Always log every sale in Day Book (Transaction Ledger)
    // - If effectivePaidAmount > 0, amount is effectivePaidAmount (wallet received funds)
    // - If credit sale (effectivePaidAmount = 0), amount is 0 so Cash In Hand / Money In does NOT increase!
    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const dayBookEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: invNum,
      date: invDate,
      type: 'SALE',
      flow: 'IN',
      partyId: data.customerId,
      partyName: data.customerName,
      partyType: 'CUSTOMER',
      amount: effectivePaidAmount, // ONLY actual received cash/bank/MFS! (0 if credit)
      walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'due',
      walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
      referenceId: newInvoice.id,
      referenceNo: invNum,
      remarks: data.notes 
        ? `Sale to ${data.customerName} (${data.notes})` 
        : effectivePaidAmount > 0
          ? `POS Sale receipt from ${data.customerName} (Total: ৳${data.grandTotal.toLocaleString()}, Received: ৳${effectivePaidAmount.toLocaleString()}${effectiveDueAmount > 0 ? `, Due: ৳${effectiveDueAmount.toLocaleString()}` : ''})`
          : `Credit Sale / বাকি বিক্রয় to ${data.customerName} (Total: ৳${data.grandTotal.toLocaleString()}, Due: ৳${effectiveDueAmount.toLocaleString()})`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${invDate} ${nowTime}`,
    };
    setDayBookEntries(prev => [dayBookEntry, ...prev]);

    setSaleInvoices(prev => [newInvoice, ...prev.filter(i => i.id !== newInvoice.id)]);

    // 5. Auto Register Warranty Records for items with warranty configuration
    const newWarrantyRecords: WarrantyRecord[] = [];
    data.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod && (prod.hasWarranty || item.warrantyInfo)) {
        const dur = prod.warrantyDuration || 1;
        const unit = prod.warrantyUnit || 'YEARS';
        const type = prod.warrantyType || 'REPLACEMENT';
        const serialNo = item.serialNumber || (prod.requiresSerialNo ? `SN-${Date.now().toString().slice(-6)}` : `SN-${Math.floor(100000 + Math.random() * 900000)}`);

        // Calculate Expiry Date
        const startDate = new Date(invDate);
        const expDateObj = new Date(startDate);
        if (unit === 'DAYS') expDateObj.setDate(expDateObj.getDate() + dur);
        else if (unit === 'MONTHS') expDateObj.setMonth(expDateObj.getMonth() + dur);
        else if (unit === 'YEARS') expDateObj.setFullYear(expDateObj.getFullYear() + dur);
        else if (unit === 'LIFETIME') expDateObj.setFullYear(expDateObj.getFullYear() + 100);

        const expDateStr = expDateObj.toISOString().split('T')[0];

        const rec: WarrantyRecord = {
          id: `war-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          warrantyCode: `WAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.invoiceNumber,
          saleDate: invDate,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || 'SKU-GEN',
          serialNumber: serialNo,
          customerId: data.customerId || 'walk-in',
          customerName: data.customerName,
          customerPhone: data.customerPhone || '',
          warrantyType: type,
          duration: dur,
          durationUnit: unit,
          startDate: invDate,
          expiryDate: expDateStr,
          status: 'ACTIVE',
          terms: prod.warrantyTerms || 'Standard Product Warranty',
          createdAt: `${invDate} ${nowTime}`,
        };
        newWarrantyRecords.push(rec);
      }
    });

    if (newWarrantyRecords.length > 0) {
      setWarrantyRecords(prev => [...newWarrantyRecords, ...prev]);
    }

    // Auto SMS on Sale
    if (smsConfig.enabled && smsConfig.autoSendOnSale && data.customerPhone && data.customerId !== 'walk-in') {
      sendSaleSms(newInvoice).catch(err => console.warn('Sale SMS trigger error:', err));
    }

    showToast(
      language === 'bn'
        ? `বিক্রয় ইনভয়েস ${invNum} সম্পন্ন হয়েছে!`
        : `Sale invoice ${invNum} created successfully!`
    );

    return newInvoice;
  };

  const updateSaleInvoice = (
    invoiceId: string,
    data: {
      invoiceNumber?: string;
      customerId: string;
      customerName: string;
      customerPhone: string;
      customerAddress?: string;
      items: CartItem[];
      subtotal: number;
      discount: number;
      discountType: 'percentage' | 'flat';
      vatAmount: number;
      grandTotal: number;
      paidAmount: number;
      dueAmount: number;
      paymentMethod: PaymentMethod;
      walletId: string;
      notes?: string;
      isInstallmentSale?: boolean;
      installmentPlanId?: string;
      date?: string;
    }
  ): SaleInvoice | null => {
    const oldInv = saleInvoices.find(i => i.id === invoiceId);
    if (!oldInv) {
      showToast(language === 'bn' ? 'চালানটি খুঁজে পাওয়া যায়নি!' : 'Invoice not found!', 'error');
      return null;
    }

    const rawInvNum = data.invoiceNumber?.trim() || oldInv.invoiceNumber;
    const otherInvoices = saleInvoices.filter(i => i.id !== invoiceId);
    const duplicateInv = checkDuplicateSaleInvoice(rawInvNum, otherInvoices);
    if (duplicateInv) {
      showToast(
        language === 'bn'
          ? `⚠️ ইনভয়েস নং "${rawInvNum}" ইতোমধ্যে অন্য চালানে ব্যবহৃত হয়েছে! অনুগ্রহ করে ভিন্ন নম্বর দিন।`
          : `⚠️ Invoice number "${rawInvNum}" is already used by another invoice!`,
        'error'
      );
      return null;
    }

    // Build virtual restored stock & batch stock from oldInv so editing existing items works accurately
    const restoredStockByProduct = new Map<string, number>();
    const restoredBatchesByProduct = new Map<string, ProductBatch[]>();
    const oldBatchQtyMap = new Map<string, number>();

    for (const prod of products) {
      const oldSoldItems = oldInv.items.filter(i => i.productId === prod.id);
      const clonedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : [];
      let virtualStock = Number(prod.stock || 0);

      for (const oldItem of oldSoldItems) {
        const oldBaseQty = getBaseQuantity(oldItem, prod);
        virtualStock = Number((virtualStock + oldBaseQty).toFixed(4));

        if (clonedBatches.length > 0) {
          let targetIdx = -1;
          if (oldItem.batchId) {
            targetIdx = clonedBatches.findIndex(b => b.id === oldItem.batchId);
            const batchKey = `${prod.id}::${oldItem.batchId}`;
            oldBatchQtyMap.set(batchKey, (oldBatchQtyMap.get(batchKey) || 0) + oldBaseQty);
          } else if (oldItem.batchNumber) {
            targetIdx = clonedBatches.findIndex(
              b => b.batchNumber.trim().toLowerCase() === oldItem.batchNumber!.trim().toLowerCase()
            );
          }
          if (targetIdx < 0) {
            targetIdx = clonedBatches.findIndex(b => !isExpiredDate(b.expDate));
          }
          if (targetIdx < 0) targetIdx = 0;

          if (targetIdx >= 0) {
            clonedBatches[targetIdx].stock = Number((clonedBatches[targetIdx].stock + oldBaseQty).toFixed(4));
          }
        }
      }

      restoredStockByProduct.set(prod.id, virtualStock);
      restoredBatchesByProduct.set(prod.id, clonedBatches);
    }

    // Validate new items against restored stock & expiry
    const requestedByProduct = new Map<string, number>();
    const requestedByBatch = new Map<string, number>();

    for (const item of data.items) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        showToast(language === 'bn' ? 'পণ্য পাওয়া যায়নি!' : 'Product not found!', 'error');
        return null;
      }

      const itemBaseQty = getBaseQuantity(item, prod);
      const totalProdRequested = (requestedByProduct.get(prod.id) || 0) + itemBaseQty;
      requestedByProduct.set(prod.id, totalProdRequested);

      const virtualBatches = restoredBatchesByProduct.get(prod.id) || [];
      const virtualStock = restoredStockByProduct.get(prod.id) ?? Number(prod.stock || 0);

      if (item.batchId && virtualBatches.length > 0) {
        const batch = virtualBatches.find(b => b.id === item.batchId);
        if (!batch) {
          showToast(
            language === 'bn'
              ? `"${item.name}" পণ্যের নির্ধারিত ব্যাচ পাওয়া যায়নি!`
              : `Batch not found for "${item.name}"!`,
            'error'
          );
          return null;
        }

        const batchReqKey = `${prod.id}::${item.batchId}`;
        const totalBatchRequested = (requestedByBatch.get(batchReqKey) || 0) + itemBaseQty;
        requestedByBatch.set(batchReqKey, totalBatchRequested);

        const prevBatchQty = oldBatchQtyMap.get(batchReqKey) || 0;
        if (isExpiredDate(batch.expDate) && totalBatchRequested > prevBatchQty + 1e-6) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}"-এর নির্বাচিত ব্যাচ "${batch.batchNumber}"-এর মেয়াদ শেষ (${batch.expDate})!`
              : `⚠️ Selected batch "${batch.batchNumber}" of "${item.name}" is expired (${batch.expDate})!`,
            'error'
          );
          return null;
        }

        if (batch.stock + 1e-6 < totalBatchRequested) {
          showToast(
            language === 'bn'
              ? `"${item.name}" পণ্যের ব্যাচ "${batch.batchNumber}"-এ পর্যাপ্ত মজুদ নেই (মজুদ: ${formatCleanNumber(batch.stock)} ${prod.unit}, বিক্রয় চাওয়া হয়েছে: ${formatCleanNumber(totalBatchRequested)} ${prod.unit})!`
              : `Insufficient stock in batch "${batch.batchNumber}" for "${item.name}" (Stock: ${formatCleanNumber(batch.stock)} ${prod.unit}, requested: ${formatCleanNumber(totalBatchRequested)} ${prod.unit})!`,
            'error'
          );
          return null;
        }
      } else if (virtualBatches.length > 0) {
        const validBatches = virtualBatches.filter(b => (b.stock || 0) > 0 && !isExpiredDate(b.expDate));
        const totalValidStock = validBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0);

        if (totalProdRequested > totalValidStock + 1e-6) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}"-এর বিক্রয়যোগ্য (মেয়াদ ওকে) স্টক আছে মাত্র ${formatCleanNumber(totalValidStock)} ${prod.unit}। মোট বিক্রয় চাওয়া হয়েছে: ${formatCleanNumber(totalProdRequested)} ${prod.unit}!`
              : `⚠️ Insufficient valid stock for "${item.name}". Only ${formatCleanNumber(totalValidStock)} ${prod.unit} available. Requested: ${formatCleanNumber(totalProdRequested)} ${prod.unit}`,
            'error'
          );
          return null;
        }
      } else {
        const oldProdQty = oldInv.items
          .filter(oi => oi.productId === prod.id)
          .reduce((s, oi) => s + getBaseQuantity(oi, prod), 0);
        if (isExpiredDate(prod.expDate) && totalProdRequested > oldProdQty + 1e-6) {
          showToast(
            language === 'bn'
              ? `⚠️ "${item.name}" পণ্যটির মেয়াদ উত্তীর্ণ হয়ে গেছে (Exp Date: ${prod.expDate})!`
              : `⚠️ "${item.name}" is expired (Exp Date: ${prod.expDate})!`,
            'error'
          );
          return null;
        }
        if (virtualStock + 1e-6 < totalProdRequested) {
          showToast(
            language === 'bn'
              ? `অপর্যাপ্ত স্টক! "${item.name}" পণ্যের পর্যাপ্ত মজুদ নেই (মজুদ: ${formatCleanNumber(virtualStock)} ${prod.unit}, চাওয়া হয়েছে: ${formatCleanNumber(totalProdRequested)} ${prod.unit})`
              : `Insufficient stock for "${item.name}". Available: ${formatCleanNumber(virtualStock)} ${prod.unit}, requested: ${formatCleanNumber(totalProdRequested)} ${prod.unit}`,
            'error'
          );
          return null;
        }
      }
    }

    const isPureCreditSale =
      data.paymentMethod === 'DUE' || data.walletId === 'due' || data.walletId === 'credit';
    const effectivePaidAmount = isPureCreditSale ? 0 : Math.max(0, Number(data.paidAmount || 0));
    const effectiveDueAmount = isPureCreditSale
      ? Math.max(0, Number(data.grandTotal || 0))
      : Math.max(0, Number(data.dueAmount ?? Math.max(0, Number(data.grandTotal || 0) - effectivePaidAmount)));
    const effectivePaymentMethod: PaymentMethod =
      effectivePaidAmount <= 0 && effectiveDueAmount > 0 ? 'DUE' : data.paymentMethod;
    const effectiveWalletId = effectivePaidAmount > 0 ? (data.walletId || wallets[0]?.id || 'w-cash') : 'due';

    // Net Customer Credit Limit Validation (subtracting oldInv due if same customer)
    if (
      effectiveDueAmount > 0 &&
      data.customerId &&
      data.customerId !== 'walk-in' &&
      effectivePaymentMethod !== 'INSTALLMENT' &&
      !data.isInstallmentSale
    ) {
      const customer = parties.find(p => p.id === data.customerId);
      if (customer) {
        const oldDueForSameCustomer =
          oldInv.customerId === data.customerId &&
          oldInv.dueAmount > 0 &&
          oldInv.paymentMethod !== 'INSTALLMENT' &&
          !oldInv.isInstallmentSale
            ? oldInv.dueAmount
            : 0;
        const netAddedDue = Number((effectiveDueAmount - oldDueForSameCustomer).toFixed(2));
        if (netAddedDue > 0) {
          const creditCheck = checkCustomerCreditLimit(customer, netAddedDue, installmentSchemes);
          if (!creditCheck.isAllowed) {
            showToast(
              language === 'bn'
                ? `⚠️ ক্রেডিট লিমিট অতিক্রম করেছে! গ্রাহক "${customer.name}"-এর অনুমোদিত লিমিট ৳${creditCheck.creditLimit.toLocaleString()}।`
                : `⚠️ Credit Limit Exceeded! Customer "${customer.name}" has limit of ৳${creditCheck.creditLimit.toLocaleString()}.`,
              'error'
            );
            return null;
          }
        }
      }
    }

    const invDate = data.date || oldInv.date || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const selectedWallet = effectivePaidAmount > 0 ? wallets.find(w => w.id === effectiveWalletId) : undefined;

    let status: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID';
    if (effectiveDueAmount > 0 && effectivePaidAmount > 0) {
      status = 'PARTIAL';
    } else if (effectivePaidAmount === 0 && effectiveDueAmount > 0) {
      status = 'DUE';
    }

    const editorName = currentUser?.fullName || currentUser?.username || 'Admin';

    const updatedInvoice: SaleInvoice = {
      ...oldInv,
      invoiceNumber: rawInvNum,
      date: invDate,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      discountType: data.discountType,
      vatAmount: data.vatAmount,
      grandTotal: data.grandTotal,
      paidAmount: effectivePaidAmount,
      dueAmount: effectiveDueAmount,
      paymentMethod: effectivePaymentMethod,
      walletId: effectiveWalletId,
      walletName:
        effectivePaidAmount > 0
          ? (selectedWallet?.name || 'Cash')
          : (language === 'bn' ? 'বাকী বিক্রয় (Credit)' : 'Due / Credit Sale'),
      status,
      notes: data.notes,
      updatedBy: editorName,
      completedBy: status === 'PAID' ? (oldInv.completedBy || editorName) : undefined,
      contributors: [
        ...(oldInv.contributors || []),
        {
          action: 'Updated Invoice',
          actionBn: 'চালান ইডিট / আপডেট',
          userName: editorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${invDate} ${nowTime}`,
        },
      ],
      isInstallmentSale: data.isInstallmentSale ?? oldInv.isInstallmentSale,
      installmentPlanId: data.installmentPlanId ?? oldInv.installmentPlanId,
    };

    // 1. Reconcile product stock & batches in a single atomic pass (revert oldInv, then deduct updated data.items)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const oldSoldItems = oldInv.items.filter(i => i.productId === prod.id);
        const newSoldItems = data.items.filter(i => i.productId === prod.id);
        if (oldSoldItems.length === 0 && newSoldItems.length === 0) return prod;

        const updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : [];
        let newStock = Number(prod.stock || 0);

        // Step A: Restore old invoice quantities
        for (const oldItem of oldSoldItems) {
          const oldBaseQty = getBaseQuantity(oldItem, prod);
          newStock = Number((newStock + oldBaseQty).toFixed(4));
          if (updatedBatches.length > 0) {
            let targetIdx = -1;
            if (oldItem.batchId) {
              targetIdx = updatedBatches.findIndex(b => b.id === oldItem.batchId);
            } else if (oldItem.batchNumber) {
              targetIdx = updatedBatches.findIndex(
                b => b.batchNumber.trim().toLowerCase() === oldItem.batchNumber!.trim().toLowerCase()
              );
            }
            if (targetIdx < 0) targetIdx = updatedBatches.findIndex(b => !isExpiredDate(b.expDate));
            if (targetIdx < 0) targetIdx = 0;
            if (targetIdx >= 0) {
              updatedBatches[targetIdx].stock = Number((updatedBatches[targetIdx].stock + oldBaseQty).toFixed(4));
            }
          }
        }

        // Step B: Deduct updated invoice quantities
        for (const itemSold of newSoldItems) {
          const soldBaseQty = getBaseQuantity(itemSold, prod);
          if (updatedBatches.length > 0) {
            let remQtyToDeduct = soldBaseQty;
            if (itemSold.batchId) {
              const bIdx = updatedBatches.findIndex(b => b.id === itemSold.batchId);
              if (bIdx >= 0) {
                const deduct = Math.min(updatedBatches[bIdx].stock, remQtyToDeduct);
                updatedBatches[bIdx].stock = Math.max(0, Number((updatedBatches[bIdx].stock - deduct).toFixed(4)));
                remQtyToDeduct = Number((remQtyToDeduct - deduct).toFixed(4));
              }
            }
            if (remQtyToDeduct > 1e-6) {
              const validBatchIndices = updatedBatches
                .map((b, idx) => ({ b, idx }))
                .filter(x => x.b.stock > 0 && !isExpiredDate(x.b.expDate))
                .sort((a, b) => {
                  if (a.b.expDate && b.b.expDate) return a.b.expDate.localeCompare(b.b.expDate);
                  if (a.b.expDate) return -1;
                  if (b.b.expDate) return 1;
                  return (a.b.purchaseDate || '').localeCompare(b.b.purchaseDate || '');
                });
              for (const batchItem of validBatchIndices) {
                if (remQtyToDeduct <= 1e-6) break;
                const available = updatedBatches[batchItem.idx].stock;
                const take = Math.min(available, remQtyToDeduct);
                updatedBatches[batchItem.idx].stock = Math.max(0, Number((available - take).toFixed(4)));
                remQtyToDeduct = Number((remQtyToDeduct - take).toFixed(4));
              }
            }
          }
          newStock = Math.max(0, Number((newStock - soldBaseQty).toFixed(4)));
        }

        const activeValidBatches = updatedBatches.filter(b => Number(b.stock) > 0 && !isExpiredDate(b.expDate));
        activeValidBatches.sort((a, b) => (a.expDate || '').localeCompare(b.expDate || ''));
        const earliestActiveExp =
          activeValidBatches[0]?.expDate || (prod.batches && prod.batches.length > 0 ? '' : prod.expDate) || '';

        return {
          ...prod,
          stock: newStock,
          batches: updatedBatches.length > 0 ? updatedBatches : undefined,
          expDate: earliestActiveExp,
        };
      })
    );

    // 2. Reconcile Customer Due Balance in a single pass
    const oldAffectsParty =
      Boolean(oldInv.customerId) &&
      oldInv.customerId !== 'walk-in' &&
      oldInv.dueAmount > 0 &&
      oldInv.paymentMethod !== 'INSTALLMENT' &&
      !oldInv.isInstallmentSale;
    const newAffectsParty =
      Boolean(data.customerId) &&
      data.customerId !== 'walk-in' &&
      effectiveDueAmount > 0 &&
      effectivePaymentMethod !== 'INSTALLMENT' &&
      !data.isInstallmentSale;

    if (oldAffectsParty || newAffectsParty) {
      setParties(prevParties =>
        prevParties.map(p => {
          let bal = p.currentBalance;
          if (oldAffectsParty && p.id === oldInv.customerId) {
            bal = Math.max(0, Number((bal - oldInv.dueAmount).toFixed(2)));
          }
          if (newAffectsParty && p.id === data.customerId) {
            bal = Number((bal + effectiveDueAmount).toFixed(2));
          }
          return bal !== p.currentBalance ? { ...p, currentBalance: bal } : p;
        })
      );
    }

    // 3. Reconcile Wallet Balance in a single pass
    const oldAffectsWallet =
      oldInv.paidAmount > 0 &&
      oldInv.paymentMethod !== 'DUE' &&
      Boolean(oldInv.walletId) &&
      oldInv.walletId !== 'due' &&
      oldInv.walletId !== 'credit';
    const newAffectsWallet = effectivePaidAmount > 0 && !isPureCreditSale && Boolean(selectedWallet);

    if (oldAffectsWallet || newAffectsWallet) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          let bal = w.balance;
          if (oldAffectsWallet && w.id === oldInv.walletId) {
            bal = Math.max(0, Number((bal - oldInv.paidAmount).toFixed(2)));
          }
          if (newAffectsWallet && selectedWallet && w.id === selectedWallet.id) {
            bal = Number((bal + effectivePaidAmount).toFixed(2));
          }
          return bal !== w.balance ? { ...w, balance: bal } : w;
        })
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 4. Update linked DayBook Entry IN-PLACE & collapse any duplicate entries for this sale invoice
    const updatedDayBookRemarks = data.notes
      ? `Sale to ${data.customerName} (${data.notes})`
      : effectivePaidAmount > 0
        ? `POS Sale receipt from ${data.customerName} (Total: ৳${data.grandTotal.toLocaleString()}, Received: ৳${effectivePaidAmount.toLocaleString()}${effectiveDueAmount > 0 ? `, Due: ৳${effectiveDueAmount.toLocaleString()}` : ''})`
        : `Credit Sale / বাকি বিক্রয় to ${data.customerName} (Total: ৳${data.grandTotal.toLocaleString()}, Due: ৳${effectiveDueAmount.toLocaleString()})`;

    const isSaleDayBookMatch = (d: DayBookEntry) =>
      d.type === 'SALE' &&
      (d.referenceId === invoiceId ||
        d.id === `db-sale-${invoiceId}` ||
        d.voucherNo === oldInv.invoiceNumber ||
        d.referenceNo === oldInv.invoiceNumber ||
        d.voucherNo === rawInvNum ||
        d.referenceNo === rawInvNum);

    const matchingSaleDbEntries = dayBookEntries.filter(isSaleDayBookMatch);
    const extraSaleDbIds = matchingSaleDbEntries.slice(1).map(d => d.id);
    if (extraSaleDbIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', extraSaleDbIds);
    }

    setDayBookEntries(prev => {
      const firstMatchIdx = prev.findIndex(isSaleDayBookMatch);
      if (firstMatchIdx >= 0) {
        const primaryId = prev[firstMatchIdx].id;
        return prev
          .filter(d => !isSaleDayBookMatch(d) || d.id === primaryId)
          .map(d =>
            d.id === primaryId
              ? {
                  ...d,
                  referenceId: invoiceId,
                  voucherNo: rawInvNum,
                  referenceNo: rawInvNum,
                  date: invDate,
                  partyId: data.customerId,
                  partyName: data.customerName,
                  amount: effectivePaidAmount,
                  walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'due',
                  walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
                  remarks: updatedDayBookRemarks,
                }
              : d
          );
      }
      return [
        {
          id: `db-${Date.now()}`,
          voucherNo: rawInvNum,
          date: invDate,
          type: 'SALE',
          flow: 'IN',
          partyId: data.customerId,
          partyName: data.customerName,
          partyType: 'CUSTOMER',
          amount: effectivePaidAmount,
          walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'due',
          walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
          referenceId: invoiceId,
          referenceNo: rawInvNum,
          remarks: updatedDayBookRemarks,
          createdBy: currentUser?.id || 'usr-1',
          createdAt: `${invDate} ${nowTime}`,
        },
        ...prev,
      ];
    });

    // 5. Update SaleInvoice IN-PLACE & deduplicate by ID (NEVER append/duplicate!)
    setSaleInvoices(prev => dedupeById(prev.map(inv => (inv.id === invoiceId ? updatedInvoice : inv))));

    // 5.5 Sync updated Invoice # across linked Returns, Installments, and Warranty Claims
    if (rawInvNum !== oldInv.invoiceNumber) {
      setSaleReturns(prev =>
        prev.map(r =>
          r.invoiceId === invoiceId || r.originalInvoiceNumber === oldInv.invoiceNumber
            ? { ...r, originalInvoiceNumber: rawInvNum }
            : r
        )
      );
      setInstallmentSchemes(prev =>
        prev.map(s =>
          s.invoiceId === invoiceId || s.invoiceNumber === oldInv.invoiceNumber
            ? { ...s, invoiceNumber: rawInvNum }
            : s
        )
      );
      setWarrantyClaims(prev =>
        prev.map(c =>
          c.invoiceNumber === oldInv.invoiceNumber
            ? { ...c, invoiceNumber: rawInvNum }
            : c
        )
      );
    }

    // 6. Sync Warranty Records cleanly for this invoice
    const rebuiltWarranties: WarrantyRecord[] = [];
    data.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod && (prod.hasWarranty || item.warrantyInfo)) {
        const dur = prod.warrantyDuration || 1;
        const unit = prod.warrantyUnit || 'YEARS';
        const type = prod.warrantyType || 'REPLACEMENT';
        const existingRec = warrantyRecords.find(
          w => w.invoiceId === invoiceId && w.productId === prod.id
        );
        const serialNo =
          item.serialNumber ||
          existingRec?.serialNumber ||
          `SN-${Math.floor(100000 + Math.random() * 900000)}`;

        const startDate = new Date(invDate);
        const expDateObj = new Date(startDate);
        if (unit === 'DAYS') expDateObj.setDate(expDateObj.getDate() + dur);
        else if (unit === 'MONTHS') expDateObj.setMonth(expDateObj.getMonth() + dur);
        else if (unit === 'YEARS') expDateObj.setFullYear(expDateObj.getFullYear() + dur);
        else if (unit === 'LIFETIME') expDateObj.setFullYear(expDateObj.getFullYear() + 100);

        rebuiltWarranties.push({
          id: existingRec?.id || `war-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          warrantyCode: existingRec?.warrantyCode || `WAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          saleDate: invDate,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || 'SKU-GEN',
          serialNumber: serialNo,
          customerId: data.customerId || 'walk-in',
          customerName: data.customerName,
          customerPhone: data.customerPhone || '',
          warrantyType: type,
          duration: dur,
          durationUnit: unit,
          startDate: invDate,
          expiryDate: expDateObj.toISOString().split('T')[0],
          status: existingRec?.status || 'ACTIVE',
          terms: prod.warrantyTerms || 'Standard Product Warranty',
          createdAt: existingRec?.createdAt || `${invDate} ${nowTime}`,
        });
      }
    });
    setWarrantyRecords(prev => [...rebuiltWarranties, ...prev.filter(w => w.invoiceId !== invoiceId)]);

    showToast(
      language === 'bn'
        ? `বিক্রয় ইনভয়েস ${rawInvNum} সফলভাবে আপডেট হয়েছে!`
        : `Sale invoice ${rawInvNum} updated successfully!`
    );

    return updatedInvoice;
  };

  const deleteSaleInvoice = (invoiceId: string, reason?: string): boolean => {
    const inv = saleInvoices.find(i => i.id === invoiceId);
    if (!inv) {
      showToast(language === 'bn' ? 'চালানটি খুঁজে পাওয়া যায়নি!' : 'Invoice not found!', 'error');
      return false;
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const nowStr = formatDeletionTimestamp();
    const adminDeleting = isAdminUser();
    const finalReason =
      reason?.trim() ||
      (adminDeleting
        ? (language === 'bn' ? 'অ্যাডমিন কর্তৃক চালান মুছে ফেলা হয়েছে' : 'Invoice deleted by Admin')
        : (language === 'bn' ? 'ইউজার কর্তৃক চালান মুছে ফেলা হয়েছে' : 'Invoice deleted by user'));

    // Collect any Sale Returns & Installment Schemes linked to this invoice so nothing is orphaned
    const linkedSaleReturns = saleReturns.filter(
      r => r.invoiceId === inv.id || r.originalInvoiceNumber === inv.invoiceNumber
    );
    const linkedReturnIds = new Set(linkedSaleReturns.map(r => r.id));
    const linkedReturnVoucherNos = new Set(linkedSaleReturns.map(r => r.returnNumber));

    const linkedSchemes: InstallmentScheme[] =
      inv.installmentPlanId || inv.isInstallmentSale
        ? installmentSchemes.filter(
            s => s.invoiceId === inv.id || s.invoiceNumber === inv.invoiceNumber || s.id === inv.installmentPlanId
          )
        : [];
    const linkedSchemeIds = new Set<string>(linkedSchemes.map(s => s.id));
    const linkedSchemeNums = new Set<string>(linkedSchemes.map(s => s.schemeNumber));
    const linkedEmiReceiptNos = new Set(
      linkedSchemes.flatMap(s => (s.schedules || []).map(sc => sc.receiptVoucherNo).filter(Boolean) as string[])
    );

    // 1. Always save to in-app deletedSaleInvoices (Delete List) for BOTH Admin and Staff
    const deletedRecord: DeletedSaleInvoice = {
      id: `del-inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalInvoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      customerId: inv.customerId,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerAddress: inv.customerAddress,
      items: inv.items || [],
      subtotal: inv.subtotal,
      discount: inv.discount,
      vatAmount: inv.vatAmount,
      grandTotal: inv.grandTotal,
      paidAmount: inv.paidAmount,
      dueAmount: inv.dueAmount,
      paymentMethod: inv.paymentMethod,
      walletId: inv.walletId,
      walletName: inv.walletName,
      cashierName: inv.cashierName,
      createdBy: inv.createdBy,
      deletedAt: nowStr,
      deletedBy: {
        id: currentUser?.id || 'usr-1',
        username: currentUser?.username || (adminDeleting ? 'admin' : 'staff'),
        fullName: currentUser?.fullName || (adminDeleting ? 'Super Admin' : 'Staff'),
        role: currentUser?.role || (adminDeleting ? 'ADMIN' : 'SALESMAN'),
      },
      deletionReason: finalReason,
      invoiceSnapshot: JSON.parse(JSON.stringify(inv)),
      ...(linkedSaleReturns.length > 0 ? { linkedSaleReturns: JSON.parse(JSON.stringify(linkedSaleReturns)) } : {}),
      ...(linkedSchemes.length > 0 ? { linkedInstallmentSchemes: JSON.parse(JSON.stringify(linkedSchemes)) } : {}),
    };

    setDeletedSaleInvoices(prev => {
      const updated = [deletedRecord, ...prev];
      try {
        localStorage.setItem('DOKANPRO_DELETED_INVOICES_ARCHIVE', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to standalone deleted invoice archive', e);
      }
      return updated;
    });

    // 2. Revert product stocks & batches (add ONLY net un-returned quantities back into stock)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const soldItems = inv.items.filter(i => i.productId === prod.id);
        if (soldItems.length === 0) return prod;

        const totalSoldBaseQty = soldItems.reduce((sum, i) => sum + getBaseQuantity(i, prod), 0);
        const alreadyReturnedBaseQty = linkedSaleReturns.reduce((retSum, r) => {
          const matchingRetItems = (r.items || []).filter(ri => ri.productId === prod.id);
          return (
            retSum +
            matchingRetItems.reduce(
              (s, ri) =>
                s +
                getBaseQuantity(
                  {
                    quantity: ri.returnQuantity,
                    unit: ri.unit,
                    conversionFactor: ri.conversionFactor,
                    baseQuantity: ri.baseQuantity,
                  },
                  prod
                ),
              0
            )
          );
        }, 0);

        const netQtyToRestore = Math.max(0, Number((totalSoldBaseQty - alreadyReturnedBaseQty).toFixed(4)));
        if (netQtyToRestore <= 0) return prod;

        const updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
        if (updatedBatches && updatedBatches.length > 0) {
          let remToRestore = netQtyToRestore;
          for (const soldItem of soldItems) {
            if (remToRestore <= 1e-6) break;
            const itemBase = getBaseQuantity(soldItem, prod);
            const restoreAmt = Math.min(itemBase, remToRestore);
            let targetIdx = -1;
            if (soldItem.batchId) {
              targetIdx = updatedBatches.findIndex(b => b.id === soldItem.batchId);
            }
            if (targetIdx < 0 && soldItem.batchNumber) {
              targetIdx = updatedBatches.findIndex(
                b => b.batchNumber.trim().toLowerCase() === soldItem.batchNumber!.trim().toLowerCase()
              );
            }
            if (targetIdx < 0) targetIdx = updatedBatches.findIndex(b => !isExpiredDate(b.expDate));
            if (targetIdx < 0) targetIdx = 0;
            if (targetIdx >= 0 && restoreAmt > 0) {
              updatedBatches[targetIdx].stock = Number((Number(updatedBatches[targetIdx].stock || 0) + restoreAmt).toFixed(4));
              remToRestore = Number((remToRestore - restoreAmt).toFixed(4));
            }
          }
          if (remToRestore > 1e-6) {
            updatedBatches[0].stock = Number((Number(updatedBatches[0].stock || 0) + remToRestore).toFixed(4));
          }
        }

        const activeBatchesWithExp = (updatedBatches || []).filter(b => Number(b.stock) > 0 && b.expDate);
        activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
        const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

        return {
          ...prod,
          stock: Number((prod.stock + netQtyToRestore).toFixed(4)),
          ...(updatedBatches ? { batches: updatedBatches, expDate: earliestActiveExp } : {}),
        };
      })
    );

    // 3. Adjust Customer Due balance if this invoice increased customer's due
    if (inv.customerId && inv.customerId !== 'walk-in' && inv.dueAmount > 0 && inv.paymentMethod !== 'INSTALLMENT' && !inv.isInstallmentSale) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === inv.customerId) {
            return {
              ...p,
              currentBalance: Math.max(0, Number((p.currentBalance - inv.dueAmount).toFixed(2))),
            };
          }
          return p;
        })
      );
    }

    // 4. Identify linked DayBook entries BEFORE filtering them out
    const isLinkedSaleDb = (d: DayBookEntry) =>
      (d.type === 'SALE' && (d.referenceId === inv.id || d.id === `db-sale-${inv.id}`)) ||
      d.voucherNo === inv.invoiceNumber ||
      d.referenceNo === inv.invoiceNumber ||
      (d.type === 'SALE_RETURN' &&
        (linkedReturnVoucherNos.has(d.voucherNo) || d.referenceId === inv.id || d.referenceNo === inv.invoiceNumber)) ||
      (d.type === 'EMI_COLLECTION' &&
        (linkedSchemeNums.has(d.voucherNo) ||
          (d.referenceNo ? linkedSchemeNums.has(d.referenceNo) : false) ||
          linkedEmiReceiptNos.has(d.voucherNo)));

    const linkedDbEntries = dayBookEntries.filter(isLinkedSaleDb);
    const linkedSaleDbEntries = linkedDbEntries.filter(d => d.type === 'SALE' && d.flow === 'IN');
    const linkedSaleDbCashMax = linkedSaleDbEntries.reduce((mx, d) => Math.max(mx, Number(d.amount || 0)), 0);
    const paidToRevert = Math.max(Number(inv.paidAmount || 0), linkedSaleDbCashMax);

    const linkedSaleDbWalletEntry = linkedSaleDbEntries.find(
      d => d.walletId && !NON_CASH_WALLET_IDS.has(String(d.walletId).toLowerCase())
    );
    const saleWalletHint =
      inv.walletId && !NON_CASH_WALLET_IDS.has(String(inv.walletId).toLowerCase())
        ? inv.walletId
        : linkedSaleDbWalletEntry?.walletId;
    const saleWalletNameHint =
      inv.walletName && inv.walletName !== 'Credit / বাকি'
        ? inv.walletName
        : linkedSaleDbWalletEntry?.walletName;

    // Also compute collected EMI payments tied to this invoice's installment schemes
    const emiCollectionsToRevert: Array<{ amount: number; walletId?: string; walletName?: string }> = [];
    if (linkedSchemes.length > 0) {
      const countedReceiptNos = new Set<string>();
      for (const dbEmi of linkedDbEntries.filter(d => d.type === 'EMI_COLLECTION' && d.flow === 'IN')) {
        const amt = Number(dbEmi.amount || 0);
        // Avoid double-counting downpayment if inv.paidAmount already reverted it
        const isDownPaymentDuplicate =
          paidToRevert > 0 &&
          linkedSchemeNums.has(dbEmi.voucherNo) &&
          linkedSchemes.some(s => s.schemeNumber === dbEmi.voucherNo && Math.abs(Number(s.downPayment || 0) - amt) < 0.01);
        if (amt > 0 && !isDownPaymentDuplicate) {
          emiCollectionsToRevert.push({ amount: amt, walletId: dbEmi.walletId, walletName: dbEmi.walletName });
          countedReceiptNos.add(dbEmi.voucherNo);
        }
      }
      for (const sc of linkedSchemes) {
        for (const sched of sc.schedules || []) {
          if (sched.status === 'PAID') {
            const schedTotal = Number(sched.paidAmount || sched.amount || 0) + Number(sched.penalty || 0);
            if (schedTotal > 0 && (!sched.receiptVoucherNo || !countedReceiptNos.has(sched.receiptVoucherNo))) {
              emiCollectionsToRevert.push({ amount: schedTotal, walletId: sched.walletId });
            }
          }
        }
      }
    }

    // 5. Revert ALL Cash In Hand / Wallet balances received from this invoice (cash/partial/EMI)
    if (paidToRevert > 0 || emiCollectionsToRevert.length > 0) {
      setWallets(prevWallets => {
        let next = prevWallets;
        if (paidToRevert > 0) {
          next = deductAmountFromWallets(next, paidToRevert, saleWalletHint, saleWalletNameHint);
        }
        for (const col of emiCollectionsToRevert) {
          next = deductAmountFromWallets(next, col.amount, col.walletId, col.walletName);
        }
        return next;
      });
    }

    // 6. Remove & tombstone ALL linked DayBook entries, Sale Returns & Installment Schemes
    const removedDayBookIds = linkedDbEntries.map(d => d.id);
    setDayBookEntries(prev => prev.filter(d => !isLinkedSaleDb(d)));
    if (removedDayBookIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }

    if (linkedSaleReturns.length > 0) {
      setSaleReturns(prev => prev.filter(r => !linkedReturnIds.has(r.id) && !linkedReturnVoucherNos.has(r.returnNumber)));
      recordDeletedTombstones('saleReturns', [
        ...linkedSaleReturns.map(r => r.id),
        ...linkedSaleReturns.map(r => r.returnNumber),
      ]);
    }

    if (linkedSchemes.length > 0) {
      setInstallmentSchemes(prev => prev.filter(s => !linkedSchemeIds.has(s.id)));
      recordDeletedTombstones('installmentSchemes', Array.from(linkedSchemeIds));
    }

    // 7. Remove invoice from active sales state & tombstone so it never resurrects on sync/reload
    setSaleInvoices(prev => prev.filter(i => i.id !== invoiceId));
    recordDeletedTombstones('saleInvoices', [inv.id, inv.invoiceNumber]);

    // 8. Log Activity (Delete List now holds both Admin and Staff deletions; SQL file archiving happens when deleted from Delete List)
    logActivity({
      actionType: 'DELETE',
      title: `Deleted Sale Invoice #${inv.invoiceNumber}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted invoice #${inv.invoiceNumber} for ${inv.customerName} (৳${inv.grandTotal.toLocaleString()}). Reason: ${finalReason}`,
      severity: 'danger',
      targetId: inv.id,
      targetName: `Sale Invoice #${inv.invoiceNumber}`,
    });

    showToast(
      language === 'bn'
        ? `চালান #${inv.invoiceNumber} সফলভাবে ডিলিট লিস্টে (Delete Invoice Archive) রাখা হয়েছে! সেখান থেকে ডিলিট করলে আলাদা SQL ফাইলে জমা থাকবে।`
        : `Invoice #${inv.invoiceNumber} moved to Deleted Invoices list! Deleting from there saves it to separate SQL archive.`,
      'success'
    );

    return true;
  };

  const applyRestoredSaleInvoice = (
    restoredInv: SaleInvoice,
    linkedReturns: SaleReturn[] = [],
    linkedSchemes: InstallmentScheme[] = []
  ): boolean => {
    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 1. Deduct net un-returned sold stock & batches (in base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const soldItems = (restoredInv.items || []).filter(i => i.productId === prod.id);
        if (soldItems.length === 0) return prod;
        const totalSoldBaseQty = soldItems.reduce((sum, i) => sum + getBaseQuantity(i, prod), 0);
        const alreadyReturnedBaseQty = linkedReturns.reduce((retSum, r) => {
          const matchingRetItems = (r.items || []).filter(ri => ri.productId === prod.id);
          return (
            retSum +
            matchingRetItems.reduce(
              (s, ri) =>
                s +
                getBaseQuantity(
                  {
                    quantity: ri.returnQuantity,
                    unit: ri.unit,
                    conversionFactor: ri.conversionFactor,
                    baseQuantity: ri.baseQuantity,
                  },
                  prod
                ),
              0
            )
          );
        }, 0);
        const netSoldToDeduct = Math.max(0, Number((totalSoldBaseQty - alreadyReturnedBaseQty).toFixed(4)));
        if (netSoldToDeduct <= 0) return prod;

        const updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
        if (updatedBatches && updatedBatches.length > 0) {
          let remToDeduct = netSoldToDeduct;
          for (const soldItem of soldItems) {
            if (remToDeduct <= 1e-6) break;
            let itemRem = Math.min(getBaseQuantity(soldItem, prod), remToDeduct);
            if (soldItem.batchId) {
              const bIdx = updatedBatches.findIndex(b => b.id === soldItem.batchId);
              if (bIdx >= 0 && updatedBatches[bIdx].stock > 0) {
                const take = Math.min(updatedBatches[bIdx].stock, itemRem);
                updatedBatches[bIdx].stock = Math.max(0, Number((updatedBatches[bIdx].stock - take).toFixed(4)));
                itemRem = Number((itemRem - take).toFixed(4));
                remToDeduct = Number((remToDeduct - take).toFixed(4));
              }
            }
            for (let i = 0; i < updatedBatches.length && itemRem > 1e-6; i++) {
              const avail = Number(updatedBatches[i].stock || 0);
              if (avail > 0) {
                const take = Math.min(avail, itemRem);
                updatedBatches[i].stock = Math.max(0, Number((avail - take).toFixed(4)));
                itemRem = Number((itemRem - take).toFixed(4));
                remToDeduct = Number((remToDeduct - take).toFixed(4));
              }
            }
          }
        }
        return {
          ...prod,
          stock: Math.max(0, Number((prod.stock - netSoldToDeduct).toFixed(4))),
          ...(updatedBatches ? { batches: updatedBatches } : {}),
        };
      })
    );

    // 2. Re-apply customer due if any
    if (
      restoredInv.customerId &&
      restoredInv.customerId !== 'walk-in' &&
      restoredInv.dueAmount > 0 &&
      restoredInv.paymentMethod !== 'INSTALLMENT' &&
      !restoredInv.isInstallmentSale
    ) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === restoredInv.customerId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + restoredInv.dueAmount).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Re-apply wallet balance (net paid + any collected installment schedules)
    setWallets(prevWallets => {
      let next = prevWallets;
      if (Number(restoredInv.paidAmount || 0) > 0 && restoredInv.paymentMethod !== 'DUE') {
        next = creditAmountToWallets(next, restoredInv.paidAmount, restoredInv.walletId, restoredInv.walletName);
      }
      for (const sc of linkedSchemes) {
        for (const sched of sc.schedules || []) {
          if (sched.status === 'PAID') {
            const schedTotal = Number(sched.paidAmount || sched.amount || 0) + Number(sched.penalty || 0);
            if (schedTotal > 0) {
              next = creditAmountToWallets(next, schedTotal, sched.walletId);
            }
          }
        }
      }
      return next;
    });

    // 4. Put back into active saleInvoices, linked returns/schemes & clear tombstones + restore SALE DayBook entry
    removeDeletedTombstones('saleInvoices', [restoredInv.id, restoredInv.invoiceNumber]);
    removeDeletedTombstones('dayBookEntries', [`db-sale-${restoredInv.id}`]);
    setSaleInvoices(prev => [restoredInv, ...prev.filter(i => i.id !== restoredInv.id)]);

    if (linkedReturns.length > 0) {
      removeDeletedTombstones(
        'saleReturns',
        linkedReturns.flatMap(r => [r.id, r.returnNumber])
      );
      setSaleReturns(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const toAdd = linkedReturns.filter(r => !existingIds.has(r.id));
        return [...toAdd, ...prev];
      });
    }

    if (linkedSchemes.length > 0) {
      removeDeletedTombstones('installmentSchemes', linkedSchemes.map(s => s.id));
      setInstallmentSchemes(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const toAdd = linkedSchemes.filter(s => !existingIds.has(s.id));
        return [...toAdd, ...prev];
      });
    }

    setDayBookEntries(prev => {
      const exists = prev.some(
        d =>
          d.type === 'SALE' &&
          (d.referenceId === restoredInv.id ||
            d.id === `db-sale-${restoredInv.id}` ||
            d.voucherNo === restoredInv.invoiceNumber)
      );
      if (exists) return prev;
      const resolvedWalletId =
        restoredInv.paidAmount > 0 && restoredInv.walletId && !NON_CASH_WALLET_IDS.has(restoredInv.walletId)
          ? restoredInv.walletId
          : restoredInv.paidAmount > 0
            ? 'w-cash'
            : 'due';
      const resolvedWalletName =
        restoredInv.paidAmount > 0
          ? (wallets.find(w => w.id === resolvedWalletId)?.name || restoredInv.walletName || 'Cash')
          : 'Credit / বাকি';
      const restoredDbEntry: DayBookEntry = {
        id: `db-sale-${restoredInv.id}`,
        voucherNo: restoredInv.invoiceNumber,
        date: restoredInv.date,
        type: 'SALE',
        flow: 'IN',
        partyId: restoredInv.customerId,
        partyName: restoredInv.customerName,
        partyType: 'CUSTOMER',
        amount: restoredInv.paidAmount || 0,
        walletId: resolvedWalletId,
        walletName: resolvedWalletName,
        referenceId: restoredInv.id,
        referenceNo: restoredInv.invoiceNumber,
        remarks:
          restoredInv.paidAmount > 0
            ? `POS Sale receipt from ${restoredInv.customerName} (Total: ৳${restoredInv.grandTotal.toLocaleString()}, Received: ৳${restoredInv.paidAmount.toLocaleString()}${restoredInv.dueAmount > 0 ? `, Due: ৳${restoredInv.dueAmount.toLocaleString()}` : ''})`
            : `Credit Sale / বাকি বিক্রয় to ${restoredInv.customerName} (Total: ৳${restoredInv.grandTotal.toLocaleString()}, Due: ৳${restoredInv.dueAmount.toLocaleString()})`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: restoredInv.createdAt || `${restoredInv.date} 12:00:00`,
      };
      return [restoredDbEntry, ...prev];
    });

    return true;
  };

  const restoreDeletedSaleInvoice = (deletedInvoiceId: string): boolean => {
    const record = deletedSaleInvoices.find(d => d.id === deletedInvoiceId || d.originalInvoiceId === deletedInvoiceId);
    if (!record || !record.invoiceSnapshot) {
      showToast(language === 'bn' ? 'ডিলিট করা চালানটি পাওয়া যায়নি!' : 'Deleted invoice record not found!', 'error');
      return false;
    }

    const restoredInv: SaleInvoice = record.invoiceSnapshot;
    applyRestoredSaleInvoice(
      restoredInv,
      record.linkedSaleReturns || [],
      record.linkedInstallmentSchemes || []
    );

    // Remove from deletedSaleInvoices
    recordDeletedTombstones('deletedSaleInvoices', [record.id]);
    setDeletedSaleInvoices(prev => {
      const updated = prev.filter(d => d.id !== record.id);
      try {
        localStorage.setItem('DOKANPRO_DELETED_INVOICES_ARCHIVE', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Log Activity
    logActivity({
      actionType: 'USER_ACTION',
      title: `Restored Sale Invoice #${restoredInv.invoiceNumber}`,
      description: `User '${currentUser?.fullName || 'Admin'}' restored deleted invoice #${restoredInv.invoiceNumber} for ${restoredInv.customerName} (৳${restoredInv.grandTotal.toLocaleString()}).`,
      severity: 'info',
      targetId: restoredInv.id,
      targetName: `Sale Invoice #${restoredInv.invoiceNumber}`,
    });

    showToast(
      language === 'bn'
        ? `চালান #${restoredInv.invoiceNumber} সফলভাবে পুনরুদ্ধার (Restore) করা হয়েছে!`
        : `Invoice #${restoredInv.invoiceNumber} restored successfully!`,
      'success'
    );

    return true;
  };

  const permanentlyDeleteArchivedInvoice = (deletedInvoiceId: string): boolean => {
    if (currentUser?.role !== 'ADMIN') {
      showToast(
        language === 'bn'
          ? 'অনুমতি নেই! ডিলিটকৃত চালান শুধুমাত্র অ্যাডমিন স্থায়ীভাবে মুছে ফেলতে পারবেন।'
          : 'Permission denied! Only Admin can permanently delete archived invoices.',
        'error'
      );
      return false;
    }

    const record = deletedSaleInvoices.find(d => d.id === deletedInvoiceId);
    if (!record) {
      showToast(language === 'bn' ? 'চালানটি পাওয়া যায়নি!' : 'Record not found!', 'error');
      return false;
    }

    setDeletedSaleInvoices(prev => {
      const updated = prev.filter(d => d.id !== deletedInvoiceId);
      try {
        localStorage.setItem('DOKANPRO_DELETED_INVOICES_ARCHIVE', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    recordDeletedTombstones('deletedSaleInvoices', [record.id]);
    recordDeletedTombstones('saleInvoices', [record.originalInvoiceId, record.invoiceNumber]);

    archiveAdminDeletion([
      {
        entityType: 'ARCHIVED_SALE_INVOICE',
        sourceTable: 'deleted_sale_invoices',
        recordId: record.originalInvoiceId || record.id,
        referenceNo: record.invoiceNumber,
        title: `Archived Sale Invoice #${record.invoiceNumber} - ${record.customerName}`,
        amount: record.grandTotal,
        reason: record.deletionReason || 'Permanently removed from archive by Admin',
        snapshot: record,
      },
    ]);

    showToast(
      language === 'bn'
        ? `চালান #${record.invoiceNumber} সফটওয়্যার থেকে সম্পূর্ণ মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
        : `Invoice #${record.invoiceNumber} completely removed from software and saved to admin_deleted_records.sql.`,
      'info'
    );

    return true;
  };

  const clearAllDeletedInvoices = () => {
    if (currentUser?.role !== 'ADMIN') {
      showToast(
        language === 'bn'
          ? 'অনুমতি নেই! শুধুমাত্র অ্যাডমিন সকল ডিলিট হিস্ট্রি সাফ করতে পারবেন।'
          : 'Permission denied! Only Admin can clear all deleted records history.',
        'error'
      );
      return;
    }

    const snapshotList = [...deletedSaleInvoices];
    setDeletedSaleInvoices([]);
    try {
      localStorage.removeItem('DOKANPRO_DELETED_INVOICES_ARCHIVE');
    } catch {}
    recordDeletedTombstones('deletedSaleInvoices', snapshotList.map(r => r.id));
    recordDeletedTombstones(
      'saleInvoices',
      snapshotList.flatMap(r => [r.originalInvoiceId, r.invoiceNumber])
    );

    if (snapshotList.length > 0) {
      archiveAdminDeletion(
        snapshotList.map(record => ({
          entityType: 'ARCHIVED_SALE_INVOICE',
          sourceTable: 'deleted_sale_invoices',
          recordId: record.originalInvoiceId || record.id,
          referenceNo: record.invoiceNumber,
          title: `Archived Sale Invoice #${record.invoiceNumber} - ${record.customerName}`,
          amount: record.grandTotal,
          reason: record.deletionReason || 'Bulk purged deleted invoices by Admin',
          snapshot: record,
        }))
      );
    }

    showToast(
      language === 'bn'
        ? 'সকল ডিলিট হওয়া চালান সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
        : 'All deleted invoices removed from software and saved to admin_deleted_records.sql.',
      'info'
    );
  };

  const exportSingleDeletedInvoiceToFile = (invoice: DeletedSaleInvoice) => {
    const exportData = {
      title: `DokanPro ERP - Deleted Invoice Snapshot (${invoice.invoiceNumber})`,
      shopName: companySettings.shopName,
      shopPhone: companySettings.phone,
      exportedAt: new Date().toISOString(),
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      grandTotal: invoice.grandTotal,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
      deletedAt: invoice.deletedAt,
      deletedBy: invoice.deletedBy,
      deletionReason: invoice.deletionReason,
      items: invoice.items,
      fullSnapshot: invoice.invoiceSnapshot,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deleted-invoice-${invoice.invoiceNumber}-${Date.now().toString().slice(-4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      language === 'bn'
        ? `চালান #${invoice.invoiceNumber} এর JSON ফাইল সফলভাবে ডাউনলোড হয়েছে।`
        : `Deleted invoice #${invoice.invoiceNumber} JSON file exported.`,
      'success'
    );
  };

  const exportDeletedInvoicesToFile = () => {
    if (deletedSaleInvoices.length === 0) {
      showToast(language === 'bn' ? 'কোন ডিলিট করা চালান পাওয়া যায়নি!' : 'No deleted invoices to export!', 'warning');
      return;
    }

    const exportData = {
      title: 'DokanPro ERP - Deleted Invoices Audit File',
      shopName: companySettings.shopName,
      shopPhone: companySettings.phone,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        name: currentUser?.fullName || 'Super Admin',
        username: currentUser?.username || 'admin',
        role: currentUser?.role || 'ADMIN',
      },
      totalDeletedInvoices: deletedSaleInvoices.length,
      totalDeletedAmount: deletedSaleInvoices.reduce((sum, d) => sum + (d.grandTotal || 0), 0),
      records: deletedSaleInvoices,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deleted-invoices-audit-${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      language === 'bn'
        ? 'ডিলিট হওয়া চালানের অডিট ফাইল (.json) সফলভাবে ডাউনলোড হয়েছে।'
        : 'Deleted invoices audit file downloaded successfully.',
      'success'
    );
  };

  const createSaleReturn = (returnData: {
    invoiceId: string;
    originalInvoiceNumber: string;
    customerId: string;
    customerName: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      unitPrice: number;
      returnQuantity: number;
      totalRefund: number;
      batchNumber?: string;
      expDate?: string;
    }[];
    totalRefund: number;
    refundWalletId: string;
    reason: string;
    settlementMode?: 'AUTO' | 'CASH_REFUND';
  }): boolean => {
    const origInv = saleInvoices.find(i => i.id === returnData.invoiceId);
    const existingReturnsForInvoice = saleReturns.filter(r => r.invoiceId === returnData.invoiceId);

    // Validate returnable quantities (supports multiple partial returns up to sold quantity)
    if (origInv) {
      const soldQtyByProduct = new Map<string, number>();
      origInv.items.forEach(it => {
        soldQtyByProduct.set(it.productId, Number(((soldQtyByProduct.get(it.productId) || 0) + Number(it.quantity || 0)).toFixed(4)));
      });

      const prevRetQtyByProduct = new Map<string, number>();
      existingReturnsForInvoice.forEach(ret => {
        ret.items.forEach(it => {
          prevRetQtyByProduct.set(it.productId, Number(((prevRetQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4)));
        });
      });

      const requestedQtyByProduct = new Map<string, number>();
      returnData.items.forEach(it => {
        requestedQtyByProduct.set(it.productId, Number(((requestedQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4)));
      });

      let hasAnyRemaining = false;
      soldQtyByProduct.forEach((soldQty, pid) => {
        if (soldQty - (prevRetQtyByProduct.get(pid) || 0) > 0.0001) {
          hasAnyRemaining = true;
        }
      });

      if (!hasAnyRemaining) {
        showToast(
          language === 'bn' ? 'এই চালানের সকল পণ্য ইতিমধ্যে ফেরত দেওয়া হয়েছে!' : 'All items on this invoice have already been returned!',
          'error'
        );
        return false;
      }

      for (const [pid, reqQty] of requestedQtyByProduct.entries()) {
        const maxAllowed = Number(((soldQtyByProduct.get(pid) || 0) - (prevRetQtyByProduct.get(pid) || 0)).toFixed(4));
        if (reqQty > maxAllowed + 0.0001) {
          showToast(
            language === 'bn'
              ? `ফেরতের পরিমাণ অবশিষ্ট বিক্রয় পরিমাণের (${maxAllowed}) চেয়ে বেশি হতে পারে না!`
              : `Return quantity cannot exceed remaining returnable quantity (${maxAllowed})!`,
            'error'
          );
          return false;
        }
      }
    }

    const returnAmount = Number(Number(returnData.totalRefund || 0).toFixed(2));
    if (returnAmount <= 0 || returnData.items.length === 0) {
      showToast(
        language === 'bn' ? 'ফেরতের জন্য অন্তত একটি পণ্যের পরিমাণ দিন!' : 'Please enter at least one item to return!',
        'error'
      );
      return false;
    }

    const returnNum = `RET-2026-${100 + saleReturns.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const fullTimeStamp = formatDeletionTimestamp();
    const refundWallet = wallets.find(w => w.id === returnData.refundWalletId);

    // Resolve customer & linked EMI scheme for automatic Total Receivable adjustment
    const customer = returnData.customerId && returnData.customerId !== 'walk-in'
      ? parties.find(p => p.id === returnData.customerId)
      : undefined;
    const linkedScheme = origInv?.isInstallmentSale
      ? installmentSchemes.find(
          s =>
            (origInv.installmentPlanId && s.id === origInv.installmentPlanId) ||
            s.invoiceId === origInv.id
        )
      : undefined;

    const settlementMode: 'AUTO' | 'CASH_REFUND' = returnData.settlementMode || 'AUTO';
    const invDue = Math.max(0, Number(origInv?.dueAmount || 0));
    const invPaid = Math.max(0, Number(origInv?.paidAmount || 0));
    const partyDue = customer ? Math.max(0, Number(customer.currentBalance || 0)) : 0;
    const emiDue = linkedScheme && linkedScheme.status === 'ACTIVE' ? Math.max(0, Number(linkedScheme.remainingBalance || 0)) : 0;

    let emiDueReduced = 0;
    let partyDueReduced = 0;
    let walkInBillDueReduced = 0;
    let cashRefunded = 0;

    if (settlementMode === 'CASH_REFUND') {
      // Cash refund is capped by what was actually paid on the bill (never refund cash for unpaid credit)
      const maxCashFromBill = origInv ? Math.min(returnAmount, invPaid) : returnAmount;
      cashRefunded = Number(maxCashFromBill.toFixed(2));
      const unpaidPortion = Number(Math.max(0, returnAmount - cashRefunded).toFixed(2));
      if (unpaidPortion > 0) {
        if (emiDue > 0) {
          emiDueReduced = Number(Math.min(unpaidPortion, emiDue).toFixed(2));
        }
        const remAfterEmi = Number(Math.max(0, unpaidPortion - emiDueReduced).toFixed(2));
        if (customer && partyDue > 0) {
          partyDueReduced = Number(Math.min(remAfterEmi, partyDue).toFixed(2));
        } else if (!customer && invDue > 0) {
          walkInBillDueReduced = Number(Math.min(remAfterEmi, invDue).toFixed(2));
        }
        // If there's still a small residual beyond due, treat as cash refund
        const adjusted = Number((emiDueReduced + partyDueReduced + walkInBillDueReduced).toFixed(2));
        cashRefunded = Number(Math.max(0, returnAmount - adjusted).toFixed(2));
      }
    } else {
      // AUTO mode: Automatically reduce Total Receivable (EMI + Customer Balance) first, then refund remaining cash
      if (emiDue > 0) {
        emiDueReduced = Number(Math.min(returnAmount, emiDue).toFixed(2));
      }
      const remAfterEmi = Number(Math.max(0, returnAmount - emiDueReduced).toFixed(2));
      if (customer && partyDue > 0) {
        partyDueReduced = Number(Math.min(remAfterEmi, partyDue).toFixed(2));
      } else if (!customer && invDue > 0) {
        walkInBillDueReduced = Number(Math.min(remAfterEmi, invDue).toFixed(2));
      }
      const totalDueOffset = Number((emiDueReduced + partyDueReduced + walkInBillDueReduced).toFixed(2));
      cashRefunded = Number(Math.max(0, returnAmount - totalDueOffset).toFixed(2));
    }

    const dueAdjusted = Number((emiDueReduced + partyDueReduced + walkInBillDueReduced).toFixed(2));

    // Validate wallet balance ONLY for the actual cash refund portion
    if (cashRefunded > 0) {
      if (!returnData.refundWalletId || !refundWallet) {
        showToast(
          language === 'bn' ? 'রিফান্ড ওয়ালেট খুঁজে পাওয়া যায়নি!' : 'Refund wallet not found!',
          'error'
        );
        return false;
      }
      if (refundWallet.balance < cashRefunded) {
        showToast(
          language === 'bn'
            ? `নির্বাচিত রিফান্ড ওয়ালেটে (${refundWallet.name}) পর্যাপ্ত ব্যালেন্স নেই! বর্তমান ব্যালেন্স: ৳${refundWallet.balance.toLocaleString()} | ক্যাশ রিফান্ড প্রয়োজন: ৳${cashRefunded.toLocaleString()}`
            : `Insufficient balance in refund wallet (${refundWallet.name})! Available: ৳${refundWallet.balance.toLocaleString()} | Cash Refund Required: ৳${cashRefunded.toLocaleString()}`,
          'error'
        );
        return false;
      }
    }

    // Calculate exact invoice deltas so original bill & reversal stay 100% balanced
    let invoiceGrandTotalDelta = 0;
    let invoiceSubtotalDelta = 0;
    let invoiceDueDelta = 0;
    let invoicePaidDelta = 0;
    const previousInvoiceStatus = origInv?.status;

    if (origInv) {
      invoiceGrandTotalDelta = Number(Math.min(origInv.grandTotal, returnAmount).toFixed(2));
      invoiceSubtotalDelta = Number(Math.min(origInv.subtotal, returnAmount).toFixed(2));
      invoiceDueDelta = Number(Math.min(origInv.dueAmount, dueAdjusted).toFixed(2));
      const paidDeltaTarget = Number(Math.max(0, invoiceGrandTotalDelta - invoiceDueDelta).toFixed(2));
      invoicePaidDelta = Number(Math.min(origInv.paidAmount, paidDeltaTarget).toFixed(2));
      // Ensure grandTotalDelta === invoiceDueDelta + invoicePaidDelta if due can absorb residual
      const remainingDelta = Number((invoiceGrandTotalDelta - invoiceDueDelta - invoicePaidDelta).toFixed(2));
      if (remainingDelta > 0 && origInv.dueAmount - invoiceDueDelta > 0) {
        const extraDue = Math.min(remainingDelta, Number((origInv.dueAmount - invoiceDueDelta).toFixed(2)));
        invoiceDueDelta = Number((invoiceDueDelta + extraDue).toFixed(2));
      }
    }

    const newReturn: SaleReturn = {
      id: `sret-${Date.now()}`,
      returnNumber: returnNum,
      originalInvoiceNumber: returnData.originalInvoiceNumber,
      invoiceId: returnData.invoiceId,
      date: today,
      customerId: returnData.customerId,
      customerName: returnData.customerName,
      items: returnData.items,
      totalRefund: returnAmount,
      dueAdjusted,
      partyDueReduced,
      emiDueReduced,
      cashRefunded,
      settlementMode,
      invoiceGrandTotalDelta,
      invoiceSubtotalDelta,
      invoicePaidDelta,
      invoiceDueDelta,
      previousInvoiceStatus,
      refundWalletId: cashRefunded > 0 ? returnData.refundWalletId : 'credit',
      refundWalletName:
        cashRefunded > 0
          ? (refundWallet?.name || 'Cash')
          : (language === 'bn' ? 'বকেয়া সমন্বয় (Receivable Adjusted)' : 'Receivable Adjusted'),
      reason: returnData.reason,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: fullTimeStamp,
    };

    // 1. Auto-update product stock AND batches back (in base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const retItems = returnData.items.filter(i => i.productId === prod.id);
        if (retItems.length > 0) {
          const totalRetBaseQty = retItems.reduce(
            (sum, i) =>
              sum +
              getBaseQuantity(
                {
                  quantity: i.returnQuantity,
                  unit: i.unit,
                  conversionFactor: i.conversionFactor,
                  baseQuantity: i.baseQuantity,
                },
                prod
              ),
            0
          );

          let updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
          if (updatedBatches && updatedBatches.length > 0) {
            retItems.forEach(retItem => {
              const itemBaseQty = getBaseQuantity(
                {
                  quantity: retItem.returnQuantity,
                  unit: retItem.unit,
                  conversionFactor: retItem.conversionFactor,
                  baseQuantity: retItem.baseQuantity,
                },
                prod
              );
              const matchIdx = retItem.batchNumber
                ? updatedBatches!.findIndex(b => b.batchNumber === retItem.batchNumber)
                : updatedBatches!.findIndex(b => Number(b.stock) > 0);
              const targetIdx = matchIdx >= 0 ? matchIdx : updatedBatches!.length - 1;
              if (targetIdx >= 0) {
                updatedBatches![targetIdx] = {
                  ...updatedBatches![targetIdx],
                  stock: Number((Number(updatedBatches![targetIdx].stock || 0) + itemBaseQty).toFixed(4)),
                };
              }
            });
          }

          const activeBatchesWithExp = (updatedBatches || []).filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

          return {
            ...prod,
            stock: Number((prod.stock + totalRetBaseQty).toFixed(4)),
            ...(updatedBatches ? { batches: updatedBatches, expDate: earliestActiveExp } : {}),
          };
        }
        return prod;
      })
    );

    // 2. Auto-update Customer Balance (Total Receivable)
    if (partyDueReduced > 0 && customer) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === customer.id) {
            return {
              ...p,
              currentBalance: Math.max(0, Number((p.currentBalance - partyDueReduced).toFixed(2))),
            };
          }
          return p;
        })
      );
    }

    // 3. Auto-update Linked Installment / EMI Scheme (part of Total Receivable)
    if (emiDueReduced > 0 && linkedScheme) {
      setInstallmentSchemes(prevSchemes =>
        prevSchemes.map(s => {
          if (s.id === linkedScheme.id) {
            const newRemaining = Math.max(0, Number((s.remainingBalance - emiDueReduced).toFixed(2)));
            const newTotalPayable = Math.max(0, Number((s.totalPayable - emiDueReduced).toFixed(2)));
            return {
              ...s,
              remainingBalance: newRemaining,
              totalPayable: newTotalPayable,
              status: newRemaining <= 0 ? 'COMPLETED' : s.status,
            };
          }
          return s;
        })
      );
    }

    // 4. Auto-update Original Sale Invoice amounts, due & status
    let updatedInvGrandTotal = origInv ? origInv.grandTotal : 0;
    let updatedInvSubtotal = origInv ? origInv.subtotal : 0;
    let updatedInvDueAmount = origInv ? origInv.dueAmount : 0;
    let updatedInvPaidAmount = origInv ? origInv.paidAmount : 0;
    let updatedInvStatus: InvoiceStatus = origInv?.status || 'PAID';

    if (origInv) {
      const updatedAllReturns = [...existingReturnsForInvoice, newReturn];
      const totalReturnedQtyByProduct = new Map<string, number>();
      updatedAllReturns.forEach(ret => {
        ret.items.forEach(it => {
          totalReturnedQtyByProduct.set(
            it.productId,
            Number(((totalReturnedQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4))
          );
        });
      });

      const soldQtyByProduct = new Map<string, number>();
      origInv.items.forEach(it => {
        soldQtyByProduct.set(
          it.productId,
          Number(((soldQtyByProduct.get(it.productId) || 0) + Number(it.quantity || 0)).toFixed(4))
        );
      });

      let allItemsReturned = true;
      soldQtyByProduct.forEach((soldQty, pid) => {
        if ((totalReturnedQtyByProduct.get(pid) || 0) < soldQty - 0.0001) {
          allItemsReturned = false;
        }
      });

      updatedInvGrandTotal = Math.max(0, Number((origInv.grandTotal - invoiceGrandTotalDelta).toFixed(2)));
      updatedInvSubtotal = Math.max(0, Number((origInv.subtotal - invoiceSubtotalDelta).toFixed(2)));
      updatedInvDueAmount = Math.max(0, Number((origInv.dueAmount - invoiceDueDelta).toFixed(2)));
      updatedInvPaidAmount = Math.max(0, Number((origInv.paidAmount - invoicePaidDelta).toFixed(2)));
      const newReturnedAmount = Number(((origInv.returnedAmount || 0) + returnAmount).toFixed(2));
      const isFull = allItemsReturned || updatedInvGrandTotal <= 0;
      updatedInvStatus =
        updatedInvGrandTotal <= 0 || updatedInvDueAmount <= 0
          ? 'PAID'
          : updatedInvPaidAmount > 0
            ? 'PARTIAL'
            : 'DUE';

      setSaleInvoices(prevInvoices =>
        prevInvoices.map(inv => {
          if (inv.id !== origInv.id) return inv;
          return {
            ...inv,
            originalGrandTotal: inv.originalGrandTotal ?? inv.grandTotal,
            subtotal: updatedInvSubtotal,
            grandTotal: updatedInvGrandTotal,
            paidAmount: updatedInvPaidAmount,
            dueAmount: updatedInvDueAmount,
            returnedAmount: newReturnedAmount,
            returnStatus: isFull ? 'FULL' : 'PARTIAL',
            status: updatedInvStatus,
          };
        })
      );
    }

    // 5. Deduct ONLY actual cash refund from wallet
    if (cashRefunded > 0 && returnData.refundWalletId) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          if (w.id === returnData.refundWalletId) {
            return {
              ...w,
              balance: Math.max(0, Number((w.balance - cashRefunded).toFixed(2))),
            };
          }
          return w;
        })
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 6. Update original Invoice #'s SALE DayBook entry in-place to post-return Cash In total,
    //    and log SALE_RETURN with amount 0 so Cash Out is NEVER increased on product returns.
    const resolvedSaleWalletId =
      updatedInvPaidAmount > 0 && origInv?.walletId && origInv.walletId !== 'due' && origInv.walletId !== 'credit'
        ? origInv.walletId
        : updatedInvPaidAmount > 0
          ? 'w-cash'
          : 'due';
    const resolvedSaleWalletName =
      updatedInvPaidAmount > 0
        ? (wallets.find(w => w.id === resolvedSaleWalletId)?.name || origInv?.walletName || 'Cash')
        : 'Credit / বাকি';
    const updatedSaleRemarks = origInv
      ? updatedInvPaidAmount > 0
        ? `POS Sale receipt from ${origInv.customerName} (Net Total: ৳${updatedInvGrandTotal.toLocaleString()}, Cash In: ৳${updatedInvPaidAmount.toLocaleString()}${updatedInvDueAmount > 0 ? `, Due: ৳${updatedInvDueAmount.toLocaleString()}` : ''}, After Return #${returnNum}: -৳${returnAmount.toLocaleString()})`
        : `Sale to ${origInv.customerName} (After Return #${returnNum}: Net Total ৳${updatedInvGrandTotal.toLocaleString()}, Cash In: ৳0${updatedInvDueAmount > 0 ? `, Due: ৳${updatedInvDueAmount.toLocaleString()}` : ''})`
      : '';

    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: returnNum,
      date: today,
      type: 'SALE_RETURN',
      flow: 'OUT',
      partyId: returnData.customerId,
      partyName: returnData.customerName,
      partyType: 'CUSTOMER',
      amount: 0,
      walletId: 'adjusted',
      walletName:
        language === 'bn'
          ? `ইনভয়েস #${returnData.originalInvoiceNumber} সমন্বয়`
          : `Adjusted in #${returnData.originalInvoiceNumber}`,
      referenceId: origInv?.id,
      referenceNo: returnData.originalInvoiceNumber,
      remarks: `Sale return for #${returnData.originalInvoiceNumber} (Return: ৳${returnAmount.toLocaleString()}, Invoice Cash In Updated: ৳${updatedInvPaidAmount.toLocaleString()}${dueAdjusted > 0 ? `, Receivable Reduced: ৳${dueAdjusted.toLocaleString()}` : ''}) - ${returnData.reason}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: fullTimeStamp,
    };

    const isLinkedOrigSaleDb = (d: DayBookEntry) =>
      !!origInv &&
      d.type === 'SALE' &&
      (d.referenceId === origInv.id ||
        d.id === `db-sale-${origInv.id}` ||
        d.voucherNo === origInv.invoiceNumber ||
        d.referenceNo === origInv.invoiceNumber);

    const extraOrigSaleDbIds = origInv ? dayBookEntries.filter(isLinkedOrigSaleDb).slice(1).map(d => d.id) : [];
    if (extraOrigSaleDbIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', extraOrigSaleDbIds);
    }

    setDayBookEntries(prev => {
      let nextEntries = prev;
      if (origInv) {
        const firstIdx = prev.findIndex(isLinkedOrigSaleDb);
        if (firstIdx >= 0) {
          const primaryId = prev[firstIdx].id;
          nextEntries = prev
            .filter(d => !isLinkedOrigSaleDb(d) || d.id === primaryId)
            .map(d =>
              d.id === primaryId
                ? {
                    ...d,
                    referenceId: origInv.id,
                    voucherNo: origInv.invoiceNumber,
                    referenceNo: origInv.invoiceNumber,
                    amount: updatedInvPaidAmount,
                    walletId:
                      updatedInvPaidAmount > 0 && d.walletId && d.walletId !== 'due' && d.walletId !== 'credit'
                        ? d.walletId
                        : resolvedSaleWalletId,
                    walletName:
                      updatedInvPaidAmount > 0 && d.walletName && d.walletName !== 'Credit / বাকি'
                        ? d.walletName
                        : resolvedSaleWalletName,
                    remarks: updatedSaleRemarks,
                  }
                : d
            );
        } else {
          const synthSaleEntry: DayBookEntry = {
            id: `db-sale-${origInv.id}`,
            voucherNo: origInv.invoiceNumber,
            date: origInv.date,
            type: 'SALE',
            flow: 'IN',
            partyId: origInv.customerId,
            partyName: origInv.customerName,
            partyType: 'CUSTOMER',
            amount: updatedInvPaidAmount,
            walletId: resolvedSaleWalletId,
            walletName: resolvedSaleWalletName,
            referenceId: origInv.id,
            referenceNo: origInv.invoiceNumber,
            remarks: updatedSaleRemarks,
            createdBy: origInv.cashierName || currentUser?.id || 'usr-1',
            createdAt: origInv.createdAt || fullTimeStamp,
          };
          nextEntries = [synthSaleEntry, ...prev];
        }
      }
      return [dbEntry, ...nextEntries];
    });

    logActivity({
      actionType: 'USER_ACTION',
      title: `Created Sale Return #${returnNum}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'ADMIN'}) created sale return #${returnNum} for Invoice #${returnData.originalInvoiceNumber} (Customer: ${returnData.customerName}, Return: ৳${returnAmount.toLocaleString()}, Receivable Adjusted: ৳${dueAdjusted.toLocaleString()}, Cash Refund: ৳${cashRefunded.toLocaleString()}) on ${fullTimeStamp}.`,
      severity: 'info',
      targetId: newReturn.id,
      targetName: `Sale Return #${returnNum}`,
    });

    setSaleReturns(prev => [newReturn, ...prev]);
    showToast(
      language === 'bn'
        ? `বিক্রয় রিটার্ন ${returnNum} সফল! স্টক ও বিল আপডেট হয়েছে${dueAdjusted > 0 ? ` • পাওনা (Receivable) কমেছে ৳${dueAdjusted.toLocaleString()}` : ''}${cashRefunded > 0 ? ` • ক্যাশ রিফান্ড ৳${cashRefunded.toLocaleString()}` : ''}।`
        : `Sale return ${returnNum} saved! Stock & invoice updated${dueAdjusted > 0 ? ` • Receivable reduced by ৳${dueAdjusted.toLocaleString()}` : ''}${cashRefunded > 0 ? ` • Cash refunded ৳${cashRefunded.toLocaleString()}` : ''}.`,
      'success'
    );
    return true;
  };

  const deleteSaleReturn = (returnIdOrNum: string) => {
    const targetReturn = saleReturns.find(r => r.id === returnIdOrNum || r.returnNumber === returnIdOrNum);
    if (!targetReturn) return;

    // 1. Revert product stocks AND batches (subtract what was returned in base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const retItems = targetReturn.items.filter(i => i.productId === prod.id);
        if (retItems.length > 0) {
          const totalRetBaseQty = retItems.reduce(
            (sum, i) =>
              sum +
              getBaseQuantity(
                {
                  quantity: i.returnQuantity,
                  unit: i.unit,
                  conversionFactor: i.conversionFactor,
                  baseQuantity: i.baseQuantity,
                },
                prod
              ),
            0
          );

          let updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
          if (updatedBatches && updatedBatches.length > 0) {
            retItems.forEach(retItem => {
              let remToDeduct = getBaseQuantity(
                {
                  quantity: retItem.returnQuantity,
                  unit: retItem.unit,
                  conversionFactor: retItem.conversionFactor,
                  baseQuantity: retItem.baseQuantity,
                },
                prod
              );
              if (retItem.batchNumber) {
                const idx = updatedBatches!.findIndex(b => b.batchNumber === retItem.batchNumber);
                if (idx >= 0 && remToDeduct > 0) {
                  const take = Math.min(Number(updatedBatches![idx].stock || 0), remToDeduct);
                  updatedBatches![idx].stock = Math.max(0, Number((Number(updatedBatches![idx].stock || 0) - take).toFixed(4)));
                  remToDeduct = Number((remToDeduct - take).toFixed(4));
                }
              }
              for (let i = 0; i < updatedBatches!.length && remToDeduct > 0; i++) {
                const avail = Number(updatedBatches![i].stock || 0);
                if (avail > 0) {
                  const take = Math.min(avail, remToDeduct);
                  updatedBatches![i].stock = Math.max(0, Number((avail - take).toFixed(4)));
                  remToDeduct = Number((remToDeduct - take).toFixed(4));
                }
              }
            });
          }

          const activeBatchesWithExp = (updatedBatches || []).filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

          return {
            ...prod,
            stock: Math.max(0, Number((prod.stock - totalRetBaseQty).toFixed(4))),
            ...(updatedBatches ? { batches: updatedBatches, expDate: earliestActiveExp } : {}),
          };
        }
        return prod;
      })
    );

    const targetOrigInv = saleInvoices.find(
      inv => inv.id === targetReturn.invoiceId || inv.invoiceNumber === targetReturn.originalInvoiceNumber
    );
    const hasActiveOrigInv = Boolean(targetOrigInv);

    // 2. Revert Customer Balance (ONLY if original invoice is still active; otherwise invoice deletion already cleared due)
    const partyDueToRestore = Number(targetReturn.partyDueReduced || 0);
    if (hasActiveOrigInv && partyDueToRestore > 0 && targetReturn.customerId && targetReturn.customerId !== 'walk-in') {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === targetReturn.customerId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + partyDueToRestore).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Revert Linked EMI Scheme (if applicable and original invoice still exists)
    const emiDueToRestore = Number(targetReturn.emiDueReduced || 0);
    if (hasActiveOrigInv && emiDueToRestore > 0 && targetOrigInv) {
      setInstallmentSchemes(prevSchemes =>
        prevSchemes.map(s => {
          if (
            (targetOrigInv.installmentPlanId && s.id === targetOrigInv.installmentPlanId) ||
            s.invoiceId === targetOrigInv.id
          ) {
            const newRemaining = Number((s.remainingBalance + emiDueToRestore).toFixed(2));
            return {
              ...s,
              remainingBalance: newRemaining,
              totalPayable: Number((s.totalPayable + emiDueToRestore).toFixed(2)),
              status: newRemaining > 0 ? 'ACTIVE' : s.status,
            };
          }
          return s;
        })
      );
    }

    // 4. Revert Original Sale Invoice amounts, due & status
    const grandDelta = Number(targetReturn.invoiceGrandTotalDelta ?? 0);
    const subDelta = Number(targetReturn.invoiceSubtotalDelta ?? 0);
    const paidDelta = Number(targetReturn.invoicePaidDelta ?? 0);
    const dueDelta = Number(targetReturn.invoiceDueDelta ?? 0);
    let restoredInvPaid = targetOrigInv ? targetOrigInv.paidAmount : 0;
    let restoredInvGrand = targetOrigInv ? targetOrigInv.grandTotal : 0;
    let restoredInvDue = targetOrigInv ? targetOrigInv.dueAmount : 0;

    if (hasActiveOrigInv && targetOrigInv && (grandDelta > 0 || subDelta > 0 || paidDelta > 0 || dueDelta > 0)) {
      const remainingReturnsCount = saleReturns.filter(
        r => (r.invoiceId === targetOrigInv.id || r.originalInvoiceNumber === targetOrigInv.invoiceNumber) && r.id !== targetReturn.id
      ).length;

      restoredInvGrand = Number((targetOrigInv.grandTotal + grandDelta).toFixed(2));
      restoredInvPaid = Number((targetOrigInv.paidAmount + paidDelta).toFixed(2));
      restoredInvDue = Number((targetOrigInv.dueAmount + dueDelta).toFixed(2));

      setSaleInvoices(prevInvoices =>
        prevInvoices.map(inv => {
          if (inv.id !== targetOrigInv.id) return inv;
          const restoredGrand = Number((inv.grandTotal + grandDelta).toFixed(2));
          const restoredSub = Number((inv.subtotal + subDelta).toFixed(2));
          const restoredPaid = Number((inv.paidAmount + paidDelta).toFixed(2));
          const restoredDue = Number((inv.dueAmount + dueDelta).toFixed(2));
          const restoredReturnedAmt = Math.max(0, Number(((inv.returnedAmount || 0) - targetReturn.totalRefund).toFixed(2)));
          const restoredStatus: InvoiceStatus =
            restoredDue <= 0 ? 'PAID' : restoredPaid > 0 ? 'PARTIAL' : 'DUE';

          return {
            ...inv,
            subtotal: restoredSub,
            grandTotal: restoredGrand,
            paidAmount: restoredPaid,
            dueAmount: restoredDue,
            returnedAmount: restoredReturnedAmt,
            returnStatus: remainingReturnsCount === 0 || restoredReturnedAmt <= 0 ? 'NONE' : 'PARTIAL',
            status: restoredStatus,
          };
        })
      );
    }

    // 5. Revert wallet balance ONLY if original invoice still exists (if invoice was deleted, NEVER resurrect its cash into Cash In Hand!)
    const cashToRevert =
      targetReturn.cashRefunded !== undefined ? Number(targetReturn.cashRefunded) : Number(targetReturn.totalRefund || 0);
    if (
      hasActiveOrigInv &&
      cashToRevert > 0 &&
      targetReturn.refundWalletId &&
      !NON_CASH_WALLET_IDS.has(String(targetReturn.refundWalletId).toLowerCase())
    ) {
      setWallets(prevWallets =>
        creditAmountToWallets(prevWallets, cashToRevert, targetReturn.refundWalletId, targetReturn.refundWalletName)
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const removedDayBookIds = dayBookEntries
      .filter(db => db.voucherNo === targetReturn.returnNumber)
      .map(db => db.id);
    if (removedDayBookIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }

    setDayBookEntries(prev => {
      const withoutReturn = prev.filter(db => db.voucherNo !== targetReturn.returnNumber);
      if (!targetOrigInv) return withoutReturn;

      const restoredWalletId =
        restoredInvPaid > 0
          ? targetOrigInv.walletId && targetOrigInv.walletId !== 'due' && targetOrigInv.walletId !== 'credit'
            ? targetOrigInv.walletId
            : 'w-cash'
          : 'due';
      const restoredWalletName =
        restoredInvPaid > 0
          ? (wallets.find(w => w.id === restoredWalletId)?.name || targetOrigInv.walletName || 'Cash')
          : 'Credit / বাকি';
      const restoredRemarks =
        restoredInvPaid > 0
          ? `POS Sale receipt from ${targetOrigInv.customerName} (Total: ৳${restoredInvGrand.toLocaleString()}, Received: ৳${restoredInvPaid.toLocaleString()}${restoredInvDue > 0 ? `, Due: ৳${restoredInvDue.toLocaleString()}` : ''})`
          : `Credit Sale / বাকি বিক্রয় to ${targetOrigInv.customerName} (Total: ৳${restoredInvGrand.toLocaleString()}, Due: ৳${restoredInvDue.toLocaleString()})`;

      return withoutReturn.map(db =>
        db.type === 'SALE' &&
        (db.referenceId === targetOrigInv.id ||
          db.id === `db-sale-${targetOrigInv.id}` ||
          db.voucherNo === targetOrigInv.invoiceNumber ||
          db.referenceNo === targetOrigInv.invoiceNumber)
          ? {
              ...db,
              amount: restoredInvPaid,
              walletId:
                restoredInvPaid > 0 && db.walletId && db.walletId !== 'due' && db.walletId !== 'credit'
                  ? db.walletId
                  : restoredWalletId,
              walletName:
                restoredInvPaid > 0 && db.walletName && db.walletName !== 'Credit / বাকি'
                  ? db.walletName
                  : restoredWalletName,
              remarks: restoredRemarks,
            }
          : db
      );
    });

    setSaleReturns(prev => prev.filter(r => r.id !== targetReturn.id && r.returnNumber !== targetReturn.returnNumber));
    recordDeletedTombstones('saleReturns', [targetReturn.id, targetReturn.returnNumber]);

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'SALE_RETURN',
          sourceTable: 'sale_returns',
          recordId: targetReturn.id,
          referenceNo: targetReturn.returnNumber,
          title: `Sale Return #${targetReturn.returnNumber} - ${targetReturn.customerName}`,
          amount: targetReturn.totalRefund,
          reason: targetReturn.reason,
          snapshot: targetReturn,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: ফেরত চালান ${targetReturn.returnNumber} সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: Sale return ${targetReturn.returnNumber} removed from software and saved to admin_deleted_records.sql.`,
        'success'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Sale Return #${targetReturn.returnNumber}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted sale return #${targetReturn.returnNumber} (Refund: ৳${targetReturn.totalRefund.toLocaleString()}) on ${nowStr}.`,
      severity: 'danger',
      targetId: targetReturn.id,
      targetName: `Sale Return #${targetReturn.returnNumber}`,
    });

    showToast(
      language === 'bn'
        ? `ফেরত চালান ${targetReturn.returnNumber} (${nowStr}) ডিলিট করা হয়েছে এবং স্টক, বিল ও বকেয়া পুনরুদ্ধার হয়েছে।`
        : `Sale return ${targetReturn.returnNumber} deleted on ${nowStr}. Stock, invoice & receivable restored.`,
      'success'
    );
  };

  const recordPaymentIn = (data: {
    partyId: string;
    amount: number;
    walletId: string;
    date: string;
    remarks: string;
  }): boolean => {
    const party = parties.find(p => p.id === data.partyId);
    const wallet = wallets.find(w => w.id === data.walletId);
    const voucherNo = `REC-2026-${500 + dayBookEntries.length + 1}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (!party) {
      showToast(language === 'bn' ? 'কাস্টমার নির্বাচন করুন!' : 'Please select a customer!', 'error');
      return false;
    }
    if (!wallet) {
      showToast(language === 'bn' ? 'পেমেন্ট ওয়ালেট নির্বাচন করুন!' : 'Please select a payment wallet!', 'error');
      return false;
    }
    if (!data.amount || data.amount <= 0) {
      showToast(language === 'bn' ? 'সঠিক আদায়ের পরিমাণ (৳) লিখুন!' : 'Please enter a valid amount!', 'error');
      return false;
    }

    // Customer due ceiling check (Customer balance or total due)
    const maxDueAllowed = Math.max(Number(party.currentBalance || 0), getCustomerTotalDue(party, installmentSchemes));

    if (maxDueAllowed <= 0) {
      showToast(
        language === 'bn'
          ? `কাস্টমার ${party.name} এর কোনো বকেয়া নেই (বর্তমান বকেয়া ৳০)! বকেয়া ছাড়া টাকা আদায় করা যাবে না।`
          : `Customer ${party.name} has no outstanding due (৳0)! Cannot collect payment without due.`,
        'error'
      );
      return false;
    }

    if (data.amount > maxDueAllowed) {
      showToast(
        language === 'bn'
          ? `⚠️ বকেয়ার চেয়ে বেশি টাকা আদায় করা যাবে না! কাস্টমারের মোট বকেয়া ৳${maxDueAllowed.toLocaleString()}। আপনি ৳${data.amount.toLocaleString()} আদায় করতে চেয়েছেন। সর্বোচ্চ ৳${maxDueAllowed.toLocaleString()} বা এর চেয়ে কম পরিমাণ টাকা আদায় করতে পারবেন।`
          : `Cannot collect more than outstanding due! Total due is ৳${maxDueAllowed.toLocaleString()}, but attempted ৳${data.amount.toLocaleString()}. Maximum allowed is ৳${maxDueAllowed.toLocaleString()}.`,
        'error'
      );
      return false;
    }

    // 1. Decrease customer balance
    setParties(prev =>
      prev.map(p => {
        if (p.id === data.partyId) {
          return {
            ...p,
            currentBalance: Math.max(0, p.currentBalance - data.amount),
          };
        }
        return p;
      })
    );

    // 2. Increase wallet
    setWallets(prev =>
      prev.map(w => {
        if (w.id === data.walletId) {
          return {
            ...w,
            balance: w.balance + data.amount,
          };
        }
        return w;
      })
    );

    // 3. Day book log
    const entry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: data.date,
      type: 'PAYMENT_IN',
      flow: 'IN',
      partyId: data.partyId,
      partyName: party?.name || 'Customer',
      partyType: 'CUSTOMER',
      amount: data.amount,
      walletId: data.walletId,
      walletName: wallet?.name || 'Cash',
      referenceNo: voucherNo,
      remarks: data.remarks || `Customer due collection from ${party?.name}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${data.date} ${nowTime}`,
    };
    setDayBookEntries(prev => [entry, ...prev]);

    const remainingDue = Math.max(0, (party?.currentBalance || 0) - data.amount);

    // Open Money Receipt Voucher
    openPrintModal({
      type: 'MONEY_RECEIPT',
      title: 'Payment In Money Receipt (টাকা জমার রসিদ)',
      data: {
        voucherNo,
        date: data.date,
        partyName: party?.name,
        partyPhone: party?.phone,
        companyName: party?.companyName,
        amount: data.amount,
        walletName: wallet?.name,
        remarks: data.remarks,
        previousDue: party?.currentBalance,
        remainingDue,
      },
    });

    // Auto SMS on Payment In
    if (smsConfig.enabled && smsConfig.autoSendOnPaymentIn && party && party.phone) {
      sendPaymentInSms(party, data.amount, remainingDue, voucherNo).catch(err => console.warn('Payment In SMS trigger error:', err));
    }

    showToast(
      language === 'bn'
        ? `${party?.name} এর কাছ থেকে ৳${data.amount} জমা নেওয়া হয়েছে।`
        : `Collected ${formatCurrency(data.amount)} from ${party?.name}`
    );
    return true;
  };

  // -------------------------------------------------------------
  // Purchase Logic
  // -------------------------------------------------------------
  const createPurchaseInvoice = (data: {
    billNumber?: string;
    supplierId: string;
    supplierName: string;
    supplierPhone: string;
    supplierInvoiceNo?: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      quantity: number;
      purchasePrice: number;
      total: number;
      batchNumber?: string;
      expDate?: string;
      mfgDate?: string;
      salesPrice?: number;
    }[];
    subtotal: number;
    discount: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    walletId: string;
    notes?: string;
    date?: string;
  }): PurchaseInvoice => {
    const rawBillNum = data.billNumber?.trim() || data.supplierInvoiceNo?.trim();
    let billNum = rawBillNum || generatePurchaseBillNumber(purchaseInvoices);

    // Duplicate Purchase Bill / Invoice No Validation - Auto-correct if duplicate
    const duplicateBill = checkDuplicatePurchaseInvoice(billNum, purchaseInvoices);
    if (duplicateBill) {
      billNum = generatePurchaseBillNumber(purchaseInvoices);
      showToast(
        language === 'bn'
          ? `⚠️ পূর্বের বিল নং ডুপ্লিকেট থাকায় স্বয়ংক্রিয়ভাবে নতুন বিল নং (${billNum}) জেনারেট করা হয়েছে।`
          : `⚠️ Previous bill number was duplicate, automatically generated new bill number (${billNum}).`,
        'info'
      );
    }

    const purDate = data.date || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    // Normalize pure Credit / DUE purchase so Cash In Hand (wallet) is NEVER deducted on credit purchase
    const isPureCreditPurchase =
      data.paymentMethod === 'DUE' || data.walletId === 'credit' || data.walletId === 'due';
    if (!isPureCreditPurchase && Number(data.paidAmount || 0) < 0) {
      showToast(language === 'bn' ? 'পরিশোধের পরিমাণ ঋণাত্মক হতে পারে না!' : 'Paid amount cannot be negative!', 'error');
      return null;
    }

    const effectivePaidAmount = isPureCreditPurchase ? 0 : Math.max(0, Number(data.paidAmount || 0));
    const effectiveDueAmount = isPureCreditPurchase
      ? Math.max(0, Number(data.grandTotal || 0))
      : Math.max(0, Number(data.dueAmount ?? Math.max(0, Number(data.grandTotal || 0) - effectivePaidAmount)));
    const effectivePaymentMethod: PaymentMethod =
      effectivePaidAmount <= 0 && effectiveDueAmount > 0 ? 'DUE' : data.paymentMethod;
    const selectedWallet =
      effectivePaidAmount > 0
        ? (wallets.find(w => w.id === data.walletId) || wallets[0])
        : undefined;

    // Validate wallet balance ONLY if paying actual cash/bank/MFS upfront (NEVER for Credit / DUE purchase)
    if (effectivePaidAmount > 0) {
      if (!selectedWallet) {
        showToast(
          language === 'bn' ? 'পেমেন্ট ওয়ালেট খুঁজে পাওয়া যায়নি!' : 'Payment wallet not found!',
          'error'
        );
        return null;
      }
      if (selectedWallet.balance < effectivePaidAmount) {
        showToast(
          language === 'bn'
            ? `নির্বাচিত ওয়ালেটে (${selectedWallet.name}) পর্যাপ্ত ব্যালেন্স নেই! বর্তমান ব্যালেন্স: ৳${selectedWallet.balance.toLocaleString()} | পরিশোধ: ৳${effectivePaidAmount.toLocaleString()}। অনুগ্রহ করে ওয়ালেটে টাকা জমা দিন অথবা বাকি (Credit) হিসেবে এন্ট্রি করুন।`
            : `Insufficient balance in ${selectedWallet.name}! Available: ৳${selectedWallet.balance.toLocaleString()} | Trying to pay: ৳${effectivePaidAmount.toLocaleString()}. Please deposit funds or save as credit purchase.`,
          'error'
        );
        return null;
      }
    }

    let status: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID';
    if (effectiveDueAmount > 0 && effectivePaidAmount > 0) {
      status = 'PARTIAL';
    } else if (effectivePaidAmount === 0 && effectiveDueAmount > 0) {
      status = 'DUE';
    }

    const creatorName = currentUser?.fullName || currentUser?.username || 'Admin';

    const newPurchase: PurchaseInvoice = {
      id: `pur-${Date.now()}`,
      billNumber: billNum,
      supplierInvoiceNo: rawBillNum || data.supplierInvoiceNo || billNum,
      date: purDate,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      taxAmount: data.taxAmount,
      grandTotal: data.grandTotal,
      paidAmount: effectivePaidAmount,
      dueAmount: effectiveDueAmount,
      paymentMethod: effectivePaymentMethod,
      walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'credit',
      walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
      status,
      notes: data.notes,
      createdBy: creatorName,
      completedBy: status === 'PAID' ? creatorName : undefined,
      contributors: [
        {
          action: 'Created Purchase Bill',
          actionBn: 'ক্রয় চালান তৈরি',
          userName: creatorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${purDate} ${nowTime}`,
        },
        ...(status === 'PAID'
          ? [
              {
                action: 'Payment Cleared in Full',
                actionBn: 'সম্পূর্ণ পরিশোধিত',
                userName: creatorName,
                userId: currentUser?.id,
                userRole: currentUser?.role,
                timestamp: `${purDate} ${nowTime}`,
              },
            ]
          : []),
      ],
      createdAt: `${purDate} ${nowTime}`,
    };

    // 1. Increase product stock (normalized to base unit e.g. 1 CTN -> 12 Pcs), register batch & normalized base cost
    setProducts(prevProds =>
      prevProds.map(prod => {
        const boughtItems = data.items.filter(i => i.productId === prod.id);
        if (boughtItems.length === 0) return prod;

        const existingBatches = prod.batches ? [...prod.batches.map(b => ({ ...b }))] : [];

        // If product had initial stock without explicit batches, seed a base batch
        if (existingBatches.length === 0 && prod.stock > 0) {
          existingBatches.push({
            id: `batch-init-${prod.id}`,
            batchNumber: prod.batchNumber || 'INIT-BATCH',
            expDate: prod.expDate || '',
            purchaseDate: prod.createdAt || purDate,
            purchaseInvoiceNo: 'INIT-STOCK',
            purchasePrice: prod.purchasePrice || 0,
            salesPrice: prod.salesPrice || 0,
            stock: prod.stock,
            initialStock: prod.stock,
            createdAt: prod.createdAt || `${purDate} ${nowTime}`,
          });
        }

        let newTotalStock = Number(prod.stock || 0);
        let latestBasePurchasePrice = prod.purchasePrice;
        let latestBatchNumber = prod.batchNumber || '';
        let latestBatchExp = prod.expDate || '';

        for (const itemBought of boughtItems) {
          const factor = getEffectiveConversionFactor(itemBought, prod);
          const addedBaseQty = getBaseQuantity(itemBought, prod);
          const basePurchasePrice =
            Number(itemBought.purchasePrice || 0) > 0
              ? computeNormalizedItemCost(Number(itemBought.purchasePrice), factor)
              : prod.purchasePrice;
          const baseSalesPrice = itemBought.salesPrice
            ? computeNormalizedItemCost(Number(itemBought.salesPrice), factor)
            : prod.salesPrice;

          const bNum =
            itemBought.batchNumber ||
            (itemBought.expDate
              ? `B-${itemBought.expDate.replace(/-/g, '')}`
              : prod.batchNumber || `B-${purDate.replace(/-/g, '')}`);
          const bExp = itemBought.expDate || prod.expDate || '';

          const existingBatchIdx = existingBatches.findIndex(
            b => b.batchNumber.trim().toLowerCase() === bNum.trim().toLowerCase() && (b.expDate || '') === bExp
          );

          if (existingBatchIdx >= 0) {
            existingBatches[existingBatchIdx] = {
              ...existingBatches[existingBatchIdx],
              stock: Number((existingBatches[existingBatchIdx].stock + addedBaseQty).toFixed(4)),
              purchasePrice: basePurchasePrice || existingBatches[existingBatchIdx].purchasePrice,
              purchaseDate: purDate,
              purchaseInvoiceNo: billNum,
              supplierName: data.supplierName,
              supplierId: data.supplierId,
            };
          } else {
            const newBatch: ProductBatch = {
              id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              batchNumber: bNum,
              expDate: bExp,
              mfgDate: itemBought.mfgDate || '',
              purchaseDate: purDate,
              purchaseInvoiceNo: billNum,
              purchasePrice: basePurchasePrice || prod.purchasePrice,
              salesPrice: baseSalesPrice,
              stock: addedBaseQty,
              initialStock: addedBaseQty,
              supplierId: data.supplierId,
              supplierName: data.supplierName,
              createdAt: `${purDate} ${nowTime}`,
            };
            existingBatches.push(newBatch);
          }

          newTotalStock = Number((newTotalStock + addedBaseQty).toFixed(4));
          latestBasePurchasePrice = basePurchasePrice || latestBasePurchasePrice;
          latestBatchNumber = bNum;
          if (bExp) latestBatchExp = bExp;
        }

        // Find earliest active expiry date for the product (FEFO)
        const activeBatchesWithExp = existingBatches.filter(b => Number(b.stock) > 0 && b.expDate);
        activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
        const earliestActiveExp = activeBatchesWithExp[0]?.expDate || latestBatchExp || prod.expDate || '';

        return {
          ...prod,
          stock: newTotalStock,
          purchasePrice: latestBasePurchasePrice || prod.purchasePrice,
          expDate: earliestActiveExp,
          batchNumber: latestBatchNumber || prod.batchNumber,
          batches: existingBatches,
        };
      })
    );

    // 2. Increase supplier due if there is unpaid amount
    if (effectiveDueAmount > 0 && data.supplierId) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === data.supplierId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + effectiveDueAmount).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Deduct paid amount from wallet (Cash In Hand) ONLY if paid > 0 (NEVER for Credit / DUE purchase)
    if (effectivePaidAmount > 0 && !isPureCreditPurchase && selectedWallet) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          if (w.id === selectedWallet.id) {
            return {
              ...w,
              balance: Math.max(0, Number((w.balance - effectivePaidAmount).toFixed(2))),
            };
          }
          return w;
        })
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 4. Always log every purchase in Day Book (Transaction Ledger)
    // - If effectivePaidAmount > 0, amount is effectivePaidAmount (wallet deducted funds)
    // - If credit purchase (effectivePaidAmount = 0), amount is 0 so Cash In Hand / Money Out does NOT change!
    const dayBookEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: billNum,
      date: purDate,
      type: 'PURCHASE',
      flow: 'OUT',
      partyId: data.supplierId,
      partyName: data.supplierName,
      partyType: 'SUPPLIER',
      amount: effectivePaidAmount, // ONLY actual paid amount deducted from wallet! (0 if credit)
      walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'credit',
      walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
      referenceId: newPurchase.id,
      referenceNo: billNum,
      remarks: data.notes 
        ? `Purchase from ${data.supplierName} (${data.notes})` 
        : effectivePaidAmount > 0
          ? `Purchase payment to ${data.supplierName} (Total: ৳${data.grandTotal.toLocaleString()}, Paid: ৳${effectivePaidAmount.toLocaleString()}${effectiveDueAmount > 0 ? `, Remaining Due: ৳${effectiveDueAmount.toLocaleString()}` : ''})`
          : `Credit Purchase / বাকি ক্রয় from ${data.supplierName} (Total: ৳${data.grandTotal.toLocaleString()}, Due: ৳${effectiveDueAmount.toLocaleString()})`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${purDate} ${nowTime}`,
    };
    setDayBookEntries(prev => [dayBookEntry, ...prev]);

    setPurchaseInvoices(prev => [newPurchase, ...prev.filter(p => p.id !== newPurchase.id)]);
    showToast(
      language === 'bn'
        ? `ক্রয় ভাউচার ${billNum} সফলভাবে সংরক্ষিত হয়েছে।`
        : `Purchase bill ${billNum} created successfully.`
    );
    return newPurchase;
  };

  const updatePurchaseInvoice = (
    invoiceId: string,
    data: {
      billNumber?: string;
      supplierId: string;
      supplierName: string;
      supplierPhone: string;
      supplierInvoiceNo?: string;
      items: {
        productId: string;
        productName: string;
        unit: any;
        conversionFactor?: number;
        baseQuantity?: number;
        quantity: number;
        purchasePrice: number;
        total: number;
        batchNumber?: string;
        expDate?: string;
        mfgDate?: string;
        salesPrice?: number;
      }[];
      subtotal: number;
      discount: number;
      taxAmount: number;
      grandTotal: number;
      paidAmount: number;
      dueAmount: number;
      paymentMethod: PaymentMethod;
      walletId: string;
      notes?: string;
      date?: string;
    }
  ): PurchaseInvoice | null => {
    const oldInv = purchaseInvoices.find(p => p.id === invoiceId);
    if (!oldInv) {
      showToast(language === 'bn' ? 'ক্রয় চালানটি খুঁজে পাওয়া যায়নি!' : 'Purchase bill not found!', 'error');
      return null;
    }

    const rawBillNum = data.billNumber?.trim() || data.supplierInvoiceNo?.trim() || oldInv.billNumber;
    const otherPurchases = purchaseInvoices.filter(p => p.id !== invoiceId);
    const duplicateBill = checkDuplicatePurchaseInvoice(rawBillNum, otherPurchases);
    if (duplicateBill) {
      showToast(
        language === 'bn'
          ? `⚠️ বিল নং "${rawBillNum}" ইতোমধ্যে অন্য ক্রয় চালানে ব্যবহৃত হয়েছে!`
          : `⚠️ Bill number "${rawBillNum}" is already used by another purchase bill!`,
        'error'
      );
      return null;
    }

    const billNum = rawBillNum;
    const purDate = data.date || oldInv.date || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    const isPureCreditPurchase =
      data.paymentMethod === 'DUE' || data.walletId === 'credit' || data.walletId === 'due';
    if (!isPureCreditPurchase && Number(data.paidAmount || 0) < 0) {
      showToast(language === 'bn' ? 'পরিশোধের পরিমাণ ঋণাত্মক হতে পারে না!' : 'Paid amount cannot be negative!', 'error');
      return null;
    }

    const effectivePaidAmount = isPureCreditPurchase ? 0 : Math.max(0, Number(data.paidAmount || 0));
    const effectiveDueAmount = isPureCreditPurchase
      ? Math.max(0, Number(data.grandTotal || 0))
      : Math.max(0, Number(data.dueAmount ?? Math.max(0, Number(data.grandTotal || 0) - effectivePaidAmount)));
    const effectivePaymentMethod: PaymentMethod =
      effectivePaidAmount <= 0 && effectiveDueAmount > 0 ? 'DUE' : data.paymentMethod;
    const selectedWallet =
      effectivePaidAmount > 0 ? (wallets.find(w => w.id === data.walletId) || wallets[0]) : undefined;

    // Validate wallet balance accounting for refund from oldInv if same wallet
    if (effectivePaidAmount > 0) {
      if (!selectedWallet) {
        showToast(
          language === 'bn' ? 'পেমেন্ট ওয়ালেট খুঁজে পাওয়া যায়নি!' : 'Payment wallet not found!',
          'error'
        );
        return null;
      }
      const oldPaidFromThisWallet =
        oldInv.paidAmount > 0 &&
        oldInv.paymentMethod !== 'DUE' &&
        oldInv.walletId === selectedWallet.id
          ? oldInv.paidAmount
          : 0;
      const availableBalance = Number((selectedWallet.balance + oldPaidFromThisWallet).toFixed(2));
      if (availableBalance + 1e-6 < effectivePaidAmount) {
        showToast(
          language === 'bn'
            ? `নির্বাচিত ওয়ালেটে (${selectedWallet.name}) পর্যাপ্ত ব্যালেন্স নেই! সম্ভাব্য ব্যালেন্স: ৳${availableBalance.toLocaleString()} | পরিশোধ: ৳${effectivePaidAmount.toLocaleString()}`
            : `Insufficient balance in ${selectedWallet.name}! Available: ৳${availableBalance.toLocaleString()} | Trying to pay: ৳${effectivePaidAmount.toLocaleString()}.`,
          'error'
        );
        return null;
      }
    }

    let status: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID';
    if (effectiveDueAmount > 0 && effectivePaidAmount > 0) {
      status = 'PARTIAL';
    } else if (effectivePaidAmount === 0 && effectiveDueAmount > 0) {
      status = 'DUE';
    }

    const editorName = currentUser?.fullName || currentUser?.username || 'Admin';

    const updatedPurchase: PurchaseInvoice = {
      ...oldInv,
      billNumber: billNum,
      supplierInvoiceNo: rawBillNum || data.supplierInvoiceNo || billNum,
      date: purDate,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      taxAmount: data.taxAmount,
      grandTotal: data.grandTotal,
      paidAmount: effectivePaidAmount,
      dueAmount: effectiveDueAmount,
      paymentMethod: effectivePaymentMethod,
      walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'credit',
      walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
      status,
      notes: data.notes,
      updatedBy: editorName,
      completedBy: status === 'PAID' ? (oldInv.completedBy || editorName) : undefined,
      contributors: [
        ...(oldInv.contributors || []),
        {
          action: 'Updated Purchase Bill',
          actionBn: 'ক্রয় চালান ইডিট / আপডেট',
          userName: editorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${purDate} ${nowTime}`,
        },
      ],
    };

    // 1. Reconcile product stock & batches in a single atomic pass (revert oldInv, then apply updated items)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const oldBoughtItems = oldInv.items.filter(i => i.productId === prod.id);
        const newBoughtItems = data.items.filter(i => i.productId === prod.id);
        if (oldBoughtItems.length === 0 && newBoughtItems.length === 0) return prod;

        let workingBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : [];
        let newTotalStock = Number(prod.stock || 0);

        // Step A: Revert old purchase invoice quantities & batch entries
        if (oldBoughtItems.length > 0) {
          const totalOldBaseQty = oldBoughtItems.reduce((sum, i) => sum + getBaseQuantity(i, prod), 0);
          if (workingBatches.length > 0) {
            let remainingToDeduct = totalOldBaseQty;
            workingBatches = workingBatches
              .map(b => {
                const matchesOldRef =
                  b.purchaseInvoiceNo === oldInv.billNumber ||
                  (oldInv.supplierInvoiceNo && b.purchaseInvoiceNo === oldInv.supplierInvoiceNo);
                if (matchesOldRef && remainingToDeduct > 0) {
                  const take = Math.min(b.stock, remainingToDeduct);
                  remainingToDeduct = Number((remainingToDeduct - take).toFixed(4));
                  return {
                    ...b,
                    stock: Math.max(0, Number((b.stock - take).toFixed(4))),
                  };
                }
                return b;
              })
              .filter(
                b =>
                  b.stock > 0 ||
                  (b.purchaseInvoiceNo !== oldInv.billNumber &&
                    (!oldInv.supplierInvoiceNo || b.purchaseInvoiceNo !== oldInv.supplierInvoiceNo))
              );

            // If some old qty belonged to a merged batch that didn't match billNumber directly
            if (remainingToDeduct > 1e-6) {
              for (const oldIt of oldBoughtItems) {
                if (remainingToDeduct <= 1e-6) break;
                const oldBNum = oldIt.batchNumber?.trim().toLowerCase();
                if (oldBNum) {
                  const bIdx = workingBatches.findIndex(
                    b => b.batchNumber.trim().toLowerCase() === oldBNum && (b.expDate || '') === (oldIt.expDate || '')
                  );
                  if (bIdx >= 0 && workingBatches[bIdx].stock > 0) {
                    const take = Math.min(workingBatches[bIdx].stock, remainingToDeduct);
                    workingBatches[bIdx].stock = Math.max(0, Number((workingBatches[bIdx].stock - take).toFixed(4)));
                    remainingToDeduct = Number((remainingToDeduct - take).toFixed(4));
                  }
                }
              }
            }
          }
          newTotalStock = Math.max(0, Number((newTotalStock - totalOldBaseQty).toFixed(4)));
        }

        // Step B: Apply new/edited purchase items
        let latestBasePurchasePrice = prod.purchasePrice;
        let latestBatchNumber = prod.batchNumber || '';
        let latestBatchExp = prod.expDate || '';

        if (newBoughtItems.length > 0) {
          if (workingBatches.length === 0 && newTotalStock > 0) {
            workingBatches.push({
              id: `batch-init-${prod.id}`,
              batchNumber: prod.batchNumber || 'INIT-BATCH',
              expDate: prod.expDate || '',
              purchaseDate: prod.createdAt || purDate,
              purchaseInvoiceNo: 'INIT-STOCK',
              purchasePrice: prod.purchasePrice || 0,
              salesPrice: prod.salesPrice || 0,
              stock: newTotalStock,
              initialStock: newTotalStock,
              createdAt: prod.createdAt || `${purDate} ${nowTime}`,
            });
          }

          for (const itemBought of newBoughtItems) {
            const factor = getEffectiveConversionFactor(itemBought, prod);
            const addedBaseQty = getBaseQuantity(itemBought, prod);
            const basePurchasePrice =
              Number(itemBought.purchasePrice || 0) > 0
                ? computeNormalizedItemCost(Number(itemBought.purchasePrice), factor)
                : prod.purchasePrice;
            const baseSalesPrice = itemBought.salesPrice
              ? computeNormalizedItemCost(Number(itemBought.salesPrice), factor)
              : prod.salesPrice;

            const bNum =
              itemBought.batchNumber ||
              (itemBought.expDate
                ? `B-${itemBought.expDate.replace(/-/g, '')}`
                : prod.batchNumber || `B-${purDate.replace(/-/g, '')}`);
            const bExp = itemBought.expDate || prod.expDate || '';

            const existingBatchIdx = workingBatches.findIndex(
              b => b.batchNumber.trim().toLowerCase() === bNum.trim().toLowerCase() && (b.expDate || '') === bExp
            );

            if (existingBatchIdx >= 0) {
              workingBatches[existingBatchIdx] = {
                ...workingBatches[existingBatchIdx],
                stock: Number((workingBatches[existingBatchIdx].stock + addedBaseQty).toFixed(4)),
                purchasePrice: basePurchasePrice || workingBatches[existingBatchIdx].purchasePrice,
                purchaseDate: purDate,
                purchaseInvoiceNo: billNum,
                supplierName: data.supplierName,
                supplierId: data.supplierId,
              };
            } else {
              workingBatches.push({
                id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                batchNumber: bNum,
                expDate: bExp,
                mfgDate: itemBought.mfgDate || '',
                purchaseDate: purDate,
                purchaseInvoiceNo: billNum,
                purchasePrice: basePurchasePrice || prod.purchasePrice,
                salesPrice: baseSalesPrice,
                stock: addedBaseQty,
                initialStock: addedBaseQty,
                supplierId: data.supplierId,
                supplierName: data.supplierName,
                createdAt: `${purDate} ${nowTime}`,
              });
            }

            newTotalStock = Number((newTotalStock + addedBaseQty).toFixed(4));
            latestBasePurchasePrice = basePurchasePrice || latestBasePurchasePrice;
            latestBatchNumber = bNum;
            if (bExp) latestBatchExp = bExp;
          }
        }

        const activeBatchesWithExp = workingBatches.filter(b => Number(b.stock) > 0 && b.expDate);
        activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
        const earliestActiveExp = activeBatchesWithExp[0]?.expDate || latestBatchExp || prod.expDate || '';

        return {
          ...prod,
          stock: newTotalStock,
          purchasePrice: latestBasePurchasePrice || prod.purchasePrice,
          expDate: earliestActiveExp,
          batchNumber: latestBatchNumber || prod.batchNumber,
          batches: workingBatches.length > 0 ? workingBatches : undefined,
        };
      })
    );

    // 2. Reconcile Supplier Due Balance in a single pass
    const oldAffectsSupplier = Boolean(oldInv.supplierId) && oldInv.dueAmount > 0;
    const newAffectsSupplier = Boolean(data.supplierId) && effectiveDueAmount > 0;
    if (oldAffectsSupplier || newAffectsSupplier) {
      setParties(prevParties =>
        prevParties.map(p => {
          let bal = p.currentBalance;
          if (oldAffectsSupplier && p.id === oldInv.supplierId) {
            bal = Math.max(0, Number((bal - oldInv.dueAmount).toFixed(2)));
          }
          if (newAffectsSupplier && p.id === data.supplierId) {
            bal = Number((bal + effectiveDueAmount).toFixed(2));
          }
          return bal !== p.currentBalance ? { ...p, currentBalance: bal } : p;
        })
      );
    }

    // 3. Reconcile Wallet Balance in a single pass (refund old payment, deduct new payment)
    const oldAffectsWallet =
      oldInv.paidAmount > 0 &&
      oldInv.paymentMethod !== 'DUE' &&
      Boolean(oldInv.walletId) &&
      oldInv.walletId !== 'credit' &&
      oldInv.walletId !== 'due';
    const newAffectsWallet = effectivePaidAmount > 0 && !isPureCreditPurchase && Boolean(selectedWallet);

    if (oldAffectsWallet || newAffectsWallet) {
      setWallets(prevWallets =>
        prevWallets.map(w => {
          let bal = w.balance;
          if (oldAffectsWallet && w.id === oldInv.walletId) {
            bal = Number((bal + oldInv.paidAmount).toFixed(2));
          }
          if (newAffectsWallet && selectedWallet && w.id === selectedWallet.id) {
            bal = Math.max(0, Number((bal - effectivePaidAmount).toFixed(2)));
          }
          return bal !== w.balance ? { ...w, balance: bal } : w;
        })
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 4. Update linked DayBook Entry IN-PLACE & collapse any duplicate entries for this purchase bill
    const updatedDayBookRemarks = data.notes
      ? `Purchase from ${data.supplierName} (${data.notes})`
      : effectivePaidAmount > 0
        ? `Purchase payment to ${data.supplierName} (Total: ৳${data.grandTotal.toLocaleString()}, Paid: ৳${effectivePaidAmount.toLocaleString()}${effectiveDueAmount > 0 ? `, Remaining Due: ৳${effectiveDueAmount.toLocaleString()}` : ''})`
        : `Credit Purchase / বাকি ক্রয় from ${data.supplierName} (Total: ৳${data.grandTotal.toLocaleString()}, Due: ৳${effectiveDueAmount.toLocaleString()})`;

    const isPurchaseDayBookMatch = (d: DayBookEntry) =>
      d.type === 'PURCHASE' &&
      (d.referenceId === invoiceId ||
        d.id === `db-pur-${invoiceId}` ||
        d.voucherNo === oldInv.billNumber ||
        d.referenceNo === oldInv.billNumber ||
        (oldInv.supplierInvoiceNo && (d.voucherNo === oldInv.supplierInvoiceNo || d.referenceNo === oldInv.supplierInvoiceNo)) ||
        d.voucherNo === billNum ||
        d.referenceNo === billNum);

    const matchingPurDbEntries = dayBookEntries.filter(isPurchaseDayBookMatch);
    const extraPurDbIds = matchingPurDbEntries.slice(1).map(d => d.id);
    if (extraPurDbIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', extraPurDbIds);
    }

    setDayBookEntries(prev => {
      const firstMatchIdx = prev.findIndex(isPurchaseDayBookMatch);
      if (firstMatchIdx >= 0) {
        const primaryId = prev[firstMatchIdx].id;
        return prev
          .filter(d => !isPurchaseDayBookMatch(d) || d.id === primaryId)
          .map(d =>
            d.id === primaryId
              ? {
                  ...d,
                  referenceId: invoiceId,
                  voucherNo: billNum,
                  referenceNo: billNum,
                  date: purDate,
                  partyId: data.supplierId,
                  partyName: data.supplierName,
                  amount: effectivePaidAmount,
                  walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'credit',
                  walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
                  remarks: updatedDayBookRemarks,
                }
              : d
          );
      }
      return [
        {
          id: `db-${Date.now()}`,
          voucherNo: billNum,
          date: purDate,
          type: 'PURCHASE',
          flow: 'OUT',
          partyId: data.supplierId,
          partyName: data.supplierName,
          partyType: 'SUPPLIER',
          amount: effectivePaidAmount,
          walletId: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.id : 'credit',
          walletName: effectivePaidAmount > 0 && selectedWallet ? selectedWallet.name : 'Credit / বাকি',
          referenceId: invoiceId,
          referenceNo: billNum,
          remarks: updatedDayBookRemarks,
          createdBy: currentUser?.id || 'usr-1',
          createdAt: `${purDate} ${nowTime}`,
        },
        ...prev,
      ];
    });

    // 5. Update PurchaseInvoice IN-PLACE & deduplicate by ID (NEVER append/duplicate!)
    setPurchaseInvoices(prev => dedupeById(prev.map(p => (p.id === invoiceId ? updatedPurchase : p))));

    // 5.5 Sync updated Bill # across linked Purchase Returns
    if (billNum !== oldInv.billNumber) {
      setPurchaseReturns(prev =>
        prev.map(r =>
          r.purchaseId === invoiceId || r.originalBillNumber === oldInv.billNumber
            ? { ...r, originalBillNumber: billNum }
            : r
        )
      );
    }

    showToast(
      language === 'bn'
        ? `ক্রয় ভাউচার ${billNum} সফলভাবে আপডেট হয়েছে।`
        : `Purchase bill ${billNum} updated successfully.`
    );
    return updatedPurchase;
  };

  const deletePurchaseInvoice = (invoiceId: string, reason?: string): boolean => {
    const inv = purchaseInvoices.find(i => i.id === invoiceId);
    if (!inv) {
      showToast(language === 'bn' ? 'চালানটি খুঁজে পাওয়া যায়নি!' : 'Purchase Bill not found!', 'error');
      return false;
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const nowStr = formatDeletionTimestamp();
    const adminDeleting = isAdminUser();
    const finalReason =
      reason?.trim() ||
      (adminDeleting
        ? (language === 'bn' ? 'অ্যাডমিন কর্তৃক ক্রয় চালান মুছে ফেলা হয়েছে' : 'Purchase bill deleted by Admin')
        : (language === 'bn' ? 'ইউজার কর্তৃক ক্রয় চালান মুছে ফেলা হয়েছে' : 'Purchase bill deleted by user'));

    const linkedPurchaseReturns = purchaseReturns.filter(
      r => r.purchaseId === inv.id || r.originalBillNumber === inv.billNumber
    );
    const linkedPurReturnIds = new Set(linkedPurchaseReturns.map(r => r.id));
    const linkedPurReturnVoucherNos = new Set(linkedPurchaseReturns.map(r => r.returnNumber));

    // 1. Always save to in-app deletedPurchaseInvoices (Delete List) for BOTH Admin and Staff
    const deletedRecord: DeletedPurchaseInvoice = {
      id: `del-pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalPurchaseId: inv.id,
      billNumber: inv.billNumber,
      supplierInvoiceNo: inv.supplierInvoiceNo,
      date: inv.date,
      supplierId: inv.supplierId,
      supplierName: inv.supplierName,
      supplierPhone: inv.supplierPhone,
      items: inv.items || [],
      subtotal: inv.subtotal,
      discount: inv.discount,
      taxAmount: inv.taxAmount,
      grandTotal: inv.grandTotal,
      paidAmount: inv.paidAmount,
      dueAmount: inv.dueAmount,
      paymentMethod: inv.paymentMethod,
      walletId: inv.walletId,
      walletName: inv.walletName,
      createdBy: inv.createdBy,
      deletedAt: nowStr,
      deletedBy: {
        id: currentUser?.id || 'usr-1',
        username: currentUser?.username || (adminDeleting ? 'admin' : 'staff'),
        fullName: currentUser?.fullName || (adminDeleting ? 'Super Admin' : 'Staff'),
        role: currentUser?.role || (adminDeleting ? 'ADMIN' : 'MANAGER'),
      },
      deletionReason: finalReason,
      invoiceSnapshot: JSON.parse(JSON.stringify(inv)),
      ...(linkedPurchaseReturns.length > 0 ? { linkedPurchaseReturns: JSON.parse(JSON.stringify(linkedPurchaseReturns)) } : {}),
    };

    setDeletedPurchaseInvoices(prev => {
      const updated = [deletedRecord, ...prev];
      try {
        localStorage.setItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to standalone deleted purchase archive', e);
      }
      return updated;
    });

    // 2. Revert product stocks and batch entries (deduct net un-returned bought quantities in base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const boughtItems = inv.items.filter(i => i.productId === prod.id);
        if (boughtItems.length > 0) {
          const totalBoughtBaseQty = boughtItems.reduce((sum, i) => sum + getBaseQuantity(i, prod), 0);
          const alreadyReturnedBaseQty = linkedPurchaseReturns.reduce((retSum, r) => {
            const matchingRetItems = (r.items || []).filter(ri => ri.productId === prod.id);
            return (
              retSum +
              matchingRetItems.reduce(
                (s, ri) =>
                  s +
                  getBaseQuantity(
                    {
                      quantity: ri.returnQuantity,
                      unit: ri.unit,
                      conversionFactor: ri.conversionFactor,
                      baseQuantity: ri.baseQuantity,
                    },
                    prod
                  ),
                0
              )
            );
          }, 0);
          const netQtyToDeduct = Math.max(0, Number((totalBoughtBaseQty - alreadyReturnedBaseQty).toFixed(4)));

          let updatedBatches = prod.batches ? [...prod.batches.map(b => ({ ...b }))] : [];
          if (updatedBatches.length > 0 && netQtyToDeduct > 0) {
            let remainingToDeduct = netQtyToDeduct;
            updatedBatches = updatedBatches
              .map(b => {
                if (b.purchaseInvoiceNo === inv.billNumber && remainingToDeduct > 0) {
                  const take = Math.min(b.stock, remainingToDeduct);
                  remainingToDeduct = Number((remainingToDeduct - take).toFixed(4));
                  return {
                    ...b,
                    stock: Math.max(0, Number((b.stock - take).toFixed(4))),
                  };
                }
                return b;
              })
              .filter(b => b.stock > 0 || b.purchaseInvoiceNo !== inv.billNumber);
          }

          const newStock = Math.max(0, Number((prod.stock - netQtyToDeduct).toFixed(4)));
          const activeBatchesWithExp = updatedBatches.filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

          return {
            ...prod,
            stock: newStock,
            batches: updatedBatches.length > 0 ? updatedBatches : undefined,
            expDate: earliestActiveExp,
          };
        }
        return prod;
      })
    );

    // 3. Adjust Supplier Due balance if this invoice increased supplier's due
    if (inv.supplierId && inv.dueAmount > 0) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === inv.supplierId) {
            return {
              ...p,
              currentBalance: Math.max(0, Number((p.currentBalance - inv.dueAmount).toFixed(2))),
            };
          }
          return p;
        })
      );
    }

    // 4. Identify linked DayBook entries & revert wallet balance cleanly
    const isLinkedPurchaseDb = (d: DayBookEntry) =>
      (d.type === 'PURCHASE' && (d.referenceId === inv.id || d.id === `db-pur-${inv.id}`)) ||
      d.voucherNo === inv.billNumber ||
      d.referenceNo === inv.billNumber ||
      (inv.supplierInvoiceNo && (d.voucherNo === inv.supplierInvoiceNo || d.referenceNo === inv.supplierInvoiceNo)) ||
      (d.type === 'PURCHASE_RETURN' &&
        (linkedPurReturnVoucherNos.has(d.voucherNo) || d.referenceNo === inv.billNumber));

    const linkedPurDbEntries = dayBookEntries.filter(isLinkedPurchaseDb);
    const linkedPurDbPaidMax = linkedPurDbEntries
      .filter(d => d.type === 'PURCHASE' && d.flow === 'OUT')
      .reduce((mx, d) => Math.max(mx, Number(d.amount || 0)), 0);
    const paidToRevert = Math.max(Number(inv.paidAmount || 0), linkedPurDbPaidMax);

    const linkedPurDbWalletEntry = linkedPurDbEntries.find(
      d => d.type === 'PURCHASE' && d.walletId && !NON_CASH_WALLET_IDS.has(String(d.walletId).toLowerCase())
    );
    const purWalletHint =
      inv.walletId && !NON_CASH_WALLET_IDS.has(String(inv.walletId).toLowerCase())
        ? inv.walletId
        : linkedPurDbWalletEntry?.walletId;
    const purWalletNameHint =
      inv.walletName && inv.walletName !== 'Credit / বাকি'
        ? inv.walletName
        : linkedPurDbWalletEntry?.walletName;

    if (paidToRevert > 0) {
      setWallets(prevWallets => creditAmountToWallets(prevWallets, paidToRevert, purWalletHint, purWalletNameHint));
    }

    // 5. Remove & tombstone linked DayBook entries and Purchase Returns
    const removedDayBookIds = linkedPurDbEntries.map(d => d.id);
    setDayBookEntries(prev => prev.filter(d => !isLinkedPurchaseDb(d)));
    if (removedDayBookIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }

    if (linkedPurchaseReturns.length > 0) {
      setPurchaseReturns(prev =>
        prev.filter(r => !linkedPurReturnIds.has(r.id) && !linkedPurReturnVoucherNos.has(r.returnNumber))
      );
      recordDeletedTombstones('purchaseReturns', [
        ...linkedPurchaseReturns.map(r => r.id),
        ...linkedPurchaseReturns.map(r => r.returnNumber),
      ]);
    }

    // 6. Remove invoice from active purchaseInvoices state & tombstone so it never resurrects on sync/reload
    setPurchaseInvoices(prev => prev.filter(i => i.id !== invoiceId));
    recordDeletedTombstones('purchaseInvoices', [inv.id, inv.billNumber]);

    // 7. Log Activity (Delete List holds both Admin and Staff deletions; deleting from there archives to separate SQL)
    logActivity({
      actionType: 'DELETE',
      title: `Deleted Purchase Bill #${inv.billNumber}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted purchase bill #${inv.billNumber} from ${inv.supplierName} (৳${inv.grandTotal.toLocaleString()}). Reason: ${finalReason}`,
      severity: 'danger',
      targetId: inv.id,
      targetName: `Purchase Bill #${inv.billNumber}`,
    });

    showToast(
      language === 'bn'
        ? `ক্রয় চালান #${inv.billNumber} ডিলিট লিস্টে (Delete Purchase Archive) রাখা হয়েছে! সেখান থেকে ডিলিট করলে আলাদা SQL ফাইলে জমা থাকবে।`
        : `Purchase bill #${inv.billNumber} moved to Delete Purchase archive! Deleting from there saves it to separate SQL archive.`,
      'success'
    );

    return true;
  };

  const applyRestoredPurchaseInvoice = (
    restoredInv: PurchaseInvoice,
    linkedReturns: PurchaseReturn[] = []
  ): boolean => {
    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // 1. Add back net un-returned product stocks and batches (normalized to base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const boughtItems = (restoredInv.items || []).filter(i => i.productId === prod.id);
        if (boughtItems.length === 0) return prod;

        const alreadyReturnedBaseQty = linkedReturns.reduce((retSum, r) => {
          const matchingRetItems = (r.items || []).filter(ri => ri.productId === prod.id);
          return (
            retSum +
            matchingRetItems.reduce(
              (s, ri) =>
                s +
                getBaseQuantity(
                  {
                    quantity: ri.returnQuantity,
                    unit: ri.unit,
                    conversionFactor: ri.conversionFactor,
                    baseQuantity: ri.baseQuantity,
                  },
                  prod
                ),
              0
            )
          );
        }, 0);

        const existingBatches = prod.batches ? [...prod.batches.map(b => ({ ...b }))] : [];
        let newStock = Number(prod.stock || 0);
        let remReturnedOffset = alreadyReturnedBaseQty;

        for (const itemPurchased of boughtItems) {
          const factor = getEffectiveConversionFactor(itemPurchased, prod);
          const origBaseQty = getBaseQuantity(itemPurchased, prod);
          const skipRet = Math.min(origBaseQty, remReturnedOffset);
          remReturnedOffset = Math.max(0, Number((remReturnedOffset - skipRet).toFixed(4)));
          const addedBaseQty = Math.max(0, Number((origBaseQty - skipRet).toFixed(4)));
          if (addedBaseQty <= 0) continue;

          const basePurchasePrice =
            Number(itemPurchased.purchasePrice || 0) > 0
              ? computeNormalizedItemCost(Number(itemPurchased.purchasePrice), factor)
              : prod.purchasePrice;
          const baseSalesPrice = itemPurchased.salesPrice
            ? computeNormalizedItemCost(Number(itemPurchased.salesPrice), factor)
            : prod.salesPrice;

          const bNum = itemPurchased.batchNumber || `BATCH-${restoredInv.billNumber}`;
          const bExp = itemPurchased.expDate || '';

          const batchIdx = existingBatches.findIndex(
            b => b.batchNumber.trim().toLowerCase() === bNum.trim().toLowerCase() && (b.expDate || '') === bExp
          );

          if (batchIdx >= 0) {
            existingBatches[batchIdx] = {
              ...existingBatches[batchIdx],
              stock: Number((existingBatches[batchIdx].stock + addedBaseQty).toFixed(4)),
            };
          } else {
            existingBatches.push({
              id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              batchNumber: bNum,
              expDate: bExp,
              mfgDate: itemPurchased.mfgDate || '',
              purchaseDate: restoredInv.date,
              purchaseInvoiceNo: restoredInv.billNumber,
              purchasePrice: basePurchasePrice || prod.purchasePrice,
              salesPrice: baseSalesPrice,
              stock: addedBaseQty,
              initialStock: addedBaseQty,
              supplierId: restoredInv.supplierId,
              supplierName: restoredInv.supplierName,
              createdAt: `${restoredInv.date} 12:00:00`,
            });
          }

          newStock = Number((newStock + addedBaseQty).toFixed(4));
        }

        const activeBatchesWithExp = existingBatches.filter(b => Number(b.stock) > 0 && b.expDate);
        activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
        const earliestExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

        return {
          ...prod,
          stock: newStock,
          batches: existingBatches,
          expDate: earliestExp,
        };
      })
    );

    // 2. Re-apply supplier due
    if (restoredInv.supplierId && restoredInv.dueAmount > 0) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === restoredInv.supplierId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + restoredInv.dueAmount).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Deduct wallet balance for paid amount if paid
    if (Number(restoredInv.paidAmount || 0) > 0 && restoredInv.paymentMethod !== 'DUE') {
      setWallets(prevWallets =>
        deductAmountFromWallets(prevWallets, restoredInv.paidAmount, restoredInv.walletId, restoredInv.walletName)
      );
    }

    // 4. Put back into active purchaseInvoices, linked returns & restore PURCHASE DayBook entry + clear tombstones
    removeDeletedTombstones('purchaseInvoices', [restoredInv.id, restoredInv.billNumber]);
    removeDeletedTombstones('dayBookEntries', [`db-pur-${restoredInv.id}`]);
    setPurchaseInvoices(prev => [restoredInv, ...prev.filter(i => i.id !== restoredInv.id)]);

    if (linkedReturns.length > 0) {
      removeDeletedTombstones(
        'purchaseReturns',
        linkedReturns.flatMap(r => [r.id, r.returnNumber])
      );
      setPurchaseReturns(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const toAdd = linkedReturns.filter(r => !existingIds.has(r.id));
        return [...toAdd, ...prev];
      });
    }

    setDayBookEntries(prev => {
      const exists = prev.some(
        d =>
          d.type === 'PURCHASE' &&
          (d.referenceId === restoredInv.id ||
            d.id === `db-pur-${restoredInv.id}` ||
            d.voucherNo === restoredInv.billNumber)
      );
      if (exists) return prev;
      const resolvedWalletId =
        restoredInv.paidAmount > 0 && restoredInv.walletId && !NON_CASH_WALLET_IDS.has(restoredInv.walletId)
          ? restoredInv.walletId
          : restoredInv.paidAmount > 0
            ? 'w-cash'
            : 'due';
      const resolvedWalletName =
        restoredInv.paidAmount > 0
          ? (wallets.find(w => w.id === resolvedWalletId)?.name || restoredInv.walletName || 'Cash')
          : 'Credit / বাকি';
      const restoredDbEntry: DayBookEntry = {
        id: `db-pur-${restoredInv.id}`,
        voucherNo: restoredInv.billNumber,
        date: restoredInv.date,
        type: 'PURCHASE',
        flow: 'OUT',
        partyId: restoredInv.supplierId,
        partyName: restoredInv.supplierName,
        partyType: 'SUPPLIER',
        amount: restoredInv.paidAmount || 0,
        walletId: resolvedWalletId,
        walletName: resolvedWalletName,
        referenceId: restoredInv.id,
        referenceNo: restoredInv.billNumber,
        remarks: `Restored Purchase bill from ${restoredInv.supplierName} (Total: ৳${restoredInv.grandTotal.toLocaleString()})`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: restoredInv.createdAt || `${restoredInv.date} 12:00:00`,
      };
      return [restoredDbEntry, ...prev];
    });

    return true;
  };

  const restoreDeletedPurchaseInvoice = (deletedPurchaseId: string): boolean => {
    const record = deletedPurchaseInvoices.find(d => d.id === deletedPurchaseId || d.originalPurchaseId === deletedPurchaseId);
    if (!record || !record.invoiceSnapshot) {
      showToast(language === 'bn' ? 'ডিলিট করা ক্রয় চালানটি পাওয়া যায়নি!' : 'Deleted purchase record not found!', 'error');
      return false;
    }

    const restoredInv: PurchaseInvoice = record.invoiceSnapshot;
    applyRestoredPurchaseInvoice(restoredInv, record.linkedPurchaseReturns || []);

    // Remove from deletedPurchaseInvoices
    recordDeletedTombstones('deletedPurchaseInvoices', [record.id]);
    setDeletedPurchaseInvoices(prev => {
      const updated = prev.filter(d => d.id !== record.id);
      try {
        localStorage.setItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Log Activity
    logActivity({
      actionType: 'USER_ACTION',
      title: `Restored Purchase Bill #${restoredInv.billNumber}`,
      description: `User '${currentUser?.fullName || 'Admin'}' restored deleted purchase bill #${restoredInv.billNumber} from ${restoredInv.supplierName} (৳${restoredInv.grandTotal.toLocaleString()}).`,
      severity: 'info',
      targetId: restoredInv.id,
      targetName: `Purchase Bill #${restoredInv.billNumber}`,
    });

    showToast(
      language === 'bn'
        ? `ক্রয় চালান #${restoredInv.billNumber} সফলভাবে পুনরুদ্ধার (Restore) করা হয়েছে!`
        : `Purchase bill #${restoredInv.billNumber} restored successfully!`,
      'success'
    );

    return true;
  };

  const permanentlyDeleteArchivedPurchase = (deletedPurchaseId: string): boolean => {
    if (currentUser?.role !== 'ADMIN') {
      showToast(
        language === 'bn'
          ? 'অনুমতি নেই! ডিলিটকৃত ক্রয় চালান শুধুমাত্র অ্যাডমিন স্থায়ীভাবে মুছে ফেলতে পারবেন।'
          : 'Permission denied! Only Admin can permanently delete archived purchases.',
        'error'
      );
      return false;
    }

    const record = deletedPurchaseInvoices.find(d => d.id === deletedPurchaseId);
    if (!record) {
      showToast(language === 'bn' ? 'ক্রয় চালানটি পাওয়া যায়নি!' : 'Purchase record not found!', 'error');
      return false;
    }

    setDeletedPurchaseInvoices(prev => {
      const updated = prev.filter(d => d.id !== deletedPurchaseId);
      try {
        localStorage.setItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    recordDeletedTombstones('deletedPurchaseInvoices', [record.id]);
    recordDeletedTombstones('purchaseInvoices', [record.originalPurchaseId, record.billNumber]);

    archiveAdminDeletion([
      {
        entityType: 'ARCHIVED_PURCHASE_INVOICE',
        sourceTable: 'deleted_purchase_invoices',
        recordId: record.originalPurchaseId || record.id,
        referenceNo: record.billNumber,
        title: `Archived Purchase Bill #${record.billNumber} - ${record.supplierName}`,
        amount: record.grandTotal,
        reason: record.deletionReason || 'Permanently removed from archive by Admin',
        snapshot: record,
      },
    ]);

    showToast(
      language === 'bn'
        ? `ক্রয় চালান #${record.billNumber} সফটওয়্যার থেকে সম্পূর্ণ মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
        : `Purchase bill #${record.billNumber} completely removed from software and saved to admin_deleted_records.sql.`,
      'info'
    );

    return true;
  };

  const clearAllDeletedPurchases = () => {
    if (currentUser?.role !== 'ADMIN') {
      showToast(
        language === 'bn'
          ? 'অনুমতি নেই! শুধুমাত্র অ্যাডমিন সকল ডিলিট ক্রয় হিস্ট্রি সাফ করতে পারবেন।'
          : 'Permission denied! Only Admin can clear all deleted purchases history.',
        'error'
      );
      return;
    }

    const snapshotList = [...deletedPurchaseInvoices];
    setDeletedPurchaseInvoices([]);
    try {
      localStorage.removeItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE');
    } catch {}
    recordDeletedTombstones('deletedPurchaseInvoices', snapshotList.map(r => r.id));
    recordDeletedTombstones(
      'purchaseInvoices',
      snapshotList.flatMap(r => [r.originalPurchaseId, r.billNumber])
    );

    if (snapshotList.length > 0) {
      archiveAdminDeletion(
        snapshotList.map(record => ({
          entityType: 'ARCHIVED_PURCHASE_INVOICE',
          sourceTable: 'deleted_purchase_invoices',
          recordId: record.originalPurchaseId || record.id,
          referenceNo: record.billNumber,
          title: `Archived Purchase Bill #${record.billNumber} - ${record.supplierName}`,
          amount: record.grandTotal,
          reason: record.deletionReason || 'Bulk purged deleted purchases by Admin',
          snapshot: record,
        }))
      );
    }

    showToast(
      language === 'bn'
        ? 'সকল ডিলিট হওয়া ক্রয় চালান সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
        : 'All deleted purchases removed from software and saved to admin_deleted_records.sql.',
      'info'
    );
  };

  const exportSingleDeletedPurchaseToFile = (purchase: DeletedPurchaseInvoice) => {
    const exportData = {
      title: `DokanPro ERP - Deleted Purchase Snapshot (${purchase.billNumber})`,
      shopName: companySettings.shopName,
      shopPhone: companySettings.phone,
      exportedAt: new Date().toISOString(),
      billNumber: purchase.billNumber,
      supplierName: purchase.supplierName,
      supplierPhone: purchase.supplierPhone,
      grandTotal: purchase.grandTotal,
      paidAmount: purchase.paidAmount,
      dueAmount: purchase.dueAmount,
      deletedAt: purchase.deletedAt,
      deletedBy: purchase.deletedBy,
      deletionReason: purchase.deletionReason,
      items: purchase.items,
      fullSnapshot: purchase.invoiceSnapshot,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deleted-purchase-${purchase.billNumber}-${Date.now().toString().slice(-4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      language === 'bn'
        ? `ক্রয় চালান #${purchase.billNumber} এর JSON ফাইল সফলভাবে ডাউনলোড হয়েছে।`
        : `Deleted purchase #${purchase.billNumber} JSON file exported.`,
      'success'
    );
  };

  const exportDeletedPurchasesToFile = () => {
    if (deletedPurchaseInvoices.length === 0) {
      showToast(language === 'bn' ? 'কোন ডিলিট করা ক্রয় চালান পাওয়া যায়নি!' : 'No deleted purchases to export!', 'warning');
      return;
    }

    const exportData = {
      title: 'DokanPro ERP - Delete Purchase Audit File',
      shopName: companySettings.shopName,
      shopPhone: companySettings.phone,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        name: currentUser?.fullName || 'Super Admin',
        username: currentUser?.username || 'admin',
        role: currentUser?.role || 'ADMIN',
      },
      totalDeletedPurchases: deletedPurchaseInvoices.length,
      totalDeletedAmount: deletedPurchaseInvoices.reduce((sum, d) => sum + (d.grandTotal || 0), 0),
      records: deletedPurchaseInvoices,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deleted-purchases-audit-${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      language === 'bn'
        ? 'ডিলিট হওয়া ক্রয় চালানের অডিট ফাইল (.json) সফলভাবে ডাউনলোড হয়েছে।'
        : 'Delete Purchase audit file downloaded successfully.',
      'success'
    );
  };

  const createPurchaseReturn = (returnData: {
    purchaseId: string;
    originalBillNumber: string;
    supplierId: string;
    supplierName: string;
    items: {
      productId: string;
      productName: string;
      unit: any;
      conversionFactor?: number;
      baseQuantity?: number;
      purchasePrice: number;
      returnQuantity: number;
      totalAmount: number;
      batchNumber?: string;
      expDate?: string;
    }[];
    totalAmount: number;
    refundWalletId: string;
    reason: string;
    settlementMode?: 'AUTO' | 'CASH_REFUND';
  }): boolean => {
    const origBill = purchaseInvoices.find(i => i.id === returnData.purchaseId);
    const existingReturnsForBill = purchaseReturns.filter(r => r.purchaseId === returnData.purchaseId);

    // Validate returnable quantities (supports multiple partial returns up to purchased quantity)
    if (origBill) {
      const boughtQtyByProduct = new Map<string, number>();
      origBill.items.forEach(it => {
        boughtQtyByProduct.set(it.productId, Number(((boughtQtyByProduct.get(it.productId) || 0) + Number(it.quantity || 0)).toFixed(4)));
      });

      const prevRetQtyByProduct = new Map<string, number>();
      existingReturnsForBill.forEach(ret => {
        ret.items.forEach(it => {
          prevRetQtyByProduct.set(it.productId, Number(((prevRetQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4)));
        });
      });

      const requestedQtyByProduct = new Map<string, number>();
      returnData.items.forEach(it => {
        requestedQtyByProduct.set(it.productId, Number(((requestedQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4)));
      });

      let hasAnyRemaining = false;
      boughtQtyByProduct.forEach((boughtQty, pid) => {
        if (boughtQty - (prevRetQtyByProduct.get(pid) || 0) > 0.0001) {
          hasAnyRemaining = true;
        }
      });

      if (!hasAnyRemaining) {
        showToast(
          language === 'bn' ? 'এই ক্রয় বিলের সকল পণ্য ইতিমধ্যে ফেরত দেওয়া হয়েছে!' : 'All items on this purchase bill have already been returned!',
          'error'
        );
        return false;
      }

      for (const [pid, reqQty] of requestedQtyByProduct.entries()) {
        const maxAllowed = Number(((boughtQtyByProduct.get(pid) || 0) - (prevRetQtyByProduct.get(pid) || 0)).toFixed(4));
        if (reqQty > maxAllowed + 0.0001) {
          showToast(
            language === 'bn'
              ? `ফেরতের পরিমাণ অবশিষ্ট ক্রয় পরিমাণের (${maxAllowed}) চেয়ে বেশি হতে পারে না!`
              : `Return quantity cannot exceed remaining returnable quantity (${maxAllowed})!`,
            'error'
          );
          return false;
        }
      }
    }

    const returnAmount = Number(Number(returnData.totalAmount || 0).toFixed(2));
    if (returnAmount <= 0 || returnData.items.length === 0) {
      showToast(
        language === 'bn' ? 'ফেরতের জন্য অন্তত একটি পণ্যের পরিমাণ দিন!' : 'Please enter at least one item to return!',
        'error'
      );
      return false;
    }

    // Strict stock availability check: never allow returning more stock than currently available in hand
    const requestedBaseByProduct = new Map<string, number>();
    for (const item of returnData.items) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;
      const itemBaseQty = getBaseQuantity(
        {
          quantity: item.returnQuantity,
          unit: item.unit,
          conversionFactor: item.conversionFactor,
          baseQuantity: item.baseQuantity,
        },
        prod
      );
      requestedBaseByProduct.set(
        prod.id,
        Number(((requestedBaseByProduct.get(prod.id) || 0) + itemBaseQty).toFixed(4))
      );
    }
    for (const [pid, reqBaseQty] of requestedBaseByProduct.entries()) {
      const prod = products.find(p => p.id === pid);
      if (prod && Number(prod.stock || 0) + 1e-6 < reqBaseQty) {
        showToast(
          language === 'bn'
            ? `অপর্যাপ্ত স্টক! "${prod.name}"-এর বর্তমান স্টক ${formatCleanNumber(Number(prod.stock || 0))} ${prod.unit}, কিন্তু রিটার্ন চাওয়া হয়েছে ${formatCleanNumber(reqBaseQty)} ${prod.unit}। স্টক মাইনাস (-) হতে পারবে না।`
            : `Insufficient stock for "${prod.name}"! Available: ${formatCleanNumber(Number(prod.stock || 0))} ${prod.unit}, requested return: ${formatCleanNumber(reqBaseQty)} ${prod.unit}. Stock cannot go negative.`,
          'error'
        );
        return false;
      }
    }

    const returnNum = `PRET-2026-${50 + purchaseReturns.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const fullTimeStamp = formatDeletionTimestamp();
    const refundWallet = wallets.find(w => w.id === returnData.refundWalletId);

    // Resolve supplier for automatic Total Payable adjustment
    const supplier = returnData.supplierId ? parties.find(p => p.id === returnData.supplierId) : undefined;
    const settlementMode: 'AUTO' | 'CASH_REFUND' = returnData.settlementMode || 'AUTO';
    const billDue = Math.max(0, Number(origBill?.dueAmount || 0));
    const billPaid = Math.max(0, Number(origBill?.paidAmount || 0));
    const supplierPayable = supplier ? Math.max(0, Number(supplier.currentBalance || 0)) : 0;

    let partyDueReduced = 0;
    let billOnlyDueReduced = 0;
    let cashRefunded = 0;

    if (settlementMode === 'CASH_REFUND') {
      // Cash refund received from supplier is capped by what was paid on the bill
      const maxCashFromBill = origBill ? Math.min(returnAmount, billPaid) : returnAmount;
      cashRefunded = Number(maxCashFromBill.toFixed(2));
      const unpaidPortion = Number(Math.max(0, returnAmount - cashRefunded).toFixed(2));
      if (unpaidPortion > 0) {
        if (supplier && supplierPayable > 0) {
          partyDueReduced = Number(Math.min(unpaidPortion, supplierPayable).toFixed(2));
        } else if (!supplier && billDue > 0) {
          billOnlyDueReduced = Number(Math.min(unpaidPortion, billDue).toFixed(2));
        }
        const adjusted = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));
        cashRefunded = Number(Math.max(0, returnAmount - adjusted).toFixed(2));
      }
    } else {
      // AUTO mode: Automatically reduce Total Payable (Supplier Balance) first, rest comes back to Cash/Bank Wallet
      if (supplier && supplierPayable > 0) {
        partyDueReduced = Number(Math.min(returnAmount, supplierPayable).toFixed(2));
      } else if (!supplier && billDue > 0) {
        billOnlyDueReduced = Number(Math.min(returnAmount, billDue).toFixed(2));
      }
      const totalPayableOffset = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));
      cashRefunded = Number(Math.max(0, returnAmount - totalPayableOffset).toFixed(2));
    }

    const dueAdjusted = Number((partyDueReduced + billOnlyDueReduced).toFixed(2));

    if (cashRefunded > 0 && (!returnData.refundWalletId || !refundWallet)) {
      showToast(
        language === 'bn' ? 'রিফান্ড রিসিভ ওয়ালেট খুঁজে পাওয়া যায়নি!' : 'Refund wallet not found!',
        'error'
      );
      return false;
    }

    // Calculate exact invoice deltas for original purchase bill update & exact reversal
    let invoiceGrandTotalDelta = 0;
    let invoiceSubtotalDelta = 0;
    let invoiceDueDelta = 0;
    let invoicePaidDelta = 0;
    const previousInvoiceStatus = origBill?.status;

    if (origBill) {
      invoiceGrandTotalDelta = Number(Math.min(origBill.grandTotal, returnAmount).toFixed(2));
      invoiceSubtotalDelta = Number(Math.min(origBill.subtotal, returnAmount).toFixed(2));
      invoiceDueDelta = Number(Math.min(origBill.dueAmount, dueAdjusted).toFixed(2));
      const paidDeltaTarget = Number(Math.max(0, invoiceGrandTotalDelta - invoiceDueDelta).toFixed(2));
      invoicePaidDelta = Number(Math.min(origBill.paidAmount, paidDeltaTarget).toFixed(2));
      const remainingDelta = Number((invoiceGrandTotalDelta - invoiceDueDelta - invoicePaidDelta).toFixed(2));
      if (remainingDelta > 0 && origBill.dueAmount - invoiceDueDelta > 0) {
        const extraDue = Math.min(remainingDelta, Number((origBill.dueAmount - invoiceDueDelta).toFixed(2)));
        invoiceDueDelta = Number((invoiceDueDelta + extraDue).toFixed(2));
      }
    }

    const newReturn: PurchaseReturn = {
      id: `pret-${Date.now()}`,
      returnNumber: returnNum,
      originalBillNumber: returnData.originalBillNumber,
      purchaseId: returnData.purchaseId,
      date: today,
      supplierId: returnData.supplierId,
      supplierName: returnData.supplierName,
      items: returnData.items,
      totalAmount: returnAmount,
      dueAdjusted,
      partyDueReduced,
      cashRefunded,
      settlementMode,
      invoiceGrandTotalDelta,
      invoiceSubtotalDelta,
      invoicePaidDelta,
      invoiceDueDelta,
      previousInvoiceStatus,
      refundWalletId: cashRefunded > 0 ? returnData.refundWalletId : 'credit',
      refundWalletName:
        cashRefunded > 0
          ? (refundWallet?.name || 'Cash')
          : (language === 'bn' ? 'দেনা সমন্বয় (Payable Adjusted)' : 'Payable Adjusted'),
      reason: returnData.reason,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: fullTimeStamp,
    };

    // 1. Auto-update product stock AND batches (deduct in base units, matching bill batch first)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const retItems = returnData.items.filter(i => i.productId === prod.id);
        if (retItems.length > 0) {
          const totalRetBaseQty = retItems.reduce(
            (sum, i) =>
              sum +
              getBaseQuantity(
                {
                  quantity: i.returnQuantity,
                  unit: i.unit,
                  conversionFactor: i.conversionFactor,
                  baseQuantity: i.baseQuantity,
                },
                prod
              ),
            0
          );

          let updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
          if (updatedBatches && updatedBatches.length > 0) {
            retItems.forEach(retItem => {
              let remToDeduct = getBaseQuantity(
                {
                  quantity: retItem.returnQuantity,
                  unit: retItem.unit,
                  conversionFactor: retItem.conversionFactor,
                  baseQuantity: retItem.baseQuantity,
                },
                prod
              );
              // Prefer batch matching exact batchNumber or originalBillNumber
              for (let i = 0; i < updatedBatches!.length && remToDeduct > 0; i++) {
                const b = updatedBatches![i];
                const matchesBatch =
                  (retItem.batchNumber && b.batchNumber === retItem.batchNumber) ||
                  b.purchaseInvoiceNo === returnData.originalBillNumber;
                if (matchesBatch && Number(b.stock || 0) > 0) {
                  const take = Math.min(Number(b.stock || 0), remToDeduct);
                  updatedBatches![i].stock = Math.max(0, Number((Number(b.stock || 0) - take).toFixed(4)));
                  remToDeduct = Number((remToDeduct - take).toFixed(4));
                }
              }
              // Deduct any remaining from other batches with stock > 0
              for (let i = 0; i < updatedBatches!.length && remToDeduct > 0; i++) {
                const avail = Number(updatedBatches![i].stock || 0);
                if (avail > 0) {
                  const take = Math.min(avail, remToDeduct);
                  updatedBatches![i].stock = Math.max(0, Number((avail - take).toFixed(4)));
                  remToDeduct = Number((remToDeduct - take).toFixed(4));
                }
              }
            });
          }

          const activeBatchesWithExp = (updatedBatches || []).filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

          return {
            ...prod,
            stock: Math.max(0, Number((prod.stock - totalRetBaseQty).toFixed(4))),
            ...(updatedBatches ? { batches: updatedBatches, expDate: earliestActiveExp } : {}),
          };
        }
        return prod;
      })
    );

    // 2. Auto-update Supplier Balance (Total Payable)
    if (partyDueReduced > 0 && supplier) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === supplier.id) {
            return {
              ...p,
              currentBalance: Math.max(0, Number((p.currentBalance - partyDueReduced).toFixed(2))),
            };
          }
          return p;
        })
      );
    }

    // 3. Auto-update Original Purchase Bill amounts, due & status
    if (origBill) {
      const updatedAllReturns = [...existingReturnsForBill, newReturn];
      const totalReturnedQtyByProduct = new Map<string, number>();
      updatedAllReturns.forEach(ret => {
        ret.items.forEach(it => {
          totalReturnedQtyByProduct.set(
            it.productId,
            Number(((totalReturnedQtyByProduct.get(it.productId) || 0) + Number(it.returnQuantity || 0)).toFixed(4))
          );
        });
      });

      const boughtQtyByProduct = new Map<string, number>();
      origBill.items.forEach(it => {
        boughtQtyByProduct.set(
          it.productId,
          Number(((boughtQtyByProduct.get(it.productId) || 0) + Number(it.quantity || 0)).toFixed(4))
        );
      });

      let allItemsReturned = true;
      boughtQtyByProduct.forEach((boughtQty, pid) => {
        if ((totalReturnedQtyByProduct.get(pid) || 0) < boughtQty - 0.0001) {
          allItemsReturned = false;
        }
      });

      setPurchaseInvoices(prevBills =>
        prevBills.map(bill => {
          if (bill.id !== origBill.id) return bill;
          const newGrandTotal = Math.max(0, Number((bill.grandTotal - invoiceGrandTotalDelta).toFixed(2)));
          const newSubtotal = Math.max(0, Number((bill.subtotal - invoiceSubtotalDelta).toFixed(2)));
          const newDueAmount = Math.max(0, Number((bill.dueAmount - invoiceDueDelta).toFixed(2)));
          const newPaidAmount = Math.max(0, Number((bill.paidAmount - invoicePaidDelta).toFixed(2)));
          const newReturnedAmount = Number(((bill.returnedAmount || 0) + returnAmount).toFixed(2));
          const isFull = allItemsReturned || newGrandTotal <= 0;
          const newStatus: InvoiceStatus =
            newGrandTotal <= 0 || newDueAmount <= 0
              ? 'PAID'
              : newPaidAmount > 0
                ? 'PARTIAL'
                : 'DUE';

          return {
            ...bill,
            originalGrandTotal: bill.originalGrandTotal ?? bill.grandTotal,
            subtotal: newSubtotal,
            grandTotal: newGrandTotal,
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount,
            returnedAmount: newReturnedAmount,
            returnStatus: isFull ? 'FULL' : 'PARTIAL',
            status: newStatus,
          };
        })
      );
    }

    // 4. Increase refund wallet balance ONLY for actual cash/bank refund received back
    if (cashRefunded > 0 && returnData.refundWalletId) {
      setWallets(prev =>
        prev.map(w => {
          if (w.id === returnData.refundWalletId) {
            return {
              ...w,
              balance: Number((w.balance + cashRefunded).toFixed(2)),
            };
          }
          return w;
        })
      );
    }

    // 5. Log in Day Book (amount reflects actual liquid cash received; 0 if adjusted against Payable)
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: returnNum,
      date: today,
      type: 'PURCHASE_RETURN',
      flow: 'IN',
      partyId: returnData.supplierId,
      partyName: returnData.supplierName,
      partyType: 'SUPPLIER',
      amount: cashRefunded,
      walletId: cashRefunded > 0 ? returnData.refundWalletId : 'credit',
      walletName:
        cashRefunded > 0
          ? (refundWallet?.name || 'Cash')
          : 'Payable Adjusted / দেনা সমন্বয়',
      referenceNo: returnData.originalBillNumber,
      remarks: `Purchase return to ${returnData.supplierName} for #${returnData.originalBillNumber} (Total: ৳${returnAmount.toLocaleString()}${dueAdjusted > 0 ? `, Payable Reduced: ৳${dueAdjusted.toLocaleString()}` : ''}${cashRefunded > 0 ? `, Cash Refund: ৳${cashRefunded.toLocaleString()}` : ''}) - ${returnData.reason}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: fullTimeStamp,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    logActivity({
      actionType: 'USER_ACTION',
      title: `Created Purchase Return #${returnNum}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'ADMIN'}) created purchase return #${returnNum} for Bill #${returnData.originalBillNumber} (Supplier: ${returnData.supplierName}, Return: ৳${returnAmount.toLocaleString()}, Payable Adjusted: ৳${dueAdjusted.toLocaleString()}, Cash Refund: ৳${cashRefunded.toLocaleString()}) on ${fullTimeStamp}.`,
      severity: 'info',
      targetId: newReturn.id,
      targetName: `Purchase Return #${returnNum}`,
    });

    setPurchaseReturns(prev => [newReturn, ...prev]);
    showToast(
      language === 'bn'
        ? `ক্রয় রিটার্ন ${returnNum} সফল! স্টক ও বিল আপডেট হয়েছে${dueAdjusted > 0 ? ` • দেনা (Payable) কমেছে ৳${dueAdjusted.toLocaleString()}` : ''}${cashRefunded > 0 ? ` • ক্যাশ রিফান্ড ৳${cashRefunded.toLocaleString()}` : ''}।`
        : `Purchase return ${returnNum} saved! Stock & bill updated${dueAdjusted > 0 ? ` • Payable reduced by ৳${dueAdjusted.toLocaleString()}` : ''}${cashRefunded > 0 ? ` • Cash received ৳${cashRefunded.toLocaleString()}` : ''}.`,
      'success'
    );
    return true;
  };

  const deletePurchaseReturn = (returnIdOrNum: string) => {
    const targetReturn = purchaseReturns.find(r => r.id === returnIdOrNum || r.returnNumber === returnIdOrNum);
    if (!targetReturn) return;

    // 1. Revert product stocks AND batches (add back what was returned to supplier in base units)
    setProducts(prevProds =>
      prevProds.map(prod => {
        const retItems = targetReturn.items.filter(i => i.productId === prod.id);
        if (retItems.length > 0) {
          const totalRetBaseQty = retItems.reduce(
            (sum, i) =>
              sum +
              getBaseQuantity(
                {
                  quantity: i.returnQuantity,
                  unit: i.unit,
                  conversionFactor: i.conversionFactor,
                  baseQuantity: i.baseQuantity,
                },
                prod
              ),
            0
          );

          let updatedBatches = prod.batches ? prod.batches.map(b => ({ ...b })) : undefined;
          if (updatedBatches && updatedBatches.length > 0) {
            retItems.forEach(retItem => {
              const itemBaseQty = getBaseQuantity(
                {
                  quantity: retItem.returnQuantity,
                  unit: retItem.unit,
                  conversionFactor: retItem.conversionFactor,
                  baseQuantity: retItem.baseQuantity,
                },
                prod
              );
              const matchIdx = updatedBatches!.findIndex(
                b =>
                  (retItem.batchNumber && b.batchNumber === retItem.batchNumber) ||
                  b.purchaseInvoiceNo === targetReturn.originalBillNumber
              );
              const targetIdx = matchIdx >= 0 ? matchIdx : updatedBatches!.length - 1;
              if (targetIdx >= 0) {
                updatedBatches![targetIdx] = {
                  ...updatedBatches![targetIdx],
                  stock: Number((Number(updatedBatches![targetIdx].stock || 0) + itemBaseQty).toFixed(4)),
                };
              }
            });
          }

          const activeBatchesWithExp = (updatedBatches || []).filter(b => Number(b.stock) > 0 && b.expDate);
          activeBatchesWithExp.sort((a, b) => a.expDate.localeCompare(b.expDate));
          const earliestActiveExp = activeBatchesWithExp[0]?.expDate || prod.expDate || '';

          return {
            ...prod,
            stock: Number((prod.stock + totalRetBaseQty).toFixed(4)),
            ...(updatedBatches ? { batches: updatedBatches, expDate: earliestActiveExp } : {}),
          };
        }
        return prod;
      })
    );

    const targetOrigBill = purchaseInvoices.find(
      b => b.id === targetReturn.purchaseId || b.billNumber === targetReturn.originalBillNumber
    );
    const hasActiveOrigBill = Boolean(targetOrigBill);

    // 2. Revert Supplier Balance (Total Payable restored ONLY if original bill is still active)
    const partyDueToRestore = Number(targetReturn.partyDueReduced || 0);
    if (hasActiveOrigBill && partyDueToRestore > 0 && targetReturn.supplierId) {
      setParties(prevParties =>
        prevParties.map(p => {
          if (p.id === targetReturn.supplierId) {
            return {
              ...p,
              currentBalance: Number((p.currentBalance + partyDueToRestore).toFixed(2)),
            };
          }
          return p;
        })
      );
    }

    // 3. Revert Original Purchase Bill amounts, due & status
    const grandDelta = Number(targetReturn.invoiceGrandTotalDelta ?? 0);
    const subDelta = Number(targetReturn.invoiceSubtotalDelta ?? 0);
    const paidDelta = Number(targetReturn.invoicePaidDelta ?? 0);
    const dueDelta = Number(targetReturn.invoiceDueDelta ?? 0);
    if (hasActiveOrigBill && targetOrigBill && (grandDelta > 0 || subDelta > 0 || paidDelta > 0 || dueDelta > 0)) {
      const remainingReturnsCount = purchaseReturns.filter(
        r => (r.purchaseId === targetOrigBill.id || r.originalBillNumber === targetOrigBill.billNumber) && r.id !== targetReturn.id
      ).length;

      setPurchaseInvoices(prevBills =>
        prevBills.map(bill => {
          if (bill.id !== targetOrigBill.id) return bill;
          const restoredGrand = Number((bill.grandTotal + grandDelta).toFixed(2));
          const restoredSub = Number((bill.subtotal + subDelta).toFixed(2));
          const restoredPaid = Number((bill.paidAmount + paidDelta).toFixed(2));
          const restoredDue = Number((bill.dueAmount + dueDelta).toFixed(2));
          const restoredReturnedAmt = Math.max(0, Number(((bill.returnedAmount || 0) - targetReturn.totalAmount).toFixed(2)));
          const restoredStatus: InvoiceStatus =
            restoredDue <= 0 ? 'PAID' : restoredPaid > 0 ? 'PARTIAL' : 'DUE';

          return {
            ...bill,
            subtotal: restoredSub,
            grandTotal: restoredGrand,
            paidAmount: restoredPaid,
            dueAmount: restoredDue,
            returnedAmount: restoredReturnedAmt,
            returnStatus: remainingReturnsCount === 0 || restoredReturnedAmt <= 0 ? 'NONE' : 'PARTIAL',
            status: restoredStatus,
          };
        })
      );
    }

    // 4. Revert wallet balance for actual cash refund only (ONLY if original bill is still active) & remove DayBook entry
    const cashToRevert =
      targetReturn.cashRefunded !== undefined ? Number(targetReturn.cashRefunded) : Number(targetReturn.totalAmount || 0);
    if (
      hasActiveOrigBill &&
      cashToRevert > 0 &&
      targetReturn.refundWalletId &&
      !NON_CASH_WALLET_IDS.has(String(targetReturn.refundWalletId).toLowerCase())
    ) {
      setWallets(prevWallets =>
        deductAmountFromWallets(prevWallets, cashToRevert, targetReturn.refundWalletId, targetReturn.refundWalletName)
      );
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    const removedDayBookIds = dayBookEntries
      .filter(db => db.voucherNo === targetReturn.returnNumber)
      .map(db => db.id);
    if (removedDayBookIds.length > 0) {
      setDayBookEntries(prev => prev.filter(db => db.voucherNo !== targetReturn.returnNumber));
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }

    setPurchaseReturns(prev => prev.filter(r => r.id !== targetReturn.id && r.returnNumber !== targetReturn.returnNumber));
    recordDeletedTombstones('purchaseReturns', [targetReturn.id, targetReturn.returnNumber]);

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'PURCHASE_RETURN',
          sourceTable: 'purchase_returns',
          recordId: targetReturn.id,
          referenceNo: targetReturn.returnNumber,
          title: `Purchase Return #${targetReturn.returnNumber} - ${targetReturn.supplierName}`,
          amount: targetReturn.totalAmount,
          reason: targetReturn.reason,
          snapshot: targetReturn,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: ফেরত বিল ${targetReturn.returnNumber} সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: Purchase return ${targetReturn.returnNumber} removed from software and saved to admin_deleted_records.sql.`,
        'success'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Purchase Return #${targetReturn.returnNumber}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted purchase return #${targetReturn.returnNumber} (Amount: ৳${targetReturn.totalAmount.toLocaleString()}) on ${nowStr}.`,
      severity: 'danger',
      targetId: targetReturn.id,
      targetName: `Purchase Return #${targetReturn.returnNumber}`,
    });

    showToast(
      language === 'bn'
        ? `ফেরত বিল ${targetReturn.returnNumber} (${nowStr}) ডিলিট করা হয়েছে এবং স্টক, বিল ও দেনা পুনরুদ্ধার হয়েছে।`
        : `Purchase return ${targetReturn.returnNumber} deleted on ${nowStr}. Stock, bill & payable restored.`,
      'success'
    );
  };

  const recordPaymentOut = (data: {
    partyId: string;
    amount: number;
    walletId: string;
    date: string;
    remarks: string;
  }): boolean => {
    const supplier = parties.find(p => p.id === data.partyId);
    const wallet = wallets.find(w => w.id === data.walletId);
    const voucherNo = `PAY-2026-${700 + dayBookEntries.length + 1}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (!supplier) {
      showToast(
        language === 'bn' ? 'সাপ্লায়ার/মহাজন নির্বাচন করুন!' : 'Please select a supplier!',
        'error'
      );
      return false;
    }

    // Validate supplier and wallet
    if (!wallet) {
      showToast(
        language === 'bn' ? 'পেমেন্ট ওয়ালেট নির্বাচন করুন!' : 'Please select a payment wallet!',
        'error'
      );
      return false;
    }

    if (!data.amount || data.amount <= 0) {
      showToast(
        language === 'bn' ? 'সঠিক পরিশোধের পরিমাণ (৳) লিখুন!' : 'Please enter a valid payment amount!',
        'error'
      );
      return false;
    }

    // Supplier payable due ceiling check
    const supplierDue = Math.max(0, Number(supplier.currentBalance || 0));

    if (supplierDue <= 0) {
      showToast(
        language === 'bn'
          ? `সাপ্লায়ার ${supplier.name} এর কোনো বকেয়া পাওনা বিল নেই (দেনা ৳০)! দেনা ছাড়া টাকা পরিশোধ করা যাবে না।`
          : `Supplier ${supplier.name} has no payable balance (৳0)! Cannot make payment when there is no payable balance.`,
        'error'
      );
      return false;
    }

    if (data.amount > supplierDue) {
      showToast(
        language === 'bn'
          ? `⚠️ মহাজন পাওনা বিলের চেয়ে বেশি টাকা পরিশোধ করা যাবে না! মোট বকেয়া ৳${supplierDue.toLocaleString()}। আপনি ৳${data.amount.toLocaleString()} পরিশোধ করতে চেয়েছেন। সর্বোচ্চ ৳${supplierDue.toLocaleString()} বা এর চেয়ে কম পরিশোধ করতে পারবেন।`
          : `Cannot pay more than supplier payable due! Outstanding bill is ৳${supplierDue.toLocaleString()}, but attempted ৳${data.amount.toLocaleString()}. Maximum allowed is ৳${supplierDue.toLocaleString()}.`,
        'error'
      );
      return false;
    }

    if (wallet.balance < data.amount) {
      showToast(
        language === 'bn'
          ? `নির্বাচিত ওয়ালেটে (${wallet.name}) পর্যাপ্ত টাকা নেই! বর্তমান ব্যালেন্স: ৳${wallet.balance.toLocaleString()} | পরিশোধ করতে চেয়েছেন: ৳${data.amount.toLocaleString()}। অনুগ্রহ করে ওয়ালেট পরিবর্তন করুন বা তহবিল জমা দিন।`
          : `Insufficient balance in ${wallet.name}! Current balance: ৳${wallet.balance.toLocaleString()} | Requested: ৳${data.amount.toLocaleString()}. Please choose another wallet or deposit funds.`,
        'error'
      );
      return false;
    }

    // 1. Decrease supplier payable
    setParties(prev =>
      prev.map(p => {
        if (p.id === data.partyId) {
          return {
            ...p,
            currentBalance: Math.max(0, p.currentBalance - data.amount),
          };
        }
        return p;
      })
    );

    // 2. Deduct from wallet (never below 0)
    setWallets(prev =>
      prev.map(w => {
        if (w.id === data.walletId) {
          return {
            ...w,
            balance: Math.max(0, Number((w.balance - data.amount).toFixed(2))),
          };
        }
        return w;
      })
    );

    // 3. Day book log
    const entry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: data.date,
      type: 'PAYMENT_OUT',
      flow: 'OUT',
      partyId: data.partyId,
      partyName: supplier?.name || 'Supplier',
      partyType: 'SUPPLIER',
      amount: data.amount,
      walletId: data.walletId,
      walletName: wallet?.name || 'Cash',
      referenceNo: voucherNo,
      remarks: data.remarks || `Payment to supplier ${supplier?.name}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${data.date} ${nowTime}`,
    };
    setDayBookEntries(prev => [entry, ...prev]);

    const remainingDue = Math.max(0, (supplier?.currentBalance || 0) - data.amount);

    // Open Payment Out Debit Voucher
    openPrintModal({
      type: 'PAYMENT_OUT_VOUCHER',
      title: language === 'bn' ? 'টাকা পরিশোধ ডেবিট ভাউচার' : 'Payment Out Debit Voucher',
      data: {
        voucherNo,
        date: data.date,
        partyName: supplier?.name,
        partyPhone: supplier?.phone,
        companyName: supplier?.companyName,
        amount: data.amount,
        walletName: wallet?.name,
        remarks: data.remarks || 'Supplier Bill Due Settlement',
        remainingDue,
      },
    });

    showToast(
      language === 'bn'
        ? `সাপ্লায়ার ${supplier?.name} কে ৳${data.amount.toLocaleString()} পরিশোধ করা হয়েছে (${wallet.name})।`
        : `Paid ${formatCurrency(data.amount)} to supplier ${supplier?.name} (${wallet.name})`
    );
    return true;
  };

  // -------------------------------------------------------------
  // Installment / EMI Logic
  // -------------------------------------------------------------
  const createInstallmentScheme = (
    schemeData: Omit<InstallmentScheme, 'id' | 'schemeNumber' | 'createdAt'>,
    options?: { skipDayBookAndWallet?: boolean }
  ): InstallmentScheme => {
    const schemeNum = `EMI-2026-${300 + installmentSchemes.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    const creatorName = currentUser?.fullName || currentUser?.username || 'Admin';

    const newScheme: InstallmentScheme = {
      ...schemeData,
      id: `emi-${Date.now()}`,
      schemeNumber: schemeNum,
      createdBy: creatorName,
      contributors: [
        {
          action: 'Created EMI Scheme',
          actionBn: 'কিস্তি স্কিম চালু',
          userName: creatorName,
          userId: currentUser?.id,
          userRole: currentUser?.role,
          timestamp: `${today} ${nowTime}`,
        },
      ],
      createdAt: `${today} ${nowTime}`,
    };

    // If downpayment is received, log in daybook and update wallet (if not skipped because invoice already processed it)
    if (schemeData.downPayment > 0 && !options?.skipDayBookAndWallet) {
      const defaultWallet = wallets[0]; // Cash drawer
      setWallets(prev =>
        prev.map(w => (w.id === defaultWallet.id ? { ...w, balance: w.balance + schemeData.downPayment } : w))
      );

      const dbEntry: DayBookEntry = {
        id: `db-${Date.now()}`,
        voucherNo: schemeNum,
        date: today,
        type: 'EMI_COLLECTION',
        flow: 'IN',
        partyId: schemeData.customerId,
        partyName: schemeData.customerName,
        partyType: 'CUSTOMER',
        amount: schemeData.downPayment,
        walletId: defaultWallet.id,
        walletName: defaultWallet.name,
        referenceNo: schemeNum,
        remarks: `Down Payment for Installment Scheme: ${schemeData.productName}`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: `${today} ${nowTime}`,
      };
      setDayBookEntries(prev => [dbEntry, ...prev]);
    }

    setInstallmentSchemes(prev => [newScheme, ...prev]);
    showToast(
      language === 'bn'
        ? `কিস্তি স্কিম ${schemeNum} সফলভাবে তৈরি হয়েছে!`
        : `Installment scheme ${schemeNum} created successfully!`
    );
    return newScheme;
  };

  const collectInstallment = (
    schemeId: string,
    installmentNo: number,
    amount: number,
    penalty: number,
    walletId: string,
    paymentMethod: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === walletId) || wallets[0];
    const receiptNo = `EMI-REC-${Date.now().toString().slice(-4)}`;
    const totalCollected = amount + penalty;

    let schemeObj: InstallmentScheme | undefined;

    const collectorName = currentUser?.fullName || currentUser?.username || 'Admin';

    setInstallmentSchemes(prev =>
      prev.map(sc => {
        if (sc.id === schemeId) {
          schemeObj = sc;
          const updatedSchedules = sc.schedules.map(sched => {
            if (sched.installmentNo === installmentNo) {
              return {
                ...sched,
                paidAmount: amount,
                penalty: penalty,
                paidDate: today,
                status: 'PAID' as const,
                paymentMethod,
                walletId,
                receiptVoucherNo: receiptNo,
                collectedBy: collectorName,
              };
            }
            return sched;
          });

          // Check if all are paid
          const allPaid = updatedSchedules.every(s => s.status === 'PAID');
          const existingContributors = sc.contributors || [
            {
              action: 'Created EMI Scheme',
              actionBn: 'কিস্তি স্কিম চালু',
              userName: sc.createdBy || 'Admin',
              timestamp: sc.createdAt,
            },
          ];

          const newContributors = [
            ...existingContributors,
            {
              action: `Collected Installment #${installmentNo}`,
              actionBn: `কিস্তি #${installmentNo} আদায়`,
              userName: collectorName,
              userId: currentUser?.id,
              userRole: currentUser?.role,
              timestamp: `${today} ${nowTime}`,
            },
            ...(allPaid
              ? [
                  {
                    action: 'All Installments Completed',
                    actionBn: 'সকল কিস্তি পরিশোধ সম্পন্ন',
                    userName: collectorName,
                    userId: currentUser?.id,
                    userRole: currentUser?.role,
                    timestamp: `${today} ${nowTime}`,
                  },
                ]
              : []),
          ];

          return {
            ...sc,
            status: allPaid ? ('COMPLETED' as const) : sc.status,
            completedBy: allPaid ? collectorName : sc.completedBy,
            updatedBy: collectorName,
            contributors: newContributors,
            schedules: updatedSchedules,
          };
        }
        return sc;
      })
    );

    // 1. Update wallet balance
    setWallets(prev =>
      prev.map(w => {
        if (w.id === walletId) {
          return {
            ...w,
            balance: w.balance + totalCollected,
          };
        }
        return w;
      })
    );

    // 2. Day book log
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo: receiptNo,
      date: today,
      type: 'EMI_COLLECTION',
      flow: 'IN',
      partyId: schemeObj?.customerId,
      partyName: schemeObj?.customerName,
      partyType: 'CUSTOMER',
      amount: totalCollected,
      walletId: walletId,
      walletName: targetWallet.name,
      referenceNo: schemeObj?.schemeNumber,
      remarks: `Installment #${installmentNo} collection for ${schemeObj?.productName} (EMI: ৳${amount}, Penalty: ৳${penalty})`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    // Open EMI Receipt
    const totalPaidSoFar = schemeObj ? schemeObj.schedules.filter(s => s.status === 'PAID' || s.installmentNo === installmentNo).reduce((sum, s) => sum + (s.paidAmount || s.amount), 0) : 0;
    const remainingDue = schemeObj ? schemeObj.schedules.filter(s => s.status !== 'PAID' && s.installmentNo !== installmentNo).reduce((sum, s) => sum + s.amount, 0) : 0;
    const nextPending = schemeObj ? schemeObj.schedules.find(s => s.status === 'PENDING' && s.installmentNo !== installmentNo) : null;

    openPrintModal({
      type: 'EMI_RECEIPT',
      title: 'Installment Collection Receipt (কিস্তির টাকা প্রাপ্তি রসিদ)',
      data: {
        receiptNo,
        date: today,
        schemeNumber: schemeObj?.schemeNumber,
        customerName: schemeObj?.customerName,
        customerPhone: schemeObj?.customerPhone,
        customerAddress: (schemeObj as any)?.customerAddress || (schemeObj as any)?.address || '',
        productName: schemeObj?.productName,
        installmentNo,
        totalInstallments: schemeObj?.totalInstallments,
        amount,
        penalty,
        totalCollected,
        totalSchemeAmount: schemeObj?.totalPayable,
        totalPrice: schemeObj?.totalPrice,
        downPayment: schemeObj?.downPayment,
        totalPaidSoFar,
        remainingDue,
        nextDueDate: nextPending?.dueDate || null,
        walletName: targetWallet.name,
        paymentMethod,
      },
    });

    showToast(
      language === 'bn'
        ? `কিস্তি #${installmentNo} এর ৳${totalCollected} সফলভাবে জমা হয়েছে।`
        : `Installment #${installmentNo} (${formatCurrency(totalCollected)}) recorded.`
    );
  };

  const deleteInstallmentScheme = (id: string) => {
    const scheme = installmentSchemes.find(s => s.id === id);
    setInstallmentSchemes(prev => prev.filter(s => s.id !== id));
    recordDeletedTombstones('installmentSchemes', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'INSTALLMENT_SCHEME',
          sourceTable: 'installment_schemes',
          recordId: id,
          referenceNo: scheme?.schemeNumber || scheme?.invoiceNumber,
          title: `Installment Scheme #${scheme?.schemeNumber || id}${scheme?.customerName ? ` - ${scheme.customerName}` : ''}`,
          amount: scheme?.totalAmount,
          snapshot: scheme || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'কিস্তি স্কিমটি সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Installment scheme removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(
      language === 'bn' ? 'কিস্তি স্কিমটি মুছে ফেলা হয়েছে' : 'Installment scheme deleted',
      'info'
    );
  };

  // -------------------------------------------------------------
  // Cash Adjustments & Wallets
  // -------------------------------------------------------------
  const addCashAdjustment = (adjData: Omit<CashAdjustment, 'id' | 'voucherNo' | 'createdAt'>) => {
    const voucherNo = `CADJ-2026-${100 + cashAdjustments.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === adjData.walletId);

    if (!adjData.amount || Number(adjData.amount) <= 0) {
      showToast(
        language === 'bn' ? 'টাকার পরিমাণ ০-এর বেশি হতে হবে!' : 'Amount must be greater than 0!',
        'error'
      );
      return;
    }

    if (adjData.type === 'CASH_WITHDRAW') {
      if (!targetWallet) {
        showToast(
          language === 'bn' ? 'সঠিক ওয়ালেট পাওয়া যায়নি!' : 'Wallet not found!',
          'error'
        );
        return;
      }
      if (targetWallet.balance < adjData.amount) {
        showToast(
          language === 'bn'
            ? `ওয়ালেটে পর্যাপ্ত টাকা নেই! (${targetWallet.name} ব্যালেন্স: ৳${targetWallet.balance}, উত্তোলন প্রয়োজন: ৳${adjData.amount})`
            : `Insufficient wallet balance in ${targetWallet.name}! Balance: ৳${targetWallet.balance}, Withdrawal required: ৳${adjData.amount}`,
          'error'
        );
        return;
      }
    }

    const newAdj: CashAdjustment = {
      ...adjData,
      id: `cadj-${Date.now()}`,
      voucherNo,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };

    // Update wallet balance (never below 0)
    setWallets(prev =>
      prev.map(w => {
        if (w.id === adjData.walletId) {
          return {
            ...w,
            balance:
              adjData.type === 'CASH_ADD'
                ? Number((w.balance + adjData.amount).toFixed(2))
                : Math.max(0, Number((w.balance - adjData.amount).toFixed(2))),
          };
        }
        return w;
      })
    );

    // Day Book entry
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: adjData.date,
      type: adjData.type === 'CASH_ADD' ? 'CASH_ADD' : 'CASH_WITHDRAW',
      flow: adjData.type === 'CASH_ADD' ? 'IN' : 'OUT',
      partyName: adjData.authorizedBy || 'Internal Owner',
      partyType: 'INTERNAL',
      amount: adjData.amount,
      walletId: adjData.walletId,
      walletName: targetWallet?.name || 'Cash',
      referenceNo: voucherNo,
      remarks: `Cash Adjustment [${adjData.type === 'CASH_ADD' ? 'Add' : 'Withdraw'}]: ${adjData.reason}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    setCashAdjustments(prev => [newAdj, ...prev]);
    showToast(
      language === 'bn'
        ? `ক্যাশ সমন্বয় ${voucherNo} সম্পন্ন হয়েছে।`
        : `Cash adjustment ${voucherNo} recorded.`
    );
  };

  const adjustCash = (data: { walletId: string; type: 'ADD' | 'WITHDRAW'; amount: number; reason: string }) => {
    addCashAdjustment({
      walletId: data.walletId,
      walletName: wallets.find(w => w.id === data.walletId)?.name || 'Cash',
      type: data.type === 'ADD' ? 'CASH_ADD' : 'CASH_WITHDRAW',
      amount: data.amount,
      reason: data.reason,
      date: new Date().toISOString().split('T')[0],
      authorizedBy: currentUser.fullName,
    });
  };

  const deleteCashAdjustment = (id: string) => {
    const adj = cashAdjustments.find(a => a.id === id);
    if (!adj) return;

    const targetWallet = wallets.find(w => w.id === adj.walletId);
    if (adj.type === 'CASH_ADD' && targetWallet && targetWallet.balance < adj.amount) {
      showToast(
        language === 'bn'
          ? `এই এন্ট্রি মুছে ফেলা যাবে না কারণ ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! (ব্যালেন্স: ৳${targetWallet.balance}, বাদ দিতে হবে: ৳${adj.amount})`
          : `Cannot delete entry as wallet balance is insufficient! (Balance: ৳${targetWallet.balance}, Needed: ৳${adj.amount})`,
        'error'
      );
      return;
    }

    // Revert wallet balance (never below 0)
    setWallets(prev =>
      prev.map(w => {
        if (w.id === adj.walletId) {
          return {
            ...w,
            balance:
              adj.type === 'CASH_ADD'
                ? Math.max(0, Number((w.balance - adj.amount).toFixed(2)))
                : Number((w.balance + adj.amount).toFixed(2)),
          };
        }
        return w;
      })
    );

    // Remove from cashAdjustments
    setCashAdjustments(prev => prev.filter(a => a.id !== id));
    recordDeletedTombstones('cashAdjustments', [id]);

    // Remove from DayBook
    const removedDayBookIds = dayBookEntries
      .filter(e => e.voucherNo === adj.voucherNo || e.referenceNo === adj.voucherNo)
      .map(e => e.id);
    setDayBookEntries(prev => prev.filter(e => e.voucherNo !== adj.voucherNo && e.referenceNo !== adj.voucherNo));
    if (removedDayBookIds.length > 0) {
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }

    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'CASH_ADJUSTMENT',
          sourceTable: 'cash_adjustments',
          recordId: adj.id,
          referenceNo: adj.voucherNo,
          title: `Cash Adjustment #${adj.voucherNo} (${adj.type})`,
          amount: adj.amount,
          reason: adj.reason,
          snapshot: adj,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: ক্যাশ অ্যাডজাস্টমেন্ট (${adj.voucherNo}) সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: Cash adjustment (${adj.voucherNo}) removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Cash Adjustment #${adj.voucherNo}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted cash adjustment #${adj.voucherNo} (${adj.type}, ৳${adj.amount.toLocaleString()}) on ${nowStr}.`,
      severity: 'danger',
      targetId: adj.id,
      targetName: `Cash Adjustment #${adj.voucherNo}`,
    });

    showToast(
      language === 'bn'
        ? `ক্যাশ অ্যাডজাস্টমেন্ট (${adj.voucherNo}) ${nowStr} তারিখে মুছে ফেলা হয়েছে এবং অ্যাক্টিভিটি লগে রেকর্ড করা হয়েছে।`
        : `Cash adjustment (${adj.voucherNo}) deleted on ${nowStr} and logged to audit.`,
      'info'
    );
  };

  const addWallet = (wData: Omit<Wallet, 'id'>) => {
    if (Number(wData.balance || 0) < 0) {
      showToast(
        language === 'bn' ? 'ওয়ালেট ব্যালেন্স ঋণাত্মক (-) হতে পারবে না!' : 'Wallet balance cannot be negative!',
        'error'
      );
      return;
    }
    const safeBalance = clampNonNegative(wData.balance, 2);
    const newWallet: Wallet = {
      ...wData,
      balance: safeBalance,
      id: `w-${Date.now()}`,
      createdBy: currentUser?.id || 'usr-1',
    };
    setWallets(prev => [...prev, newWallet]);

    if (safeBalance > 0) {
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      const voucherNo = `OPB-${Date.now().toString().slice(-6)}`;
      const dbEntry: DayBookEntry = {
        id: `db-${Date.now()}`,
        voucherNo,
        date: today,
        type: 'CASH_ADD',
        flow: 'IN',
        partyName: 'প্রারম্ভিক তহবিল (Opening Balance)',
        partyType: 'INTERNAL',
        amount: safeBalance,
        walletId: newWallet.id,
        walletName: newWallet.name,
        referenceNo: voucherNo,
        remarks: `নতুন অ্যাকাউন্ট প্রারম্ভিক জমা: ${newWallet.name}`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: `${today} ${nowTime}`,
      };
      setDayBookEntries(prev => [dbEntry, ...prev]);
    }

    showToast(
      language === 'bn'
        ? `নতুন অ্যাকাউন্ট "${newWallet.name}" সফলভাবে যুক্ত হয়েছে!`
        : `Account "${newWallet.name}" added successfully!`
    );
  };

  const updateWallet = (id: string, updates: Partial<Wallet>) => {
    if (updates.balance !== undefined && Number(updates.balance) < 0) {
      showToast(
        language === 'bn' ? 'ওয়ালেট ব্যালেন্স ঋণাত্মক (-) হতে পারবে না!' : 'Wallet balance cannot be negative!',
        'error'
      );
      return;
    }
    setWallets(prev =>
      prev.map(w =>
        w.id === id
          ? {
              ...w,
              ...updates,
              balance: updates.balance !== undefined ? clampNonNegative(updates.balance, 2) : w.balance,
            }
          : w
      )
    );
    showToast(language === 'bn' ? 'ওয়ালেট তথ্য আপডেট হয়েছে।' : 'Wallet updated.');
  };

  const deleteWallet = (id: string) => {
    if (wallets.length <= 1) {
      showToast(
        language === 'bn' ? 'কমপক্ষে একটি ওয়ালেট থাকা বাধ্যতামূলক।' : 'At least one wallet/account must remain.',
        'error'
      );
      return;
    }

    const wallet = wallets.find(w => w.id === id);
    if (!wallet) return;

    const hasTransactions = dayBookEntries?.some(t => t.walletId === id);
    const hasSales = saleInvoices?.some(inv => inv.walletId === id);
    const hasPurchases = purchaseInvoices?.some(inv => inv.walletId === id);
    const hasExpenses = expenseVouchers?.some(v => v.walletId === id);

    if (wallet.balance !== 0 || hasTransactions || hasSales || hasPurchases || hasExpenses) {
      showToast(
        language === 'bn'
          ? `এই একাউন্ট/ওয়ালেটের (${wallet.name}) ব্যালেন্স (৳${wallet.balance}) রয়েছে অথবা লেনদেনের রেকর্ড রয়েছে। ডিলিট করা যাবে না!`
          : `Account/Wallet (${wallet.name}) has active balance or transaction history and cannot be deleted!`,
        'error'
      );
      return;
    }

    setWallets(prev => prev.filter(w => w.id !== id));
    recordDeletedTombstones('wallets', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'WALLET',
          sourceTable: 'wallets',
          recordId: wallet.id,
          title: `Wallet '${wallet.name}'`,
          amount: wallet.balance,
          snapshot: wallet,
        },
      ]);
      showToast(
        language === 'bn'
          ? 'ওয়ালেট সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Wallet removed from software and saved to admin_deleted_records.sql.',
        'info'
      );
      return;
    }
    showToast(
      language === 'bn' ? 'ওয়ালেট সফলভাবে মুছে ফেলা হয়েছে।' : 'Wallet deleted successfully.',
      'info'
    );
  };

  const transferWalletFunds = (fromWalletId: string, toWalletId: string, amount: number, notes?: string) => {
    const fromW = wallets.find(w => w.id === fromWalletId);
    const toW = wallets.find(w => w.id === toWalletId);

    if (!fromW || !toW || amount <= 0) return;
    if (fromW.balance < amount) {
      showToast(language === 'bn' ? 'পর্যাপ্ত ব্যালেন্স নেই!' : 'Insufficient wallet balance!', 'error');
      return;
    }

    setWallets(prev =>
      prev.map(w => {
        if (w.id === fromWalletId) return { ...w, balance: Math.max(0, Number((w.balance - amount).toFixed(2))) };
        if (w.id === toWalletId) return { ...w, balance: Number((w.balance + amount).toFixed(2)) };
        return w;
      })
    );

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const voucherNo = `TRF-2026-${Date.now().toString().slice(-4)}`;

    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: today,
      type: 'WALLET_TRANSFER',
      flow: 'IN',
      partyName: `${fromW.name} ➔ ${toW.name}`,
      partyType: 'INTERNAL',
      amount,
      walletId: toWalletId,
      walletName: toW.name,
      referenceNo: voucherNo,
      remarks: `Funds transfer from ${fromW.name} to ${toW.name}. ${notes || ''}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    showToast(
      language === 'bn'
        ? `${formatCurrency(amount)} ফান্ড ট্রান্সফার সফল হয়েছে।`
        : `Transferred ${formatCurrency(amount)} from ${fromW.name} to ${toW.name}`
    );
  };

  // -------------------------------------------------------------
  // Expenses Logic
  // -------------------------------------------------------------
  const addExpenseCategory = (catData: Omit<ExpenseCategory, 'id'>) => {
    const newCat: ExpenseCategory = {
      ...catData,
      id: `exp-cat-${Date.now()}`,
      createdBy: currentUser?.id || 'usr-1',
    };
    setExpenseCategories(prev => [...prev, newCat]);
    showToast(language === 'bn' ? 'খরচের খাত যুক্ত হয়েছে।' : 'Expense category added.');
  };

  const updateExpenseCategory = (id: string, updates: Partial<ExpenseCategory>) => {
    setExpenseCategories(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    showToast(language === 'bn' ? 'খাত আপডেট হয়েছে।' : 'Category updated.');
  };

  const deleteExpenseCategory = (id: string) => {
    // Optional: Check if category is used in vouchers before deleting
    const isUsed = expenseVouchers.some(v => v.categoryId === id);
    if (isUsed) {
      showToast(language === 'bn' ? 'এই খাতটি ভাউচারে ব্যবহৃত হয়েছে, মুছা যাবে না।' : 'Category is in use, cannot delete.', 'error');
      return;
    }
    const cat = expenseCategories.find(c => c.id === id);
    setExpenseCategories(prev => prev.filter(c => c.id !== id));
    recordDeletedTombstones('expenseCategories', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'EXPENSE_CATEGORY',
          sourceTable: 'expense_categories',
          recordId: id,
          title: `Expense Category '${cat?.name || id}'`,
          snapshot: cat || { id },
        },
      ]);
      showToast(
        language === 'bn'
          ? 'খরচের খাত সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'Expense category removed from software and saved to admin_deleted_records.sql.',
        'success'
      );
      return;
    }
    showToast(language === 'bn' ? 'খাত মুছে ফেলা হয়েছে।' : 'Category deleted.', 'success');
  };

  const addExpenseVoucher = (vData: Omit<ExpenseVoucher, 'id' | 'voucherNo' | 'createdAt'>): ExpenseVoucher | null => {
    const voucherNo = `EXP-2026-${100 + expenseVouchers.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === vData.walletId);

    if (!targetWallet) {
      showToast(
        language === 'bn' ? 'খরচের জন্য ওয়ালেট পাওয়া যায়নি!' : 'Wallet not found for expense!',
        'error'
      );
      return null;
    }

    if (!vData.amount || Number(vData.amount) <= 0) {
      showToast(
        language === 'bn' ? 'খরচের পরিমাণ ০-এর বেশি হতে হবে!' : 'Expense amount must be greater than 0!',
        'error'
      );
      return null;
    }

    if (targetWallet.balance < vData.amount) {
      showToast(
        language === 'bn'
          ? `নির্বাচিত ওয়ালেটে (${targetWallet.name}) পর্যাপ্ত টাকা নেই! বর্তমান ব্যালেন্স: ৳${targetWallet.balance.toLocaleString()} | খরচের পরিমাণ: ৳${vData.amount.toLocaleString()}।`
          : `Insufficient balance in ${targetWallet.name}! Available: ৳${targetWallet.balance.toLocaleString()} | Expense amount: ৳${vData.amount.toLocaleString()}`,
        'error'
      );
      return null;
    }

    const newVoucher: ExpenseVoucher = {
      ...vData,
      id: `exp-${Date.now()}`,
      voucherNo,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };

    // Deduct from wallet (never below 0)
    setWallets(prev =>
      prev.map(w => {
        if (w.id === vData.walletId) {
          return {
            ...w,
            balance: Math.max(0, Number((w.balance - vData.amount).toFixed(2))),
          };
        }
        return w;
      })
    );

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;

    // Day Book
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: vData.date,
      type: 'EXPENSE',
      flow: 'OUT',
      partyName: vData.payee || vData.categoryName,
      partyType: 'EXPENSE',
      amount: vData.amount,
      walletId: vData.walletId,
      walletName: targetWallet?.name || 'Cash',
      referenceId: newVoucher.id,
      referenceNo: voucherNo,
      remarks: `[${vData.categoryName}] ${vData.note} (Payee: ${vData.payee})`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    setExpenseVouchers(prev => [newVoucher, ...prev.filter(e => e.id !== newVoucher.id)]);
    showToast(
      language === 'bn'
        ? `খরচের ভাউচার ${voucherNo} সংরক্ষিত হয়েছে।`
        : `Expense voucher ${voucherNo} recorded.`
    );
    return newVoucher;
  };

  const deleteExpenseVoucher = (id: string, reason?: string) => {
    const target = expenseVouchers.find(e => e.id === id);
    if (!target) return;
    setWallets(prev =>
      prev.map(w => (w.id === target.walletId ? { ...w, balance: w.balance + target.amount } : w))
    );
    setExpenseVouchers(prev => prev.filter(e => e.id !== id));
    recordDeletedTombstones('expenseVouchers', [id]);

    // Also remove linked DayBook entry so deleted expense leaves zero trace
    const removedDayBookIds = dayBookEntries
      .filter(e => e.voucherNo === target.voucherNo || e.referenceNo === target.voucherNo)
      .map(e => e.id);
    if (removedDayBookIds.length > 0) {
      setDayBookEntries(prev => prev.filter(e => e.voucherNo !== target.voucherNo && e.referenceNo !== target.voucherNo));
      recordDeletedTombstones('dayBookEntries', removedDayBookIds);
    }
    
    const nowStr = formatDeletionTimestamp();
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'EXPENSE_VOUCHER',
          sourceTable: 'expense_vouchers',
          recordId: target.id,
          referenceNo: target.voucherNo,
          title: `Expense Voucher #${target.voucherNo} (${target.categoryName || 'Expense'})`,
          amount: target.amount,
          reason: reason || target.note || '',
          snapshot: target,
        },
      ]);
      showToast(
        language === 'bn'
          ? `অ্যাডমিন ডিলিট: খরচের ভাউচার #${target.voucherNo} সফটওয়্যার থেকে সম্পূর্ণ মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Admin Delete: Expense voucher #${target.voucherNo} removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }

    logActivity({
      actionType: 'DELETE',
      title: `Deleted Expense Voucher #${target.voucherNo}`,
      description: `User '${currentUser?.fullName || 'User'}' (${currentUser?.role || 'STAFF'}) deleted expense voucher #${target.voucherNo} (${target.categoryName || target.category || 'Expense'}, ৳${target.amount.toLocaleString()}) on ${nowStr}.${reason ? ` Reason: ${reason}` : ''}`,
      severity: 'danger',
      targetId: target.id,
      targetName: `Expense Voucher #${target.voucherNo}`,
    });

    showToast(
      language === 'bn'
        ? `খরচের ভাউচার #${target.voucherNo} (${nowStr}) মুছে ফেলা হয়েছে।`
        : `Expense voucher #${target.voucherNo} deleted on ${nowStr}.`,
      'info'
    );
  };

  // -------------------------------------------------------------
  // HR & Payroll
  // -------------------------------------------------------------
  const addEmployee = (empData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now()}`,
      createdBy: currentUser?.id || 'usr-1',
    };
    setEmployees(prev => [...prev, newEmp]);
    showToast(language === 'bn' ? 'নতুন কর্মচারী যুক্ত হয়েছে।' : 'Employee added successfully.');
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)));
    showToast(language === 'bn' ? 'কর্মচারীর তথ্য আপডেট হয়েছে।' : 'Employee updated.');
  };

  const deleteEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    const hasAdvances = advanceSalaries?.some(a => a.employeeId === id);
    const hasExpenses = expenseVouchers?.some(v => v.employeeId === id || v.payee === emp.name);

    if (hasAdvances || hasExpenses) {
      showToast(
        language === 'bn'
          ? `এই কর্মচারীর (${emp.name}) অগ্রিম বেতন বা খরচ ভাউচার এন্ট্রি রয়েছে! ডিলিট করা যাবে না।`
          : `Employee (${emp.name}) has advance salary or voucher records. Cannot delete!`,
        'error'
      );
      return;
    }

    setEmployees(prev => prev.filter(e => e.id !== id));
    recordDeletedTombstones('employees', [id]);
    if (isAdminUser()) {
      archiveAdminDeletion([
        {
          entityType: 'EMPLOYEE',
          sourceTable: 'employees',
          recordId: emp.id,
          referenceNo: emp.phone,
          title: `Employee '${emp.name}'`,
          amount: Number(emp.monthlySalary || 0),
          snapshot: emp,
        },
      ]);
      showToast(
        language === 'bn'
          ? `কর্মচারী ${emp.name} সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।`
          : `Employee ${emp.name} removed from software and saved to admin_deleted_records.sql.`,
        'info'
      );
      return;
    }
    showToast(
      language === 'bn'
        ? `কর্মচারী ${emp.name} তালিকা থেকে মুছে ফেলা হয়েছে।`
        : `Employee ${emp.name} deleted successfully.`,
      'info'
    );
  };

  const resignEmployee = (
    id: string,
    data: {
      resignedDate: string;
      resignationReason: string;
      settlementNotes?: string;
      finalSettlementAmount?: number;
      finalSettlementPaid?: boolean;
      refundWalletId?: string;
    }
  ) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    const settlementAmt = data.finalSettlementAmount || 0;
    const targetWallet = data.refundWalletId ? wallets.find(w => w.id === data.refundWalletId) : undefined;

    // If final settlement is to be paid from wallet
    if (data.finalSettlementPaid && settlementAmt > 0 && targetWallet) {
      if (targetWallet.balance < settlementAmt) {
        showToast(
          language === 'bn'
            ? `নির্বাচিত ওয়ালেটে (${targetWallet.name}) ফাইনাল সেটেলমেন্টের পর্যাপ্ত ব্যালেন্স নেই! প্রয়োজন: ৳${settlementAmt.toLocaleString()} | আছে: ৳${targetWallet.balance.toLocaleString()}`
            : `Insufficient balance in ${targetWallet.name} for settlement! Required: ৳${settlementAmt.toLocaleString()} | Available: ৳${targetWallet.balance.toLocaleString()}`,
          'error'
        );
        return;
      }

      // Deduct from wallet (never below 0)
      setWallets(prev =>
        prev.map(w =>
          w.id === targetWallet.id
            ? { ...w, balance: Math.max(0, Number((w.balance - settlementAmt).toFixed(2))) }
            : w
        )
      );

      const today = data.resignedDate || new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      const voucherNo = `SETTLE-2026-${Math.floor(100 + Math.random() * 900)}`;

      // Record in DayBook
      const dbEntry: DayBookEntry = {
        id: `db-${Date.now()}`,
        voucherNo,
        date: today,
        type: 'SALARY',
        flow: 'OUT',
        partyId: emp.id,
        partyName: emp.name,
        partyType: 'STAFF',
        amount: settlementAmt,
        walletId: targetWallet.id,
        walletName: targetWallet.name,
        referenceNo: emp.employeeCode,
        remarks: `Final clearance & resignation settlement for ${emp.name} (${emp.designation}). Reason: ${data.resignationReason}`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: `${today} ${nowTime}`,
      };
      setDayBookEntries(prev => [dbEntry, ...prev]);
    }

    setEmployees(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              status: 'RESIGNED' as const,
              resignedDate: data.resignedDate || new Date().toISOString().split('T')[0],
              resignationReason: data.resignationReason,
              settlementNotes: data.settlementNotes || '',
              finalSettlementAmount: settlementAmt,
              finalSettlementPaid: !!data.finalSettlementPaid,
              settlementWalletId: targetWallet?.id,
              settlementWalletName: targetWallet?.name,
            }
          : e
      )
    );

    showToast(
      language === 'bn'
        ? `${emp.name}-কে রিজাইনড কর্মচারী তালিকায় স্থানান্তর করা হয়েছে।`
        : `${emp.name} marked as Resigned and moved to resigned staff list.`,
      'success'
    );
  };

  const rejoinEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    setEmployees(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              status: 'ACTIVE' as const,
              resignedDate: undefined,
              resignationReason: undefined,
            }
          : e
      )
    );

    showToast(
      language === 'bn'
        ? `${emp.name}-কে পুনরায় সক্রিয় কর্মচারী তালিকায় যুক্ত করা হয়েছে।`
        : `${emp.name} has been reactivated into active staff list.`,
      'success'
    );
  };

  const addAdvanceSalary = (advData: Omit<AdvanceSalary, 'id' | 'voucherNo' | 'createdAt' | 'isDeducted'>) => {
    const voucherNo = `ADV-2026-${500 + advanceSalaries.length + 1}`;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === advData.walletId);

    if (!targetWallet) {
      showToast(
        language === 'bn' ? 'অগ্রিম বেতনের জন্য ওয়ালেট পাওয়া যায়নি!' : 'Wallet not found for advance salary!',
        'error'
      );
      return;
    }

    if (!advData.amount || Number(advData.amount) <= 0) {
      showToast(
        language === 'bn' ? 'অগ্রিম বেতনের পরিমাণ ০-এর বেশি হতে হবে!' : 'Advance salary amount must be greater than 0!',
        'error'
      );
      return;
    }

    if (targetWallet.balance < advData.amount) {
      showToast(
        language === 'bn'
          ? `নির্বাচিত ওয়ালেটে (${targetWallet.name}) পর্যাপ্ত টাকা নেই! বর্তমান ব্যালেন্স: ৳${targetWallet.balance.toLocaleString()} | অগ্রিম: ৳${advData.amount.toLocaleString()}।`
          : `Insufficient balance in ${targetWallet.name}! Available: ৳${targetWallet.balance.toLocaleString()} | Advance: ৳${advData.amount.toLocaleString()}`,
        'error'
      );
      return;
    }

    const newAdv: AdvanceSalary = {
      ...advData,
      id: `adv-${Date.now()}`,
      voucherNo,
      isDeducted: false,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };

    // Deduct from wallet (never below 0)
    setWallets(prev =>
      prev.map(w => {
        if (w.id === advData.walletId) {
          return {
            ...w,
            balance: Math.max(0, Number((w.balance - advData.amount).toFixed(2))),
          };
        }
        return w;
      })
    );

    // Day Book
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}`,
      voucherNo,
      date: advData.date,
      type: 'ADVANCE_SALARY',
      flow: 'OUT',
      partyId: advData.employeeId,
      partyName: advData.employeeName,
      partyType: 'STAFF',
      amount: advData.amount,
      walletId: advData.walletId,
      walletName: targetWallet?.name || 'Cash',
      referenceNo: voucherNo,
      remarks: `Advance salary to ${advData.employeeName}: ${advData.reason}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };
    setDayBookEntries(prev => [dbEntry, ...prev]);

    setAdvanceSalaries(prev => [newAdv, ...prev]);
    showToast(
      language === 'bn'
        ? `অগ্রিম বেতন ভাউচার ${voucherNo} সম্পন্ন হয়েছে।`
        : `Advance salary voucher ${voucherNo} recorded.`
    );
  };

  const giveAdvanceSalary = (adv: { employeeId: string; amount: number; walletId: string; reason: string; date: string }) => {
    const emp = employees.find(e => e.id === adv.employeeId);
    const targetWallet = wallets.find(w => w.id === adv.walletId);
    addAdvanceSalary({
      employeeId: adv.employeeId,
      employeeName: emp?.name || 'Employee',
      amount: adv.amount,
      walletId: adv.walletId,
      walletName: targetWallet?.name || 'Cash',
      reason: adv.reason,
      date: adv.date,
    });
  };

  const payEmployeeSalary = (payment: {
    employeeId: string;
    payrollMonth: string;
    amount: number;
    walletId: string;
    bonus?: number;
    fineDeduction?: number;
    notes?: string;
    paymentDate?: string;
  }): boolean => {
    const emp = employees.find(e => e.id === payment.employeeId);
    if (!emp) {
      showToast(language === 'bn' ? 'কর্মচারী খুঁজে পাওয়া যায়নি!' : 'Employee not found!', 'error');
      return false;
    }

    const today = payment.paymentDate || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === payment.walletId);

    if (!targetWallet) {
      showToast(language === 'bn' ? 'পরিশোধের জন্য ওয়ালেট নির্বাচন করুন!' : 'Select payment wallet!', 'error');
      return false;
    }

    const allowances = emp.houseRentAllowance + emp.medicalAllowance + emp.conveyanceAllowance;
    const bonus = payment.bonus || 0;
    const fineDeduction = payment.fineDeduction || 0;
    const grossPay = emp.baseSalary + allowances + bonus - fineDeduction;

    // Previous payment vouchers for this month
    const prevVouchers = payrollHistory.filter(
      p => p.employeeId === emp.id && p.payrollMonth === payment.payrollMonth
    );
    const totalPaidSoFar = prevVouchers.reduce((s, p) => s + (p.paidAmount ?? p.netPay ?? 0), 0);

    // Pending advance deduction if first payment, or check if already deducted
    let advanceDeductForCalc = 0;
    if (prevVouchers.length > 0) {
      advanceDeductForCalc = prevVouchers[0].advanceDeduction || 0;
    } else {
      const pendingAdvance = advanceSalaries
        .filter(a => a.employeeId === emp.id && !a.isDeducted)
        .reduce((s, a) => s + a.amount, 0);
      advanceDeductForCalc = pendingAdvance;
    }

    const totalPayableForMonth = Math.max(0, grossPay - advanceDeductForCalc);
    const currentRemainingDue = Math.max(0, totalPayableForMonth - totalPaidSoFar);

    // RULE 1: If salary for this month is already paid in full, do NOT allow 2nd payment
    if (currentRemainingDue <= 0 || totalPaidSoFar >= totalPayableForMonth) {
      showToast(
        language === 'bn'
          ? `🚫 ${emp.name}-এর ${payment.payrollMonth} মাসের বেতন ইতোমধ্যে সম্পূর্ণ পরিশোধিত (৳${totalPaidSoFar.toLocaleString()})! এই মাসের বেতন আর দ্বিতীয়বার দেওয়া যাবে না।`
          : `Salary for ${payment.payrollMonth} has already been paid in full to ${emp.name}. Cannot pay again.`,
        'warning'
      );
      return false;
    }

    // Amount validation
    if (payment.amount <= 0) {
      showToast(language === 'bn' ? 'সঠিক টাকার পরিমাণ দিন!' : 'Enter valid amount!', 'warning');
      return false;
    }

    // RULE 2: If there is remaining due, only the due amount (or less for partial) can be paid, not exceeding due
    if (payment.amount > currentRemainingDue) {
      showToast(
        language === 'bn'
          ? `⚠️ প্রদেয় টাকা (৳${payment.amount.toLocaleString()}) অবশিষ্ট বকেয়ার (৳${currentRemainingDue.toLocaleString()}) চেয়ে বেশি হতে পারে না!`
          : `Amount (৳${payment.amount.toLocaleString()}) cannot exceed remaining due (৳${currentRemainingDue.toLocaleString()})!`,
        'error'
      );
      return false;
    }

    // Wallet balance validation
    if (targetWallet.balance < payment.amount) {
      showToast(
        language === 'bn'
          ? `নির্বাচিত ওয়ালেটে (${targetWallet.name}) পর্যাপ্ত টাকা নেই! বর্তমান ব্যালেন্স: ৳${targetWallet.balance.toLocaleString()} | প্রয়োজন: ৳${payment.amount.toLocaleString()}`
          : `Insufficient balance in ${targetWallet.name}! Available: ৳${targetWallet.balance.toLocaleString()} | Required: ৳${payment.amount.toLocaleString()}`,
        'error'
      );
      return false;
    }

    // Deduct from wallet (never below 0)
    setWallets(prev =>
      prev.map(w =>
        w.id === payment.walletId
          ? { ...w, balance: Math.max(0, Number((w.balance - payment.amount).toFixed(2))) }
          : w
      )
    );

    // If first voucher and has advance deduction, mark advance as deducted
    if (prevVouchers.length === 0 && advanceDeductForCalc > 0) {
      setAdvanceSalaries(prev =>
        prev.map(adv =>
          adv.employeeId === emp.id && !adv.isDeducted
            ? { ...adv, isDeducted: true, deductedInPayrollMonth: payment.payrollMonth }
            : adv
        )
      );
    }

    const newTotalPaidSoFar = totalPaidSoFar + payment.amount;
    const newDueAmount = Math.max(0, totalPayableForMonth - newTotalPaidSoFar);
    const installmentNo = prevVouchers.length + 1;
    const paymentType: 'FULL' | 'PARTIAL' | 'DUE_PAYMENT' =
      newDueAmount === 0 ? (installmentNo > 1 ? 'DUE_PAYMENT' : 'FULL') : 'PARTIAL';
    const status: 'PAID' | 'PARTIAL' = newDueAmount === 0 ? 'PAID' : 'PARTIAL';

    const voucherNo = `PAY-${payment.payrollMonth.replace('-', '')}-${(emp.employeeCode || emp.id.slice(-4)).replace(/[^a-zA-Z0-9]/g, '')}-${installmentNo.toString().padStart(2, '0')}`;

    const newEntry: PayrollEntry = {
      id: `pay-${payment.payrollMonth}-${Date.now()}`,
      voucherNo,
      payrollMonth: payment.payrollMonth,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      designation: emp.designation,
      baseSalary: emp.baseSalary,
      allowances,
      bonus,
      advanceDeduction: prevVouchers.length === 0 ? advanceDeductForCalc : 0,
      fineDeduction,
      grossPay,
      payableAmount: totalPayableForMonth,
      paidAmount: payment.amount,
      dueAmount: newDueAmount,
      totalPaidSoFar: newTotalPaidSoFar,
      paymentType,
      installmentNo,
      notes:
        payment.notes ||
        (installmentNo > 1
          ? `${payment.payrollMonth} মাসের ২য় কিস্তি বকেয়া বেতন পরিশোধ`
          : `${payment.payrollMonth} মাসের বেতন`),
      netPay: payment.amount,
      paymentDate: today,
      walletId: payment.walletId,
      walletName: targetWallet.name,
      status,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };

    // Record in DayBook
    const dbEntry: DayBookEntry = {
      id: `db-${Date.now()}-${emp.id}`,
      voucherNo,
      date: today,
      type: 'SALARY',
      flow: 'OUT',
      partyId: emp.id,
      partyName: emp.name,
      partyType: 'STAFF',
      amount: payment.amount,
      walletId: payment.walletId,
      walletName: targetWallet.name,
      referenceNo: voucherNo,
      remarks: `Salary payment (#${installmentNo}) for ${payment.payrollMonth} to ${emp.name} (${emp.designation}). Paid: ৳${payment.amount.toLocaleString()}${newDueAmount > 0 ? `, Remaining Due: ৳${newDueAmount.toLocaleString()}` : ' (Paid in Full)'}`,
      createdBy: currentUser?.id || 'usr-1',
      createdAt: `${today} ${nowTime}`,
    };

    setPayrollHistory(prev => [newEntry, ...prev]);
    setDayBookEntries(prev => [dbEntry, ...prev]);

    showToast(
      language === 'bn'
        ? `✅ ${emp.name}-এর ${payment.payrollMonth} মাসের বেতন ভাউচার (${voucherNo}) সম্পন্ন! পরিশোধিত: ৳${payment.amount.toLocaleString()}${newDueAmount > 0 ? ` | অবশিষ্ট বকেয়া: ৳${newDueAmount.toLocaleString()}` : ' (সম্পূর্ণ পরিশোধিত)'}`
        : `Payroll voucher ${voucherNo} processed for ${emp.name}. Paid: ৳${payment.amount.toLocaleString()}${newDueAmount > 0 ? ` | Due: ৳${newDueAmount.toLocaleString()}` : ' (Fully Paid)'}`,
      'success'
    );

    return true;
  };

  const processMonthlyPayroll = (monthStr: string, walletId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const targetWallet = wallets.find(w => w.id === walletId) || wallets[0];

    if (!targetWallet) {
      showToast(language === 'bn' ? 'ওয়ালেট পাওয়া যায়নি!' : 'Wallet not found!', 'error');
      return;
    }

    const activeEmps = employees.filter(e => e.status === 'ACTIVE');
    if (activeEmps.length === 0) {
      showToast(language === 'bn' ? 'কোনো সক্রিয় কর্মচারী নেই!' : 'No active employees!', 'warning');
      return;
    }

    // Calculate due amount for each employee for this month
    const pendingToPay: {
      emp: Employee;
      grossPay: number;
      allowances: number;
      advanceDeduct: number;
      totalPayable: number;
      alreadyPaid: number;
      dueAmountToDisburse: number;
      installmentNo: number;
    }[] = [];

    activeEmps.forEach(emp => {
      const allowances = emp.houseRentAllowance + emp.medicalAllowance + emp.conveyanceAllowance;
      const grossPay = emp.baseSalary + allowances;

      const prevVouchers = payrollHistory.filter(
        p => p.employeeId === emp.id && p.payrollMonth === monthStr
      );
      const alreadyPaid = prevVouchers.reduce((s, p) => s + (p.paidAmount ?? p.netPay ?? 0), 0);

      let advanceDeduct = 0;
      if (prevVouchers.length > 0) {
        advanceDeduct = prevVouchers[0].advanceDeduction || 0;
      } else {
        const pendingAdvance = advanceSalaries
          .filter(a => a.employeeId === emp.id && !a.isDeducted)
          .reduce((s, a) => s + a.amount, 0);
        advanceDeduct = pendingAdvance;
      }

      const totalPayable = Math.max(0, grossPay - advanceDeduct);
      const remainingDue = Math.max(0, totalPayable - alreadyPaid);

      // Only include employees who still have remaining due for this month
      if (remainingDue > 0) {
        pendingToPay.push({
          emp,
          grossPay,
          allowances,
          advanceDeduct: prevVouchers.length === 0 ? advanceDeduct : 0,
          totalPayable,
          alreadyPaid,
          dueAmountToDisburse: remainingDue,
          installmentNo: prevVouchers.length + 1,
        });
      }
    });

    // RULE 1: If all employees for this month are already paid, refuse second bulk payment!
    if (pendingToPay.length === 0) {
      showToast(
        language === 'bn'
          ? `🔒 ${monthStr} মাসের সকল সক্রিয় কর্মচারীর বেতন ইতোমধ্যে সম্পূর্ণ পরিশোধ করা হয়েছে। দ্বিতীয়বার আর বেতন দেওয়ার প্রয়োজন নেই।`
          : `All active employees have already been fully paid for ${monthStr}. No pending salaries.`,
        'warning'
      );
      return;
    }

    const totalDisbursement = pendingToPay.reduce((s, p) => s + p.dueAmountToDisburse, 0);

    if (targetWallet.balance < totalDisbursement) {
      showToast(
        language === 'bn'
          ? `নির্বাচিত ওয়ালেটে (${targetWallet.name}) বকেয়া বেতন পরিশোধের পর্যাপ্ত ব্যালেন্স নেই! প্রয়োজন: ৳${totalDisbursement.toLocaleString()} | আছে: ৳${targetWallet.balance.toLocaleString()}`
          : `Insufficient balance in ${targetWallet.name}! Required: ৳${totalDisbursement.toLocaleString()} | Available: ৳${targetWallet.balance.toLocaleString()}`,
        'error'
      );
      return;
    }

    // 1. Deduct from wallet (always use targetWallet.id & never below 0)
    setWallets(prev =>
      prev.map(w =>
        w.id === targetWallet.id
          ? { ...w, balance: Math.max(0, Number((w.balance - totalDisbursement).toFixed(2))) }
          : w
      )
    );

    // 2. Mark pending advance salaries as deducted
    setAdvanceSalaries(prev =>
      prev.map(adv => {
        const found = pendingToPay.find(p => p.emp.id === adv.employeeId && p.advanceDeduct > 0);
        if (found && !adv.isDeducted) {
          return {
            ...adv,
            isDeducted: true,
            deductedInPayrollMonth: monthStr,
          };
        }
        return adv;
      })
    );

    // 3. Create Payroll & DayBook entries
    const createdPayroll: PayrollEntry[] = [];
    const createdDayBook: DayBookEntry[] = [];

    pendingToPay.forEach((item, idx) => {
      const voucherNo = `PAY-${monthStr.replace('-', '')}-${(item.emp.employeeCode || item.emp.id.slice(-4)).replace(/[^a-zA-Z0-9]/g, '')}-${item.installmentNo.toString().padStart(2, '0')}`;
      const newTotalPaid = item.alreadyPaid + item.dueAmountToDisburse;

      const pEntry: PayrollEntry = {
        id: `pay-${monthStr}-${Date.now()}-${idx}`,
        voucherNo,
        payrollMonth: monthStr,
        employeeId: item.emp.id,
        employeeName: item.emp.name,
        employeeCode: item.emp.employeeCode,
        designation: item.emp.designation,
        baseSalary: item.emp.baseSalary,
        allowances: item.allowances,
        bonus: 0,
        advanceDeduction: item.advanceDeduct,
        fineDeduction: 0,
        grossPay: item.grossPay,
        payableAmount: item.totalPayable,
        paidAmount: item.dueAmountToDisburse,
        dueAmount: 0,
        totalPaidSoFar: newTotalPaid,
        paymentType: item.installmentNo > 1 ? 'DUE_PAYMENT' : 'FULL',
        installmentNo: item.installmentNo,
        notes: item.installmentNo > 1 ? `${monthStr} মাসের বকেয়া বেতন পরিশোধ` : `${monthStr} মাসের বেতন`,
        netPay: item.dueAmountToDisburse,
        paymentDate: today,
        walletId,
        walletName: targetWallet.name,
        status: 'PAID',
        createdBy: currentUser?.id || 'usr-1',
        createdAt: `${today} ${nowTime}`,
      };
      createdPayroll.push(pEntry);

      const dbEntry: DayBookEntry = {
        id: `db-${Date.now()}-${item.emp.id}-${idx}`,
        voucherNo,
        date: today,
        type: 'SALARY',
        flow: 'OUT',
        partyId: item.emp.id,
        partyName: item.emp.name,
        partyType: 'STAFF',
        amount: item.dueAmountToDisburse,
        walletId,
        walletName: targetWallet.name,
        referenceNo: voucherNo,
        remarks: `Salary payment (#${item.installmentNo}) for ${monthStr} to ${item.emp.name} (${item.emp.designation}). Paid: ৳${item.dueAmountToDisburse.toLocaleString()} (Paid in Full)`,
        createdBy: currentUser?.id || 'usr-1',
        createdAt: `${today} ${nowTime}`,
      };
      createdDayBook.push(dbEntry);
    });

    setPayrollHistory(prev => [...createdPayroll, ...prev]);
    setDayBookEntries(prev => [...createdDayBook, ...prev]);

    showToast(
      language === 'bn'
        ? `✅ ${monthStr} মাসের ${pendingToPay.length} জন কর্মচারীর মোট ${formatCurrency(totalDisbursement)} বেতন সফলভাবে পরিশোধ করা হয়েছে!`
        : `Disbursed ${formatCurrency(totalDisbursement)} in payroll to ${pendingToPay.length} employees for ${monthStr}.`,
      'success'
    );
  };

  // -------------------------------------------------------------
  // Users & Settings
  // -------------------------------------------------------------
  const addUser = (userData: Omit<UserAccount, 'id'>) => {
    const newUser: UserAccount = {
      ...userData,
      id: `usr-${Date.now()}`,
    };
    setUsers(prev => [...prev, newUser]);
    showToast(language === 'bn' ? 'ব্যবহারকারী তৈরি করা হয়েছে।' : 'User created.');
  };

  const updateUser = (id: string, updates: Partial<UserAccount>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)));
    if (currentUser.id === id) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
    showToast(language === 'bn' ? 'ব্যবহারকারীর তথ্য আপডেট হয়েছে।' : 'User updated.');
  };

  const deleteUser = (id: string) => {
    if (users.length <= 1) {
      showToast(language === 'bn' ? 'কমপক্ষে একটি ইউজার থাকা আবশ্যক।' : 'At least one user is required.', 'error');
      return;
    }

    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) return;

    const hasSales = saleInvoices?.some(inv => inv.cashierId === id || inv.createdBy === id);
    const hasPurchases = purchaseInvoices?.some(inv => inv.createdBy === id);
    const hasQuotations = quotations?.some(q => q.createdBy === id);
    const hasExpenses = expenseVouchers?.some(v => v.createdBy === id);

    if (hasSales || hasPurchases || hasQuotations || hasExpenses) {
      showToast(
        language === 'bn'
          ? `এই ইউজারের (${userToDelete.fullName} / @${userToDelete.username}) নামে ইনভয়েস, ক্রয় বা ভাউচার এন্ট্রি রয়েছে। তাই এই ইউজার আইডি ডিলিট করা যাবে না!`
          : `User (${userToDelete.username}) has generated invoices, purchases or vouchers. Cannot be deleted!`,
        'error'
      );
      return;
    }

    setUsers(prev => prev.filter(u => u.id !== id));
    recordDeletedTombstones('users', [id]);
    if (isAdminUser()) {
      const { password: _redactedPassword, ...safeUserSnapshot } = userToDelete as any;
      archiveAdminDeletion([
        {
          entityType: 'USER_ACCOUNT',
          sourceTable: 'users',
          recordId: userToDelete.id,
          referenceNo: userToDelete.username,
          title: `User '${userToDelete.fullName}' (@${userToDelete.username})`,
          snapshot: safeUserSnapshot,
        },
      ]);
      showToast(
        language === 'bn'
          ? 'ব্যবহারকারী সফটওয়্যার থেকে মুছে আলাদা SQL ফাইলে (admin_deleted_records.sql) সেভ করা হয়েছে।'
          : 'User removed from software and saved to admin_deleted_records.sql.',
        'success'
      );
      return;
    }
    showToast(language === 'bn' ? 'ব্যবহারকারী মুছে ফেলা হয়েছে।' : 'User deleted.', 'success');
  };

  const updateCompanySettings = (updates: Partial<CompanySettings>) => {
    const updatedEpoch = Date.now();
    lastPushTimeRef.current = updatedEpoch;
    lastServerUpdatedEpochRef.current = updatedEpoch;

    setCompanySettings(prev => {
      const updated = { ...prev, ...updates };

      // 1. Immediately persist to dedicated standalone 'companySettings' key
      try {
        localStorage.setItem('companySettings', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to companySettings in localStorage', e);
      }

      // 2. Immediately persist to monolithic master storage object
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : {};
        parsed.companySettings = updated;
        parsed.lastUpdatedEpoch = updatedEpoch;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        localStorage.setItem('DOKANPRO_LAST_LOCAL_UPDATE_EPOCH', String(updatedEpoch));
      } catch (e) {
        console.warn('Failed to update LOCAL_STORAGE_KEY with companySettings', e);
      }

      return updated;
    });

    showToast(language === 'bn' ? 'কোম্পানি সেটিংস সফলভাবে সংরক্ষিত হয়েছে।' : 'Company settings saved successfully.', 'success');

    // 3. Immediately trigger background server push so server snapshot also receives updated companySettings
    setTimeout(() => {
      const activeUrl = getActiveApiEndpoint();
      if (activeUrl) {
        triggerServerPush(activeUrl, true);
      }
    }, 100);
  };

  const cleanZeroWallets: Wallet[] = [
    {
      id: 'w-cash',
      name: 'Main Cash Drawer',
      nameBn: 'মূল ক্যাশ ড্রয়ার (নগদ)',
      type: 'CASH',
      balance: 0,
      isActive: true,
      colorCode: '#10B981',
    },
    {
      id: 'w-ibbl',
      name: 'Bank Account',
      nameBn: 'ব্যাংক হিসাব',
      type: 'BANK',
      accountNumber: '',
      balance: 0,
      isActive: true,
      colorCode: '#3B82F6',
    },
    {
      id: 'w-bkash',
      name: 'bKash Merchant',
      nameBn: 'বিকাশ মার্চেন্ট',
      type: 'MFS',
      accountNumber: '',
      balance: 0,
      isActive: true,
      colorCode: '#EC4899',
    },
    {
      id: 'w-nagad',
      name: 'Nagad Account',
      nameBn: 'নগদ একাউন্ট',
      type: 'MFS',
      accountNumber: '',
      balance: 0,
      isActive: true,
      colorCode: '#F97316',
    },
  ];

  const resetToDemoData = () => {
    // Completely wipe all transactional, log, and inventory data to zero / clean state
    setProducts([]);
    setDeletedProductIds([]);
    deletedEntityIdsRef.current = {};
    setDeletedEntityIds({});
    setCategories(initialCategories);
    setParties([]);
    setWallets(cleanZeroWallets);
    setSaleInvoices([]);
    setDeletedSaleInvoices([]);
    setSaleReturns([]);
    setPurchaseInvoices([]);
    setDeletedPurchaseInvoices([]);
    setPurchaseReturns([]);
    setPurchaseOrders([]);
    setQuotations([]);
    setExpiredReturnLogs([]);
    setInstallmentSchemes([]);
    setEmployees([]);
    setAdvanceSalaries([]);
    setPayrollHistory([]);
    setExpenseCategories(initialExpenseCategories);
    setExpenseVouchers([]);
    setDayBookEntries([]);
    setCashAdjustments([]);
    setActivityLogs([]);
    setSmsLogs([]);
    setWarrantyPolicies(initialWarrantyPolicies);
    setWarrantyRecords([]);
    setWarrantyClaims([]);
    setDiseaseMaster(INITIAL_DISEASE_MASTER);
    setDiseaseCategories(COMMON_DISEASE_CATEGORIES);
    setUsers(initialUsers);
    setCurrentUser(initialUsers[0]);

    const resetEpoch = Date.now();
    lastServerUpdatedEpochRef.current = resetEpoch;
    lastPushTimeRef.current = resetEpoch;

    const cleanData = {
      companySettings,
      products: [],
      deletedProductIds: [],
      deletedEntityIds: {},
      categories: initialCategories,
      parties: [],
      wallets: cleanZeroWallets,
      saleInvoices: [],
      deletedSaleInvoices: [],
      saleReturns: [],
      purchaseInvoices: [],
      deletedPurchaseInvoices: [],
      purchaseReturns: [],
      purchaseOrders: [],
      quotations: [],
      salesOrders: [],
      expiredReturnLogs: [],
      installmentSchemes: [],
      employees: [],
      advanceSalaries: [],
      payrollHistory: [],
      expenseCategories: initialExpenseCategories,
      expenseVouchers: [],
      dayBookEntries: [],
      cashAdjustments: [],
      activityLogs: [],
      warrantyPolicies: initialWarrantyPolicies,
      warrantyRecords: [],
      warrantyClaims: [],
      diseaseMaster: INITIAL_DISEASE_MASTER,
      diseaseCategories: COMMON_DISEASE_CATEGORIES,
      users: initialUsers,
      smsConfig,
      smsLogs: [],
      language,
      theme,
      lastUpdatedEpoch: resetEpoch,
      is_reset_wipe: true,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanData));
      localStorage.setItem('DOKANPRO_LAST_LOCAL_UPDATE_EPOCH', String(resetEpoch));
      localStorage.removeItem('DOKANPRO_DELETED_INVOICES_ARCHIVE');
      localStorage.removeItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE');
      localStorage.removeItem('DOKANPRO_DELETED_PRODUCT_IDS');
      localStorage.removeItem('DOKANPRO_DELETED_ENTITY_IDS');
      localStorage.removeItem('dokanpro_disease_master');
      localStorage.removeItem('dokanpro_disease_categories');
    } catch (e) {
      console.warn('Failed to save clean state', e);
    }

    // Immediately push wipe state to server to clear server snapshot & database.sql
    const targetsToNotify = new Set<string>();
    targetsToNotify.add('/api/sync');
    const customEndpoint = companySettings.apiEndpoint || localStorage.getItem('DOKANPRO_ERP_API_ENDPOINT');
    if (customEndpoint) targetsToNotify.add(customEndpoint);
    const activeUrl = getActiveApiEndpoint();
    if (activeUrl) targetsToNotify.add(activeUrl);

    targetsToNotify.forEach(url => {
      const endpoint = url.includes('?') ? `${url}&action=sync_all` : `${url}?action=sync_all`;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      })
        .then(res => res.json())
        .then(json => {
          if (json && json.success) {
            const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastServerSyncTime(now);
            try {
              localStorage.setItem('DOKANPRO_LAST_SYNC_TIME', now);
            } catch {}
          }
        })
        .catch(err => {
          console.warn('Reset sync push notice for endpoint:', url, err);
        });
    });

    // Broadcast reset to all other open browser tabs
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('DOKANPRO_CROSS_TAB_CHANNEL');
        bc.postMessage({ type: 'STATE_UPDATED', timestamp: resetEpoch });
        bc.close();
      }
    } catch {}

    showToast(
      language === 'bn'
        ? 'সকল ডাটা সফলভাবে মুছে ফেলা হয়েছে (সিস্টেম এখন সম্পূর্ণ ফাঁকা ও ফ্রেশ)।'
        : 'All data has been wiped and reset successfully. Ready for fresh entries.',
      'info'
    );
  };

  const restoreFromAdminDeletedArchive = async (
    record: AdminDeletedRecord,
    options?: { removeFromArchive?: boolean; silent?: boolean }
  ): Promise<boolean> => {
    if (!isAdminUser()) {
      if (!options?.silent) {
        showToast(
          language === 'bn'
            ? 'অনুমতি নেই! শুধুমাত্র অ্যাডমিন SQL আর্কাইভ থেকে ডাটা ফিরিয়ে আনতে পারবেন।'
            : 'Access denied! Only Admin can restore records from the separate SQL archive.',
          'error'
        );
      }
      return false;
    }

    const snap = record?.recordSnapshot;
    if (!record || !snap) {
      if (!options?.silent) {
        showToast(
          language === 'bn'
            ? 'এই রেকর্ডের সম্পূর্ণ ডাটা পাওয়া যায়নি!'
            : 'Snapshot data is missing for this archived record!',
          'error'
        );
      }
      return false;
    }

    lastPushTimeRef.current = Date.now();
    hasUnsyncedChangesRef.current = true;
    let restoredOk = false;

    const eType = String(record.entityType || '').toUpperCase();

    switch (eType) {
      case 'ARCHIVED_SALE_INVOICE':
      case 'SALE_INVOICE': {
        const inv: SaleInvoice | undefined =
          eType === 'ARCHIVED_SALE_INVOICE' ? (snap.invoiceSnapshot || snap) : snap;
        if (inv && inv.id) {
          if (saleInvoices.some(s => s.id === inv.id)) {
            restoredOk = true;
          } else {
            const linkedRets: SaleReturn[] = Array.isArray(snap.linkedSaleReturns) ? snap.linkedSaleReturns : [];
            const linkedSchs: InstallmentScheme[] = Array.isArray(snap.linkedInstallmentSchemes)
              ? snap.linkedInstallmentSchemes
              : [];
            restoredOk = applyRestoredSaleInvoice(inv, linkedRets, linkedSchs);
          }
          // Ensure it is not left orphaned in deletedSaleInvoices either
          if (snap.id && deletedSaleInvoices.some(d => d.id === snap.id)) {
            recordDeletedTombstones('deletedSaleInvoices', [snap.id]);
            setDeletedSaleInvoices(prev => {
              const next = prev.filter(d => d.id !== snap.id);
              try {
                localStorage.setItem('DOKANPRO_DELETED_INVOICES_ARCHIVE', JSON.stringify(next));
              } catch {}
              return next;
            });
          }
        }
        break;
      }

      case 'ARCHIVED_PURCHASE_INVOICE':
      case 'PURCHASE_INVOICE': {
        const pur: PurchaseInvoice | undefined =
          eType === 'ARCHIVED_PURCHASE_INVOICE' ? (snap.invoiceSnapshot || snap) : snap;
        if (pur && pur.id) {
          if (purchaseInvoices.some(p => p.id === pur.id)) {
            restoredOk = true;
          } else {
            const linkedRets: PurchaseReturn[] = Array.isArray(snap.linkedPurchaseReturns)
              ? snap.linkedPurchaseReturns
              : [];
            restoredOk = applyRestoredPurchaseInvoice(pur, linkedRets);
          }
          if (snap.id && deletedPurchaseInvoices.some(d => d.id === snap.id)) {
            recordDeletedTombstones('deletedPurchaseInvoices', [snap.id]);
            setDeletedPurchaseInvoices(prev => {
              const next = prev.filter(d => d.id !== snap.id);
              try {
                localStorage.setItem('DOKANPRO_DELETED_PURCHASES_ARCHIVE', JSON.stringify(next));
              } catch {}
              return next;
            });
          }
        }
        break;
      }

      case 'PRODUCT': {
        if (snap.id) {
          removeDeletedTombstones('products', [snap.id]);
          setDeletedProductIds(prev => prev.filter(id => id !== snap.id));
          setProducts(prev => {
            if (prev.some(p => p.id === snap.id)) return prev;
            const next = [snap as Product, ...prev];
            try {
              localStorage.setItem('DOKANPRO_PRODUCTS_BACKUP', JSON.stringify(next));
            } catch {}
            return next;
          });
          restoredOk = true;
        }
        break;
      }

      case 'PRODUCT_BATCH': {
        if (snap.batch && snap.productId) {
          setProducts(prev =>
            prev.map(p => {
              if (p.id !== snap.productId) return p;
              const existingBatches = p.batches ? [...p.batches] : [];
              if (existingBatches.some(b => b.id === snap.batch.id)) return p;
              const updatedBatches = [...existingBatches, snap.batch];
              const totalStock = updatedBatches.reduce((s, b) => s + Number(b.stock || 0), 0);
              return { ...p, batches: updatedBatches, stock: Number(totalStock.toFixed(4)) };
            })
          );
          restoredOk = true;
        }
        break;
      }

      case 'CATEGORY': {
        if (snap.id) {
          removeDeletedTombstones('categories', [snap.id]);
          setCategories(prev => (prev.some(c => c.id === snap.id) ? prev : [snap as Category, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'CUSTOMER':
      case 'SUPPLIER': {
        if (snap.id) {
          removeDeletedTombstones('parties', [snap.id]);
          setParties(prev => (prev.some(p => p.id === snap.id) ? prev : [snap as Party, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'SALE_RETURN': {
        if (snap.id) {
          removeDeletedTombstones('saleReturns', [snap.id, snap.returnNumber]);
          setSaleReturns(prev => (prev.some(r => r.id === snap.id) ? prev : [snap as SaleReturn, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'PURCHASE_RETURN': {
        if (snap.id) {
          removeDeletedTombstones('purchaseReturns', [snap.id, snap.returnNumber]);
          setPurchaseReturns(prev => (prev.some(r => r.id === snap.id) ? prev : [snap as PurchaseReturn, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'EXPENSE_VOUCHER': {
        if (snap.id) {
          const exp = snap as ExpenseVoucher;
          const already = expenseVouchers.some(e => e.id === exp.id);
          if (!already) {
            removeDeletedTombstones('expenseVouchers', [exp.id]);
            removeDeletedTombstones('dayBookEntries', [`db-exp-${exp.id}`]);
            setExpenseVouchers(prev => [exp, ...prev]);
            if (Number(exp.amount || 0) > 0 && exp.walletId) {
              setWallets(prev => deductAmountFromWallets(prev, exp.amount, exp.walletId, exp.walletName));
            }
            setDayBookEntries(prev => {
              if (prev.some(d => d.referenceId === exp.id || d.voucherNo === exp.voucherNo)) return prev;
              const dbEntry: DayBookEntry = {
                id: `db-exp-${exp.id}`,
                voucherNo: exp.voucherNo,
                date: exp.date,
                type: 'EXPENSE',
                flow: 'OUT',
                amount: exp.amount,
                walletId: exp.walletId,
                walletName: exp.walletName,
                referenceId: exp.id,
                referenceNo: exp.voucherNo,
                remarks: `${exp.categoryName}: ${exp.note || 'Restored Expense'}`,
                createdBy: currentUser?.id || 'usr-1',
                createdAt: exp.createdAt || `${exp.date} 12:00:00`,
              };
              return [dbEntry, ...prev];
            });
          }
          restoredOk = true;
        }
        break;
      }

      case 'EXPENSE_CATEGORY': {
        if (snap.id) {
          removeDeletedTombstones('expenseCategories', [snap.id]);
          setExpenseCategories(prev => (prev.some(c => c.id === snap.id) ? prev : [snap as ExpenseCategory, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'WALLET': {
        if (snap.id) {
          removeDeletedTombstones('wallets', [snap.id]);
          setWallets(prev => (prev.some(w => w.id === snap.id) ? prev : [...prev, snap as Wallet]));
          restoredOk = true;
        }
        break;
      }

      case 'CASH_ADJUSTMENT': {
        if (snap.id) {
          removeDeletedTombstones('cashAdjustments', [snap.id]);
          setCashAdjustments(prev => (prev.some(a => a.id === snap.id) ? prev : [snap as CashAdjustment, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'INSTALLMENT_SCHEME': {
        if (snap.id) {
          removeDeletedTombstones('installmentSchemes', [snap.id]);
          setInstallmentSchemes(prev => (prev.some(s => s.id === snap.id) ? prev : [snap as InstallmentScheme, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'EMPLOYEE': {
        if (snap.id) {
          removeDeletedTombstones('employees', [snap.id]);
          setEmployees(prev => (prev.some(e => e.id === snap.id) ? prev : [snap as Employee, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'USER_ACCOUNT': {
        if (snap.id) {
          removeDeletedTombstones('users', [snap.id]);
          setUsers(prev => (prev.some(u => u.id === snap.id) ? prev : [...prev, snap as UserAccount]));
          restoredOk = true;
        }
        break;
      }

      case 'QUOTATION': {
        if (snap.id) {
          removeDeletedTombstones('quotations', [snap.id]);
          setQuotations(prev => (prev.some(q => q.id === snap.id) ? prev : [snap as Quotation, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'PURCHASE_ORDER': {
        if (snap.id) {
          removeDeletedTombstones('purchaseOrders', [snap.id]);
          setPurchaseOrders(prev => (prev.some(po => po.id === snap.id) ? prev : [snap as PurchaseOrder, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'SALES_ORDER': {
        if (snap.id) {
          removeDeletedTombstones('salesOrders', [snap.id]);
          setSalesOrders(prev => (prev.some(so => so.id === snap.id) ? prev : [snap as SalesOrder, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'WARRANTY_POLICY': {
        if (snap.id) {
          removeDeletedTombstones('warrantyPolicies', [snap.id]);
          setWarrantyPolicies(prev => (prev.some(wp => wp.id === snap.id) ? prev : [snap as WarrantyPolicy, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'WARRANTY_RECORD': {
        if (snap.id) {
          removeDeletedTombstones('warrantyRecords', [snap.id]);
          setWarrantyRecords(prev => (prev.some(wr => wr.id === snap.id) ? prev : [snap as WarrantyRecord, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'WARRANTY_CLAIM': {
        if (snap.id) {
          removeDeletedTombstones('warrantyClaims', [snap.id]);
          setWarrantyClaims(prev => (prev.some(wc => wc.id === snap.id) ? prev : [snap as WarrantyClaim, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'EXPIRED_RETURN_LOG': {
        if (snap.id) {
          removeDeletedTombstones('expiredReturnLogs', [snap.id]);
          setExpiredReturnLogs(prev => (prev.some(er => er.id === snap.id) ? prev : [snap as ExpiredReturnLog, ...prev]));
          restoredOk = true;
        }
        break;
      }

      case 'SMS_LOG': {
        if (snap.id) {
          removeDeletedTombstones('smsLogs', [snap.id]);
          setSmsLogs(prev => (prev.some(sl => sl.id === snap.id) ? prev : [snap as SmsLog, ...prev]));
          restoredOk = true;
        }
        break;
      }

      default:
        break;
    }

    if (restoredOk) {
      if (options?.removeFromArchive !== false) {
        await removeAdminDeletedArchiveRecords([record.archiveId]);
      }

      logActivity({
        actionType: 'USER_ACTION',
        title: `Restored from Admin SQL Archive: ${record.referenceNo || record.title}`,
        description: `Admin '${currentUser?.fullName || 'Admin'}' restored ${record.entityType} (${record.title}) from admin_deleted_records.sql back into the ERP.`,
        severity: 'info',
        targetId: record.recordId,
        targetName: record.title,
      });

      if (!options?.silent) {
        showToast(
          language === 'bn'
            ? `SQL আর্কাইভ থেকে "${record.referenceNo ? `#${record.referenceNo} - ` : ''}${record.title}" সফলভাবে ব্যাক আনা হয়েছে!`
            : `Restored "${record.referenceNo ? `#${record.referenceNo} - ` : ''}${record.title}" from SQL archive successfully!`,
          'success'
        );
      }
    } else if (!options?.silent) {
      showToast(
        language === 'bn'
          ? 'এই রেকর্ডটি পুনরুদ্ধার করা সম্ভব হয়নি।'
          : 'Could not restore this record type automatically.',
        'warning'
      );
    }

    return restoredOk;
  };

  const restoreMultipleFromAdminDeletedArchive = async (
    records: AdminDeletedRecord[],
    options?: { removeFromArchive?: boolean }
  ): Promise<number> => {
    if (!isAdminUser() || !Array.isArray(records) || records.length === 0) return 0;

    let restoredCount = 0;
    const restoredArchiveIds: string[] = [];

    for (const rec of records) {
      const ok = await restoreFromAdminDeletedArchive(rec, {
        removeFromArchive: false,
        silent: true,
      });
      if (ok) {
        restoredCount++;
        if (rec.archiveId) restoredArchiveIds.push(rec.archiveId);
      }
    }

    if (restoredArchiveIds.length > 0 && options?.removeFromArchive !== false) {
      await removeAdminDeletedArchiveRecords(restoredArchiveIds);
    }

    if (restoredCount > 0) {
      showToast(
        language === 'bn'
          ? `মোট ${restoredCount}টি রেকর্ড SQL ফাইল থেকে সফলভাবে ব্যাক আনা হয়েছে!`
          : `Successfully restored ${restoredCount} record(s) from SQL archive!`,
        'success'
      );
    } else {
      showToast(
        language === 'bn'
          ? 'কোনো রেকর্ড ব্যাক আনা যায়নি।'
          : 'No records could be restored.',
        'warning'
      );
    }

    return restoredCount;
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        toggleTheme,
        activeTab,
        setActiveTab,
        activeHrSubTab,
        setActiveHrSubTab,
        activeInstallmentSubTab,
        setActiveInstallmentSubTab,
        companySettings,
        updateCompanySettings,
        products,
        categories,
        parties,
        wallets,
        saleInvoices,
        deletedSaleInvoices,
        saleReturns,
        purchaseInvoices,
        deletedPurchaseInvoices,
        purchaseReturns,
        purchaseOrders,
        salesOrders,
        quotations,
        expiredReturnLogs,
        installmentSchemes,
        employees,
        advanceSalaries,
        payrollHistory,
        expenseCategories,
        expenseVouchers,
        dayBookEntries,
        cashAdjustments,
        activityLogs,
        logActivity,
        users,
        currentUser,
        setCurrentUser,
        smsConfig,
        setSmsConfig,
        updateSmsConfig,
        smsLogs,
        sendManualSms,
        sendSaleSms,
        sendPaymentInSms,
        sendDueReminderSms,
        sendWarrantyClaimSms,
        warrantyPolicies,
        warrantyRecords,
        warrantyClaims,
        addWarrantyPolicy,
        updateWarrantyPolicy,
        deleteWarrantyPolicy,
        addWarrantyRecord,
        updateWarrantyRecord,
        deleteWarrantyRecord,
        addWarrantyClaim,
        updateWarrantyClaimStatus,
        deleteWarrantyClaim,
        deleteSmsLog,
        clearSmsLogs,
        diseaseMaster,
        setDiseaseMaster,
        diseaseCategories,
        setDiseaseCategories,
        printableDoc,
        openPrintModal,
        closePrintModal,
        toastMessage,
        showToast,
        addProduct,
        updateProduct,
        deleteProduct,
        deleteAllProducts,
        deletedProductIds,
        updateProductBatches,
        addProductBatch,
        deleteProductBatch,
        addCategory,
        updateCategory,
        deleteCategory,
        bulkImportProducts,
        getNextPartySerialNumber,
        addParty,
        updateParty,
        deleteParty,
        getNextSaleInvoiceNumber: () => generateSaleInvoiceNumber(saleInvoices),
        createSaleInvoice,
        updateSaleInvoice,
        deleteSaleInvoice,
        restoreDeletedSaleInvoice,
        permanentlyDeleteArchivedInvoice,
        clearAllDeletedInvoices,
        exportDeletedInvoicesToFile,
        exportSingleDeletedInvoiceToFile,
        createSaleReturn,
        deleteSaleReturn,
        recordPaymentIn,
        getNextPurchaseBillNumber: () => generatePurchaseBillNumber(purchaseInvoices),
        createPurchaseInvoice,
        updatePurchaseInvoice,
        deletePurchaseInvoice,
        restoreDeletedPurchaseInvoice,
        permanentlyDeleteArchivedPurchase,
        clearAllDeletedPurchases,
        exportDeletedPurchasesToFile,
        exportSingleDeletedPurchaseToFile,
        addPurchaseOrder,
        updatePurchaseOrderStatus,
        convertPOToPurchaseBill,
        deletePurchaseOrder,
        addQuotation,
        updateQuotationStatus,
        convertQuotationToSale,
        deleteQuotation,
        addSalesOrder,
        updateSalesOrder,
        updateSalesOrderStatus,
        convertSalesOrderToSale,
        deleteSalesOrder,
        createPurchaseReturn,
        deletePurchaseReturn,
        addExpiredReturnLog,
        deleteExpiredReturnLog,
        recordPaymentOut,
        createInstallmentScheme,
        collectInstallment,
        deleteInstallmentScheme,
        addCashAdjustment,
        adjustCash,
        deleteCashAdjustment,
        addWallet,
        updateWallet,
        deleteWallet,
        transferWalletFunds,
        transferBetweenWallets: transferWalletFunds,
        addExpenseCategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        addExpenseVoucher,
        deleteExpenseVoucher,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        resignEmployee,
        rejoinEmployee,
        addAdvanceSalary,
        giveAdvanceSalary,
        payEmployeeSalary,
        processMonthlyPayroll,
        addUser,
        updateUser,
        deleteUser,
        isLoggedIn,
        logout,
        login,
        switchUser,
        resetToDemoData,
        formatCurrency,
        isSyncingWithServer,
        lastServerSyncTime,
        serverSyncStatus,
        syncCountdown,
        autoSyncIntervalSeconds,
        setAutoSyncIntervalSeconds,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled,
        triggerServerPush,
        triggerServerPull,
        triggerSyncNow,
        saveApiEndpoint,
        downloadAdminDeletedSqlFile,
        fetchAdminDeletedArchive,
        restoreFromAdminDeletedArchive,
        restoreMultipleFromAdminDeletedArchive,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
