<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTdAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTdAttributes> = $props();

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

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn(
		'overflow-hidden text-ellipsis bg-clip-padding p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0',
		className
	)}
	onmouseenter={setOverflowTitle}
	onfocusin={setOverflowTitle}
	{...restProps}
>
	{@render children?.()}
</td>
