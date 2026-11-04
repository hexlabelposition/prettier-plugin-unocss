import clsx from "clsx";

// `w-(--x)` looks like a variant group to UnoCSS and would come back expanded
// as `w---x`, a different class: these strings are left alone
export function Sidebar({ on }: { on: boolean }) {
  return (
    <aside className="w-(--sidebar-width) p-0 flex">
      <div className={clsx("origin-(--radix-origin) z-50 w-fit", on && "p-4 flex")} />
      {/* Real variant groups are still sorted */}
      <div className="hover:(text-black bg-white) p-4 flex" />
    </aside>
  );
}
