import { CartItem, Product, SaleInvoice, SaleReturn } from '../types';
import { getBaseQuantity, getEffectiveConversionFactor } from './unitConversion';

export interface NetSaleItemMetrics {
  item: CartItem;
  product?: Product;
  origBaseQty: number;
  netQuantity: number;
  netBaseQty: number;
  netTotal: number;
  unitCost: number;
  netCogs: number;
}

export interface NetSaleInvoiceMetrics {
  invoice: SaleInvoice;
  isFullReturn: boolean;
  items: NetSaleItemMetrics[];
  netRevenue: number;
  netCogs: number;
  netProfit: number;
}

export interface SaleReturnLookup {
  returnsByInvoiceId: Map<string, SaleReturn[]>;
  returnsByInvoiceNumber: Map<string, SaleReturn[]>;
  productById: Map<string, Product>;
}

export function createSaleReturnLookup(
  saleReturns: SaleReturn[],
  products: Product[]
): SaleReturnLookup {
  const returnsByInvoiceId = new Map<string, SaleReturn[]>();
  const returnsByInvoiceNumber = new Map<string, SaleReturn[]>();
  const productById = new Map<string, Product>();

  products.forEach(p => {
    productById.set(p.id, p);
  });

  saleReturns.forEach(ret => {
    if (ret.invoiceId) {
      const list = returnsByInvoiceId.get(ret.invoiceId);
      if (list) list.push(ret);
      else returnsByInvoiceId.set(ret.invoiceId, [ret]);
    }
    if (ret.originalInvoiceNumber) {
      const list = returnsByInvoiceNumber.get(ret.originalInvoiceNumber);
      if (list) list.push(ret);
      else returnsByInvoiceNumber.set(ret.originalInvoiceNumber, [ret]);
    }
  });

  return { returnsByInvoiceId, returnsByInvoiceNumber, productById };
}

function getLinkedReturnsForInvoice(
  invoice: SaleInvoice,
  lookup: SaleReturnLookup
): SaleReturn[] {
  const byId = lookup.returnsByInvoiceId.get(invoice.id) || [];
  const byNum = invoice.invoiceNumber
    ? lookup.returnsByInvoiceNumber.get(invoice.invoiceNumber) || []
    : [];

  if (byId.length === 0) return byNum;
  if (byNum.length === 0) return byId;

  const seen = new Set<string>();
  const merged: SaleReturn[] = [];
  for (const r of byId) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  for (const r of byNum) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  return merged;
}

