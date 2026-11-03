export const clsCard = "shadow p-4 rounded-lg bg-white";

export const buttonClassNames = {
  base: "px-4 py-2 btn",
  primary: (active: boolean) => (active ? "text-white bg-blue-600" : "text-white bg-blue-500"),
  ghost: "hover:bg-gray-100 bg-transparent" as const,
};

export function getClassName(size: "sm" | "lg") {
  const inputClassName = size === "sm" ? "text-sm p-1" : "text-lg p-4";
  return inputClassName;
}

// Not matching `^cls` / `classNames?$`
export const label = "mt-2 m-1";
