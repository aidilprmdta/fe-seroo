// Helper query dan label untuk layar Audit Log Manager.
const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const JAKARTA_TIME = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

const DAY_LABEL = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});

export const AUDIT_PERIODS = [
  { value: "TODAY", label: "Hari ini" },
  { value: "7D", label: "7 hari" },
  { value: "30D", label: "30 hari" },
  { value: "ALL", label: "Semua" },
];

export const AUDIT_MODULES = [
  { value: "", label: "Semua modul" },
  { value: "Order", label: "Transaksi" },
  { value: "Expense", label: "Pengeluaran" },
  { value: "ClosingRecord", label: "Closing" },
  { value: "InventoryItem", label: "Inventaris" },
  { value: "WasteRecord", label: "Waste" },
  { value: "LossReport", label: "Kehilangan" },
  { value: "OutletProductAvailability", label: "Ketersediaan menu" },
  { value: "StockRequest", label: "Permintaan stok" },
  { value: "Report", label: "Laporan" },
  { value: "OutletStockTransfer", label: "Transfer stok" },
  { value: "ShiftHandover", label: "Serah terima" },
  { value: "User", label: "Akun" },
];

export const AUDIT_OUTCOMES = [
  { value: "", label: "Semua status" },
  { value: "SUCCESS", label: "Berhasil" },
  { value: "FAILURE", label: "Gagal" },
];

const ACTION_LABELS = {
  ORDER_CREATED: "Transaksi baru dicatat",
  ORDER_REPLAYED: "Transaksi dikirim ulang",
  QRIS_VERIFIED: "Pembayaran QRIS diverifikasi",
  ORDER_CANCELLED: "Transaksi dibatalkan",
  ORDER_ITEM_CANCELLED: "Item transaksi dibatalkan",
  EXPENSE_CREATED: "Pengeluaran dicatat",
  EXPENSE_REPLAYED: "Pengeluaran dikirim ulang",
  EXPENSE_CORRECTED: "Pengeluaran dikoreksi",
  EXPENSE_CANCELLED: "Pengeluaran dibatalkan",
  CLOSING_CLOSED: "Closing disimpan",
  CLOSING_RE_CLOSED: "Closing diperbarui",
  CLOSING_REOPENED: "Closing dibuka kembali",
  CASH_OPENING_RECORDED: "Kas awal shift dicatat",
  CASH_DIFFERENCE_REVIEWED: "Selisih kas diperiksa",
  STOCK_REQUEST_CREATED: "Permintaan stok dibuat",
  WASTE_RECORDED: "Waste dicatat",
  LOSS_REPORT_CREATED: "Laporan kehilangan dibuat",
  PRODUCT_AVAILABILITY_ENABLED: "Menu diaktifkan",
  PRODUCT_AVAILABILITY_DISABLED: "Menu dinonaktifkan",
  REPORT_EXPORTED: "Laporan diekspor",
  ACCOUNT_CREATED: "Akun dibuat",
  LOGIN_SUCCEEDED: "Login berhasil",
  LOGOUT_SUCCEEDED: "Logout",
  SESSION_REFRESHED: "Sesi diperbarui",
  PASSWORD_CHANGED: "Password diubah",
};

export function jakartaDateKey(value) {
  return JAKARTA_DATE.format(new Date(value));
}

