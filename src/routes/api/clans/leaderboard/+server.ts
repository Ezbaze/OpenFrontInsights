import { error, json } from "@sveltejs/kit";
import { fetchClanLeaderboard } from "$lib/server/openfront";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const data = await fetchClanLeaderboard(fetch);
		return json(data, {
			headers: {
				"cache-control": "s-maxage=60, stale-while-revalidate=300",
			},
		});
	} catch (err) {
		console.error("Failed to load clan leaderboard", err);
		throw error(502, "Failed to load clan leaderboard.");
	}
};
