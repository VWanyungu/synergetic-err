import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

export interface FileUploadResult {
  url: string;
  publicId: string;
  bytes: number;
  resourceType: 'image' | 'raw';
}

export type CloudinaryUpload = FileUploadResult;

function getEnv(): 'development' | 'staging' | 'production' {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

/** Check whether the storage provider corresponding to the current environment is configured. */
export function isStorageConfigured(): boolean {
  const env = getEnv();
  if (env === 'production') {
    // Production -> Cloudflare R2
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
    return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
  }
  // Development / Staging -> Cloudinary
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

// ---------------------------------------------------------------- Cloudinary (Dev / Staging)
function cloudinaryCredentials() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) {
    throw new Error('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
  }
  return { cloud, key, secret };
}

const signCloudinary = (params: Record<string, string>, secret: string) =>
  createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&') + secret,
    )
    .digest('hex');

export async function uploadToCloudinary(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  const { cloud, key, secret } = cloudinaryCredentials();
  const resourceType = mime.startsWith('image/') ? 'image' : 'raw';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = { folder, timestamp };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file)], { type: mime }), name);
  form.append('folder', folder);
  form.append('timestamp', timestamp);
  form.append('api_key', key);
  form.append('signature', signCloudinary(signed, secret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { secure_url: string; public_id: string; bytes: number };
  return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes, resourceType };
}

// ---------------------------------------------------------------- Cloudflare R2 (Production)
export async function uploadToR2(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      'Cloudflare R2 is not configured yet (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).',
    );
  }

  const resourceType = mime.startsWith('image/') ? 'image' : 'raw';
  const cleanName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${Date.now()}-${cleanName}`;

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: mime,
    }),
  );

  const publicBase = R2_PUBLIC_URL
    ? R2_PUBLIC_URL.replace(/\/$/, '')
    : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${publicBase}/${key}`;

  return {
    url,
    publicId: key,
    bytes: file.length,
    resourceType,
  };
}

// ---------------------------------------------------------------- Unified Upload
/** Environment-aware file upload: uses Cloudinary for dev/staging, and Cloudflare R2 for production. */
export async function uploadFile(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  const env = getEnv();
  if (env === 'production') {
    return uploadToR2(file, name, mime, folder);
  }
  // development & staging -> Cloudinary
  return uploadToCloudinary(file, name, mime, folder);
}

