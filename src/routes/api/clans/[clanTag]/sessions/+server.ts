import { error, json } from '@sveltejs/kit';
import { fetchClanSessions } from '$lib/server/openfront';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, params, url }) => {
	const clanTag = params.clanTag?.trim();
	if (!clanTag) {
		throw error(400, 'Missing clan tag.');
	}

	try {
		const data = await fetchClanSessions(fetch, clanTag, url.searchParams);
		return json(data, {
			headers: {
				'cache-control': 's-maxage=60, stale-while-revalidate=300'
			}
		});
	} catch (err) {
		console.error(`Failed to load clan sessions for ${clanTag}`, err);
		throw error(502, 'Failed to load clan sessions.');
	}
};
