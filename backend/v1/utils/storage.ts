import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileUploads } from './metrics.js';
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
// Two buckets. Attachments go to the private one (R2_BUCKET_NAME) and are only reachable through short-lived signed links
// that the API hands out after checking who is asking. Profile pictures are shown as plain <img> tags in lists, which cannot
// carry a signature that expires, so they go to a separate public bucket (R2_PUBLIC_BUCKET_NAME, served from R2_PUBLIC_URL).
const r2Client = () => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('Cloudflare R2 is not configured yet (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
};

/** Stored in `risk_attachments.url` for private files: a marker, not a link anyone can open. */
export const R2_PRIVATE_PREFIX = 'r2:';

export async function uploadToR2(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  const s3 = r2Client();
  const isPublic = folder === 'profile';
  const bucket = isPublic ? process.env.R2_PUBLIC_BUCKET_NAME : process.env.R2_BUCKET_NAME;
  if (!bucket || (isPublic && !process.env.R2_PUBLIC_URL)) {
    throw new Error('Profile images need R2_PUBLIC_BUCKET_NAME and R2_PUBLIC_URL (the public bucket and its domain).');
  }

  const resourceType = mime.startsWith('image/') ? 'image' : 'raw';
  const cleanName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${Date.now()}-${cleanName}`;

  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file, ContentType: mime }));

  return {
    url: isPublic ? `${process.env.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}` : `${R2_PRIVATE_PREFIX}${key}`,
    publicId: key,
    bytes: file.length,
    resourceType,
  };
}

/** A link that opens one private file for a few minutes. Images and PDFs open in the tab; anything else downloads under its own name. */
export async function signedDownloadUrl(key: string, name: string, mime: string | null, expiresIn = 300): Promise<string> {
  const inline = !!mime && (mime.startsWith('image/') || mime === 'application/pdf');
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      ...(mime && { ResponseContentType: mime }),
    }),
    { expiresIn },
  );
}

// ---------------------------------------------------------------- Unified Upload
/** Environment-aware file upload: uses Cloudinary for dev/staging, and Cloudflare R2 for production. */
export async function uploadFile(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  const provider = getEnv() === 'production' ? 'r2' : 'cloudinary';
  try {
    const result = provider === 'r2' ? await uploadToR2(file, name, mime, folder) : await uploadToCloudinary(file, name, mime, folder);
    fileUploads.inc({ provider, result: 'success' });
    return result;
  } catch (err) {
    fileUploads.inc({ provider, result: 'error' });
    throw err;
  }
}

