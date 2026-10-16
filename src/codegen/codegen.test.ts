import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createElement } from '../model/elementTypes';
import { NO_ANIM } from '../runtime/defaults';
import { demoElements } from '../store/demo';
import type { Project } from '../types/element';
import { generatePageCode, projectZip } from './project';
import { siteFiles, toHTML } from './toHTML';

const screen = { w: 1440, h: 900 };
const page1 = { id: 'page-1', name: 'ホーム' };

const project = (): Project => ({
  version: 1,
  screen,
  pages: [
    { ...page1, flow: { x: 0, y: 0 }, elements: [...demoElements(), createElement('button', 'e9', { text: '次へ', to: 'page-2' })] },
    { id: 'page-2', name: '詳細', flow: { x: 300, y: 0 }, elements: [createElement('heading', 'e1', { text: '詳細ページ', to: 'page-1' })] },
  ],
});

describe('generatePageCode', () => {
  it('既定値と同じスタイルは書かない', () => {
    const code = generatePageCode([createElement('button', 'e1', { x: 1, y: 2 })], page1, screen, 'react');
    expect(code).toContain('<Box id="e1" type="button" x={1} y={2} w={140} h={44}>ボタン</Box>');
  });

  it('変更したスタイルとアニメーション・リンクを書く', () => {
    const el = createElement('text', 'e1', { color: '#ff0000', to: 'page-2', anim: { ...NO_ANIM, type: 'fadeIn' } });
    expect(generatePageCode([el], page1, screen, 'react')).toContain(`color="#ff0000" to="page-2" anim={{ type: 'fadeIn', duration: 0.6, delay: 0, iter: '1', easing: 'ease', direction: 'normal', trigger: 'onLoad' }}`);
    expect(generatePageCode([el], page1, screen, 'vue')).toContain('color="#ff0000" to="page-2"');
  });

  it('ページの幅は画面サイズ、高さは画面の高さと要素の下端の大きい方', () => {
    expect(generatePageCode([], page1, screen, 'react')).toContain('<Page id="page-1" w={1440} h={900} sp={{ w: 390, h: 844 }}>');
    const tall = generatePageCode([createElement('rect', 'e1', { y: 1000, h: 100 })], page1, screen, 'react');
    expect(tall).toContain('<Page id="page-1" w={1440} h={1100}');
    // スマホの画面で作ったページには、スマホ用のレイアウトはない
    expect(generatePageCode([], page1, { w: 390, h: 844 }, 'vue')).toContain('<Page id="page-1" :w="390" :h="844">');
  });

  it('コンポーネント名はページ ID から付け、ページ名をコメントに書く', () => {
    const code = generatePageCode([], { id: 'page-12', name: '問い合わせ */ x' }, screen, 'react');
    expect(code).toContain('export default function Page12()');
    expect(code).toContain('// 問い合わせ * / x');
  });
});

