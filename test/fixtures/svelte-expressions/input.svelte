<script>
  let { active, color, on } = $props()
</script>

<div class={['p-4 flex', active && 'underline text-red-500', { 'm-2 block': active, flex: on }]}>
  <span class="p-4 {active ? 'm-2 block' : ''} bg-{color}-500 p-2 flex">glued fragments stay</span>
  <span class="p-4 {{ 'm-2 block': active }} flex">object in a string: keys left alone</span>
  <span class={clsx('p-4 flex', other('m-2 block'))}>{clsx('p-4 flex')}</span>
  <span class="
    p-4
    flex
  ">multiline</span>
  <span class="content-[&quot;x&quot;] p-4 flex">entity</span>
  <span class="p-4 &nbsp; flex">unknown entity, left alone</span>
  <span class:p-4={active} class:flex={active}>directives</span>
  {#if active}
    {@const cls = clsx('p-4 flex')}
    <i class={cls}></i>
  {/if}
  <Button class="p-4 flex" />
</div>
