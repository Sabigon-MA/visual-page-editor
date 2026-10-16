import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditor } from '../../store/elements';
import { nextColorId } from '../../model/theme';
import { GA_ID_RE, SITE_URL_RE } from '../../model/pages';
import { hexColor } from '../../utils/html';
import { ColorPicker } from '../common/ColorPicker';
import { ColorField } from '../common/Fields';
import { chooseSiteImage } from '../Shell/fileActions';
import { useConfirm } from './confirm';
import styles from './Dialog.module.css';

function Modal({ title, onClose, children, footer, width = 420 }: { title: string; onClose(): void; children: ReactNode; footer: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // 最初の入力欄、なければ主ボタンにフォーカス
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button[data-primary]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={styles.dialog} style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.title}>{title}</div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>{footer}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const c = useConfirm((s) => s.current);
  if (!c) return null;
  return (
    <Modal
      title={c.title}
      onClose={() => c.resolve('cancel')}
      footer={
        <>
          <button className={styles.btn} onClick={() => c.resolve('cancel')}>キャンセル</button>
          {c.alt && <button className={styles.btn} onClick={() => c.resolve('alt')}>{c.alt}</button>}
          <button className={`${styles.btn} ${c.danger ? styles.danger : styles.primary}`} data-primary onClick={() => c.resolve('ok')}>{c.ok ?? 'OK'}</button>
        </>
      }
    >
      {c.message && <p className={styles.message}>{c.message}</p>}
    </Modal>
  );
}

const LANGS: [string, string][] = [['ja', '日本語'], ['en', 'English'], ['zh-CN', '中文（简体）'], ['zh-TW', '中文（繁體）'], ['ko', '한국어']];

