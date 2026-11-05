<template>
  <div class="foo flex p-4 md:p-8">
    <span class="btn bg-blue-500 hover:bg-blue-600">a</span>
    <a class="flex p-4">b</a>
    <i class="m-1 flex hover:(bg-gray-100 text-black)" />
    <svg class="flex p-2 [&>svg]:size-4" />
    <p title="p-4 flex">not a class attribute</p>
    <p class="">empty</p>
  </div>
</template>

<script setup lang="ts">
import { clsx } from "clsx";

const clsButton = "flex p-4 shadow";
const card = clsx("flex rounded-lg p-4", "m-2 block");
</script>
