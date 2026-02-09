import { error } from '@sveltejs/kit';

const API_BASE = 'https://api.openfront.io/public';

type Fetch = typeof fetch;

const withQuery = (url: string, query: URLSearchParams | undefined) => {
	const queryString = query?.toString();
	return queryString ? `${url}?${queryString}` : url;
};

async function fetchJson<T>(fetcher: Fetch, url: string): Promise<T> {
	const response = await fetcher(url, {
		headers: {
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw error(response.status, response.statusText || 'OpenFront API request failed.');
	}

	return (await response.json()) as T;
}

export function fetchClanLeaderboard(fetcher: Fetch) {
	return fetchJson(fetcher, `${API_BASE}/clans/leaderboard`);
}

export function fetchClanStats(
	fetcher: Fetch,
	clanTag: string,
	query: URLSearchParams | undefined
) {
	return fetchJson(fetcher, withQuery(`${API_BASE}/clan/${encodeURIComponent(clanTag)}`, query));
}

export function fetchClanSessions(
	fetcher: Fetch,
	clanTag: string,
	query: URLSearchParams | undefined
) {
	return fetchJson(
		fetcher,
		withQuery(`${API_BASE}/clan/${encodeURIComponent(clanTag)}/sessions`, query)
	);
}

export function fetchPlayerProfile(fetcher: Fetch, playerId: string) {
	return fetchJson(fetcher, `${API_BASE}/player/${encodeURIComponent(playerId)}`);
}

export function fetchPlayerSessions(fetcher: Fetch, playerId: string) {
	return fetchJson(fetcher, `${API_BASE}/player/${encodeURIComponent(playerId)}/sessions`);
}