describe('toHTML', () => {
  const p = project();
  p.pages[0].elements.push(
    createElement('text', 'e10', { text: '<b>x</b>', anim: { ...NO_ANIM, type: 'tada', trigger: 'onClick' } }),
    createElement('rect', 'e11', { hidden: true, anim: { ...NO_ANIM, type: 'spin' } }),
  );
  const html = toHTML(p);

  it('使ったアニメーションの keyframes だけを出力する', () => {
    expect(html).toContain('@keyframes kf-heartbeat');
    expect(html).toContain('@keyframes kf-tada');
    expect(html).not.toContain('@keyframes kf-spin'); // 非表示要素のみが使用
    expect(html).not.toContain('@keyframes kf-bounce');
  });

  it('非表示要素を除き、全ページを通して el-1〜el-N で出力する', () => {
    expect(html.match(/<(div|a) class="el-\d+"/g)).toHaveLength(11);
    expect(html).toContain('class="el-11"');
  });

  it('ページごとに .page を出し、ハッシュで切り替える', () => {
    expect(html).toContain('<div class="page pg-1 on" id="page-1"');
    expect(html).toContain('<div class="page pg-2" id="page-2"');
    expect(html).toContain('.stage{position:relative;width:1440px;margin:0 auto;zoom:var(--s,1)}');
    expect(html).toMatch(/<a class="el-\d+" href="#\/page-2">/);
    expect(html).toContain("addEventListener('hashchange',show)");
  });

  it('クリック時トリガーの JS とテキストのエスケープ', () => {
    expect(html).toMatch(/\.el-10\.play>\.in\{animation:kf-tada/);
    expect(html).toContain("classList.add('play')");
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('スタイルの値から <style> を抜け出せる文字を取り除く', () => {
    const evil = project();
    evil.pages[0].elements = [createElement('rect', 'e1', { bg: 'red}</style><script>alert(1)</script>' })];
    const out = toHTML(evil);
    expect(out).not.toContain('<script>alert');
    expect(out).toContain('background:red/stylescriptalert(1)/script');
  });

  it('1ページだけならページ切り替えの JS は出さない', () => {
    const single = project();
    single.pages = [{ ...single.pages[0], elements: [] }];
    expect(toHTML(single)).not.toContain('hashchange');
  });

  it('使っているフォントだけを Google Fonts から読み込む', () => {
    expect(html).toContain('family=Noto+Sans+JP');
    expect(html).not.toContain('family=Lora');
  });

  it('リンク・見出しのタグ・画像の代替テキスト', () => {
    const p = project();
    p.pages[0].elements = [
      createElement('heading', 'e1', { text: '見出し', tag: 'h1' }),
      createElement('text', 'e2', { text: '本文' }),
      createElement('button', 'e3', { text: '外部', href: 'https://example.com', newTab: true }),
      createElement('image', 'e4', { src: 'https://example.com/a.png', alt: '"外観"' }),
    ];
    const out = toHTML(p);
    expect(out).toContain('<h1 class="in">見出し</h1>');
    expect(out).toContain('<p class="in">本文</p>');
    // <a> の中にボタンは置けないので <div> にする
    expect(out).toContain('<a class="el-3" href="https://example.com" target="_blank" rel="noopener noreferrer"><div class="in">外部</div></a>');
    expect(out).toContain('alt="&quot;外観&quot;"');
  });

  it('マウスを乗せたときの見た目を :hover で書き、図形の塗りも変える', () => {
    const p = project();
    p.pages[0].elements = [
      createElement('button', 'e1', { hover: { bg: 'var(--c2)', scale: 1.05, y: -4, underline: true } }),
      createElement('star', 'e2', { hover: { bg: '#ff0000' } }),
    ];
    const out = toHTML(p);
    expect(out).toMatch(/\.el-1>\.in\{[^}]*transition:background \.2s/);
    expect(out).toContain('.el-1:hover>.in{background:var(--c2);scale:1.05;translate:0 -4px;text-decoration:underline}');
    expect(out).toContain('.el-2:hover polygon{fill:#ff0000!important}');
  });

  it('ページ内リンク：移動先の要素に印を付け、ハッシュを書き換えずにスクロールする', () => {
    const p = project();
    p.pages[0].elements = [
      createElement('text', 'e1', { text: '料金へ', href: '#e2' }),
      createElement('heading', 'e2', { text: '料金', y: 1500 }),
      createElement('button', 'e3', { text: '先頭へ', href: '#top' }),
    ];
    const out = toHTML(p);
    expect(out).toContain('<a class="el-1" href="#e2">');
    expect(out).toContain('<div class="el-2" data-anchor="e2">');
    expect(out).toContain('scrollIntoView');
    expect(out).toContain('html{scroll-behavior:smooth}');
    const site = siteFiles(p)['index.html'] as string;
    expect(site).toContain('<div class="el-2" id="e2">');
    expect(site).not.toContain('scrollIntoView');
  });

  it('フォーム：送信先があれば入力欄と送信ボタンを form 属性でつなぐ', () => {
    const p = project();
    p.pages[0] = {
      ...p.pages[0],
      form: 'https://formspree.io/f/abc',
      elements: [
        createElement('input', 'e1', { name: 'email', inputType: 'email', required: true }),
        createElement('textarea', 'e2', { name: 'message' }),
        createElement('input', 'e3'),
        createElement('button', 'e4', { text: '送信', submit: true }),
      ],
    };
    const out = toHTML(p);
    expect(out).toContain('<form id="form-1" action="https://formspree.io/f/abc" method="POST"></form>');
    expect(out).toMatch(/<input type="email"[^>]* name="email" form="form-1" required/);
    expect(out).toMatch(/<textarea[^>]* name="message" form="form-1"/);
    expect(out).toMatch(/<input type="text" placeholder="[^"]*" aria-label="[^"]*" style=/); // 項目名がなければ送らない
    expect(out).toContain('<button class="in" type="submit" form="form-1">送信</button>');
    const code = generatePageCode(p.pages[0].elements, p.pages[0], screen, 'react');
    expect(code).toContain('form="https://formspree.io/f/abc"');
    expect(code).toContain('name="email" inputType="email" required');
  });

  it('全ページ共通のヘッダー・フッターを各ページに入れ、フッターは中身の下に置く', () => {
    const p = project();
    p.site = {
      name: '', lang: 'ja', favicon: '', colors: [], bg: '#fff',
      header: [createElement('heading', 'h1', { text: '共通ヘッダー', x: 0, y: 0 })],
      footer: [createElement('text', 'f1', { text: '共通フッター', x: 0, y: 0, h: 40 })],
    };
    p.pages[1].elements = [createElement('rect', 'e1', { y: 1000, h: 200 })];
    const files = siteFiles(p);
    for (const f of ['index.html', 'page-2.html']) {
      expect(files[f]).toContain('共通ヘッダー');
      expect(files[f]).toContain('共通フッター');
    }
    // page-2：中身の下端 1200 の下にフッター。index：画面の下端（900 - 40）
    expect(files['style.css']).toMatch(/\.el-\d+\{position:absolute;left:0px;top:1200px;/);
    expect(files['style.css']).toMatch(/\.el-\d+\{position:absolute;left:0px;top:860px;/);
    const zip = unzipSync(projectZip(p, 'react'));
    expect(strFromU8(zip['vpe-page/src/pages/Page2.tsx'])).toContain('<Box id="f1" type="text" x={0} y={1200}');
  });

  it('メニュー：項目のリンクと、スマホで開く ☰ ボタン・メニューを書く', () => {
    const p = project();
    p.pages[0].elements = [
      createElement('nav', 'e1', { text: 'ホーム | page-1\n詳細 | page-2\n料金 | #e2\n外部 | https://example.com\nリンクなし' }),
      createElement('heading', 'e2', { text: '料金', y: 1500 }),
    ];
    const files = siteFiles(p);
    const index = files['index.html'] as string;
    expect(index).toMatch(/<nav class="in"><a href="index.html"[^>]*>ホーム<\/a><a href="page-2.html"[^>]*>詳細<\/a><a href="#e2"[^>]*>料金<\/a><a href="https:\/\/example.com"[^>]*>外部<\/a><span[^>]*>リンクなし<\/span><button class="burger"/);
    expect(index).toContain('<div class="menu" id="menu-el-1" role="dialog" aria-label="メニュー" hidden');
    expect(index).toContain('<div class="el-2" id="e2">'); // メニューのページ内リンクの移動先
    expect(index).toContain('<script src="script.js"></script>');
    expect(files['script.js']).toContain(".burger");
    const css = files['style.css'] as string;
    expect(css).toContain('.el-1 .burger{display:none}');
    expect(css).toMatch(/@media[^{]*\{[\s\S]*\.el-1>\.in>:not\(\.burger\)\{display:none\}\n\.el-1 \.burger\{display:flex\}/);
  });

  it('サイト名・説明文・言語', () => {
    const p = { ...project(), site: { name: 'My Site', lang: 'en', favicon: '', colors: [], bg: '#fafafa' } };
    p.pages[0] = { ...p.pages[0], title: 'Top', description: 'Welcome <here>' };
    const out = toHTML(p);
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('<title>Top | My Site</title>');
    expect(out).toContain('<meta name="description" content="Welcome &lt;here&gt;">');
    expect(out).toContain('data-title="詳細 | My Site"');
  });
});

describe('テーマの色とページの背景', () => {
  it('テーマの色を CSS 変数で、背景色をページごとに書き出す', () => {
    const p = { ...project(), site: { name: '', lang: 'ja', favicon: '', colors: [{ id: 'c1', name: 'メイン', value: '#112233' }], bg: 'var(--c1)' } };
    p.pages[1] = { ...p.pages[1], bg: '#fafafa' };
    const out = toHTML(p);
    expect(out).toContain(':root{--c1:#112233}');
    expect(out).toContain('background:var(--c1)}');
    expect(out).toMatch(/id="page-2"[^>]*style="background:#fafafa"/);
    expect(out).toContain('.pg-2>.stage{height:900px}');
    const files = unzipSync(projectZip(p, 'react'));
    expect(strFromU8(files['vpe-page/index.html'])).toContain(':root{--c1:#112233}');
    expect(strFromU8(files['vpe-page/src/pages/Page2.tsx'])).toContain('bg="#fafafa"');
  });
});

describe('siteFiles', () => {
  const p: Project = { ...project(), assets: { 'assets/img-1.png': 'data:image/png;base64,iVBORw0KGgo=' } };
  p.pages[1] = { ...p.pages[1], slug: 'about', description: '会社について' };
  p.pages[0].elements.push(createElement('image', 'e20', { src: 'assets/img-1.png' }));
  const files = siteFiles(p);

  it('先頭のページは index.html、ほかは slug のファイル', () => {
    expect(Object.keys(files).sort()).toEqual(['about.html', 'assets/img-1.png', 'index.html', 'robots.txt', 'style.css']);
  });

  it('公開する URL があれば、正式な URL・SNS の画像・サイトマップを書く', () => {
    const q: Project = { ...p, site: { name: 'Shop', lang: 'ja', favicon: '', colors: [], bg: '#fff', url: 'https://example.com/', ogImage: 'assets/img-1.png' } };
    const f = siteFiles(q);
    expect(f['index.html']).toContain('<link rel="canonical" href="https://example.com/">');
    expect(f['about.html']).toContain('<meta property="og:url" content="https://example.com/about.html">');
    expect(f['about.html']).toContain('<meta property="og:image" content="https://example.com/assets/img-1.png">');
    expect(f['sitemap.xml']).toContain('<url><loc>https://example.com/about.html</loc></url>');
    expect(f['robots.txt']).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(files['index.html']).not.toContain('canonical');
  });

  it('ページへのリンクは普通の <a href>、画像は assets/ を参照する', () => {
    const index = files['index.html'] as string;
    expect(index).toMatch(/<a class="el-\d+" href="about.html">/);
    expect(index).toContain('src="assets/img-1.png"');
    expect(index).toContain('<link rel="stylesheet" href="style.css">');
    expect(index).not.toContain('hashchange');
    expect(files['about.html']).toContain('<meta name="description" content="会社について">');
    expect(files['about.html']).toMatch(/<a class="el-\d+" href="index.html">/);
  });

  it('slug がなければページ ID のファイル名', () => {
    const q = project();
    expect(Object.keys(siteFiles(q))).toContain('page-2.html');
  });
});

describe('projectZip', () => {
  it.each(['react', 'vue'] as const)('%s プロジェクトのファイル一式', (format) => {
    const files = unzipSync(projectZip(project(), format));
    const names = Object.keys(files).sort();
    const ext = format === 'react' ? 'tsx' : 'vue';
    const app = `vpe-page/src/App.${ext}`;
    expect(names).toEqual(expect.arrayContaining([
      'vpe-page/package.json', 'vpe-page/tsconfig.json', 'vpe-page/README.md', 'vpe-page/vite.config.ts', app,
      `vpe-page/src/pages/Page1.${ext}`, `vpe-page/src/pages/Page2.${ext}`,
      `vpe-page/src/vpe/Box.${ext}`, 'vpe-page/src/vpe/defaults.ts', 'vpe-page/src/vpe/animations.css', 'vpe-page/src/vpe/nav.ts',
    ]));
    expect(strFromU8(files[`vpe-page/src/pages/Page1.${ext}`])).toContain('<Box id="e1" type="heading"');
    const appCode = strFromU8(files[app]);
    expect(appCode).toContain(`import Page2 from './pages/Page2${format === 'vue' ? '.vue' : ''}'`);
    expect(appCode).toContain("const HOME = 'page-1'");
    expect(appCode).toContain("replace(/^#\\/?/, '')");
  });
});

describe('スマホ用のレイアウト', () => {
  const p = project();
  p.pages[0].elements = [
    createElement('heading', 'e1', { x: 100, y: 100, w: 800, h: 80, text: '見出し', fontSize: '52px' }),
    createElement('text', 'e2', { x: 100, y: 200, w: 600, h: 40, text: 'PC だけ', sp: { x: 0, y: 0, w: 100, h: 40, hidden: true } }),
    createElement('text', 'e3', { x: 100, y: 300, w: 600, h: 40, text: 'スマホだけ', hidden: true, sp: { x: 20, y: 400, w: 350, h: 40, hidden: false } }),
  ];

  it('HTML：767px 以下では、スマホ用の位置・サイズ・文字の大きさにする', () => {
    const out = toHTML(p);
    expect(out).toContain('@media (max-width: 767px){');
    expect(out).toMatch(/\.el-1\{left:20px;top:464px;width:350px;height:\d+px;\}\n\.el-1>\.in\{font-size:37px\}/);
    expect(out).toContain('.el-2{left:0px;top:0px;width:100px;height:40px;display:none;}');
    expect(out).toMatch(/\.el-3\{position:absolute;[^}]*display:none;\}/); // PC では非表示
    expect(out).toContain('.el-3{left:20px;top:400px;width:350px;height:40px;display:block;}');
    expect(out).toContain('.pg-1>.stage{width:390px;height:844px}');
    // スマホでは幅 390px で表示する
    expect(out).toContain("if(Math.min(screen.width,screen.height)<768)document.querySelector('meta[name=viewport]').setAttribute('content','width=390')");
  });

  it('React / Vue：自動で並べた分も含めて、全要素に sp を書き出す', () => {
    const files = unzipSync(projectZip(p, 'react'));
    const code = strFromU8(files['vpe-page/src/pages/Page1.tsx']);
    expect(code).toMatch(/<Box id="e1" [^>]*sp=\{\{ x: 20, y: 464, w: 350, h: \d+, fontSize: '37px' \}\}/);
    expect(code).toContain("sp={{ x: 0, y: 0, w: 100, h: 40, hidden: true }}");
    expect(files['vpe-page/src/vpe/Page.tsx']).toBeDefined();
    expect(files['vpe-page/src/vpe/responsive.ts']).toBeDefined();
    const vue = unzipSync(projectZip(p, 'vue'));
    expect(strFromU8(vue['vpe-page/src/pages/Page1.vue'])).toContain(':sp="{ x: 0, y: 0, w: 100, h: 40, hidden: true }"');
    expect(vue['vpe-page/src/vpe/Page.vue']).toBeDefined();
  });

  it('スマホの画面で作ったプロジェクトは、その幅で表示するだけ', () => {
    const small = { ...project(), screen: { w: 390, h: 844 } };
    const out = toHTML(small);
    expect(out).not.toContain('@media');
    expect(out).toContain('<meta name="viewport" content="width=390">');
  });
});

describe('サイトの仕上げ（固定ヘッダー・現在のページ・お知らせ・404・アクセス解析）', () => {
  const base = { name: '', lang: 'ja', favicon: '', colors: [], bg: '#fff' };

  it('メニュー：表示中のページの項目に下線と aria-current、項目ごとの :hover', () => {
    const p = project();
    p.pages[0].elements = [createElement('nav', 'e1', { text: 'ホーム | page-1\n詳細 | page-2', hover: { color: '#ff0000', underline: true } })];
    const files = siteFiles(p);
    expect(files['index.html']).toMatch(/<a href="index.html" aria-current="page" style="[^"]*text-decoration:underline[^"]*">ホーム<\/a><a href="page-2.html" style="[^"]*text-decoration:none[^"]*">詳細<\/a>/);
    const css = files['style.css'] as string;
    expect(css).toContain('.el-1>.in>a:hover,#menu-el-1>a:hover{color:#ff0000!important;text-decoration:underline!important;');
    // 要素全体には hover を付けない
    expect(css).not.toContain('.el-1:hover>.in');
  });

  it('お知らせ一覧：日付とタイトル、リンク先のある件は <a>', () => {
    const p = project();
    p.pages[0].elements = [createElement('news', 'e1', { text: '2026.10.01 | 新サービス | page-2\n2026.09.01 | 公開しました', hover: { underline: true } })];
    const files = siteFiles(p);
    const index = files['index.html'] as string;
    expect(index).toMatch(/<ul class="in"><li[^>]*><a href="page-2.html"[^>]*><time[^>]*>2026.10.01<\/time><span[^>]*>新サービス<\/span><\/a><\/li><li[^>]*><div[^>]*><time[^>]*>2026.09.01<\/time><span[^>]*>公開しました<\/span><\/div><\/li><\/ul>/);
    expect(files['style.css']).toContain('.el-1 a:hover>span{text-decoration:underline!important;');
    const code = generatePageCode(p.pages[0].elements, page1, screen, 'react');
    expect(code).toContain('<Box id="e1" type="news"');
  });

  it('固定ヘッダー：ヘッダーの要素を .sticky で囲み、スマホでは高さを変える', () => {
    const p = project();
    p.site = { ...base, stickyHeader: true, header: [createElement('rect', 'h1', { x: 0, y: 0, w: 1440, h: 80 }), createElement('heading', 'h2', { text: 'ロゴ', x: 40, y: 10, w: 300, h: 60 })] };
    const files = siteFiles(p);
    const index = files['index.html'] as string;
    expect(index).toMatch(/<div class="sticky">\n {2}<div class="el-1 band band-sp">[\s\S]*ロゴ[\s\S]*?<\/div>\n {2}<\/div>\n {2}<div class="el-3"/);
    const css = files['style.css'] as string;
    expect(css).toContain('.sticky{position:sticky;top:0;height:80px;z-index:100}');
    expect(css).toContain('html{scroll-padding-top:80px}');
    expect(css).toMatch(/@media[\s\S]*\.sticky\{height:\d+px\}/);
    // 設定しなければ囲まない
    p.site = { ...p.site, stickyHeader: undefined };
    expect(siteFiles(p)['index.html']).not.toContain('class="sticky"');
  });

  it('固定ヘッダー：React / Vue では <StickyHeader> で囲む', () => {
    const p = project();
    p.site = { ...base, stickyHeader: true, header: [createElement('rect', 'h1', { x: 0, y: 0, w: 1440, h: 80 })] };
    for (const format of ['react', 'vue'] as const) {
      const zip = unzipSync(projectZip(p, format));
      const ext = format === 'react' ? 'tsx' : 'vue';
      const code = strFromU8(zip[`vpe-page/src/pages/Page1.${ext}`]);
      expect(code).toMatch(format === 'react' ? /<StickyHeader h=\{80\} sp=\{\{ h: \d+ \}\}>\n\s+<Box id="h1"/ : /<StickyHeader :h="80" :sp="\{ h: \d+ \}">\n\s+<Box id="h1"/);
      expect(zip[`vpe-page/src/vpe/StickyHeader.${ext}`]).toBeDefined();
    }
  });

  it('404 ページ：404.html に書き出し、相対パスの基準と noindex を書いてサイトマップから除く', () => {
    const p = project();
    p.site = { ...base, url: 'https://example.com', notFound: 'page-2' };
    const files = siteFiles(p);
    expect(Object.keys(files)).toContain('404.html');
    expect(Object.keys(files)).not.toContain('page-2.html');
    const nf = files['404.html'] as string;
    expect(nf).toContain('<base href="https://example.com/">');
    expect(nf).toContain('<meta name="robots" content="noindex">');
    expect(nf).not.toContain('canonical');
    expect(files['sitemap.xml']).not.toContain('404');
    expect(files['index.html']).toMatch(/href="404.html"/); // 404 ページへのリンクもファイル名が変わる
    // 1ファイルの HTML：見つからないページなら 404 ページを表示する
    expect(toHTML(p)).toContain('data-not-found');
    expect(toHTML(p)).toContain(".page[data-not-found]");
    // React：見つからないページなら NOT_FOUND
    const app = strFromU8(unzipSync(projectZip(p, 'react'))['vpe-page/src/App.tsx']);
    expect(app).toContain("const NOT_FOUND = 'page-2'");
    expect(app).toContain('id in PAGES ? id : id ? NOT_FOUND : HOME');
  });

  it('404 ページ：公開する URL がなければサイトの先頭（/）を基準にする。最初のページは 404 にならない', () => {
    const p = project();
    p.site = { ...base, notFound: 'page-2' };
    expect(siteFiles(p)['404.html']).toContain('<base href="/">');
    p.site = { ...base, notFound: 'page-1' };
    expect(Object.keys(siteFiles(p))).not.toContain('404.html');
  });

  it('Google アナリティクス：測定 ID が正しければタグを入れる', () => {
    const p = project();
    p.site = { ...base, analytics: 'G-ABC123XYZ' };
    expect(siteFiles(p)['index.html']).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ');
    expect(toHTML(p)).toContain("gtag('config','G-ABC123XYZ')");
    expect(strFromU8(unzipSync(projectZip(p, 'vue'))['vpe-page/index.html'])).toContain('gtag/js?id=G-ABC123XYZ');
    p.site = { ...base, analytics: "G-1');alert(1)//" };
    expect(siteFiles(p)['index.html']).not.toContain('gtag');
  });
});

describe('スクロールするページと、画面の幅に合わせた表示', () => {
  const base = { name: '', lang: 'ja', favicon: '', colors: [], bg: '#fff' };

  it('幅いっぱいの帯は画面の幅に伸ばし、中身は狭い画面で縮める', () => {
    const p = project();
    p.pages[0].elements = [createElement('rect', 'e1', { x: 0, y: 0, w: 1440, h: 400 }), createElement('heading', 'e2', { x: 100, y: 100, w: 600, h: 60 })];
    const files = siteFiles(p);
    const index = files['index.html'] as string;
    expect(index).toContain('<div class="el-1 band band-sp">');
    expect(index).toContain('<div class="el-2">');
    expect(index).toContain("w>767?Math.min(1,w/1440):1");
    expect(index).toMatch(/<div class="page pg-1"[^>]*>\n<div class="stage">/);
    const css = files['style.css'] as string;
    expect(css).toContain('@media (min-width:768px){\n.band{left:min(0px, calc((1440px - 100vw) / 2))!important;width:max(1440px, 100vw)!important}');
    expect(css).toContain('.band-sp{left:min(0px, calc((390px - 100vw) / 2))!important;width:max(390px, 100vw)!important}');
    expect(css).toContain('.page{width:100%;overflow-x:clip}');
  });

  it('ページの長さ：ページの高さとフッターの位置に使う', () => {
    const p = project();
    p.site = { ...base, footer: [createElement('text', 'f1', { text: 'フッター', x: 0, y: 0, h: 40 })] };
    p.pages[1].h = 2000;
    const files = siteFiles(p);
    expect(files['style.css']).toContain('.pg-2>.stage{height:2000px}');
    expect(files['style.css']).toMatch(/\.el-\d+\{position:absolute;left:0px;top:1960px;/);
    const zip = unzipSync(projectZip(p, 'react'));
    const code = strFromU8(zip['vpe-page/src/pages/Page2.tsx']);
    expect(code).toContain('h={2000}');
    expect(code).toContain('<Box id="f1" type="text" x={0} y={1960}');
  });

  it('スクロールで表示：画面に入るまで止めておき、.seen で再生する', () => {
    const p = project();
    p.pages[0].elements = [createElement('text', 'e1', { y: 2000, anim: { ...NO_ANIM, type: 'fadeIn', trigger: 'onView' } })];
    const files = siteFiles(p);
    expect(files['index.html']).toContain('<div class="el-1" data-view>');
    expect(files['index.html']).toContain('<noscript><style>.in{animation-play-state:running!important}</style></noscript>');
    const css = files['style.css'] as string;
    expect(css).toMatch(/\.el-1>\.in\{[^}]*animation:kf-fadeIn 0\.6s ease 0s 1 normal both paused\}/);
    expect(css).toContain('.el-1.seen>.in{animation-play-state:running}');
    expect(files['script.js']).toContain('IntersectionObserver');
    expect(generatePageCode(p.pages[0].elements, page1, screen, 'react')).toContain("trigger: 'onView'");
  });

  it('「ページの先頭へ」ボタン', () => {
    const p = project();
    p.site = { ...base, backToTop: true };
    const files = siteFiles(p);
    expect(files['index.html']).toContain('<button class="to-top" type="button" aria-label="ページの先頭へ">');
    expect(files['script.js']).toContain(".to-top");
    expect(files['style.css']).toContain('.to-top:not(.show){opacity:0;visibility:hidden}');
    expect(toHTML(p)).toContain('class="to-top"');
    const zip = unzipSync(projectZip(p, 'react'));
    expect(strFromU8(zip['vpe-page/src/App.tsx'])).toContain('<BackToTop />');
    expect(zip['vpe-page/src/vpe/BackToTop.tsx']).toBeDefined();
    const vue = unzipSync(projectZip(p, 'vue'));
    expect(strFromU8(vue['vpe-page/src/App.vue'])).toContain('<BackToTop />');
    p.site = { ...base };
    expect(siteFiles(p)['index.html']).not.toContain('to-top');
  });
});
