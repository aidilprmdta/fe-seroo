import { openDatabaseAsync } from "expo-sqlite";
import { createPosOutbox } from "./outbox";
import { createSqliteRepository } from "./sqliteRepository";

export const posOutbox = createPosOutbox(
  createSqliteRepository(openDatabaseAsync),
);
