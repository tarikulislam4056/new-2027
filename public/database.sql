-- =========================================================================
-- DokanPro Enterprise ERP - Production-Grade MySQL/MariaDB Database Dump
-- Generated At : 2026-11-23T04:26:15.029Z (23/11/2026)
-- Developer    : Md. Tarikul Islam
-- Phone        : 01312305225
-- Address      : Sherpur, Sadar, Sherpur
-- Engine       : InnoDB | Charset: UTF8MB4 (Full Bengali & Unicode Support)
-- Compatibility: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+, SQLite 3, phpMyAdmin, cPanel, XAMPP
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+06:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------
-- Table structure for `company_settings`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `company_settings`;
CREATE TABLE `company_settings` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `nameBn` varchar(255) DEFAULT NULL,
  `slogan` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `website` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `taxNumber` varchar(100) DEFAULT NULL,
  `currencySymbol` varchar(20) DEFAULT '৳',
  `currencyCode` varchar(20) DEFAULT 'BDT',
  `logoUrl` longtext DEFAULT NULL,
  `signatureUrl` longtext DEFAULT NULL,
  `invoiceFooter` text DEFAULT NULL,
  `defaultVatPercent` decimal(5,2) DEFAULT 0.00,
  `invoicePrintType` varchar(50) DEFAULT 'A4',
  `invoiceTemplate` varchar(50) DEFAULT 'MODERN_MINIMAL',
  `invoiceColorTheme` varchar(50) DEFAULT 'INDIGO_VIOLET',
  `invoiceCustomPrimaryColor` varchar(20) DEFAULT '#4F46E5',
  `invoiceCustomAccentColor` varchar(20) DEFAULT '#06B6D4',
  `dashboardColorTheme` varchar(50) DEFAULT 'INDIGO',
  `sidebarColorTheme` varchar(50) DEFAULT 'INDIGO',
  `sidebarCustomColor` varchar(20) DEFAULT '#4F46E5',
  `smsSenderId` varchar(100) DEFAULT NULL,
  `apiEndpoint` text DEFAULT NULL,
  `autoSyncEnabled` tinyint(1) DEFAULT 1,
  `autoSyncIntervalSeconds` int(11) DEFAULT 5,
  `productGenerics_json` longtext DEFAULT NULL,
  `productManufacturers_json` longtext DEFAULT NULL,
  `productUnits_json` longtext DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `username` varchar(100) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `fullName` varchar(150) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'CASHIER',
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `permissions_json` longtext DEFAULT NULL,
  `subPermissions_json` longtext DEFAULT NULL,
  `avatar` longtext DEFAULT NULL,
  `lastLogin` varchar(50) DEFAULT NULL,
  `lowStockEmailAlerts` tinyint(1) DEFAULT 0,
  `lowStockSmsAlerts` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(150) NOT NULL,
  `nameBn` varchar(150) DEFAULT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `icon` varchar(50) DEFAULT 'folder',
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `products`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `sku` varchar(100) NOT NULL UNIQUE,
  `barcode` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `nameBn` varchar(255) DEFAULT NULL,
  `medicine` varchar(255) DEFAULT NULL,
  `medicine_name` varchar(255) DEFAULT NULL,
  `categoryId` varchar(50) DEFAULT NULL,
  `categoryName` varchar(255) DEFAULT NULL,
  `purchasePrice` decimal(12,2) NOT NULL DEFAULT 0.00,
  `salesPrice` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discountType` varchar(50) DEFAULT 'flat',
  `expDate` varchar(50) DEFAULT NULL,
  `generic` varchar(255) DEFAULT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `dosageForm` varchar(100) DEFAULT NULL,
  `strength` varchar(100) DEFAULT NULL,
  `rackLocation` varchar(100) DEFAULT NULL,
  `stripSize` int(11) DEFAULT NULL,
  `diseases_json` longtext DEFAULT NULL,
  `dosageSchedule` varchar(255) DEFAULT NULL,
  `mealTiming` varchar(255) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `precautions` text DEFAULT NULL,
  `reorderLevel` decimal(12,2) NOT NULL DEFAULT 5.00,
  `stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `unit` varchar(50) DEFAULT 'Pcs',
  `batchNumber` varchar(100) DEFAULT NULL,
  `batches_json` longtext DEFAULT NULL,
  `image` longtext DEFAULT NULL,
  `imageUrl` longtext DEFAULT NULL,
  `description` text DEFAULT NULL,
  `hasWarranty` tinyint(1) DEFAULT 0,
  `warrantyDuration` int(11) DEFAULT NULL,
  `warrantyUnit` varchar(50) DEFAULT NULL,
  `warrantyType` varchar(50) DEFAULT NULL,
  `warrantyTerms` text DEFAULT NULL,
  `requiresSerialNo` tinyint(1) DEFAULT 0,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `medicines`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `medicines`;
CREATE TABLE `medicines` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `medicine` varchar(255) NOT NULL,
  `medicine_name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `generic` varchar(255) DEFAULT NULL,
  `brand` varchar(255) DEFAULT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `strength` varchar(100) DEFAULT NULL,
  `dosage_form` varchar(100) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `purchase_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sales_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `unit` varchar(50) DEFAULT 'Pcs',
  `exp_date` varchar(50) DEFAULT NULL,
  `batch_no` varchar(100) DEFAULT NULL,
  `rack_location` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `disease_categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `disease_categories`;
CREATE TABLE `disease_categories` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(150) NOT NULL,
  `nameBn` varchar(150) NOT NULL,
  `isDefault` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `disease_master`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `disease_master`;
CREATE TABLE `disease_master` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `diseaseName` varchar(255) NOT NULL,
  `diseaseNameBn` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `categoryBn` varchar(100) DEFAULT NULL,
  `symptoms_json` longtext DEFAULT NULL,
  `description` text DEFAULT NULL,
  `recommendedMedicines_json` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `parties` (Customers & Suppliers)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `parties`;
CREATE TABLE `parties` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `serialNumber` varchar(50) DEFAULT NULL,
  `type` enum('CUSTOMER','SUPPLIER') NOT NULL DEFAULT 'CUSTOMER',
  `name` varchar(200) NOT NULL,
  `nameBn` varchar(200) DEFAULT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `companyName` varchar(200) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `openingBalance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currentBalance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `creditLimit` decimal(12,2) DEFAULT 0.00,
  `status` varchar(50) DEFAULT 'ACTIVE',
  `taxNumber` varchar(100) DEFAULT NULL,
  `bankDetails` text DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `wallets` (Payment Accounts)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `wallets`;
CREATE TABLE `wallets` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(100) NOT NULL,
  `nameBn` varchar(100) DEFAULT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'CASH',
  `accountNumber` varchar(100) DEFAULT NULL,
  `bankName` varchar(150) DEFAULT NULL,
  `branch` varchar(150) DEFAULT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `isActive` tinyint(1) DEFAULT 1,
  `colorCode` varchar(50) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `sales_invoices`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sales_invoices`;
CREATE TABLE `sales_invoices` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `invoiceNumber` varchar(100) NOT NULL UNIQUE,
  `date` varchar(50) NOT NULL,
  `customerId` varchar(50) DEFAULT NULL,
  `customerName` varchar(200) DEFAULT NULL,
  `customerPhone` varchar(50) DEFAULT NULL,
  `customerAddress` text DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discountType` varchar(50) DEFAULT 'flat',
  `vatAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paidAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `dueAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paymentMethod` varchar(50) DEFAULT 'CASH',
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'PAID',
  `notes` text DEFAULT NULL,
  `cashierName` varchar(150) DEFAULT NULL,
  `isInstallmentSale` tinyint(1) DEFAULT 0,
  `installmentPlanId` varchar(50) DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `sales_returns`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sales_returns`;
CREATE TABLE `sales_returns` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `returnNumber` varchar(100) NOT NULL UNIQUE,
  `originalInvoiceNumber` varchar(100) NOT NULL,
  `invoiceId` varchar(50) NOT NULL,
  `date` varchar(50) NOT NULL,
  `customerId` varchar(50) DEFAULT NULL,
  `customerName` varchar(200) DEFAULT NULL,
  `totalRefund` decimal(12,2) NOT NULL DEFAULT 0.00,
  `refundWalletId` varchar(50) DEFAULT NULL,
  `refundWalletName` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `quotations` (Price Quotes)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `quotations`;
CREATE TABLE `quotations` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `quotationNumber` varchar(100) NOT NULL UNIQUE,
  `date` varchar(50) NOT NULL,
  `validUntil` varchar(50) DEFAULT NULL,
  `customerId` varchar(50) DEFAULT NULL,
  `customerName` varchar(200) DEFAULT NULL,
  `customerPhone` varchar(50) DEFAULT NULL,
  `customerAddress` text DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discountType` varchar(50) DEFAULT 'flat',
  `vatAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) DEFAULT 'DRAFT',
  `salesPerson` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `sales_orders`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sales_orders`;
CREATE TABLE `sales_orders` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `orderNumber` varchar(100) NOT NULL UNIQUE,
  `date` varchar(50) NOT NULL,
  `deliveryDate` varchar(50) DEFAULT NULL,
  `customerId` varchar(50) NOT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(50) NOT NULL,
  `customerAddress` text DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discountType` varchar(50) DEFAULT 'flat',
  `taxAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'PENDING',
  `notes` text DEFAULT NULL,
  `walletId` varchar(50) DEFAULT NULL,
  `paidAmount` decimal(12,2) DEFAULT 0.00,
  `createdBy` varchar(100) DEFAULT NULL,
  `convertedSaleInvoiceId` varchar(50) DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdAt` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `purchase_invoices`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `purchase_invoices`;
CREATE TABLE `purchase_invoices` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `billNumber` varchar(100) NOT NULL UNIQUE,
  `supplierInvoiceNo` varchar(100) DEFAULT NULL,
  `date` varchar(50) NOT NULL,
  `supplierId` varchar(50) DEFAULT NULL,
  `supplierName` varchar(200) DEFAULT NULL,
  `supplierPhone` varchar(50) DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `taxAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grandTotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paidAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `dueAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paymentMethod` varchar(50) DEFAULT 'CASH',
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'PAID',
  `notes` text DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `purchase_returns`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `purchase_returns`;
CREATE TABLE `purchase_returns` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `returnNumber` varchar(100) NOT NULL UNIQUE,
  `originalBillNumber` varchar(100) NOT NULL,
  `purchaseId` varchar(50) NOT NULL,
  `date` varchar(50) NOT NULL,
  `supplierId` varchar(50) DEFAULT NULL,
  `supplierName` varchar(200) DEFAULT NULL,
  `totalAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `refundWalletId` varchar(50) DEFAULT NULL,
  `refundWalletName` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `purchase_orders` (PO)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `poNumber` varchar(100) NOT NULL UNIQUE,
  `supplierId` varchar(50) DEFAULT NULL,
  `supplierName` varchar(200) DEFAULT NULL,
  `supplierPhone` varchar(50) DEFAULT NULL,
  `date` varchar(50) NOT NULL,
  `expectedDeliveryDate` varchar(50) DEFAULT NULL,
  `totalAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) DEFAULT 'PENDING',
  `notes` text DEFAULT NULL,
  `items_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `deleted_sales_invoices`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `deleted_sales_invoices`;
CREATE TABLE `deleted_sales_invoices` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `invoiceNumber` varchar(100) DEFAULT NULL,
  `deletedAt` varchar(50) DEFAULT NULL,
  `deletedBy` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `originalInvoice_json` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `installment_schemes` (EMI/Kisti)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `installment_schemes`;
CREATE TABLE `installment_schemes` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `schemeNumber` varchar(100) NOT NULL UNIQUE,
  `customerId` varchar(50) NOT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(50) NOT NULL,
  `invoiceId` varchar(50) DEFAULT NULL,
  `invoiceNumber` varchar(100) DEFAULT NULL,
  `productName` varchar(255) NOT NULL,
  `totalPrice` decimal(12,2) NOT NULL DEFAULT 0.00,
  `downPayment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `principalAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `interestRate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `interestAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalPayable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalInstallments` int(11) NOT NULL DEFAULT 6,
  `frequency` varchar(50) DEFAULT 'MONTHLY',
  `emiAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `startDate` varchar(50) NOT NULL,
  `status` varchar(50) DEFAULT 'ACTIVE',
  `guarantorName` varchar(150) DEFAULT NULL,
  `guarantorPhone` varchar(50) DEFAULT NULL,
  `guarantorNid` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `schedules_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `expense_categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `expense_categories`;
CREATE TABLE `expense_categories` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(150) NOT NULL,
  `nameBn` varchar(150) DEFAULT NULL,
  `code` varchar(50) NOT NULL UNIQUE,
  `description` text DEFAULT NULL,
  `budgetMonthly` decimal(12,2) DEFAULT 0.00,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `expense_vouchers`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `expense_vouchers`;
CREATE TABLE `expense_vouchers` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `voucherNo` varchar(100) NOT NULL,
  `date` varchar(50) NOT NULL,
  `categoryId` varchar(50) NOT NULL,
  `categoryName` varchar(150) NOT NULL,
  `category` varchar(150) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(100) DEFAULT NULL,
  `payee` varchar(150) DEFAULT NULL,
  `receiptNo` varchar(100) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `employees` (HR & Payroll)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `employeeCode` varchar(50) NOT NULL UNIQUE,
  `name` varchar(150) NOT NULL,
  `nameBn` varchar(150) DEFAULT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `designation` varchar(100) NOT NULL,
  `department` varchar(100) NOT NULL,
  `joiningDate` varchar(50) DEFAULT NULL,
  `baseSalary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `houseRentAllowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `medicalAllowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `conveyanceAllowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) DEFAULT 'ACTIVE',
  `bankAccount` varchar(100) DEFAULT NULL,
  `nid` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `resignedDate` varchar(50) DEFAULT NULL,
  `resignationReason` text DEFAULT NULL,
  `settlementNotes` text DEFAULT NULL,
  `finalSettlementAmount` decimal(12,2) DEFAULT 0.00,
  `finalSettlementPaid` tinyint(1) DEFAULT 0,
  `settlementWalletId` varchar(50) DEFAULT NULL,
  `settlementWalletName` varchar(150) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `advance_salaries`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `advance_salaries`;
CREATE TABLE `advance_salaries` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `voucherNo` varchar(100) NOT NULL,
  `employeeId` varchar(50) NOT NULL,
  `employeeName` varchar(150) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `date` varchar(50) NOT NULL,
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `isDeducted` tinyint(1) NOT NULL DEFAULT 0,
  `deductedInPayrollMonth` varchar(50) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `payroll_history`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `payroll_history`;
