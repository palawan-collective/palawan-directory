import {str} from './model';

/** Explicit IDs always take precedence. An inferred match must be unique. */
export function matchBusinessId(ids: Set<string>, explicit: unknown, ...hints: unknown[]) {
  const supplied = str(explicit);
  if (supplied) return ids.has(supplied) ? supplied : '';
  const text = hints.map(str).join(' ').toLowerCase();
  const found = [...ids].filter(id => {
    const escaped = id.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])').test(text);
  });
  return found.length === 1 ? found[0] : '';
}
