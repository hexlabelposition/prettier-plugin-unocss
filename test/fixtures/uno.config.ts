import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
  ],
  shortcuts: { btn: 'px-4 py-2 rounded' },
})
