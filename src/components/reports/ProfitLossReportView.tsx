import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Clock,
  DollarSign,
  Receipt,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getLocalDateString, normalizeDateToISO } from '../../utils/dateUtils';
import { computeNetSaleInvoiceMetrics, createSaleReturnLookup } from '../../utils/salesReturnHelpers';

export interface ProfitLossReportHandle {
  printReport: (autoDownloadPdf?: boolean) => void;
  exportCsv: () => void;
}

interface ProfitLossReportViewProps {
  globalStartDate: string;
  globalEndDate: string;
  onPeriodChange: (start: string, end: string, label?: string) => void;
}

type PnlMode = 'daily' | 'monthly' | 'custom';
type PnlSectionTab = 'period' | 'invoices' | 'expenses';

const toLocalIsoDate = (d: Date): string => getLocalDateString(d);

const getMonthRange = (ym: string): { start: string; end: string } => {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toLocalIsoDate(s), end: toLocalIsoDate(e) };
  }
  const s = new Date(y, m - 1, 1);
  const e = new Date(y, m, 0);
  return { start: toLocalIsoDate(s), end: toLocalIsoDate(e) };
};

const isFullMonthRange = (start: string, end: string): boolean => {
  if (!start || !end) return false;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  const lastDay = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
  return (
    s.getDate() === 1 &&
    e.getDate() === lastDay &&
    s.getMonth() === e.getMonth() &&
    s.getFullYear() === e.getFullYear()
  );
};

