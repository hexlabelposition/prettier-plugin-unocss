export const clsCard = "rounded-lg bg-white p-4 shadow";

export const buttonClassNames = {
  base: "btn px-4 py-2",
  primary: (active: boolean) =>
    active ? "bg-blue-600 text-white" : "bg-blue-500 text-white",
  ghost: "bg-transparent hover:bg-gray-100" as const,
};

export function getClassName(size: "sm" | "lg") {
  const inputClassName = size === "sm" ? "p-1 text-sm" : "p-4 text-lg";
  return inputClassName;
}

// Not matching `^cls` / `classNames?$`
export const label = "mt-2 m-1";
