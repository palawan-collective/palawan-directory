import {S3Client, PutObjectCommand, GetObjectCommand} from '@aws-sdk/client-s3';
import {get, put} from '@vercel/blob';
import sharp from 'sharp';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

function r2Client() {
  const {R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET} = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return new S3Client({
    region:'auto',
    endpoint:`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:R2_ACCESS_KEY_ID, secretAccessKey:R2_SECRET_ACCESS_KEY},
  });
}

export async function putImage(id: string, bytes: Uint8Array) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('Invalid ID');
  if (bytes.length > 20 * 1024 * 1024) throw Error('Image too large');
  const image = await sharp(bytes, {limitInputPixels:30_000_000})
    .rotate().resize({width:1600, height:1600, fit:'inside', withoutEnlargement:true})
    .webp({quality:84}).toBuffer();
  const hash = createHash('sha256').update(image).digest('hex').slice(0,24);
  const filename = id+'-'+hash+'.webp';
  const key = id+'/'+filename;
  const r2 = r2Client();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(key,image,{access:'private',contentType:'image/webp',allowOverwrite:true});
  } else if (r2) {
    await r2.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET, Key:key, Body:image, ContentType:'image/webp'}));
  } else {
    if (process.env.VERCEL) throw Error('Connect the dedicated private media store before importing images.');
    const directory = path.join(process.cwd(),'.local-data','images',id);
    await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,filename),image);
  }
  return {filename,url:'/api/media?id='+encodeURIComponent(id)+'&file='+encodeURIComponent(filename)};
}

export async function getImage(id: string, filename: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !/^[-\w]+\.webp$/.test(filename)) throw Error('Invalid path');
  const key = id+'/'+filename;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await get(key,{access:'private'});
    if (!blob || blob.statusCode !== 200) throw Error('Missing image');
    return Buffer.from(await new Response(blob.stream).arrayBuffer());
  }
  const r2 = r2Client();
  if (r2) {
    const response = await r2.send(new GetObjectCommand({Bucket:process.env.R2_BUCKET, Key:key}));
    if (!response.Body) throw Error('Missing image');
    return Buffer.from(await response.Body.transformToByteArray());
  }
  return readFile(path.join(process.cwd(),'.local-data','images',id,filename));
}
