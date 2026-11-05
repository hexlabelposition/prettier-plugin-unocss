<template>
  <div :class="['p-4 flex' as const, (active as boolean) && 'm-2 block']" />
</template>

<script setup lang="ts">
defineProps<{ active: boolean }>()
</script>
