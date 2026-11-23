import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/translations';
import { Product, ProductBatch, UnitType, WarrantyPeriodType, WarrantyType, DEFAULT_PRODUCT_UNITS } from '../../types';
import { Package, X, Save, Calendar, Percent, Upload, Image as ImageIcon, Trash2, ShieldCheck, Tag, AlertCircle, RotateCcw, Camera, Plus } from 'lucide-react';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { canUserDelete } from '../../utils/permissions';
import { formatCartonBreakdown, formatCleanNumber } from '../../utils/unitConversion';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { language, categories, products, addProduct, updateProduct, showToast, companySettings, updateCompanySettings, currentUser } = useApp();
  const { t } = useTranslation(language);

  const isPharmacyMode = companySettings?.businessModule === 'pharmacy';
  const hasDeletePermission = canUserDelete(currentUser, 'product');
  const configuredUnits = companySettings.productUnits !== undefined ? companySettings.productUnits : DEFAULT_PRODUCT_UNITS;

  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [salesPrice, setSalesPrice] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [expDate, setExpDate] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [generic, setGeneric] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [strength, setStrength] = useState<string>('');
  const [dosageForm, setDosageForm] = useState<string>('');
  const [dosageSchedule, setDosageSchedule] = useState<string>('');
  const [rackLocation, setRackLocation] = useState<string>('');
  const [stock, setStock] = useState<string>('');
  const [unit, setUnit] = useState<UnitType>('Pcs');
  const [purchaseUnit, setPurchaseUnit] = useState<string>('');
  const [unitConversion, setUnitConversion] = useState<string>('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('5');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Warranty States
  const [hasWarranty, setHasWarranty] = useState<boolean>(false);
  const [warrantyDuration, setWarrantyDuration] = useState<number>(1);
  const [warrantyUnit, setWarrantyUnit] = useState<WarrantyPeriodType>('YEARS');
  const [warrantyType, setWarrantyType] = useState<WarrantyType>('REPLACEMENT');
  const [warrantyTerms, setWarrantyTerms] = useState<string>('');
  const [requiresSerialNo, setRequiresSerialNo] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [showUnitManager, setShowUnitManager] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');

  const unitOptions = unit && !configuredUnits.includes(unit) ? [...configuredUnits, unit] : configuredUnits;

  const handleQuickAddUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    if (configuredUnits.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      const matched = configuredUnits.find(u => u.toLowerCase() === trimmed.toLowerCase()) || trimmed;
      setUnit(matched as UnitType);
      setNewUnitInput('');
      showToast(language === 'bn' ? `"${matched}" ইতিমধ্যে আছে, সিলেক্ট করা হয়েছে।` : `"${matched}" already exists and selected.`, 'info');
      return;
    }
    const updated = [...configuredUnits, trimmed];
    updateCompanySettings({ productUnits: updated });
    setUnit(trimmed as UnitType);
    setNewUnitInput('');
    showToast(language === 'bn' ? `নতুন Unit "${trimmed}" যুক্ত হয়েছে।` : `Unit "${trimmed}" added.`, 'success');
  };

  const handleQuickDeleteUnit = (item: string) => {
    if (!hasDeletePermission) {
      showToast(language === 'bn' ? 'আপনার Unit ডিলিট করার অনুমতি নেই' : 'You do not have permission to delete units', 'error');
      return;
    }
    if (configuredUnits.length <= 1) {
      showToast(language === 'bn' ? 'কমপক্ষে ১টি Unit থাকতে হবে।' : 'At least 1 unit must remain.', 'error');
      return;
    }
    const updated = configuredUnits.filter(u => u !== item);
    updateCompanySettings({ productUnits: updated });
    if (unit === item) {
      setUnit((updated[0] || 'Pcs') as UnitType);
    }
    showToast(language === 'bn' ? `Unit "${item}" মুছে ফেলা হয়েছে।` : `Unit "${item}" deleted.`, 'info');
  };

  // Keep track of when modal opens to prevent resetting while typing
  useEffect(() => {
    if (!isOpen) return;

    if (productToEdit) {
      setName(productToEdit.name || '');
      setNameBn(productToEdit.nameBn || '');
      setSku(productToEdit.sku || '');
      setBarcode(productToEdit.barcode || '');
      setCategoryId(productToEdit.categoryId || categories[0]?.id || '');
      setPurchasePrice(productToEdit.purchasePrice?.toString() || '');
      setSalesPrice(productToEdit.salesPrice?.toString() || '');
      setDiscount(productToEdit.discount?.toString() || '0');
      setDiscountType(productToEdit.discountType || 'percentage');
      setExpDate(productToEdit.expDate || '');
      setBatchNumber(productToEdit.batchNumber || '');
      setGeneric(productToEdit.generic || '');
      setManufacturer(productToEdit.manufacturer || '');
      setStrength(productToEdit.strength || '');
      setDosageForm(productToEdit.dosageForm || '');
      setDosageSchedule(productToEdit.dosageSchedule || '');
      setRackLocation(productToEdit.rackLocation || '');
      setStock(productToEdit.stock?.toString() || '0');
      setUnit(productToEdit.unit || 'Pcs');
      const editPUnit = productToEdit.purchaseUnit || '';
      const editConv = productToEdit.unitConversion && productToEdit.unitConversion > 1 ? String(productToEdit.unitConversion) : '';
      setPurchaseUnit(editPUnit);
      setUnitConversion(editConv);
      if (editPUnit && editConv && productToEdit.purchasePrice) {
        setBulkPurchasePrice(formatCleanNumber(Number(productToEdit.purchasePrice) * Number(editConv)));
      } else {
        setBulkPurchasePrice('');
      }
      setReorderLevel(productToEdit.reorderLevel?.toString() || '5');
      setDescription(productToEdit.description || '');
      setImageUrl(productToEdit.imageUrl || productToEdit.image || '');
      setHasWarranty(productToEdit.hasWarranty || false);
      setWarrantyDuration(productToEdit.warrantyDuration || 1);
      setWarrantyUnit(productToEdit.warrantyUnit || 'YEARS');
      setWarrantyType(productToEdit.warrantyType || 'REPLACEMENT');
      setWarrantyTerms(productToEdit.warrantyTerms || '');
      setRequiresSerialNo(productToEdit.requiresSerialNo || false);
    } else {
      setName('');
      setNameBn('');
      setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
      setBarcode(`${Date.now().toString().slice(-8)}`);
      setCategoryId(categories[0]?.id || '');
      setPurchasePrice('');
      setSalesPrice('');
      setDiscount('0');
      setDiscountType('percentage');
      setExpDate('');
      setBatchNumber('');
      setGeneric('');
      setManufacturer('');
      setStrength('');
      setDosageForm('');
      setDosageSchedule('');
      setRackLocation('');
      setStock('0');
      setUnit((configuredUnits[0] || 'Pcs') as UnitType);
      setPurchaseUnit('');
      setUnitConversion('');
      setBulkPurchasePrice('');
      setReorderLevel('5');
      setDescription('');
      setImageUrl('');
      setHasWarranty(false);
      setWarrantyDuration(1);
      setWarrantyUnit('YEARS');
      setWarrantyType('REPLACEMENT');
      setWarrantyTerms('');
      setRequiresSerialNo(false);
    }
  }, [isOpen, productToEdit?.id]);

  if (!isOpen) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(language === 'bn' ? 'ছবির সাইজ ৫ মেগাবাইটের কম হতে হবে।' : 'Image size should be less than 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        // Optimize & compress image using canvas for SQL/cPanel storage
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
            setImageUrl(compressedBase64);
            showToast(language === 'bn' ? 'পণ্যর ছবি সফলভাবে আপলোড ও প্রক্রিয়াজাত হয়েছে।' : 'Product image uploaded and processed successfully.', 'success');
          } else {
            setImageUrl(result);
          }
        };
        img.onerror = () => setImageUrl(result);
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const trimmedBarcode = barcode.trim();
  const duplicateBarcodeProduct = trimmedBarcode
    ? products.find(
        p =>
          p.id !== productToEdit?.id &&
          p.barcode &&
          p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase()
      )
    : null;
  const isDuplicateBarcode = Boolean(duplicateBarcodeProduct);

  const trimmedSku = sku.trim();
  const duplicateSkuProduct = trimmedSku
    ? products.find(
        p =>
          p.id !== productToEdit?.id &&
          p.sku &&
          p.sku.trim().toLowerCase() === trimmedSku.toLowerCase()
      )
    : null;
  const isDuplicateSku = Boolean(duplicateSkuProduct);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !purchasePrice || !salesPrice) {
      showToast(language === 'bn' ? 'পণ্যের নাম ও মূল্য প্রদান করুন।' : 'Please enter product name and prices.', 'warning');
      return;
    }

    if (isDuplicateBarcode) {
      showToast(
        language === 'bn'
          ? `আগে থেকে এই নং এন্ট্রি আছে! বারকোড (${trimmedBarcode}) ইতিমধ্যে "${duplicateBarcodeProduct?.name}" পণ্যে ব্যবহৃত। একই কোড দুইবার এন্ট্রি হবে না।`
          : `This number is already entered previously! Barcode (${trimmedBarcode}) is already used by "${duplicateBarcodeProduct?.name}".`,
        'error'
      );
      return;
    }

    if (isDuplicateSku) {
      showToast(
        language === 'bn'
          ? `আগে থেকে এই নং এন্ট্রি আছে! SKU কোড (${trimmedSku}) ইতিমধ্যে "${duplicateSkuProduct?.name}" পণ্যে ব্যবহৃত। একই কোড দুইবার এন্ট্রি হবে না।`
          : `This number is already entered previously! SKU code (${trimmedSku}) is already used by "${duplicateSkuProduct?.name}".`,
        'error'
      );
      return;
    }

    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(salesPrice) || 0;
    const parsedStock = parseFloat(stock);
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedReorder = parseInt(reorderLevel);

    if (pPrice < 0 || sPrice < 0) {
      showToast(
        language === 'bn' ? 'ক্রয় বা বিক্রয় মূল্য ঋণাত্মক (-) হতে পারবে না!' : 'Purchase or sales price cannot be negative!',
        'error'
      );
      return;
    }

    if (Number.isFinite(parsedStock) && parsedStock < 0) {
      showToast(
        language === 'bn' ? 'পণ্যের স্টক ঋণাত্মক (-) হতে পারবে না!' : 'Product stock cannot be negative!',
        'error'
      );
      return;
    }

    if (parsedDiscount < 0 || (Number.isFinite(parsedReorder) && parsedReorder < 0)) {
      showToast(
        language === 'bn' ? 'ডিসকাউন্ট বা লো-স্টক লিমিট ঋণাত্মক (-) হতে পারবে না!' : 'Discount or reorder limit cannot be negative!',
        'error'
      );
      return;
    }

    const safeStock = Math.max(0, Number.isFinite(parsedStock) ? parsedStock : 0);

    let updatedBatches: ProductBatch[] | undefined = undefined;
    const cleanExp = expDate.trim() || undefined;
    const cleanBatch = batchNumber.trim() || undefined;

    if (productToEdit?.batches && productToEdit.batches.length > 0) {
      if (productToEdit.batches.length === 1) {
        updatedBatches = [{
          ...productToEdit.batches[0],
          expDate: cleanExp,
          batchNumber: cleanBatch || productToEdit.batches[0].batchNumber,
          stock: stock.trim() !== '' ? safeStock : Math.max(0, Number(productToEdit.batches[0].stock || 0)),
        }];
      } else {
        // When user updates expiry date at product level, synchronize all batches with the new expiry date
        updatedBatches = productToEdit.batches.map((b, idx) => ({
          ...b,
          stock: Math.max(0, Number(b.stock || 0)),
          expDate: cleanExp,
          batchNumber: (cleanBatch && idx === 0) ? cleanBatch : b.batchNumber,
        }));
      }
    } else if (cleanExp || cleanBatch) {
      updatedBatches = [{
        id: `batch-${Date.now()}`,
        batchNumber: cleanBatch || 'B-01',
        expDate: cleanExp,
        stock: safeStock,
        initialStock: safeStock,
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: pPrice,
        salesPrice: sPrice,
      }];
    }

    const convNum = parseFloat(unitConversion) || 0;
    const isDualUnitValid = Boolean(
      purchaseUnit &&
      convNum > 1 &&
      purchaseUnit.trim().toLowerCase() !== unit.trim().toLowerCase()
    );

    const payload = {
      name: name.trim(),
      nameBn: nameBn.trim() || name.trim(),
      sku: trimmedSku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: trimmedBarcode || Date.now().toString(),
      categoryId: categoryId || categories[0]?.id || 'cat-1',
      categoryName: categories.find(c => c.id === categoryId)?.name || 'General',
      purchasePrice: Math.max(0, pPrice),
      salesPrice: Math.max(0, sPrice),
      discount: Math.max(0, parsedDiscount),
      discountType,
      expDate: cleanExp,
      batchNumber: cleanBatch,
      batches: updatedBatches,
      generic: isPharmacyMode ? (generic.trim() || undefined) : undefined,
      manufacturer: manufacturer.trim() || undefined,
      strength: isPharmacyMode ? (strength.trim() || undefined) : undefined,
      dosageForm: isPharmacyMode ? (dosageForm.trim() || undefined) : undefined,
      dosageSchedule: isPharmacyMode ? (dosageSchedule.trim() || undefined) : undefined,
      rackLocation: rackLocation.trim() || undefined,
      stock: safeStock,
      unit,
      purchaseUnit: isDualUnitValid ? (purchaseUnit as UnitType) : undefined,
      unitConversion: isDualUnitValid ? convNum : undefined,
      reorderLevel: Math.max(0, Number.isFinite(parsedReorder) ? parsedReorder : 5),
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      image: imageUrl.trim() || undefined,
      hasWarranty,
      warrantyDuration: hasWarranty ? warrantyDuration : undefined,
      warrantyUnit: hasWarranty ? warrantyUnit : undefined,
      warrantyType: hasWarranty ? warrantyType : undefined,
      warrantyTerms: hasWarranty ? warrantyTerms.trim() : undefined,
      requiresSerialNo,
    };

    if (productToEdit) {
      updateProduct(productToEdit.id, payload);
    } else {
      addProduct(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-2xs p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {productToEdit ? (language === 'bn' ? 'পণ্য সম্পাদনা' : 'Edit Product') : (language === 'bn' ? 'নতুন পণ্য যোগ করুন' : 'Add New Product')}
            </h3>
            {companySettings?.businessModule === 'pharmacy' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                💊 ফার্মেসী মোড
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                🏪 দোকান মোড
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Product Name (নাম) *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Miniket Rice 25kg"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                পণ্যের নাম (বাংলা)
              </label>
              <input
                type="text"
                value={nameBn}
                onChange={e => setNameBn(e.target.value)}
                placeholder="যেমন: মিনিকেট চাল ২৫ কেজি"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Category (ক্যাটেগরি) *
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {language === 'bn' && c.nameBn ? c.nameBn : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'বিক্রয় / মূল একক *' : 'Sales / Base Unit *'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowUnitManager(prev => !prev)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === 'bn' ? (showUnitManager ? 'বন্ধ করুন' : 'নতুন / ডিলিট') : (showUnitManager ? 'Close' : 'Add / Delete')}</span>
                </button>
              </div>
              <select
                value={unit}
                onChange={e => {
                  const newUnit = e.target.value as UnitType;
                  setUnit(newUnit);
                  if (purchaseUnit && purchaseUnit.toLowerCase() === newUnit.toLowerCase()) {
                    setPurchaseUnit('');
                    setUnitConversion('');
                    setBulkPurchasePrice('');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                {unitOptions.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              {showUnitManager && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newUnitInput}
                      onChange={e => setNewUnitInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddUnit();
                        }
                      }}
                      placeholder={language === 'bn' ? 'নতুন Unit (যেমন: Strip)' : 'New unit (e.g. Strip)'}
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddUnit}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      {language === 'bn' ? 'যুক্ত' : 'Add'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {configuredUnits.map(u => (
                      <span
                        key={u}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                          unit === u
                            ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setUnit(u as UnitType)}
                          className="cursor-pointer"
                        >
                          {u}
                        </button>
                        {hasDeletePermission && configuredUnits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleQuickDeleteUnit(u)}
                            className="text-rose-500 hover:text-rose-700 ml-0.5 cursor-pointer"
                            title={language === 'bn' ? `"${u}" মুছুন` : `Delete "${u}"`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Barcode / EAN
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    title={language === 'bn' ? 'ক্যামেরা দিয়ে বারকোড স্ক্যান করুন' : 'Scan barcode with camera'}
                  >
                    <Camera className="w-3 h-3" />
                    <span>{language === 'bn' ? 'ক্যামেরা স্ক্যান' : 'Camera Scan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarcode(`${Date.now().toString().slice(-8)}`)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    title="Auto generate unique barcode"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>{language === 'bn' ? 'নতুন বারকোড' : 'New'}</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder={language === 'bn' ? 'বারকোড লিখুন বা স্ক্যান করুন...' : 'Enter or scan barcode...'}
                  className={`w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none font-mono ${
                    isDuplicateBarcode
                      ? 'border-red-500 text-red-600 dark:text-red-400 focus:border-red-500 bg-red-50/30'
                      : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                  title={language === 'bn' ? 'ক্যামেরা স্ক্যান' : 'Scan with camera'}
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              {isDuplicateBarcode && (
                <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === 'bn'
                      ? `⚠️ আগে থেকে এই নং এন্ট্রি আছে! ("${duplicateBarcodeProduct?.name}" পণ্য)`
                      : `⚠️ This barcode is already entered previously! ("${duplicateBarcodeProduct?.name}")`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dual Unit Configuration (Purchase Unit e.g. CTN -> Sales/Base Unit e.g. Pcs) */}
          {(() => {
            const bulkUnitChoices = Array.from(
              new Set(['CTN', 'Box', 'Pack', 'Dozen', 'Bag', ...configuredUnits])
            ).filter(u => u.toLowerCase() !== unit.trim().toLowerCase());
            const convVal = parseFloat(unitConversion) || 0;
            const hasDual = Boolean(purchaseUnit && convVal > 1);
            return (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                    {language === 'bn'
                      ? `📦 ক্রয় ও বিক্রয় একক (কার্টুন / বক্স কনভার্শন — যেমন 1 CTN = 12 ${unit})`
                      : `📦 Purchase vs Sales Unit Conversion (e.g. 1 CTN = 12 ${unit})`}
                  </span>
                  {hasDual && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      1 {purchaseUnit} = {formatCleanNumber(convVal)} {unit}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {language === 'bn' ? 'ক্রয় একক (Purchase Unit)' : 'Purchase Unit (Bulk)'}
                    </label>
                    <select
                      value={purchaseUnit}
                      onChange={e => {
                        const val = e.target.value;
                        setPurchaseUnit(val);
                        if (!val) {
                          setUnitConversion('');
                          setBulkPurchasePrice('');
                        } else {
                          const nextConv = (parseFloat(unitConversion) || 0) > 1 ? unitConversion : '12';
                          setUnitConversion(nextConv);
                          const pp = parseFloat(purchasePrice) || 0;
                          if (pp > 0) {
                            setBulkPurchasePrice(formatCleanNumber(pp * Number(nextConv)));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 font-medium text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="">
                        {language === 'bn' ? `একই একক (${unit})` : `Same as Base Unit (${unit})`}
                      </option>
                      {bulkUnitChoices.map(bu => (
                        <option key={bu} value={bu}>
                          {bu}
                        </option>
                      ))}
                    </select>
                  </div>

                  {purchaseUnit ? (
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        {language === 'bn'
                          ? `১ ${purchaseUnit} এ কত ${unit}? (Conversion) *`
                          : `Qty of ${unit} in 1 ${purchaseUnit} *`}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                          1 {purchaseUnit} =
                        </span>
                        <input
                          type="number"
                          min="2"
                          step="any"
                          value={unitConversion}
                          onChange={e => {
                            const val = e.target.value;
                            setUnitConversion(val);
                            const nextConv = parseFloat(val) || 0;
                            const pp = parseFloat(purchasePrice) || 0;
                            if (nextConv > 1 && pp > 0) {
                              setBulkPurchasePrice(formatCleanNumber(pp * nextConv));
                            } else if (nextConv <= 1) {
                              setBulkPurchasePrice('');
                            }
                          }}
                          placeholder="12"
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg focus:outline-none focus:border-indigo-500 font-mono font-bold text-slate-900 dark:text-white"
                        />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {unit}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[6, 10, 12, 24, 36, 48, 50, 100].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setUnitConversion(String(preset));
                              const pp = parseFloat(purchasePrice) || 0;
                              if (pp > 0) {
                                setBulkPurchasePrice(formatCleanNumber(pp * preset));
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              Number(unitConversion) === preset
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-[11px] text-slate-500 dark:text-slate-400 pt-4">
                      {language === 'bn'
                        ? `যদি ${unit} ছাড়া বড় প্যাকেটে (যেমন CTN) ক্রয় করে খুচরা ${unit}-এ বিক্রি করেন, তাহলে এখান থেকে CTN সিলেক্ট করুন।`
                        : `Select a bulk unit (e.g. CTN) if you purchase in cartons and sell in ${unit}.`}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Manufacturer & Rack Location (or with Generic Name in Pharmacy Mode) */}
          {isPharmacyMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Generic Name (জেনেরিক নাম)
                </label>
                <input
                  type="text"
                  list="generics-list"
                  value={generic}
                  onChange={e => setGeneric(e.target.value)}
                  placeholder="e.g. Paracetamol"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
                <datalist id="generics-list">
                  {companySettings.productGenerics?.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Manufacturer / Brand (কোম্পানি)
                </label>
                <input
                  type="text"
                  list="manufacturers-list"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="e.g. Square, Beximco"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
                <datalist id="manufacturers-list">
                  {companySettings.productManufacturers?.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Rack Location (র‍্যাক / শেলফ লোকেশন)
                </label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={e => setRackLocation(e.target.value)}
                  placeholder="e.g. Rack A-01, Shelf 3"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Manufacturer / Brand (কোম্পানি / ব্র্যান্ড)
                </label>
                <input
                  type="text"
                  list="manufacturers-list"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="e.g. Unilever, Pran, Walton"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
                <datalist id="manufacturers-list">
                  {companySettings.productManufacturers?.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Rack Location (র‍্যাক / শেলফ লোকেশন)
                </label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={e => setRackLocation(e.target.value)}
                  placeholder="e.g. Rack A-01, Shelf 3"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Pharmacy Exclusive: Strength, Dosage Form & Dosage Schedule / Rules */}
          {isPharmacyMode && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <span>💊 ঔষধের মাত্রা ও সেবনবিধি (Medicine Dosage & Strength)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Strength / Power (স্ট্রেংথ / মাত্রা)
                  </label>
                  <input
                    type="text"
                    list="strengths-list"
                    value={strength}
                    onChange={e => setStrength(e.target.value)}
                    placeholder="e.g. 500mg, 10mg, 100ml"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-slate-900 dark:text-white"
                  />
                  <datalist id="strengths-list">
                    <option value="500mg" />
                    <option value="250mg" />
                    <option value="100mg" />
                    <option value="50mg" />
                    <option value="20mg" />
                    <option value="10mg" />
                    <option value="5mg" />
                    <option value="2.5mg" />
                    <option value="100ml" />
                    <option value="60ml" />
                    <option value="15ml" />
                    <option value="250mg/5ml" />
                    <option value="500 IU" />
                    <option value="1%" />
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dosage Form (ডোজ ফরম / ধরন)
                  </label>
                  <input
                    type="text"
                    list="dosage-forms-list"
                    value={dosageForm}
                    onChange={e => setDosageForm(e.target.value)}
                    placeholder="e.g. Tablet, Capsule, Syrup"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <datalist id="dosage-forms-list">
                    <option value="Tablet" />
                    <option value="Capsule" />
                    <option value="Syrup" />
                    <option value="Suspension" />
                    <option value="Injection" />
                    <option value="Eye Drop" />
                    <option value="Ear Drop" />
                    <option value="Nasal Drop" />
                    <option value="Ointment" />
                    <option value="Gel" />
                    <option value="Cream" />
                    <option value="Inhaler" />
                    <option value="Suppository" />
                    <option value="Powder / Sachet" />
                    <option value="Lozenge" />
                    <option value="Mouthwash / Gargle" />
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dosage Rules (সেবনবিধি / ডোজ)
                  </label>
                  <input
                    type="text"
                    list="dosage-schedules-list"
                    value={dosageSchedule}
                    onChange={e => setDosageSchedule(e.target.value)}
                    placeholder="e.g. ১ + ০ + ১ (সকালে ও রাতে)"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <datalist id="dosage-schedules-list">
                    <option value="১ + ০ + ১ (সকালে ও রাতে)" />
                    <option value="১ + ১ + ১ (দিনে ৩ বার)" />
                    <option value="০ + ০ + ১ (রাতে)" />
                    <option value="১ + ০ + ০ (সকালে)" />
                    <option value="১টি করে দিনে ২ বার" />
                    <option value="প্রয়োজনে ১টি করে" />
                    <option value="ভরা পেটে" />
                    <option value="খালি পেটে" />
                  </datalist>
                </div>
              </div>
            </div>
          )}

          {/* Pricing & Stock */}
          {(() => {
            const convVal = parseFloat(unitConversion) || 0;
            const isDualActive = Boolean(purchaseUnit && convVal > 1);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {isDualActive
                      ? `Purchase Price / ${unit} (৳) *`
                      : 'Purchase Price (৳) *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={e => {
                      const val = e.target.value;
                      setPurchasePrice(val);
                      const num = parseFloat(val) || 0;
                      if (isDualActive && num > 0) {
                        setBulkPurchasePrice(formatCleanNumber(num * convVal));
                      } else if (!val) {
                        setBulkPurchasePrice('');
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white font-bold"
                    required
                  />
                </div>

                {isDualActive && (
                  <div>
                    <label className="font-semibold text-indigo-700 dark:text-indigo-300 block mb-1">
                      Purchase / {purchaseUnit} (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkPurchasePrice}
                      onChange={e => {
                        const val = e.target.value;
                        setBulkPurchasePrice(val);
                        const num = parseFloat(val) || 0;
                        if (num > 0 && convVal > 1) {
                          setPurchasePrice(String(Number((num / convVal).toFixed(4))));
                        } else if (!val) {
                          setPurchasePrice('');
                        }
                      }}
                      placeholder={`1 ${purchaseUnit} দর`}
                      className="w-full px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-700 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-indigo-700 dark:text-indigo-300 font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {isDualActive
                      ? `Sales Price / ${unit} (৳) *`
                      : 'Sales Price (৳) *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salesPrice}
                    onChange={e => setSalesPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-blue-600 dark:text-blue-400 font-bold"
                    required
                  />
                </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Discount (ছাড়)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setDiscountType(discountType === 'percentage' ? 'flat' : 'percentage')}
                  className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300"
                >
                  {discountType === 'percentage' ? '%' : '৳'}
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Exp Date (মেয়াদ)
              </label>
              <input
                type="date"
                value={expDate}
                onChange={e => {
                  const val = e.target.value;
                  setExpDate(val);
                  if (val && new Date(val) < new Date(new Date().setHours(0,0,0,0))) {
                    showToast(
                      language === 'bn' 
                        ? 'সতর্কতা: মেয়াদের তারিখ আজকের আগের একটি তারিখ!' 
                        : 'Warning: Expiry date is set to a past date!', 
                      'warning'
                    );
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Batch No (ব্যাচ নং)
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={e => setBatchNumber(e.target.value)}
                placeholder="e.g. B-01"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
              />
            </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Opening Stock ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
              />
              {(() => {
                const convVal = parseFloat(unitConversion) || 0;
                const stockNum = parseFloat(stock) || 0;
                const breakdown =
                  purchaseUnit && convVal > 1 && stockNum > 0
                    ? formatCartonBreakdown(stockNum, { unit, purchaseUnit, unitConversion: convVal })
                    : null;
                return breakdown ? (
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    = {breakdown}
                  </p>
                ) : null;
              })()}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  SKU / Item Code
                </label>
                <button
                  type="button"
                  onClick={() => setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  title="Auto generate unique SKU"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>{language === 'bn' ? 'নতুন SKU' : 'New'}</span>
                </button>
              </div>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none font-mono ${
                  isDuplicateSku
                    ? 'border-red-500 text-red-600 dark:text-red-400 focus:border-red-500 bg-red-50/30'
                    : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white'
                }`}
              />
              {isDuplicateSku && (
                <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === 'bn'
                      ? `⚠️ আগে থেকে এই নং এন্ট্রি আছে! ("${duplicateSkuProduct?.name}" পণ্য)`
                      : `⚠️ This SKU is already entered previously! ("${duplicateSkuProduct?.name}")`}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Low Stock Alert Limit
              </label>
              <input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={e => setReorderLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Product Photo Upload Section */}
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {language === 'bn' ? 'পণ্যের ছবি (Product Photo / Image)' : 'Product Photo / Image'}
            </label>
            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 relative">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'ছবি আপলোড করুন' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'মুছে ফেলুন' : 'Remove'}</span>
                    </button>
                  )}
                </div>
                <div>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder={language === 'bn' ? 'অথবা ছবির ওয়েব লিংক (URL) দিন...' : 'Or paste image URL (https://...)'}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Product specification, warranty terms or batch note..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Warranty & Serial Configuration Box */}
          {!isPharmacyMode && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                  {language === 'bn' ? 'ওয়ারেন্টি ও সিরিয়াল নম্বর কনফিগারেশন' : 'Warranty & Serial Number Configuration'}
                </h4>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWarranty}
                  onChange={e => setHasWarranty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'ওয়ারেন্টি যুক্ত করুন' : 'Enable Warranty'}
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="req-serial"
                checked={requiresSerialNo}
                onChange={e => setRequiresSerialNo(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <label htmlFor="req-serial" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                {language === 'bn' ? 'বিক্রয়ের সময় সিরিয়াল / IMEI নম্বর স্ক্যান আবশ্যক' : 'Requires Serial / IMEI Number during POS Sale'}
              </label>
            </div>

            {hasWarranty && (
              <div className="space-y-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/60 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'bn' ? 'ওয়ারেন্টির মেয়াদকাল:' : 'Duration:'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={warrantyDuration}
                      onChange={e => setWarrantyDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'bn' ? 'একক (Unit):' : 'Unit:'}
                    </label>
                    <select
                      value={warrantyUnit}
                      onChange={e => setWarrantyUnit(e.target.value as WarrantyPeriodType)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="DAYS">{language === 'bn' ? 'দিন (Days)' : 'Days'}</option>
                      <option value="MONTHS">{language === 'bn' ? 'মাস (Months)' : 'Months'}</option>
                      <option value="YEARS">{language === 'bn' ? 'বছর (Years)' : 'Years'}</option>
                      <option value="LIFETIME">{language === 'bn' ? 'লাইফটাইম (Lifetime)' : 'Lifetime'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'bn' ? 'টাইপ (Type):' : 'Type:'}
                    </label>
                    <select
                      value={warrantyType}
                      onChange={e => setWarrantyType(e.target.value as WarrantyType)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="REPLACEMENT">{language === 'bn' ? 'রিপ্লেসমেন্ট' : 'Replacement'}</option>
                      <option value="REPAIR">{language === 'bn' ? 'ফ্রি পার্টস ও মেরামত' : 'Repair'}</option>
                      <option value="SERVICE">{language === 'bn' ? 'সার্ভিসিং ওয়ারেন্টি' : 'Service'}</option>
                      <option value="BRAND_WARRANTY">{language === 'bn' ? 'ব্র্যান্ড ওয়ারেন্টি' : 'Brand Warranty'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'ওয়ারেন্টি শর্তাবলী (Warranty Terms & Notes):' : 'Specific Terms & Conditions:'}
                  </label>
                  <input
                    type="text"
                    value={warrantyTerms}
                    onChange={e => setWarrantyTerms(e.target.value)}
                    placeholder={language === 'bn' ? 'যেমন: ১ বছর পার্টস রিপ্লেসমেন্ট, ওয়াটার ড্যামেজ প্রযোজ্য নয়' : 'e.g. 1 Year Replacement, liquid damage void'}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
          )}
        </form>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{productToEdit ? (language === 'bn' ? 'আপডেট করুন' : 'Update Product') : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Product')}</span>
          </button>
        </div>
      </div>

      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onBarcodeDetected={(code) => {
          setBarcode(code);
          setIsCameraScannerOpen(false);
          showToast(language === 'bn' ? `বারকোড স্ক্যান সফল: ${code}` : `Barcode scanned: ${code}`, 'success');
        }}
        products={products}
        mode="product-entry"
      />
    </div>
  );
};
