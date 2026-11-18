import { posOutbox } from "../pos/nativeOutbox";
import { wasteOutbox } from "../inventory/nativeWasteOutbox";

export async function markSessionOutboxesForReview(ownerUserId) {
  if (typeof ownerUserId !== "string") return;
  const run = async (api) => {
    try {
      await api.initialize();
      await api.markNeedsReview({ ownerUserId });
    } catch (e) {
      // Ignore: database may be closed (app backgrounded) or no pending outboxes
      // This is a soft sync, not critical for login flow
    }
  };
  await Promise.allSettled([
    run(posOutbox),
    run(wasteOutbox),
  ]);
}
