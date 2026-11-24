import { createPosOutbox } from "./outbox";
import { createWebRepository } from "./webRepository";

export const posOutbox = createPosOutbox(createWebRepository());
