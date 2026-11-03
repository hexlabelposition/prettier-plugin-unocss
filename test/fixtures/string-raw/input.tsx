import clsx from "clsx";

export function Panel({ open }: { open: boolean }) {
  return (
    <div className={String.raw`shadow p-4 rounded-lg bg-white`}>
      <p className={clsx(String.raw`text-sm mt-2`, open && String.raw`underline font-bold`)} />
    </div>
  );
}

// Not a class position
export const pattern = String.raw`p-4 flex`;
