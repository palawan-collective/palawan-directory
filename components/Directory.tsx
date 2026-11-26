'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {Business, Media, destinations, category, coordinates, safeLink, str} from '../lib/model';

const MapView = dynamic(() => import('./Map'), {ssr:false, loading:() => <div className="map-shell">Loading map…</div>});
const groups = {
  All: ['✳', 'All'],
  Stay: ['🏨', 'Accommodations'],
  Eat: ['🍽', 'Restaurants'],
  Drink: ['☕', 'Cafés'],
  Explore: ['🧭', 'Tours & Activities'],
  Discover: ['🏝', 'Beaches & Sights'],
  Wellness: ['💆', 'Wellness'],
  Shop: ['🛍', 'Shopping'],
  Services: ['🧰', 'Local Services'],
};
type Group = keyof typeof groups;
type View = 'Home' | 'Explore' | 'Discover' | 'Saved';

export default function Directory({initialView = 'Home'}: {initialView?: View}) {
  const [rows, setRows] = useState<Business[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState(initialView);
  const [dest, setDest] = useState('Puerto Princesa');
  const [group, setGroup] = useState<Group>('All');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Business|null>(null);
  const [limit, setLimit] = useState(40);
  const [saved, setSaved] = useState<string[]>([]);
  const [mobile, setMobile] = useState('map');
  const [area, setArea] = useState<[number,number,number,number]|null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [mappedOnly, setMappedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch('/api/businesses', {cache:'no-store'}).then(r => {
      if (!r.ok) throw Error('Could not load the directory.');
      return r.json();
    }).then(x => {
      setRows(x.businesses);
      setMedia(x.media);
      setPreview(x.preview);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
    try { setSaved(JSON.parse(localStorage.getItem('palawan-saved') || '[]')); } catch {}
  }, []);

  const photos = useMemo(() => {
    const byId = new Map<string, Media[]>();
    for (const image of media) {
      const list = byId.get(image.business_id) || [];
      image.cover ? list.unshift(image) : list.push(image);
      byId.set(image.business_id, list);
    }
    return byId;
  }, [media]);
  const available = useMemo(() => rows.filter(b => {
    if (view === 'Saved' && !saved.includes(b.business_id)) return false;
    if (view !== 'Saved' && dest !== 'All Palawan' && b.destination !== dest) return false;
    const c = category(b);
    if (group === 'Services' && !['Discover','Transport','Essentials','Other'].includes(c)) return false;
    if (group !== 'All' && group !== 'Services' && group !== c) return false;
    if (search && ![b.name,b.category,b.subcategory,b.address,b.barangay,b.services].some(x => str(x).toLowerCase().includes(search))) return false;
    const point = coordinates(b);
    if (mappedOnly && !point) return false;
    return !area || (point && point[0] >= area[0] && point[0] <= area[2] && point[1] >= area[1] && point[1] <= area[3]);
  }), [rows, view, saved, dest, group, search, area, mappedOnly]);
  const featured = useMemo(() => available.filter(b => b.featured === true || str(b.featured).toLowerCase() === 'true'), [available]);
  const filtered = featuredOnly ? featured : available;

  function switchView(next: View) {
    setView(next);
    setSelected(null);
    setArea(null);
    setGroup('All');
    setFeaturedOnly(false);
    setQuery('');
    setSearch('');
    setLimit(40);
  }

  function chooseDestination(destination: string) {
    switchView('Explore');
    setDest(destination);
  }

  function toggle(id: string) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem('palawan-saved', JSON.stringify(next));
  }

  function selectBusiness(b: Business) {
    setSelected(b);
    setMobile('map');
  }

  function card(b: Business) {
    const photo = photos.get(b.business_id)?.[0];
    return <article className={'place-card '+(selected?.business_id === b.business_id ? 'active-card' : '')} key={b.business_id}>
      <button className="card-main" onClick={() => selectBusiness(b)}>
        {photo && <img loading="lazy" src={photo.url} alt="" />}
        <div className="card-copy">
          <h3>{b.name}</h3>
          <small>{groups[category(b) as Group]?.[1] || str(b.category)}{b.barangay ? ' · '+str(b.barangay) : ''}</small>
          {typeof b.description === 'string' && b.description && <p>{b.description}</p>}
        </div>
      </button>
      <button className="heart" aria-label={saved.includes(b.business_id) ? 'Remove saved place' : 'Save '+b.name} onClick={() => toggle(b.business_id)}>{saved.includes(b.business_id) ? '♥' : '♡'}</button>
    </article>;
  }

  const title = view === 'Saved' ? 'Saved places' : dest === 'All Palawan' ? 'Palawan' : dest;
  const selectedPhoto = selected && photos.get(selected.business_id)?.[0];

  return <main className="shell">
    <header className="directory-header">
      <button className="brand" onClick={() => switchView('Home')}><span aria-hidden="true">⛰</span><strong>Puerto Princesa<br />Directory</strong></button>
      <nav aria-label="Main navigation">
        {(['Explore','Discover','Saved'] as View[]).map(x => <button key={x} aria-current={view === x ? 'page' : undefined} onClick={() => switchView(x)}>{x}</button>)}
      </nav>
      <Link href="/admin" className="admin-link">Admin</Link>
    </header>

    {view === 'Discover' ? <section className="editorial">
      <p className="eyebrow">PALAWAN</p>
      <h1>Discover Palawan</h1>
      <p>Explore destinations and find local businesses by interest.</p>
      <div className="dest-grid">{destinations.filter(x => x !== 'All Palawan').map(d => <button key={d} onClick={() => chooseDestination(d)}>
        <h2>{d}</h2><span>{rows.filter(b => b.destination === d).length.toLocaleString()} listings · Explore ↗</span>
      </button>)}</div>
      <div className="chips" aria-label="Explore by interest">{(Object.keys(groups) as Group[]).slice(1).map(c => <button key={c} onClick={() => {
        chooseDestination('All Palawan');
        setGroup(c);
      }}>{groups[c][0]} {groups[c][1]}</button>)}</div>
    </section> : <>
      <section className="directory-hero">
        <p className="eyebrow">⌖ PALAWAN</p>
        <h1>{title}</h1>
        {view !== 'Saved' && <p>Stay, eat, explore, and discover local businesses<br className="hero-break" /> in Palawan.</p>}
        <form className="search-line" onSubmit={e => {
          e.preventDefault();
          setSearch(query.trim().toLowerCase());
          setLimit(40);
          setSelected(null);
        }}>
          {view !== 'Saved' && <select aria-label="Destination" value={dest} onChange={e => chooseDestination(e.target.value)}>
            {destinations.map(d => <option key={d}>{d}</option>)}
          </select>}
          <div className="search-field">
            <input type="search" aria-label="Search businesses" placeholder="Search for hotels, cafés, tours, and more" value={query} onChange={e => {
              setQuery(e.target.value);
              setSearch(e.target.value.trim().toLowerCase());
              setLimit(40);
              setSelected(null);
            }} />
            <button className="primary">Search</button>
          </div>
        </form>
      </section>
      <section className="directory-content" aria-label="Directory">
        <div className="chips" aria-label="Categories">{(Object.keys(groups) as Group[]).map(c => <button key={c} aria-pressed={group === c} className={group === c ? 'selected' : ''} onClick={() => {
          setGroup(c);
          setSelected(null);
          setLimit(40);
        }}><span aria-hidden="true">{groups[c][0]}</span> {groups[c][1]}</button>)}</div>
        {preview && <p className="preview-banner">Private preview · Imported listings are awaiting review.</p>}
        <div className="mobile-switch"><button aria-pressed={mobile === 'map'} className={mobile === 'map' ? 'selected' : ''} onClick={() => setMobile('map')}>Map</button><button aria-pressed={mobile === 'list'} className={mobile === 'list' ? 'selected' : ''} onClick={() => setMobile('list')}>List</button></div>
        <div className="result-tools">
          {featured.length > 0 && <button aria-pressed={featuredOnly} onClick={() => {setFeaturedOnly(!featuredOnly);setSelected(null);}}>Featured</button>}
          <span aria-live="polite">{loading ? 'Loading…' : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'business' : 'businesses'}`}</span>
          {area && <button onClick={() => setArea(null)}>Clear map area ×</button>}
          <button className="filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filters {filtersOpen ? '▴' : '▾'}</button>
          {filtersOpen && <div className="filter-menu"><label><input type="checkbox" checked={mappedOnly} onChange={e => {setMappedOnly(e.target.checked);setSelected(null);}} /> Mapped businesses only</label></div>}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className={`explore mobile-${mobile}`}>
          <aside className="results" aria-label="Business results">
            {!loading && !filtered.length && <p>No listings match these filters.</p>}
            {filtered.slice(0,limit).map(card)}
            {filtered.length > limit && <button onClick={() => setLimit(limit+40)}>Load more places</button>}
          </aside>
          <div className="directory-map">
            <MapView rows={filtered} destination={dest} selected={selected} onSelect={selectBusiness} onArea={bounds => {setArea(bounds);setSelected(null);setLimit(40);}} />
            {selected && <aside className="detail" aria-label="Selected business">
              <button className="close" aria-label="Close details" onClick={() => setSelected(null)}>×</button>
              {selectedPhoto && <img className="detail-photo" src={selectedPhoto.url} alt="" />}
              <div>
                <h2>{selected.name}</h2>
                <p>{str(selected.address || selected.barangay || selected.category)}</p>
                <Link className="primary" href={'/business/'+encodeURIComponent(selected.business_id)}>View details →</Link>
              </div>
            </aside>}
          </div>
        </div>
      </section>
    </>}
  </main>;
}
