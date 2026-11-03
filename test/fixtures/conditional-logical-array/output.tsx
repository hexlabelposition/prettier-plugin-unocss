import clsx from "clsx";

export function Item({
  on,
  size,
  extra,
}: {
  on: boolean;
  size: string;
  extra?: string;
}) {
  return (
    <div
      className={on ? "flex p-4" : size === "sm" ? "p-1 text-sm" : "m-1 mt-2"}
      title={on ? "p-4 flex" : ""}
    >
      <span className={on && "text-red-500 underline"} />
      <span className={extra ?? "flex p-4"} />
      <span className={"flex p-4" as string} />
      <span
        className={clsx(
          [
            on && "flex p-4",
            ["m-1 mt-2", size === "p-4 flex" && "p-1 text-sm"],
          ],
          on ? "text-red-500 underline" : undefined,
          extra!,
          "flex p-4" satisfies string,
          size.includes("p-4 flex") && "p-1 text-sm",
        )}
      />
    </div>
  );
}
