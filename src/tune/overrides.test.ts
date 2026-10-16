import { describe, expect, it } from 'vitest';
import { addOverridesImport, entryFromHtml, hasOverridesImport, overridesPath, parseOverrides, rgbToHex, serializeOverrides, setRuleProp, type TuneRule } from './overrides';

describe('pageedit-overrides.css', () => {
  it('書き出して読み込むと同じルールになる', () => {
    const rules: TuneRule[] = [
      { selector: '.btn', props: { color: '#ffffff', 'background-color': 'rgb(1, 2, 3)' } },
      { selector: ':root', props: { '--primary': '#ff0000' } },
    ];
    const css = serializeOverrides(rules);
    expect(css).toContain('color: #ffffff !important;');
    expect(parseOverrides(css)).toEqual({ rules, extra: '' });
  });

  it('@media など入れ子のあるものは extra として残す', () => {
    const css = `.a { color: red !important; }\n@media (max-width: 600px) { .a { color: blue; } }\n`;
    const { rules, extra } = parseOverrides(css);
    expect(rules).toEqual([{ selector: '.a', props: { color: 'red' } }]);
    expect(extra).toBe('@media (max-width: 600px) { .a { color: blue; } }');
    expect(serializeOverrides(rules, extra)).toContain(extra);
  });

  it('プロパティを空にするとルールから消え、空になったルールも消える', () => {
    let rules = setRuleProp([], '.a', 'color', '#000');
    rules = setRuleProp(rules, '.a', 'padding', '8px');
    expect(rules).toEqual([{ selector: '.a', props: { color: '#000', padding: '8px' } }]);
    rules = setRuleProp(rules, '.a', 'color', '');
    expect(rules).toEqual([{ selector: '.a', props: { padding: '8px' } }]);
    expect(setRuleProp(rules, '.a', 'padding', ' ')).toEqual([]);
  });
});

describe('エントリーファイル', () => {
  it('index.html から探す', () => {
    expect(entryFromHtml('<script type="module" src="/src/main.tsx"></script>')).toBe('src/main.tsx');
    expect(entryFromHtml('<script src="./app.js?v=1" type="module"></script>')).toBe('app.js');
    expect(entryFromHtml('<script src="https://cdn/x.js" type="module"></script>')).toBeNull();
    expect(overridesPath('src/main.tsx')).toBe('src/pageedit-overrides.css');
    expect(overridesPath('main.js')).toBe('pageedit-overrides.css');
  });

  it('import を最後に1行だけ足す', () => {
    const src = "import App from './App';\nrender(App);";
    const out = addOverridesImport(src);
    expect(out.startsWith(src + '\n')).toBe(true);
    expect(out.trimEnd().endsWith("import './pageedit-overrides.css';")).toBe(true);
    expect(hasOverridesImport(out)).toBe(true);
    expect(addOverridesImport(out)).toBe(out);
  });
});

it('rgbToHex', () => {
  expect(rgbToHex('rgb(255, 0, 16)')).toBe('#ff0010');
  expect(rgbToHex('rgba(0, 0, 0, 0)')).toBeNull();
  expect(rgbToHex('rgba(10, 20, 30, 0.5)')).toBe('#0a141e');
  expect(rgbToHex('#ABCDEF')).toBe('#abcdef');
});
