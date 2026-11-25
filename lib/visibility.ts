import {admin} from './auth';

export async function canPreview() {
  return process.env.DIRECTORY_PREVIEW === 'true' &&
    (process.env.NODE_ENV !== 'production' || (process.env.VERCEL_ENV === 'preview' && await admin()));
}
