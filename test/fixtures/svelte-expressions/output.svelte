<script>
  let { active, color, on } = $props();
</script>

<div
  class={[
    "flex p-4",
    active && "text-red-500 underline",
    { "m-2 block": active, flex: on },
  ]}
>
  <span class="p-4 {active ? 'm-2 block' : ''} bg-{color}-500 flex p-2"
    >glued fragments stay</span
  >
  <span class="p-4 {{ 'm-2 block': active }} flex"
    >object in a string: keys left alone</span
  >
  <span class={clsx("flex p-4", other("m-2 block"))}>{clsx("flex p-4")}</span>
  <span class="flex p-4">multiline</span>
  <span class="flex p-4 content-[&quot;x&quot;]">entity</span>
  <span class="p-4 &nbsp; flex">unknown entity, left alone</span>
  <span class:p-4={active} class:flex={active}>directives</span>
  {#if active}
    {@const cls = clsx("flex p-4")}
    <i class={cls}></i>
  {/if}
  <Button class="flex p-4" />
</div>
