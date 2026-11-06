<template>
  <div foo flex p-4 md:p-8>
    <span btn bg-blue-500 hover:bg-blue-600>a</span>
    <a href="/" title="link" m-1 mt-2 block>b</a>
    <button disabled flex p-2 type="button">c</button>
    <i text="sm red-500" flex p-2 />
    <p class="m-2 flex" style="color: red" block p-4>class and style stay</p>
    <MyComponent v-if="on" :size="1" @click="go" flex p-4 />
    <MyComponent v-else #default flex p-4 />
    <em flex p-4 p-4>duplicates</em>
  </div>
</template>

<script setup lang="ts">
const on = true;
const go = () => {};
</script>

<style scoped>
.x {
  color: red;
}
</style>
