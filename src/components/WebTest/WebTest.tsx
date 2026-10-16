import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { siteFiles } from '../../codegen/toHTML';
import { pageFile, siteBase } from '../../model/pages';
import { currentPage, projectOf, useEditor } from '../../store/elements';
import { Icon } from '../common/Fields';
import { WidthControl } from '../Shell/WidthControl';
import { ICONS } from '../Shell/icons';
import styles from './WebTest.module.css';

interface Location {
  file: string; // index.html・about.html など（書き出すサイトのファイル名）
  hash: string; // ページ内リンクの移動先（# は付けない）
}

const NOT_FOUND_DOC = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>404</title></head>
<body style="margin:0;font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#555;text-align:center">
<div><div style="font-size:48px;font-weight:700;color:#bbb">404</div><p>このアドレスのページはありません</p>
<p style="font-size:13px;color:#999">（サイトの設定で「ページが見つからないとき」のページを選ぶと、そのページが表示されます）</p></div></body></html>`;

// 書き出す静的サイトのファイル群から、1ページ分の HTML を作る（CSS・スクリプト・画像を埋め込んで、1つの文書だけで表示できるようにする）
function pageDoc(files: Record<string, string | Uint8Array>, file: string, assets: Record<string, string>): string | undefined {
  const html = files[file];
  if (typeof html !== 'string') return undefined;
  const css = typeof files['style.css'] === 'string' ? files['style.css'] : '';
  const js = typeof files['script.js'] === 'string' ? files['script.js'] : '';
  let doc = html
    .replace(/<base [^>]*>\n?/, '') // 404.html の基準 URL（埋め込んだ文書では不要）
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`)
    .replace('<script src="script.js"></script>', () => (js ? `<script>\n${js}</script>` : ''));
  for (const [path, data] of Object.entries(assets)) doc = doc.split(path).join(data);
  return doc;
}

// アドレス欄の入力 → サイトのファイル名とページ内の移動先
function parseAddress(input: string, files: Record<string, unknown>): Location {
  const [path, hash = ''] = input.trim().replace(/^[a-z]+:\/\/[^/]*/i, '').split('#');
  let file = decodeURIComponent(path.split('?')[0]).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!file) file = 'index.html';
  else if (!(file in files) && `${file}.html` in files) file = `${file}.html`;
  return { file, hash };
}

// Webテスト表示：書き出すサイトを、アプリの中の仮想ブラウザで本物の Web サイトと同じように表示する
export function WebTest() {
  const viewW = useEditor((s) => s.viewW);
  const setMode = useEditor((s) => s.setMode);
  // 開いたときのプロジェクトで作る（再読み込みで最新の内容にする）
  const [version, setVersion] = useState(0);
  const site = useMemo(() => {
    const s = useEditor.getState();
    const project = projectOf(s);
    // テスト表示でアクセス解析に記録しないよう、測定 ID は外す
    const files = siteFiles({ ...project, site: { ...s.site, analytics: undefined } });
    return { files, assets: project.assets ?? {}, origin: siteBase(s.site) ?? 'https://example.com', hasUrl: !!siteBase(s.site) };
  }, [version]);
  const [history, setHistory] = useState<{ list: Location[]; i: number }>(() => {
    const s = useEditor.getState();
    return { list: [{ file: pageFile(s.pages, currentPage(s), s.site), hash: '' }], i: 0 };
  });
  const loc = history.list[history.i];
  const doc = useMemo(
    () => pageDoc(site.files, loc.file, site.assets) ?? pageDoc(site.files, '404.html', site.assets) ?? NOT_FOUND_DOC,
    [site, loc.file],
  );
  const address = `${site.origin}/${loc.file === 'index.html' ? '' : loc.file}${loc.hash ? `#${loc.hash}` : ''}`;
  const [typed, setTyped] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const go = (next: Location) => setHistory((h) => ({ list: [...h.list.slice(0, h.i + 1), next], i: h.i + 1 }));
  const step = (d: 1 | -1) => setHistory((h) => ({ ...h, i: Math.min(h.list.length - 1, Math.max(0, h.i + d)) }));
  const exit = () => setMode('edit');

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // ページを読み込んだら、リンク・フォーム・キー操作を仮想ブラウザで処理する
  const onLoad = () => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    setTitle(d.title);
    const scrollTo = (id: string) => {
      if (id === 'top') d.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
      else d.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };
    if (loc.hash) scrollTo(loc.hash);
    d.addEventListener('click', (e) => {
      const a = (e.target as Element).closest?.('a');
      const href = a?.getAttribute('href');
      if (!a || !href) return;
      e.preventDefault();
      if (href.startsWith('#')) scrollTo(href.slice(1));
      else if (/^(https?:)?\/\//i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
      else if (/^(mailto|tel):/i.test(href)) setNotice(`${href} を開くリンクです（Webテスト表示では開きません）`);
      else go(parseAddress(href, site.files));
    }, true);
    d.addEventListener('submit', (e) => {
      e.preventDefault();
      const action = (e.target as HTMLFormElement).getAttribute('action');
      setNotice(`フォームを送信しました。Webテスト表示なので、実際には送信していません${action ? `（送信先：${action}）` : ''}`);
    }, true);
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') exit();
      if (e.key === 'F5') {
        e.preventDefault();
        setVersion((v) => v + 1);
      }
    });
  };

  // 表示の幅が入りきらなければ縮小して表示する
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current!;
    const measure = () => setBox({ w: el.clientWidth - 48, h: el.clientHeight - 40 - 40 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = box.w > 0 ? Math.min(1, box.w / viewW) : 1;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <span className={styles.badge}><Icon path={ICONS.preview} size={15} />Webテスト表示</span>
        <WidthControl dark />
        <button className={styles.exit} onClick={exit} title="編集画面に戻る (Esc)"><Icon path={ICONS.exit} size={15} />編集に戻る</button>
      </div>
      <div ref={stage} className={styles.stage}>
        <div className={styles.browser} style={{ width: viewW * scale }}>
          <div className={styles.chrome}>
            <button className={styles.nav} title="戻る" disabled={history.i === 0} onClick={() => step(-1)}><Icon path={ICONS.back2} /></button>
            <button className={styles.nav} title="進む" disabled={history.i === history.list.length - 1} onClick={() => step(1)}><Icon path={ICONS.forward2} /></button>
            <button className={styles.nav} title="再読み込み（編集した内容を反映）" onClick={() => setVersion((v) => v + 1)}><Icon path={ICONS.reload} /></button>
            <form
              className={styles.address}
              title={site.hasUrl ? undefined : 'サイトの設定で公開する URL を入れると、ここにそのアドレスが表示されます'}
              onSubmit={(e) => {
                e.preventDefault();
                if (typed !== null) go(parseAddress(typed, site.files));
                setTyped(null);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
            >
              <Icon path={ICONS.lock} size={13} />
              <input
                aria-label="アドレス"
                spellCheck={false}
                value={typed ?? address}
                onChange={(e) => setTyped(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => setTyped(null)}
              />
            </form>
            {title && <span className={styles.title} title={title}>{title}</span>}
          </div>
          <div className={styles.viewport} style={{ height: box.h }}>
            <iframe
              key={`${version}-${history.i}-${loc.file}`}
              ref={frame}
              title="Webテスト表示"
              className={styles.frame}
              srcDoc={doc}
              onLoad={onLoad}
              style={{ width: viewW, height: box.h / scale, transform: `scale(${scale})` }}
            />
          </div>
        </div>
        {notice && <div className={styles.notice} role="status">{notice}</div>}
      </div>
    </div>
  );
}
