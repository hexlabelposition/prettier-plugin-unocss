<template>
  <div p-4 md:p-8 foo flex>
    <span hover:bg-blue-600 btn bg-blue-500>a</span>
    <a mt-2 href="/" m-1 title="link" block>b</a>
    <button disabled p-2 flex type="button">c</button>
    <i text="sm red-500" p-2 flex />
    <p class="m-2 flex" style="color: red" p-4 block>class and style stay</p>
    <MyComponent v-if="on" :size="1" @click="go" p-4 flex />
    <MyComponent v-else #default p-4 flex />
    <em p-4 p-4 flex>duplicates</em>
  </div>
</template>

<script setup lang="ts">
const on = true
const go = () => {}
</script>

<style scoped>
.x { color: red }
</style>
