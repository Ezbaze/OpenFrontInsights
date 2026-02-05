export const numberFormatter = new Intl.NumberFormat('en-US');
export const percentFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 1,
	minimumFractionDigits: 1
});

export const roundTo = (value: number, digits = 2) => Number(value.toFixed(digits));

export const formatNumber = (value: number | null | undefined) =>
	value === null || value === undefined || Number.isNaN(value) ? null : numberFormatter.format(value);

export const formatPercent = (value: number | null | undefined) =>
	value === null || value === undefined || Number.isNaN(value)
		? null
		: `${percentFormatter.format(value)}%`;

export const formatRatio = (value: number | null | undefined) =>
	value === null || value === undefined || Number.isNaN(value) ? null : value.toFixed(2);

export const safeDivide = (numerator: number, denominator: number) =>
	denominator > 0 ? numerator / denominator : null;

export const getDomain = (
	values: number[],
	padRatio = 0.08,
	clamp?: { min?: number; max?: number }
) => {
	const clean = values.filter((value) => Number.isFinite(value));
	if (clean.length === 0) return undefined;
	const min = Math.min(...clean);
	const max = Math.max(...clean);
	const range = max - min || Math.abs(min || 1);
	let low = min - range * padRatio;
	let high = max + range * padRatio;

	if (min >= 0) low = Math.max(0, low);
	if (clamp?.min !== undefined) low = Math.max(clamp.min, low);
	if (clamp?.max !== undefined) high = Math.min(clamp.max, high);

	return [low, high];
};

export const formatDateLabel = (value: Date) =>
	value.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });

export const createLineBrush = (setDomain: (value: unknown) => void) => ({
	axis: 'x',
	resetOnEnd: true,
	onBrushEnd: (event: { xDomain?: unknown }) => {
		setDomain(event?.xDomain ?? null);
	}
});

export const createScatterBrush = (
	setDomains: (value: { xDomain: unknown | null; yDomain: unknown | null }) => void
) => ({
	axis: 'both',
	resetOnEnd: true,
	onBrushEnd: (event: { xDomain?: unknown; yDomain?: unknown }) => {
		setDomains({
			xDomain: event?.xDomain ?? null,
			yDomain: event?.yDomain ?? null
		});
	}
});

export const yAxisNoNumbers = { tickLabelProps: { class: 'hidden' } } as const;
export const chartPadding = { left: 12, right: 12, top: 4, bottom: 24 };
export const iconButtonClass =
	'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';
export const helpHeadingClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground/70';
