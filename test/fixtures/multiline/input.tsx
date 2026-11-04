import clsx from "clsx";

// Class lists split over several lines are collapsed to one line, like the
// UnoCSS ESLint `order` rule does
export function Card({ on }: { on: boolean }) {
  return (
    <div
      className="
        p-4
        flex
        mt-2
      "
    >
      <p
        className={`
          text-lg
          font-bold ${on ? "underline" : ""}
          m-1
          block
        `}
      />
      <p className={clsx(`
        p-2
        flex
      `, on && "text-red-500 mt-1")} />
    </div>
  );
}

// Escaped line breaks are whitespace too
export const lines = clsx("p-4\nflex mt-1");
