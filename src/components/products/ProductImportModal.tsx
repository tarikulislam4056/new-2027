import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, X, FileText } from 'lucide-react';
import { UnitType, DEFAULT_PRODUCT_UNITS } from '../../types';
import * as XLSX from 'xlsx';

interface ProductImportModalProps {
  onClose: () => void;
}

interface ParsedImportRow {
  name: string;
  nameBn?: string;
  sku: string;
  barcode: string;
  categoryId: string;
  categoryName: string;
  generic: string;
  manufacturer: string;
  strength: string;
  dosageForm: string;
  dosageSchedule: string;
  purchasePrice: number;
  salesPrice: number;
  csvStock: number;
  unit: UnitType;
  reorderLevel: number;
  batchNumber: string;
  expDate: string;
  rackLocation: string;
  stripSize?: number;
  purchaseUnit?: UnitType;
  unitConversion?: number;
  description: string;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({ onClose }) => {
  const { language, categories, bulkImportProducts, companySettings } = useApp();
  const isPharmacyMode = companySettings?.businessModule === 'pharmacy';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [importStockFromCsv, setImportStockFromCsv] = useState<boolean>(false);

  // Sample CSV template download (matches Products List columns cleanly with 0 default stock)
  const downloadSampleCSV = () => {
    const headers = isPharmacyMode
      ? 'Product Name,Bangla Name,SKU,Barcode,Category,Generic,Brand / Manufacturer,Strength,Dosage Form,Dosage Schedule,Batch No,Expiry Date,Purchase Price (Tk),Sales Price (Tk),Stock Qty,Unit,Purchase Unit,Unit Conversion,Reorder Level,Rack Location,Description\n'
      : 'Product Name,Bangla Name,SKU,Barcode,Category,Brand / Manufacturer,Batch No,Expiry Date,Purchase Price (Tk),Sales Price (Tk),Stock Qty,Unit,Purchase Unit,Unit Conversion,Reorder Level,Rack Location,Description\n';
    const sample1 = isPharmacyMode
      ? 'Napa Extra,নাপা এক্সট্রা,NAPA-EXT-500,8901234567890,Medicine,Paracetamol + Caffeine,Beximco Pharmaceuticals,500mg+65mg,Tablet,১+০+১ ভরা পেটে,BAT99,2028-12-31,2.10,2.50,0,Pcs,Box,10,10,Rack A-01,\n'
      : 'Biscuit Carton,বিস্কুট কার্টন,BIS-CTN-001,8901234567890,Grocery,Olympic Industries,BAT101,2027-12-31,100.00,120.00,0,Pcs,CTN,12,5,Rack A-01,\n';
    const sample2 = isPharmacyMode
      ? 'Seclo 20mg,সেকলো ২০ মিগ্রা,SECLO-20,8909876543210,Medicine,Omeprazole,Square Pharmaceuticals,20mg,Capsule,১+০+১ খাওয়ার আগে,SEC102,2027-10-15,5.00,6.00,0,Pcs,Box,10,10,Rack B-02,\n'
      : 'Miniket Rice 50Kg,মিনিকেট চাল ৫০ কেজি,RICE-50K-002,8909876543210,Grocery,ACI Foods,BAT102,,3200.00,3500.00,0,Bag,Bag,1,3,Rack B-02,\n';

    // Create UTF-8 BOM so Excel opens Bengali and Unicode text properly
    const blob = new Blob(['\uFEFF' + headers + sample1 + sample2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', isPharmacyMode ? 'pharmacy_product_import_template.csv' : 'dokan_product_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Shared matrix parser for both Excel (.xlsx/.xls) and CSV files
  const parseRowsFromMatrix = (matrix: any[][]): ParsedImportRow[] => {
    if (!matrix || matrix.length === 0) return [];

    // Preserve Bengali & English characters while normalizing separators
    const normalizeHeader = (h: any) =>
      String(h ?? '')
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_\-./()৳%]+/g, '');

    const headers = matrix[0].map(normalizeHeader);
    const hasHeader = headers.some(
      h =>
        h.includes('name') ||
        h.includes('sku') ||
        h.includes('price') ||
        h.includes('product') ||
        h.includes('stock') ||
        h.includes('category') ||
        h.includes('generic') ||
        h.includes('barcode') ||
        h.includes('item') ||
        h.includes('নাম') ||
        h.includes('পণ্য') ||
        h.includes('স্টক')
    );

    const parseNumeric = (raw: string | undefined, fallback = 0): number => {
      if (!raw) return fallback;
      const cleaned = raw.replace(/[৳$,\s%]/g, '').trim();
      if (!cleaned) return fallback;
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : fallback;
    };

    const startIndex = hasHeader ? 1 : 0;
    const rows: ParsedImportRow[] = [];
    const baseTs = Date.now();

    for (let i = startIndex; i < matrix.length; i++) {
      const rowData = matrix[i].map((val: any) => String(val !== undefined && val !== null ? val : '').trim());
      if (rowData.length === 0 || !rowData.some(val => val !== '')) continue;

      const getByHeader = (predicate: (h: string) => boolean, fallbackIdx?: number): string => {
        if (hasHeader) {
          const idx = headers.findIndex(predicate);
          if (idx !== -1) {
            return (rowData[idx] ?? '').trim();
          }
          return '';
        }
        return fallbackIdx !== undefined ? (rowData[fallbackIdx] ?? '').trim() : '';
      };

      // 1. Name & SKU (also supports legacy "Item & SKU" column format like "Napa Extra (NAPA-EXT-500)")
      let rawName =
        getByHeader(
          h =>
            h === 'productname' ||
            h === 'name' ||
            h === 'itemname' ||
            h === 'medicine' ||
            h === 'medicinename' ||
            h === 'পণ্যেরনাম' ||
            h === 'নাম'
        ) ||
        getByHeader(
          h =>
            (h.includes('productname') ||
              h.includes('itemname') ||
              h.includes('title') ||
              (h.includes('name') &&
                !h.includes('bangla') &&
                !h.includes('cat') &&
                !h.includes('comp') &&
                !h.includes('brand') &&
                !h.includes('generic'))) &&
            !h.includes('code'),
          0
        ) ||
        getByHeader(h => h.includes('item&sku') || h.includes('itemsku'));

      const nameBn = getByHeader(h => h.includes('bangla') || h.includes('namebn') || h.includes('বাংলানাম'));

      let rawSku = getByHeader(
        h => h === 'sku' || h === 'itemcode' || h === 'productcode' || h === 'code' || (h.includes('sku') && !h.includes('item')),
        1
      );

      // Extract "Name (SKU)" if combined column was used without separate SKU
      if (!rawSku && rawName) {
        const parenMatch = rawName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (parenMatch) {
          rawName = parenMatch[1].trim();
          rawSku = parenMatch[2].trim();
        }
      }

      const isPlaceholderVal = (val: string) =>
        ['-', '--', 'n/a', 'na', 'none', 'null', 'nil', '0', 'undefined'].includes(val.trim().toLowerCase());

      const name = rawName || (hasHeader ? (rowData[0] || `Product ${i}`) : `Product ${i}`);
      const sku = rawSku && !isPlaceholderVal(rawSku) ? rawSku : `SKU-${baseTs}-${i}`;

      const rawBarcode = getByHeader(h => h.includes('barcode') || h.includes('ean') || h.includes('upc') || h.includes('বারকোড'), 2);
      const barcode =
        rawBarcode && !isPlaceholderVal(rawBarcode)
          ? rawBarcode
          : `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

      const categoryName =
        getByHeader(h => h.includes('category') || h === 'cat' || h.includes('ক্যাটাগরি'), 3) || 'General';
      const generic = getByHeader(h => h.includes('generic') || h.includes('জেনেরিক'), 4);
      const manufacturer = getByHeader(
        h =>
          h.includes('manufacturer') ||
          h.includes('brand') ||
          h.includes('company') ||
          h.includes('কোম্পানি') ||
          h.includes('ব্র্যান্ড'),
        5
      );
      const strength = getByHeader(h => h.includes('strength') || h === 'mg' || h.includes('স্ট্রেন্থ') || h.includes('শক্তি'), 6);
      const dosageForm =
        getByHeader(h => h.includes('dosageform') || h === 'form' || h.includes('ডোজফরম') || h.includes('টাইপ'), 7) ||
        getByHeader(h => h.includes('dosage') && !h.includes('schedule') && !h.includes('rule'));
      const dosageSchedule = getByHeader(
        h => h.includes('dosageschedule') || h.includes('dosage&rules') || h.includes('dosagerules') || h.includes('সেবনবিধি')
      );

      const rawPurchase = getByHeader(
        h =>
          (h.includes('purchase') || h.includes('cost') || h.includes('buy') || h.includes('ক্রয়')) &&
          !h.includes('total') &&
          !h.includes('valuation') &&
          !h.includes('asset') &&
          !h.includes('unit') &&
          !h.includes('conversion'),
        8
      );
      const purchasePrice = Math.max(0, parseNumeric(rawPurchase, 0));

      const rawSales = getByHeader(
        h =>
          (h.includes('salesprice') ||
            h.includes('saleprice') ||
            h.includes('retailprice') ||
            h === 'price' ||
            h.includes('sale') ||
            h.includes('retail') ||
            h.includes('mrp') ||
            h.includes('বিক্রয়')) &&
          !h.includes('total') &&
          !h.includes('valuation') &&
          !h.includes('asset'),
        9
      );
      const salesPrice = Math.max(0, parseNumeric(rawSales, 0));

      // Stock: STRICTLY read from Stock/Qty column when headers exist (NEVER fall back to rowData[10]!)
      const rawStock = getByHeader(
        h => h.includes('stock') || h === 'qty' || h.includes('stockqty') || h.includes('quantity') || h.includes('স্টক'),
        10
      );
      const csvStock = Math.max(0, parseNumeric(rawStock, 0));

      const rawUnit =
        getByHeader(
          h =>
            (h.includes('unit') || h.includes('measure') || h.includes('একক')) &&
            !h.includes('purchaseunit') &&
            !h.includes('buyunit') &&
            !h.includes('bulkunit') &&
            !h.includes('conversion') &&
            !h.includes('conv'),
          11
        ) || '';
      const validUnits = companySettings?.productUnits !== undefined ? companySettings.productUnits : DEFAULT_PRODUCT_UNITS;
      const matchedUnit =
        (rawUnit
          ? validUnits.find(u => u.toLowerCase() === rawUnit.toLowerCase()) || rawUnit
          : validUnits[0] || 'Pcs') as UnitType;

      const rawPurchaseUnit = getByHeader(
        h =>
          h === 'purchaseunit' ||
          h === 'buyunit' ||
          h === 'bulkunit' ||
          h.includes('purchaseunit') ||
          h.includes('ক্রয়একক')
      );
      const matchedPurchaseUnit = rawPurchaseUnit
        ? ((validUnits.find(u => u.toLowerCase() === rawPurchaseUnit.toLowerCase()) || rawPurchaseUnit) as UnitType)
        : undefined;

      const rawConversion = getByHeader(
        h =>
          h === 'unitconversion' ||
          h === 'conversion' ||
          h === 'conversionfactor' ||
          h.includes('conversion') ||
          h.includes('perbulk') ||
          h.includes('কনভার্সন')
      );
      const parsedConversion = parseNumeric(rawConversion, 1);
      const hasDualImportUnit =
        Boolean(matchedPurchaseUnit) &&
        matchedPurchaseUnit!.toLowerCase() !== matchedUnit.toLowerCase() &&
        parsedConversion > 1;

      const rawReorder = getByHeader(h => h.includes('reorder') || h.includes('minstock') || h.includes('alert'), 12);
      const reorderLevel = Math.max(0, parseNumeric(rawReorder, 5));

      const batchNumber = getByHeader(h => h.includes('batch') || h.includes('lot') || h.includes('ব্যাচ'), 13);

      // Expiry date: never confuse with "Added Date" / "Date Added"
      const expDate = getByHeader(
        h =>
          h.includes('exp') ||
          h.includes('expiry') ||
          h.includes('মেয়াদ') ||
          (h.includes('date') && !h.includes('added') && !h.includes('creat')),
        14
      );

      const rackLocation = getByHeader(
        h => h.includes('rack') || h.includes('shelf') || h.includes('location') || h.includes('র‍্যাক') || h.includes('র্যাক'),
        15
      );
      const rawStrip = getByHeader(h => h.includes('strip') || h.includes('packsize') || h.includes('পাতা'), 16);
      const stripSizeParsed = parseInt(rawStrip, 10);
      const stripSize = Number.isFinite(stripSizeParsed) && stripSizeParsed > 0 ? stripSizeParsed : undefined;

      const description = getByHeader(h => h.includes('desc') || h.includes('detail') || h.includes('বিবরণ'), 17);

      const matchedCat = categories.find(c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase());

      rows.push({
        name,
        nameBn: nameBn || undefined,
        sku,
        barcode,
        categoryId: matchedCat ? matchedCat.id : '',
        categoryName: matchedCat ? matchedCat.name : categoryName,
        generic: isPharmacyMode ? generic : '',
        manufacturer,
        strength: isPharmacyMode ? strength : '',
        dosageForm: isPharmacyMode ? dosageForm : '',
        dosageSchedule: isPharmacyMode ? dosageSchedule : '',
        purchasePrice,
        salesPrice,
        csvStock,
        unit: matchedUnit,
        reorderLevel,
        batchNumber,
        expDate,
        rackLocation,
        stripSize: isPharmacyMode ? stripSize : undefined,
        purchaseUnit: hasDualImportUnit ? matchedPurchaseUnit : undefined,
        unitConversion: hasDualImportUnit ? parsedConversion : undefined,
        description,
      });
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 1) {
            setErrorMsg(language === 'bn' ? 'এক্সেল ফাইলটি খালি।' : 'Excel file is empty.');
            return;
          }

          const rows = parseRowsFromMatrix(jsonData);
          if (rows.length === 0) {
            setErrorMsg(language === 'bn' ? 'এক্সেল ফাইলে কোনো বৈধ পণ্য পাওয়া যায়নি।' : 'No valid product rows found in Excel file.');
          } else {
            setParsedRows(rows);
          }
        } catch (err: any) {
          setErrorMsg(language === 'bn' ? 'এক্সেল ফাইল পড়তে সমস্যা হয়েছে: ' + err.message : 'Error reading Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV handling
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const rawText = (event.target?.result as string) || '';
          const fileText = rawText.replace(/^\uFEFF/, '');
          const lines = fileText ? fileText.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean) : [];
          if (lines.length < 1) {
            setErrorMsg(language === 'bn' ? 'ফাইলটি খালি।' : 'File is empty.');
            return;
          }

          const firstLine = lines[0];
          const countUnquotedDelimiter = (line: string, delim: string): number => {
            let count = 0;
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') {
                inQuotes = !inQuotes;
              } else if (ch === delim && !inQuotes) {
                count++;
              }
            }
            return count;
          };
          const commaCount = countUnquotedDelimiter(firstLine, ',');
          const semiCount = countUnquotedDelimiter(firstLine, ';');
          const tabCount = countUnquotedDelimiter(firstLine, '\t');
          const delimiter =
            semiCount > commaCount && semiCount >= tabCount
              ? ';'
              : tabCount > commaCount && tabCount > semiCount
              ? '\t'
              : ',';

          const parseRow = (line: string, delim: string): string[] => {
            const result: string[] = [];
            let insideQuote = false;
            let entry = '';
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                if (insideQuote && line[i + 1] === '"') {
                  entry += '"';
                  i++;
                } else {
                  insideQuote = !insideQuote;
                }
              } else if (char === delim && !insideQuote) {
                result.push(entry.trim());
                entry = '';
              } else {
                entry += char;
              }
            }
            result.push(entry.trim());
            return result;
          };

          const matrix = lines.map(line => parseRow(line, delimiter));
          const rows = parseRowsFromMatrix(matrix);

          if (rows.length === 0) {
            setErrorMsg(
              language === 'bn'
                ? 'কোনো বৈধ পণ্যের তথ্য পাওয়া যায়নি। দয়া করে স্যাম্পল টেমপ্লেট ব্যবহার করুন।'
                : 'No valid product rows found in file. Please ensure columns match the sample template.'
            );
          } else {
            setParsedRows(rows);
          }
        } catch (err: any) {
          setErrorMsg(language === 'bn' ? 'ফাইল পড়তে সমস্যা হয়েছে: ' + err.message : 'Error parsing file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

    // Allow re-uploading the same file after editing
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setTimeout(() => {
      const productsToImport = parsedRows.map(({ csvStock, ...rest }) => ({
        ...rest,
        stock: importStockFromCsv ? Math.max(0, Number(csvStock || 0)) : 0,
      }));
      bulkImportProducts(productsToImport);
      setImporting(false);
      onClose();
    }, 300);
  };

  const csvHasAnyStock = parsedRows.some(r => r.csvStock > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {language === 'bn' ? 'বাল্ক প্রোডাক্ট ইমপোর্ট (Excel / CSV)' : 'Bulk Product Import (CSV / Excel)'}
              </h3>
              <p className="text-xs text-zinc-500">
                {language === 'bn' ? 'একসাথে শত শত পণ্য ফাইল থেকে আপলোড করুন' : 'Import multiple products at once via CSV or Excel file'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Step 1: Download Template */}
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {language === 'bn' ? '১. প্রথমে স্যাম্পল টেমপ্লেট ডাউনলোড করুন' : '1. Download Sample CSV Template'}
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  {language === 'bn'
                    ? 'সঠিক কলাম ফরম্যাট বজায় রাখতে স্যাম্পল ফাইলটি ডাউনলোড করে পণ্যের তথ্য বসান। ডিফল্টভাবে সকল পণ্যের Stock ০ (শূন্য) থাকবে।'
                    : 'Download our sample CSV template to ensure correct column formatting. Imported products default to 0 stock unless opted in.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadSampleCSV}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'টেমপ্লেট ডাউনলোড' : 'Download Template'}</span>
            </button>
          </div>

          {/* Step 2: File Upload Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {language === 'bn' ? '২. আপনার পূরণকৃত CSV / Excel ফাইল আপলোড করুন' : '2. Upload Filled CSV / Excel File'}
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="p-3 bg-white dark:bg-zinc-800 rounded-full shadow-xs text-blue-600 dark:text-blue-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {fileName ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> {fileName} ({parsedRows.length} items ready)
                  </span>
                ) : (
                  language === 'bn' ? 'ফাইল সিলেক্ট করতে এখানে ক্লিক করুন অথবা ড্র্যাগ করুন' : 'Click to browse or drag and drop your CSV file here'
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono">Supports .xlsx, .xls, .csv files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Stock Import Safety Option */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={importStockFromCsv}
              onChange={e => setImportStockFromCsv(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <div className="text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                {language === 'bn'
                  ? 'CSV/Excel ফাইলের Stock কলাম থেকে স্টক ইমপোর্ট করুন (ঐচ্ছিক)'
                  : 'Import opening Stock quantity from CSV/Excel Stock column (Optional)'}
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                {language === 'bn'
                  ? 'এটি বন্ধ রাখলে CSV আপলোডে কোনো অটো স্টক যোগ হবে না (সব পণ্যের Stock = 0 থাকবে এবং পরবর্তীতে Purchase এন্ট্রির মাধ্যমে স্টক যুক্ত হবে)।'
                  : 'When unchecked, no stock is added automatically from CSV (all imported products start with Stock = 0).'}
                {csvHasAnyStock && !importStockFromCsv && (
                  <span className="ml-1 font-semibold text-amber-950 dark:text-amber-100">
                    {language === 'bn'
                      ? ' (ফাইলে থাকা Stock উপেক্ষা করে ০ সেট করা হয়েছে)'
                      : ' (CSV stock values ignored and set to 0)'}
                  </span>
                )}
              </p>
            </div>
          </label>

          {/* Preview Table if rows loaded */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {language === 'bn' ? `প্রিভিউ (${parsedRows.length} টি পণ্য পাওয়া গেছে)` : `Preview (${parsedRows.length} products detected)`}
                </h4>
                <span className="text-[11px] text-emerald-600 font-semibold">Ready to import</span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs">
                <table className="w-full text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 font-mono">SKU</th>
                      <th className="py-2.5 px-3 font-mono">Category</th>
                      <th className="py-2.5 px-3 text-right font-mono">Purchase</th>
                      <th className="py-2.5 px-3 text-right font-mono">Sales</th>
                      <th className="py-2.5 px-3 text-center font-mono">Stock</th>
                      <th className="py-2.5 px-3 font-mono">Exp Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {parsedRows.map((row, idx) => {
                      const effectiveStock = importStockFromCsv ? row.csvStock : 0;
                      return (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2 px-3 font-bold text-zinc-900 dark:text-white">{row.name}</td>
                          <td className="py-2 px-3 font-mono text-zinc-500">{row.sku}</td>
                          <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{row.categoryName}</td>
                          <td className="py-2 px-3 text-right font-mono">{row.purchasePrice}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{row.salesPrice}</td>
                          <td className="py-2 px-3 text-center font-mono">
                            <div>{effectiveStock} {row.unit}</div>
                            {row.purchaseUnit && row.unitConversion && row.unitConversion > 1 && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                1 {row.purchaseUnit} = {row.unitConversion} {row.unit}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-rose-600 text-[11px]">{row.expDate || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={parsedRows.length === 0 || importing}
            onClick={handleConfirmImport}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            {importing ? (
              <span>Importing...</span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? `${parsedRows.length} টি পণ্য ইমপোর্ট করুন` : `Import ${parsedRows.length} Products`}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
