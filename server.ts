/**
 * DokanPro Enterprise ERP - Standalone Node.js & Express Localhost / Hosting Server
 * Developed By: Md. Tarikul Islam
 * Phone: 01312305225
 * Address: Sherpur, Sadar, Sherpur
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  generateFullSqlDump,
  generateFreshCleanSqlDump,
  generateAdminDeletedSqlDump,
  parseAdminDeletedSqlDump,
  AdminDeletedRecord,
} from './src/utils/sqlExporter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from dist
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'DokanPro Enterprise ERP Localhost/Hosting Server',
    version: '4.5.0',
    developer: 'Md. Tarikul Islam (Phone: 01312305225, Sherpur, Sadar, Sherpur)',
    timestamp: new Date().toISOString(),
  });
});

// Helper to merge two lists by entity id, preserving all existing and new records
function mergeCollection(existingList: any, incomingList: any, deletedIds?: Set<string>): any[] {
  if (!Array.isArray(existingList) && !Array.isArray(incomingList)) return [];
  if (!Array.isArray(existingList)) return (Array.isArray(incomingList) ? incomingList : []).filter(item => !deletedIds?.has(String(item?.id)));
  if (!Array.isArray(incomingList)) return existingList.filter(item => !deletedIds?.has(String(item?.id)));
  if (incomingList.length === 0) return existingList.filter(item => !deletedIds?.has(String(item?.id)));

  const map = new Map<string, any>();
  for (const item of existingList) {
    if (item && item.id !== undefined && item.id !== null) {
      if (!deletedIds?.has(String(item.id))) {
        map.set(String(item.id), item);
      }
    }
  }
  for (const item of incomingList) {
    if (item && item.id !== undefined && item.id !== null) {
      if (!deletedIds?.has(String(item.id))) {
        const existing = map.get(String(item.id));
        if (existing) {
          map.set(String(item.id), { ...existing, ...item });
        } else {
          map.set(String(item.id), item);
        }
      }
    }
  }
  return Array.from(map.values());
}

// Deeply merge incoming ERP payload with existing server state
function mergeErpData(existing: any, incoming: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const resolvedExisting = existing.data || existing;
  const resolvedIncoming = incoming.data || incoming;

  // If this is a full system wipe/reset, bypass merging and overwrite server state cleanly
  if (resolvedIncoming.is_reset_wipe || incoming.is_reset_wipe) {
    return {
      ...resolvedIncoming,
      is_reset_wipe: false,
      products: Array.isArray(resolvedIncoming.products) ? resolvedIncoming.products : [],
      saleInvoices: Array.isArray(resolvedIncoming.saleInvoices) ? resolvedIncoming.saleInvoices : [],
      purchaseInvoices: Array.isArray(resolvedIncoming.purchaseInvoices) ? resolvedIncoming.purchaseInvoices : [],
      parties: Array.isArray(resolvedIncoming.parties) ? resolvedIncoming.parties : [],
      deletedProductIds: [],
      deletedSaleInvoices: [],
      deletedPurchaseInvoices: [],
      deletedEntityIds: {},
      lastUpdatedEpoch: Math.max(Date.now(), Number(resolvedIncoming.lastUpdatedEpoch) || 0),
    };
  }

  // Merge Company Settings carefully
  const existingSettings = resolvedExisting.companySettings || {};
  const incomingSettings = resolvedIncoming.companySettings || {};
  const mergedSettings = {
    ...existingSettings,
    ...incomingSettings,
  };

  const resolvedName = incomingSettings.name || incomingSettings.companyName || existingSettings.name || existingSettings.companyName;
  if (resolvedName) {
    mergedSettings.name = resolvedName;
  }
  if (!mergedSettings.phone && existingSettings.phone) mergedSettings.phone = existingSettings.phone;
  if (!mergedSettings.address && existingSettings.address) mergedSettings.address = existingSettings.address;
  if (!mergedSettings.email && existingSettings.email) mergedSettings.email = existingSettings.email;

  // Merge per-collection tombstone IDs so Admin-deleted records never resurrect on sync
  const existingTombstones = (resolvedExisting.deletedEntityIds && typeof resolvedExisting.deletedEntityIds === 'object') ? resolvedExisting.deletedEntityIds : {};
  const incomingTombstones = (resolvedIncoming.deletedEntityIds && typeof resolvedIncoming.deletedEntityIds === 'object') ? resolvedIncoming.deletedEntityIds : {};
  const mergedTombstones: Record<string, string[]> = {};
  const allTombstoneKeys = new Set<string>([
    ...Object.keys(existingTombstones),
    ...Object.keys(incomingTombstones),
  ]);
  for (const key of allTombstoneKeys) {
    const combined = new Set<string>([
      ...(Array.isArray(existingTombstones[key]) ? existingTombstones[key].map(String) : []),
      ...(Array.isArray(incomingTombstones[key]) ? incomingTombstones[key].map(String) : []),
    ].filter(Boolean));
    if (combined.size > 0) {
      mergedTombstones[key] = Array.from(combined);
    }
  }
  const getTombstoneSet = (key: string, extra?: string[]): Set<string> => {
    const s = new Set<string>(mergedTombstones[key] || []);
    if (extra) extra.filter(Boolean).forEach(id => s.add(String(id)));
    return s;
  };

  const deletedSaleIds = getTombstoneSet('saleInvoices', [
    ...((resolvedExisting.deletedSaleInvoices || []).map((d: any) => String(d?.originalInvoiceId || d?.id || d?.invoiceId || ''))),
    ...((resolvedIncoming.deletedSaleInvoices || []).map((d: any) => String(d?.originalInvoiceId || d?.id || d?.invoiceId || ''))),
  ]);

  const deletedPurchaseIds = getTombstoneSet('purchaseInvoices', [
    ...((resolvedExisting.deletedPurchaseInvoices || []).map((d: any) => String(d?.originalPurchaseId || d?.id || d?.billNumber || ''))),
    ...((resolvedIncoming.deletedPurchaseInvoices || []).map((d: any) => String(d?.originalPurchaseId || d?.id || d?.billNumber || ''))),
  ]);

  const deletedProductIds = getTombstoneSet('products', [
    ...((resolvedExisting.deletedProductIds || []).map((d: any) => String(d))),
    ...((resolvedIncoming.deletedProductIds || []).map((d: any) => String(d))),
  ]);

  const merged: any = {
    ...resolvedExisting,
    ...resolvedIncoming,
    companySettings: mergedSettings,
    deletedEntityIds: mergedTombstones,
    products: mergeCollection(resolvedExisting.products, resolvedIncoming.products, deletedProductIds),
    deletedProductIds: Array.from(deletedProductIds),
    categories: mergeCollection(resolvedExisting.categories, resolvedIncoming.categories, getTombstoneSet('categories')),
    parties: mergeCollection(resolvedExisting.parties, resolvedIncoming.parties, getTombstoneSet('parties')),
    wallets: mergeCollection(resolvedExisting.wallets, resolvedIncoming.wallets, getTombstoneSet('wallets')),
    saleInvoices: mergeCollection(resolvedExisting.saleInvoices, resolvedIncoming.saleInvoices, deletedSaleIds),
    deletedSaleInvoices: mergeCollection(resolvedExisting.deletedSaleInvoices, resolvedIncoming.deletedSaleInvoices, getTombstoneSet('deletedSaleInvoices')),
    saleReturns: mergeCollection(resolvedExisting.saleReturns, resolvedIncoming.saleReturns, getTombstoneSet('saleReturns')),
    purchaseInvoices: mergeCollection(resolvedExisting.purchaseInvoices, resolvedIncoming.purchaseInvoices, deletedPurchaseIds),
    deletedPurchaseInvoices: mergeCollection(resolvedExisting.deletedPurchaseInvoices, resolvedIncoming.deletedPurchaseInvoices, getTombstoneSet('deletedPurchaseInvoices')),
    purchaseReturns: mergeCollection(resolvedExisting.purchaseReturns, resolvedIncoming.purchaseReturns, getTombstoneSet('purchaseReturns')),
    purchaseOrders: mergeCollection(resolvedExisting.purchaseOrders, resolvedIncoming.purchaseOrders, getTombstoneSet('purchaseOrders')),
    quotations: mergeCollection(resolvedExisting.quotations, resolvedIncoming.quotations, getTombstoneSet('quotations')),
    salesOrders: mergeCollection(resolvedExisting.salesOrders, resolvedIncoming.salesOrders, getTombstoneSet('salesOrders')),
    expiredReturnLogs: mergeCollection(resolvedExisting.expiredReturnLogs, resolvedIncoming.expiredReturnLogs, getTombstoneSet('expiredReturnLogs')),
    installmentSchemes: mergeCollection(resolvedExisting.installmentSchemes, resolvedIncoming.installmentSchemes, getTombstoneSet('installmentSchemes')),
    employees: mergeCollection(resolvedExisting.employees, resolvedIncoming.employees, getTombstoneSet('employees')),
    advanceSalaries: mergeCollection(resolvedExisting.advanceSalaries, resolvedIncoming.advanceSalaries, getTombstoneSet('advanceSalaries')),
    payrollHistory: mergeCollection(resolvedExisting.payrollHistory, resolvedIncoming.payrollHistory, getTombstoneSet('payrollHistory')),
    expenseCategories: mergeCollection(resolvedExisting.expenseCategories, resolvedIncoming.expenseCategories, getTombstoneSet('expenseCategories')),
    expenseVouchers: mergeCollection(resolvedExisting.expenseVouchers, resolvedIncoming.expenseVouchers, getTombstoneSet('expenseVouchers')),
    dayBookEntries: mergeCollection(resolvedExisting.dayBookEntries, resolvedIncoming.dayBookEntries, getTombstoneSet('dayBookEntries')),
    cashAdjustments: mergeCollection(resolvedExisting.cashAdjustments, resolvedIncoming.cashAdjustments, getTombstoneSet('cashAdjustments')),
    activityLogs: mergeCollection(resolvedExisting.activityLogs, resolvedIncoming.activityLogs, getTombstoneSet('activityLogs')),
    users: mergeCollection(resolvedExisting.users, resolvedIncoming.users, getTombstoneSet('users')),
    warrantyPolicies: mergeCollection(resolvedExisting.warrantyPolicies, resolvedIncoming.warrantyPolicies, getTombstoneSet('warrantyPolicies')),
    warrantyRecords: mergeCollection(resolvedExisting.warrantyRecords, resolvedIncoming.warrantyRecords, getTombstoneSet('warrantyRecords')),
    warrantyClaims: mergeCollection(resolvedExisting.warrantyClaims, resolvedIncoming.warrantyClaims, getTombstoneSet('warrantyClaims')),
    smsLogs: mergeCollection(resolvedExisting.smsLogs, resolvedIncoming.smsLogs, getTombstoneSet('smsLogs')),
    diseaseMaster: mergeCollection(resolvedExisting.diseaseMaster, resolvedIncoming.diseaseMaster),
    diseaseCategories: mergeCollection(resolvedExisting.diseaseCategories, resolvedIncoming.diseaseCategories),
    smsConfig: {
      ...(resolvedExisting.smsConfig || {}),
      ...(resolvedIncoming.smsConfig || {}),
    },
    lastUpdatedEpoch: Math.max(
      Date.now(),
      Number(resolvedIncoming.lastUpdatedEpoch) || 0,
      Number(resolvedExisting.lastUpdatedEpoch) || 0
    ),
  };

  return merged;
}

// Database Sync Route (/api/sync and /api.php)
const handleSyncPost = (req: Request, res: Response) => {
  try {
    const incomingData = req.body;
    const backupFile = path.join(__dirname, 'erp_local_backup.json');
    const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
    const publicSnapshotFile = path.join(__dirname, 'public', 'erp_data_snapshot.json');
    const rootSqlFile = path.join(__dirname, 'database.sql');
    const publicSqlFile = path.join(__dirname, 'public', 'database.sql');

    // Read existing file to perform smart multi-device merge
    let existingData: any = {};
    const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : (fs.existsSync(backupFile) ? backupFile : null);
    if (fileToRead) {
      try {
        existingData = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
      } catch {}
    }

    const mergedData = mergeErpData(existingData, incomingData);
    const jsonStr = JSON.stringify(mergedData, null, 2);

    fs.writeFileSync(backupFile, jsonStr, 'utf-8');
    fs.writeFileSync(snapshotFile, jsonStr, 'utf-8');
    try {
      if (!fs.existsSync(path.join(__dirname, 'public'))) {
        fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
      }
      fs.writeFileSync(publicSnapshotFile, jsonStr, 'utf-8');
    } catch {}

    // Auto-generate fresh database.sql on server
    try {
      const sqlDump = generateFullSqlDump(mergedData);
      fs.writeFileSync(rootSqlFile, sqlDump, 'utf-8');
      fs.writeFileSync(publicSqlFile, sqlDump, 'utf-8');
    } catch (sqlErr) {
      console.warn('Failed to write database.sql:', sqlErr);
    }

    res.json({
      success: true,
      message: 'Data merged, snapshot saved, and database.sql updated successfully.',
      timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lastUpdatedEpoch: mergedData.lastUpdatedEpoch,
      ...mergedData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const handleSyncGet = (req: Request, res: Response) => {
  try {
    const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
    const backupFile = path.join(__dirname, 'erp_local_backup.json');
    const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : backupFile;
    if (fs.existsSync(fileToRead)) {
      const parsed = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
      const data = parsed.data || parsed;
      res.json({
        success: true,
        ...data,
        data,
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        lastUpdatedEpoch: data.lastUpdatedEpoch || Date.now(),
      });
    } else {
      res.json({ success: true, data: null, empty: true });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Separate Admin Deleted Records SQL Archive helpers
function loadAdminDeletedArchiveRecords(): AdminDeletedRecord[] {
  const storageArchive = path.join(__dirname, 'erp_storage', 'admin_deleted_archive.json');
  const rootArchive = path.join(__dirname, 'admin_deleted_archive.json');
  const fileToRead = fs.existsSync(storageArchive) ? storageArchive : (fs.existsSync(rootArchive) ? rootArchive : null);
  if (fileToRead) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // Fallback: parse directly from admin_deleted_records.sql if present
  const storageSql = path.join(__dirname, 'erp_storage', 'admin_deleted_records.sql');
  const rootSql = path.join(__dirname, 'admin_deleted_records.sql');
  const sqlToRead = fs.existsSync(storageSql) ? storageSql : (fs.existsSync(rootSql) ? rootSql : null);
  if (sqlToRead) {
    try {
      const sqlText = fs.readFileSync(sqlToRead, 'utf-8');
      const parsedFromSql = parseAdminDeletedSqlDump(sqlText);
      if (parsedFromSql.length > 0) return parsedFromSql;
    } catch {}
  }
  return [];
}

function saveAdminDeletedArchiveRecords(records: AdminDeletedRecord[], shopName?: string): void {
  const storageDir = path.join(__dirname, 'erp_storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  const archiveJsonStr = JSON.stringify(records, null, 2);
  fs.writeFileSync(path.join(storageDir, 'admin_deleted_archive.json'), archiveJsonStr, 'utf-8');
  const resolvedShop = shopName || records[0]?.shopName || getCurrentShopName();
  const sqlContent = generateAdminDeletedSqlDump(records, resolvedShop);
  fs.writeFileSync(path.join(storageDir, 'admin_deleted_records.sql'), sqlContent, 'utf-8');
  fs.writeFileSync(path.join(__dirname, 'admin_deleted_records.sql'), sqlContent, 'utf-8');
}

function getKnownAdminUsers(): Array<{ id?: string; username?: string; role?: string }> {
  const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
  const backupFile = path.join(__dirname, 'erp_local_backup.json');
  const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : (fs.existsSync(backupFile) ? backupFile : null);
  if (!fileToRead) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
    const data = parsed.data || parsed;
    if (Array.isArray(data?.users)) {
      return data.users.filter((u: any) => String(u?.role || '').toUpperCase() === 'ADMIN');
    }
  } catch {}
  return [];
}

function verifyAdminRequest(req: Request): boolean {
  const roleHeader = String(req.headers['x-admin-role'] || '').toUpperCase();
  if (roleHeader !== 'ADMIN') return false;
  const knownAdmins = getKnownAdminUsers();
  if (knownAdmins.length === 0) return true;
  const headerId = String(req.headers['x-admin-id'] || '');
  const headerUser = String(req.headers['x-admin-username'] || '').toLowerCase();
  return knownAdmins.some(
    a => (headerId && String(a.id || '') === headerId) || (headerUser && String(a.username || '').toLowerCase() === headerUser)
  );
}

function getCurrentShopName(): string {
  const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
  const backupFile = path.join(__dirname, 'erp_local_backup.json');
  const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : (fs.existsSync(backupFile) ? backupFile : null);
  if (!fileToRead) return 'DokanPro ERP';
  try {
    const parsed = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
    const data = parsed.data || parsed;
    return data?.companySettings?.name || 'DokanPro ERP';
  } catch {
    return 'DokanPro ERP';
  }
}

const handleAdminDeletedArchiveGet = (req: Request, res: Response) => {
  try {
    if (!verifyAdminRequest(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin authorization required to access separate SQL archive.',
      });
    }
    const records = loadAdminDeletedArchiveRecords();
    return res.json({
      success: true,
      records,
      totalCount: records.length,
      fileName: 'admin_deleted_records.sql',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const handleAdminDeletedArchivePost = (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const incomingRaw: any[] = Array.isArray(body.records)
      ? body.records
      : (body.record && typeof body.record === 'object' ? [body.record] : []);

    const knownAdmins = getKnownAdminUsers();
    const validRecords: AdminDeletedRecord[] = incomingRaw.filter((rec: any) => {
      if (!rec || typeof rec !== 'object') return false;
      if (!rec.archiveId || !rec.entityType || !rec.recordId) return false;
      if (String(rec.deletedByRole || '').toUpperCase() !== 'ADMIN') return false;
      if (knownAdmins.length > 0) {
        const recId = String(rec.deletedById || '');
        const recUser = String(rec.deletedByUsername || '').toLowerCase();
        const matchesAdmin = knownAdmins.some(
          a => (recId && String(a.id || '') === recId) || (recUser && String(a.username || '').toLowerCase() === recUser)
        );
        if (!matchesAdmin) return false;
      }
      return true;
    });

    if (validRecords.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Admin authorization required for separate SQL archive.',
      });
    }

    const existing = loadAdminDeletedArchiveRecords();
    const byId = new Map<string, AdminDeletedRecord>();
    for (const item of existing) {
      if (item?.archiveId) byId.set(String(item.archiveId), item);
    }
    for (const item of validRecords) {
      byId.set(String(item.archiveId), item);
    }
    const merged = Array.from(byId.values());
    saveAdminDeletedArchiveRecords(merged, validRecords[0]?.shopName);

    return res.json({
      success: true,
      archivedCount: merged.length,
      addedCount: validRecords.length,
      fileName: 'admin_deleted_records.sql',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const handleAdminDeletedArchiveRemove = (req: Request, res: Response) => {
  try {
    if (!verifyAdminRequest(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin authorization required to modify separate SQL archive.',
      });
    }
    const body = req.body || {};
    const idsToRemove = new Set<string>(
      Array.isArray(body.archiveIds)
        ? body.archiveIds.map(String)
        : body.archiveId
          ? [String(body.archiveId)]
          : []
    );

    if (idsToRemove.size === 0) {
      return res.status(400).json({ success: false, message: 'No archiveId provided.' });
    }

    const existing = loadAdminDeletedArchiveRecords();
    const remaining = existing.filter(item => item?.archiveId && !idsToRemove.has(String(item.archiveId)));
    saveAdminDeletedArchiveRecords(remaining);

    return res.json({
      success: true,
      remainingCount: remaining.length,
      records: remaining,
      fileName: 'admin_deleted_records.sql',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const handleAdminDeletedSqlDownload = (req: Request, res: Response) => {
  try {
    if (!verifyAdminRequest(req)) {
      return res.status(403).send('-- Error: Admin authorization required to download admin_deleted_records.sql');
    }
    const records = loadAdminDeletedArchiveRecords();
    const shopName = getCurrentShopName();
    const sqlContent = generateAdminDeletedSqlDump(records, shopName);
    const storageDir = path.join(__dirname, 'erp_storage');
    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(path.join(storageDir, 'admin_deleted_records.sql'), sqlContent, 'utf-8');
      fs.writeFileSync(path.join(__dirname, 'admin_deleted_records.sql'), sqlContent, 'utf-8');
    } catch {}

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin_deleted_records.sql"');
    return res.send(sqlContent);
  } catch (err: any) {
    return res.status(500).send(`-- Error generating admin_deleted_records.sql: ${err.message}`);
  }
};

app.get('/api/admin-deleted-archive', handleAdminDeletedArchiveGet);
app.post('/api/admin-deleted-archive', handleAdminDeletedArchivePost);
app.post('/api/admin-deleted-archive/remove', handleAdminDeletedArchiveRemove);
app.get('/api/download-admin-deleted-sql', handleAdminDeletedSqlDownload);
app.get('/download-admin-deleted-sql', handleAdminDeletedSqlDownload);
app.get('/admin_deleted_records.sql', handleAdminDeletedSqlDownload);

app.post('/api/sync', handleSyncPost);
app.post('/api.php', (req: Request, res: Response) => {
  if (req.query.action === 'archive_admin_deleted') {
    return handleAdminDeletedArchivePost(req, res);
  }
  if (req.query.action === 'remove_admin_deleted_archive') {
    return handleAdminDeletedArchiveRemove(req, res);
  }
  return handleSyncPost(req, res);
});
app.get('/api/sync', handleSyncGet);
app.get('/api.php', (req: Request, res: Response) => {
  if (req.query.action === 'get_admin_deleted_archive') {
    return handleAdminDeletedArchiveGet(req, res);
  }
  if (req.query.action === 'download_admin_deleted_sql') {
    return handleAdminDeletedSqlDownload(req, res);
  }
  if (req.query.action === 'download_sql') {
    return handleSqlDownload(req, res);
  }
  if (req.query.action === 'download_fresh_sql') {
    return handleFreshSqlDownload(req, res);
  }
  return handleSyncGet(req, res);
});

// Outbound IP Detection Route for SMS IP Whitelisting
app.get('/api/get-ip', async (req: Request, res: Response) => {
  try {
    let publicIp = '';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
      if (ipRes.ok) {
        const ipData = (await ipRes.json()) as any;
        publicIp = ipData.ip || '';
      }
    } catch {
      // Fallback if ipify fails
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    res.json({
      success: true,
      serverIp: publicIp || clientIp,
      clientIp,
      ip: publicIp || clientIp,
      message: 'Server outbound IP fetched successfully.',
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message, ip: '127.0.0.1' });
  }
});

// Production SMS Proxy Route
app.post('/api/send-sms', async (req: Request, res: Response) => {
  try {
    const { url, method = 'POST', format = 'form', payload = {}, headers = {} } = req.body || {};

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    let targetUrl = url;
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DokanPro ERP SMS Client',
      'Accept': '*/*',
      ...headers,
    };

    let requestInit: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders,
    };

    if (method.toUpperCase() === 'GET') {
      const urlObj = new URL(targetUrl);
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined && v !== null && String(v).length > 0) {
          urlObj.searchParams.set(k, String(v));
        }
      }
      targetUrl = urlObj.toString();
    } else {
      if (format === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
        requestInit.body = JSON.stringify(payload);
      } else {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        const formParams = new URLSearchParams();
        for (const [k, v] of Object.entries(payload)) {
          if (v !== undefined && v !== null) {
            formParams.append(k, String(v));
          }
        }
        requestInit.body = formParams.toString();
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    requestInit.signal = controller.signal;

    const fetchResponse = await fetch(targetUrl, requestInit);
    clearTimeout(timeoutId);

    const responseText = await fetchResponse.text();
    const isHttpOk = fetchResponse.ok;

    let isSuccess = isHttpOk;
    const lowerText = responseText.toLowerCase();

    if (
      lowerText.includes('invalid') ||
      lowerText.includes('fail') ||
      lowerText.includes('error') ||
      lowerText.includes('missing') ||
      lowerText.includes('incorrect') ||
      lowerText.includes('insufficient') ||
      lowerText.includes('denied') ||
      lowerText.includes('unauthorized') ||
      lowerText.includes('not whitelisted')
    ) {
      isSuccess = false;
    } else if (isHttpOk) {
      isSuccess = true;
    }

    if (
      lowerText.includes('status":"sent"') ||
      lowerText.includes('status": "sent"') ||
      lowerText.includes('status":"success"') ||
      lowerText.includes('response_code":202') ||
      lowerText.includes('response_code": 202') ||
      lowerText.includes('sms submitted successfully') ||
      lowerText.includes('status:sent') ||
      lowerText.includes('1900') ||
      lowerText.includes('success') ||
      lowerText.includes('sent')
    ) {
      isSuccess = true;
    }

    res.json({
      success: isSuccess,
      httpStatus: fetchResponse.status,
      responseText,
      targetUrl,
    });
  } catch (err: any) {
    console.error('[Production Express SMS Proxy Error]:', err);
    res.json({
      success: false,
      error: err?.message || 'Failed to connect to SMS Gateway',
      responseText: `Gateway Connection Error: ${err?.message || 'Timeout/Network issue'}`,
    });
  }
});

