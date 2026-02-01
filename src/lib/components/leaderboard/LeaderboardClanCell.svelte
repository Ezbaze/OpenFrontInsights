<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	let {
		tag,
		isTop = false,
		rankAccent = null
	} = $props<{
		tag: string;
		isTop?: boolean;
		rankAccent?: string | null;
	}>();
</script>

<Badge
	variant="outline"
	class={isTop ? 'rank-tag' : ''}
	style={isTop && rankAccent ? `--rank-accent: ${rankAccent}` : ''}
>
	{tag}
</Badge>
