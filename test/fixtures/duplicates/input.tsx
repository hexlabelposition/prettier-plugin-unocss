import clsx from "clsx";

// Duplicate classes are kept, like the UnoCSS ESLint `order` rule does
export function Button({ on }: { on: boolean }) {
  return (
    <button className="p-4 flex p-4 foo btn foo">
      <span className={clsx("mt-1 hover:(p-2 flex p-2) mt-1", { "text-sm m-1 text-sm": on })} />
      <span className={`p-2 flex ${on ? "underline" : ""} p-2 flex`} />
    </button>
  );
}
