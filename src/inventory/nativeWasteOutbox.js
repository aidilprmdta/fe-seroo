import { openDatabaseAsync } from "expo-sqlite";
import { createWasteOutbox } from "./wasteOutbox";
import { createWasteSqliteRepository } from "./wasteSqliteRepository";

export const wasteOutbox = createWasteOutbox(
  createWasteSqliteRepository(openDatabaseAsync),
);