CREATE TABLE `payroll_history` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `payrollMonth` varchar(50) NOT NULL,
  `employeeId` varchar(50) NOT NULL,
  `employeeName` varchar(150) NOT NULL,
  `employeeCode` varchar(50) NOT NULL,
  `designation` varchar(100) NOT NULL,
  `baseSalary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `allowances` decimal(12,2) NOT NULL DEFAULT 0.00,
  `bonus` decimal(12,2) NOT NULL DEFAULT 0.00,
  `advanceDeduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fineDeduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grossPay` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payableAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paidAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `dueAmount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalPaidSoFar` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paymentType` varchar(50) DEFAULT NULL,
  `installmentNo` int(11) DEFAULT 1,
  `notes` text DEFAULT NULL,
  `netPay` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paymentDate` varchar(50) NOT NULL,
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'PAID',
  `voucherNo` varchar(100) NOT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `daybook_entries`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `daybook_entries`;
CREATE TABLE `daybook_entries` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `voucherNo` varchar(100) NOT NULL,
  `date` varchar(50) NOT NULL,
  `type` varchar(50) NOT NULL,
  `flow` varchar(10) NOT NULL,
  `partyId` varchar(50) DEFAULT NULL,
  `partyName` varchar(200) DEFAULT NULL,
  `partyType` varchar(50) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `walletId` varchar(50) DEFAULT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `referenceId` varchar(50) DEFAULT NULL,
  `referenceNo` varchar(100) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `cash_adjustments`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `cash_adjustments`;
CREATE TABLE `cash_adjustments` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `voucherNo` varchar(100) NOT NULL,
  `date` varchar(50) NOT NULL,
  `type` varchar(50) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `walletId` varchar(50) NOT NULL,
  `walletName` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `authorizedBy` varchar(100) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `created_at` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `expired_return_logs`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `expired_return_logs`;
CREATE TABLE `expired_return_logs` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `date` varchar(50) NOT NULL,
  `productId` varchar(50) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `unit` varchar(50) DEFAULT 'Pcs',
  `quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `purchasePrice` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalValue` decimal(12,2) NOT NULL DEFAULT 0.00,
  `actionType` varchar(50) NOT NULL,
  `notes` text DEFAULT NULL,
  `batchNumber` varchar(100) DEFAULT NULL,
  `purchaseInvoiceNo` varchar(100) DEFAULT NULL,
  `expDate` varchar(50) DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `activity_logs`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `timestamp` varchar(50) NOT NULL,
  `userId` varchar(50) DEFAULT NULL,
  `userName` varchar(150) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(100) NOT NULL,
  `details` text DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `metadata_json` longtext DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `sms_config`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sms_config`;
CREATE TABLE `sms_config` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `provider` varchar(100) NOT NULL,
  `apiUrl` text DEFAULT NULL,
  `apiKey` text DEFAULT NULL,
  `senderId` varchar(100) DEFAULT NULL,
  `username` varchar(150) DEFAULT NULL,
  `password` varchar(150) DEFAULT NULL,
  `clientId` varchar(150) DEFAULT NULL,
  `httpMethod` varchar(20) DEFAULT 'GET',
  `requestFormat` varchar(50) DEFAULT 'json',
  `customProviders_json` longtext DEFAULT NULL,
  `customToParam` varchar(100) DEFAULT NULL,
  `customMsgParam` varchar(100) DEFAULT NULL,
  `customKeyParam` varchar(100) DEFAULT NULL,
  `customSenderParam` varchar(100) DEFAULT NULL,
  `customUserParam` varchar(100) DEFAULT NULL,
  `customPassParam` varchar(100) DEFAULT NULL,
  `customHeaders` text DEFAULT NULL,
  `autoSendOnSale` tinyint(1) DEFAULT 1,
  `autoSendOnPaymentIn` tinyint(1) DEFAULT 1,
  `autoSendOnInstallmentReminder` tinyint(1) DEFAULT 1,
  `autoSendOnWarrantyResolved` tinyint(1) DEFAULT 1,
  `saleTemplate` text DEFAULT NULL,
  `paymentInTemplate` text DEFAULT NULL,
  `dueReminderTemplate` text DEFAULT NULL,
  `warrantyResolvedTemplate` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `sms_logs`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sms_logs`;
CREATE TABLE `sms_logs` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `recipientPhone` varchar(50) NOT NULL,
  `recipientName` varchar(150) DEFAULT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL,
  `status` varchar(50) NOT NULL,
  `responseDetails` text DEFAULT NULL,
  `date` varchar(50) NOT NULL,
  `time` varchar(50) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `warranty_policies`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `warranty_policies`;
CREATE TABLE `warranty_policies` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `name` varchar(150) NOT NULL,
  `nameBn` varchar(150) DEFAULT NULL,
  `duration` int(11) NOT NULL DEFAULT 1,
  `durationUnit` varchar(50) NOT NULL DEFAULT 'MONTHS',
  `terms` text DEFAULT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'REPAIR',
  `isDefault` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `warranty_records`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `warranty_records`;
CREATE TABLE `warranty_records` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `warrantyCode` varchar(100) NOT NULL UNIQUE,
  `invoiceId` varchar(50) NOT NULL,
  `invoiceNumber` varchar(100) NOT NULL,
  `saleDate` varchar(50) NOT NULL,
  `productId` varchar(50) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `serialNumber` varchar(100) NOT NULL,
  `customerId` varchar(50) NOT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(50) NOT NULL,
  `warrantyType` varchar(50) NOT NULL,
  `duration` int(11) NOT NULL DEFAULT 12,
  `durationUnit` varchar(50) NOT NULL DEFAULT 'MONTHS',
  `startDate` varchar(50) NOT NULL,
  `expiryDate` varchar(50) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'ACTIVE',
  `terms` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `createdAt` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `warranty_claims`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `warranty_claims`;
CREATE TABLE `warranty_claims` (
  `id` varchar(50) NOT NULL PRIMARY KEY,
  `claimTicketNo` varchar(100) NOT NULL UNIQUE,
  `warrantyRecordId` varchar(50) DEFAULT NULL,
  `invoiceNumber` varchar(100) NOT NULL,
  `productId` varchar(50) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `serialNumber` varchar(100) NOT NULL,
  `customerId` varchar(50) NOT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(50) NOT NULL,
  `issueDescription` text NOT NULL,
  `physicalCondition` text DEFAULT NULL,
  `claimDate` varchar(50) NOT NULL,
  `expectedReturnDate` varchar(50) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'RECEIVED',
  `claimType` varchar(50) NOT NULL DEFAULT 'REPAIR',
  `repairCost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `customerCharge` decimal(12,2) NOT NULL DEFAULT 0.00,
  `replacementSerialNumber` varchar(100) DEFAULT NULL,
  `supplierId` varchar(50) DEFAULT NULL,
  `supplierName` varchar(200) DEFAULT NULL,
  `technicianNotes` text DEFAULT NULL,
  `actionsHistory_json` longtext DEFAULT NULL,
  `createdBy` varchar(100) DEFAULT NULL,
  `createdAt` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Dumping data for table `company_settings`
INSERT INTO `company_settings` (`id`, `name`, `nameBn`, `slogan`, `phone`, `email`, `website`, `address`, `taxNumber`, `currencySymbol`, `currencyCode`, `logoUrl`, `signatureUrl`, `invoiceFooter`, `defaultVatPercent`, `invoicePrintType`, `invoiceTemplate`, `invoiceColorTheme`, `invoiceCustomPrimaryColor`, `invoiceCustomAccentColor`, `dashboardColorTheme`, `sidebarColorTheme`, `sidebarCustomColor`, `smsSenderId`, `apiEndpoint`, `autoSyncEnabled`, `autoSyncIntervalSeconds`, `productGenerics_json`, `productManufacturers_json`, `productUnits_json`) VALUES (
  'main_company',
  'Silva Electronics & IT',
  'সিলভা ইলেকট্রনিক্স অ্যান্ড আইটি',
  'Quality Products at the Best Price',
  '+880 1711-234567 / +880 1812-987654',
  'silvait2000@gmail.com',
  'www.dokanprobd.com',
  'Mosjid Market, Chandana-1702, Bason. Gazipur',
  'BIN-002948192-0102',
  '৳',
  'BDT',
  'https://i.postimg.cc/Twh0KBbL/logo-(1).jpg',
  '',
  'Thank you for shopping with us! Warranty claims require original invoice within 7 days. • আমাদের সাথে থাকার জন্য ধন্যবাদ।',
  0,
  'A4',
  'COMPACT_BILL',
  'INDIGO_VIOLET',
  '#6366f1',
  '#4f46e5',
  'INDIGO',
  'INDIGO',
  '#4F46E5',
  'SILVAIT',
  '',
  1,
  30,
  '[]',
  '[]',
  '["Pcs","CTN","Kg","Ltr","Box","Pack","Dozen","Meter","Bag"]'
);

-- Dumping data for table `users` (1 records)
INSERT INTO `users` (`id`, `username`, `password`, `fullName`, `role`, `email`, `phone`, `isActive`, `permissions_json`, `subPermissions_json`, `avatar`, `lastLogin`, `lowStockEmailAlerts`, `lowStockSmsAlerts`) VALUES
  ('usr-1', 'admin', '123', 'System Administrator (অ্যাডমিন)', 'ADMIN', 'silvait2000@gmail.com', '01711-234567', 1, '["ALL"]', '[]', '', '', 1, 1);

-- Dumping data for table `disease_categories` (11 records)
INSERT INTO `disease_categories` (`id`, `name`, `nameBn`, `isDefault`) VALUES
  ('ALL', 'সকল রোগ (All Diseases)', 'সকল রোগ', 1),
  ('General & Pain', 'জ্বর ও ব্যথা (Fever & Pain)', 'জ্বর ও সাধারণ ব্যথা', 1),
  ('Gastrointestinal', 'গ্যাস্ট্রিক ও পেট (Gastric & Stomach)', 'গ্যাস্ট্রিক ও পরিপakতন্ত্র', 1),
  ('Respiratory', 'সর্দি ও কাশি (Cold & Cough)', 'শ্বাসতন্ত্র ও কাশি', 1),
  ('Dermatology & Allergy', 'অ্যালার্জি ও চর্ম (Allergy & Skin)', 'অ্যালার্জি ও চুলকানি', 1),
  ('ENT (Ear, Nose, Throat)', 'নাক, কান ও গলা (ENT)', 'নাক, কান ও গলা', 1),
  ('Dental Care', 'দাঁত ও মাড়ি (Dental)', 'দাঁত ও মাড়ির যত্ন', 1),
  ('Cardiovascular', 'উচ্চ রক্তচাপ (Blood Pressure)', 'হৃদরোগ ও রক্তচাপ', 1),
  ('Endocrinology', 'ডায়াবেটিস (Diabetes)', 'ডায়াবেটিস', 1),
  ('Urology', 'প্রস্রাব ও কিডনি (UTI)', 'মূত্রনালী ও কিডনি', 1),
  ('Supplements & Nutrition', 'ভিটামিন ও পুষ্টি (Supplements)', 'পুষ্টি ও দুর্বলতা', 1);

