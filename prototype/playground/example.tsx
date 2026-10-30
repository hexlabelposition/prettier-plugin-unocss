import { tv } from 'tailwind-variants'
import clsx from 'clsx'

const button = tv({
  base: 'text-white font-medium btn flex items-center',
  variants: {
    size: { sm: 'text-sm p-2', lg: 'p-4 text-lg' },
    tone: { primary: 'hover:bg-blue-600 bg-blue-500' },
  },
})

export function Card({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="shadow md:p-8 p-4 my-custom rounded-lg bg-white flex">
      <h1 className={clsx('text-xl font-bold mt-2', active && 'underline text-red-500 opacity-50')}>Hi</h1>
      <p className={`mt-1 text-${color}-500 p-2 flex ${active ? 'block' : ''} hover:(text-black bg-gray-100) m-1`}>x</p>
      <span title="mt-2 p-1 flex">not a class attr, untouched</span>
    </div>
  )
}
