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

    it('sorts attribute strings with quotes and entities', async () => {
      await expectFormat(String.raw`<a className="content-['x'] p-4 flex" />;`, String.raw`<a className="flex p-4 content-['x']" />;`)
      await expectFormat(String.raw`<a className="content-[&quot;x&quot;] p-4 flex" />;`, String.raw`<a className='flex p-4 content-["x"]' />;`)
      await expectFormat('<a className="p-4 &amp; flex" />;', '<a className="&amp; flex p-4" />;')
      // No escapes in JSX: a backslash is just a character
      await expectFormat(String.raw`<a className="w-[a\b] p-4 flex" />;`, String.raw`<a className="w-[a\b] flex p-4" />;`)
    })

    it('skips attribute strings with unknown entities', async () => {
      await expectUnchanged('<a className="p-4 &nbsp; flex" />;')
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

  describe('variables', () => {
    const variables = {
      variables: ['^cls', 'classNames?$'],
    }

    it('sorts values of matching variables', async () => {
      await expectFormat('const clsButton = "p-4 flex";', 'const clsButton = "flex p-4";', variables)
      await expectFormat('const buttonClassName = `p-4 flex`;', 'const buttonClassName = `flex p-4`;', variables)
      await expectFormat('const ButtonClassNames = on ? "p-4 flex" : "";', 'const ButtonClassNames = on ? "flex p-4" : "";', variables)
      await expectFormat('const clsList = ["p-4 flex"];', 'const clsList = ["flex p-4"];', variables)
    })

    it('sorts object values but not keys', async () => {
      await expectFormat(
        'const classNames = { "p-4 flex": "p-4 flex", nested: { a: "mt-2 m-1" } };',
        'const classNames = { "p-4 flex": "flex p-4", nested: { a: "m-1 mt-2" } };',
        variables,
      )
    })

    it('sorts values returned by functions', async () => {
      await expectFormat(
        'const clsItem = (on) => (on ? "p-4 flex" : "mt-2 m-1");',
        'const clsItem = (on) => (on ? "flex p-4" : "m-1 mt-2");',
        variables,
      )
      await expectFormat(
        'const classNames = { item: function () { const x = "p-4 flex"; return "p-4 flex"; } };',
        'const classNames = {\n  item: function () {\n    const x = "p-4 flex";\n    return "flex p-4";\n  },\n};',
        variables,
      )
    })

    it('leaves other values alone', async () => {
      await expectUnchanged('const clsButton = other("p-4 flex");', variables)
      await expectUnchanged('const clsButton = "p-4" + " flex m-1";', variables)
      await expectUnchanged('const { clsButton = "p-4 flex" } = props;', variables)
      await expectUnchanged('const clsButton = (on) => {\n  if (on) return "p-4 flex";\n};', variables)
      await expectUnchanged('const button = "p-4 flex";', variables)
    })

    it('still finds class functions in values', async () => {
      await expectFormat('const clsButton = clsx({ "p-4 flex": on });', 'const clsButton = clsx({ "flex p-4": on });', variables)
      await expectFormat('const clsButton = merge(clsx("p-4 flex"));', 'const clsButton = merge(clsx("flex p-4"));', variables)
    })

    it('is off without the option', async () => {
      await expectUnchanged('const clsButton = "p-4 flex";')
    })

    it('reports an invalid regular expression', async () => {
      await expect(fmt('const a = "";', parser, {
        variables: ['('],
      })).rejects.toThrow(/Invalid regular expression in unoVariables: "\("/)
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

    it('sorts strings with quotes', async () => {
      await expectFormat(String.raw`clsx("content-['x'] p-4 flex");`, String.raw`clsx("flex p-4 content-['x']");`)
      await expectFormat(String.raw`clsx('content-["x"] p-4 flex');`, String.raw`clsx('flex p-4 content-["x"]');`)
    })

    it('keeps escapes in place', async () => {
      // Prettier picks the quote that needs fewer escapes; the classes keep theirs
      await expectFormat(String.raw`clsx("content-[\"x\"] p-4 flex it's");`, String.raw`clsx('it\'s flex p-4 content-["x"]');`)
      await expectFormat(String.raw`clsx("p-4 flex a\\b");`, String.raw`clsx("a\\b flex p-4");`)
      await expectFormat(String.raw`clsx("p-4 mt-1 \x66lex");`, String.raw`clsx("mt-1 \x66lex p-4");`)
    })

    it('collapses escaped whitespace', async () => {
      await expectFormat(String.raw`clsx("p-4\nflex mt-1");`, 'clsx("mt-1 flex p-4");')
      await expectFormat(String.raw`clsx("p-4\tflex\r\n mt-1\f");`, 'clsx("mt-1 flex p-4 ");')
      await expectFormat(String.raw`clsx("p-4\x20flex\u{A}mt-1");`, 'clsx("mt-1 flex p-4");')
    })

    it('keeps duplicates with their own spellings', async () => {
      await expectFormat(String.raw`clsx("p-4 \x66lex flex mt-1");`, String.raw`clsx("mt-1 \x66lex flex p-4");`)
      await expectFormat(String.raw`clsx("flex p-4 \x66lex mt-1");`, String.raw`clsx("mt-1 flex \x66lex p-4");`)
    })

    it('drops edge whitespace with a line break', async () => {
      await expectFormat(String.raw`clsx("\n  p-4 flex\n");`, 'clsx("flex p-4");')
      // Already sorted, only the layout changes
      await expectFormat(String.raw`clsx(" flex\np-4\n");`, 'clsx(" flex p-4");')
      await expectFormat('<a className="\n  p-4\n  flex\n" />;', '<a className="flex p-4" />;')
    })

    it('skips whitespace the browser does not split classes at', async () => {
      await expectUnchanged(String.raw`clsx("p-4\u00A0flex mt-1");`)
      await expectUnchanged(String.raw`clsx("p-4\vflex mt-1");`)
      // A literal no-break space, not an escape
      await expectUnchanged('clsx("p-4\u00A0flex mt-1");')
    })

    it('skips strings where a variant group would change', async () => {
      // Not a group UnoCSS knows: expanded to `w---x`, an unknown class
      await expectUnchanged('clsx("w-(--x) p-4 flex");')
      // `hover:foo` is unknown and stays expanded, `hover:p-4` alone is not a group
      await expectUnchanged('clsx("hover:(foo p-4) flex");')
      await expectFormat('clsx("hover:(p-4 flex) m-1");', 'clsx("m-1 hover:(flex p-4)");')
    })

    it('skips variant groups that would need new escapes', async () => {
      await expectUnchanged(String.raw`clsx('hover:(content-["x"] p-4) flex');`)
    })

    it('sorts object keys with escapes', async () => {
      await expectFormat(String.raw`clsx({ "content-[\"x\"] p-4 flex": on });`, String.raw`clsx({ 'flex p-4 content-["x"]': on });`)
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

    it('keeps escapes in place', async () => {
      await expectFormat('clsx(`content-[\\`x\\`] p-4 flex`);', 'clsx(`flex p-4 content-[\\`x\\`]`);')
      await expectFormat('clsx(`p-4 \\${x} flex`);', 'clsx(`\\${x} flex p-4`);')
      await expectFormat('clsx(`p-4 flex \\\\ ${x} m-1 mt-2`);', 'clsx(`\\\\ flex p-4 ${x} m-1 mt-2`);')
      await expectFormat('clsx(`content-[\'x\'] p-4 flex`);', 'clsx(`flex p-4 content-[\'x\']`);')
    })

    it('collapses line breaks', async () => {
      await expectFormat('clsx(`\n  p-4\n  flex\n`);', 'clsx(` flex p-4 `);')
      await expectFormat('clsx(`p-4 flex \\n`);', 'clsx(`flex p-4 `);')
      await expectFormat('clsx(`\n  p-4 ${x}\n  mt-1\n  m-1\n`);', 'clsx(` p-4 ${x} m-1 mt-1 `);')
    })

    it('skips whitespace the browser does not split classes at', async () => {
      await expectUnchanged('clsx(`p-4\\u00A0flex mt-1`);')
    })
  })
})