export function computeNetSaleInvoiceMetrics(
  invoice: SaleInvoice,
  lookup: SaleReturnLookup,
  options?: { fallbackEstimateCost?: boolean }
): NetSaleInvoiceMetrics {
  const fallbackEstimate = Boolean(options?.fallbackEstimateCost);
  const linkedReturns = getLinkedReturnsForInvoice(invoice, lookup);
  const grandTotalNum =
    invoice.grandTotal !== undefined && invoice.grandTotal !== null
      ? Number(invoice.grandTotal)
      : null;

  const isFullReturn =
    invoice.returnStatus === 'FULL' ||
    (grandTotalNum !== null && grandTotalNum <= 0);

  const remRetBaseQtyByProd = new Map<string, number>();
  const remRetRefundByProd = new Map<string, number>();

  if (!isFullReturn) {
    linkedReturns.forEach(ret => {
      (ret.items || []).forEach(rItem => {
        const prod = lookup.productById.get(rItem.productId);
        const retBaseQty = getBaseQuantity(
          {
            quantity: rItem.returnQuantity,
            unit: rItem.unit,
            conversionFactor: rItem.conversionFactor,
            baseQuantity: rItem.baseQuantity,
          },
          prod
        );
        remRetBaseQtyByProd.set(
          rItem.productId,
          Number(((remRetBaseQtyByProd.get(rItem.productId) || 0) + Math.max(0, retBaseQty)).toFixed(4))
        );
        remRetRefundByProd.set(
          rItem.productId,
          Number(((remRetRefundByProd.get(rItem.productId) || 0) + Math.max(0, Number(rItem.totalRefund || 0))).toFixed(2))
        );
      });
    });
  }

  const hasUnlinkedReturnAmount =
    !isFullReturn &&
    linkedReturns.length === 0 &&
    Number(invoice.returnedAmount || 0) > 0;

  let keepRatio = 1;
  if (hasUnlinkedReturnAmount) {
    const returnedAmt = Number(invoice.returnedAmount || 0);
    const currentGross = grandTotalNum !== null ? grandTotalNum : Number(invoice.subtotal || 0);
    const origGross = Number(invoice.originalGrandTotal ?? currentGross + returnedAmt);
    keepRatio = origGross > 0 ? Math.max(0, Math.min(1, currentGross / origGross)) : 0;
  }

  const items: NetSaleItemMetrics[] = (invoice.items || []).map(item => {
    const prod = lookup.productById.get(item.productId);
    const origBaseQty = getBaseQuantity(item, prod);
    const origQty = Number(item.quantity || 0);
    const origTotal = Number(item.total || 0);

    const unitCost =
      item.purchasePrice !== undefined && item.purchasePrice !== null && item.purchasePrice > 0
        ? Number(item.purchasePrice)
        : prod
        ? Number(prod.purchasePrice || 0)
        : fallbackEstimate && origBaseQty > 0
        ? (origTotal / origBaseQty) * 0.8
        : fallbackEstimate
        ? Number(item.unitPrice || 0) * 0.8
        : 0;

    if (isFullReturn) {
      return {
        item,
        product: prod,
        origBaseQty,
        netQuantity: 0,
        netBaseQty: 0,
        netTotal: 0,
        unitCost,
        netCogs: 0,
      };
    }

    let netBaseQty: number;
    let netQuantity: number;
    let netTotal: number;

    if (hasUnlinkedReturnAmount) {
      netBaseQty = Number((origBaseQty * keepRatio).toFixed(4));
      netQuantity = Number((origQty * keepRatio).toFixed(4));
      netTotal = Number((origTotal * keepRatio).toFixed(2));
    } else {
      const availRetBaseQty = remRetBaseQtyByProd.get(item.productId) || 0;
      const consumedRetBaseQty = Math.min(origBaseQty, availRetBaseQty);
      remRetBaseQtyByProd.set(
        item.productId,
        Math.max(0, Number((availRetBaseQty - consumedRetBaseQty).toFixed(4)))
      );

      netBaseQty = Math.max(0, Number((origBaseQty - consumedRetBaseQty).toFixed(4)));
      const factor = getEffectiveConversionFactor(item, prod);
      netQuantity =
        origBaseQty > 0
          ? Number((origQty * (netBaseQty / origBaseQty)).toFixed(4))
          : Math.max(0, origQty - (factor > 0 ? consumedRetBaseQty / factor : consumedRetBaseQty));

      const availRetRefund = remRetRefundByProd.get(item.productId) || 0;
      const consumedRefund = Math.min(Math.max(0, origTotal), availRetRefund);
      remRetRefundByProd.set(
        item.productId,
        Math.max(0, Number((availRetRefund - consumedRefund).toFixed(2)))
      );

      if (netBaseQty <= 0.0001) {
        netTotal = 0;
      } else if (consumedRefund > 0) {
        netTotal = Math.max(0, Number((origTotal - consumedRefund).toFixed(2)));
      } else if (consumedRetBaseQty > 0 && origBaseQty > 0) {
        netTotal = Math.max(0, Number((origTotal * (netBaseQty / origBaseQty)).toFixed(2)));
      } else {
        netTotal = Math.max(0, origTotal);
      }
    }

    const netCogs = Number((unitCost * netBaseQty).toFixed(2));

    return {
      item,
      product: prod,
      origBaseQty,
      netQuantity,
      netBaseQty,
      netTotal,
      unitCost,
      netCogs,
    };
  });

  const netCogs = isFullReturn
    ? 0
    : Number(items.reduce((sum, it) => sum + it.netCogs, 0).toFixed(2));

  let invoiceDiscount = Number(invoice.discount || 0);
  if (invoice.discountType === 'percentage') {
    invoiceDiscount = Number(invoice.subtotal || 0) * (invoiceDiscount / 100);
  }
  const deliveryFee = Number((invoice as unknown as { deliveryFee?: number }).deliveryFee || 0);
  const netRevenue =
    grandTotalNum !== null
      ? Math.max(0, grandTotalNum - Number(invoice.vatAmount || 0) - deliveryFee)
      : Math.max(0, Number(invoice.subtotal || 0) - invoiceDiscount);

  const netProfit = Number((netRevenue - netCogs).toFixed(2));

  return {
    invoice,
    isFullReturn,
    items,
    netRevenue,
    netCogs,
    netProfit,
  };
}
