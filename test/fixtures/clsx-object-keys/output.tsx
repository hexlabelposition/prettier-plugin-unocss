import clsx from "clsx";
import { tv } from "tailwind-variants";

export const card = tv({
  base: "flex p-4",
  variants: { "size md": { "sm lg": "p-1 text-sm" } },
});

export function Tab({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) {
  return (
    <button
      className={clsx("px-4 py-2", {
        "border-b-2 text-blue-600 font-bold": active,
        "cursor-not-allowed opacity-50": disabled,
        [`mt-1 hover:(bg-gray-100 text-black)`]: !disabled,
        underline: active,
      })}
    />
  );
}

// Sorting would make both keys "flex p-4": the second would override the first
export const unsafe = clsx({ "p-4 flex": true, "flex p-4": false });
