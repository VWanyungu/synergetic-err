import { createHash } from 'node:crypto';
import 'dotenv/config';

export interface CloudinaryUpload {
  url: string;
  publicId: string;
  bytes: number;
}

function credentials() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
  return { cloud, key, secret };
}

const sign = (params: Record<string, string>, secret: string) =>
  createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&') + secret,
    )
    .digest('hex');

/** Signed upload of one file. `raw` keeps non-images (PDF, Office) downloadable as-is; images stay `image` so they can be previewed. */
export async function uploadToCloudinary(file: Buffer, name: string, mime: string, folder = 'risk-attachments'): Promise<CloudinaryUpload & { resourceType: 'image' | 'raw' }> {
  const { cloud, key, secret } = credentials();
  const resourceType = mime.startsWith('image/') ? 'image' : 'raw';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = { folder, timestamp };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file)], { type: mime }), name);
  form.append('folder', folder);
  form.append('timestamp', timestamp);
  form.append('api_key', key);
  form.append('signature', sign(signed, secret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { secure_url: string; public_id: string; bytes: number };
  return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes, resourceType };
}
