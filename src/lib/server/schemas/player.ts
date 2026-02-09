import { z } from 'zod';

export const playerIdSchema = z.string().trim().min(1, 'Missing player id.');

export const playerRouteParamsSchema = z.object({
	playerId: playerIdSchema
});

const playerStatsLeafSchema = z.object({
	wins: z.string(),
	losses: z.string(),
	total: z.string(),
	stats: z.unknown().optional()
});

const playerStatsTreeSchema = z.record(
	z.string(),
	z.record(z.string(), z.record(z.string(), playerStatsLeafSchema))
);

const playerGameSchema = z
	.object({
		gameId: z.string(),
		start: z.string(),
		mode: z.string(),
		type: z.string(),
		map: z.string(),
		difficulty: z.string(),
		clientId: z.string().optional()
	})
	.passthrough();

const playerDiscordSchema = z
	.object({
		id: z.string(),
		avatar: z.string().nullable().optional(),
		username: z.string(),
		global_name: z.string().nullable().optional(),
		discriminator: z.string().optional()
	})
	.passthrough();

export const playerProfileSchema = z
	.object({
		createdAt: z.string(),
		user: playerDiscordSchema.optional(),
		games: z.array(playerGameSchema).default([]),
		stats: playerStatsTreeSchema.default({})
	})
	.passthrough();

export const playerLookupSchema = z
	.object({
		user: playerDiscordSchema.optional()
	})
	.passthrough();

export const playerSessionSchema = z
	.object({
		gameId: z.string().optional(),
		gameStart: z.string().optional(),
		gameEnd: z.string().optional(),
		gameType: z.string().optional(),
		gameMode: z.string().optional(),
		clientId: z.string().optional(),
		username: z.string().optional(),
		clanTag: z.string().nullable().optional(),
		hasWon: z.boolean().optional()
	})
	.passthrough();

export const playerSessionsSchema = z.array(playerSessionSchema);
