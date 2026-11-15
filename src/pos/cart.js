const DECIMAL_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export function toMinorUnits(value) {
  const normalized = String(value);
  if (!DECIMAL_PATTERN.test(normalized)) {
    throw new Error("Harga katalog tidak valid.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function calculateCartTotalMinor(cart) {
  return cart.reduce((total, item) => {
    const addOnTotal = item.addOns.reduce(
      (sum, addOn) => sum + toMinorUnits(addOn.unitPrice) * addOn.quantity,
      0,
    );
    return (
      total +
      (toMinorUnits(item.variantPrice) + addOnTotal) * item.quantity
    );
  }, 0);
}

export function buildOrderPayload({
  clientTransactionId,
  paymentMethod,
  payments,
  recordedOffline,
  cart,
}) {
  const payload = {
    clientTransactionId,
    recordedOffline,
    items: cart.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      expectedVariantPrice: item.variantPrice,
      addOns: item.addOns.map((addOn) => ({
        addOnId: addOn.addOnId,
        quantity: addOn.quantity,
        expectedUnitPrice: addOn.unitPrice,
      })),
    })),
  };

  if (Array.isArray(payments) && payments.length > 0) {
    payload.payments = payments;
    payload.paymentMethod = payments.length > 1 ? "SPLIT" : payments[0].paymentMethod;
  } else {
    payload.paymentMethod = paymentMethod || "CASH";
  }

  return payload;
}

export function formatMoney(minorUnits) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function canReachInternet(networkState) {
  return (
    networkState?.isConnected === true &&
    networkState?.isInternetReachable !== false
  );
}

export function classifyOutboxFailure(error) {
  if (
    error?.status === 0 ||
    error?.status === 401 ||
    error?.status === 429 ||
    error?.status >= 500
  ) {
    return "retryable_failure";
  }
  return "needs_review";
}

export function retryDelayMs(retryCount) {
  return Math.min(300000, 2000 * 2 ** Math.min(retryCount, 8));
}

export function orderSyncLabel(record) {
  if (record.status === "queued") return "Menunggu sinkronisasi";
  if (record.status === "syncing") return "Sedang mengirim";
  if (record.status === "retryable_failure") {
    return "Belum terkirim — dapat dicoba lagi";
  }
  if (record.status === "needs_review") {
    return "Perlu ditinjau — tidak dikirim otomatis";
  }
  if (record.serverOrder?.paymentStatus === "PENDING_RECONCILIATION") {
    return "Tersimpan di server · QRIS menunggu rekonsiliasi";
  }
  return "Tersimpan di server";
}
