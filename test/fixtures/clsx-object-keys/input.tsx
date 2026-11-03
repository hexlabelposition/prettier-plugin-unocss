import clsx from "clsx";
import { tv } from "tailwind-variants";

export const card = tv({
  base: "p-4 flex",
  variants: { "size md": { "sm lg": "text-sm p-1" } },
});

export function Tab({ active, disabled }: { active: boolean; disabled: boolean }) {
  return (
    <button
      className={clsx("px-4 py-2", {
        "text-blue-600 font-bold border-b-2": active,
        "opacity-50 cursor-not-allowed": disabled,
        [`hover:(text-black bg-gray-100) mt-1`]: !disabled,
        underline: active,
      })}
    />
  );
}

// Sorting would make both keys "flex p-4": the second would override the first
export const unsafe = clsx({ "p-4 flex": true, "flex p-4": false });
