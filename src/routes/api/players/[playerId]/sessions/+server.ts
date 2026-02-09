import { error, type RequestHandler } from '@sveltejs/kit';
import { createGetHandler, parseOrThrow } from '$lib/server/api-response';
import { fetchPlayerSessions } from '$lib/server/openfront';
import { playerRouteParamsSchema, playerSessionsSchema } from '$lib/server/schemas/player';

export const GET: RequestHandler = createGetHandler(
	'Failed to load player sessions.',
	async ({ fetch, params }) => {
		const { playerId } = parseOrThrow(playerRouteParamsSchema, params);
		const payload = await fetchPlayerSessions(fetch, playerId);
		const parsed = playerSessionsSchema.safeParse(payload);
		if (!parsed.success) {
			console.error('Invalid player sessions payload', parsed.error.flatten());
			throw error(502, 'Failed to load player sessions.');
		}
		return parsed.data;
	}
);
