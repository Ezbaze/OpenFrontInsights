<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Card from '$lib/components/ui/card';
	import InfoIcon from '@lucide/svelte/icons/info';
	import XIcon from '@lucide/svelte/icons/x';

	let {
		title,
		preview,
		children,
		class: className
	} = $props<{
		title: string;
		preview: Snippet<[]>;
		children?: Snippet<[]>;
		class?: string;
	}>();

	const headerCloseClass =
		'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';
</script>

<Sheet.Root>
	<Sheet.Trigger
		class={[
			'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
			className
		]
			.filter(Boolean)
			.join(' ')}
		aria-label={`Explain ${title}`}
	>
		<InfoIcon class="h-4 w-4" />
	</Sheet.Trigger>
	<Sheet.Content
		side="right"
		class="group flex w-[420px] max-w-none flex-col gap-0 sm:w-[640px] sm:max-w-none [&>button]:hidden"
	>
		<Sheet.Header
			class="flex flex-row items-center justify-between border-b border-border px-6 py-6"
		>
			<Sheet.Title>Details</Sheet.Title>
			<Sheet.Close class={headerCloseClass} aria-label="Close details">
				<XIcon class="h-4 w-4" />
			</Sheet.Close>
		</Sheet.Header>
		<Card.Root class="group rounded-none border-0 border-b border-border/50 shadow-none">
			{@render preview?.()}
		</Card.Root>
		<div class="grid gap-2 px-6 pt-4 pb-6 text-sm text-muted-foreground">
			{@render children?.()}
		</div>
	</Sheet.Content>
</Sheet.Root>
