<script lang="ts">
  import { clsx } from "clsx";

  let { active }: { active: boolean } = $props();
  const clsButton = "flex p-4 shadow";
  const card = clsx("flex rounded-lg p-4", active && "m-2 block");
</script>

<div class="foo flex p-4 md:p-8">
  <span class="btn bg-blue-500 hover:bg-blue-600">a</span>
  <i class="m-1 flex hover:(bg-gray-100 text-black)"></i>
  <p
    class="p-4 md:p-8 {active
      ? 'text-red-500 underline'
      : 'm-2 block'} flex shadow"
  >
    b
  </p>
  <p title="p-4 flex">not a class attribute</p>
</div>
