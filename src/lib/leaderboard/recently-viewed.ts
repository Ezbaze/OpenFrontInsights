export type RecentlyViewedKind = 'clan' | 'player';

export type RecentlyViewedItem = {
	kind: RecentlyViewedKind;
	id: string;
	label: string;
	viewedAt: number;
};

const RECENTLY_VIEWED_STORAGE_KEY = 'ofi:recently-viewed:v1';
const DEFAULT_RECENTLY_VIEWED_LIMIT = 12;

const normalizeId = (kind: RecentlyViewedKind, rawId: string) => {
	const trimmed = String(rawId ?? '').trim();
	if (!trimmed) return '';
	return kind === 'clan' ? trimmed.toUpperCase() : trimmed;
};

const sanitizeList = (value: unknown): RecentlyViewedItem[] => {
	if (!Array.isArray(value)) return [];
	const rows: RecentlyViewedItem[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;
		const candidate = entry as Partial<RecentlyViewedItem>;
		if (candidate.kind !== 'clan' && candidate.kind !== 'player') continue;
		const id = normalizeId(candidate.kind, String(candidate.id ?? ''));
		if (!id) continue;
		const label = String(candidate.label ?? '').trim() || id;
		const viewedAt =
			typeof candidate.viewedAt === 'number' && Number.isFinite(candidate.viewedAt)
				? candidate.viewedAt
				: Date.now();
		rows.push({ kind: candidate.kind, id, label, viewedAt });
	}
	return rows.sort((left, right) => right.viewedAt - left.viewedAt);
};

const readStorage = (): RecentlyViewedItem[] => {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
		if (!raw) return [];
		return sanitizeList(JSON.parse(raw));
	} catch {
		return [];
	}
};

const writeStorage = (items: RecentlyViewedItem[]) => {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(items));
	} catch {
		// Ignore storage write failures (privacy mode, quota, etc.)
	}
};

export const getRecentlyViewed = (limit = DEFAULT_RECENTLY_VIEWED_LIMIT): RecentlyViewedItem[] =>
	readStorage().slice(0, Math.max(1, limit));

export const addRecentlyViewed = (
	input: { kind: RecentlyViewedKind; id: string; label?: string | null },
	limit = DEFAULT_RECENTLY_VIEWED_LIMIT
): RecentlyViewedItem[] => {
	const id = normalizeId(input.kind, input.id);
	if (!id) return getRecentlyViewed(limit);

	const label = String(input.label ?? '').trim() || id;
	const now = Date.now();
	const key = `${input.kind}:${id}`;
	const deduped = readStorage().filter((item) => `${item.kind}:${item.id}` !== key);
	const next = [{ kind: input.kind, id, label, viewedAt: now }, ...deduped].slice(
		0,
		Math.max(1, limit)
	);
	writeStorage(next);
	return next;
};

export const setRecentlyViewedLabel = (
	input: { kind: RecentlyViewedKind; id: string; label: string | null | undefined },
	limit = DEFAULT_RECENTLY_VIEWED_LIMIT
): { items: RecentlyViewedItem[]; changed: boolean } => {
	const id = normalizeId(input.kind, input.id);
	const label = String(input.label ?? '').trim();
	if (!id || !label) return { items: getRecentlyViewed(limit), changed: false };

	const items = readStorage();
	let changed = false;
	const next = items.map((item) => {
		if (item.kind !== input.kind || item.id !== id) return item;
		if (item.label === label) return item;
		changed = true;
		return { ...item, label };
	});

	if (changed) {
		writeStorage(next);
	}
	return { items: next.slice(0, Math.max(1, limit)), changed };
};
