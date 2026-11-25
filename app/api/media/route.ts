import {matchBusinessId} from '../../../lib/business-match';
import {NextResponse} from 'next/server';import JSZip from 'jszip';import {admin} from '../../../lib/auth';import {hasDatabase,load,mutate} from '../../../lib/store';import {authorized,str,approved} from '../../../lib/model';import {parseRows} from '../../../lib/imports';import {putImage,getImage} from '../../../lib/media';
export async function GET(r:Request){try{const u=new URL(r.url),id=u.searchParams.get('id')||'',file=u.searchParams.get('file')||'';const s=await load(),b=s.businesses.find(x=>x.business_id===id),m=s.media.find(x=>x.business_id===id&&x.filename===file);if(!m||(!await admin()&&(!b||!approved(b))&&!(process.env.DIRECTORY_PREVIEW==='true'&&process.env.NODE_ENV!=='production')))return new Response(null,{status:404});return new Response(new Uint8Array(await getImage(id,file)),{headers:{'Content-Type':'image/webp','Cache-Control':'private, max-age=3600'}})}catch{return new Response(null,{status:404})}}
export async function POST(r:Request){if(!await admin())return NextResponse.json({error:'Unauthorized'},{status:401});try{const f=await r.formData(),file=f.get('file');
const uploadedManifest=f.get('manifest');
if(uploadedManifest instanceof File){
  const rows=await parseRows('manifest.csv',new Uint8Array(await uploadedManifest.arrayBuffer()));
  if(rows.length>500)throw Error('Split archives into batches of 500 images or fewer');
  return NextResponse.json({rows});
}if(process.env.VERCEL&&!hasDatabase())return NextResponse.json({error:'Connect the dedicated database before importing images.'},{status:503});if(!(file instanceof File)||file.size>50*1024*1024)throw Error('Choose an image or ZIP under 50 MB');const s=await load(),ids=new Set(s.businesses.map(b=>b.business_id));let rows:Record<string,unknown>[]=[],zip:JSZip|null=null;if(/\.zip$/i.test(file.name)){zip=await JSZip.loadAsync(await file.arrayBuffer());const manifests=Object.keys(zip.files).filter(n=>/^image-manifest\.(csv|json)$/.test(n.split('/').pop()||''));
if(manifests.length!==1)throw Error('ZIP must contain exactly one image manifest');
const manifest=manifests[0];
rows=await parseRows(manifest,await zip.file(manifest)!.async('uint8array'))}else{rows=[{business_id:f.get('business_id'),filename:file.name,reuse_permission_status:f.get('permission'),original_source_url:f.get('source'),license:f.get('license'),image_type:f.get('type')}]}if(rows.length>500)throw Error('Split archives into batches of 500 images or fewer');let imported=0,skipped=0,errors:string[]=[];for(const row of rows){const id=matchBusinessId(ids,row.business_id,row.filename,row.image_filename,row.relative_file_path,row.relative_path),name=str(row.filename||row.image_filename),source=str(row.original_source_url||row.source_url),license=str(row.license);if(!id||!authorized(row.reuse_permission_status||row.permission_status)||!source||!license){skipped++;errors.push((name||'Image')+': '+(!id?'Business ID missing, unknown, or ambiguous':'Source and reuse permission required'));continue}try{const entry=zip?(zip.file(str(row.relative_file_path||row.relative_path))||zip.file(Object.keys(zip.files).find(p=>p.split('/').pop()===name)||'')):null;if(zip&&!entry)throw Error('Missing image file');const bytes=entry?await entry.async('uint8array'):new Uint8Array(await file.arrayBuffer());const saved=await putImage(id,bytes);const added=await mutate(state=>{if(state.media.some(m=>m.business_id===id&&m.filename===saved.filename))return false;const cover=/cover/i.test(str(row.image_type)+' '+name)||!state.media.some(m=>m.business_id===id);if(cover)state.media.filter(m=>m.business_id===id).forEach(m=>m.cover=false);state.media.push({business_id:id,...saved,source_url:source,license,attribution:str(row.attribution),permission_status:'approved',cover});return true});added?imported++:skipped++}catch(e){skipped++;errors.push(id+': '+(e as Error).message)}}return NextResponse.json({imported,skipped,errors})}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
export async function PATCH(r:Request){if(!await admin())return NextResponse.json({error:'Unauthorized'},{status:401});const {business_id,filename}=await r.json();return NextResponse.json(await mutate(s=>{if(!s.media.some(m=>m.business_id===business_id&&m.filename===filename))return {error:'Missing image'};s.media.filter(m=>m.business_id===business_id).forEach(m=>m.cover=m.filename===filename);return {ok:true}}))}

export async function DELETE(r:Request) {
  if (!await admin()) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const {business_id, filename} = await r.json();
  const result = await mutate(state => {
    const index = state.media.findIndex(m => m.business_id === business_id && m.filename === filename);
    if (index < 0) return {error:'Missing image'};
    const [removed] = state.media.splice(index, 1);
    if (removed.cover) {
      const replacement = state.media.find(m => m.business_id === business_id);
      if (replacement) replacement.cover = true;
    }
    return {ok:true};
  });
  return NextResponse.json(result, {status:'error' in result ? 404 : 200});
}
