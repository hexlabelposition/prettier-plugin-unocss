import { defineConfig, presetMini } from 'unocss'

export default defineConfig({
  presets: [
    presetMini(),
  ],
  shortcuts: { btn: 'px-4 py-2 rounded' },
})