function addDaysToKey(key, delta) {
  const [year, month, day] = key.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

export function buildAuditQuery({
  period = "TODAY",
  module = "",
  actorUserId = "",
  outcome = "",
  page = 1,
  pageSize = 20,
  now = new Date(),
} = {}) {
  const params = { page, pageSize };

  if (period !== "ALL") {
    const todayKey = jakartaDateKey(now);
    const startOffset =
      period === "7D" ? -6 : period === "30D" ? -29 : 0;
    params.from = addDaysToKey(todayKey, startOffset);
    params.to = addDaysToKey(todayKey, 1);
  }
  if (module) params.resourceType = module;
  if (actorUserId) params.actorUserId = actorUserId;
  if (outcome) params.outcome = outcome;

  return params;
}

export function moduleLabel(resourceType) {
  const found = AUDIT_MODULES.find((item) => item.value === resourceType);
  return found ? found.label : resourceType || "Aktivitas";
}

export function describeAction(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return String(action || "Aktivitas").replaceAll("_", " ").toLowerCase();
}

export function formatAuditDay(value, now = new Date()) {
  const key = jakartaDateKey(value);
  const today = jakartaDateKey(now);
  if (key === today) return "HARI INI";
  if (key === addDaysToKey(today, -1)) return "KEMARIN";
  return DAY_LABEL.format(new Date(value)).toUpperCase();
}

export function formatAuditTime(value) {
  return JAKARTA_TIME.format(new Date(value)).replace(":", ".");
}

const SAFE_METADATA_FIELDS = [
  { key: "quantity", label: "Jumlah", type: "number" },
  { key: "version", label: "Versi", type: "number" },
  { key: "itemCount", label: "Jumlah item", type: "number" },
  { key: "role", label: "Role", type: "enum" },
  { key: "status", label: "Status", type: "enum" },
  { key: "previousStatus", label: "Status sebelumnya", type: "enum" },
  { key: "paymentStatus", label: "Status pembayaran", type: "enum" },
  { key: "paymentMethod", label: "Metode bayar", type: "enum" },
  { key: "closingType", label: "Tipe closing", type: "enum" },
  { key: "reportType", label: "Tipe laporan", type: "enum" },
  { key: "format", label: "Format", type: "enum" },
  { key: "type", label: "Tipe", type: "enum" },
  { key: "direction", label: "Arah", type: "enum" },
  { key: "periodKey", label: "Periode", type: "period" },
  { key: "amount", label: "Nominal", type: "money" },
  { key: "openingCash", label: "Kas awal", type: "money" },
  { key: "previousSubtotal", label: "Subtotal sebelumnya", type: "money" },
  { key: "newSubtotal", label: "Subtotal baru", type: "money" },
  { key: "isAvailable", label: "Tersedia", type: "boolean" },
  { key: "isActive", label: "Aktif", type: "boolean" },
  { key: "recordedOffline", label: "Dicatat offline", type: "boolean" },
  { key: "replayed", label: "Dikirim ulang", type: "boolean" },
  { key: "recordWaste", label: "Dicatat sebagai waste", type: "boolean" },
  { key: "reasonProvided", label: "Alasan diisi", type: "boolean" },
  { key: "noteProvided", label: "Catatan diisi", type: "boolean" },
  { key: "notesProvided", label: "Catatan diisi", type: "boolean" },
  { key: "decisionNoteProvided", label: "Catatan keputusan diisi", type: "boolean" },
];

const ENUM_PATTERN = /^[A-Z][A-Z0-9_]{1,40}$/;
const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;
const PERIOD_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

function safeValue(type, value) {
  if (value === null || value === undefined) return null;

  if (type === "boolean") {
    return typeof value === "boolean" ? (value ? "Ya" : "Tidak") : null;
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && /^\d{1,9}(\.\d{1,2})?$/.test(value)) return value;
    return null;
  }
  if (type === "money") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && MONEY_PATTERN.test(value)) return value;
    return null;
  }
  if (type === "period") {
    return typeof value === "string" && PERIOD_PATTERN.test(value) ? value : null;
  }
  if (type === "enum") {
    return typeof value === "string" && ENUM_PATTERN.test(value) ? value : null;
  }
  return null;
}

// Hanya field operasional terkurasi yang ditampilkan. Field bebas seperti note,
// reason, description, nama item, atau ID internal sengaja tidak dipetakan.
export function formatManagerMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const rows = [];
  for (const field of SAFE_METADATA_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(metadata, field.key)) continue;
    const value = safeValue(field.type, metadata[field.key]);
    if (value === null) continue;
    rows.push({ key: field.key, label: field.label, value });
  }
  return rows;
}

export function metadataSummary(metadata) {
  return formatManagerMetadata(metadata)
    .slice(0, 2)
    .map((row) => `${row.label}: ${row.value}`)
    .join(" · ");
}
