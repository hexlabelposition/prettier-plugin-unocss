import clsx from "clsx";

export function Quote({ on }: { on: boolean }) {
  return (
    <blockquote className="before:content-['“'] p-4 font-['Inter'] italic flex">
      <p className={clsx("after:content-[\"”\"] mt-2 text-lg", on && 'font-["Inter"] underline font-bold')} />
      <p className={`content-['\`'] p-2 ${on ? "content-[\"x\"] m-1" : ""} block`} />
    </blockquote>
  );
}

// Escaped whitespace: left alone until multiline strings are decided
export const lines = clsx("p-4\nflex mt-1");
