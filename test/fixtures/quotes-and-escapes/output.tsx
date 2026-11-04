import clsx from "clsx";

export function Quote({ on }: { on: boolean }) {
  return (
    <blockquote className="flex p-4 font-['Inter'] italic before:content-['“']">
      <p
        className={clsx(
          'mt-2 text-lg after:content-["”"]',
          on && 'font-bold font-["Inter"] underline',
        )}
      />
      <p
        className={`p-2 content-['\`'] ${on ? 'm-1 content-["x"]' : ""} block`}
      />
    </blockquote>
  );
}
