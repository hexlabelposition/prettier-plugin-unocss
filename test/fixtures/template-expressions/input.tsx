import clsx from "clsx";

export function Badge({ on, tone, size }: { on: boolean; tone: string; size: "sm" | "lg" }) {
  return (
    <span
      className={`rounded px-2 ${on ? "text-white font-bold bg-blue-500" : "text-gray-500 opacity-50"} ${size === "sm" ? "text-sm p-1" : "text-lg p-4"}`}
    >
      {/* Glued to `bg-`: the strings are fragments of a class, left alone */}
      <i className={`p-1 bg-${on ? "red-500 hover:bg-red-600" : tone}`} />
      <i className={`p-1 ${clsx("mt-2 m-1", on && "underline text-red-500")}`} />
    </span>
  );
}
