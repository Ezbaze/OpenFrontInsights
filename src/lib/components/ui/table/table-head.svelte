<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLThAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLThAttributes> = $props();

	const setOverflowTitle = () => {
		if (restProps.title) return;
		const element = ref;
		if (!element) return;

		const fullText = element.textContent?.trim() ?? '';
		if (!fullText) {
			element.removeAttribute('title');
			return;
		}

		const isOverflowing =
			element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
		if (isOverflowing) {
			element.setAttribute('title', fullText);
		} else {
			element.removeAttribute('title');
		}
	};
</script>

<th
	bind:this={ref}
	data-slot="table-head"
	class={cn(
		'h-10 overflow-hidden text-ellipsis bg-clip-padding px-2 text-start align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pe-0',
		className
	)}
	onmouseenter={setOverflowTitle}
	onfocusin={setOverflowTitle}
	{...restProps}
>
	{@render children?.()}
</th>
