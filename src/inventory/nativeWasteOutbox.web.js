import { createWasteOutbox } from "./wasteOutbox";
import { createWasteWebRepository } from "./wasteWebRepository";

export const wasteOutbox = createWasteOutbox(createWasteWebRepository());
