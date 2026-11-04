import clsx from "clsx";

// Duplicate classes are kept, like the UnoCSS ESLint `order` rule does
export function Button({ on }: { on: boolean }) {
  return (
    <button className="foo foo flex btn p-4 p-4">
      <span
        className={clsx("mt-1 mt-1 hover:(flex p-2 p-2)", {
          "m-1 text-sm text-sm": on,
        })}
      />
      <span className={`flex p-2 ${on ? "underline" : ""} flex p-2`} />
    </button>
  );
}
