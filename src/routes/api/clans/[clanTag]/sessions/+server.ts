import { createGetHandler, parseOrThrow } from '$lib/server/api-response';
import { fetchClanSessions } from '$lib/server/openfront';
import {
	clanRouteParamsSchema,
	queryToObject,
	sessionsQuerySchema
} from '$lib/server/schemas/clan';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = createGetHandler(
	'Failed to load clan sessions.',
	async ({ fetch, params, url }) => {
		const { clanTag } = parseOrThrow(clanRouteParamsSchema, params);
		const range = parseOrThrow(sessionsQuerySchema, queryToObject(url.searchParams));
		const query = new URLSearchParams({
			start: range.start.toISOString(),
			end: range.end.toISOString()
		});
		return fetchClanSessions(fetch, clanTag, query);
	}
);
