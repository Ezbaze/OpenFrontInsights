import { z } from 'zod';

export const clanTagSchema = z
	.string()
	.trim()
	.min(1, 'Missing clan tag.')
	.transform((value) => value.toUpperCase());

export const clanRouteParamsSchema = z.object({
	clanTag: clanTagSchema
});

const isoDateSchema = z
	.string()
	.datetime({ offset: true })
	.or(z.string().datetime({ local: true }));

export const sessionsQuerySchema = z
	.object({
		start: isoDateSchema.optional(),
		end: isoDateSchema.optional()
	})
	.transform((value) => {
		const now = new Date();
		const endDate = value.end ? new Date(value.end) : now;
		const startDate = value.start ? new Date(value.start) : new Date(endDate);
		if (!value.start) {
			startDate.setUTCDate(endDate.getUTCDate() - 30);
		}
		return {
			start: startDate,
			end: endDate
		};
	})
	.refine((value) => Number.isFinite(value.start.getTime()), {
		message: 'Invalid start date.',
		path: ['start']
	})
	.refine((value) => Number.isFinite(value.end.getTime()), {
		message: 'Invalid end date.',
		path: ['end']
	})
	.refine((value) => value.start <= value.end, {
		message: 'Query start must be before end.',
		path: ['start']
	});

export const queryToObject = (query: URLSearchParams) => Object.fromEntries(query.entries());
