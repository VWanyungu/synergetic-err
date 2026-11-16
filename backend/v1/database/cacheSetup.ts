import { Redis as UpstashRedis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import 'dotenv/config';

export interface CacheClient {
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
  del(key: string): Promise<number>;
}

const env = (process.env.NODE_ENV || 'development').toLowerCase();
let redis: CacheClient;

if (env === 'production') {
  // ---------------------------------------------------------------- Production: Local Redis
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = Number(process.env.REDIS_PORT) || 6379;
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  const io = redisUrl
    ? new IORedis(redisUrl)
    : new IORedis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
      });

  redis = {
    async set(key: string, value: unknown, options: { ex?: number } = {}) {
      const serialized = JSON.stringify(value);
      if (options.ex) {
        return io.set(key, serialized, 'EX', options.ex);
      }
      return io.set(key, serialized);
    },
    async get<T = unknown>(key: string): Promise<T | null> {
      const raw = await io.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },
    async del(key: string): Promise<number> {
      return io.del(key);
    },
  };
} else {
  // ---------------------------------------------------------------- Development / Staging: Upstash Redis
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    const upstash = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    });

    redis = {
      set(key: string, value: unknown, options: { ex?: number } = {}) {
        if (options.ex) {
          return upstash.set(key, value, { ex: options.ex });
        }
        return upstash.set(key, value);
      },
      get<T = unknown>(key: string): Promise<T | null> {
        return upstash.get<T>(key);
      },
      del(key: string): Promise<number> {
        return upstash.del(key);
      },
    };
  } else {
    // In-memory fallback if Upstash credentials are not set during local dev/testing
    const memoryStore = new Map<string, { value: unknown; expiresAt?: number }>();
    redis = {
      async set(key: string, value: unknown, options: { ex?: number } = {}) {
        const expiresAt = options.ex ? Date.now() + options.ex * 1000 : undefined;
        memoryStore.set(key, { value, expiresAt });
        return 'OK';
      },
      async get<T = unknown>(key: string): Promise<T | null> {
        const entry = memoryStore.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          memoryStore.delete(key);
          return null;
        }
        return entry.value as T;
      },
      async del(key: string): Promise<number> {
        const existed = memoryStore.delete(key);
        return existed ? 1 : 0;
      },
    };
  }
}

export default redis;
