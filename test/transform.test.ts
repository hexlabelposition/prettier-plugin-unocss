/* eslint-disable no-template-curly-in-string -- inputs are source code with template literals */
import type { Parser, Plugin } from 'prettier'
import type { CollectOptions } from '../src/transform'
import { createGenerator } from '@unocss/core'
import { format } from 'prettier'
import { parsers as babelParsers } from 'prettier/plugins/babel'
import { parsers as tsParsers } from 'prettier/plugins/typescript'
import { presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { sortClassesInAst } from '../src/transform'

const uno = await createGenerator({
  presets: [
    presetWind3(),
  ],
})

const defaults: CollectOptions = {
  attributes: ['class', 'className'],
  functions: [
    'clsx',
    'cn',
    'cx',
    'classnames',
    'tv',
    'cva',
  ],
}

// A minimal stand-in for parsers.ts: the built-in parser + sortClassesInAst
function withSorting(parser: Parser, options: CollectOptions): Parser {
  return {
    ...parser,
    async parse(text, parserOptions) {
      const ast = await parser.parse(text, parserOptions)
      await sortClassesInAst(ast, uno, options)
      return ast
    },
  }
}

const parserNames = ['babel', 'typescript'] as const

async function fmt(
  code: string,
  parser: typeof parserNames[number],
  options: Partial<CollectOptions> = {},
  singleQuote = false,
): Promise<string> {
  const collect = {
    ...defaults,
    ...options,
  }
  const plugin: Plugin = {
    parsers: {
      babel: withSorting(babelParsers.babel, collect),
      typescript: withSorting(tsParsers.typescript, collect),
    },
  }
  const once = await format(code, {
    parser,
    plugins: [plugin],
    singleQuote,
  })
  // Every formatter test also checks idempotency
  expect(await format(once, {
    parser,
    plugins: [plugin],
    singleQuote,
  })).toBe(once)
  return once
}

describe.each(parserNames)('sortClassesInAst (%s)', (parser) => {
  const expectFormat = async (input: string, output: string, options?: Partial<CollectOptions>): Promise<void> => {
    expect(await fmt(input, parser, options)).toBe(`${output}\n`)
  }
  const expectUnchanged = (code: string, options?: Partial<CollectOptions>): Promise<void> =>
    expectFormat(code, code, options)

  describe('jSX attributes', () => {
    it('sorts className and class', async () => {
      await expectFormat('<a className="p-4 flex mt-2" />;', '<a className="mt-2 flex p-4" />;')
      await expectFormat('<a class="p-4 flex" />;', '<a class="flex p-4" />;')
    })

    it('sorts strings and templates in expression containers', async () => {
      await expectFormat('<a className={"p-4 flex"} />;', '<a className={"flex p-4"} />;')
      await expectFormat('<a className={`p-4 flex`} />;', '<a className={`flex p-4`} />;')
    })

    it('leaves other attributes alone', async () => {
      await expectUnchanged('<a title="p-4 flex" />;')
      await expectUnchanged('<a xlink:href="p-4 flex" />;')
    })

    it('uses the attributes option', async () => {
      await expectFormat('<a tw="p-4 flex" />;', '<a tw="flex p-4" />;', {
        attributes: ['tw'],
      })
      await expectUnchanged('<a className="p-4 flex" />;', {
        attributes: ['tw'],
      })
    })

    it('sorts conditionals, logical expressions and arrays in expression containers', async () => {
      await expectFormat(
        '<a className={on ? "p-4 flex" : "mt-2 m-1"} />;',
        '<a className={on ? "flex p-4" : "m-1 mt-2"} />;',
      )
      await expectFormat('<a className={on && "p-4 flex"} />;', '<a className={on && "flex p-4"} />;')
    })

    it('sorts class functions inside other attributes', async () => {
      await expectFormat('<a data-x={clsx("p-4 flex")} />;', '<a data-x={clsx("flex p-4")} />;')
    })
  })

  describe('functions', () => {
    it('sorts string arguments', async () => {
      await expectFormat('clsx("p-4 flex", "mt-2 m-1");', 'clsx("flex p-4", "m-1 mt-2");')
    })

    it('sorts strings in conditionals, logical expressions and arrays', async () => {
      await expectFormat(
        'cn(on && "p-4 flex", on ? "p-4 flex" : "mt-2 m-1", ["p-4 flex"]);',
        'cn(on && "flex p-4", on ? "flex p-4" : "m-1 mt-2", ["flex p-4"]);',
      )
    })

    it('sorts nested conditionals, logical expressions and arrays', async () => {
      await expectFormat(
        'cn([on && "p-4 flex", [x ? "mt-2 m-1" : y ? "p-4 flex" : "mt-2 m-1"]]);',
        'cn([on && "flex p-4", [x ? "m-1 mt-2" : y ? "flex p-4" : "m-1 mt-2"]]);',
      )
      await expectFormat('cn("p-4 flex" || x, x ?? "p-4 flex");', 'cn("flex p-4" || x, x ?? "flex p-4");')
      await expectFormat('cn(...["p-4 flex"]);', 'cn(...["flex p-4"]);')
    })

    it('leaves strings outside class positions alone', async () => {
      await expectUnchanged('cn(x === "p-4 flex" ? "flex p-4" : "");')
      await expectUnchanged('cn(other("p-4 flex"));')
      await expectUnchanged('cn(obj["p-4 flex"], obj.get("p-4 flex"));')
      await expectUnchanged('cn("p-4 flex".split(" "));')
      await expectUnchanged('cn(css`p-4 flex`);')
      await expectUnchanged('<a className={x === "p-4 flex" ? "flex p-4" : ""} />;')
      await expectUnchanged('<a className={other("p-4 flex")} />;')
    })

    it('finds class functions nested in other expressions', async () => {
      await expectFormat('cn(merge(clsx("p-4 flex")));', 'cn(merge(clsx("flex p-4")));')
      await expectFormat('cn(clsx("p-4 flex") ? "mt-2 m-1" : "");', 'cn(clsx("flex p-4") ? "m-1 mt-2" : "");')
      await expectFormat('cn(`${clsx("p-4 flex")} mt-2 m-1`);', 'cn(`${clsx("flex p-4")} m-1 mt-2`);')
    })

    it('sorts object values but not keys', async () => {
      await expectFormat(
        'tv({ base: "p-4 flex", variants: { "p-4 flex": { sm: "text-sm p-1" } } });',
        'tv({ base: "flex p-4", variants: { "p-4 flex": { sm: "p-1 text-sm" } } });',
      )
    })

    it('sorts object keys in clsx-like functions', async () => {
      await expectFormat('clsx({ "p-4 flex": on, flex: x });', 'clsx({ "flex p-4": on, flex: x });')
      await expectFormat('cn([{ "p-4 flex": on }], x ? { "mt-2 m-1": on } : "");', 'cn([{ "flex p-4": on }], x ? { "m-1 mt-2": on } : "");')
      await expectFormat('cn({ ["p-4 flex"]: on, [`mt-2 m-1`]: on });', 'cn({ ["flex p-4"]: on, [`m-1 mt-2`]: on });')
    })

    it('leaves object keys alone in tv and cva', async () => {
      await expectFormat(
        'cva("p-4 flex", { variants: { "p-4 flex": { "mt-2 m-1": "mt-2 m-1" } } });',
        'cva("flex p-4", { variants: { "p-4 flex": { "mt-2 m-1": "m-1 mt-2" } } });',
      )
    })

    it('leaves object keys alone in JSX attributes', async () => {
      await expectUnchanged('<a className={{ "p-4 flex": on }} />;')
    })

    it('leaves dynamic object keys alone', async () => {
      await expectUnchanged('cn({ [x ? "p-4 flex" : "mt-2 m-1"]: on, [`p-4 flex ${x}`]: on });')
      await expectUnchanged('cn({ [other("p-4 flex")]: on });')
      await expectFormat('cn({ [clsx("p-4 flex")]: on });', 'cn({ [clsx("flex p-4")]: on });')
    })

    it('leaves object keys alone when sorting would make two keys equal', async () => {
      await expectUnchanged('cn({ "p-4 flex": a, "flex p-4": b, "mt-2 m-1": c });')
      await expectUnchanged('cn({ "p-4 flex": a, [`flex p-4`]: b });')
      await expectUnchanged('cn({ "flex  p-4": a, "flex p-4": b });')
      await expectUnchanged('cn({ " p-4 flex": a, "  flex p-4": b });')
    })

    it('leaves object keys alone next to a spread', async () => {
      await expectUnchanged('cn({ ...base, "p-4 flex": on });')
    })

    it('leaves other functions alone', async () => {
      await expectUnchanged('other("p-4 flex");')
      await expectUnchanged('obj.clsx("p-4 flex");')
    })

    it('uses the functions option', async () => {
      await expectFormat('myCn("p-4 flex");', 'myCn("flex p-4");', {
        functions: ['myCn'],
      })
      await expectUnchanged('clsx("p-4 flex");', {
        functions: ['myCn'],
      })
    })

    it('sorts tagged templates', async () => {
      await expectFormat('tw`p-4 flex`;', 'tw`flex p-4`;', {
        functions: ['tw'],
      })
      await expectUnchanged('other`p-4 flex`;')
    })
  })

  describe('strings', () => {
    it('keeps unknown classes first and sorts variant groups', async () => {
      await expectFormat(
        'clsx("hover:(text-black bg-white) foo md:p-8 p-4");',
        'clsx("foo p-4 hover:(bg-white text-black) md:p-8");',
      )
    })

    it('keeps the quote style', async () => {
      expect(await fmt('clsx(\'p-4 flex\');', parser, {}, true)).toBe('clsx(\'flex p-4\');\n')
    })

    it('keeps leading and trailing spaces', async () => {
      await expectFormat('clsx(" p-4 flex ");', 'clsx(" flex p-4 ");')
    })

    it('skips strings with quotes or backslashes', async () => {
      await expectUnchanged('clsx("p-4 flex it\'s");')
      await expectUnchanged('clsx("p-4 flex \\\\");')
    })
  })

  describe('template literals', () => {
    it('sorts around expressions separated by spaces', async () => {
      await expectFormat('clsx(`p-4 flex ${x} p-2 mt-1`);', 'clsx(`flex p-4 ${x} mt-1 p-2`);')
    })

    it('keeps fragments glued to expressions in place', async () => {
      await expectFormat(
        'clsx(`p-4 flex text-${c}-500 p-2 mt-1`);',
        'clsx(`flex p-4 text-${c}-500 mt-1 p-2`);',
      )
      await expectUnchanged('clsx(`bg-${c}`);')
    })

    it('sorts strings in expressions separated by spaces', async () => {
      await expectFormat(
        'clsx(`p-4 ${on ? "p-4 flex" : "mt-2 m-1"} mt-1`);',
        'clsx(`p-4 ${on ? "flex p-4" : "m-1 mt-2"} mt-1`);',
      )
      await expectFormat('clsx(`${on && "p-4 flex"}`);', 'clsx(`${on && "flex p-4"}`);')
      await expectFormat('<a className={`${"p-4 flex"} ${x}`} />;', '<a className={`${"flex p-4"} ${x}`} />;')
      await expectFormat('tw`p-4 ${on ? "p-4 flex" : ""}`;', 'tw`p-4 ${on ? "flex p-4" : ""}`;', {
        functions: ['tw'],
      })
    })

    it('sorts nested template literals in expressions', async () => {
      await expectFormat(
        'clsx(`p-4 ${on ? `p-4 flex ${x}` : ""}`);',
        'clsx(`p-4 ${on ? `flex p-4 ${x}` : ""}`);',
      )
    })

    it('leaves strings in expressions glued to text alone', async () => {
      await expectUnchanged('clsx(`text-${on ? "red-500 font-bold" : "blue-500"}`);')
      await expectUnchanged('clsx(`${on ? "p-4 flex" : ""}-500`);')
      await expectUnchanged('clsx(`${a}${on ? "p-4 flex" : ""}`);')
      await expectUnchanged('clsx(`${on ? "p-4 flex" : ""}${a}`);')
    })

    it('leaves strings in other expressions alone', async () => {
      await expectUnchanged('clsx(`p-4 ${x === "p-4 flex" ? "flex" : ""}`);')
      await expectUnchanged('clsx(`p-4 ${other("p-4 flex")}`);')
      await expectUnchanged('other(`p-4 ${on ? "p-4 flex" : ""}`);')
    })

    it('sorts String.raw templates in class positions', async () => {
      await expectFormat('clsx(String.raw`p-4 flex`);', 'clsx(String.raw`flex p-4`);')
      await expectFormat('clsx(on && String.raw`p-4 flex ${x}`);', 'clsx(on && String.raw`flex p-4 ${x}`);')
      await expectFormat('<a className={String.raw`p-4 flex`} />;', '<a className={String.raw`flex p-4`} />;')
    })

    it('leaves other String.raw templates alone', async () => {
      await expectUnchanged('String.raw`p-4 flex`;')
      await expectUnchanged('clsx(String["raw"]`p-4 flex`, obj.String.raw`p-4 flex`);')
      await expectUnchanged('clsx(String.raw`p-4 flex \\d`);')
    })

    it('skips chunks with escapes', async () => {
      await expectUnchanged('clsx(`p-4 flex \\n`);')
    })
  })
})
