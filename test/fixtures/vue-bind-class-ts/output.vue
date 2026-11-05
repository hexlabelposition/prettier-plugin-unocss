<template>
  <div :class="['flex p-4' as const, (active as boolean) && 'm-2 block']" />
</template>

<script setup lang="ts">
defineProps<{ active: boolean }>();
</script>