// サイトの設定（サイト名・言語・ファビコン）。変更はすぐに反映し、元に戻すで戻せる
export function SiteSettingsDialog() {
  const open = useEditor((s) => s.setup === 'site');
  const site = useEditor((s) => s.site);
  const favicon = useEditor((s) => (s.site.favicon ? s.assets[s.site.favicon] : undefined));
  const ogImage = useEditor((s) => (s.site.ogImage ? s.assets[s.site.ogImage] : undefined));
  const [url, setUrl] = useState(site.url ?? '');
  useEffect(() => setUrl(site.url ?? ''), [open, site.url]);
  const urlOk = !url.trim() || SITE_URL_RE.test(url.trim());
  const [ga, setGa] = useState(site.analytics ?? '');
  useEffect(() => setGa(site.analytics ?? ''), [open, site.analytics]);
  const gaOk = !ga.trim() || GA_ID_RE.test(ga.trim());
  const { closeSetup, setSite, commit } = useEditor.getState();
  if (!open) return null;
  return (
    <Modal title="サイトの設定" width={500} onClose={closeSetup} footer={<button className={`${styles.btn} ${styles.primary}`} data-primary onClick={closeSetup}>閉じる</button>}>
      <div className={styles.form}>
        <label className={styles.field}>
          <span>サイト名</span>
          <input
            className={styles.wide}
            data-autofocus
            value={site.name}
            placeholder="例：〇〇カフェ"
            onChange={(e) => setSite({ name: e.target.value }, false)}
            onBlur={commit}
          />
          <small>各ページのタイトルの後ろに「 | サイト名」と付けます（ブラウザのタブや検索結果に表示）</small>
        </label>
        <label className={styles.field}>
          <span>言語</span>
          <select className={styles.wide} value={site.lang} onChange={(e) => setSite({ lang: e.target.value })}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {!LANGS.some(([v]) => v === site.lang) && <option value={site.lang}>{site.lang}</option>}
          </select>
          <small>読み上げや翻訳、検索エンジンがページの言語を知るのに使います</small>
        </label>
        <div className={styles.field}>
          <span>ファビコン</span>
          <div className={styles.faviconRow}>
            <span className={styles.favicon}>{favicon ? <img src={favicon} alt="" /> : '—'}</span>
            <button className={styles.btn} onClick={() => void chooseSiteImage('favicon')}>{site.favicon ? '変更…' : '画像を選ぶ…'}</button>
            {site.favicon && <button className={styles.btn} onClick={() => setSite({ favicon: '' })}>なし</button>}
          </div>
          <small>ブラウザのタブに表示する小さなアイコン。正方形の画像（PNG・SVG）がおすすめです</small>
        </div>
        <label className={styles.field}>
          <span>公開する URL</span>
          <input
            className={styles.wide}
            value={url}
            placeholder="https://example.com"
            onChange={(e) => {
              setUrl(e.target.value);
              const v = e.target.value.trim();
              if (!v || SITE_URL_RE.test(v)) setSite({ url: v || undefined }, false);
            }}
            onBlur={commit}
          />
          {urlOk
            ? <small>Web サイトを公開する場所。書き出すときに、検索エンジン向けのサイトマップ（sitemap.xml）と、各ページの正式な URL を書き込みます</small>
            : <small className={styles.error}>https:// で始まる URL を入力してください</small>}
        </label>
        <div className={styles.field}>
          <span>SNS で共有したときの画像</span>
          <div className={styles.faviconRow}>
            <span className={styles.ogImage}>{ogImage ? <img src={ogImage} alt="" /> : '—'}</span>
            <button className={styles.btn} onClick={() => void chooseSiteImage('ogImage')}>{site.ogImage ? '変更…' : '画像を選ぶ…'}</button>
            {site.ogImage && <button className={styles.btn} onClick={() => setSite({ ogImage: undefined })}>なし</button>}
          </div>
          <small>X（Twitter）や LINE などでページの URL を共有したときに表示する画像。横 1200 × 縦 630 px がおすすめです{site.ogImage && !site.url ? '（表示するには、公開する URL の設定が必要です）' : ''}</small>
        </div>
        <label className={styles.field}>
          <span>Google アナリティクス</span>
          <input
            className={styles.wide}
            value={ga}
            placeholder="G-XXXXXXXXXX（測定 ID）"
            onChange={(e) => {
              const v = e.target.value.trim().toUpperCase();
              setGa(v);
              if (!v || GA_ID_RE.test(v)) setSite({ analytics: v || undefined }, false);
            }}
            onBlur={commit}
          />
          {gaOk
            ? <small>測定 ID を入れると、書き出したページにアクセス解析のタグを入れます（エディタのプレビューでは送りません）。必要に応じて、プライバシーポリシーにアクセス解析を使っていることを書きましょう</small>
            : <small className={styles.error}>G- で始まる測定 ID を入力してください</small>}
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={!!site.backToTop} onChange={(e) => setSite({ backToTop: e.target.checked || undefined })} />
          スクロールすると右下に「ページの先頭へ」ボタンを出す
        </label>
        <div className={styles.field}>
          <span>ページの背景色</span>
          <div className={styles.faviconRow}>
            <ColorPicker title="ページの背景色" value={site.bg} onChange={(bg) => setSite({ bg }, false)} onCommit={commit} />
            <code className={styles.colorCode} style={{ width: 'auto' }}>{site.bg}</code>
          </div>
          <small>全ページ共通の背景色。ページごとに変えるときは、要素を選ばずに右のパネルで設定します</small>
        </div>
        <div className={styles.field}>
          <span>テーマの色</span>
          <small>要素の色にテーマの色を選んでおくと、ここで色を変えたときにサイト全体の色が変わります</small>
          {site.colors.map((c) => (
            <div key={c.id} className={styles.colorRow}>
              <ColorField className={styles.colorWell} value={hexColor(c.value)} onChange={(value) => setSite({ colors: site.colors.map((x) => (x.id === c.id ? { ...x, value } : x)) }, false)} onCommit={commit} />
              <input
                className={styles.wide}
                value={c.name}
                maxLength={30}
                onChange={(e) => setSite({ colors: site.colors.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }, false)}
                onBlur={commit}
              />
              <code className={styles.colorCode}>{c.value}</code>
              <button className={styles.btn} title="この色を削除（使っている要素は今の色のままになります）" onClick={() => useEditor.getState().removeThemeColor(c.id)}>削除</button>
            </div>
          ))}
          <div>
            <button className={styles.btn} onClick={() => setSite({ colors: [...site.colors, { id: nextColorId(site.colors), name: `色${site.colors.length + 1}`, value: '#888888' }] })}>＋ 色を追加</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
