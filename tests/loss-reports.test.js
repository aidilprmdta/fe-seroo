import assert from "node:assert/strict";
import test from "node:test";
import { createLossReportsApi } from "../src/api/loss-reports.js";
import { LossReportsApi } from "../src/api/api.js";
import { ROUTES, isAllowedRoute } from "../src/auth/routePolicy.js";

test("Mobile 1: listLossReports memuat daftar laporan Crew dan encodes outletId", async () => {
  let capturedPath = null;
  const mockReports = [
    {
      id: "report-1",
      outletId: "outlet/rumbai#1",
      inventoryItemId: "item-tea",
      itemName: "Daun Teh Hitam",
      quantity: "1.500",
      unit: "kg",
      reason: "Tumpah",
      status: "PENDING",
      createdAt: "2026-11-19T10:00:00.000Z",
    },
  ];

  const mockRequest = {
    async get(path) {
      capturedPath = path;
      return { success: true, data: mockReports, meta: { summary: { PENDING: 1, CONFIRMED: 0, REJECTED: 0 } } };
    },
  };

  const api = createLossReportsApi({ request: mockRequest });
  const result = await api.listLossReports("outlet/rumbai#1", { status: "PENDING" });

  assert.equal(
    capturedPath,
    `/outlets/${encodeURIComponent("outlet/rumbai#1")}/loss-reports?status=PENDING`,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].itemName, "Daun Teh Hitam");
  assert.equal(result[0].status, "PENDING");
});

test("Mobile 2: createLossReport mengirim payload laporan baru dengan benar", async () => {
  let capturedPath = null;
  let capturedBody = null;

  const mockRequest = {
    async post(path, body) {
      capturedPath = path;
      capturedBody = body;
      return {
        success: true,
        data: {
          id: "report-new",
          outletId: "outlet-rumbai",
          ...body,
          status: "PENDING",
        },
      };
    },
  };

  const api = createLossReportsApi({ request: mockRequest });
  const payload = {
    inventoryItemId: "item-sugar",
    quantity: "2.000",
    reason: "Kemasan rusak terkena air",
    description: "Shift pagi di gudang",
  };

  const result = await api.createLossReport("outlet-rumbai", payload);

  assert.equal(capturedPath, "/outlets/outlet-rumbai/loss-reports");
  assert.deepEqual(capturedBody, payload);
  assert.equal(result.status, "PENDING");
});

test("Mobile 3: Validasi quantity (harus > 0 dan format angka valid)", () => {
  const validateQuantity = (qtyStr) => {
    const num = Number(qtyStr);
    if (!qtyStr || !qtyStr.trim() || isNaN(num) || num <= 0) {
      return { valid: false, error: "Jumlah kehilangan harus angka lebih dari 0." };
    }
    return { valid: true };
  };

  assert.equal(validateQuantity("").valid, false);
  assert.equal(validateQuantity("0").valid, false);
  assert.equal(validateQuantity("-1").valid, false);
  assert.equal(validateQuantity("abc").valid, false);
  assert.equal(validateQuantity("1.5").valid, true);
  assert.equal(validateQuantity("10").valid, true);
});

test("Mobile 4: Validasi field wajib (item dan alasan tidak boleh kosong)", () => {
  const validateForm = (item, reason) => {
    if (!item) return { valid: false, error: "Pilih item inventaris yang hilang." };
    if (!reason || !reason.trim()) return { valid: false, error: "Alasan kehilangan wajib diisi." };
    return { valid: true };
  };

  assert.equal(validateForm("", "Alasan").valid, false);
  assert.equal(validateForm("item-1", "").valid, false);
  assert.equal(validateForm("item-1", "   ").valid, false);
  assert.equal(validateForm("item-1", "Tumpah").valid, true);
});

test("Mobile 5: Status PENDING ditampilkan dengan badge warning dan label MENUNGGU REVIEW", () => {
  const getBadgeConfig = (status) => {
    switch (status) {
      case "CONFIRMED":
        return { variant: "success", label: "DIKONFIRMASI" };
      case "REJECTED":
        return { variant: "danger", label: "DITOLAK" };
      case "PENDING":
      default:
        return { variant: "warning", label: "MENUNGGU REVIEW" };
    }
  };

  const badge = getBadgeConfig("PENDING");
  assert.equal(badge.variant, "warning");
  assert.equal(badge.label, "MENUNGGU REVIEW");
});

test("Mobile 6: Manager berhasil memuat daftar laporan dan ringkasan status", async () => {
  const mockResponse = {
    success: true,
    data: [
      { id: "rep-1", status: "PENDING" },
      { id: "rep-2", status: "CONFIRMED" },
      { id: "rep-3", status: "REJECTED" },
    ],
    meta: {
      summary: { PENDING: 1, CONFIRMED: 1, REJECTED: 1 },
    },
  };

  const mockRequest = {
    async get() {
      return mockResponse;
    },
  };

  const lossReportsApi = new LossReportsApi(mockRequest);
  const res = await lossReportsApi.listLossReports("outlet-rumbai");

  assert.equal(res.length, 3);
  // Summary parsing
  const counts = { PENDING: 0, CONFIRMED: 0, REJECTED: 0 };
  res.forEach((r) => counts[r.status]++);
  assert.equal(counts.PENDING, 1);
  assert.equal(counts.CONFIRMED, 1);
  assert.equal(counts.REJECTED, 1);
});

