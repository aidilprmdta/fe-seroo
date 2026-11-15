export class ExpenseApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "ExpenseApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new ExpenseApiError(
    "INVALID_RESPONSE",
    502,
    "Respons pengeluaran dari server tidak sesuai kontrak.",
  );
}

function assertExpense(expense) {
  if (
    !expense ||
    typeof expense.id !== "string" ||
    !expense.category ||
    typeof expense.category.id !== "string" ||
    typeof expense.category.name !== "string" ||
    typeof expense.amount !== "string" ||
    !["ACTIVE", "CANCELLED"].includes(expense.status) ||
    typeof expense.expenseDate !== "string" ||
    !Array.isArray(expense.audits)
  ) {
    throw invalidResponse();
  }
  return expense;
}

function assertResult(data) {
  if (typeof data?.replayed !== "boolean") {
    throw invalidResponse();
  }
  return { ...data, expense: assertExpense(data.expense) };
}

export function createExpenseApi({ request }) {
  const outletPath = (outletId) =>
    `/api/v1/outlets/${encodeURIComponent(outletId)}/expenses`;

  return {
    async getCategories() {
      const data = await request("/api/v1/expense-categories");
      if (
        !Array.isArray(data?.categories) ||
        !data.categories.every(
          (category) =>
            typeof category.id === "string" &&
            typeof category.name === "string" &&
            ["PROVISIONAL", "CONFIRMED"].includes(category.status),
        )
      ) {
        throw invalidResponse();
      }
      return data;
    },
    async getExpenses(outletId) {
      const data = await request(outletPath(outletId));
      if (
        data?.outletId !== outletId ||
        !Array.isArray(data.expenses)
      ) {
        throw invalidResponse();
      }
      return { ...data, expenses: data.expenses.map(assertExpense) };
    },
    async createExpense(outletId, payload) {
      return assertResult(
        await request(outletPath(outletId), { method: "POST", body: payload }),
      );
    },
    async correctExpense(outletId, expenseId, payload) {
      return assertResult(
        await request(
          `${outletPath(outletId)}/${encodeURIComponent(expenseId)}`,
          { method: "PATCH", body: payload },
        ),
      );
    },
    async cancelExpense(outletId, expenseId, payload) {
      return assertResult(
        await request(
          `${outletPath(outletId)}/${encodeURIComponent(expenseId)}/cancel`,
          { method: "POST", body: payload },
        ),
      );
    },
    async getAudit(outletId, expenseId) {
      const data = await request(
        `${outletPath(outletId)}/${encodeURIComponent(expenseId)}/audit`,
      );
      if (
        data?.expenseId !== expenseId ||
        !Array.isArray(data.audits) ||
        !data.audits.every(
          (audit) =>
            typeof audit.id === "string" &&
            ["CORRECTED", "CANCELLED"].includes(audit.action) &&
            typeof audit.createdAt === "string",
        )
      ) {
        throw invalidResponse();
      }
      return data;
    },
  };
}
