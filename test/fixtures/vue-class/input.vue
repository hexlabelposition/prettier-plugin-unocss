<template>
  <div class="md:p-8 foo p-4 flex">
    <span class="hover:bg-blue-600 btn bg-blue-500">a</span>
    <a class="
      p-4
      flex
    ">b</a>
    <i class="hover:(text-black bg-gray-100) m-1 flex" />
    <svg class="p-2 [&>svg]:size-4 flex" />
    <p title="p-4 flex">not a class attribute</p>
    <p class="">empty</p>
  </div>
</template>

<script setup lang="ts">
import { clsx } from 'clsx'

const clsButton = 'shadow p-4 flex'
const card = clsx('rounded-lg p-4 flex', 'm-2 block')
</script>
