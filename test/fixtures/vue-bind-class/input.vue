<template>
  <div
    :class="['p-4 flex', active && 'underline text-red-500', { 'p-2 block': active, flex: on }]"
    v-bind:class="active ? 'p-4 flex' : 'm-2 block'"
    :title="'p-4 flex'"
  >
    <span :class="`p-4 flex ${active ? 'm-2 block' : ''} text-${color}-500 p-2 block`">a</span>
    <span :class="clsx('p-4 flex', other('m-2 block'))">b</span>
    <span :class="active === 'p-4 flex' ? 'm-2 block' : ''">c</span>
    <span :class="[&quot;p-4 flex&quot;]">d</span>
    <span :class="['p-4 flex [&amp;>svg]:size-4']">entities are left alone</span>
    <span class="content-[&quot;x&quot;] p-4 flex">e</span>
    <span class="p-4 &nbsp; flex">unknown entity, left alone</span>
    <span :class="{ 'p-4 flex': a, 'flex p-4': b }">keys that would become equal</span>
  </div>
</template>

<script>
export default {
  data: () => ({ cls: clsx('p-4 flex') }),
}
</script>
