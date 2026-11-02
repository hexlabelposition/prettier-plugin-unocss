import { tv } from "tailwind-variants";
import clsx from "clsx";

export const button = tv({
  base: "flex items-center btn text-white font-medium",
  variants: {
    size: { sm: "p-2 text-sm", lg: "p-4 text-lg" },
    tone: { primary: "bg-blue-500 hover:bg-blue-600" },
  },
});

export function Card({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="my-custom flex rounded-lg bg-white p-4 shadow md:p-8">
      <h1
        className={clsx(
          "mt-2 text-xl font-bold",
          active && "text-red-500 underline opacity-50",
        )}
      >
        Hi
      </h1>
      <p
        className={`mt-1 text-${color}-500 flex p-2 ${active ? "block" : ""} m-1 hover:(bg-gray-100 text-black)`}
      >
        x
      </p>
      <span title="mt-2 p-1 flex">not a class attr, untouched</span>
    </div>
  );
}
