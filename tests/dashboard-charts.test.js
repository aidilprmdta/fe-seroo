import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthlyComparison,
  buildOutletSalesSeries,
  getAdminOutlets,
  getSevenDaySales,
  lastNDates,
  shiftMonth,
} from "../src/dashboard/chartData.js";

test("lastNDates returns seven Jakarta date keys ending at now", () => {
  const now = new Date("2026-02-18T03:00:00.000Z");
  assert.deepEqual(lastNDates(7, now), [
    "2026-02-12",
    "2026-02-13",
    "2026-02-14",
    "2026-02-15",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
  ]);
});

test("shiftMonth moves across year boundaries", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-02", 0), "2026-02");
});

test("getSevenDaySales fills missing days with zero and uses monthly breakdown", async () => {
  const calls = [];
  const reportsApi = {
    async getMonthlyReport(outletId, month) {
      calls.push([outletId, month]);
      return {
        dailyBreakdown: [
          { date: "2026-02-12", totalIncome: "150000.00", transactionCount: 3 },
          { date: "2026-02-17", totalIncome: "90000.00", transactionCount: 2 },
          { date: "2026-02-18", totalIncome: "30000.00", transactionCount: 1 },
        ],
      };
    },
  };
  const series = await getSevenDaySales({
    reportsApi,
    outletId: "outlet-rumbai",
    now: new Date("2026-02-18T03:00:00.000Z"),
  });
  assert.equal(series.length, 7);
  assert.equal(series[0].value, 150000);
  assert.equal(series[1].value, 0);
  assert.equal(series[5].value, 90000);
  assert.equal(series[6].value, 30000);
  assert.deepEqual(calls, [["outlet-rumbai", "2026-02"]]);
});

test("buildMonthlyComparison reads report summary strings", () => {
  assert.deepEqual(
    buildMonthlyComparison({
      summary: { totalIncome: "1250000.00", totalExpense: "400000.00" },
    }),
    [
      { key: "income", label: "Pendapatan", value: 1250000 },
      { key: "expense", label: "Pengeluaran", value: 400000 },
    ],
  );
});

test("getAdminOutlets only keeps ADMIN_PUSAT memberships and dedupes", () => {
  const outlets = getAdminOutlets([
    { outletId: "outlet-a", outletName: "Outlet A", role: "ADMIN_PUSAT" },
    { outletId: "outlet-b", outletName: "Outlet B", role: "OWNER_MITRA" },
    { outletId: "outlet-a", outletName: "Outlet A", role: "ADMIN_PUSAT" },
    { outletId: "outlet-c", outletCode: "SR-C", role: "ADMIN_PUSAT" },
  ]);
  assert.deepEqual(outlets, [
    { id: "outlet-a", name: "Outlet A" },
    { id: "outlet-c", name: "SR-C" },
  ]);
});

test("buildOutletSalesSeries keeps outlet order and zero for missing reports", () => {
  const reportsById = new Map([
    ["outlet-a", { summary: { totalIncome: "800000.00" } }],
  ]);
  assert.deepEqual(
    buildOutletSalesSeries({
      outlets: [
        { id: "outlet-a", name: "Outlet A" },
        { id: "outlet-b", name: "Outlet B" },
      ],
      reportsById,
    }),
    [
      { key: "outlet-a", label: "Outlet A", value: 800000 },
      { key: "outlet-b", label: "Outlet B", value: 0 },
    ],
  );
});
