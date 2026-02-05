import { createGetHandler } from '$lib/server/api-response';
import { fetchClanLeaderboard } from '$lib/server/openfront';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = createGetHandler(
	'Failed to load clan leaderboard.',
	async ({ fetch }) => fetchClanLeaderboard(fetch)
);
