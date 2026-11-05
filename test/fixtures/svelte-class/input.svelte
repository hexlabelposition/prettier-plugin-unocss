<script lang="ts">
  import { clsx } from 'clsx'

  let { active }: { active: boolean } = $props()
  const clsButton = 'shadow p-4 flex'
  const card = clsx('rounded-lg p-4 flex', active && 'm-2 block')
</script>

<div class="md:p-8 foo p-4 flex">
  <span class="hover:bg-blue-600 btn bg-blue-500">a</span>
  <i class="hover:(text-black bg-gray-100) m-1 flex"></i>
  <p class="md:p-8 p-4 {active ? 'underline text-red-500' : 'm-2 block'} shadow flex">b</p>
  <p title="p-4 flex">not a class attribute</p>
</div>
