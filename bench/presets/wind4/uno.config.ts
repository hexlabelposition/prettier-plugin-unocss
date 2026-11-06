import { defineConfig, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  shortcuts: { btn: 'px-4 py-2 rounded' },
})
