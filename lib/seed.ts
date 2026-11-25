import {createDecipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import type {Business} from './model';
import sealed from '../data/businesses.sealed.json';

export function seedBusinesses(): Business[] {
  const key = process.env.DIRECTORY_SEED_KEY;
  if (key) {
    const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key,'hex'), Buffer.from(sealed.iv,'base64'));
    cipher.setAuthTag(Buffer.from(sealed.tag,'base64'));
    const plaintext = Buffer.concat([cipher.update(Buffer.from(sealed.data,'base64')), cipher.final()]);
    return JSON.parse(gunzipSync(plaintext).toString('utf8'));
  }
  try {
    return JSON.parse(readFileSync(join(process.cwd(),'data','businesses.json'),'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
