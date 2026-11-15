export class ReportApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "ReportApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new ReportApiError(
    "INVALID_RESPONSE",
    502,
    "Respons laporan dari server tidak sesuai kontrak.",
  );
}

function assertReportData(data) {
  if (
    !data ||
    typeof data.outletId !== "string" ||
    !data.period ||
    typeof data.period.type !== "string" ||
    !data.summary ||
    typeof data.summary.totalIncome !== "string" ||
    typeof data.summary.totalExpense !== "string" ||
    typeof data.summary.netBalance !== "string" ||
    typeof data.summary.transactionCount !== "number" ||
    typeof data.summary.expenseCount !== "number" ||
    !data.paymentSummary ||
    !data.paymentSummary.cash ||
    !data.paymentSummary.qris ||
    !Array.isArray(data.productSales) ||
    !data.expenseSummary ||
    !Array.isArray(data.expenseSummary.categories)
  ) {
    throw invalidResponse();
  }
  return data;
}

export function createReportApi({ request }) {
  return {
    async getDailyReport(outletId, date) {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/reports/daily${query}`;
      const data = await request(path);
      return assertReportData(data);
    },

    async getMonthlyReport(outletId, month) {
      const query = month ? `?month=${encodeURIComponent(month)}` : "";
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/reports/monthly${query}`;
      const data = await request(path);
      if (!Array.isArray(data?.dailyBreakdown)) {
        throw invalidResponse();
      }
      return assertReportData(data);
    },

    async exportCsv(outletId, { type = "DAILY", periodKey }) {
      const query = `?type=${encodeURIComponent(type)}&periodKey=${encodeURIComponent(periodKey)}`;
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/reports/export/csv${query}`;
      return request(path);
    },

    async exportHtml(outletId, { type = "DAILY", periodKey }) {
      const query = `?type=${encodeURIComponent(type)}&periodKey=${encodeURIComponent(periodKey)}`;
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/reports/export/html${query}`;
      return request(path);
    },
  };
}

