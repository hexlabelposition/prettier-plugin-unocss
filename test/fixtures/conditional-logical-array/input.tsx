import clsx from "clsx";

export function Item({ on, size, extra }: { on: boolean; size: string; extra?: string }) {
  return (
    <div
      className={on ? "p-4 flex" : size === "sm" ? "text-sm p-1" : "mt-2 m-1"}
      title={on ? "p-4 flex" : ""}
    >
      <span className={on && "underline text-red-500"} />
      <span className={extra ?? "p-4 flex"} />
      <span className={("p-4 flex" as string)} />
      <span
        className={clsx(
          [on && "p-4 flex", ["mt-2 m-1", size === "p-4 flex" && "text-sm p-1"]],
          on ? "underline text-red-500" : undefined,
          extra!,
          "p-4 flex" satisfies string,
          size.includes("p-4 flex") && "text-sm p-1",
        )}
      />
    </div>
  );
}
