import { error, type RequestHandler } from '@sveltejs/kit';
import { createGetHandler, parseOrThrow } from '$lib/server/api-response';
import { fetchPlayerProfile } from '$lib/server/openfront';
import { playerProfileSchema, playerRouteParamsSchema } from '$lib/server/schemas/player';

export const GET: RequestHandler = createGetHandler(
	'Failed to load player profile.',
	async ({ fetch, params }) => {
		const { playerId } = parseOrThrow(playerRouteParamsSchema, params);
		const payload = await fetchPlayerProfile(fetch, playerId);
		const parsed = playerProfileSchema.safeParse(payload);
		if (!parsed.success) {
			console.error('Invalid player profile payload', parsed.error.flatten());
			throw error(502, 'Failed to load player profile.');
		}
		return parsed.data;
	}
);