-- Dumping data for table `disease_master` (50 records)
INSERT INTO `disease_master` (`id`, `diseaseName`, `diseaseNameBn`, `category`, `categoryBn`, `symptoms_json`, `description`, `recommendedMedicines_json`) VALUES
  ('dis-1', 'Fever & Body Ache', 'জ্বর, গায়ে ব্যথা ও তাপমাত্রা বৃদ্ধি', 'General & Pain', 'সাধারণ রোগ ও ব্যথা', '["উচ্চ তাপমাত্রা","শরীর ব্যথা","মাথাব্যথা","শীত ভাব","ক্লান্তি"]', 'সাধারণ জ্বর, ভাইরাল জ্বর ও শারীরিক ব্যথার জন্য নির্ধারিত নির্দেশিকা।', '[{"medicineName":"Napa Extra / Ace Plus","genericName":"Paracetamol + Caffeine","dosageForm":"Tablet","strength":"500mg + 65mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর (ভরা পেটে)","duration":"৩ - ৫ দিন","instructions":"জ্বর ১০০.৫° বা তার বেশি হলে বা গায়ে তীব্র ব্যথা থাকলে খাবেন। প্রতি ৬-৮ ঘণ্টা পরপর সর্বোচ্চ ৪ বার।","precautions":"খালি পেটে খাওয়া নিষেধ। লিভারের গুরুতর সমস্যা থাকলে চিকিৎসকের পরামর্শ নিন।"},{"medicineName":"Napa 500mg / Fast 500","genericName":"Paracetamol","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ১ + ১ + ১ (দিনে ৩-৪ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৩ দিন","instructions":"স্বাভাবিক জ্বর ও ব্যথায় প্রতি ৬ ঘণ্টা অন্তর ১টি করে ট্যাবলেট।","precautions":"দৈনিক সর্বোচ্চ ৪ গ্রামের (৮টি ট্যাবলেট) বেশি গ্রহণ করবেন না।"},{"medicineName":"Napa Syrup / Ace Syrup","genericName":"Paracetamol","dosageForm":"Syrup","strength":"120mg / 5ml","dosageSchedule":"১ - ২ চা চামচ (দিনে ৩-৪ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৩ দিন","instructions":"শিশুদের ক্ষেত্রে ওজনের উপর ভিত্তি করে (১০-১৫ মিগ্রা/কেজি) প্রতি ৬-৮ ঘণ্টা পরপর।","precautions":"শিশুর তাপমাত্রা মাপুন এবং মাথায় ভেজা জলপট্টি ব্যবহার করুন।"}]'),
  ('dis-2', 'Gastric, Acidity & Heartburn', 'গ্যাস্ট্রিক, বুক জ্বালা, বদহজম ও অম্বল', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["বুক জ্বালাপোড়া","পেটের উপরিভাগে তীব্র ব্যথা","টক ঢেকুর","গ্যাস জমা","বমি ভাব"]', 'অতিরিক্ত এসিডিটি, পেপটিক আলসার ও বুক জ্বালা নিরাময়ের জন্য ঔষধ।', '[{"medicineName":"Seclo 20 / Losectil 20","genericName":"Omeprazole","dosageForm":"Capsule","strength":"20mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার ৩০ মিনিট আগে (খালি পেটে)","duration":"১৪ দিন","instructions":"সকালে ঘুম থেকে উঠে খালি পেটে এক গ্লাস পানিসহ ১টি এবং রাতে খাবারের ৩০ মিনিট পূর্বে ১টি।","precautions":"ক্যাপসুল চিবানো যাবে না, গিলে খেতে হবে।"},{"medicineName":"Maxpro 20 / Nexum 20","genericName":"Esomeprazole","dosageForm":"Tablet","strength":"20mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার ৩০ মিনিট আগে (খালি পেটে)","duration":"১৪ দিন","instructions":"তীব্র গ্যাস্ট্রিক ও বুক জ্বালাপোড়ায় অত্যন্ত কার্যকর। সকালে ও রাতে খাবারের আগে।","precautions":"তৈলাক্ত ও অতিরিক্ত মশলাযুক্ত খাবার পরিহার করুন।"},{"medicineName":"Entacyd Plus / Marlox Plus","genericName":"Aluminium Hydroxide + Magnesium Hydroxide + Simethicone","dosageForm":"Suspension","strength":"200ml","dosageSchedule":"২ চা চামচ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার ১ ঘণ্টা পর অথবা ঘুমানোর আগে","duration":"প্রয়োজন অনুযায়ী (লক্ষণ দেখা দিলে)","instructions":"হঠাৎ বুক বা পেট জ্বালা করলে দ্রুত উপশমের জন্য সেবন করুন। খাওয়ার আগে বোতলটি ভালো করে ঝাঁকিয়ে নিন।","precautions":"অন্যান্য ঔষধের সাথে অন্তত ২ ঘণ্টার ব্যবধান রাখুন।"}]'),
  ('dis-3', 'Common Cold, Flu & Runny Nose', 'সর্দি, নাক বন্ধ, হাঁচি ও ফ্লু', 'Respiratory', 'শ্বাসতন্ত্র ও ফুসফুস', '["নাক দিয়ে পানি পড়া","ঘন ঘন হাঁচি","নাক বন্ধ","মাথা ভারী হয়ে থাকা","চোখ দিয়ে পানি পড়া"]', 'মৌসুমি সর্দি, অ্যালার্জিক রাইনাইটিস ও ফ্লুর জন্য নির্দেশিত ঔষধ।', '[{"medicineName":"Fexo 120 / Fexofen 120","genericName":"Fexofenadine Hydrochloride","dosageForm":"Tablet","strength":"120mg","dosageSchedule":"১ + ০ + ০ অথবা ০ + ০ + ১ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর","duration":"৫ - ৭ দিন","instructions":"অ্যালার্জি, হাঁচি ও নাক দিয়ে পানি পড়ার জন্য দিনে ১টি ট্যাবলেট। এটি সাধারণত ঘুম বা ঝিমুনি তৈরি করে না।","precautions":"কমলা বা আঙ্গুরের জুসের সাথে খাবেন না (অন্তত ২ ঘণ্টা ব্যবধানে খাবেন)।"},{"medicineName":"Alatrol / Cetriz","genericName":"Cetirizine Hydrochloride","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর আগে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (রাতে)","duration":"৫ দিন","instructions":"তীব্র সর্দি ও এলার্জির জন্য রাতে ঘুমানোর পূর্বে ১টি।","precautions":"হালকা ঘুম বা ঝিমুনি আসতে পারে, তাই গাড়ি বা যন্ত্রপাতি চালানোর সময় সতর্কতা অবলম্বন করুন।"},{"medicineName":"Afrin / Antazol Nasal Drop","genericName":"Oxymetazoline / Xylometazoline","dosageForm":"Nasal Drop","strength":"0.05% (10ml)","dosageSchedule":"২-৩ ফোঁটা করে প্রতি নাকে (দিনে ২-৩ বার)","frequencyPerDay":3,"mealTiming":"প্রয়োজনমতো","duration":"সর্বোচ্চ ৩ - ৫ দিন","instructions":"নাক বন্ধ থাকলে প্রতি নাসারন্ধ্রে ২-৩ ফোঁটা দিয়ে কিছুক্ষণ মাথা পেছনে কাত করে রাখুন।","precautions":"টানা ৫ দিনের বেশি ব্যবহার করবেন না, অন্যথায় পুনরায় নাক বন্ধের সমস্যা হতে পারে।"}]'),
  ('dis-4', 'Cough, Mucus & Chest Congestion', 'কাশি, কফ জমা ও বুকের খাঁচায় শ্লেষ্মা', 'Respiratory', 'শ্বাসতন্ত্র ও ফুসফুস', '["শুকনো কাশি","কফযুক্ত কাশি","বুকে ঘড়ঘড় শব্দ","গলায় খুশখুশ","রাতের কাশি"]', 'শুকনো কাশি ও কফযুক্ত কাশির জন্য প্রয়োজনীয় সিরাপ ও ঔষধ।', '[{"medicineName":"Tusca Syrup / Adryll Syrup","genericName":"Dextromethorphan + Pseudoephedrine + Guaiphenesin","dosageForm":"Syrup","strength":"100ml","dosageSchedule":"২ চা চামচ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৫ - ৭ দিন","instructions":"শুকনো খকখকে কাশি ও কাশির কারণে গলায় অস্বস্তির জন্য কুসুম গরম পানির সাথে সেব্য।","precautions":"ডায়াবেটিস রোগীদের জন্য সুগার-ফ্রি সিরাপ গ্রহণ করা উচিত।"},{"medicineName":"Mucopel / Brofex / Ascoril","genericName":"Ambroxol / Bromhexine","dosageForm":"Syrup","strength":"100ml","dosageSchedule":"২ চা চামচ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৫ - ৭ দিন","instructions":"বুকে জমাট বাঁধা কফ তরল করে সহজে বের করার জন্য। প্রচুর পরিমাণে হালকা কুসুম গরম পানি পান করুন।","precautions":"গর্ভাবস্থার প্রথম ৩ মাস চিকিৎসকের অনুমতি ছাড়া সেবন অনুচিত।"},{"medicineName":"Monas 10 / Montene 10","genericName":"Montelukast Sodium","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর আগে)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (রাতে)","duration":"১৫ - ৩০ দিন","instructions":"অ্যালার্জিক কাশি ও শ্বাসকষ্ট কমাতে প্রতিদিন রাতে ঘুমানোর পূর্বে ১টি করে ট্যাবলেট।","precautions":"নিয়মিত নির্দিষ্ট সময়ে সেবন করা সর্বোত্তম।"}]'),
  ('dis-5', 'Diarrhea, Dysentery & Loose Motion', 'ডায়রিয়া, পাতলা পায়খানা ও আমাশয়', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["ঘন ঘন পাতলা পায়খানা","পেট কামড়ানো","শরীরে পানিশূন্যতা","পেটের মোচড়","দুর্বলতা"]', 'ডায়রিয়া, কলেরা ও ব্যাকটেরিয়াজনিত আমাশয়ের তাৎক্ষণিক চিকিৎসা ও সেবনবিধি।', '[{"medicineName":"ORSaline-N (খাবার স্যালাইন)","genericName":"Oral Rehydration Salt (ORS)","dosageForm":"Powder / Sachet","strength":"500ml Solution","dosageSchedule":"প্রতিবার পায়খানার পর ১ গ্লাস (দিনে ৫-৮ বার)","frequencyPerDay":6,"mealTiming":"পায়খানার পরপরই","duration":"যতক্ষণ পাতলা পায়খানা থাকে","instructions":"আধালিটার (৫০০ মিলি) ফুটানো ঠাণ্ডা পানিতে সম্পূর্ণ প্যাকেট মিশিয়ে তৈরি করতে হবে। প্রতিবার পাতলা পায়খানার পর ১ গ্লাস করে পান করুন।","precautions":"স্যালাইন ১২ ঘণ্টার বেশি পুরনো রাখা যাবে না। কখনো গরম পানিতে স্যালাইন মেশাবেন না।"},{"medicineName":"Flagyl 400 / Amodis 400","genericName":"Metronidazole","dosageForm":"Tablet","strength":"400mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর (ভরা পেটে)","duration":"৫ দিন","instructions":"অ্যামিবিক আমাশয় ও ডায়রিয়ার ব্যাকটেরিয়া ধ্বংস করতে দিনে ৩ বার খাবারের পর। কোর্স পূর্ণ করুন।","precautions":"খালি পেটে খাবেন না। মুখে ধাতব স্বাদ লাগতে পারে যা স্বাভাবিক।"},{"medicineName":"Ciprocin 500 / Neofloxin 500","genericName":"Ciprofloxacin","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"৫ দিন","instructions":"তীব্র ডায়রিয়া ও ব্যাক্টেরিয়াল ইনফেকশনের জন্য প্রতি ১২ ঘণ্টা পর পর ১টি। প্রচুর পানি পান করুন।","precautions":"অ্যান্টাসিড বা দুধ জাতীয় খাবারের সাথে অন্তত ২ ঘণ্টার ব্যবধান রাখুন।"},{"medicineName":"Imotil / Lomotil","genericName":"Loperamide Hydrochloride","dosageForm":"Capsule","strength":"2mg","dosageSchedule":"প্রথমে ২টি, পরবর্তীতে প্রতিবার পাতলা পায়খানার পর ১টি (সর্বোচ্চ দিনে ৪টি)","frequencyPerDay":2,"mealTiming":"প্রয়োজন অনুযায়ী","duration":"১ - ২ দিন","instructions":"জরুরি প্রয়োজনে পাতলা পায়খানার গতি কমাতে।","precautions":"রক্ত আমাশয় বা তীব্র জ্বরের সাথে ডায়রিয়া থাকলে এটি খাওয়া নিষেধ।"}]'),
  ('dis-6', 'Headache & Migraine', 'মাথাব্যথা, মাইগ্রেন ও টেনশন হেডেক', 'Neurological & Pain', 'স্নায়ু ও ব্যথা', '["মাথার একপাশে দপদপ করা ব্যথা","চোখে আলোর অস্বস্তি","বমি বমি ভাব","ঘাড় ও মাথার পেছনে টান"]', 'সাধারণ মাথাব্যথা ও মাইগ্রেনের তীব্র যন্ত্রণা দূর করার জন্য নির্দেশিকা।', '[{"medicineName":"Napa Extra / Ace Plus","genericName":"Paracetamol + Caffeine","dosageForm":"Tablet","strength":"500mg + 65mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"২ - ৩ দিন","instructions":"মাথাব্যথা শুরু হলে ১টি ট্যাবলেট ১ গ্লাস পানিসহ খাবেন। ক্যাফেইন দ্রুত মাথাব্যথা প্রশমন করে।","precautions":"খালি পেটে খাবেন না। দিনে ৩টির বেশি না খাওয়াই ভালো।"},{"medicineName":"Migrex / Triptan / Nomigrain","genericName":"Flunarizine / Zolmitriptan","dosageForm":"Tablet","strength":"5mg / 10mg","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর আগে)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর","duration":"চিকিৎসকের পরামর্শ অনুযায়ী (১৫-৩০ দিন)","instructions":"মাইগ্রেন প্রতিরোধক হিসেবে প্রতিদিন রাতে ১টি ট্যাবলেট।","precautions":"দিনের বেলা ঘুম ঘুম ভাব হতে পারে।"},{"medicineName":"Tolfen / Dolo 200","genericName":"Tolfenamic Acid","dosageForm":"Tablet","strength":"200mg","dosageSchedule":"১ + ০ + ১ (প্রয়োজনে দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"ভরা পেটে (খাবারের পর)","duration":"তীব্র ব্যথার সময় ১-২ দিন","instructions":"তীব্র মাইগ্রেন বা আধকপালি মাথাব্যথা শুরু হওয়ামাত্র ভরা পেটে ১টি খাবেন। সাথে গ্যাস্ট্রিকের ঔষধ খাওয়া ভালো।","precautions":"গ্যাস্ট্রিক বা আলসারের রোগীদের সতর্কতার সাথে গ্রহণ করতে হবে।"}]'),
  ('dis-7', 'Vomiting & Nausea', 'বমি, বমি ভাব ও মোশন সিকনেস', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["খাবার খেতে না পারা","ঘন ঘন বমি হওয়া","মাথা ঘোরা","পেটে অস্বস্তি","গাড়িতে উঠলে বমি"]', 'খাদ্যে বিষক্রিয়া, জার্নি সিকনেস বা পেটের সমস্যায় বমি প্রতিরোধের ঔষধ।', '[{"medicineName":"Emistat 8 / Onset 8 / Vomisil","genericName":"Ondansetron","dosageForm":"Tablet","strength":"8mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার ৩০ মিনিট আগে","duration":"২ - ৩ দিন","instructions":"তীব্র বমি বন্ধে অত্যন্ত কার্যকর। সকালে ও রাতে খাবারের আধা ঘণ্টা আগে ১টি করে।","precautions":"বমি বন্ধ হলে বন্ধ করে দিন। দীর্ঘমেয়াদে প্রয়োজন নেই।"},{"medicineName":"Motigut / Omidon / Domperidone","genericName":"Domperidone","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার ১৫-৩০ মিনিট আগে","duration":"৩ - ৫ দিন","instructions":"বমি বমি ভাব, পেট ফাঁপা ও ক্ষুধামন্দায় খাবারের আগে ১টি করে ট্যাবলেট।","precautions":"হৃদরোগের রোগীদের ক্ষেত্রে অতিরিক্ত ডোজ পরিহার্য।"},{"medicineName":"Joytrip / Gravol","genericName":"Meclizine + Pyridoxine","dosageForm":"Tablet","strength":"25mg + 50mg","dosageSchedule":"যাত্রার ৩০ মিনিট পূর্বে ১টি","frequencyPerDay":1,"mealTiming":"ভ্রমণ শুরুর ৩০-৬০ মিনিট আগে","duration":"প্রয়োজন অনুযায়ী","instructions":"বাস, ট্রেন, বা নৌযানে ভ্রমণের সময় বমি ও মাথা ঘোরা বন্ধ করতে।","precautions":"সেবনের পর হালকা তন্দ্রাভাব হতে পারে।"}]'),
  ('dis-8', 'Allergy, Itching & Skin Rash', 'অ্যালার্জি, চুলকানি, আমবাত ও একজিমা', 'Dermatology & Allergy', 'চর্ম ও অ্যালার্জি', '["ত্বকে তীব্র চুলকানি","লাল চাকা চাকা দাগ (আমবাত)","ফুসকুড়ি","চোখ-নাক চুলকানো"]', 'খাদ্য বা পরিবেশগত অ্যালার্জি ও চুলকানির লক্ষণ নিরোধক ঔষধ।', '[{"medicineName":"Bilatin 20 / Bilastin","genericName":"Bilastine","dosageForm":"Tablet","strength":"20mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার সকালে)","frequencyPerDay":1,"mealTiming":"খাওয়ার ১ ঘণ্টা পূর্বে অথবা খাবারের ২ ঘণ্টা পর (খালি পেটে)","duration":"৭ - ১৪ দিন","instructions":"তীব্র চুলকানি ও আমবাতের আধুনিক ঔষধ। এটিতে কোনো ঝিমুনি আসে না।","precautions":"ফলের রসের সাথে খাবেন না। খালি পেটে খেলে সবচেয়ে ভালো ফল পাওয়া যায়।"},{"medicineName":"Rupafin 10 / Rupatadine","genericName":"Rupatadine","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"০ + ০ + ১ (রাতে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (রাতে)","duration":"৭ দিন","instructions":"ক্রনিক চুলকানি ও অ্যালার্জিক রাইনাইটিসে রাতে ১টি করে ট্যাবলেট।","precautions":"হালকা ঘুম আসতে পারে।"},{"medicineName":"Betameson-N / Dermasol-N","genericName":"Betamethasone + Neomycin","dosageForm":"Ointment / Cream","strength":"15g Tube","dosageSchedule":"আক্রান্ত স্থানে হালকা করে দিনে ২ বার","frequencyPerDay":2,"mealTiming":"বাহ্যিক ব্যবহার","duration":"৫ - ৭ দিন","instructions":"চুলকানির স্থানে পাতলা প্রলেপ দিয়ে ঘষুন। ব্যবহারের আগে আক্রান্ত স্থান পরিষ্কার করে শুকিয়ে নিন।","precautions":"ক্ষতের ভেতরে বা চোখে লাগানো যাবে না। টানা ৭ দিনের বেশি ব্যবহার করবেন না।"}]'),
  ('dis-9', 'Sore Throat & Tonsillitis', 'গলা ব্যথা, ঢোক গিলতে কষ্ট ও টনসিলের প্রদাহ', 'ENT (Ear, Nose, Throat)', 'নাক, কান ও গলা', '["ঢোক গিলতে তীব্র ব্যথা","গলা শুকিয়ে থাকা","টনসিল ফুলে লাল হওয়া","হালকা জ্বর ও স্বরভঙ্গ"]', 'গলার ইনফেকশন, ফ্যারিঞ্জাইটিস ও টনসিলাইটিসের উপশম।', '[{"medicineName":"Azithrocin 500 / Zimax 500","genericName":"Azithromycin","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার ১ ঘণ্টা আগে অথবা খাবারের ২ ঘণ্টা পর","duration":"৩ - ৫ দিন","instructions":"ব্যাকটেরিয়াল গলা ব্যথা ও টনসিলের অ্যান্টিবায়োটিক। প্রতিদিন নির্দিষ্ট সময়ে ১টি। সম্পূর্ণ কোর্স শেষ করতে হবে।","precautions":"কোর্স মাঝপথে বন্ধ করা যাবে না। অ্যান্টাসিডের সাথে খাবেন না।"},{"medicineName":"Povidone Iodine Gargle (Povin 1%)","genericName":"Povidone Iodine 1%","dosageForm":"Mouthwash / Gargle","strength":"100ml","dosageSchedule":"কুসুম গরম পানিতে মিশিয়ে দিনে ৩-৪ বার কুলকুচি","frequencyPerDay":4,"mealTiming":"খাবারের পর","duration":"৫ দিন","instructions":"আধা গ্লাস হালকা গরম পানিতে ১-২ চা চামচ মিশিয়ে ৩০ সেকেন্ড গড়গড়া করে ফেলে দিন।","precautions":"গিলবেন না। থাইরয়েডের সমস্যা থাকলে বেশি দিন ব্যবহার করবেন না।"},{"medicineName":"Strepsils / Trachisan Lozenges","genericName":"Amylmetacresol + Dichlorobenzyl Alcohol","dosageForm":"Lozenge","strength":"Pcs","dosageSchedule":"প্রতি ৩-৪ ঘণ্টা পর পর মুখে রেখে চুষে খাওয়া (দিনে ৩-৪টি)","frequencyPerDay":4,"mealTiming":"প্রয়োজনমতো","duration":"৩ - ৪ দিন","instructions":"গলার খুশখুশানি ও ব্যথা দ্রুত কমাতে লজেন্স চুষে খাবেন।","precautions":"চিবিয়ে খাবেন না। মুখে রেখে আস্তে আস্তে দ্রবীভূত হতে দিন।"}]'),
  ('dis-10', 'Toothache & Gum Inflammation', 'দাঁতের তীব্র ব্যথা ও মাড়ির ফোলা/ইনফেকশন', 'Dental Care', 'দন্ত ও মাড়ির যত্ন', '["দাঁতে অসহ্য চিনচিন বা দপদপ করা ব্যথা","মাড়ি ফোলা ও রক্ত পড়া","ঠাণ্ডা বা গরমে শিরশির করা"]', 'দাঁতের ক্যাভিটি বা মাড়ির ইনফেকশনে তীব্র ব্যথানাশক ও অ্যান্টিব্যাকটেরিয়াল নির্দেশিকা।', '[{"medicineName":"Ketorolac (Torax 10 / Rolac 10)","genericName":"Ketorolac Tromethamine","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"১ + ০ + ১ (দিনে সর্বোচ্চ ২ বার)","frequencyPerDay":2,"mealTiming":"ভরা পেটে (খাওয়ার পর অবশ্যই গ্যাস্ট্রিকের ঔষধসহ)","duration":"২ - ৩ দিন (জরুরি প্রয়োজনে)","instructions":"দাঁতের তীব্র ব্যথা কমাতে অত্যন্ত কার্যকর ও দ্রুত কাজ করে।","precautions":"কখনোই খালি পেটে খাবেন না। কিডনি বা আলসারের রোগীদের জন্য নিষিদ্ধ। টানা ৫ দিনের বেশি খাওয়া যাবে না।"},{"medicineName":"Moxaclav 625 / Fimoxyl Plus","genericName":"Amoxicillin + Clavulanic Acid","dosageForm":"Tablet","strength":"625mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার প্রতি ১২ ঘণ্টা অন্তর)","frequencyPerDay":2,"mealTiming":"খাওয়ার ঠিক শুরুতে বা খাবারের পর","duration":"৫ - ৭ দিন","instructions":"মাড়ির পুজ, ইনফেকশন ও দাঁতের গোড়ার ফোলা দূর করার শক্তিশালী অ্যান্টিবায়োটিক। কোর্স পূর্ণ করুন।","precautions":"পেনিসিলিন এলার্জি থাকলে সেবন করবেন না।"}]'),
  ('dis-11', 'Abdominal Cramps & Spasms', 'পেট কামড়ানো, মোচড় ও গ্যাস্ট্রিকের শূল ব্যথা', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["পেটে মোচড় দিয়ে ব্যথা","তলপেটে টান লাগা","মাসিকের তীব্র পেটে ব্যথা (Dysmenorrhea)"]', 'অন্ত্রের মাংসপেশির খিঁচুনি বা স্পাজমের ব্যথা দূর করার অ্যান্টি-স্পাসমোডিক ঔষধ।', '[{"medicineName":"Alverin / Spasnil / Normanal","genericName":"Alverine Citrate","dosageForm":"Capsule","strength":"60mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"২ - ৩ দিন","instructions":"আইবিএস (IBS) ও পেটের মোচড় ব্যথায় দ্রুত আরাম দেয়।","precautions":"অন্ত্রে ব্লকেজ বা বাধা থাকলে চিকিৎসকের পরামর্শ নিন।"},{"medicineName":"Tiemonium (Visceral / Timon / Anaflex)","genericName":"Tiemonium Methylsulphate","dosageForm":"Tablet","strength":"50mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর অথবা ব্যথার সময়","duration":"৩ দিন","instructions":"পেট মোচড়ানো, পিত্তথলির ব্যথা ও মেয়েদের পিরিয়ডের পেটে ব্যথায় সেব্য।","precautions":"গ্লুকোমা বা প্রস্টেট বৃদ্ধির রোগীদের ক্ষেত্রে সতর্কতা।"}]'),
  ('dis-12', 'Urinary Burning & UTI', 'প্রস্রাবে জ্বালাপোড়া ও মূত্রনালীর ইনফেকশন (UTI)', 'Urology', 'মূত্রনালী ও কিডনি', '["প্রস্রাবের সময় প্রচণ্ড জ্বালা","ঘন ঘন প্রস্রাবের বেগ কিন্তু অল্প হওয়া","প্রস্রাবের রং গাঢ় বা ঘোলা হওয়া"]', 'মূত্রনালীর প্রদাহ ও ক্ষারীয়করণ সংক্রান্ত নির্দেশিকা।', '[{"medicineName":"Urokit / Citrosol / Alkacitron","genericName":"Potassium Citrate + Citric Acid","dosageForm":"Syrup / Solution","strength":"200ml","dosageSchedule":"২-৩ চা চামচ ১ গ্লাস পানিতে মিশিয়ে (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৫ - ৭ দিন","instructions":"প্রস্রাবের এসিডিটি কমিয়ে জ্বালাপোড়া সাথে সাথে প্রশমিত করে। ১ গ্লাস পানিতে মিশিয়ে চুমুক দিয়ে পান করুন।","precautions":"প্রতিদিন প্রচুর পানি (৩-৪ লিটার) পান করতে হবে।"},{"medicineName":"Uromac 100 / Macmiror / Cef-3","genericName":"Nitrofurantoin / Cefixime","dosageForm":"Capsule / Tablet","strength":"100mg / 200mg","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর (ভরা পেটে দুধ বা খাবারের সাথে)","duration":"৭ দিন","instructions":"ইউরিনারি ট্র্যাক্ট ইনফেকশনের (UTI) জন্য নির্দিষ্ট অ্যান্টিবায়োটিক। সম্পূর্ণ কোর্স শেষ করুন।","precautions":"প্রস্রাবের রং কিছুটা গাঢ় বা হলুদাভ হতে পারে যা সাধারণ পার্শ্বপ্রতিক্রিয়া।"}]'),
  ('dis-13', 'Constipation & Hard Stool', 'কোষ্ঠকাঠিন্য, মল শক্ত হওয়া ও পেট পরিষ্কার না হওয়া', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["মলত্যাগে অতিরিক্ত কষ্ট","কয়েকদিন পায়খানা না হওয়া","পেট ফোলা ও অস্বস্তি","পাইলসের জ্বালা"]', 'কোষ্ঠকাঠিন্য দূর করে স্বাভাবিক মলত্যাগে সহায়তাকারী ঔষধ।', '[{"medicineName":"Avolac / Osmolax / Lactula","genericName":"Lactulose","dosageForm":"Syrup","strength":"100ml / 200ml","dosageSchedule":"৩ - ৪ চা চামচ (১৫-২০ মিলি) রাতে ঘুমানোর আগে","frequencyPerDay":1,"mealTiming":"রাতে ঘুমানোর পূর্বে ১ গ্লাস পানিসহ","duration":"৩ - ৫ দিন (প্রয়োজনে)","instructions":"প্রাকৃতিক নিয়মে মল নরম করে পেট পরিষ্কার করে। প্রচুর আঁশযুক্ত শাকসবজি ও পানি খান।","precautions":"অতিরিক্ত সেবনে পাতলা পায়খানা হতে পারে, সে ক্ষেত্রে ডোজ কমিয়ে দিন।"},{"medicineName":"Isabgol Husk (ইসবগুলের ভুষি)","genericName":"Psyllium Husk","dosageForm":"Powder","strength":"100g Pack","dosageSchedule":"১-২ চা চামচ ১ গ্লাস পানিতে গুলিয়ে সাথে সাথে পান","frequencyPerDay":1,"mealTiming":"রাতে খাওয়ার পর ঘুমানোর আগে","duration":"নিয়মিত সেবনযোগ্য","instructions":"পানিতে মিশিয়ে সাথে সাথে খেয়ে ফেলুন, ভিজিয়ে রেখে জেলি হতে দেবেন না।","precautions":"পর্যাপ্ত পানি পান না করলে উল্টো কোষ্ঠকাঠিন্য হতে পারে।"}]'),
  ('dis-14', 'High Blood Pressure (Hypertension)', 'উচ্চ রক্তচাপ ও প্রেশার বৃদ্ধি', 'Cardiovascular', 'হৃদরোগ ও রক্ত সঞ্চালন', '["মাথার পেছনে বা ঘাড়ে তীব্র টান ও ব্যথা","মাথা ঘোরা ও অস্থিরতা","বুক ধড়ফড় করা","চোখে ঝাপসা দেখা"]', 'উচ্চ রক্তচাপ নিয়ন্ত্রণ ও হৃদযন্ত্র সুরক্ষার নিয়মিত ঔষধ।', '[{"medicineName":"Osartil 50 / Losan 50","genericName":"Losartan Potassium","dosageForm":"Tablet","strength":"50mg","dosageSchedule":"১ + ০ + ০ (প্রতিদিন সকালে ১ বার)","frequencyPerDay":1,"mealTiming":"সকালে খাবারের পর","duration":"নিয়মিত (চিকিৎসকের পরামর্শ ছাড়া বন্ধ নিষেধ)","instructions":"রক্তচাপ নিয়ন্ত্রণে রাখতে প্রতিদিন একই সময়ে ১টি করে ট্যাবলেট।","precautions":"কখনোই ডাক্তারের পরামর্শ ছাড়া হঠাৎ করে প্রেশারের ঔষধ খাওয়া বন্ধ করবেন না। খাবারে বাড়তি কাঁচা লবণ সম্পূর্ণ বর্জন করুন।"},{"medicineName":"Amdocal 5 / Camlosart","genericName":"Amlodipine Besylate","dosageForm":"Tablet","strength":"5mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"সকালে বা রাতে নির্দিষ্ট সময়ে","duration":"নিয়মিত চলবে","instructions":"ধমনী প্রসারিত করে স্বাভাবিক রক্তচাপ বজায় রাখতে সাহায্য করে।","precautions":"পা ফোলা বা মাথা ঘোরার সমস্যা হলে চিকিৎসককে জানান।"}]'),
  ('dis-15', 'Diabetes Mellitus (High Blood Sugar)', 'ডায়াবেটিস ও রক্তের শর্করা বৃদ্ধি', 'Endocrinology', 'হরমোন ও ডায়াবেটিস', '["ঘন ঘন প্রস্রাব হওয়া","অতিরিক্ত তৃষ্ণা ও ক্ষুধা","হঠাৎ ওজন কমে যাওয়া","হাত-পা ঝিঁঝিঁ করা","ক্ষত দেরিতে শুকানো"]', 'টাইপ-২ ডায়াবেটিসে রক্তে গ্লুকোজ নিয়ন্ত্রণের নির্দেশিকা।', '[{"medicineName":"Commet 500 / Informet 500","genericName":"Metformin Hydrochloride","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার ঠিক মাঝখানে অথবা খাবারের পরপরই","duration":"নিয়মিত চলবে","instructions":"খাবারের সাথে গ্রহণ করলে পেটে গ্যাস বা পেট ফাঁপার সম্ভাবনা থাকে না। সুগার নিয়মিত মাপুন।","precautions":"মিষ্টি, কোমল পানীয় ও প্রক্রিয়াজাত শর্করা জাতীয় খাবার এড়িয়ে চলুন।"},{"medicineName":"Secrin 1mg / 2mg (Glimepiride)","genericName":"Glimepiride","dosageForm":"Tablet","strength":"1mg / 2mg","dosageSchedule":"১ + ০ + ০ (সকালের নাস্তার ঠিক পূর্বে)","frequencyPerDay":1,"mealTiming":"সকালের প্রথম প্রধান খাবারের ঠিক পূর্বে","duration":"নিয়মিত চলবে","instructions":"প্যানক্রিয়াস থেকে ইনসুলিন নিঃসরণে সহায়তা করে।","precautions":"ঔষধ খাওয়ার পর না খেয়ে থাকা যাবে না, এতে হাইপোগ্লাইসেমিয়া (সুগার হঠাৎ কমে যাওয়া) হতে পারে। সাথে মিষ্টি কিছু রাখুন।"}]'),
  ('dis-16', 'General Weakness & Vitamin Deficiency', 'শারীরিক দুর্বলতা, ক্লান্তি ও ভিটামিনের ঘাটতি', 'Supplements & Nutrition', 'পুষ্টি ও ভিটামিন', '["সারাদিন শরীরে শক্তি না পাওয়া","হাত-পায়ে জ্বালাপোড়া ও অবশ ভাব","রক্তস্বল্পতা","হাড়ে ব্যথা"]', 'ভিটামিন বি কমপ্লেক্স, ক্যালসিয়াম ও মাল্টিভিটামিন সেবনবিধি।', '[{"medicineName":"Neuro-B / Aristovit-B / B-50 Forte","genericName":"Vitamin B1 + B6 + B12","dosageForm":"Tablet","strength":"Standard Forte","dosageSchedule":"১ + ০ + ১ (দিনে ২ বার)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর (ভরা পেটে)","duration":"১ মাস","instructions":"হাত-পায়ে অবশ ভাব, স্নায়বিক দুর্বলতা ও পিঠের ব্যথায় সকাল-রাতে ১টি করে ট্যাবলেট।","precautions":"প্রস্রাবের রং হলুদ হতে পারে যা ভিটামিন বি২-এর স্বাভাবিক প্রতিক্রিয়া।"},{"medicineName":"Calbo-D / Ostocal-D","genericName":"Calcium Carbonate 500mg + Vitamin D3 200IU","dosageForm":"Tablet","strength":"500mg + 200IU","dosageSchedule":"০ + ০ + ১ (রাতে খাবারের পর ১টি)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (রাতে ১ গ্লাস পানিসহ)","duration":"১ - ৩ মাস","instructions":"হাড় মজবুত করতে এবং কোমরের ব্যথায় রাতে খাবারের পর ১টি করে।","precautions":"কিডনিতে পাথরের পূর্ব ইতিহাস থাকলে চিকিৎসকের পরামর্শ নিন।"}]'),
  ('dis-17', 'Skin Fungus, Ringworm & Itching', 'দাদ, ফাঙ্গাল ইনফেকশন ও চুলকানি', 'Dermatology & Allergy', 'ত্বক ও এলার্জি', '["ত্বকে গোল গোল লাল দাগ","তীব্র চুলকানি","ঘামাচি ও ফাঙ্গাস","পায়ে বা আঙ্গুলের ফাঁকে ঘা"]', 'দাদ, রিংওয়ার্ম ও ফাঙ্গাল সংক্রমণের জন্য ক্রিম ও অ্যান্টিফাঙ্গাল ঔষধ।', '[{"medicineName":"Ketoral Cream / Fungidal","genericName":"Ketoconazole","dosageForm":"Cream","strength":"2%","dosageSchedule":"দিনে ২ বার (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"বাহ্যিক ব্যবহার","duration":"২ - ৩ সপ্তাহ","instructions":"সংক্রমিত স্থানে ভালো করে ধুয়ে পরিষ্কার করে পাতলা করে লাগান। লক্ষণ চলে যাওয়ার পরও ১ সপ্তাহ ব্যবহার করুন।","precautions":"চোখ বা মুখের ভেতরে লাগানো থেকে বিরত থাকুন।"},{"medicineName":"Fexo 180 / Telfast 180","genericName":"Fexofenadine Hydrochloride","dosageForm":"Tablet","strength":"180mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর","duration":"৭ - ১০ দিন","instructions":"তীব্র চুলকানি ও অ্যালার্জি কমাতে দিনে ১টি ট্যাবলেট।","precautions":"খালি পেটে সেবন করবেন না।"}]'),
  ('dis-18', 'Eye Infection & Conjunctivitis', 'চোখ ওঠা, কনজাংটিভাইটিস ও চোখের ড্রপ', 'ENT (Ear, Nose, Throat)', 'নাক, কান ও চোখ', '["চোখ লাল হয়ে যাওয়া","চোখ দিয়ে পানি পড়া ও কچলা হওয়া","সকালে চোখ আটকে থাকা","চোখে চুলকানি ও অস্বস্তি"]', 'ব্যাকটেরিয়াল কনজাংটিভাইটিস ও চোখ ওঠার চিকিৎসায় আই ড্রপ।', '[{"medicineName":"Moxiflox Eye Drop / Vigamox","genericName":"Moxifloxacin Hydrochloride","dosageForm":"Eye Drop","strength":"0.5%","dosageSchedule":"১ ফোঁটা করে চোখে দিনে ৩ বার","frequencyPerDay":3,"mealTiming":"প্রয়োজনমতো চোখে ব্যবহার","duration":"৫ - ৭ দিন","instructions":"চোখ ওঠার বা ব্যাকটেরিয়াল ইনফেকশনের জন্য চোখে ১ ফোঁটা করে ব্যবহার করুন। ড্রপ দেওয়ার পর চোখ বন্ধ রাখুন ২ মিনিট।","precautions":"ড্রপ দেওয়ার সময় ড্রপারের মুখ যেন চোখের পাতা বা অন্য কিছুর সংস্পর্শে না আসে।"}]'),
  ('dis-19', 'Diarrhea, Dysentery & Gastroenteritis', 'ডায়রিয়া, পাতলা পায়খানা ও আমাশয়', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["পাতলা পায়খানা","পেটে মোচড় দিয়ে ব্যথা","দুর্বলতা ও শরীর ডিহাইড্রেটেড হওয়া","ঘন ঘন মলত্যাগ"]', 'ডায়রিয়া ও আমাশয়ে স্যালাইন, জিংক ও অ্যান্টিবায়োটিক নির্দেশিকা।', '[{"medicineName":"ORS Saline (Orsaline-N)","genericName":"Oral Rehydration Salts","dosageForm":"Powder / Sachet","strength":"Standard WHO Formula","dosageSchedule":"প্রতিবার পাতলা পায়খানার পর ১ গ্লাস","frequencyPerDay":4,"mealTiming":"প্রয়োজনমতো পান করুন","duration":"সুস্থ হওয়া পর্যন্ত","instructions":"১ প্যাকেট স্যালাইন ৫০০ মিলি পরিষ্কার নিরাপদ পানিতে সম্পূর্ণ গুলিয়ে পান করুন।","precautions":"তৈরি করা স্যালাইন ২৪ ঘণ্টার বেশি সংরক্ষণ করা যাবে না।"},{"medicineName":"Ciprofloxacin 500 / Ciprocin","genericName":"Ciprofloxacin Hydrochloride","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"৫ দিন","instructions":"ব্যাকটেরিয়াল ডায়রিয়া ও আমাশয়ে চিকিৎসকের পরামর্শ অনুযায়ী সেবন করুন।","precautions":"১৮ বছরের কম বয়সীদের ক্ষেত্রে চিকিৎসকের পরামর্শ আবশ্যক।"}]'),
  ('dis-20', 'Tonsillitis & Sore Throat', 'গলা ব্যথা, টনসিল ও ফ্যারিনজাইটিস', 'ENT (Ear, Nose, Throat)', 'নাক, কান ও গলা', '["গলায় তীব্র ব্যথা ও গিলতে কষ্ট হওয়া","টনসিল ফুলে যাওয়া","স্বরভঙ্গ ও জ্বর ভাব","গলায় খুশখুশ"]', 'গলার ইনফেকশন ও টনসিলের চিকিৎসায় অ্যান্টিবায়োটিক ও গার্গল।', '[{"medicineName":"Azithrocin 500 / Zithrin","genericName":"Azithromycin","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার ১ ঘণ্টা আগে অথবা ২ ঘণ্টা পর","duration":"৩ দিন","instructions":"টনসিল ও গলার ইনফেকশনে প্রতিদিন ১টি করে টানা ৩ দিন। পূর্ণ কোর্স শেষ করুন।","precautions":"বুকের দুধ খাওয়াচ্ছেন এমন মায়েরা চিকিৎসকের পরামর্শ নিয়ে খাবেন।"},{"medicineName":"Hexisol Mouthwash / Gargle","genericName":"Chlorhexidine Gluconate","dosageForm":"Mouthwash / Gargle","strength":"0.2%","dosageSchedule":"১০ মিলি দিয়ে দিনে ২-৩ বার গার্গল করুন","frequencyPerDay":3,"mealTiming":"খাওয়ার পর গার্গল করুন","duration":"৫ দিন","instructions":"১০ মিলি মাউথওয়াশ মুখে নিয়ে ৩০ সেকেন্ড রেখে গার্গল করুন (গিলে খাবেন না)।","precautions":"গার্গল করার পর অন্তত ৩০ মিনিট পানি পান বা কিছু খাওয়া থেকে বিরত থাকুন।"}]'),
  ('dis-21', 'Joint Pain, Arthritis & Muscle Sprain', 'গেঁটেবাত, হাড়ের জয়েন্টে ব্যথা ও পেশীর টান', 'General & Pain', 'সাধারণ রোগ ও ব্যথা', '["হাঁটু ও জয়েন্টে ব্যথা","সকালে জয়েন্ট শক্ত হয়ে থাকা","মাংসপেশীতে টান ও ফুলে যাওয়া","পিঠ ও কোমর ব্যথা"]', 'বাত, হাড়ের সংযোগস্থলে ব্যথা এবং পেশীর ব্যথার পেইনকিলার ও জেল।', '[{"medicineName":"Naprosyn 500 / Apranax","genericName":"Naproxen Sodium","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর (ভরা পেটে)","duration":"৫ - ৭ দিন","instructions":"বাত, গেঁটেবাত ও তীব্র হাড়ের ব্যথায় খাবারের পর ১টি করে ট্যাবলেট।","precautions":"গ্যাস্ট্রিকের সমস্যা থাকলে অবশ্যই গ্যাসের ঔষধের সাথে খাবেন।"},{"medicineName":"Voltaren Gel / Diclofen Gel","genericName":"Diclofenac Diethylamine","dosageForm":"Gel","strength":"1%","dosageSchedule":"ব্যথার স্থানে দিনে ৩-৪ বার লাগান","frequencyPerDay":3,"mealTiming":"বাহ্যিক ব্যবহার","duration":"প্রয়োজনমতো","instructions":"হাঁটু, কোমর বা পেশীর ব্যথার স্থানে সামান্য পরিমাণ জেল লাগিয়ে হালকাভাবে ম্যাসাজ করুন।","precautions":"ক্ষত বা কাটা স্থানে লাগাবেন না।"}]'),
  ('dis-22', 'Migraine & Severe Headache', 'মাইগ্রেন ও তীব্র মাথাব্যথা', 'General & Pain', 'সাধারণ রোগ ও ব্যথা', '["মাথার একপাশে দপদপে ব্যথা","আলো ও শব্দে বিরক্ত বোধ","বমি ভাব ও মাথা ঘোরানো","দৃষ্টিতে ঝাপসা ভাব"]', 'মাইগ্রেন ও তীব্র মাথার ব্যথার জন্য নির্দেশিত ঔষধ।', '[{"medicineName":"Migranil / Migril","genericName":"Ergotamine Tartrate + Caffeine","dosageForm":"Tablet","strength":"Standard","dosageSchedule":"ব্যথা শুরুর সাথে সাথে ২টি, প্রয়োজনে আরও ১টি","frequencyPerDay":1,"mealTiming":"ব্যথা শুরুর মুহূর্তে","duration":"প্রয়োজন অনুযায়ী","instructions":"মাইগ্রেনের ব্যথা শুরু হওয়ার সাথে সাথে সেবন করলে দ্রুত উপশম পাওয়া যায়।","precautions":"গর্ভাবস্থায় বা হৃদরোগীরা চিকিৎসকের পরামর্শ ছাড়া খাবেন না।"},{"medicineName":"Propran 40 / Inderal","genericName":"Propranolol Hydrochloride","dosageForm":"Tablet","strength":"40mg","dosageSchedule":"১ + ০ + ১ (চিকিৎসকের পরামর্শে)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"নিয়মিত (প্রতিরোধক হিসেবে)","instructions":"মাইগ্রেনের আক্রমণ প্রতিরোধ করতে নিয়মিত সেবনের জন্য।","precautions":"হাঁপানি বা লো প্রেশার রোগীরা সাবধানে ব্যবহার করবেন।"}]'),
  ('dis-23', 'Intestinal Worms & Parasitic Infractions', 'পেটের কৃমি ও পরজীবী সংক্রমণ', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পেটের রোগ', '["পেটে ব্যথা ও অস্বস্তি","রাতে দাঁত কড়মড় করা","মুখ দিয়ে লালা পড়া","ক্ষুধা মন্দা বা অতিরিক্ত ক্ষুধা","ওজন হ্রাস"]', 'কৃমি নাশক ট্যাবলেট ও পরজীবী সংক্রমণের চিকিৎসা।', '[{"medicineName":"Zenal 400 / Alben-DS","genericName":"Albendazole","dosageForm":"Tablet","strength":"400mg","dosageSchedule":"এক সাথে ১টি ট্যাবলেট (একমাত্রিক ডোজ)","frequencyPerDay":1,"mealTiming":"রাতে ঘুমানোর আগে","duration":"একমাত্রিক (প্রয়োজনে ২ সপ্তাহ পর আর ১টি)","instructions":"কৃমি দমনে রাতে ঘুমানোর আগে একবারে ৪০০ মিলিগ্রাম ট্যাবলেট চিবিয়ে বা গিলে সেবন করুন। পরিবারের সবাই একসাথে খাওয়া ভালো।","precautions":"গর্ভকালীন প্রথম তিন মাসে সেবন নিষেধ।"}]'),
  ('dis-24', 'Mouth Ulcers & Canker Sores', 'মুখে ঘা ও মাড়ির প্রদাহ', 'Dental Care', 'দাঁত ও মুখের যত্ন', '["জিহ্বা, গাল বা ঠোঁটের ভেতরে সাদা ক্ষত","ঝাল ও গরম খাবারে জ্বালাপোড়া","লালা পড়া","কথা বলতে ও খেতে কষ্ট হওয়া"]', 'মুখে ঘা, ক্যানকার সোর ও মাড়ির প্রদাহের ওরাল পেস্ট।', '[{"medicineName":"Orabase Oral Paste / Kenacort","genericName":"Triamcinolone Acetonide","dosageForm":"Ointment","strength":"0.1%","dosageSchedule":"দিনে ২-৩ বার ক্ষতে লাগান","frequencyPerDay":3,"mealTiming":"খাওয়ার পর ও ঘুমানোর আগে","duration":"৩ - ৫ দিন","instructions":"পরিষ্কার আঙুল বা কটন বাড দিয়ে মুখের ঘায়ের উপর অল্প পরিমাণ পেস্ট লাগিয়ে দিন। ঘুমানোর আগে লাগালে ভালো ফল পাওয়া যায়।","precautions":"লাগানোর পর ৩০ মিনিট কিছু খাওয়া বা পান করা থেকে বিরত থাকুন।"}]'),
  ('dis-25', 'Urinary Tract Infection (UTI)', 'প্রস্রাবে জ্বালাপোড়া ও ইউটিআই ইনফেকশন', 'Urology', 'মূত্রনালী ও কিডনি', '["প্রস্রাবে তীব্র জ্বালাপোড়া ও ব্যথা","ঘন ঘন প্রস্রাবের বেগ কিন্তু অল্প প্রস্রাব হওয়া","পেটের নিচে বা কোমরে ব্যথা","ঘোলাটে বা দুর্গন্ধযুক্ত প্রস্রাব"]', 'মূত্রনালীর ইনফেকশন (UTI) এর জন্য অ্যান্টিবায়োটিক ও সিরাপ।', '[{"medicineName":"Monural Powder / Urocin","genericName":"Fosfomycin Trometamol","dosageForm":"Powder / Sachet","strength":"3g Sachet","dosageSchedule":"একক মাত্রা (Single Dose)","frequencyPerDay":1,"mealTiming":"রাতে ঘুমানোর আগে খালি পেটে (মূত্রথলি খালি করে)","duration":"একমাত্রিক ডোজ","instructions":"১ প্যাকেট পাউডার আধা গ্লাস ঠান্ডা পানিতে সম্পূর্ণ মিশিয়ে রাতে ঘুমানোর ঠিক আগে পান করুন।","precautions":"পানের পর মূত্রথলি সম্পূর্ণ খালি করে ঘুমাতে যান।"},{"medicineName":"Ciprogen 500 / Ciprocin","genericName":"Ciprofloxacin","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"৭ দিন","instructions":"প্রস্রাবের ইনফেকশনে চিকিৎসকের পরামর্শে ৭ দিনের কোর্স সম্পন্ন করুন। প্রচুর পানি পান করুন।","precautions":"রোদে যাওয়ার সময় সাবধান থাকুন, কারণ এতে ত্বকের সংবেদনশীলতা বাড়তে পারে।"}]'),
  ('dis-26', 'Sinusitis & Nasal Congestion', 'সাইনাস ইনফেকশন ও সর্দি-নাক বন্ধ', 'Respiratory', 'শ্বাসতন্ত্র ও ফুসফুস', '["কপালে ও নাকের পাশে ভারী ভাব ও ব্যথা","নাক বন্ধ থাকা ও ঘ্রাণশক্তি কমে যাওয়া","ঘন হলুদ বা সবুজ সর্দি","মাথাব্যথা"]', 'সাইনাসের প্রদাহ ও মাথাব্যথা নিরাময়ের জন্য ঔষধ।', '[{"medicineName":"Monas 10 / Provair 10","genericName":"Montelukast Sodium","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"০ + ০ + ১ (রাতে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (রাতে ঘুমানোর আগে)","duration":"১৪ দিন","instructions":"সাইনাস ও অ্যালার্জিক রাইনাইটিস কমাতে রাতে ঘুমানোর আগে ১টি করে ট্যাবলেট।","precautions":"নিয়মিত সেবন করলে সাইনাসের সমস্যা দ্রুত কমে যায়।"}]'),
  ('dis-27', 'Asthma & Respiratory Bronchitis', 'হাঁপানি, অ্যাজমা ও শ্বাসকষ্ট', 'Respiratory', 'শ্বাসতন্ত্র ও ফুসফুস', '["শ্বাস নিতে কষ্ট হওয়া","বুকে সাঁই সাঁই শব্দ","রাতে বা ভোরে তীব্র কাশি","বুক চেপে আসা"]', 'হাঁপানি ও শ্বাসনালীর সংকীর্ণতা দূর করার ইনহেলার ও ট্যাবলেট।', '[{"medicineName":"Seretide 250 Inhaler / Fostair","genericName":"Salmeterol + Fluticasone Propionate","dosageForm":"Inhaler","strength":"250mcg","dosageSchedule":"২ পাফ করে দিনে ২ বার (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"ইনহেলার ব্যবহারের পর মুখ কুলি করুন","duration":"নিয়মিত চিকিৎসকের পরামর্শে","instructions":"ইনহেলার ব্যবহারের পর অবশ্যই পরিষ্কার পানি দিয়ে মুখ ও গলা ভালো করে কুলি করে ফেলে দিন।","precautions":"হাঁপানির টান উঠলে ডাক্তারের নির্দেশিত রুটিন মেনে চলুন।"}]'),
  ('dis-28', 'Skin Wounds, Cuts & Minor Burns', 'ত্বকের কাটা-ছেঁড়া, ক্ষত ও পোড়া দাগ', 'Dermatology & Allergy', 'ত্বক ও এলার্জি', '["ত্বকে কাটা বা ছড়ে যাওয়া","সামান্য পোড়া ফোসকা","সংক্রমণ ও পূঁজ হওয়া","লাল হয়ে ব্যথা করা"]', 'ক্ষত ও পোড়া নিরাময়ের অ্যান্টিবায়োটিক ও বার্ন অয়েন্টমেন্ট।', '[{"medicineName":"Silverex Cream / Burnol","genericName":"Silver Sulfadiazine","dosageForm":"Ointment","strength":"1%","dosageSchedule":"ক্ষতে দিনে ২-৩ বার লাগান","frequencyPerDay":3,"mealTiming":"বাহ্যিক ব্যবহার","duration":"ক্ষত শুকানো পর্যন্ত","instructions":"পোড়া স্থানে বা ক্ষতে পরিষ্কার করে পাতলা আস্তরে ক্রিমটি লাগান।","precautions":"বড় ধরনের পোড়া বা গভীর ক্ষতের জন্য দ্রুত হাসপাতালে যান।"},{"medicineName":"Bacrocin Ointment / Fucidin","genericName":"Bacitracin / Fusidic Acid","dosageForm":"Ointment","strength":"2%","dosageSchedule":"ক্ষতে দিনে ২ বার","frequencyPerDay":2,"mealTiming":"বাহ্যিক ব্যবহার","duration":"৫ দিন","instructions":"কাটা-ছেঁড়া ও ছোটখাটো ক্ষতে ইনফেকশন রোধ করতে ব্যবহার করুন।","precautions":"চোখের সংস্পর্শ থেকে দূরে রাখুন।"}]'),
  ('dis-29', 'Anemia & Iron Deficiency', 'রক্তস্বল্পতা ও আয়রনের ঘাটতি', 'Supplements & Nutrition', 'পুষ্টি ও ভিটামিন', '["সারাদিন ক্লান্ত ও ফ্যাকাশে লাগা","মাথা ঘোরানো ও দুর্বলতা","নখ চামচ আকৃতির হয়ে যাওয়া","বুক ধড়ফড় করা"]', 'রক্তস্বল্পতা দূর করার আয়রন ও ফলিক এসিডের ক্যাপসুল।', '[{"medicineName":"Fefol Z / Filwel Iron","genericName":"Ferrous Sulfate + Folic Acid + Zinc","dosageForm":"Capsule","strength":"Standard","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার ১ ঘণ্টা আগে অথবা ভরা পেটে","duration":"১ - ৩ মাস","instructions":"আয়রনের ঘাটতি ও রক্তস্বল্পতায় প্রতিদিন সকালে ১টি ক্যাপসুল। ভিটামিন সি বা কমলার রসের সাথে খেলে শোষণ ভালো হয়।","precautions":"পায়খানার রং কালচে হতে পারে, এতে ভয়ের কিছু নেই।"}]'),
  ('dis-30', 'Insomnia & Sleep Disorders', 'অনিদ্রা, মানসিক চাপ ও দুশ্চিন্তা', 'Endocrinology', 'মানসিক স্বাস্থ্য ও ঘুম', '["রাতে ঘুম না আসা","বারবার ঘুম ভেঙে যাওয়া","সকালে মাথা ভারী থাকা","উদ্বেগ ও অস্থিরতা"]', 'ঘুম না হওয়া ও মানসিক প্রশান্তির জন্য নিরাপদ ভেষজ ও পরিপূরক।', '[{"medicineName":"Sedil 5 / Relaxen / Valerian","genericName":"Diazepam / Valerian Root Extract","dosageForm":"Tablet","strength":"5mg / Herbal","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর ৩০ মিনিট আগে)","frequencyPerDay":1,"mealTiming":"রাতে ঘুমানোর আগে","duration":"স্বল্পমেয়াদী (চিকিৎসকের পরামর্শে)","instructions":"অনিদ্রা ও তীব্র মানসিক চাপে রাতে ঘুমানোর পূর্বে চিকিৎসকের পরামর্শে সেব্য।","precautions":"দীর্ঘদিন নিজে নিজে সেবন করবেন না, আসক্তি তৈরি হতে পারে।"}]'),
  ('dis-31', 'Pediatric Fever & Cold (Children)', 'শিশুদের জ্বর, সর্দি ও পেটের পীড়া', 'General & Pain', 'শিশু স্বাস্থ্য', '["শিশুর গায়ে তীব্র জ্বর","সর্দি ও কান্নাকাটি করা","দুধ বমি করে দেওয়া","পাতলা পায়খানা"]', 'শিশুদের জ্বর ও সর্দির জন্য সিরাপ ও ড্রপ ডোজ।', '[{"medicineName":"Napa Drop / Ace Drop","genericName":"Paracetamol","dosageForm":"Syrup","strength":"80mg / ml (Drop)","dosageSchedule":"ওজন অনুযায়ী (চিকিৎসকের পরামর্শে প্রতি ৬ ঘণ্টা পর)","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৩ দিন","instructions":"শিশুর ওজন অনুযায়ী ড্রপার দিয়ে মেপে খাওয়ান (সাধারণত ১৫ মিলিগ্রাম প্রতি কেজিতে)।","precautions":"ডোজ নির্ধারণের জন্য অবশ্যই চিকিৎসকের পরামর্শ নিন।"}]'),
  ('dis-32', 'Thyroid Disorders / Hypothyroidism', 'থাইরয়েড সমস্যা ও হরমোনের ভারসাম্যহীনতা', 'Endocrinology', 'হরমোন ও থাইরয়েড', '["ওজন বৃদ্ধি ও অলসতা","শীত বেশি লাগা","চুল পড়ে যাওয়া ও ত্বক শুষ্ক হওয়া","গলায় অস্বস্তি"]', 'থাইরয়েড হরমোন ঘাটতির জন্য রিপ্লেসমেন্ট থেরাপি।', '[{"medicineName":"Thyrox 50mcg / Eltroxin","genericName":"Levothyroxine Sodium","dosageForm":"Tablet","strength":"50mcg / 100mcg","dosageSchedule":"১ + ০ + ০ (সকালে খালি পেটে নির্দিষ্ট সময়ে)","frequencyPerDay":1,"mealTiming":"সকালের নাস্তার ৩০-৬০ মিনিট আগে খালি পেটে","duration":"নিয়মিত চলবে","instructions":"সকালে ঘুম থেকে উঠে এক গ্লাস পানির সাথে খালি পেটে ১টি ট্যাবলেট খেতে হবে। খাওয়ার পর অন্তত ৩০ মিনিট চা/কফি বা অন্য খাবার খাওয়া নিষেধ।","precautions":"নিয়মিত থাইরয়েড হরমোন (TSH) পরীক্ষা করে ডোজ ডাক্তারের সাথে পরামর্শ করে ঠিক করুন।"}]'),
  ('dis-33', 'Acne, Pimples & Facial Breakouts', 'ব্রণ, মেছতা ও মুখের তৈলাক্ত ত্বক', 'Dermatology & Allergy', 'ত্বক ও সৌন্দর্য', '["মুখে ও পিঠে ছোট বড় ব্রণ","ত তৈলাক্ত ত্বক","ব্রণের লালচে দাগ ও পূঁজ","ব্ল্যাকহেডস ও হোয়াইটহেডস"]', 'ব্রণ ও ত্বকের ইনফেকশনের জন্য অ্যান্টিবায়োটিক জেল ও ক্যাপসুল।', '[{"medicineName":"Clindamycin Gel / Benzoyl Peroxide","genericName":"Clindamycin + Benzoyl Peroxide","dosageForm":"Gel","strength":"1% + 2.5%","dosageSchedule":"রাতে শোবার আগে ব্রণের স্থানে লাগান","frequencyPerDay":1,"mealTiming":"বাহ্যিক ব্যবহার","duration":"৪ - ৮ সপ্তাহ","instructions":"মুখ ভালো করে ধুয়ে শুকিয়ে শুধুমাত্র ব্রণের উপরে পাতলা করে লাগান।","precautions":"রোদে যাওয়ার আগে সানস্ক্রিন ব্যবহার করুন। কাপড়ে লাগলে রং উঠতে পারে।"}]'),
  ('dis-34', 'Hair Fall, Alopecia & Dandruff', 'চুল পড়া, খুশকি ও মাথার ত্বকের ইনফেকশন', 'Dermatology & Allergy', 'ত্বক ও চুল', '["অতিরিক্ত চুল পড়া","মাথার ত্বকে খুশকি ও চুলকানি","মাথার তালু দেখা যাওয়া (চুল পাতলা হওয়া)","খুশকি থেকে দাদ বা ফাঙ্গাস"]', 'চুল পড়া রোধ ও খুশকি দূর করার শ্যাম্পু ও মাল্টিভিটামিন।', '[{"medicineName":"Nizoral Shampoo / Ketoclean","genericName":"Ketoconazole","dosageForm":"Shampoo","strength":"2%","dosageSchedule":"সপ্তাহে ২-৩ বার চুল ধুতে ব্যবহার করুন","frequencyPerDay":1,"mealTiming":"বাহ্যিক ব্যবহার","duration":"৪ সপ্তাহ","instructions":"মাথার চুলে শ্যাম্পু লাগিয়ে ৩-৫ মিনিট রেখে পানি দিয়ে ধুয়ে ফেলুন। খুশকি ও ফাঙ্গাস দূর করতে অত্যন্ত কার্যকর।","precautions":"চোখে যেন না যায় সেদিকে সতর্ক থাকুন।"}]'),
  ('dis-35', 'High Cholesterol & Triglycerides', 'রক্তে অতিরিক্ত চর্বি ও কোলেস্টেরল বৃদ্ধি', 'Cardiovascular', 'হৃদরোগ ও রক্তচাপ', '["রক্তে এলডিএল (LDL) কোলেস্টেরল বেশি থাকা","বুকে অস্বস্তি বা ক্লান্তি","উচ্চ রক্তচাপের ঝুঁকি"]', 'কোলেস্টেরল ও ট্রাইগ্লিসারাইড নিয়ন্ত্রণের স্ট্যাটিন জাতীয় ঔষধ।', '[{"medicineName":"Atorva 10 / Lipitor","genericName":"Atorvastatin Calcium","dosageForm":"Tablet","strength":"10mg / 20mg","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর আগে ১ বার)","frequencyPerDay":1,"mealTiming":"রাতে খাবারের পর বা ঘুমানোর আগে","duration":"নিয়মিত চলবে","instructions":"রক্তে খারাপ কোলেস্টেরল (LDL) কমাতে রাতে ১টি করে ট্যাবলেট সেব্য।","precautions":"অতিরিক্ত চর্বিযুক্ত খাবার, ফাস্টফুড ও ভাজাপোড়া বর্জন করুন।"}]'),
  ('dis-36', 'Piles, Hemorrhoids & Anal Fissure', 'পাইলস, অর্শ্বরোগ ও কোষ্ঠকাঠিন্য', 'Gastrointestinal', 'পরিপাকতন্ত্র ও পায়ুপথ', '["মলত্যাগের সময় রক্ত যাওয়া","পায়ুপথে মাংসপিণ্ড বা ব্যথা","তীব্র চুলকানি ও জ্বালাপোড়া","কোষ্ঠকাঠিন্য"]', 'পাইলস ও অর্শ্বরোগের রক্তক্ষরণ ও ব্যথা নিরাময়ের ঔষধ।', '[{"medicineName":"Daflon 500 / Ardium","genericName":"Micronized Purified Flavonoid Fraction","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"২ + ০ + ২ (প্রথম ৪ দিন, এরপর ১ + ০ + ১)","frequencyPerDay":2,"mealTiming":"খাওয়ার সময় (প্রধান খাবারের সাথে)","duration":"২ সপ্তাহ","instructions":"পাইলসের রক্তপাত ও ফুলে যাওয়া কমাতে চিকিৎসকের নির্দেশিত নিয়মে সেবন করুন।","precautions":"প্রচুর আঁশযুক্ত খাবার (শাকসবজি, ফলমূল) ও পানি পান করুন।"}]'),
  ('dis-37', 'Kidney Stones & Renal Colic Pain', 'কিডনিতে পাথর ও মূত্রথলির ব্যথা', 'Urology', 'মূত্রনালী ও কিডনি', '["কোমরের পেছনের দিকে তীব্র ব্যথা","প্রস্রাবের সাথে রক্ত যাওয়া","বমি ভাব ও অস্থিরতা","প্রস্রাবে বাধা বা ফোঁটায় ফোঁটায় পড়া"]', 'কিডনি ও মূত্রনালীর পাথরের ব্যথা ও অপসারণে সাহায্যকারী সিরাপ।', '[{"medicineName":"Urikem Syrup / Cystone","genericName":"Potassium Citrate + Citric Acid","dosageForm":"Syrup","strength":"200ml","dosageSchedule":"২ চা চামচ এক গ্লাস পানিতে মিশিয়ে দিনে ৩ বার","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"দীর্ঘমেয়াদী","instructions":"প্রস্রাব ক্ষারীয় করে পাথর গলতে সাহায্য করে এবং প্রস্রাবের জ্বালাপোড়া কমায়। প্রচুর পানি খান (দৈনিক ৩ লিটার)।","precautions":"কিডনির কার্যকারিতা মারাত্মকভাবে হ্রাস পেলে চিকিৎসকের পরামর্শ নিন।"}]'),
  ('dis-38', 'Liver Disorders, Fatty Liver & Jaundice', 'জন্ডিস, ফ্যাটি লিভার ও যকৃতের সমস্যা', 'Gastrointestinal', 'যকৃত ও পরিপাকতন্ত্র', '["চোখ ও প্রস্রাব হলুদ হওয়া","বামে বা ডানে পেটের উপরিভাগে অস্বস্তি","অরুচি ও বমি ভাব","ক্লান্তি ও দুর্বলতা"]', 'লিভারের কার্যকারিতা বাড়াতে ও ফ্যাটি লিভার চিকিৎসায় সাপ্লিমেন্ট।', '[{"medicineName":"Essential Forte / Hepa-Merz","genericName":"Essential Phospholipids / L-Ornithine L-Aspartate","dosageForm":"Capsule","strength":"300mg","dosageSchedule":"১ + ১ + ১ (দিনে ৩ বার)","frequencyPerDay":3,"mealTiming":"খাওয়ার সময়","duration":"১ - ৩ মাস","instructions":"লাইট ফ্যাটি লিভার ও লিভার সেল সুরক্ষায় খাবারের সাথে ১টি করে ক্যাপসুল।","precautions":"অ্যালকোহল, চর্বিযুক্ত ও অতিরিক্ত তেল-মসলাযুক্ত খাবার বর্জন করুন।"}]'),
  ('dis-39', 'Ear Pain, Otitis Media & Ear Wax', 'কানে ব্যথা, কানের ইনফেকশন ও ময় জমা', 'ENT (Ear, Nose, Throat)', 'নাক, কান ও গলা', '["কানে তীব্র ব্যথা ও ভোঁ ভোঁ শব্দ","কান থেকে পুঁজ বা পানি পড়া","কানে কম শোনা","কান ভারী হয়ে থাকা"]', 'কানের ইনফেকশন ও ব্যথা নিরাময়ের অ্যান্টিবায়োটিক ড্রপ।', '[{"medicineName":"Ciprocin Ear Drop / Oflox","genericName":"Ciprofloxacin / Ofloxacin","dosageForm":"Ear Drop","strength":"0.3%","dosageSchedule":"৩-৪ ফোঁটা করে আক্রান্ত কানে দিনে ২-৩ বার","frequencyPerDay":3,"mealTiming":"প্রয়োজনমতো কানে ব্যবহার","duration":"৫ - ৭ দিন","instructions":"কান পরিষ্কার করে কানে ৩-৪ ফোঁটা দিয়ে ৫ মিনিট ওই কানে শুয়ে থাকুন।","precautions":"পর্দা ফাটা থাকলে ডাক্তারের পরামর্শ ছাড়া ড্রপ ব্যবহার করবেন না।"}]'),
  ('dis-40', 'Allergic Rhinitis & Sneezing', 'অ্যালার্জিক রাইনাইটিস ও ঘন ঘন হাঁচি', 'Respiratory', 'শ্বাসতন্ত্র ও এলার্জি', '["সকালে ঘুম থেকে উঠেই ঘন ঘন হাঁচি","নাক দিয়ে পানি পড়া ও চুলকানি","নাক বন্ধ থাকা","চোখ লাল হওয়া"]', 'অ্যালার্জিক রাইনাইটিস ও ধুলোবালিজনিত এলার্জির ঔষধ।', '[{"medicineName":"Rupat 10 / Rupafin","genericName":"Rupatadine Fumarate","dosageForm":"Tablet","strength":"10mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর","duration":"৭ - ১৪ দিন","instructions":"তীব্র হাঁচি ও অ্যালার্জিক রাইনাইটিসে দিনে ১টি ট্যাবলেট। দ্রুত কার্যকারী।","precautions":"ধুলোবালি ও ঠান্ডা বাতাস থেকে দূরে থাকুন।"}]'),
  ('dis-41', 'Dengue & Post-Viral Fatigue Recovery', 'ডেঙ্গু ও ম্যালেরিয়া পরবর্তী দুর্বলতা ও জ্বর', 'General & Pain', 'সাধারণ রোগ ও দুর্বলতা', '["রক্তে প্লাটিলেট কমে যাওয়া","অতিরিক্ত শরীর ব্যথা ও দুর্বলতা","অরুচি ও মাথা ঘোরানো"]', 'ভাইরাল জ্বর পরবর্তী শারীরিক শক্তি ফেরানোর আয়রন ও পেঁপে পাতা নির্যাস।', '[{"medicineName":"Caripill Syrup / Papaya Leaf Extract","genericName":"Carica Papaya Leaf Extract","dosageForm":"Syrup","strength":"Standard","dosageSchedule":"২ চা চামচ করে দিনে ৩ বার","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৫ - ৭ দিন","instructions":"ডেঙ্গু জ্বরে রক্তের প্লাটিলেট বৃদ্ধিতে সাহায্য করে। প্রচুর তরল ও ডাবের পানি পান করুন।","precautions":"প্লাটিলেট নিয়মিত পরীক্ষা করুন এবং চিকিৎসকের তত্ত্বাবধানে থাকুন।"}]'),
  ('dis-42', 'Menstrual Cramps & Dysmenorrhea', 'মাসিককালীন তীব্র পেটে ব্যথা ও ক্র্যাম্প', 'Endocrinology', 'নারী স্বাস্থ্য', '["মাসিকের সময় তলপেটে তীব্র মোচড় দিয়ে ব্যথা","কোমর ও পায়ে ব্যথা","বমি ভাব ও মেজাজ খিটখিটে হওয়া"]', 'মাসিকের ব্যথা ও পেশীর সংকোচন নিরাময়ের পেইনকিলার।', '[{"medicineName":"Mefat Fort / Ponstan","genericName":"Mefenamic Acid","dosageForm":"Tablet","strength":"500mg","dosageSchedule":"ব্যথা শুরু হলে ১টি, প্রয়োজনে ৮ ঘণ্টা পর আর ১টি","frequencyPerDay":2,"mealTiming":"খাওয়ার পর (ভরা পেটে)","duration":"৩ দিন","instructions":"মাসিককালীন পেটে তীব্র ব্যথা শুরু হলে ভরা পেটে ১টি করে ট্যাবলেট সেব্য।","precautions":"খালি পেটে খাবেন না, গ্যাস্ট্রিকের সমস্যা হতে পারে।"}]'),
  ('dis-43', 'Gout & High Uric Acid', 'ইউরিক এসিড বৃদ্ধি ও গেঁটেবাত', 'General & Pain', 'হাড় ও বাতের রোগ', '["পায়ের বৃদ্ধাঙ্গুল বা জয়েন্টে তীব্র ব্যথা ও লাল হয়ে ফুলে যাওয়া","সকালে জয়েন্টে শক্ত ভাব"]', 'রক্তে ইউরিক এসিড কমানোর জন্য নির্দেশিত ঔষধ।', '[{"medicineName":"Feburic 40 / Urica 40","genericName":"Febuxostat","dosageForm":"Tablet","strength":"40mg / 80mg","dosageSchedule":"১ + ০ + ০ (দিনে ১ বার)","frequencyPerDay":1,"mealTiming":"খাওয়ার আগে বা পরে যেকোনো সময়","duration":"নিয়মিত চলবে","instructions":"রক্তে ইউরিক এসিডের মাত্রা নিয়ন্ত্রণে প্রতিদিন সকালে ১টি ট্যাবলেট।","precautions":"লাল মাংস, সামুদ্রিক মাছ ও ডালজাতীয় খাবার সীমিত করুন। প্রচুর পানি পান করুন।"}]'),
  ('dis-44', 'Vertigo & Dizziness (Motion Sickness)', 'মাথা ঘোরা, বমি ভাব ও ভ্রমণজনিত অস্বস্তি', 'General & Pain', 'স্নায়ু ও মাথা ঘোরা', '["চারপাশ ঘুরে যাওয়ার অনুভূতি","বমি ভাব ও বমি হওয়া","গাড়িতে উঠলে মাথা ঘোরা ও অসুস্থ বোধ"]', 'মাথা ঘোরা ও গাড়িতে বমি ভাব রোধের অ্যান্টিভার্টিগো ঔষধ।', '[{"medicineName":"Vertigast 16 / Vertin","genericName":"Betahistine Dihydrochloride","dosageForm":"Tablet","strength":"16mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে)","frequencyPerDay":2,"mealTiming":"খাওয়ার পর","duration":"৭ - ১৪ দিন","instructions":"মাথা ঘোরা (ভার্টিগো) ও কানের ভেতর ভনভন শব্দ দূর করতে সকালে ও রাতে ১টি করে।","precautions":"পেটে গ্যাস্ট্রিকের সমস্যা থাকলে ভরা পেটে খাবেন।"}]'),
  ('dis-45', 'Acute Chest Pain & Angina Alert', 'বুক ব্যথা ও হৃদরোগজনিত অস্বস্তি (প্রাথমিক)', 'Cardiovascular', 'হৃদরোগ ও বুক ব্যথা', '["বুকের মাঝখানে চাপ ধরা বা তীব্র ব্যথা","ব্যথা বাম হাত, চোয়াল বা পিঠে ছড়িয়ে পড়া","বমি ভাব ও ঠান্ডা ঘাম হওয়া"]', 'হৃদরোগের প্রাথমিক লক্ষণ দেখা দিলে সেব্য জীবনরক্ষাকারী ঔষধ।', '[{"medicineName":"Disprin / Ecosprin 75","genericName":"Aspirin (Acetylsalicylic Acid)","dosageForm":"Tablet","strength":"75mg / 300mg","dosageSchedule":"বুক ব্যথা শুরু হলে তাৎক্ষণিক চিবিয়ে ১টি (৩০০ মিগ্রা)","frequencyPerDay":1,"mealTiming":"জরুরি মুহূর্তে","duration":"তাত্ক্ষণিক ও চিকিৎসকের পরামর্শে","instructions":"হৃদরোগের সন্দেহ হলে অবিলম্বে চিকিৎসকের কাছে যান এবং যাওয়ার পথে অ্যাসপিরিন ট্যাবলেট চিবিয়ে খেয়ে নিন।","precautions":"এটি শুধুমাত্র প্রাথমিক প্রাথমিক সাহায্য; দ্রুত হাসপাতালে যোগাযোগ করুন।"}]'),
  ('dis-46', 'Severe Muscle Cramps & Electrolyte Deficiency', 'পেশীতে তীব্র খিঁচুনি ও পটাশিয়ামের ঘাটতি', 'Supplements & Nutrition', 'পুষ্টি ও মিনারেলস', '["রাতে পায়ে তীব্র টান বা খিঁচুনি ধরা","মাংসপেশী শক্ত হয়ে যাওয়া","শারীরিক দুর্বলতা"]', 'পেশীর খিঁচুনি দূর করার ম্যাগনেসিয়াম ও পটাশিয়াম সাপ্লিমেন্ট।', '[{"medicineName":"Mag-3 / Pan-Mag","genericName":"Magnesium Oxide / Magnesium Hydroxide","dosageForm":"Tablet","strength":"400mg","dosageSchedule":"০ + ০ + ১ (রাতে ঘুমানোর আগে)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর","duration":"২ সপ্তাহ","instructions":"পায়ের পেশীতে টান ও খিঁচুনি দূর করতে রাতে ১টি করে ট্যাবলেট।","precautions":"কিডনি রোগীগণ ডাক্তারের পরামর্শ ছাড়া সেবন করবেন না।"}]'),
  ('dis-47', 'Scabies, Mites & Severe Body Itching', 'সকালের চুলকানি, স্ক্যাবিস ও উকুন', 'Dermatology & Allergy', 'ত্বক ও এলার্জি', '["আঙুলের ফাঁকে, কবজিতে ও শরীরের ভাঁজে তীব্র চুলকানি","রাতে চুলকানি বেড়ে যাওয়া","ছোট লাল ফুসকুড়ি"]', 'স্ক্যাবিস ও পরজীবী চুলকানির জন্য পারমেথ্রিন ক্রিম।', '[{"medicineName":"Scabnil Cream / Perスカl","genericName":"Permethrin","dosageForm":"Cream","strength":"5%","dosageSchedule":"গোসলের পর গলা থেকে পায়ের পাতা পর্যন্ত সারা শরীরে মেখে ৮-১২ ঘণ্টা রাখুন","frequencyPerDay":1,"mealTiming":"বাহ্যিক ব্যবহার (রাতেরবেলা)","duration":"একক বা ৭ দিন পর পুনরায়","instructions":"সারা শরীরে ক্রিমটি ভালোভাবে লাগিয়ে ৮ থেকে ১২ ঘণ্টা রাখার পর সাবান দিয়ে ধুয়ে ফেলুন। পরিবারের সবাইকে একসাথে ব্যবহার করতে হবে।","precautions":"চোখ ও মুখের সংস্পর্শে আনবেন না। কাপড় ও বিছানার চাদর গরম পানিতে ধুয়ে ফেলুন।"}]'),
  ('dis-48', 'Chronic Bronchitis & Smoker Cough', 'দীর্ঘস্থায়ী কাশি ও ব্রংকাইটিস', 'Respiratory', 'শ্বাসতন্ত্র ও ফুসফুস', '["সকালে ঘুম থেকে উঠেই কফসহ কাশি","বুক ভারী লাগা ও শ্বাস নিতে কষ্ট হওয়া"]', 'শ্বাসনালীর কফ ও সর্দি তরল করার এক্সপেক্টোরেন্ট সিরাপ।', '[{"medicineName":"Mucosol Syrup / Ambrox","genericName":"Ambroxol Hydrochloride","dosageForm":"Syrup","strength":"15mg / 5ml","dosageSchedule":"২ চা চামচ করে দিনে ৩ বার","frequencyPerDay":3,"mealTiming":"খাওয়ার পর","duration":"৭ দিন","instructions":"বুকের জমে থাকা শক্ত কফ তরল করে সহজে বের হতে সাহায্য করে।","precautions":"ধূমপান সম্পূর্ণ বর্জন করুন।"}]'),
  ('dis-49', 'Nail Fungus & Athlete’s Foot', 'নখের ফাঙ্গাস ও পায়ের ছত্রাক সংক্রমণ', 'Dermatology & Allergy', 'ত্বক ও ফাঙ্গাস', '["নখ হলুদ ও মোটা হয়ে যাওয়া","নখ ভেঙে যাওয়া","পায়ের আঙ্গুলের ফাঁকে চামড়া ওঠা ও চুলকানি"]', 'নখ ও পায়ের ফাঙ্গাসের চিকিৎসায় অ্যান্টিফাঙ্গাল ঔষধ।', '[{"medicineName":"Itra 100 / Itral","genericName":"Itraconazole","dosageForm":"Capsule","strength":"100mg","dosageSchedule":"১ + ০ + ১ (সকালে ও রাতে ভরা পেটে)","frequencyPerDay":2,"mealTiming":"খাওয়ার ঠিক মাঝখানে (চর্বিযুক্ত খাবারের সাথে)","duration":"১ - ২ সপ্তাহ (পাল্স থেরাপি)","instructions":"নখের ফাঙ্গাসে অত্যন্ত কার্যকর। ভরা পেটে সেবন করলে ভালো শোষিত হয়।","precautions":"লিভারের রোগ থাকলে চিকিৎসকের পরামর্শ নিন।"}]'),
  ('dis-50', 'General Fatigue & Post-Viral Exhaustion', 'ভাইরাল পরবর্তী ক্লান্তি ও শারীরিক শক্তিহীনতা', 'Supplements & Nutrition', 'পুষ্টি ও শক্তি', '["কোনো কাজেই শক্তি না পাওয়া","সারাদিন শুয়ে থাকতে ইচ্ছে করা","মনোযোগের অভাব ও অবসাদ"]', 'শারীরিক এনার্জি ও রোগ প্রতিরোধ ক্ষমতা বাড়াতে জিনসিয়া ও মাল্টিভিটামিন।', '[{"medicineName":"Ginsomin / G-100 / Ginseng","genericName":"Standardized Ginseng Extract + Multivitamins + Minerals","dosageForm":"Capsule","strength":"Standard","dosageSchedule":"১ + ০ + ০ (সকালের নাস্তার পর ১টি)","frequencyPerDay":1,"mealTiming":"খাওয়ার পর (সকালে)","duration":"৩০ দিন","instructions":"শারীরিক দুর্বলতা দূর করে প্রাণশক্তি ফিরিয়ে আনতে প্রতিদিন সকালে ১টি ক্যাপসুল।","precautions":"উচ্চ রক্তচাপ থাকলে চিকিৎসকের পরামর্শ নিয়ে সেবন করুন।"}]');

-- Dumping data for table `wallets` (3 records)
INSERT INTO `wallets` (`id`, `name`, `nameBn`, `type`, `accountNumber`, `bankName`, `branch`, `balance`, `isActive`, `colorCode`, `createdBy`) VALUES
  ('w-cash', 'Main Cash Drawer', 'মূল ক্যাশ ড্রয়ার (নগদ)', 'CASH', '', '', '', 0, 1, '#10B981', 'Admin'),
  ('w-bank', 'Bank Account', 'ব্যাংক হিসাব', 'BANK', '', 'Islami Bank / Dutch-Bangla Bank', 'Main Branch', 0, 1, '#0284C7', 'Admin'),
  ('w-mfs', 'bKash / Nagad Wallet', 'বিকাশ / নগদ ওয়ালেট', 'MFS', '', '', '', 0, 1, '#E11D48', 'Admin');

-- Dumping data for table `expense_categories` (4 records)
INSERT INTO `expense_categories` (`id`, `name`, `nameBn`, `code`, `description`, `budgetMonthly`, `createdBy`) VALUES
  ('exp-cat-1', 'Shop Rent & Service Charge', 'দোকান ভাড়া ও সার্ভিস চার্জ', 'RENT', '', 0, 'Admin'),
  ('exp-cat-2', 'Electricity & Utility Bills', 'বিদ্যুৎ ও অন্যান্য বিল', 'UTIL', '', 0, 'Admin'),
  ('exp-cat-3', 'Entertainment & Tea', 'আপ্যায়ন ও চা-নাস্তা', 'ENTR', '', 0, 'Admin'),
  ('exp-cat-4', 'Packaging & Bags', 'প্যাকেজিং ও ব্যাগ খরচ', 'PACK', '', 0, 'Admin');

-- Dumping data for table `activity_logs` (2 records)
INSERT INTO `activity_logs` (`id`, `timestamp`, `userId`, `userName`, `role`, `action`, `module`, `details`, `ipAddress`, `metadata_json`) VALUES
  ('act-login-1795317954517-8hqw', '22 Nov 2026, 09:25:54 AM', 'usr-1', 'System Administrator (অ্যাডমিন)', 'ADMIN', 'LOGIN', 'User Login Successful', 'User \'System Administrator (অ্যাডমিন)\' (admin) successfully logged in. IP: 114.130.157.245, Location: Dhaka, Bangladesh, Device: Desktop PC (Windows 10/11 · Google Chrome)', '114.130.157.245', '{"targetId":"usr-1","targetName":"System Administrator (অ্যাডমিন)","severity":"info","location":"Dhaka, Bangladesh","device":"Desktop PC (Windows 10/11 · Google Chrome)"}'),
  ('act-login-1795257077603-f9tx', '21 Nov 2026, 04:31:17 PM', 'usr-1', 'System Administrator (অ্যাডমিন)', 'ADMIN', 'LOGIN', 'User Login Successful', 'User \'System Administrator (অ্যাডমিন)\' (admin) successfully logged in. IP: 114.130.157.245, Location: Dhaka, Bangladesh, Device: Desktop PC (Windows 10/11 · Google Chrome)', '114.130.157.245', '{"targetId":"usr-1","targetName":"System Administrator (অ্যাডমিন)","severity":"info","location":"Dhaka, Bangladesh","device":"Desktop PC (Windows 10/11 · Google Chrome)"}');

-- Dumping data for table `sms_config`
INSERT INTO `sms_config` (`id`, `enabled`, `provider`, `apiUrl`, `apiKey`, `senderId`, `username`, `password`, `clientId`, `httpMethod`, `requestFormat`, `customProviders_json`, `customToParam`, `customMsgParam`, `customKeyParam`, `customSenderParam`, `customUserParam`, `customPassParam`, `customHeaders`, `autoSendOnSale`, `autoSendOnPaymentIn`, `autoSendOnInstallmentReminder`, `autoSendOnWarrantyResolved`, `saleTemplate`, `paymentInTemplate`, `dueReminderTemplate`, `warrantyResolvedTemplate`) VALUES (
  'main_sms_config',
  1,
  'greenweb',
  'https://api.greenweb.com.bd/api.php',
  '',
  'DOKANPRO',
  '',
  '',
  '',
  'POST',
  'form',
  '[]',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  1,
  1,
  1,
  1,
  'প্রিয় {customer_name}, {store_name}-এ কেনাকাটার জন্য ধন্যবাদ! চালান #{invoice_no}, মোট: ৳{total_amount}, জমা: ৳{paid_amount}, বর্তমান বকেয়া: ৳{due_amount}। হেল্পলাইন: {store_phone}',
  'প্রিয় {customer_name}, আপনার থেকে ৳{paid_amount} বকেয়া টাকা জমা হয়েছে। রশিদ #{receipt_no}, বর্তমান অবশিষ্ট বকেয়া: ৳{remaining_due}। ধন্যবাদ, {store_name}',
  'সম্মানিত {customer_name}, {store_name}-এ আপনার বর্তমান বকেয়া ৳{current_due} টাকা। অনুগ্রহ করে বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। যোগাযোগ: {store_phone}',
  'সম্মানিত {customer_name}, আপনার ওয়ারেন্টি ক্লেইম (টিকিট #{ticket_no}, {product_name}) সমাধান ({status}) হয়েছে। নোট: {note}। অনুগ্রহ করে দোকান থেকে পণ্যটি সংগ্রহ করার অনুরোধ করা হলো। ধন্যবাদ, {store_name}'
);

-- Dumping data for table `warranty_policies` (4 records)
INSERT INTO `warranty_policies` (`id`, `name`, `nameBn`, `duration`, `durationUnit`, `terms`, `type`, `isDefault`) VALUES
  ('war-pol-1', '1 Year Brand Replacement Warranty', '১ বছর ব্র্যান্ড রিপ্লেসমেন্ট ওয়ারেন্টি', 1, 'YEARS', 'Covers hardware failure and manufacturing defects. Physical damage, broken screen, or liquid damage is strictly void.', 'REPLACEMENT', 1),
  ('war-pol-2', '6 Months Parts & Repair Warranty', '৬ মাস পার্টস ও ফ্রি মেরামত ওয়ারেন্টি', 6, 'MONTHS', 'Includes free servicing labor and genuine spare parts replacement within 6 months of purchase.', 'REPAIR', 0),
  ('war-pol-3', '7 Days Instant Replacement', '৭ দিনের ইন্সট্যান্ট রিপ্লেসমেন্ট', 7, 'DAYS', 'Instant replacement if product exhibits initial functional malfunction within 7 days.', 'REPLACEMENT', 0),
  ('war-pol-4', '2 Years Free Service Warranty', '২ বছর ফ্রি সার্ভিসিং ওয়ারেন্টি', 2, 'YEARS', 'Free technician service labor for 24 months. Parts cost will be charged separately after warranty period.', 'SERVICE', 0);


SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- =========================================================================
-- End of SQL Dump
-- Developed By: Md. Tarikul Islam | Phone: 01312305225 | Sherpur, Sadar, Sherpur
-- =========================================================================
