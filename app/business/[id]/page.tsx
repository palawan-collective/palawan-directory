import Link from 'next/link';
import {notFound} from 'next/navigation';
import {load} from '../../../lib/store';
import {approved, coordinates, safeLink, str} from '../../../lib/model';
import {canPreview} from '../../../lib/visibility';

export const dynamic = 'force-dynamic';

export default async function BusinessProfile({params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const state = await load();
  const business = state.businesses.find(b => b.business_id === id);
  if (!business || (!approved(business) && !await canPreview())) notFound();
  const point = coordinates(business);
  const images = state.media.filter(m => m.business_id === id).sort((a,b) => Number(b.cover)-Number(a.cover));
  const address = [str(business.address || business.barangay), str(business.destination)].filter(Boolean).join(' · ');
  return <main className="profile">
    <Link href="/explore">← Explore directory</Link>
    <p className="eyebrow">{str(business.category)}</p>
    <h1>{business.name}</h1>
    {address && <p>{address}</p>}
    {images.length > 0 && <div className="profile-gallery">{images.map(image => <figure key={image.filename}>
      <img src={image.url} alt={business.name} />
      {image.attribution && <figcaption>{image.attribution}</figcaption>}
    </figure>)}</div>}
    {str(business.description) && <p>{str(business.description)}</p>}
    <dl>{(['opening_hours','services','amenities'] as const).filter(k => str(business[k])).map(k => <div key={k}>
      <dt>{k.replaceAll('_',' ')}</dt><dd>{str(business[k])}</dd>
    </div>)}</dl>
    <div className="actions">
      {str(business.phone) && <a href={'tel:'+str(business.phone).replace(/[^+\d]/g,'')}>Call business</a>}
      {safeLink(business.website) && <a href={safeLink(business.website)} rel="noreferrer" target="_blank">Website ↗</a>}
      {safeLink(business.facebook) && <a href={safeLink(business.facebook)} rel="noreferrer" target="_blank">Facebook ↗</a>}
      {point && <a href={'https://www.openstreetmap.org/directions?to='+point.join(',')} rel="noreferrer" target="_blank">Directions ↗</a>}
    </div>
  </main>;
}
