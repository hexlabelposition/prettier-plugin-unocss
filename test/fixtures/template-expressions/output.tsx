import clsx from "clsx";

export function Badge({
  on,
  tone,
  size,
}: {
  on: boolean;
  tone: string;
  size: "sm" | "lg";
}) {
  return (
    <span
      className={`rounded px-2 ${on ? "bg-blue-500 text-white font-bold" : "text-gray-500 opacity-50"} ${size === "sm" ? "p-1 text-sm" : "p-4 text-lg"}`}
    >
      {/* Glued to `bg-`: the strings are fragments of a class, left alone */}
      <i className={`p-1 bg-${on ? "red-500 hover:bg-red-600" : tone}`} />
      <i
        className={`p-1 ${clsx("m-1 mt-2", on && "text-red-500 underline")}`}
      />
    </span>
  );
}
