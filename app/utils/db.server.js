
import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";

const globalForPrisma = globalThis;

const limit = pLimit(10); 

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawPrisma;

export const db = new Proxy(rawPrisma, {
  get(target, prop) {
    const original = target[prop];
    if (typeof original !== "function") return original;

    return (...args) =>
      limit(() => original.apply(target, args));
  },
});

export default db;
