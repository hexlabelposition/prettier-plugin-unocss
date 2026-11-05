<template>
  <div
    :class="[
      'flex p-4',
      active && 'text-red-500 underline',
      { 'block p-2': active, flex: on },
    ]"
    v-bind:class="active ? 'flex p-4' : 'm-2 block'"
    :title="'p-4 flex'"
  >
    <span
      :class="`flex p-4 ${active ? 'm-2 block' : ''} text-${color}-500 block p-2`"
      >a</span
    >
    <span :class="clsx('flex p-4', other('m-2 block'))">b</span>
    <span :class="active === 'p-4 flex' ? 'm-2 block' : ''">c</span>
    <span :class="['flex p-4']">d</span>
    <span :class="['p-4 flex [&amp;>svg]:size-4']"
      >entities are left alone</span
    >
    <span class="flex p-4 content-[&quot;x&quot;]">e</span>
    <span class="p-4 &nbsp; flex">unknown entity, left alone</span>
    <span :class="{ 'p-4 flex': a, 'flex p-4': b }"
      >keys that would become equal</span
    >
  </div>
</template>

<script>
export default {
  data: () => ({ cls: clsx("flex p-4") }),
};
</script>
