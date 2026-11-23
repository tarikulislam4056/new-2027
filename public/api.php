<?php
/**
 * DokanPro Enterprise ERP - Universal PHP & MySQL REST API Connector
 * Developed By: Md. Tarikul Islam
 * Phone: 01312305225
 * Address: Sherpur, Sadar, Sherpur
 *
 * Deployment-Safe Persistent Architecture (v5.1):
 * - Separates DB credentials into persistent db_config.php (never overwritten by Git/cPanel updates)
 * - Stores live ERP snapshots in protected ./erp_storage/ AND off-webroot ../dokanpro_erp_data/ (if writable)
 * - Persists full lossless JSON state inside MySQL table `erp_state_store` (in addition to relational tables)
 * - Auto-recovers & self-heals if a GitHub/cPanel deploy overwrites or removes web-root files
 * - Works on: cPanel, Shared Hosting, XAMPP, WAMP, Laragon, VPS (PHP 7.4+, 8.0+)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -------------------------------------------------------------
// 1. Persistent Storage Directories (Safe across GitHub/cPanel updates)
// -------------------------------------------------------------
$storageDir = __DIR__ . '/erp_storage';
$backupsDir = $storageDir . '/backups';
$parentDir = dirname(__DIR__);
$externalStorageDir = ($parentDir && is_dir($parentDir) && is_writable($parentDir))
    ? ($parentDir . '/dokanpro_erp_data')
    : null;

function ensure_protected_storage_dir($dir) {
    if (!$dir) return false;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!is_dir($dir)) return false;

    $htaccess = $dir . '/.htaccess';
    if (!file_exists($htaccess)) {
        @file_put_contents($htaccess, "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
    }
    $indexPhp = $dir . '/index.php';
    if (!file_exists($indexPhp)) {
        @file_put_contents($indexPhp, "<?php http_response_code(403); exit('Forbidden');\n");
    }
    return true;
}

ensure_protected_storage_dir($storageDir);
ensure_protected_storage_dir($backupsDir);
if ($externalStorageDir) {
    ensure_protected_storage_dir($externalStorageDir);
}

// -------------------------------------------------------------
// 2. Database Configuration (External db_config.php preferred so updates never overwrite credentials)
// -------------------------------------------------------------
$configCandidates = [];
if ($externalStorageDir) {
    $configCandidates[] = $externalStorageDir . '/db_config.php';
}
$configCandidates[] = $storageDir . '/db_config.php';
$configCandidates[] = __DIR__ . '/db_config.php';

foreach ($configCandidates as $cfgFile) {
    if (file_exists($cfgFile)) {
        @include_once $cfgFile;
        break;
    }
}

if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'renttop1_erp');
if (!defined('DB_PASS')) define('DB_PASS', 'renttop1_erp');
if (!defined('DB_NAME')) define('DB_NAME', 'renttop1_erp');

// Connect to MySQL
$pdo = null;
$dbConnected = false;
$dbError = null;

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);
    $dbConnected = true;

    // Ensure non-destructive persistent state table exists in MySQL
    $pdo->exec("CREATE TABLE IF NOT EXISTS `erp_state_store` (
        `store_key` varchar(64) NOT NULL PRIMARY KEY,
        `state_json` longtext NOT NULL,
        `last_updated_epoch` bigint(20) NOT NULL DEFAULT 0,
        `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (PDOException $e) {
    // If DB doesn't exist yet or credentials not set, file-based persistent storage still works seamlessly
    $dbConnected = false;
    $dbError = $e->getMessage();
}

// -------------------------------------------------------------
// 3. Helper Functions for Snapshot Scoring, Loading & Saving
// -------------------------------------------------------------
function count_business_records($state) {
    if (!is_array($state)) return 0;
    $data = (isset($state['data']) && is_array($state['data']) && !isset($state['products'])) ? $state['data'] : $state;
    $keys = ['products', 'saleInvoices', 'purchaseInvoices', 'parties', 'expenseVouchers', 'salesOrders', 'dayBookEntries'];
    $count = 0;
    foreach ($keys as $k) {
        if (isset($data[$k]) && is_array($data[$k])) {
            $count += count($data[$k]);
        }
    }
    return $count;
}

function normalize_state_payload($parsed) {
    if (!is_array($parsed)) return null;
    if (isset($parsed['data']) && is_array($parsed['data']) && !isset($parsed['products'])) {
        return $parsed['data'];
    }
    return $parsed;
}

function load_best_snapshot($pdo, $storageDir, $externalStorageDir, $rootDir) {
    $candidates = [];

    // Candidate A: MySQL persistent erp_state_store (survives full webroot wipe!)
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT state_json, last_updated_epoch FROM `erp_state_store` WHERE `store_key` = 'main' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['state_json'])) {
                $decoded = @json_decode($row['state_json'], true);
                $norm = normalize_state_payload($decoded);
                if (is_array($norm)) {
                    $candidates[] = [
                        'source' => 'mysql_state_store',
                        'data' => $norm,
                        'epoch' => max((int)($norm['lastUpdatedEpoch'] ?? 0), (int)($row['last_updated_epoch'] ?? 0)),
                        'records' => count_business_records($norm),
                    ];
                }
            }
        } catch (Exception $e) {
            // Ignore read error
        }
    }

    // Candidate B: Off-webroot persistent storage
    $fileSources = [];
    if ($externalStorageDir) {
        $fileSources['external_storage'] = $externalStorageDir . '/erp_data_snapshot.json';
    }
    // Candidate C: Protected ./erp_storage/
    $fileSources['erp_storage'] = $storageDir . '/erp_data_snapshot.json';
    // Candidate D: Legacy root ./erp_data_snapshot.json (for smooth migration from older installs)
    $fileSources['legacy_root'] = $rootDir . '/erp_data_snapshot.json';
    $fileSources['legacy_local'] = $rootDir . '/erp_local_backup.json';

    foreach ($fileSources as $srcName => $filePath) {
        if ($filePath && file_exists($filePath) && is_readable($filePath)) {
            $raw = @file_get_contents($filePath);
            if ($raw) {
                $decoded = @json_decode($raw, true);
                $norm = normalize_state_payload($decoded);
                if (is_array($norm)) {
                    $candidates[] = [
                        'source' => $srcName,
                        'data' => $norm,
                        'epoch' => (int)($norm['lastUpdatedEpoch'] ?? 0),
                        'records' => count_business_records($norm),
                    ];
                }
            }
        }
    }

    if (empty($candidates)) {
        return ['source' => null, 'data' => []];
    }

    // Rank candidates:
    // 1) Real records > empty template (prevents empty GitHub template from overriding live business data)
    // 2) Higher lastUpdatedEpoch wins
    // 3) Protected sources preferred over legacy root on tie
    usort($candidates, function ($a, $b) {
        $aHas = ($a['records'] > 0 || $a['epoch'] > 0) ? 1 : 0;
        $bHas = ($b['records'] > 0 || $b['epoch'] > 0) ? 1 : 0;
        if ($aHas !== $bHas) {
            return $bHas - $aHas;
        }
        if ($a['epoch'] !== $b['epoch']) {
            return ($b['epoch'] > $a['epoch']) ? 1 : -1;
        }
        if ($a['records'] !== $b['records']) {
            return $b['records'] - $a['records'];
        }
        return 0;
    });

    return ['source' => $candidates[0]['source'], 'data' => $candidates[0]['data']];
}

function save_snapshot_everywhere($jsonStr, $storageDir, $backupsDir, $externalStorageDir, $rootDir, $isResetWipe = false) {
    // 1. Primary protected storage
    $primarySnapshot = $storageDir . '/erp_data_snapshot.json';
    @file_put_contents($primarySnapshot, $jsonStr, LOCK_EX);
    @chmod($primarySnapshot, 0640);

    // 2. Daily rolling backup (keeps last 30 days)
    if ($backupsDir && is_dir($backupsDir)) {
        if ($isResetWipe && file_exists($primarySnapshot)) {
            $preWipeFile = $backupsDir . '/pre_wipe_' . date('Y-m-d_His') . '.json';
            @copy($primarySnapshot, $preWipeFile);
        }
        $dailyFile = $backupsDir . '/snapshot_' . date('Y-m-d') . '.json';
        @file_put_contents($dailyFile, $jsonStr, LOCK_EX);
        $allBackups = @glob($backupsDir . '/snapshot_*.json');
        if (is_array($allBackups) && count($allBackups) > 30) {
            sort($allBackups);
            $toRemove = array_slice($allBackups, 0, count($allBackups) - 30);
            foreach ($toRemove as $oldFile) {
                @unlink($oldFile);
            }
        }
    }

    // 3. Off-webroot mirror (completely outside public_html)
    if ($externalStorageDir) {
        $extSnapshot = $externalStorageDir . '/erp_data_snapshot.json';
        @file_put_contents($extSnapshot, $jsonStr, LOCK_EX);
        @chmod($extSnapshot, 0640);
    }

    // 4. Backward-compatible root snapshot mirror (only if root is writable)
    $legacySnapshot = $rootDir . '/erp_data_snapshot.json';
    @file_put_contents($legacySnapshot, $jsonStr, LOCK_EX);
}

$action = isset($_GET['action']) ? $_GET['action'] : 'health';

switch ($action) {
    case 'health':
        $primarySnapshot = $storageDir . '/erp_data_snapshot.json';
        $legacySnapshot = __DIR__ . '/erp_data_snapshot.json';
        $backupsList = is_dir($backupsDir) ? @glob($backupsDir . '/*.json') : [];
        $best = load_best_snapshot($pdo, $storageDir, $externalStorageDir, __DIR__);

        echo json_encode([
            'status' => 'online',
            'app' => 'DokanPro Enterprise ERP API',
            'version' => '5.1.0',
            'developer' => 'Md. Tarikul Islam (Phone: 01312305225, Sherpur, Sadar, Sherpur)',
            'db_connected' => $dbConnected,
            'db_error' => $dbError,
            'storage_protected' => is_dir($storageDir) && is_writable($storageDir),
            'external_backup_active' => $externalStorageDir !== null && is_dir($externalStorageDir),
            'active_snapshot_source' => $best['source'],
            'has_snapshot' => file_exists($primarySnapshot) || file_exists($legacySnapshot) || !empty($best['data']),
            'last_updated_epoch' => (int)($best['data']['lastUpdatedEpoch'] ?? 0),
            'record_count' => count_business_records($best['data']),
            'backup_count' => is_array($backupsList) ? count($backupsList) : 0,
            'server_time' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync_all':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            if (!$input || !is_array($input)) {
                echo json_encode(['success' => false, 'message' => 'Invalid JSON payload received'], JSON_UNESCAPED_UNICODE);
                exit();
            }
            if (isset($input['data']) && is_array($input['data']) && !isset($input['products'])) {
                $input = array_merge($input['data'], $input);
            }

            // Multi-device smart union merge function with deletion support
            $mergeEntities = function($existingList, $incomingList, $deletedIds = []) {
                if (!is_array($existingList) && !is_array($incomingList)) return [];
                $delSet = array_flip(array_map('strval', is_array($deletedIds) ? $deletedIds : []));
                if (!is_array($existingList)) {
                    return array_values(array_filter(is_array($incomingList) ? $incomingList : [], function($i) use ($delSet) {
                        return !isset($delSet[(string)($i['id'] ?? '')]);
                    }));
                }
                if (!is_array($incomingList)) {
                    return array_values(array_filter($existingList, function($i) use ($delSet) {
                        return !isset($delSet[(string)($i['id'] ?? '')]);
                    }));
                }
                if (empty($incomingList)) {
                    return array_values(array_filter($existingList, function($i) use ($delSet) {
                        return !isset($delSet[(string)($i['id'] ?? '')]);
                    }));
                }

                $map = [];
                foreach ($existingList as $item) {
                    if (is_array($item) && isset($item['id'])) {
                        $id = (string)$item['id'];
                        if (!isset($delSet[$id])) {
                            $map[$id] = $item;
                        }
                    }
                }
                foreach ($incomingList as $item) {
                    if (is_array($item) && isset($item['id'])) {
                        $id = (string)$item['id'];
                        if (!isset($delSet[$id])) {
                            if (isset($map[$id])) {
                                $map[$id] = array_merge($map[$id], $item);
                            } else {
                                $map[$id] = $item;
                            }
                        }
                    }
                }
                return array_values($map);
            };

            $isResetWipe = !empty($input['is_reset_wipe']) || !empty($input['data']['is_reset_wipe']) || !empty($_GET['is_reset_wipe']);

            // Load best existing snapshot across MySQL + erp_storage + off-webroot + legacy
            $bestLoaded = load_best_snapshot($pdo, $storageDir, $externalStorageDir, __DIR__);
            $existing = !$isResetWipe && is_array($bestLoaded['data']) ? $bestLoaded['data'] : [];

            if ($isResetWipe) {
                // Create safety backup of previous snapshot before wipe
                if (!empty($bestLoaded['data']) && is_dir($backupsDir)) {
                    @file_put_contents(
                        $backupsDir . '/pre_wipe_' . date('Y-m-d_His') . '.json',
                        json_encode($bestLoaded['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
                    );
                }

                $input['is_reset_wipe'] = false;
                if (isset($input['data'])) {
                    $input['data']['is_reset_wipe'] = false;
                }
                $input['products'] = is_array($input['products'] ?? null) ? $input['products'] : [];
                $input['saleInvoices'] = is_array($input['saleInvoices'] ?? null) ? $input['saleInvoices'] : [];
                $input['purchaseInvoices'] = is_array($input['purchaseInvoices'] ?? null) ? $input['purchaseInvoices'] : [];
                $input['parties'] = is_array($input['parties'] ?? null) ? $input['parties'] : [];
                $input['salesOrders'] = is_array($input['salesOrders'] ?? null) ? $input['salesOrders'] : [];
                $input['deletedProductIds'] = [];
                $input['deletedSaleInvoices'] = [];
                $input['deletedPurchaseInvoices'] = [];
                $input['deletedEntityIds'] = [];
                $input['lastUpdatedEpoch'] = max(time() * 1000, isset($input['lastUpdatedEpoch']) ? (int)$input['lastUpdatedEpoch'] : 0);
            } else {
                // Merge company settings safely without losing shop details
                $existingSettings = isset($existing['companySettings']) && is_array($existing['companySettings']) ? $existing['companySettings'] : [];
                $incomingSettings = isset($input['companySettings']) && is_array($input['companySettings']) ? $input['companySettings'] : [];
                $mergedSettings = array_merge($existingSettings, $incomingSettings);
                if (!empty($incomingSettings['companyName']) && empty($mergedSettings['name'])) {
                    $mergedSettings['name'] = $incomingSettings['companyName'];
                }
                foreach (['name', 'phone', 'address', 'email', 'logoUrl'] as $reqField) {
                    if (empty($mergedSettings[$reqField]) && !empty($existingSettings[$reqField])) {
                        $mergedSettings[$reqField] = $existingSettings[$reqField];
                    }
                }

                // Merge per-collection tombstone IDs so Admin-deleted records never reappear
                $existingTombstones = isset($existing['deletedEntityIds']) && is_array($existing['deletedEntityIds']) ? $existing['deletedEntityIds'] : [];
                $incomingTombstones = isset($input['deletedEntityIds']) && is_array($input['deletedEntityIds']) ? $input['deletedEntityIds'] : [];
                $mergedTombstones = [];
                $allTombKeys = array_unique(array_merge(array_keys($existingTombstones), array_keys($incomingTombstones)));
                foreach ($allTombKeys as $tk) {
                    $exList = isset($existingTombstones[$tk]) && is_array($existingTombstones[$tk]) ? array_map('strval', $existingTombstones[$tk]) : [];
                    $inList = isset($incomingTombstones[$tk]) && is_array($incomingTombstones[$tk]) ? array_map('strval', $incomingTombstones[$tk]) : [];
                    $combined = array_values(array_unique(array_filter(array_merge($exList, $inList))));
                    if (!empty($combined)) {
                        $mergedTombstones[$tk] = $combined;
                    }
                }
                $input['deletedEntityIds'] = $mergedTombstones;

                $deletedSaleIds = array_values(array_unique(array_filter(array_merge(
                    $mergedTombstones['saleInvoices'] ?? [],
                    isset($existing['deletedSaleInvoices']) && is_array($existing['deletedSaleInvoices']) ? array_column($existing['deletedSaleInvoices'], 'originalInvoiceId') : [],
                    isset($existing['deletedSaleInvoices']) && is_array($existing['deletedSaleInvoices']) ? array_column($existing['deletedSaleInvoices'], 'id') : [],
                    isset($input['deletedSaleInvoices']) && is_array($input['deletedSaleInvoices']) ? array_column($input['deletedSaleInvoices'], 'originalInvoiceId') : [],
                    isset($input['deletedSaleInvoices']) && is_array($input['deletedSaleInvoices']) ? array_column($input['deletedSaleInvoices'], 'id') : []
                ))));

                $deletedPurchaseIds = array_values(array_unique(array_filter(array_merge(
                    $mergedTombstones['purchaseInvoices'] ?? [],
                    isset($existing['deletedPurchaseInvoices']) && is_array($existing['deletedPurchaseInvoices']) ? array_column($existing['deletedPurchaseInvoices'], 'originalPurchaseId') : [],
                    isset($existing['deletedPurchaseInvoices']) && is_array($existing['deletedPurchaseInvoices']) ? array_column($existing['deletedPurchaseInvoices'], 'id') : [],
                    isset($input['deletedPurchaseInvoices']) && is_array($input['deletedPurchaseInvoices']) ? array_column($input['deletedPurchaseInvoices'], 'originalPurchaseId') : [],
                    isset($input['deletedPurchaseInvoices']) && is_array($input['deletedPurchaseInvoices']) ? array_column($input['deletedPurchaseInvoices'], 'id') : []
                ))));

                $deletedProductIds = array_values(array_unique(array_filter(array_merge(
                    $mergedTombstones['products'] ?? [],
                    isset($existing['deletedProductIds']) && is_array($existing['deletedProductIds']) ? $existing['deletedProductIds'] : [],
                    isset($input['deletedProductIds']) && is_array($input['deletedProductIds']) ? $input['deletedProductIds'] : []
                ))));

                $collectionsToMerge = [
                    'categories', 'parties', 'wallets',
                    'deletedSaleInvoices', 'saleReturns', 'deletedPurchaseInvoices',
                    'purchaseReturns', 'purchaseOrders', 'quotations', 'salesOrders', 'expiredReturnLogs',
                    'installmentSchemes', 'employees', 'advanceSalaries', 'payrollHistory',
                    'expenseCategories', 'expenseVouchers', 'dayBookEntries', 'cashAdjustments',
                    'activityLogs', 'users', 'warrantyPolicies', 'warrantyRecords',
                    'warrantyClaims', 'smsLogs', 'diseaseMaster', 'diseaseCategories'
                ];

                $input['products'] = $mergeEntities(
                    isset($existing['products']) ? $existing['products'] : [],
                    isset($input['products']) ? $input['products'] : [],
                    $deletedProductIds
                );
                $input['deletedProductIds'] = $deletedProductIds;

                $input['saleInvoices'] = $mergeEntities(
                    isset($existing['saleInvoices']) ? $existing['saleInvoices'] : [],
                    isset($input['saleInvoices']) ? $input['saleInvoices'] : [],
                    $deletedSaleIds
                );

                $input['purchaseInvoices'] = $mergeEntities(
                    isset($existing['purchaseInvoices']) ? $existing['purchaseInvoices'] : [],
                    isset($input['purchaseInvoices']) ? $input['purchaseInvoices'] : [],
                    $deletedPurchaseIds
                );

                foreach ($collectionsToMerge as $key) {
                    $existCol = isset($existing[$key]) ? $existing[$key] : [];
                    $inCol = isset($input[$key]) ? $input[$key] : [];
                    $tombForKey = $mergedTombstones[$key] ?? [];
                    $input[$key] = $mergeEntities($existCol, $inCol, $tombForKey);
                }

                $input['smsConfig'] = array_merge(
                    isset($existing['smsConfig']) && is_array($existing['smsConfig']) ? $existing['smsConfig'] : [],
                    isset($input['smsConfig']) && is_array($input['smsConfig']) ? $input['smsConfig'] : []
                );
                $input['companySettings'] = $mergedSettings;
                $input['lastUpdatedEpoch'] = max(
                    time() * 1000,
                    isset($input['lastUpdatedEpoch']) ? (int)$input['lastUpdatedEpoch'] : 0,
                    isset($existing['lastUpdatedEpoch']) ? (int)$existing['lastUpdatedEpoch'] : 0
                );
            }

            // 1. Save merged state snapshot across all persistent locations
            $jsonStr = json_encode($input, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            save_snapshot_everywhere($jsonStr, $storageDir, $backupsDir, $externalStorageDir, __DIR__, $isResetWipe);

            // 2. Auto-generate comprehensive database.sql on server
            $sqlContent = "-- =========================================================================\n";
            $sqlContent .= "-- DokanPro Enterprise ERP - Auto-Generated MySQL Database Dump\n";
            $sqlContent .= "-- Last Updated : " . date('Y-m-d H:i:s') . "\n";
            $sqlContent .= "-- Developer    : Md. Tarikul Islam (Phone: 01312305225, Sherpur)\n";
            $sqlContent .= "-- =========================================================================\n\n";
            $sqlContent .= "SET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\nSTART TRANSACTION;\n\n";

            function p_esc($val) {
                if ($val === null) return 'NULL';
                if (is_bool($val)) return $val ? 1 : 0;
                if (is_numeric($val)) return $val;
                return "'" . addslashes((string)$val) . "'";
            }

            // Company Settings
            if (isset($input['companySettings'])) {
                $cs = $input['companySettings'];
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: company_settings\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `company_settings`;\n";
                $sqlContent .= "CREATE TABLE `company_settings` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `name` varchar(255) NOT NULL,\n";
                $sqlContent .= "  `nameBn` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `slogan` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `phone` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `email` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `website` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `address` text DEFAULT NULL,\n";
                $sqlContent .= "  `taxNumber` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `currencySymbol` varchar(20) DEFAULT '৳',\n";
                $sqlContent .= "  `currencyCode` varchar(20) DEFAULT 'BDT',\n";
                $sqlContent .= "  `logoUrl` text DEFAULT NULL,\n";
                $sqlContent .= "  `signatureUrl` text DEFAULT NULL,\n";
                $sqlContent .= "  `invoiceFooter` text DEFAULT NULL,\n";
                $sqlContent .= "  `defaultVatPercent` decimal(5,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `invoicePrintType` varchar(50) DEFAULT 'A4',\n";
                $sqlContent .= "  `invoiceTemplate` varchar(50) DEFAULT 'MODERN_MINIMAL',\n";
                $sqlContent .= "  `invoiceColorTheme` varchar(50) DEFAULT 'INDIGO_VIOLET',\n";
                $sqlContent .= "  `invoiceCustomPrimaryColor` varchar(20) DEFAULT '#6366f1',\n";
                $sqlContent .= "  `invoiceCustomAccentColor` varchar(20) DEFAULT '#4f46e5',\n";
                $sqlContent .= "  `smsSenderId` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `apiEndpoint` text DEFAULT NULL,\n";
                $sqlContent .= "  `autoSyncEnabled` tinyint(1) DEFAULT 1,\n";
                $sqlContent .= "  `productGenerics_json` text DEFAULT NULL,\n";
                $sqlContent .= "  `productManufacturers_json` text DEFAULT NULL,\n";
                $sqlContent .= "  `productUnits_json` text DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                $sqlContent .= "INSERT INTO `company_settings` (`id`, `name`, `nameBn`, `slogan`, `phone`, `email`, `website`, `address`, `taxNumber`, `currencySymbol`, `currencyCode`, `logoUrl`, `signatureUrl`, `invoiceFooter`, `defaultVatPercent`, `invoicePrintType`, `invoiceTemplate`, `invoiceColorTheme`, `invoiceCustomPrimaryColor`, `invoiceCustomAccentColor`, `smsSenderId`, `apiEndpoint`, `autoSyncEnabled`, `productGenerics_json`, `productManufacturers_json`, `productUnits_json`) VALUES (\n";
                $sqlContent .= "  " . p_esc($cs['id'] ?? 'main_company') . ",\n";
                $sqlContent .= "  " . p_esc($cs['name'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['nameBn'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['slogan'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['phone'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['email'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['website'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['address'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['taxNumber'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['currencySymbol'] ?? '৳') . ",\n";
                $sqlContent .= "  " . p_esc($cs['currencyCode'] ?? 'BDT') . ",\n";
                $sqlContent .= "  " . p_esc($cs['logoUrl'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['signatureUrl'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoiceFooter'] ?? '') . ",\n";
                $sqlContent .= "  " . (float)($cs['defaultVatPercent'] ?? 0) . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoicePrintType'] ?? 'A4') . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoiceTemplate'] ?? 'MODERN_MINIMAL') . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoiceColorTheme'] ?? 'INDIGO_VIOLET') . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoiceCustomPrimaryColor'] ?? '#6366f1') . ",\n";
                $sqlContent .= "  " . p_esc($cs['invoiceCustomAccentColor'] ?? '#4f46e5') . ",\n";
                $sqlContent .= "  " . p_esc($cs['smsSenderId'] ?? '') . ",\n";
                $sqlContent .= "  " . p_esc($cs['apiEndpoint'] ?? '') . ",\n";
                $sqlContent .= "  " . (!empty($cs['autoSyncEnabled']) ? 1 : 0) . ",\n";
                $sqlContent .= "  " . p_esc(isset($cs['productGenerics']) ? json_encode($cs['productGenerics'], JSON_UNESCAPED_UNICODE) : '[]') . ",\n";
                $sqlContent .= "  " . p_esc(isset($cs['productManufacturers']) ? json_encode($cs['productManufacturers'], JSON_UNESCAPED_UNICODE) : '[]') . ",\n";
                $sqlContent .= "  " . p_esc(isset($cs['productUnits']) ? json_encode($cs['productUnits'], JSON_UNESCAPED_UNICODE) : '["Pcs","Kg","Ltr","Box","Pack","Dozen","Meter","Bag"]') . "\n);\n\n";
            }

            // Users
            if (isset($input['users']) && is_array($input['users'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: users\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `users`;\n";
                $sqlContent .= "CREATE TABLE `users` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `username` varchar(100) NOT NULL UNIQUE,\n";
                $sqlContent .= "  `password` varchar(255) NOT NULL,\n";
                $sqlContent .= "  `fullName` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `role` varchar(50) NOT NULL DEFAULT 'CASHIER',\n";
                $sqlContent .= "  `email` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `phone` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `isActive` tinyint(1) DEFAULT 1\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['users'] as $u) {
                    $sqlContent .= "INSERT INTO `users` (`id`, `username`, `password`, `fullName`, `role`, `email`, `phone`, `isActive`) VALUES (" .
                        p_esc($u['id'] ?? '') . ", " .
                        p_esc($u['username'] ?? '') . ", " .
                        p_esc($u['password'] ?? '') . ", " .
                        p_esc($u['fullName'] ?? '') . ", " .
                        p_esc($u['role'] ?? 'CASHIER') . ", " .
                        p_esc($u['email'] ?? '') . ", " .
                        p_esc($u['phone'] ?? '') . ", " .
                        (!empty($u['isActive']) ? 1 : 0) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Categories
            if (isset($input['categories']) && is_array($input['categories'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: categories\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `categories`;\n";
                $sqlContent .= "CREATE TABLE `categories` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `name` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `nameBn` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `description` text DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['categories'] as $c) {
                    $sqlContent .= "INSERT INTO `categories` (`id`, `name`, `nameBn`, `description`) VALUES (" .
                        p_esc($c['id'] ?? '') . ", " .
                        p_esc($c['name'] ?? '') . ", " .
                        p_esc($c['nameBn'] ?? '') . ", " .
                        p_esc($c['description'] ?? '') . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Products & Medicines
            if (isset($input['products']) && is_array($input['products'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: products\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `products`;\n";
                $sqlContent .= "CREATE TABLE `products` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `sku` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `barcode` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `name` varchar(255) NOT NULL,\n";
                $sqlContent .= "  `nameBn` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `medicine` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `medicine_name` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `categoryId` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `categoryName` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `purchasePrice` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `salesPrice` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `discount` decimal(12,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `discountType` varchar(20) DEFAULT 'percentage',\n";
                $sqlContent .= "  `expDate` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `generic` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `manufacturer` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `dosageForm` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `strength` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `rackLocation` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `stripSize` int(11) DEFAULT NULL,\n";
                $sqlContent .= "  `stock` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `unit` varchar(50) DEFAULT 'Pcs',\n";
                $sqlContent .= "  `reorderLevel` decimal(12,2) DEFAULT 5.00,\n";
                $sqlContent .= "  `batchNumber` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `batches_json` longtext DEFAULT NULL,\n";
                $sqlContent .= "  `description` text DEFAULT NULL,\n";
                $sqlContent .= "  `imageUrl` text DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['products'] as $p) {
                    $medName = !empty($p['name']) ? $p['name'] : (!empty($p['medicine']) ? $p['medicine'] : 'Medicine Item');
                    $batchesJson = isset($p['batches']) && is_array($p['batches']) ? json_encode($p['batches'], JSON_UNESCAPED_UNICODE) : null;
                    $sqlContent .= "INSERT INTO `products` (`id`, `sku`, `barcode`, `name`, `nameBn`, `medicine`, `medicine_name`, `categoryId`, `categoryName`, `purchasePrice`, `salesPrice`, `discount`, `discountType`, `expDate`, `generic`, `manufacturer`, `dosageForm`, `strength`, `rackLocation`, `stripSize`, `stock`, `unit`, `reorderLevel`, `batchNumber`, `batches_json`, `description`, `imageUrl`) VALUES (" .
                        p_esc($p['id'] ?? '') . ", " .
                        p_esc($p['sku'] ?? '') . ", " .
                        p_esc($p['barcode'] ?? '') . ", " .
                        p_esc($medName) . ", " .
                        p_esc($p['nameBn'] ?? '') . ", " .
                        p_esc($medName) . ", " .
                        p_esc($medName) . ", " .
                        p_esc($p['categoryId'] ?? '') . ", " .
                        p_esc($p['categoryName'] ?? '') . ", " .
                        (float)($p['purchasePrice'] ?? 0) . ", " .
                        (float)($p['salesPrice'] ?? 0) . ", " .
                        (float)($p['discount'] ?? 0) . ", " .
                        p_esc($p['discountType'] ?? 'percentage') . ", " .
                        p_esc($p['expDate'] ?? '') . ", " .
                        p_esc($p['generic'] ?? ($p['genericName'] ?? '')) . ", " .
                        p_esc($p['manufacturer'] ?? '') . ", " .
                        p_esc($p['dosageForm'] ?? '') . ", " .
                        p_esc($p['strength'] ?? '') . ", " .
                        p_esc($p['rackLocation'] ?? '') . ", " .
                        (int)($p['stripSize'] ?? 0) . ", " .
                        (float)($p['stock'] ?? 0) . ", " .
                        p_esc($p['unit'] ?? 'Pcs') . ", " .
                        (float)($p['reorderLevel'] ?? 5) . ", " .
                        p_esc($p['batchNumber'] ?? '') . ", " .
                        ($batchesJson !== null ? p_esc($batchesJson) : "NULL") . ", " .
                        p_esc($p['description'] ?? '') . ", " .
                        p_esc($p['imageUrl'] ?? ($p['image'] ?? '')) . ");\n";
                }
                $sqlContent .= "\n";

                // Dedicated Medicines Table
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: medicines\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `medicines`;\n";
                $sqlContent .= "CREATE TABLE `medicines` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `medicine` varchar(255) NOT NULL,\n";
                $sqlContent .= "  `medicine_name` varchar(255) NOT NULL,\n";
                $sqlContent .= "  `sku` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `barcode` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `generic` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `brand` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `manufacturer` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `strength` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `dosage_form` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `category` varchar(255) DEFAULT NULL,\n";
                $sqlContent .= "  `purchase_price` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `sales_price` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `stock` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `unit` varchar(50) DEFAULT 'Pcs',\n";
                $sqlContent .= "  `exp_date` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `batch_no` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `rack_location` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `created_at` varchar(100) DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['products'] as $p) {
                    $medName = !empty($p['name']) ? $p['name'] : (!empty($p['medicine']) ? $p['medicine'] : 'Medicine Item');
                    $sqlContent .= "INSERT INTO `medicines` (`id`, `medicine`, `medicine_name`, `sku`, `barcode`, `generic`, `brand`, `manufacturer`, `strength`, `dosage_form`, `category`, `purchase_price`, `sales_price`, `stock`, `unit`, `exp_date`, `batch_no`, `rack_location`, `created_at`) VALUES (" .
                        p_esc($p['id'] ?? '') . ", " .
                        p_esc($medName) . ", " .
                        p_esc($medName) . ", " .
                        p_esc($p['sku'] ?? '') . ", " .
                        p_esc($p['barcode'] ?? '') . ", " .
                        p_esc($p['generic'] ?? ($p['genericName'] ?? '')) . ", " .
                        p_esc($p['manufacturer'] ?? '') . ", " .
                        p_esc($p['manufacturer'] ?? '') . ", " .
                        p_esc($p['strength'] ?? '') . ", " .
                        p_esc($p['dosageForm'] ?? '') . ", " .
                        p_esc($p['categoryName'] ?? '') . ", " .
                        (float)($p['purchasePrice'] ?? 0) . ", " .
                        (float)($p['salesPrice'] ?? 0) . ", " .
                        (float)($p['stock'] ?? 0) . ", " .
                        p_esc($p['unit'] ?? 'Pcs') . ", " .
                        p_esc($p['expDate'] ?? '') . ", " .
                        p_esc($p['batchNumber'] ?? '') . ", " .
                        p_esc($p['rackLocation'] ?? '') . ", " .
                        p_esc($p['createdAt'] ?? date('Y-m-d H:i:s')) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Parties (Customers & Suppliers)
            if (isset($input['parties']) && is_array($input['parties'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: parties\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `parties`;\n";
                $sqlContent .= "CREATE TABLE `parties` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `serialNumber` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `type` varchar(50) NOT NULL DEFAULT 'CUSTOMER',\n";
                $sqlContent .= "  `name` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `phone` varchar(50) NOT NULL,\n";
                $sqlContent .= "  `email` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `companyName` varchar(150) DEFAULT NULL,\n";
                $sqlContent .= "  `address` text DEFAULT NULL,\n";
                $sqlContent .= "  `creditLimit` decimal(12,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `openingBalance` decimal(12,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `currentBalance` decimal(12,2) DEFAULT 0.00\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['parties'] as $pty) {
                    $sqlContent .= "INSERT INTO `parties` (`id`, `serialNumber`, `type`, `name`, `phone`, `email`, `companyName`, `address`, `creditLimit`, `openingBalance`, `currentBalance`) VALUES (" .
                        p_esc($pty['id'] ?? '') . ", " .
                        p_esc($pty['serialNumber'] ?? '') . ", " .
                        p_esc($pty['type'] ?? 'CUSTOMER') . ", " .
                        p_esc($pty['name'] ?? '') . ", " .
                        p_esc($pty['phone'] ?? '') . ", " .
                        p_esc($pty['email'] ?? '') . ", " .
                        p_esc($pty['companyName'] ?? '') . ", " .
                        p_esc($pty['address'] ?? '') . ", " .
                        (float)($pty['creditLimit'] ?? 0) . ", " .
                        (float)($pty['openingBalance'] ?? 0) . ", " .
                        (float)($pty['currentBalance'] ?? 0) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Wallets & Accounts
            if (isset($input['wallets']) && is_array($input['wallets'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: wallets\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `wallets`;\n";
                $sqlContent .= "CREATE TABLE `wallets` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `name` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `type` varchar(50) NOT NULL DEFAULT 'CASH',\n";
                $sqlContent .= "  `accountNumber` varchar(100) DEFAULT NULL,\n";
                $sqlContent .= "  `balance` decimal(14,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `isActive` tinyint(1) DEFAULT 1\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['wallets'] as $w) {
                    $sqlContent .= "INSERT INTO `wallets` (`id`, `name`, `type`, `accountNumber`, `balance`, `isActive`) VALUES (" .
                        p_esc($w['id'] ?? '') . ", " .
                        p_esc($w['name'] ?? '') . ", " .
                        p_esc($w['type'] ?? 'CASH') . ", " .
                        p_esc($w['accountNumber'] ?? '') . ", " .
                        (float)($w['balance'] ?? 0) . ", " .
                        (!empty($w['isActive']) ? 1 : 0) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Sales Invoices
            if (isset($input['saleInvoices']) && is_array($input['saleInvoices'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: sales_invoices\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `sales_invoices`;\n";
                $sqlContent .= "CREATE TABLE `sales_invoices` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `invoiceNumber` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `date` varchar(50) NOT NULL,\n";
                $sqlContent .= "  `customerName` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `customerPhone` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `subTotal` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `discountAmount` decimal(12,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `vatAmount` decimal(12,2) DEFAULT 0.00,\n";
                $sqlContent .= "  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `paidAmount` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `dueAmount` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `status` varchar(50) NOT NULL DEFAULT 'PAID',\n";
                $sqlContent .= "  `paymentMethod` varchar(50) DEFAULT 'CASH',\n";
                $sqlContent .= "  `items_json` longtext DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['saleInvoices'] as $inv) {
                    $itemsJson = isset($inv['items']) ? json_encode($inv['items'], JSON_UNESCAPED_UNICODE) : '[]';
                    $subVal = $inv['subtotal'] ?? ($inv['subTotal'] ?? 0);
                    $discVal = $inv['discount'] ?? ($inv['discountAmount'] ?? 0);
                    $sqlContent .= "INSERT INTO `sales_invoices` (`id`, `invoiceNumber`, `date`, `customerName`, `customerPhone`, `subTotal`, `discountAmount`, `vatAmount`, `grandTotal`, `paidAmount`, `dueAmount`, `status`, `paymentMethod`, `items_json`) VALUES (" .
                        p_esc($inv['id'] ?? '') . ", " .
                        p_esc($inv['invoiceNumber'] ?? '') . ", " .
                        p_esc($inv['date'] ?? '') . ", " .
                        p_esc($inv['customerName'] ?? '') . ", " .
                        p_esc($inv['customerPhone'] ?? '') . ", " .
                        (float)$subVal . ", " .
                        (float)$discVal . ", " .
                        (float)($inv['vatAmount'] ?? 0) . ", " .
                        (float)($inv['grandTotal'] ?? 0) . ", " .
                        (float)($inv['paidAmount'] ?? 0) . ", " .
                        (float)($inv['dueAmount'] ?? 0) . ", " .
                        p_esc($inv['status'] ?? 'PAID') . ", " .
                        p_esc($inv['paymentMethod'] ?? 'CASH') . ", " .
                        p_esc($itemsJson) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Purchase Invoices
            if (isset($input['purchaseInvoices']) && is_array($input['purchaseInvoices'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: purchase_invoices\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `purchase_invoices`;\n";
                $sqlContent .= "CREATE TABLE `purchase_invoices` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `billNumber` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `date` varchar(50) NOT NULL,\n";
                $sqlContent .= "  `supplierName` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `supplierPhone` varchar(50) DEFAULT NULL,\n";
                $sqlContent .= "  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `paidAmount` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `dueAmount` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `status` varchar(50) NOT NULL DEFAULT 'PAID',\n";
                $sqlContent .= "  `items_json` longtext DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['purchaseInvoices'] as $pinv) {
                    $itemsJson = isset($pinv['items']) ? json_encode($pinv['items'], JSON_UNESCAPED_UNICODE) : '[]';
                    $sqlContent .= "INSERT INTO `purchase_invoices` (`id`, `billNumber`, `date`, `supplierName`, `supplierPhone`, `grandTotal`, `paidAmount`, `dueAmount`, `status`, `items_json`) VALUES (" .
                        p_esc($pinv['id'] ?? '') . ", " .
                        p_esc($pinv['billNumber'] ?? '') . ", " .
                        p_esc($pinv['date'] ?? '') . ", " .
                        p_esc($pinv['supplierName'] ?? '') . ", " .
                        p_esc($pinv['supplierPhone'] ?? '') . ", " .
                        (float)($pinv['grandTotal'] ?? 0) . ", " .
                        (float)($pinv['paidAmount'] ?? 0) . ", " .
                        (float)($pinv['dueAmount'] ?? 0) . ", " .
                        p_esc($pinv['status'] ?? 'PAID') . ", " .
                        p_esc($itemsJson) . ");\n";
                }
                $sqlContent .= "\n";
            }

            // Expenses & Daybook
            if (isset($input['expenseVouchers']) && is_array($input['expenseVouchers'])) {
                $sqlContent .= "-- --------------------------------------------------------\n-- Table: expense_vouchers\n-- --------------------------------------------------------\n";
                $sqlContent .= "DROP TABLE IF EXISTS `expense_vouchers`;\n";
                $sqlContent .= "CREATE TABLE `expense_vouchers` (\n";
                $sqlContent .= "  `id` varchar(50) NOT NULL PRIMARY KEY,\n";
                $sqlContent .= "  `voucherNo` varchar(100) NOT NULL,\n";
                $sqlContent .= "  `date` varchar(50) NOT NULL,\n";
                $sqlContent .= "  `categoryName` varchar(150) NOT NULL,\n";
                $sqlContent .= "  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,\n";
                $sqlContent .= "  `paymentMethod` varchar(50) DEFAULT 'CASH',\n";
                $sqlContent .= "  `description` text DEFAULT NULL\n";
                $sqlContent .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

                foreach ($input['expenseVouchers'] as $ev) {
                    $sqlContent .= "INSERT INTO `expense_vouchers` (`id`, `voucherNo`, `date`, `categoryName`, `amount`, `paymentMethod`, `description`) VALUES (" .
                        p_esc($ev['id'] ?? '') . ", " .
                        p_esc($ev['voucherNo'] ?? '') . ", " .
                        p_esc($ev['date'] ?? '') . ", " .
                        p_esc($ev['categoryName'] ?? '') . ", " .
                        (float)($ev['amount'] ?? 0) . ", " .
                        p_esc($ev['paymentMethod'] ?? 'CASH') . ", " .
                        p_esc($ev['note'] ?? ($ev['description'] ?? '')) . ");\n";
                }
                $sqlContent .= "\n";
            }

            $sqlContent .= "SET FOREIGN_KEY_CHECKS = 1;\nCOMMIT;\n";

            // 3. Write database.sql safely to persistent storage + mirror + legacy root
            @file_put_contents($storageDir . '/database.sql', $sqlContent, LOCK_EX);
            if ($externalStorageDir) {
                @file_put_contents($externalStorageDir . '/database.sql', $sqlContent, LOCK_EX);
            }
            @file_put_contents(__DIR__ . '/database.sql', $sqlContent, LOCK_EX);

            // 4. Persist full lossless state + relational tables directly into MySQL
            $dbSynced = false;
            if ($pdo) {
                try {
                    $stmt = $pdo->prepare(
                        "INSERT INTO `erp_state_store` (`store_key`, `state_json`, `last_updated_epoch`)
                         VALUES ('main', :state_json, :epoch)
                         ON DUPLICATE KEY UPDATE `state_json` = VALUES(`state_json`), `last_updated_epoch` = VALUES(`last_updated_epoch`)"
                    );
                    $stmt->execute([
                        ':state_json' => $jsonStr,
                        ':epoch' => (int)($input['lastUpdatedEpoch'] ?? (time() * 1000)),
                    ]);

                    $pdo->exec($sqlContent);
                    $dbSynced = true;
                } catch (Exception $dbEx) {
                    $dbError = $dbEx->getMessage();
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'All ERP data synced, protected snapshot saved, and database.sql updated successfully.',
                'db_synced' => $dbSynced,
                'db_error' => $dbError,
                'storage_protected' => true,
                'lastUpdatedEpoch' => $input['lastUpdatedEpoch'],
                'updated_at' => date('Y-m-d H:i:s')
            ], JSON_UNESCAPED_UNICODE);
        } else {
            // GET: Return best authoritative snapshot across MySQL + erp_storage + off-webroot + legacy
            $best = load_best_snapshot($pdo, $storageDir, $externalStorageDir, __DIR__);
            $resolved = $best['data'];

            if (!empty($resolved)) {
                // Self-heal: if primary protected snapshot was missing/behind (e.g. after deploy), restore it now
                $primarySnapshot = $storageDir . '/erp_data_snapshot.json';
                if (!file_exists($primarySnapshot) || $best['source'] === 'mysql_state_store' || $best['source'] === 'external_storage') {
                    $healedJson = json_encode($resolved, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                    @file_put_contents($primarySnapshot, $healedJson, LOCK_EX);
                }

                $responsePayload = array_merge($resolved, [
                    'success' => true,
                    'data' => $resolved,
                    'source' => $best['source'],
                    'lastUpdatedEpoch' => (int)($resolved['lastUpdatedEpoch'] ?? (time() * 1000)),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
                echo json_encode($responsePayload, JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode(['success' => true, 'data' => null, 'empty' => true], JSON_UNESCAPED_UNICODE);
            }
        }
        break;

    case 'download_sql':
        // Stream the most recent database.sql file
        $sqlCandidates = [
            $storageDir . '/database.sql',
            $externalStorageDir ? ($externalStorageDir . '/database.sql') : null,
            __DIR__ . '/database.sql',
        ];
        $sqlPath = null;
        $bestMtime = -1;
        foreach ($sqlCandidates as $cand) {
            if ($cand && file_exists($cand)) {
                $mt = @filemtime($cand);
                if ($mt >= $bestMtime) {
                    $bestMtime = $mt;
                    $sqlPath = $cand;
                }
            }
        }
        if ($sqlPath && file_exists($sqlPath)) {
            header('Content-Type: application/sql; charset=utf-8');
            header('Content-Disposition: attachment; filename="dokanpro_database.sql"');
            readfile($sqlPath);
            exit();
        } else {
            echo json_encode(['success' => false, 'message' => 'database.sql not found on server'], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'archive_admin_deleted':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);
        $incomingRaw = [];
        if (isset($input['records']) && is_array($input['records'])) {
            $incomingRaw = $input['records'];
        } elseif (isset($input['record']) && is_array($input['record'])) {
            $incomingRaw = [$input['record']];
        }

        // Verify against known ADMIN users from snapshot when available
        $bestSnap = load_best_snapshot($pdo, $storageDir, $externalStorageDir, __DIR__);
        $snapData = is_array($bestSnap['data'] ?? null) ? $bestSnap['data'] : [];
        $knownAdmins = [];
        if (isset($snapData['users']) && is_array($snapData['users'])) {
            foreach ($snapData['users'] as $u) {
                if (is_array($u) && strtoupper((string)($u['role'] ?? '')) === 'ADMIN') {
                    $knownAdmins[] = $u;
                }
            }
        }

        $validRecords = [];
        foreach ($incomingRaw as $rec) {
            if (!is_array($rec)) continue;
            if (empty($rec['archiveId']) || empty($rec['entityType']) || empty($rec['recordId'])) continue;
            if (strtoupper((string)($rec['deletedByRole'] ?? '')) !== 'ADMIN') continue;
            if (!empty($knownAdmins)) {
                $recId = (string)($rec['deletedById'] ?? '');
                $recUser = strtolower((string)($rec['deletedByUsername'] ?? ''));
                $matched = false;
                foreach ($knownAdmins as $adm) {
                    if (($recId !== '' && (string)($adm['id'] ?? '') === $recId) ||
                        ($recUser !== '' && strtolower((string)($adm['username'] ?? '')) === $recUser)) {
                        $matched = true;
                        break;
                    }
                }
                if (!$matched) continue;
            }
            $validRecords[] = $rec;
        }

        if (empty($validRecords)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Admin authorization required for separate SQL archive'], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Load existing archived records from protected storage
        $archivePaths = array_filter([
            $storageDir . '/admin_deleted_archive.json',
            $externalStorageDir ? ($externalStorageDir . '/admin_deleted_archive.json') : null,
            __DIR__ . '/admin_deleted_archive.json',
        ]);
        $existingArchive = [];
        foreach ($archivePaths as $ap) {
            if (file_exists($ap) && is_readable($ap)) {
                $decoded = @json_decode(@file_get_contents($ap), true);
                if (is_array($decoded) && count($decoded) > count($existingArchive)) {
                    $existingArchive = $decoded;
                }
            }
        }

        $byId = [];
        foreach ($existingArchive as $item) {
            if (is_array($item) && !empty($item['archiveId'])) {
                $byId[(string)$item['archiveId']] = $item;
            }
        }
        foreach ($validRecords as $item) {
            $byId[(string)$item['archiveId']] = $item;
        }
        $mergedArchive = array_values($byId);

        $archiveJsonStr = json_encode($mergedArchive, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        @file_put_contents($storageDir . '/admin_deleted_archive.json', $archiveJsonStr, LOCK_EX);
        @chmod($storageDir . '/admin_deleted_archive.json', 0640);
        if ($externalStorageDir) {
            @file_put_contents($externalStorageDir . '/admin_deleted_archive.json', $archiveJsonStr, LOCK_EX);
            @chmod($externalStorageDir . '/admin_deleted_archive.json', 0640);
        }

        // Generate completely separate SQL file: admin_deleted_records.sql
        $escSql = function($val) {
            if ($val === null) return 'NULL';
            if (is_bool($val)) return $val ? '1' : '0';
            if ((is_int($val) || is_float($val)) && is_finite($val)) return (string)$val;
            $s = (string)$val;
            $s = str_replace(["\\", "'", "\0", "\n", "\r", "\t", "\x1a"], ["\\\\", "\\'", "\\0", "\\n", "\\r", "\\t", "\\Z"], $s);
            return "'" . $s . "'";
        };

        $shopName = $validRecords[0]['shopName'] ?? ($snapData['companySettings']['name'] ?? 'DokanPro ERP');
        $safeShopName = preg_replace('/[\r\n]+/', ' ', (string)$shopName);

        $delSql = "-- =========================================================================\n";
        $delSql .= "-- DokanPro Enterprise ERP - Separate Admin Deleted Records SQL Archive\n";
        $delSql .= "-- File         : admin_deleted_records.sql\n";
        $delSql .= "-- Generated At : " . date('Y-m-d H:i:s') . "\n";
        $delSql .= "-- Shop Name    : " . $safeShopName . "\n";
        $delSql .= "-- Total Saved  : " . count($mergedArchive) . " record(s)\n";
        $delSql .= "-- =========================================================================\n\n";
        $delSql .= "SET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\nSTART TRANSACTION;\nSET NAMES utf8mb4;\n\n";
        $delSql .= "CREATE TABLE IF NOT EXISTS `admin_deleted_records` (\n";
        $delSql .= "  `archive_id` varchar(100) NOT NULL PRIMARY KEY,\n";
        $delSql .= "  `entity_type` varchar(80) NOT NULL,\n";
        $delSql .= "  `source_table` varchar(80) NOT NULL,\n";
        $delSql .= "  `record_id` varchar(120) NOT NULL,\n";
        $delSql .= "  `reference_no` varchar(150) DEFAULT NULL,\n";
        $delSql .= "  `title` varchar(255) DEFAULT NULL,\n";
        $delSql .= "  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,\n";
        $delSql .= "  `deleted_at` varchar(80) NOT NULL,\n";
        $delSql .= "  `deleted_at_iso` varchar(80) NOT NULL,\n";
        $delSql .= "  `deleted_by_id` varchar(80) DEFAULT NULL,\n";
        $delSql .= "  `deleted_by_username` varchar(120) DEFAULT NULL,\n";
        $delSql .= "  `deleted_by_name` varchar(180) DEFAULT NULL,\n";
        $delSql .= "  `deleted_by_role` varchar(40) NOT NULL DEFAULT 'ADMIN',\n";
        $delSql .= "  `deletion_reason` text DEFAULT NULL,\n";
        $delSql .= "  `shop_name` varchar(255) DEFAULT NULL,\n";
        $delSql .= "  `record_snapshot_json` longtext NOT NULL,\n";
        $delSql .= "  `archived_timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,\n";
        $delSql .= "  KEY `idx_admin_del_entity_type` (`entity_type`),\n";
        $delSql .= "  KEY `idx_admin_del_record_id` (`record_id`),\n";
        $delSql .= "  KEY `idx_admin_del_deleted_at` (`deleted_at_iso`)\n";
        $delSql .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

        foreach ($mergedArchive as $r) {
            $snapJson = json_encode($r['recordSnapshot'] ?? [], JSON_UNESCAPED_UNICODE);
            $delSql .= "INSERT IGNORE INTO `admin_deleted_records` (`archive_id`, `entity_type`, `source_table`, `record_id`, `reference_no`, `title`, `amount`, `deleted_at`, `deleted_at_iso`, `deleted_by_id`, `deleted_by_username`, `deleted_by_name`, `deleted_by_role`, `deletion_reason`, `shop_name`, `record_snapshot_json`) VALUES (" .
                $escSql($r['archiveId'] ?? '') . ", " .
                $escSql($r['entityType'] ?? 'UNKNOWN') . ", " .
                $escSql($r['sourceTable'] ?? 'unknown') . ", " .
                $escSql($r['recordId'] ?? '') . ", " .
                $escSql($r['referenceNo'] ?? '') . ", " .
                $escSql($r['title'] ?? '') . ", " .
                (float)($r['amount'] ?? 0) . ", " .
                $escSql($r['deletedAt'] ?? '') . ", " .
                $escSql($r['deletedAtIso'] ?? date('c')) . ", " .
                $escSql($r['deletedById'] ?? '') . ", " .
                $escSql($r['deletedByUsername'] ?? 'admin') . ", " .
                $escSql($r['deletedByName'] ?? 'Admin') . ", " .
                "'ADMIN', " .
                $escSql($r['deletionReason'] ?? '') . ", " .
                $escSql($r['shopName'] ?? $safeShopName) . ", " .
                $escSql($snapJson) . ");\n";
        }
        $delSql .= "\nSET FOREIGN_KEY_CHECKS = 1;\nCOMMIT;\n";

        @file_put_contents($storageDir . '/admin_deleted_records.sql', $delSql, LOCK_EX);
        if ($externalStorageDir) {
            @file_put_contents($externalStorageDir . '/admin_deleted_records.sql', $delSql, LOCK_EX);
        }
        @file_put_contents(__DIR__ . '/admin_deleted_records.sql', $delSql, LOCK_EX);

        // Also store via parameterized PDO prepared statements in MySQL if connected
        $dbArchived = false;
        if ($pdo) {
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_deleted_records` (
                    `archive_id` varchar(100) NOT NULL PRIMARY KEY,
                    `entity_type` varchar(80) NOT NULL,
                    `source_table` varchar(80) NOT NULL,
                    `record_id` varchar(120) NOT NULL,
                    `reference_no` varchar(150) DEFAULT NULL,
                    `title` varchar(255) DEFAULT NULL,
                    `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
                    `deleted_at` varchar(80) NOT NULL,
                    `deleted_at_iso` varchar(80) NOT NULL,
                    `deleted_by_id` varchar(80) DEFAULT NULL,
                    `deleted_by_username` varchar(120) DEFAULT NULL,
                    `deleted_by_name` varchar(180) DEFAULT NULL,
                    `deleted_by_role` varchar(40) NOT NULL DEFAULT 'ADMIN',
                    `deletion_reason` text DEFAULT NULL,
                    `shop_name` varchar(255) DEFAULT NULL,
                    `record_snapshot_json` longtext NOT NULL,
                    `archived_timestamp` timestamp DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $insStmt = $pdo->prepare(
                    "INSERT IGNORE INTO `admin_deleted_records`
                     (`archive_id`, `entity_type`, `source_table`, `record_id`, `reference_no`, `title`, `amount`, `deleted_at`, `deleted_at_iso`, `deleted_by_id`, `deleted_by_username`, `deleted_by_name`, `deleted_by_role`, `deletion_reason`, `shop_name`, `record_snapshot_json`)
                     VALUES (:archive_id, :entity_type, :source_table, :record_id, :reference_no, :title, :amount, :deleted_at, :deleted_at_iso, :deleted_by_id, :deleted_by_username, :deleted_by_name, :deleted_by_role, :deletion_reason, :shop_name, :record_snapshot_json)"
                );
                foreach ($validRecords as $r) {
                    $insStmt->execute([
                        ':archive_id' => (string)($r['archiveId'] ?? ''),
                        ':entity_type' => (string)($r['entityType'] ?? 'UNKNOWN'),
                        ':source_table' => (string)($r['sourceTable'] ?? 'unknown'),
                        ':record_id' => (string)($r['recordId'] ?? ''),
                        ':reference_no' => (string)($r['referenceNo'] ?? ''),
                        ':title' => (string)($r['title'] ?? ''),
                        ':amount' => (float)($r['amount'] ?? 0),
                        ':deleted_at' => (string)($r['deletedAt'] ?? ''),
                        ':deleted_at_iso' => (string)($r['deletedAtIso'] ?? date('c')),
                        ':deleted_by_id' => (string)($r['deletedById'] ?? ''),
                        ':deleted_by_username' => (string)($r['deletedByUsername'] ?? 'admin'),
                        ':deleted_by_name' => (string)($r['deletedByName'] ?? 'Admin'),
                        ':deleted_by_role' => 'ADMIN',
                        ':deletion_reason' => (string)($r['deletionReason'] ?? ''),
                        ':shop_name' => (string)($r['shopName'] ?? $safeShopName),
                        ':record_snapshot_json' => json_encode($r['recordSnapshot'] ?? [], JSON_UNESCAPED_UNICODE),
                    ]);
                }
                $dbArchived = true;
            } catch (Exception $e) {
                $dbError = $e->getMessage();
            }
        }

        echo json_encode([
            'success' => true,
            'archivedCount' => count($mergedArchive),
            'addedCount' => count($validRecords),
            'db_archived' => $dbArchived,
            'fileName' => 'admin_deleted_records.sql',
            'updated_at' => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'download_admin_deleted_sql':
        $delCandidates = [
            $storageDir . '/admin_deleted_records.sql',
            $externalStorageDir ? ($externalStorageDir . '/admin_deleted_records.sql') : null,
            __DIR__ . '/admin_deleted_records.sql',
        ];
        $delSqlPath = null;
        $bestMtime = -1;
        foreach ($delCandidates as $cand) {
            if ($cand && file_exists($cand)) {
                $mt = @filemtime($cand);
                if ($mt >= $bestMtime) {
                    $bestMtime = $mt;
                    $delSqlPath = $cand;
                }
            }
        }
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="admin_deleted_records.sql"');
        if ($delSqlPath && file_exists($delSqlPath)) {
            readfile($delSqlPath);
        } else {
            echo "-- DokanPro Enterprise ERP - Separate Admin Deleted Records SQL Archive\n";
            echo "-- Generated At: " . date('Y-m-d H:i:s') . "\n";
            echo "CREATE TABLE IF NOT EXISTS `admin_deleted_records` (`archive_id` varchar(100) NOT NULL PRIMARY KEY, `entity_type` varchar(80) NOT NULL, `source_table` varchar(80) NOT NULL, `record_id` varchar(120) NOT NULL, `reference_no` varchar(150) DEFAULT NULL, `title` varchar(255) DEFAULT NULL, `amount` decimal(14,2) NOT NULL DEFAULT 0.00, `deleted_at` varchar(80) NOT NULL, `deleted_at_iso` varchar(80) NOT NULL, `deleted_by_id` varchar(80) DEFAULT NULL, `deleted_by_username` varchar(120) DEFAULT NULL, `deleted_by_name` varchar(180) DEFAULT NULL, `deleted_by_role` varchar(40) NOT NULL DEFAULT 'ADMIN', `deletion_reason` text DEFAULT NULL, `shop_name` varchar(255) DEFAULT NULL, `record_snapshot_json` longtext NOT NULL, `archived_timestamp` timestamp DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n";
            echo "-- No Admin deleted records archived yet.\n";
        }
        exit();

    case 'get_ip':
        $ip = '';
        if (function_exists('curl_init')) {
            $ch = curl_init('https://api.ipify.org?format=json');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $res = curl_exec($ch);
            curl_close($ch);
            if ($res) {
                $data = json_decode($res, true);
                $ip = $data['ip'] ?? '';
            }
        }
        if (!$ip) {
            $ip = $_SERVER['SERVER_ADDR'] ?? $_SERVER['LOCAL_ADDR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        }
        echo json_encode([
            'success' => true,
            'ip' => $ip,
            'serverIp' => $ip,
            'clientIp' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'send_sms':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            $targetUrl = $input['url'] ?? '';
            $method = strtoupper($input['method'] ?? 'POST');
            $format = $input['format'] ?? 'form';
            $payload = $input['payload'] ?? [];
            $headers = $input['headers'] ?? [];

            if (!$targetUrl) {
                echo json_encode(['success' => false, 'message' => 'URL is required'], JSON_UNESCAPED_UNICODE);
                exit();
            }

            if ($method === 'GET') {
                $queryString = http_build_query($payload);
                if ($queryString) {
                    $targetUrl .= (strpos($targetUrl, '?') === false ? '?' : '&') . $queryString;
                }
            }

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $targetUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

            $reqHeaders = ['User-Agent: DokanPro ERP SMS PHP Client'];
            foreach ($headers as $k => $v) {
                $reqHeaders[] = "$k: $v";
            }

            if ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                if ($format === 'json') {
                    $reqHeaders[] = 'Content-Type: application/json';
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
                } else {
                    $reqHeaders[] = 'Content-Type: application/x-www-form-urlencoded';
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
                }
            }

            curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);
            $responseText = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($responseText === false) {
                echo json_encode([
                    'success' => false,
                    'error' => $curlError,
                    'responseText' => 'PHP cURL Error: ' . $curlError
                ], JSON_UNESCAPED_UNICODE);
                exit();
            }

            $lowerText = strtolower($responseText);
            $isSuccess = ($httpCode >= 200 && $httpCode < 300);

            if (
                strpos($lowerText, 'invalid') !== false ||
                strpos($lowerText, 'fail') !== false ||
                strpos($lowerText, 'error') !== false ||
                strpos($lowerText, 'missing') !== false ||
                strpos($lowerText, 'denied') !== false ||
                strpos($lowerText, 'not whitelisted') !== false
            ) {
                $isSuccess = false;
            }

            if (
                strpos($lowerText, 'status":"sent"') !== false ||
                strpos($lowerText, 'status":"success"') !== false ||
                strpos($lowerText, '1900') !== false ||
                strpos($lowerText, 'success') !== false
            ) {
                $isSuccess = true;
            }

            echo json_encode([
                'success' => $isSuccess,
                'httpStatus' => $httpCode,
                'responseText' => $responseText,
                'targetUrl' => $targetUrl
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Action not found'], JSON_UNESCAPED_UNICODE);
        break;
}
