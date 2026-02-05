<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { getTooltipContext, Tooltip as TooltipPrimitive } from 'layerchart';

	type RowDef = {
		label: string;
		value: (data: unknown) => string | number | null | undefined;
	};

	let {
		title,
		rows,
		class: className,
		meta,
		metaLabelText = 'Game',
		actionLabel,
		actionLabelText = 'Game',
		onAction
	} = $props<{
		title?: (data: unknown) => string | number | null | undefined;
		rows: RowDef[];
		class?: string;
		meta?: (data: unknown) => string | number | null | undefined;
		metaLabelText?: string;
		actionLabel?: (data: unknown) => string | number | null | undefined;
		actionLabelText?: string;
		onAction?: (data: unknown) => void;
	}>();

	const tooltipCtx = getTooltipContext();
	const data = $derived.by(() => tooltipCtx.data);

	const titleValue = $derived.by(() => {
		if (!data || !title) return null;
		const next = title(data);
		return next === null || next === undefined ? null : next;
	});

	const metaValue = $derived.by(() => {
		if (!data || !meta) return null;
		const next = meta(data);
		return next === null || next === undefined ? null : next;
	});

	const rowValues = $derived.by(() => {
		if (!data) return [];
		return rows
			.map((row) => ({
				label: row.label,
				value: row.value(data)
			}))
			.filter((row) => row.value !== null && row.value !== undefined);
	});

	const actionValue = $derived.by(() => {
		if (!data || !actionLabel) return null;
		const next = actionLabel(data);
		return next === null || next === undefined ? null : next;
	});
</script>

{#if data && (rowValues.length > 0 || titleValue !== null || metaValue !== null)}
	<TooltipPrimitive.Root variant="none">
		<div
			class={cn(
				'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
				className
			)}
		>
			{#if titleValue !== null || metaValue !== null}
				<div class="flex items-center justify-between gap-3 font-medium">
					{#if titleValue !== null}
						<div>{titleValue}</div>
					{/if}
					{#if metaValue !== null}
						<div class="font-mono text-foreground/90">
							{#if metaLabelText}
								<span class="text-muted-foreground">{metaLabelText}</span>
								<span class="ml-2">{metaValue}</span>
							{:else}
								<span>{metaValue}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			{#if rowValues.length > 0 || actionValue !== null}
				<div class="grid gap-1.5">
					{#each rowValues as row (row.label)}
						<div class="flex items-center justify-between gap-2">
							<span class="text-muted-foreground">{row.label}</span>
							<span class="font-mono font-medium text-foreground tabular-nums">
								{row.value}
							</span>
						</div>
					{/each}
					{#if actionValue !== null}
						{#if onAction}
							<button
								type="button"
								class="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
								onclick={() => onAction?.(data)}
							>
								<span class="text-muted-foreground">{actionLabelText}</span>
								<span
									class="font-mono font-medium text-foreground tabular-nums underline decoration-dotted underline-offset-4"
								>
									{actionValue}
								</span>
							</button>
						{:else}
							<div class="flex items-center justify-between gap-2">
								<span class="text-muted-foreground">{actionLabelText}</span>
								<span class="font-mono font-medium text-foreground tabular-nums">
									{actionValue}
								</span>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</TooltipPrimitive.Root>
{/if}
