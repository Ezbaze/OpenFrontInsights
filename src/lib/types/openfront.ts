export type ClanLeaderboardEntry = {
	clanTag: string;
	games: number;
	wins: number;
	losses: number;
	playerSessions: number;
	weightedWins: number;
	weightedLosses: number;
	weightedWLRatio: number;
};

export type ClanLeaderboardResponse = {
	start: string;
	end: string;
	clans: ClanLeaderboardEntry[];
};