// Download SQL dump route
const handleSqlDownload = (req: Request, res: Response) => {
  const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
  const backupFile = path.join(__dirname, 'erp_local_backup.json');
  const rootSqlFile = path.join(__dirname, 'database.sql');
  const publicSqlFile = path.join(__dirname, 'public', 'database.sql');
  const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : (fs.existsSync(backupFile) ? backupFile : null);

  if (fileToRead) {
    try {
      const content = fs.readFileSync(fileToRead, 'utf-8');
      const data = JSON.parse(content);
      const state = data.data || data;
      const sqlDump = generateFullSqlDump(state);
      fs.writeFileSync(rootSqlFile, sqlDump, 'utf-8');
      try {
        fs.writeFileSync(publicSqlFile, sqlDump, 'utf-8');
      } catch {}
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dokanpro_database.sql"');
      return res.send(sqlDump);
    } catch {}
  }

  if (fs.existsSync(rootSqlFile)) {
    return res.download(rootSqlFile, 'dokanpro_database.sql');
  }
  res.status(404).send('database.sql not found');
};

app.get('/api/download-sql', handleSqlDownload);
app.get('/download-database-sql', handleSqlDownload);
app.get('/database.sql', handleSqlDownload);

// Download Fresh Clean SQL (Zero Transactions) route
const handleFreshSqlDownload = (req: Request, res: Response) => {
  const freshSqlPath = path.join(__dirname, 'fresh_database.sql');
  const publicFreshSqlPath = path.join(__dirname, 'public', 'fresh_database.sql');
  
  const freshSqlDump = generateFreshCleanSqlDump();
  try {
    fs.writeFileSync(freshSqlPath, freshSqlDump, 'utf-8');
    if (!fs.existsSync(path.join(__dirname, 'public'))) {
      fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
    }
    fs.writeFileSync(publicFreshSqlPath, freshSqlDump, 'utf-8');
  } catch {}

  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dokanpro_fresh_clean_database.sql"');
  return res.send(freshSqlDump);
};