export const ProfitLossReportView = forwardRef<ProfitLossReportHandle, ProfitLossReportViewProps>(
  ({ globalStartDate, globalEndDate, onPeriodChange }, ref) => {
    const {
      language,
      saleInvoices,
      saleReturns,
      products,
      expenseVouchers,
      payrollHistory,
      formatCurrency,
      openPrintModal,
      showToast,
    } = useApp();

    const isBn = language === 'bn';
    const todayStr = getLocalDateString();
    const currentMonthStr = todayStr.slice(0, 7);

    // Determine initial mode based on globalStartDate / globalEndDate
    const detectMode = (s: string, e: string): PnlMode => {
      if (s && e && s === e) return 'daily';
      if (isFullMonthRange(s, e)) return 'monthly';
      if (s || e) return 'custom';
      return 'daily';
    };

    const [mode, setMode] = useState<PnlMode>(() => detectMode(globalStartDate, globalEndDate));
    const [dailyDate, setDailyDate] = useState<string>(() =>
      globalStartDate && globalEndDate && globalStartDate === globalEndDate ? globalStartDate : todayStr
    );
    const [monthlyVal, setMonthlyVal] = useState<string>(() =>
      isFullMonthRange(globalStartDate, globalEndDate) ? globalStartDate.slice(0, 7) : currentMonthStr
    );
    const [customStart, setCustomStart] = useState<string>(() => globalStartDate);
    const [customEnd, setCustomEnd] = useState<string>(() => globalEndDate);

    const [sectionTab, setSectionTab] = useState<PnlSectionTab>('period');
    const [periodGrouping, setPeriodGrouping] = useState<'daily' | 'monthly'>('daily');
    const [includePayroll, setIncludePayroll] = useState<boolean>(false);

    // Default to today's daily filter when opening Profit & Loss with no global range set
    useEffect(() => {
      if (!globalStartDate && !globalEndDate && mode === 'daily') {
        setDailyDate(todayStr);
      }
    }, []);

    // Keep synced when user changes the global DatePeriodFilter bar above
    useEffect(() => {
      if (!globalStartDate && !globalEndDate) {
        setCustomStart('');
        setCustomEnd('');
        return;
      }
      if (globalStartDate && globalEndDate && globalStartDate === globalEndDate) {
        setMode('daily');
        setDailyDate(globalStartDate);
      } else if (isFullMonthRange(globalStartDate, globalEndDate)) {
        setMode('monthly');
        setMonthlyVal(globalStartDate.slice(0, 7));
      } else {
        setMode('custom');
        setCustomStart(globalStartDate);
        setCustomEnd(globalEndDate);
      }
    }, [globalStartDate, globalEndDate]);

    // Effective Start & End dates for the currently selected mode
    const { effStart, effEnd, periodTitleText } = useMemo(() => {
      if (mode === 'daily') {
        const d = dailyDate || todayStr;
        const label =
          d === todayStr
            ? isBn
              ? `দৈনিক (আজ: ${d})`
              : `Daily (Today: ${d})`
            : isBn
            ? `দৈনিক (${d})`
            : `Daily (${d})`;
        return { effStart: d, effEnd: d, periodTitleText: label };
      }
      if (mode === 'monthly') {
        const ym = monthlyVal || currentMonthStr;
        const { start, end } = getMonthRange(ym);
        return {
          effStart: start,
          effEnd: end,
          periodTitleText: isBn ? `মাসিক (${ym})` : `Monthly (${ym})`,
        };
      }
      const s = customStart || '';
      const e = customEnd || '';
      const label =
        s && e
          ? isBn
            ? `${s} হতে ${e} পর্যন্ত`
            : `${s} to ${e}`
          : s
          ? isBn
            ? `${s} থেকে`
            : `From ${s}`
          : e
          ? isBn
            ? `${e} পর্যন্ত`
            : `Until ${e}`
          : isBn
          ? 'সকল সময় (All Time)'
          : 'All Time';
      return { effStart: s, effEnd: e, periodTitleText: label };
    }, [mode, dailyDate, monthlyVal, customStart, customEnd, todayStr, currentMonthStr, isBn]);

    const saleReturnLookup = useMemo(() => {
      return createSaleReturnLookup(saleReturns || [], products);
    }, [saleReturns, products]);

    // Pre-compute normalized metrics for all sales invoices once
    const allInvoiceMetrics = useMemo(() => {
      return saleInvoices.map(inv => {
        const isoDate = normalizeDateToISO(inv.date) || inv.date;
        const metrics = computeNetSaleInvoiceMetrics(inv, saleReturnLookup);
        const origGross = Number(
          inv.originalGrandTotal ??
            Number(inv.grandTotal ?? inv.subtotal ?? 0) + Number(inv.returnedAmount || 0)
        );
        const returnedAmt = Number(inv.returnedAmount || 0);
        return {
          inv,
          isoDate,
          monthKey: isoDate ? isoDate.slice(0, 7) : '',
          metrics,
          origGross,
          returnedAmt,
        };
      });
    }, [saleInvoices, saleReturnLookup]);

    // Helper: compute P&L summary for any [start, end]
    const computeRangeSummary = (start: string, end: string) => {
      const inRange = (d: string | null) => {
        if (!d) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      };

      let grossSales = 0;
      let returnedAmount = 0;
      let netRevenue = 0;
      let netCogs = 0;
      let invoiceCount = 0;

      for (const row of allInvoiceMetrics) {
        if (!inRange(row.isoDate)) continue;
        invoiceCount++;
        grossSales += row.origGross;
        returnedAmount += row.returnedAmt;
        netRevenue += row.metrics.netRevenue;
        netCogs += row.metrics.netCogs;
      }

      let expenses = 0;
      let expenseCount = 0;
      for (const exp of expenseVouchers) {
        const d = normalizeDateToISO(exp.date);
        if (!inRange(d)) continue;
        expenseCount++;
        expenses += Number(exp.amount || 0);
      }

      let payroll = 0;
      let payrollCount = 0;
      for (const pay of payrollHistory) {
        const d = normalizeDateToISO(pay.paymentDate);
        if (!inRange(d)) continue;
        payrollCount++;
        payroll += Number(pay.paidAmount ?? pay.netPay ?? 0);
      }

      const grossProfit = netRevenue - netCogs;
      const totalOperatingCost = expenses + (includePayroll ? payroll : 0);
      const netProfit = grossProfit - totalOperatingCost;
      const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
      const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

      return {
        grossSales,
        returnedAmount,
        netRevenue,
        netCogs,
        grossProfit,
        expenses,
        expenseCount,
        payroll,
        payrollCount,
        totalOperatingCost,
        netProfit,
        invoiceCount,
        grossMarginPct,
        netMarginPct,
      };
    };

    // Quick snapshot cards: Today, This Month, Active Selected Range
    const todaySnapshot = useMemo(
      () => computeRangeSummary(todayStr, todayStr),
      [allInvoiceMetrics, expenseVouchers, payrollHistory, includePayroll, todayStr]
    );

    const thisMonthSnapshot = useMemo(() => {
      const { start, end } = getMonthRange(currentMonthStr);
      return computeRangeSummary(start, end);
    }, [allInvoiceMetrics, expenseVouchers, payrollHistory, includePayroll, currentMonthStr]);

    const activeSummary = useMemo(
      () => computeRangeSummary(effStart, effEnd),
      [allInvoiceMetrics, expenseVouchers, payrollHistory, includePayroll, effStart, effEnd]
    );

    // Invoices, Expenses, and Payroll inside active range
    const filteredInvoices = useMemo(() => {
      return allInvoiceMetrics
        .filter(r => {
          if (effStart && r.isoDate < effStart) return false;
          if (effEnd && r.isoDate > effEnd) return false;
          return true;
        })
        .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
    }, [allInvoiceMetrics, effStart, effEnd]);

    const filteredExpenses = useMemo(() => {
      return expenseVouchers
        .filter(exp => {
          const d = normalizeDateToISO(exp.date);
          if (!d) return false;
          if (effStart && d < effStart) return false;
          if (effEnd && d > effEnd) return false;
          return true;
        })
        .sort((a, b) => (normalizeDateToISO(b.date) || '').localeCompare(normalizeDateToISO(a.date) || ''));
    }, [expenseVouchers, effStart, effEnd]);

    const filteredPayroll = useMemo(() => {
      return payrollHistory
        .filter(pay => {
          const d = normalizeDateToISO(pay.paymentDate);
          if (!d) return false;
          if (effStart && d < effStart) return false;
          if (effEnd && d > effEnd) return false;
          return true;
        })
        .sort((a, b) =>
          (normalizeDateToISO(b.paymentDate) || '').localeCompare(normalizeDateToISO(a.paymentDate) || '')
        );
    }, [payrollHistory, effStart, effEnd]);

    // Expense breakdown by category
    const expenseByCategory = useMemo(() => {
      const map = new Map<string, { categoryName: string; count: number; total: number }>();
      filteredExpenses.forEach(exp => {
        const cat = exp.categoryName || exp.category || (isBn ? 'অন্যান্য খরচ' : 'Other Expense');
        const cur = map.get(cat) || { categoryName: cat, count: 0, total: 0 };
        cur.count += 1;
        cur.total += Number(exp.amount || 0);
        map.set(cat, cur);
      });
      if (includePayroll && activeSummary.payroll > 0) {
        map.set('__payroll__', {
          categoryName: isBn ? 'কর্মচারী বেতন (Payroll)' : 'Employee Salary / Payroll',
          count: activeSummary.payrollCount,
          total: activeSummary.payroll,
        });
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [filteredExpenses, includePayroll, activeSummary.payroll, activeSummary.payrollCount, isBn]);

    // Period Breakdown Table Rows (Daily or Monthly buckets)
    // In Daily mode, show day-by-day rows for the selected day's month so user can see daily trend and jump to any day!
    // In Monthly mode, allow toggling between Daily rows of that month OR Monthly comparison across all months.
    // In Custom Date-to-Date mode, show Daily or Monthly grouped rows strictly within [effStart, effEnd].
    const periodBreakdownRows = useMemo(() => {
      let bucketStart = effStart;
      let bucketEnd = effEnd;
      let effectiveGrouping = periodGrouping;

      if (mode === 'daily') {
        const ym = (dailyDate || todayStr).slice(0, 7);
        const r = getMonthRange(ym);
        bucketStart = r.start;
        bucketEnd = r.end;
        effectiveGrouping = 'daily';
      } else if (mode === 'monthly' && periodGrouping === 'monthly') {
        // Show all months across history for month-over-month comparison
        bucketStart = '';
        bucketEnd = '';
      }

      const inBucketRange = (d: string | null) => {
        if (!d) return false;
        if (bucketStart && d < bucketStart) return false;
        if (bucketEnd && d > bucketEnd) return false;
        return true;
      };

      const buckets = new Map<
        string,
        {
          key: string;
          invoiceCount: number;
          returnedAmount: number;
          netRevenue: number;
          netCogs: number;
          grossProfit: number;
          expenses: number;
          payroll: number;
          netProfit: number;
        }
      >();

      const getBucket = (key: string) => {
        let b = buckets.get(key);
        if (!b) {
          b = {
            key,
            invoiceCount: 0,
            returnedAmount: 0,
            netRevenue: 0,
            netCogs: 0,
            grossProfit: 0,
            expenses: 0,
            payroll: 0,
            netProfit: 0,
          };
          buckets.set(key, b);
        }
        return b;
      };

      for (const row of allInvoiceMetrics) {
        if (!inBucketRange(row.isoDate)) continue;
        const key = effectiveGrouping === 'monthly' ? row.monthKey : row.isoDate;
        if (!key) continue;
        const b = getBucket(key);
        b.invoiceCount += 1;
        b.returnedAmount += row.returnedAmt;
        b.netRevenue += row.metrics.netRevenue;
        b.netCogs += row.metrics.netCogs;
      }

      for (const exp of expenseVouchers) {
        const d = normalizeDateToISO(exp.date);
        if (!inBucketRange(d)) continue;
        const key = effectiveGrouping === 'monthly' ? d!.slice(0, 7) : d!;
        const b = getBucket(key);
        b.expenses += Number(exp.amount || 0);
      }

      if (includePayroll) {
        for (const pay of payrollHistory) {
          const d = normalizeDateToISO(pay.paymentDate);
          if (!inBucketRange(d)) continue;
          const key = effectiveGrouping === 'monthly' ? d!.slice(0, 7) : d!;
          const b = getBucket(key);
          b.payroll += Number(pay.paidAmount ?? pay.netPay ?? 0);
        }
      }

      const list = Array.from(buckets.values()).map(b => {
        const grossProfit = b.netRevenue - b.netCogs;
        const totalExp = b.expenses + (includePayroll ? b.payroll : 0);
        const netProfit = grossProfit - totalExp;
        return {
          ...b,
          expenses: totalExp,
          grossProfit,
          netProfit,
        };
      });

      return list.sort((a, b) => b.key.localeCompare(a.key));
    }, [
      mode,
      dailyDate,
      todayStr,
      effStart,
      effEnd,
      periodGrouping,
      allInvoiceMetrics,
      expenseVouchers,
      payrollHistory,
      includePayroll,
    ]);

    // Mode change handlers (also sync parent global DatePeriodFilter)
    const selectDailyMode = (targetDate?: string) => {
      const d = targetDate || dailyDate || todayStr;
      setMode('daily');
      setDailyDate(d);
      setPeriodGrouping('daily');
      onPeriodChange(d, d, d === todayStr ? (isBn ? 'আজ (দৈনিক)' : 'Today (Daily)') : d);
    };

    const selectMonthlyMode = (targetMonth?: string) => {
      const ym = targetMonth || monthlyVal || currentMonthStr;
      const { start, end } = getMonthRange(ym);
      setMode('monthly');
      setMonthlyVal(ym);
      onPeriodChange(start, end, isBn ? `মাসিক: ${ym}` : `Monthly: ${ym}`);
    };

    const selectCustomMode = (s?: string, e?: string, label?: string) => {
      const nextS = s !== undefined ? s : customStart;
      const nextE = e !== undefined ? e : customEnd;
      setMode('custom');
      setCustomStart(nextS);
      setCustomEnd(nextE);
      onPeriodChange(nextS, nextE, label);
    };

    const setPresetYesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      selectDailyMode(toLocalIsoDate(d));
    };

    const setPresetLastMonth = () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      selectMonthlyMode(ym);
    };

    const setPresetLastDays = (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (days - 1));
      const sStr = toLocalIsoDate(start);
      const eStr = toLocalIsoDate(end);
      selectCustomMode(sStr, eStr, isBn ? `গত ${days} দিন` : `Last ${days} Days`);
    };

    const setPresetThisYear = () => {
      const now = new Date();
      const sStr = `${now.getFullYear()}-01-01`;
      const eStr = `${now.getFullYear()}-12-31`;
      selectCustomMode(sStr, eStr, isBn ? `${now.getFullYear()} সাল` : `Year ${now.getFullYear()}`);
    };

    const setPresetAllTime = () => {
      selectCustomMode('', '', isBn ? 'সকল সময়' : 'All Time');
    };

    // Imperative Print & CSV Export handlers so top ReportsView buttons work seamlessly
    useImperativeHandle(ref, () => ({
      printReport: (autoDownloadPdf = false) => {
        const reportTitle = isBn
          ? `লাভ ও ক্ষতি বিবরণী (Profit & Loss Statement) - ${periodTitleText}`
          : `PROFIT & LOSS STATEMENT - ${periodTitleText.toUpperCase()}`;

        openPrintModal({
          type: 'REPORT',
          title: reportTitle,
          autoDownloadPdf,
          data: {
            reportTitle,
            period: periodTitleText,
            filters: [
              {
                label: isBn ? 'রিপোর্ট মোড' : 'Report Mode',
                value:
                  mode === 'daily'
                    ? isBn
                      ? 'দৈনিক (Daily)'
                      : 'Daily'
                    : mode === 'monthly'
                    ? isBn
                      ? 'মাসিক (Monthly)'
                      : 'Monthly'
                    : isBn
                    ? 'ডেট টু ডেট (Date-to-Date)'
                    : 'Date-to-Date',
              },
              {
                label: isBn ? 'বেতন খরচ (Payroll)' : 'Include Payroll',
                value: includePayroll ? (isBn ? 'অন্তর্ভুক্ত' : 'Included') : isBn ? 'বাদ রাখা হয়েছে' : 'Excluded',
              },
            ],
            kpis: [
              { label: isBn ? 'নিট বিক্রয় (Net Sales)' : 'Net Sales Revenue', value: activeSummary.netRevenue },
              { label: isBn ? 'পণ্যের ক্রয়মূল্য (COGS)' : 'Cost of Goods (COGS)', value: activeSummary.netCogs },
              { label: isBn ? 'মোট লাভ (Gross Profit)' : 'Gross Profit', value: activeSummary.grossProfit },
              { label: isBn ? 'মোট খরচ (Expenses)' : 'Operating Expenses', value: activeSummary.totalOperatingCost },
              {
                label:
                  activeSummary.netProfit >= 0
                    ? isBn
                      ? 'নিট লাভ (Net Profit)'
                      : 'Net Profit'
                    : isBn
                    ? 'নিট ক্ষতি (Net Loss)'
                    : 'Net Loss',
                value: activeSummary.netProfit,
              },
            ],
            columns: [
              {
                header: periodGrouping === 'monthly' && mode !== 'daily' ? (isBn ? 'মাস' : 'Month') : isBn ? 'তারিখ' : 'Date',
                key: 'key',
              },
              { header: isBn ? 'চালান সংখ্যা' : 'Invoices', key: 'invoiceCount', align: 'center', format: 'number' },
              { header: isBn ? 'নিট বিক্রয়' : 'Net Sales', key: 'netRevenue', align: 'right', format: 'currency' },
              { header: isBn ? 'ক্রয়মূল্য (COGS)' : 'Cost (COGS)', key: 'netCogs', align: 'right', format: 'currency' },
              { header: isBn ? 'মোট লাভ' : 'Gross Profit', key: 'grossProfit', align: 'right', format: 'currency' },
              { header: isBn ? 'খরচ' : 'Expenses', key: 'expenses', align: 'right', format: 'currency' },
              { header: isBn ? 'নিট লাভ/ক্ষতি' : 'Net Profit / Loss', key: 'netProfit', align: 'right', format: 'currency' },
            ],
            rows: periodBreakdownRows,
            totals: {
              invoiceCount: periodBreakdownRows.reduce((s, r) => s + r.invoiceCount, 0),
              netRevenue: periodBreakdownRows.reduce((s, r) => s + r.netRevenue, 0),
              netCogs: periodBreakdownRows.reduce((s, r) => s + r.netCogs, 0),
              grossProfit: periodBreakdownRows.reduce((s, r) => s + r.grossProfit, 0),
              expenses: periodBreakdownRows.reduce((s, r) => s + r.expenses, 0),
              netProfit: periodBreakdownRows.reduce((s, r) => s + r.netProfit, 0),
            },
          },
        });
      },
      exportCsv: () => {
        const escapeCell = (val: unknown) => {
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        };
        const headers = ['Period', 'Invoices', 'Returned Amount', 'Net Sales', 'COGS', 'Gross Profit', 'Expenses', 'Net Profit / Loss'];
        const rows = periodBreakdownRows.map(r => [
          r.key,
          r.invoiceCount,
          r.returnedAmount.toFixed(2),
          r.netRevenue.toFixed(2),
          r.netCogs.toFixed(2),
          r.grossProfit.toFixed(2),
          r.expenses.toFixed(2),
          r.netProfit.toFixed(2),
        ]);
        const csvContent =
          '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Profit_And_Loss_${mode}_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(isBn ? 'Profit & Loss CSV এক্সপোর্ট সম্পন্ন!' : 'Profit & Loss CSV exported!', 'success');
      },
    }));

    const isProfit = activeSummary.netProfit >= 0;

    return (
      <div className="space-y-4">
        {/* 1. Quick 3-Period Glance Strip (Today vs This Month vs Selected Period) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => selectDailyMode(todayStr)}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
              mode === 'daily' && dailyDate === todayStr
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isBn ? '১. আজকের নিট লাভ / ক্ষতি (দৈনিক)' : "1. Today's Net Profit / Loss"}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {todayStr}
              </span>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-1.5 flex items-center gap-1.5 ${
                todaySnapshot.netProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {todaySnapshot.netProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 shrink-0" />
              ) : (
                <TrendingDown className="w-5 h-5 shrink-0" />
              )}
              <span>{formatCurrency(todaySnapshot.netProfit)}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
              <span>
                {isBn ? 'বিক্রয়:' : 'Sales:'} {formatCurrency(todaySnapshot.netRevenue)}
              </span>
              <span>
                {isBn ? 'খরচ:' : 'Exp:'} {formatCurrency(todaySnapshot.totalOperatingCost)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectMonthlyMode(currentMonthStr)}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
              mode === 'monthly' && monthlyVal === currentMonthStr
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isBn ? '২. চলতি মাসের লাভ / ক্ষতি (মাসিক)' : '2. This Month Net Profit / Loss'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {currentMonthStr}
              </span>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-1.5 flex items-center gap-1.5 ${
                thisMonthSnapshot.netProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {thisMonthSnapshot.netProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 shrink-0" />
              ) : (
                <TrendingDown className="w-5 h-5 shrink-0" />
              )}
              <span>{formatCurrency(thisMonthSnapshot.netProfit)}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
              <span>
                {isBn ? 'বিক্রয়:' : 'Sales:'} {formatCurrency(thisMonthSnapshot.netRevenue)}
              </span>
              <span>
                {isBn ? 'খরচ:' : 'Exp:'} {formatCurrency(thisMonthSnapshot.totalOperatingCost)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectCustomMode(effStart || todayStr, effEnd || todayStr)}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
              mode === 'custom'
                ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 ring-2 ring-indigo-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isBn ? '৩. নির্বাচিত সময়ের লাভ / ক্ষতি' : '3. Selected Period Net P&L'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 truncate max-w-[140px]">
                {periodTitleText}
              </span>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-1.5 flex items-center gap-1.5 ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isProfit ? <TrendingUp className="w-5 h-5 shrink-0" /> : <TrendingDown className="w-5 h-5 shrink-0" />}
              <span>{formatCurrency(activeSummary.netProfit)}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
              <span>
                {isBn ? 'চালান:' : 'Invoices:'} {activeSummary.invoiceCount}
              </span>
              <span>
                {isBn ? 'মার্জিন:' : 'Net Margin:'} {activeSummary.netMarginPct.toFixed(1)}%
              </span>
            </div>
          </button>
        </div>

        {/* 2. Dedicated Daily / Monthly / Date-to-Date Mode Controls */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => selectDailyMode()}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'daily'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isBn ? 'দৈনিক (Daily)' : 'Daily P&L'}</span>
              </button>

              <button
                type="button"
                onClick={() => selectMonthlyMode()}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'monthly'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isBn ? 'মাসিক (Monthly)' : 'Monthly P&L'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!customStart && !customEnd) {
                    setPresetLastDays(30);
                  } else {
                    selectCustomMode(customStart, customEnd);
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডেট টু ডেট (Date to Date)' : 'Date to Date'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePayroll}
                  onChange={e => setIncludePayroll(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                />
                <Users className="w-3.5 h-3.5 text-purple-500" />
                <span>{isBn ? 'বেতন (Payroll) খরচ বাদ দিন' : 'Include Payroll Cost'}</span>
              </label>
            </div>
          </div>

          {/* Mode-Specific Date Pickers & Presets */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {mode === 'daily' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {isBn ? 'দৈনিক তারিখ:' : 'Select Date:'}
                </span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={e => selectDailyMode(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => selectDailyMode(todayStr)}
                  className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer transition-colors ${
                    dailyDate === todayStr
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isBn ? 'আজ (Today)' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={setPresetYesterday}
                  className="px-3 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? 'গতকাল (Yesterday)' : 'Yesterday'}
                </button>
              </div>
            )}

            {mode === 'monthly' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {isBn ? 'মাস নির্বাচন করুন:' : 'Select Month:'}
                </span>
                <input
                  type="month"
                  value={monthlyVal}
                  onChange={e => selectMonthlyMode(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => selectMonthlyMode(currentMonthStr)}
                  className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer transition-colors ${
                    monthlyVal === currentMonthStr
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isBn ? 'চলতি মাস' : 'This Month'}
                </button>
                <button
                  type="button"
                  onClick={setPresetLastMonth}
                  className="px-3 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? 'গত মাস' : 'Last Month'}
                </button>
              </div>
            )}

            {mode === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'তারিখ হতে:' : 'From:'}
                  </span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => selectCustomMode(e.target.value, customEnd)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'পর্যন্ত:' : 'To:'}
                  </span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => selectCustomMode(customStart, e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPresetLastDays(7)}
                  className="px-2.5 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? '৭ দিন' : '7 Days'}
                </button>
                <button
                  type="button"
                  onClick={() => setPresetLastDays(30)}
                  className="px-2.5 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? '৩০ দিন' : '30 Days'}
                </button>
                <button
                  type="button"
                  onClick={setPresetThisYear}
                  className="px-2.5 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? 'চলতি বছর' : 'This Year'}
                </button>
                <button
                  type="button"
                  onClick={setPresetAllTime}
                  className="px-2.5 py-1.5 rounded-lg font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? 'সব সময়' : 'All Time'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => selectDailyMode(todayStr)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? 'আজকে রিসেট' : 'Reset Today'}</span>
            </button>
          </div>
        </div>

        {/* 3. Profit & Loss Detailed KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase">
                {isBn ? 'নিট বিক্রয় (Net Sales)' : 'Net Sales Revenue'}
              </span>
              <ShoppingBag className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1.5">
              {formatCurrency(activeSummary.netRevenue)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {activeSummary.invoiceCount} {isBn ? 'টি চালান' : 'invoices'}
              {activeSummary.returnedAmount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1.5">
                  ({isBn ? 'রিটার্ন:' : 'Ret:'} {formatCurrency(activeSummary.returnedAmount)})
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase">
                {isBn ? 'পণ্যের ক্রয়মূল্য (COGS)' : 'Cost of Goods (COGS)'}
              </span>
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1.5">
              {formatCurrency(activeSummary.netCogs)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isBn ? 'বিক্রিত পণ্যের ক্রয় খরচ' : 'Purchase cost of sold qty'}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase">
                {isBn ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}
              </span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div
              className={`text-xl font-black font-mono mt-1.5 ${
                activeSummary.grossProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(activeSummary.grossProfit)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isBn ? 'গ্রস মার্জিন:' : 'Gross Margin:'} {activeSummary.grossMarginPct.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase">
                {isBn ? 'দোকান ও অন্যান্য খরচ' : 'Operating Expenses'}
              </span>
              <Wallet className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1.5">
              {formatCurrency(activeSummary.totalOperatingCost)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {activeSummary.expenseCount} {isBn ? 'টি খরচ ভাউচার' : 'vouchers'}
              {activeSummary.payroll > 0 && (
                <span className="ml-1.5">
                  ({isBn ? 'বেতন:' : 'Payroll:'} {formatCurrency(activeSummary.payroll)})
                </span>
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border-2 shadow-xs ${
              isProfit
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-extrabold uppercase ${
                  isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {isProfit
                  ? isBn
                    ? 'নিট লাভ (Net Profit)'
                    : 'Net Profit'
                  : isBn
                  ? 'নিট ক্ষতি (Net Loss)'
                  : 'Net Loss'}
              </span>
              {isProfit ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div
              className={`text-2xl font-black font-mono mt-1.5 ${
                isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {formatCurrency(activeSummary.netProfit)}
            </div>
            <div
              className={`text-[11px] font-bold mt-1 ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isProfit ? (isBn ? 'মোট লাভজনক অবস্থা' : 'Net Margin:') : isBn ? 'ক্ষতিগ্রস্ত অবস্থা' : 'Net Margin:'}{' '}
              {activeSummary.netMarginPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 4. Accounting Formula Summary Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isBn
                ? `লাভ-ক্ষতি হিসাবের সারসংক্ষেপ (${periodTitleText})`
                : `Profit & Loss Accounting Summary (${periodTitleText})`}
            </h4>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                isProfit
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {isProfit ? (isBn ? 'নিট লাভ (Profit)' : 'NET PROFIT') : isBn ? 'নিট ক্ষতি (Loss)' : 'NET LOSS'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {isBn ? 'মোট বিক্রয় (Gross Sales)' : 'Gross Sales (Before Return)'}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrency(activeSummary.grossSales)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {isBn ? 'বাদ: বিক্রয় রিটার্ন (Sales Return)' : 'Less: Sales Returns'}
                </span>
                <span className="font-mono font-semibold text-amber-600">
                  -{formatCurrency(activeSummary.returnedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 font-bold">
                <span className="text-slate-800 dark:text-slate-200">
                  {isBn ? 'নিট বিক্রয় রাজস্ব (Net Revenue)' : 'Net Sales Revenue'}
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(activeSummary.netRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {isBn ? 'বাদ: পণ্যের ক্রয়মূল্য (COGS)' : 'Less: Cost of Goods Sold (COGS)'}
                </span>
                <span className="font-mono font-semibold text-rose-600">
                  -{formatCurrency(activeSummary.netCogs)}
                </span>
              </div>
            </div>

            <div className="space-y-2 md:border-l md:border-slate-100 md:dark:border-slate-800 md:pl-4">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800 dark:text-slate-200">
                  {isBn ? 'মোট বিক্রয় লাভ (Gross Profit)' : 'Gross Profit (Revenue - COGS)'}
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(activeSummary.grossProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {isBn ? 'বাদ: পরিচালন খরচ (Expenses)' : 'Less: Operating Expenses'}
                </span>
                <span className="font-mono font-semibold text-rose-600">
                  -{formatCurrency(activeSummary.expenses)}
                </span>
              </div>
              {includePayroll && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isBn ? 'বাদ: কর্মচারী বেতন (Payroll)' : 'Less: Staff Payroll'}
                  </span>
                  <span className="font-mono font-semibold text-rose-600">
                    -{formatCurrency(activeSummary.payroll)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
                <span className="text-slate-900 dark:text-white">
                  {isProfit
                    ? isBn
                      ? 'সর্বমোট নিট লাভ (Net Profit)'
                      : 'Net Business Profit'
                    : isBn
                    ? 'সর্বমোট নিট ক্ষতি (Net Loss)'
                    : 'Net Business Loss'}
                </span>
                <span
                  className={`font-mono ${
                    isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(activeSummary.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Detail Tabs: Period Breakdown / Invoice Breakdown / Expense Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSectionTab('period')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  sectionTab === 'period'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {mode === 'daily'
                  ? isBn
                    ? 'দৈনিক তালিকা (চলতি মাস)'
                    : 'Daily Breakdown (Month)'
                  : isBn
                  ? 'তারিখ ও মাসভিত্তিক তালিকা'
                  : 'Period Breakdown'}
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('invoices')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  sectionTab === 'invoices'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBn ? `চালান ভিত্তিক লাভ (${filteredInvoices.length})` : `Invoice Profit (${filteredInvoices.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('expenses')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  sectionTab === 'expenses'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBn
                  ? `খরচের বিবরণ (${filteredExpenses.length + (includePayroll ? filteredPayroll.length : 0)})`
                  : `Expense Details (${filteredExpenses.length + (includePayroll ? filteredPayroll.length : 0)})`}
              </button>
            </div>

            {sectionTab === 'period' && mode !== 'daily' && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setPeriodGrouping('daily')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    periodGrouping === 'daily'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBn ? 'দিন অনুযায়ী' : 'By Day'}
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodGrouping('monthly')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    periodGrouping === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBn ? 'মাস অনুযায়ী' : 'By Month'}
                </button>
              </div>
            )}
          </div>

          {/* Tab A: Period Breakdown Table */}
          {sectionTab === 'period' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4">
                      {periodGrouping === 'monthly' && mode !== 'daily'
                        ? isBn
                          ? 'মাস (Month)'
                          : 'Month'
                        : isBn
                        ? 'তারিখ (Date)'
                        : 'Date'}
                    </th>
                    <th className="py-2.5 px-4 text-center">{isBn ? 'চালান' : 'Invoices'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'রিটার্ন' : 'Returns'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'ক্রয়মূল্য (COGS)' : 'Cost (COGS)'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'মোট লাভ' : 'Gross Profit'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'খরচ' : 'Expenses'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'নিট লাভ / ক্ষতি' : 'Net Profit / Loss'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodBreakdownRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        {isBn
                          ? 'এই সময়কালে কোনো বিক্রয় বা খরচের লেনদেন পাওয়া যায়নি।'
                          : 'No sales or expense entries found for this period.'}
                      </td>
                    </tr>
                  ) : (
                    periodBreakdownRows.map(row => {
                      const isSelectedRow =
                        (mode === 'daily' && row.key === dailyDate) ||
                        (mode === 'monthly' && periodGrouping === 'monthly' && row.key === monthlyVal);
                      return (
                        <tr
                          key={row.key}
                          onClick={() => {
                            if (row.key.length === 7) selectMonthlyMode(row.key);
                            else selectDailyMode(row.key);
                          }}
                          className={`transition-colors cursor-pointer ${
                            isSelectedRow
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{row.key}</span>
                            {isSelectedRow && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-sans">
                                {isBn ? 'নির্বাচিত' : 'Active'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono">{row.invoiceCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-amber-600">
                            {row.returnedAmount > 0 ? formatCurrency(row.returnedAmount) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(row.netRevenue)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                            {formatCurrency(row.netCogs)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              row.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatCurrency(row.grossProfit)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-rose-600">
                            {row.expenses > 0 ? formatCurrency(row.expenses) : '-'}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-black ${
                              row.netProfit >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatCurrency(row.netProfit)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {periodBreakdownRows.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-850 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        {isBn ? 'সর্বমোট (Total):' : 'Total:'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono">
                        {periodBreakdownRows.reduce((s, r) => s + r.invoiceCount, 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-600">
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.returnedAmount, 0))}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-600">
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.netRevenue, 0))}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.netCogs, 0))}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600">
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.grossProfit, 0))}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600">
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.expenses, 0))}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono text-sm ${
                          periodBreakdownRows.reduce((s, r) => s + r.netProfit, 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(periodBreakdownRows.reduce((s, r) => s + r.netProfit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Tab B: Invoice Breakdown */}
          {sectionTab === 'invoices' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4">{isBn ? 'তারিখ' : 'Date'}</th>
                    <th className="py-2.5 px-4">{isBn ? 'ইনভয়েস #' : 'Invoice #'}</th>
                    <th className="py-2.5 px-4">{isBn ? 'কাস্টমার' : 'Customer'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Revenue'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'ক্রয়মূল্য (COGS)' : 'Cost (COGS)'}</th>
                    <th className="py-2.5 px-4 text-right">{isBn ? 'লাভ / ক্ষতি' : 'Gross Profit'}</th>
                    <th className="py-2.5 px-4 text-center">{isBn ? 'মার্জিন %' : 'Margin %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        {isBn
                          ? 'এই সময়কালে কোনো বিক্রয় চালান নেই।'
                          : 'No sales invoices found in this period.'}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(({ inv, isoDate, metrics, returnedAmt }) => {
                      const margin =
                        metrics.netRevenue > 0 ? ((metrics.netProfit / metrics.netRevenue) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-mono text-slate-500">{isoDate}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{inv.invoiceNumber}
                            {returnedAmt > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[9px] font-sans">
                                {isBn ? 'রিটার্ন সমন্বিত' : 'Returned'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {inv.customerName || 'Walk-in Customer'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(metrics.netRevenue)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-rose-600">
                            {formatCurrency(metrics.netCogs)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatCurrency(metrics.netProfit)}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-500">{margin}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab C: Expense Details */}
          {sectionTab === 'expenses' && (
            <div className="p-4 space-y-4">
              {expenseByCategory.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {expenseByCategory.map(cat => (
                    <div
                      key={cat.categoryName}
                      className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 text-xs"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{cat.categoryName}</div>
                      <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                        {formatCurrency(cat.total)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {cat.count} {isBn ? 'টি ভাউচার' : 'entries'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-4">{isBn ? 'তারিখ' : 'Date'}</th>
                      <th className="py-2.5 px-4">{isBn ? 'ভাউচার #' : 'Voucher #'}</th>
                      <th className="py-2.5 px-4">{isBn ? 'খরচের খাত' : 'Category'}</th>
                      <th className="py-2.5 px-4">{isBn ? 'বিবরণ / প্রাপক' : 'Note / Payee'}</th>
                      <th className="py-2.5 px-4 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredExpenses.length === 0 && (!includePayroll || filteredPayroll.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          {isBn ? 'এই সময়কালে কোনো খরচ রেকর্ড নেই।' : 'No expenses recorded in this period.'}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredExpenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-4 font-mono text-slate-500">
                              {normalizeDateToISO(exp.date) || exp.date}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                              #{exp.voucherNo}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-rose-600 dark:text-rose-400">
                              {exp.categoryName || exp.category}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                              {exp.payee ? `${exp.payee} — ` : ''}
                              {exp.note || exp.remarks || '-'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                              {formatCurrency(exp.amount)}
                            </td>
                          </tr>
                        ))}
                        {includePayroll &&
                          filteredPayroll.map(pay => (
                            <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-purple-50/30 dark:bg-purple-950/10">
                              <td className="py-2.5 px-4 font-mono text-slate-500">
                                {normalizeDateToISO(pay.paymentDate) || pay.paymentDate}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                                #{pay.voucherNo}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-purple-600 dark:text-purple-400">
                                {isBn ? 'বেতন (Payroll)' : 'Staff Salary'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                                {pay.employeeName} ({pay.payrollMonth})
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                                {formatCurrency(Number(pay.paidAmount ?? pay.netPay ?? 0))}
                              </td>
                            </tr>
                          ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ProfitLossReportView.displayName = 'ProfitLossReportView';
