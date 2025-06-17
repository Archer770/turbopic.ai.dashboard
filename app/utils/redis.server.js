import Redis from "ioredis";

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    db: 3
  });

redis.on("connect", () => console.log("✅ Connected to Redis"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;