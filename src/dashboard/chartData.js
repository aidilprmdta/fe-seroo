// Helper data chart dashboard. Murni fungsi data, tanpa komponen RN.
const JAKARTA_TZ = 'Asia/Jakarta';
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JAKARTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: JAKARTA_TZ,
  day: '2-digit',
  month: 'short',
});

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: JAKARTA_TZ,
  month: 'long',
  year: 'numeric',
});

export function jakartaDateKey(date = new Date()) {
  return dateFormatter.format(date);
}

export function jakartaMonthKey(date = new Date()) {
  return jakartaDateKey(date).slice(0, 7);
}

export function lastNDates(n, now = new Date()) {
  const base = new Date(`${jakartaDateKey(now)}T12:00:00Z`);
  const dates = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dates.push(jakartaDateKey(new Date(base.getTime() - i * DAY_MS)));
  }
  return dates;
}

export function shortDateLabel(dateKey) {
  return shortDateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

export function monthLabel(monthKey) {
  return monthFormatter.format(new Date(`${monthKey}-01T12:00:00Z`));
}

export function shiftMonth(monthKey, delta) {
  const [yearStr, monthStr] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1 + delta, 1, 12));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getSevenDaySales({ reportsApi, outletId, now = new Date() }) {
  const dates = lastNDates(7, now);
  const months = Array.from(new Set(dates.map((date) => date.slice(0, 7))));
  const reports = await Promise.all(
    months.map((month) => reportsApi.getMonthlyReport(outletId, month)),
  );

  const byDate = new Map();
  for (const report of reports) {
    for (const day of report?.dailyBreakdown || []) {
      byDate.set(day.date, day);
    }
  }

  return dates.map((date) => {
    const day = byDate.get(date);
    return {
      date,
      label: shortDateLabel(date),
      value: Number(day?.totalIncome || 0),
      transactionCount: Number(day?.transactionCount || 0),
    };
  });
}

export function buildMonthlyComparison(report) {
  return [
    {
      key: 'income',
      label: 'Pendapatan',
      value: Number(report?.summary?.totalIncome || 0),
    },
    {
      key: 'expense',
      label: 'Pengeluaran',
      value: Number(report?.summary?.totalExpense || 0),
    },
  ];
}

export function getAdminOutlets(memberships = []) {
  const seen = new Set();
  const outlets = [];
  for (const membership of memberships) {
    if (membership?.role !== 'ADMIN_PUSAT' || !membership.outletId) continue;
    if (seen.has(membership.outletId)) continue;
    seen.add(membership.outletId);
    outlets.push({
      id: membership.outletId,
      name: membership.outletName || membership.outletCode || membership.outletId,
    });
  }
  return outlets;
}

export function buildOutletSalesSeries({ outlets = [], reportsById = new Map() }) {
  return outlets.map((outlet) => ({
    key: outlet.id,
    label: outlet.name,
    value: Number(reportsById.get(outlet.id)?.summary?.totalIncome || 0),
  }));
}
