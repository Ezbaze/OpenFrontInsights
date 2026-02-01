import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	try {
		const response = await fetch("/api/clans/leaderboard");
		if (!response.ok) {
			return { leaderboard: null };
		}
		const leaderboard = (await response.json()) as unknown;
		return { leaderboard };
	} catch {
		return { leaderboard: null };
	}
};
