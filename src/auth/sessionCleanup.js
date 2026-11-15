import { posOutbox } from "../pos/nativeOutbox";
import { wasteOutbox } from "../inventory/nativeWasteOutbox";

export async function markSessionOutboxesForReview(ownerUserId) {
  if (typeof ownerUserId !== "string") return;
  await Promise.allSettled([
    posOutbox.initialize().then(() => posOutbox.markNeedsReview({ ownerUserId })),
    wasteOutbox.initialize().then(() => wasteOutbox.markNeedsReview({ ownerUserId })),
  ]);
}
