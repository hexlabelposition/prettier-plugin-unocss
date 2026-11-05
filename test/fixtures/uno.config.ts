import { defineConfig, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      collections: {
        custom: {
          dot: '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>',
        },
      },
    }),
  ],
  shortcuts: { btn: 'px-4 py-2 rounded' },
})