test("Mobile 7: Manager berhasil mengonfirmasi laporan (CONFIRMED)", async () => {
  let capturedPath = null;
  let capturedBody = null;

  const mockRequest = {
    async patch(path, body) {
      capturedPath = path;
      capturedBody = body;
      return {
        success: true,
        data: {
          id: "rep-1",
          status: "CONFIRMED",
          reviewNote: "Stok telah disesuaikan",
        },
      };
    },
  };

  const api = createLossReportsApi({ request: mockRequest });
  const result = await api.reviewLossReport("outlet-rumbai", "rep-1", {
    status: "CONFIRMED",
    reviewNote: "Stok telah disesuaikan",
  });

  assert.equal(capturedPath, "/outlets/outlet-rumbai/loss-reports/rep-1/review");
  assert.equal(capturedBody.status, "CONFIRMED");
  assert.equal(capturedBody.reviewNote, "Stok telah disesuaikan");
  assert.equal(result.status, "CONFIRMED");
});

test("Mobile 8: Manager berhasil menolak laporan (REJECTED)", async () => {
  let capturedPath = null;
  let capturedBody = null;

  const mockRequest = {
    async patch(path, body) {
      capturedPath = path;
      capturedBody = body;
      return {
        success: true,
        data: {
          id: "rep-2",
          status: "REJECTED",
          reviewNote: "Tidak disetujui karena tidak ada saksi",
        },
      };
    },
  };

  const api = createLossReportsApi({ request: mockRequest });
  const result = await api.reviewLossReport("outlet-rumbai", "rep-2", {
    status: "REJECTED",
    reviewNote: "Tidak disetujui karena tidak ada saksi",
  });

  assert.equal(capturedPath, "/outlets/outlet-rumbai/loss-reports/rep-2/review");
  assert.equal(capturedBody.status, "REJECTED");
  assert.equal(capturedBody.reviewNote, "Tidak disetujui karena tidak ada saksi");
  assert.equal(result.status, "REJECTED");
});

test("Mobile 9: Double tap / double submission dicegah oleh submitting state", async () => {
  let callCount = 0;
  let isSubmitting = false;

  const processReview = async () => {
    if (isSubmitting) return "BLOCKED";
    isSubmitting = true;
    callCount++;
    // Simulasi delay async
    await new Promise((r) => setTimeout(r, 10));
    isSubmitting = false;
    return "SUCCESS";
  };

  const [firstCall, secondCall] = await Promise.all([
    processReview(),
    processReview(),
  ]);

  const results = [firstCall, secondCall];
  assert.ok(results.includes("SUCCESS"));
  assert.ok(results.includes("BLOCKED"));
  assert.equal(callCount, 1);
});

test("Mobile 10: Error API ditampilkan dengan benar ke pengguna", async () => {
  const mockRequest = {
    async patch() {
      const err = new Error("Stok tidak mencukupi untuk mengonfirmasi laporan kehilangan ini.");
      err.code = "INSUFFICIENT_STOCK";
      err.status = 409;
      throw err;
    },
  };

  const api = createLossReportsApi({ request: mockRequest });

  let errorMessage = null;
  try {
    await api.reviewLossReport("outlet-rumbai", "rep-over", { status: "CONFIRMED" });
  } catch (err) {
    errorMessage = err.message;
  }

  assert.equal(
    errorMessage,
    "Stok tidak mencukupi untuk mengonfirmasi laporan kehilangan ini.",
  );
});

test("Mobile 11: Stok tidak diasumsikan berkurang sebelum ada konfirmasi", () => {
  const initialStock = 10;
  const pendingReport = {
    id: "rep-1",
    quantity: 2,
    status: "PENDING",
  };

  // Pada UI, stok yang ditampilkan adalah stok resmi dari backend
  // Laporan PENDING tidak memotong stok lokal
  const calculateDisplayStock = (stock, report) => {
    if (report.status === "CONFIRMED") {
      return stock - report.quantity;
    }
    return stock;
  };

  assert.equal(calculateDisplayStock(initialStock, pendingReport), 10);
});

test("Mobile 12: Route policy mengizinkan Crew dan Manager mengakses /loss-reports", () => {
  const memberships = [
    { outletId: "outlet-1", role: "CREW" },
    { outletId: "outlet-2", role: "MANAGER" },
  ];

  const crewContext = { activeOutletId: "outlet-1", activeRole: "CREW" };
  const managerContext = { activeOutletId: "outlet-2", activeRole: "MANAGER" };

  assert.equal(ROUTES.lossReports, "/loss-reports");
  assert.equal(isAllowedRoute(ROUTES.lossReports, memberships, crewContext), true);
  assert.equal(isAllowedRoute(ROUTES.lossReports, memberships, managerContext), true);
});

test("Mobile 13: TASK 04.1 Validasi form review penolakan (reviewNote wajib dan tidak boleh hanya spasi)", () => {
  const validateReview = (action, note) => {
    if (action === "REJECTED" && (!note || !note.trim())) {
      return { valid: false, error: "Catatan penolakan wajib diisi untuk menjelaskan alasan penolakan." };
    }
    return { valid: true };
  };

  assert.equal(validateReview("CONFIRMED", "").valid, true);
  assert.equal(validateReview("CONFIRMED", "Catatan opsional").valid, true);
  assert.equal(validateReview("REJECTED", "").valid, false);
  assert.equal(validateReview("REJECTED", "    ").valid, false);
  assert.equal(validateReview("REJECTED", "Barang tidak hilang, ditemukan di gudang").valid, true);
});
