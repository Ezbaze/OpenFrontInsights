const API_BASE = "https://api.openfront.io/public";

type Fetch = typeof fetch;

async function fetchJson<T>(fetcher: Fetch, url: string): Promise<T> {
	const response = await fetcher(url, {
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`OpenFront API error: ${response.status}`);
	}

	return (await response.json()) as T;
}

export function fetchClanLeaderboard(fetcher: Fetch) {
	return fetchJson(fetcher, `${API_BASE}/clans/leaderboard`);
}

export function fetchClanStats(
	fetcher: Fetch,
	clanTag: string,
	query: URLSearchParams | undefined,
) {
	const queryString = query?.toString();
	const suffix = queryString ? `?${queryString}` : "";
	return fetchJson(fetcher, `${API_BASE}/clan/${encodeURIComponent(clanTag)}${suffix}`);
}

export function fetchClanSessions(
	fetcher: Fetch,
	clanTag: string,
	query: URLSearchParams | undefined,
) {
	const queryString = query?.toString();
	const suffix = queryString ? `?${queryString}` : "";
	return fetchJson(
		fetcher,
		`${API_BASE}/clan/${encodeURIComponent(clanTag)}/sessions${suffix}`,
	);
}
