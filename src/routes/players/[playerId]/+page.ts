import type { PageLoad } from './$types';
import type { ClanLeaderboardResponse, PlayerProfile } from '$lib/types/openfront';

export const load: PageLoad = async ({ fetch, params }) => {
	const playerId = String(params.playerId ?? '').trim();
	const errors: {
		profile?: string;
	} = {};

	let playerProfile: PlayerProfile | null = null;
	let clanLeaderboard: ClanLeaderboardResponse | null = null;

	try {
		const response = await fetch(`/api/players/${encodeURIComponent(playerId)}`);
		if (!response.ok) {
			throw new Error(`Player profile request failed ${response.status}`);
		}
		playerProfile = (await response.json()) as PlayerProfile;
	} catch (err) {
		console.error(`Failed to load player profile for ${playerId}`, err);
		errors.profile = 'Unable to load player profile.';
	}

	try {
		const response = await fetch('/api/clans/leaderboard');
		if (response.ok) {
			clanLeaderboard = (await response.json()) as ClanLeaderboardResponse;
		}
	} catch (err) {
		console.error('Failed to load clan leaderboard for player accents', err);
	}

	return {
		playerId,
		playerProfile,
		clanLeaderboard,
		errors,
		loadedAt: new Date().toISOString()
	};
};
