import { error, json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import type { ZodType } from 'zod';

const CACHE_CONTROL_HEADER = 's-maxage=60, stale-while-revalidate=300';

export const cachedJson = (payload: unknown) =>
	json(payload, {
		headers: {
			'cache-control': CACHE_CONTROL_HEADER
		}
	});

export const parseOrThrow = <T>(schema: ZodType<T>, input: unknown): T => {
	const parsed = schema.safeParse(input);
	if (parsed.success) {
		return parsed.data;
	}
	const message = parsed.error.issues[0]?.message ?? 'Invalid request.';
	throw error(400, message);
};

export const withApiError = async (label: string, handler: () => Promise<unknown>) => {
	try {
		const data = await handler();
		return cachedJson(data);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error(label, err);
		throw error(502, label);
	}
};

export const createGetHandler = <TEvent extends RequestEvent>(
	label: string,
	handler: (event: TEvent) => Promise<unknown>
) => (async (event: TEvent) => withApiError(label, () => handler(event))) as RequestHandler;
