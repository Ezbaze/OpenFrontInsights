import { error, type RequestHandler } from '@sveltejs/kit';
import { createGetHandler, parseOrThrow } from '$lib/server/api-response';
import { fetchPlayerProfile } from '$lib/server/openfront';
import { playerLookupSchema, playerRouteParamsSchema } from '$lib/server/schemas/player';

export const GET: RequestHandler = createGetHandler(
	'Failed to lookup player.',
	async ({ fetch, params }) => {
		const { playerId } = parseOrThrow(playerRouteParamsSchema, params);
		const payload = await fetchPlayerProfile(fetch, playerId);
		const parsed = playerLookupSchema.safeParse(payload);
		if (!parsed.success) {
			console.error('Invalid player lookup payload', parsed.error.flatten());
			throw error(502, 'Failed to lookup player.');
		}

		return {
			playerId,
			username: parsed.data.user?.username ?? null,
			globalName: parsed.data.user?.global_name ?? null
		};
	}
);