app.get('/api/download-fresh-sql', handleFreshSqlDownload);
app.get('/download-fresh-sql', handleFreshSqlDownload);
app.get('/fresh_database.sql', handleFreshSqlDownload);

// Catch-all route for SPA
app.get('*', (req: Request, res: Response) => {
  const distIndex = path.join(distPath, 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  const indexPath = fs.existsSync(distIndex) ? distIndex : (fs.existsSync(rootIndex) ? rootIndex : null);

  if (indexPath) {
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');

      // Attempt to read custom company/shop settings from persistent snapshot
      const snapshotFile = path.join(__dirname, 'erp_data_snapshot.json');
      const backupFile = path.join(__dirname, 'erp_local_backup.json');
      const fileToRead = fs.existsSync(snapshotFile) ? snapshotFile : backupFile;

      if (fs.existsSync(fileToRead)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(fileToRead, 'utf-8'));
          const data = parsed.data || parsed;
          const storeName = data?.companySettings?.name?.trim();
          if (storeName) {
            const pageTitle = `${storeName} | DokanPro ERP`;
            html = html.replace(/<title>.*?<\/title>/gi, `<title>${pageTitle}</title>`);
            html = html.replace(/<meta property="og:title" content=".*?" \/>/gi, `<meta property="og:title" content="${pageTitle}" />`);
            html = html.replace(/<meta property="og:site_name" content=".*?" \/>/gi, `<meta property="og:site_name" content="${storeName}" />`);
            html = html.replace(/<meta name="twitter:title" content=".*?" \/>/gi, `<meta name="twitter:title" content="${pageTitle}" />`);
            html = html.replace(/<meta name="title" content=".*?" \/>/gi, `<meta name="title" content="${pageTitle}" />`);
          }
        } catch {}
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    } catch {
      res.sendFile(indexPath);
      return;
    }
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>DokanPro ERP Server</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>DokanPro ERP Server Running on Port ${PORT}</h2>
          <p>Please run <code>npm run build</code> to compile the frontend files into <code>dist/</code>.</p>
          <p><strong>Developed by:</strong> Md. Tarikul Islam (01312305225, Sherpur, Sadar, Sherpur)</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` DokanPro ERP Server running on http://localhost:${PORT}`);
  console.log(` Developer : Md. Tarikul Islam (01312305225)`);
  console.log(` Address   : Sherpur, Sadar, Sherpur`);
  console.log(`=================================================`);
});
