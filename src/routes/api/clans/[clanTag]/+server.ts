import { createGetHandler, parseOrThrow } from '$lib/server/api-response';
import { fetchClanStats } from '$lib/server/openfront';
import { clanRouteParamsSchema } from '$lib/server/schemas/clan';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = createGetHandler(
	'Failed to load clan stats.',
	async ({ fetch, params, url }) => {
		const { clanTag } = parseOrThrow(clanRouteParamsSchema, params);
		return fetchClanStats(fetch, clanTag, url.searchParams);
	}
);
