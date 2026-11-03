import clsx from "clsx";

export function Panel({ open }: { open: boolean }) {
  return (
    <div className={String.raw`rounded-lg bg-white p-4 shadow`}>
      <p
        className={clsx(
          String.raw`mt-2 text-sm`,
          open && String.raw`font-bold underline`,
        )}
      />
    </div>
  );
}

// Not a class position
export const pattern = String.raw`p-4 flex`;
