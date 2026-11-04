import clsx from "clsx";

// Class lists split over several lines are collapsed to one line, like the
// UnoCSS ESLint `order` rule does
export function Card({ on }: { on: boolean }) {
  return (
    <div className="mt-2 flex p-4">
      <p className={` text-lg font-bold ${on ? "underline" : ""} m-1 block `} />
      <p className={clsx(` flex p-2 `, on && "mt-1 text-red-500")} />
    </div>
  );
}

// Escaped line breaks are whitespace too
export const lines = clsx("mt-1 flex p-4");
