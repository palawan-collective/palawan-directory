import JSZip from 'jszip';

const requestLimit = 4 * 1024 * 1024;

async function mediaRequest(form: FormData) {
  const response = await fetch('/api/media', {method:'POST', body:form});
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw Error(result.error || 'Media upload failed ('+response.status+').');
  return result;
}

export async function uploadLargeZip(file: File, progress: (message:string)=>void) {
  if (file.size > 50 * 1024 * 1024) throw Error('Choose a ZIP under 50 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  const manifests = paths.filter(p => p.split('/').pop() === 'image-manifest.csv');
  if (manifests.length !== 1) throw Error('ZIP must contain exactly one image-manifest.csv.');
  const manifest = new FormData();
  manifest.set('manifest',await zip.files[manifests[0]].async('blob'),'image-manifest.csv');
  const {rows} = await mediaRequest(manifest) as {rows:Record<string,string>[]};
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index,row] of rows.entries()) {
    const path = row.relative_file_path || row.relative_path;
    const name = row.filename || row.image_filename || path?.split('/').pop() || '';
    const matches = path && zip.file(path) ? [path] : paths.filter(p => p.split('/').pop() === name);
    progress(`Processing image ${index+1} of ${rows.length}…`);
    try {
      if (matches.length !== 1) throw Error('Image path is missing or ambiguous.');
      const bytes = await zip.files[matches[0]].async('uint8array');
      const batch = new JSZip();
      batch.file('image-manifest.json',JSON.stringify([{...row,filename:name,relative_file_path:matches[0]}]));
      batch.file(matches[0],bytes);
      const blob = await batch.generateAsync({type:'blob',compression:'DEFLATE'});
      if (blob.size >= requestLimit) throw Error('Reduce the source image to under 4 MB and retry.');
      const form = new FormData();
      form.set('file',blob,'images.zip');
      const result = await mediaRequest(form);
      imported += result.imported;
      skipped += result.skipped;
      errors.push(...result.errors);
    } catch (error) {
      skipped++;
      errors.push(name+': '+(error as Error).message);
    }
  }
  return {imported,skipped,errors};
}
