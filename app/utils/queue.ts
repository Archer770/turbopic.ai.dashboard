import { Queue } from "bullmq";
import redis from "./redis.server.js";

export const taskQueue = new Queue("dashboardtaskQueue", { connection: redis });

export async function addTask(data: any) {
  await taskQueue.add("do-something", data, {
    removeOnComplete: true,
    removeOnFail: true,
  });

  console.log("🟢 Задача додана до черги");
}