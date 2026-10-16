import { useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SHADOWS } from '../../model/animations';
import {
  MULTILINE_TYPES, NO_ALIGN_TYPES, NO_TEXT_TYPES, OPTION_TYPES, PLACEHOLDER_TYPES, TEXT_LABELS, typeLabel,
} from '../../model/elementTypes';
import { FIELD_NAME_RE, FORM_ACTION_RE, HREF_RE } from '../../parser/validate';
import { boxTag, defaultTag, FIELD_TYPES } from '../../runtime/defaults';
import { ITEM_HOVER_TYPES, navItems, navLinkKind, navText, newsItems, newsText, type NavItem, type NewsItem } from '../../runtime/styles';
import { imageSize } from '../../utils/image';
import { insertImage } from '../Shell/fileActions';
import { notFoundPage, PAGE_H_MAX, PAGE_H_MIN, pageBg, pageFile, pageTitle, slugError } from '../../model/pages';
import { pageHeight } from '../../runtime/styles';
import { themeColorId } from '../../model/theme';
import { sharedKind } from '../../model/shared';
import { currentPage, selectedElement, useEditor } from '../../store/elements';
import type { BoxHover, PageElement, ThemeColor } from '../../types/element';
import { formatBorder, parseBorder } from '../../utils/html';
import { AlignButtons } from '../common/AlignButtons';
import { ColorPicker } from '../common/ColorPicker';
import { Icon, NumberField, TextAreaField, TextField } from '../common/Fields';
import { FONT_WEIGHTS, FontSelect } from '../common/FontSelect';
import { normalizeAngle } from '../Canvas/interactions';
import { ICONS } from '../Shell/icons';
import styles from './Panels.module.css';

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}

export function NoSelection({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className={styles.noSel}>
      <div className={styles.noSelIcon}>{icon}</div>
      {children}
    </div>
  );
}

export function PropertiesPanel() {
  const el = useEditor(selectedElement);
  const count = useEditor((s) => s.selectedIds.length);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const colors = useEditor((s) => s.site.colors);
  if (count > 1) return <MultiSelection />;
  if (!el) return <PageSettings />;

  const set = (patch: Partial<PageElement>, save = false) => update(el.id, patch, save);
  const colorName = (v: string) => colorLabel(v, colors);
  const border = parseBorder(el.border);
  const setBorder = (patch: Partial<typeof border>, save = false) => set({ border: formatBorder({ ...border, ...patch }) }, save);
  const num = (key: 'x' | 'y' | 'w' | 'h', min: number) => (
    <>
      <NumberField className={styles.input} value={el[key]} min={min} disabled={el.locked} onChange={(v) => set({ [key]: Math.round(v) })} onCommit={commit} />
      <span className={styles.unit}>px</span>
    </>
  );

  return (
    <>
      <div className={styles.badge}>{typeLabel(el)}{el.locked ? '（ロック中）' : ''}</div>
      <ElementTools el={el} />
      <div className={styles.section}>
        <div className={styles.title}>位置とサイズ</div>
        <Row label="X">{num('x', 0)}</Row>
        <Row label="Y">{num('y', 0)}</Row>
        <Row label="幅">{num('w', 20)}</Row>
        <Row label="高さ">{num('h', 10)}</Row>
        <Row label="回転">
          <NumberField className={styles.input} value={el.rotate} min={-360} max={360} disabled={el.locked} onChange={(v) => set({ rotate: Math.round(v) })} onCommit={commit} />
          <span className={styles.unit}>°</span>
        </Row>
      </div>

      {el.type === 'image' && <ImageSection el={el} />}

      {FIELD_TYPES.includes(el.type) && <FieldSection el={el} />}

      {el.type === 'nav' ? <NavSection el={el} /> : el.type === 'news' ? <NewsSection el={el} /> : <LinkSection el={el} />}

      {!NO_HOVER_TYPES.includes(el.type) && <HoverSection el={el} />}

      <SharedSection ids={[el.id]} />

      <div className={styles.section}>
        <div className={styles.title}>スタイル</div>
        <Row label="塗り">
          <ColorPicker title="塗り" transparent value={el.bg} onChange={(bg) => set({ bg })} onCommit={commit} />
          <span className={styles.colorName}>{colorName(el.bg)}</span>
        </Row>
        <Row label={el.type === 'arrowLine' ? '線' : el.type === 'table' ? '罫線' : 'ボーダー'}>
          <ColorPicker title="線の色" value={border.color} onChange={(color) => setBorder({ color, width: border.width || 1 })} onCommit={commit} />
          <NumberField className={`${styles.input} ${styles.narrow}`} value={border.width} min={0} max={20} step={0.5} onChange={(width) => setBorder({ width })} onCommit={commit} />
          <span className={styles.unit}>px</span>
        </Row>
        <Row label="線種">
          <select className={styles.input} value={border.style} onChange={(e) => setBorder({ style: e.target.value, width: border.width || 1 }, true)}>
            <option value="solid">実線</option>
            <option value="dashed">破線</option>
            <option value="dotted">点線</option>
            <option value="double">二重線</option>
          </select>
        </Row>
        <Row label="角丸">
          <NumberField className={styles.input} value={parseInt(el.borderRadius) || 0} min={0} onChange={(v) => set({ borderRadius: el.borderRadius.endsWith('%') ? `${v}%` : `${v}px` })} onCommit={commit} />
          <span className={styles.unit}>{el.borderRadius.endsWith('%') ? '%' : 'px'}</span>
        </Row>
        <Row label="透明度">
          <NumberField className={styles.input} value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} onCommit={commit} />
          <span className={styles.unit}>%</span>
        </Row>
        <Row label="影">
          <select className={styles.input} value={el.boxShadow} onChange={(e) => set({ boxShadow: e.target.value }, true)}>
            {SHADOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {!SHADOWS.some(([v]) => v === el.boxShadow) && <option value={el.boxShadow}>カスタム</option>}
          </select>
        </Row>
      </div>

      <div className={styles.section}>
        <div className={styles.title}>テキスト</div>
        {!NO_TEXT_TYPES.includes(el.type) && el.type !== 'table' && (
          <>
            <Row label={TEXT_LABELS[el.type] ?? '内容'}>
              {MULTILINE_TYPES.includes(el.type)
                ? <TextAreaField className={`${styles.input} ${styles.area} ${styles.prose}`} value={el.text} rows={Math.min(6, el.text.split('\n').length + 1)} onChange={(text) => set({ text })} onCommit={commit} />
                : <TextField className={styles.input} value={el.text} onChange={(text) => set({ text })} onCommit={commit} />}
            </Row>
            {OPTION_TYPES.includes(el.type) && <div className={styles.hint}>カンマ区切りで入力</div>}
          </>
        )}
        {el.type === 'table' && <TableSection el={el} />}
        {PLACEHOLDER_TYPES.includes(el.type) && (
          <Row label="プレースホルダー">
            <TextField className={styles.input} value={el.placeholder} onChange={(placeholder) => set({ placeholder })} onCommit={commit} />
          </Row>
        )}
        {el.type !== 'arrowLine' && <Row label={el.type === 'divider' ? '線色' : '文字色'}>
          <ColorPicker title="文字色" value={el.color} onChange={(color) => set({ color })} onCommit={commit} />
          <span className={styles.colorName}>{colorName(el.color)}</span>
        </Row>}
        {!NO_ALIGN_TYPES.includes(el.type) && (
          <Row label="揃え">
            <select className={styles.input} value={el.textAlign} onChange={(e) => set({ textAlign: e.target.value }, true)}>
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </Row>
        )}
        {!NO_FONT_TYPES.includes(el.type) && <Typography el={el} />}
      </div>
    </>
  );
}

const NO_FONT_TYPES: PageElement['type'][] = ['divider', 'arrowLine', 'image'];

const TAG_LABELS: [string, string][] = [
  ['h1', '見出し1（ページの題名）'], ['h2', '見出し2'], ['h3', '見出し3'], ['h4', '見出し4'], ['h5', '見出し5'], ['h6', '見出し6'],
  ['p', '段落'], ['div', '指定なし'],
];

// フォント・太さ・サイズ・行間・字間と、テキストの HTML タグ（見出しの階層）
function Typography({ el }: { el: PageElement }) {
  const { update, commit } = useEditor.getState();
  const set = (patch: Partial<PageElement>, save = false) => update(el.id, patch, save);
  const weight = el.fontWeight === '400' ? 'normal' : el.fontWeight === '700' ? 'bold' : el.fontWeight;
  return (
    <>
      <Row label="フォント">
        <FontSelect className={styles.input} value={el.fontFamily} onChange={(fontFamily) => set({ fontFamily }, true)} />
      </Row>
      <Row label="太さ">
        <select className={styles.input} value={weight} onChange={(e) => set({ fontWeight: e.target.value }, true)}>
          {FONT_WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {!FONT_WEIGHTS.some(([v]) => v === weight) && <option value={weight}>{weight}</option>}
        </select>
      </Row>
      <Row label="サイズ">
        <NumberField className={styles.input} value={parseFloat(el.fontSize) || 16} min={6} max={400} onChange={(v) => set({ fontSize: `${v}px` })} onCommit={commit} />
        <span className={styles.unit}>px</span>
      </Row>
      <Row label="行間">
        <NumberField
          className={styles.input}
          value={el.lineHeight === 'normal' ? 1.2 : parseFloat(el.lineHeight) || 1.2}
          min={0.8}
          max={4}
          step={0.1}
          title="文字の大きさに対する倍率。本文は 1.6〜2 が読みやすい"
          onChange={(v) => set({ lineHeight: String(Math.round(v * 100) / 100) })}
          onCommit={commit}
        />
        <span className={styles.unit}>倍</span>
      </Row>
      <Row label="字間">
        <NumberField
          className={styles.input}
          value={el.letterSpacing === 'normal' ? 0 : Math.round((parseFloat(el.letterSpacing) || 0) * 1000) / 10}
          min={-20}
          max={100}
          step={1}
          title="文字の大きさに対する割合（%）"
          onChange={(v) => set({ letterSpacing: v === 0 ? 'normal' : `${Math.round(v * 10) / 1000}em` })}
          onCommit={commit}
        />
        <span className={styles.unit}>%</span>
      </Row>
      {(el.type === 'text' || el.type === 'heading') && (
        <>
          <Row label="HTML">
            <select className={styles.input} value={boxTag(el)} onChange={(e) => set({ tag: e.target.value === defaultTag(el.type) ? '' : e.target.value }, true)}>
              {TAG_LABELS.map(([v, l]) => <option key={v} value={v}>{l}{v === defaultTag(el.type) ? '（既定）' : ''}</option>)}
            </select>
          </Row>
          <div className={styles.hint}>見出し1はページに1つだけにすると、検索エンジンに伝わりやすくなります</div>
        </>
      )}
    </>
  );
}

// 色の表示名（テーマの色はその名前）
function colorLabel(v: string, colors: ThemeColor[]): string {
  if (v === 'transparent') return 'なし';
  const id = themeColorId(v);
  return id ? colors.find((c) => c.id === id)?.name ?? v : v;
}

// 要素を選んでいないとき：編集中のページの設定（名前・ファイル名・検索結果に出るタイトルと説明文）
function PageSettings() {
  const page = useEditor(currentPage);
  const pages = useEditor((s) => s.pages);
  const site = useEditor((s) => s.site);
  const { updatePage, renamePage, commit, openSetup } = useEditor.getState();
  const [slug, setSlug] = useState(page.slug ?? '');
  useEffect(() => setSlug(page.slug ?? ''), [page.id, page.slug]);
  const [name, setName] = useState(page.name);
  useEffect(() => setName(page.name), [page.id, page.name]);
  const first = pages[0].id === page.id;
  const notFound = notFoundPage(pages, site)?.id === page.id;
  const error = slugError(pages, page.id, slug);
  const desc = page.description ?? '';
  const hasFields = page.elements.some((e) => FIELD_TYPES.includes(e.type) || e.submit);
  const screenH = useEditor((s) => s.screen.h);
  const shown = useEditor((s) => s.elements);
  const pcView = useEditor((s) => s.device === 'pc');
  const length = pageHeight(shown, page.h ?? screenH);
  return (
    <>
      <div className={styles.badge}>ページ</div>
      <div className={styles.section}>
        <div className={styles.title}>ページの設定</div>
        <Row label="名前">
          <TextField className={styles.input} value={name} onChange={setName} onCommit={() => (name.trim() ? renamePage(page.id, name) : setName(page.name))} />
        </Row>
        <Row label="ファイル名">
          {first ? (
            <span className={styles.static}>index.html（最初のページ）</span>
          ) : notFound ? (
            <span className={styles.static}>404.html（見つからないとき）</span>
          ) : (
            <>
              <TextField
                className={styles.input}
                value={slug}
                placeholder={page.id}
                onChange={(v) => {
                  const next = v.toLowerCase();
                  setSlug(next);
                  if (!slugError(pages, page.id, next)) updatePage(page.id, { slug: next || undefined }, false);
                }}
                onCommit={commit}
              />
              <span className={styles.unit}>.html</span>
            </>
          )}
        </Row>
        {error && <div className={styles.hint} style={{ color: 'var(--danger)' }}>{error}</div>}
        {!first && !error && !notFound && <div className={styles.hint}>静的サイトとして書き出したときの URL（例：about → about.html）</div>}
        {!first && (
          <Row label="">
            <label className={styles.check}>
              <input type="checkbox" checked={notFound} onChange={(e) => useEditor.getState().setSite({ notFound: e.target.checked ? page.id : undefined })} />
              ページが見つからないときに表示する
            </label>
          </Row>
        )}
        {notFound && <div className={styles.hint}>存在しない URL を開いたときに表示する「404 ページ」です。検索結果には出しません</div>}
        <Row label="背景色">
          <ColorPicker title="ページの背景色" value={pageBg(page, site)} onChange={(bg) => updatePage(page.id, { bg }, false)} onCommit={commit} />
          <span className={styles.colorName}>{page.bg ? colorLabel(page.bg, site.colors) : `サイト共通（${colorLabel(site.bg, site.colors)}）`}</span>
          {page.bg && <button className={styles.linkBtn} onClick={() => updatePage(page.id, { bg: undefined })} title="サイト共通の背景色に戻す">戻す</button>}
        </Row>
        {pcView && (<>
        <Row label="長さ">
          <NumberField
            className={styles.input}
            value={length}
            min={PAGE_H_MIN}
            max={PAGE_H_MAX}
            onChange={(v) => updatePage(page.id, { h: Math.round(v) === screenH ? undefined : Math.round(v) }, false)}
            onCommit={commit}
          />
          <span className={styles.unit}>px</span>
          {page.h && <button className={styles.linkBtn} onClick={() => updatePage(page.id, { h: undefined })} title="最初に見える範囲の高さに戻す">戻す</button>}
        </Row>
        <div className={styles.hint}>PC で表示したときのページの長さ（スクロールする範囲）。キャンバスの下端をドラッグしても変えられます。要素がはみ出すと、その下端まで伸びます</div>
        </>)}
      </div>
      {hasFields && <FormSettings />}
      <div className={styles.section}>
        <div className={styles.title}>検索結果・SNS での表示</div>
        <Row label="タイトル">
          <TextField className={styles.input} value={page.title ?? ''} placeholder={page.name} onChange={(title) => updatePage(page.id, { title: title || undefined }, false)} onCommit={commit} />
        </Row>
        <Row label="説明文">
          <TextAreaField
            className={`${styles.input} ${styles.area} ${styles.prose}`}
            value={desc}
            rows={4}
            onChange={(description) => updatePage(page.id, { description: description.replace(/\n/g, ' ') || undefined }, false)}
            onCommit={commit}
          />
        </Row>
        <div className={styles.hint}>{desc.length}文字（検索結果には 120 文字くらいまで表示されます）</div>
        <div className={styles.serp} title="検索結果での表示の例">
          <div className={styles.serpTitle}>{pageTitle(page, site)}</div>
          <div className={styles.serpUrl}>{pageFile(pages, page, site)}</div>
          <div className={styles.serpDesc}>{desc || 'ページの説明文がここに表示されます。'}</div>
        </div>
      </div>
      <div className={styles.buttons}>
        <button className={styles.btnGhost} onClick={() => openSetup('site')}>サイトの設定…</button>
      </div>
      <details className={styles.tips}>
        <summary>操作のヒント</summary>
        <div>要素をクリックすると、その要素の設定を表示します</div>
        <div>Shift + クリック／ドラッグで囲む … 複数選択</div>
        <div>Shift + ドラッグ … 水平・垂直に移動／縦横比を保つ</div>
        <div>Ctrl + ドラッグ … コピーしながら移動</div>
        <div>Ctrl + G … グループ化</div>
        <div>Alt を押しながらドラッグ … 吸着しない</div>
        <div>Space + ドラッグ … 表示位置を移動</div>
        <div>Ctrl + ホイール … 拡大・縮小</div>
      </details>
    </>
  );
}

// ページのフォームの送信先（Formspree などのフォーム送信サービスの URL）
function FormSettings() {
  const page = useEditor(currentPage);
  const { updatePage, commit } = useEditor.getState();
  const [text, setText] = useState(page.form ?? '');
  useEffect(() => setText(page.form ?? ''), [page.id, page.form]);
  const valid = !text.trim() || FORM_ACTION_RE.test(text.trim());
  const unnamed = page.elements.filter((e) => FIELD_TYPES.includes(e.type) && !e.name).length;
  return (
    <div className={styles.section}>
      <div className={styles.title}>フォーム</div>
      <Row label="送信先">
        <TextField
          className={styles.input}
          value={text}
          placeholder="https://formspree.io/f/xxxx"
          onChange={(v) => {
            setText(v);
            const t = v.trim();
            if (!t || FORM_ACTION_RE.test(t)) updatePage(page.id, { form: t || undefined }, false);
          }}
          onCommit={commit}
        />
      </Row>
      {valid
        ? <div className={styles.hint}>送信ボタンを押すと、入力欄の内容をこの URL へ送ります。Formspree などのフォーム送信サービスで発行された URL を入れてください（https のみ）</div>
        : <div className={styles.hint} style={{ color: 'var(--danger)' }}>https:// で始まる URL を入力してください</div>}
      {unnamed > 0 && <div className={styles.hint}>項目名のない入力欄が {unnamed} 個あります（送信されません）</div>}
    </div>
  );
}

// 画像：ファイルから選ぶ・差し替える、元の縦横比に戻す
function ImageSection({ el }: { el: PageElement }) {
  const asset = useEditor((s) => s.assets[el.src]);
  const fixRatio = async () => {
    const { w, h } = await imageSize(asset ?? el.src);
    useEditor.getState().update(el.id, { h: Math.max(10, Math.round((el.w * h) / w)) }, true);
  };
  return (
    <div className={styles.section}>
      <div className={styles.title}>画像</div>
      <div className={styles.buttons} style={{ marginTop: 0 }}>
        <button className={styles.btnPrimary} disabled={el.locked} onClick={() => insertImage(el.id)}>{el.src ? '画像を変更…' : '画像を選ぶ…'}</button>
        <button className={styles.btnGhost} disabled={!el.src || el.locked} onClick={() => void fixRatio()} title="幅はそのままで、高さを画像の縦横比に合わせる">元の縦横比</button>
      </div>
      {el.src && <div className={styles.hint} style={{ marginLeft: 0, marginTop: 6 }}>角をドラッグすると縦横比を保ったまま拡大・縮小します（Shift で自由に変形）</div>}
      <Row label="代替テキスト">
        <TextField
          className={styles.input}
          value={el.alt}
          placeholder="例：店舗の外観"
          onChange={(alt) => useEditor.getState().update(el.id, { alt })}
          onCommit={useEditor.getState().commit}
        />
      </Row>
      <div className={styles.hint}>画像の内容を短い文で。読み上げや検索エンジンが使います（飾りの画像は空のまま）</div>
    </div>
  );
}

// 表：1行が表の1行、カンマでセルを区切る。行・列の追加
function TableSection({ el }: { el: PageElement }) {
  const { update, commit } = useEditor.getState();
  const rows = el.text.split('\n');
  const cols = Math.max(1, ...rows.map((r) => r.split(',').length));
  const set = (text: string) => update(el.id, { text }, true);
  return (
    <>
      <Row label="セル">
        <TextAreaField className={`${styles.input} ${styles.area}`} value={el.text} rows={Math.min(8, rows.length + 1)} onChange={(text) => update(el.id, { text })} onCommit={commit} />
      </Row>
      <div className={styles.hint}>1行が表の1行。カンマでセルを区切ります（先頭の行は見出し）</div>
      <div className={styles.buttons} style={{ marginTop: 0, marginBottom: 8, marginLeft: 62 }}>
        <button className={styles.btnGhost} onClick={() => set([...rows, Array(cols).fill('').join(',')].join('\n'))}>＋ 行</button>
        <button className={styles.btnGhost} onClick={() => set(rows.map((r) => `${r},`).join('\n'))}>＋ 列</button>
        <button className={styles.btnGhost} disabled={rows.length <= 1} onClick={() => set(rows.slice(0, -1).join('\n'))}>− 行</button>
      </div>
    </>
  );
}

type LinkKind = 'none' | 'page' | 'anchor' | 'url' | 'mail' | 'tel' | 'submit';

const LINK_KINDS: [LinkKind, string][] = [
  ['none', 'なし'], ['page', 'このサイトのページ'], ['anchor', 'このページ内の位置'], ['url', 'Web サイト（URL）'], ['mail', 'メール'], ['tel', '電話'],
];

function linkKind(el: PageElement): LinkKind {
  if (el.submit) return 'submit';
  if (el.to) return 'page';
  if (el.href.startsWith('#')) return 'anchor';
  if (el.href.startsWith('mailto:')) return 'mail';
  if (el.href.startsWith('tel:')) return 'tel';
  return el.href ? 'url' : 'none';
}

// URL の入力欄に出す値と、入力から作る href
const LINK_INPUT: Record<'url' | 'mail' | 'tel', { prefix: string; placeholder: string; label: string; make(v: string): string }> = {
  url: { prefix: '', placeholder: 'https://example.com', label: 'URL', make: (v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v) },
  mail: { prefix: 'mailto:', placeholder: 'info@example.com', label: 'アドレス', make: (v) => (v ? `mailto:${v}` : '') },
  tel: { prefix: 'tel:', placeholder: '03-1234-5678', label: '電話番号', make: (v) => (v ? `tel:${v}` : '') },
};

// リンク（クリックで別のページ・Web サイトへ移動、メール・電話）
function LinkSection({ el }: { el: PageElement }) {
  const [kind, setKind] = useState<LinkKind>(() => linkKind(el));
  // 別の要素を選んだら、その要素のリンクの種類にする。入力途中（まだ URL が空）の種類は保つ
  const current = linkKind(el);
  useEffect(() => setKind(linkKind(el)), [el.id]);
  useEffect(() => {
    if (current !== 'none') setKind(current);
  }, [current]);
  const { update } = useEditor.getState();
  return (
    <div className={styles.section}>
      <div className={styles.title}>リンク（クリックで移動）</div>
      <Row label="移動先">
        <select
          className={styles.input}
          value={kind}
          onChange={(e) => {
            const k = e.target.value as LinkKind;
            setKind(k);
            if (k === 'submit') update(el.id, { to: '', href: '', newTab: false, submit: true }, true);
            else if (k === 'none') update(el.id, { to: '', href: '', newTab: false, submit: false }, true);
            else if (el.submit) update(el.id, { submit: false }, true);
            else if (k !== 'page' && el.to) update(el.id, { to: '' }, true);
            else if (k === 'page' && el.href) update(el.id, { href: '', newTab: false }, true);
            else if (el.href && (k === 'anchor') !== el.href.startsWith('#')) update(el.id, { href: '', newTab: false }, true);
          }}
        >
          {LINK_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          {el.type === 'button' && <option value="submit">フォームを送信</option>}
        </select>
      </Row>
      {kind === 'submit' && <SubmitInfo />}
      {kind === 'page' && <PageLink el={el} />}
      {kind === 'anchor' && <AnchorLink el={el} />}
      {(kind === 'url' || kind === 'mail' || kind === 'tel') && <UrlLink key={`${el.id}-${kind}`} el={el} kind={kind} />}
    </div>
  );
}

function PageLink({ el }: { el: PageElement }) {
  const pages = useEditor((s) => s.pages);
  const pageId = useEditor((s) => s.pageId);
  const { update, addPage, setPage } = useEditor.getState();
  const target = pages.find((p) => p.id === el.to);
  const NEW = '__new__';
  return (
    <>
      <Row label="ページ">
        <select
          className={styles.input}
          value={el.to}
          onChange={(e) => {
            // 新しいページを作ってリンクする（編集中のページはそのまま）
            update(el.id, { to: e.target.value === NEW ? addPage(false) : e.target.value, href: '', newTab: false }, true);
          }}
        >
          <option value="">（選んでください）</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === pageId}>{p.name}{p.id === pageId ? '（このページ）' : ''}</option>
          ))}
          {el.to && !target && <option value={el.to}>（存在しないページ: {el.to}）</option>}
          <option value={NEW}>＋ 新しいページを作ってリンク</option>
        </select>
      </Row>
      {target && (
        <button className={styles.linkJump} onClick={() => setPage(target.id)} title="リンク先のページを開く">
          「{target.name}」を開く →
        </button>
      )}
    </>
  );
}

// 送信ボタン：ページのフォームの送信先の設定の案内
function SubmitInfo() {
  const action = useEditor((s) => currentPage(s).form);
  const { select } = useEditor.getState();
  return (
    <div className={styles.hint} style={action ? undefined : { color: 'var(--danger)' }}>
      {action ? `入力欄（名前のあるもの）の内容を ${action.replace(/^https:\/\//, '')} へ送ります` : '送信先が未設定です。'}
      {!action && <button className={styles.linkBtn} onClick={() => select(null)}>ページの設定で設定する</button>}
    </div>
  );
}

const INPUT_TYPE_LABELS: [string, string][] = [['text', 'テキスト'], ['email', 'メールアドレス'], ['tel', '電話番号'], ['number', '数字']];

// 入力欄：フォームで送るときの項目名・種類・必須
function FieldSection({ el }: { el: PageElement }) {
  const { update, commit } = useEditor.getState();
  const hasForm = useEditor((s) => !!currentPage(s).form);
  const [name, setName] = useState(el.name);
  useEffect(() => setName(el.name), [el.id, el.name]);
  const valid = !name || FIELD_NAME_RE.test(name);
  return (
    <div className={styles.section}>
      <div className={styles.title}>フォーム</div>
      <Row label="項目名">
        <TextField
          className={styles.input}
          value={name}
          placeholder="例：email"
          onChange={(v) => {
            setName(v);
            if (!v || FIELD_NAME_RE.test(v)) update(el.id, { name: v });
          }}
          onCommit={commit}
        />
      </Row>
      {valid
        ? <div className={styles.hint}>{name ? (hasForm ? '送信するときの項目名です' : '送信先は、要素を選ばずに右のパネル（ページの設定）で設定します') : '項目名を付けると、フォームで送信します'}</div>
        : <div className={styles.hint} style={{ color: 'var(--danger)' }}>英数字・_・- で入力してください</div>}
      {el.type === 'input' && (
        <Row label="種類">
          <select className={styles.input} value={el.inputType || 'text'} onChange={(e) => update(el.id, { inputType: e.target.value }, true)}>
            {INPUT_TYPE_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
      )}
      {el.type !== 'slider' && (
        <Row label="">
          <label className={styles.check}>
            <input type="checkbox" checked={el.required} onChange={(e) => update(el.id, { required: e.target.checked }, true)} />
            必須（入力しないと送信できない）
          </label>
        </Row>
      )}
    </div>
  );
}

// ページ内の位置：見出しなどの要素の位置か、ページの先頭へスクロールする
function AnchorLink({ el }: { el: PageElement }) {
  const elements = useEditor((s) => s.elements);
  const { update, select } = useEditor.getState();
  const label = (e: PageElement) => `${typeLabel(e)}${e.text ? `「${e.text.split('\n')[0].slice(0, 18)}」` : ''}`;
  const others = elements.filter((e) => e.id !== el.id && !e.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  const headings = others.filter((e) => e.type === 'heading');
  const rest = others.filter((e) => e.type !== 'heading');
  const id = el.href.slice(1);
  const target = elements.find((e) => e.id === id);
  return (
    <>
      <Row label="位置">
        <select className={styles.input} value={el.href} onChange={(e) => update(el.id, { href: e.target.value, to: '', newTab: false }, true)}>
          <option value="">（選んでください）</option>
          <option value="#top">ページの先頭</option>
          {headings.length > 0 && <optgroup label="見出し">{headings.map((e) => <option key={e.id} value={`#${e.id}`}>{label(e)}</option>)}</optgroup>}
          <optgroup label="ほかの要素">{rest.map((e) => <option key={e.id} value={`#${e.id}`}>{label(e)}</option>)}</optgroup>
          {id && id !== 'top' && !target && <option value={el.href}>（ない要素: {id}）</option>}
        </select>
      </Row>
      {target && (
        <button className={styles.linkJump} onClick={() => select(target.id, { only: true })} title="移動先の要素を選ぶ">
          移動先を選ぶ →
        </button>
      )}
      <div className={styles.hint}>クリックすると、その要素がある位置までスクロールします</div>
    </>
  );
}

// URL・メールアドレス・電話番号。正しい形のときだけ要素に設定する
function UrlLink({ el, kind }: { el: PageElement; kind: 'url' | 'mail' | 'tel' }) {
  const info = LINK_INPUT[kind];
  const [text, setText] = useState(el.href.startsWith(info.prefix) ? el.href.slice(info.prefix.length) : '');
  const href = info.make(text.trim());
  const valid = !href || HREF_RE.test(href);
  const { update, commit } = useEditor.getState();
  return (
    <>
      <Row label={info.label}>
        <TextField
          className={styles.input}
          value={text}
          placeholder={info.placeholder}
          onChange={(v) => {
            setText(v);
            const h = info.make(v.trim());
            if (!h || HREF_RE.test(h)) update(el.id, { href: h, to: '' });
          }}
          onCommit={commit}
        />
      </Row>
      {!valid && <div className={styles.hint} style={{ color: 'var(--danger)' }}>{kind === 'url' ? 'URL の形が正しくありません' : kind === 'mail' ? 'メールアドレスの形が正しくありません' : '数字・+・-・( ) で入力してください'}</div>}
      {kind === 'url' && (
        <Row label="">
          <label className={styles.check}>
            <input type="checkbox" checked={el.newTab} disabled={!el.href} onChange={(e) => update(el.id, { newTab: e.target.checked }, true)} />
            新しいタブで開く
          </label>
        </Row>
      )}
    </>
  );
}

const NO_HOVER_TYPES: PageElement['type'][] = ['input', 'textarea', 'checkbox', 'radio', 'select', 'slider', 'divider', 'arrowLine'];

// 入力中の値を持つ入力欄。正しい値のときだけ保存し、確定したときに正しくなければ元の値に戻す
function DraftField({ value, valid, clean = (v) => v, onSave }: { value: string; valid(v: string): boolean; clean?(v: string): string; onSave(v: string): void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextField
      className={styles.input}
      value={text}
      onChange={(v) => {
        const c = clean(v);
        setText(c);
        if (valid(c)) onSave(c);
      }}
      onCommit={() => {
        if (!valid(text)) setText(value);
        useEditor.getState().commit();
      }}
    />
  );
}

// 項目のリンク先（このサイトのページ・このページ内の位置・URL）。メニュー・お知らせ一覧で使う
function ItemLinkFields({ link, onChange }: { link: string; onChange(link: string, done: boolean): void }) {
  const pages = useEditor((s) => s.pages);
  const elements = useEditor((s) => s.elements);
  const headings = elements.filter((e) => e.type === 'heading' && !e.hidden).sort((a, b) => a.y - b.y);
  const kind = navLinkKind(link);
  const URL = '__url__';
  return (
    <>
      <div className={styles.row}>
        <span className={styles.label}>リンク先</span>
        <select className={styles.input} value={kind === 'url' ? URL : link} onChange={(e) => onChange(e.target.value === URL ? 'https://' : e.target.value, true)}>
          <option value="">なし</option>
          <optgroup label="このサイトのページ">
            {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
          <optgroup label="このページ内の位置">
            <option value="#top">ページの先頭</option>
            {headings.map((h) => <option key={h.id} value={`#${h.id}`}>{h.text.split('\n')[0].slice(0, 20) || h.id}</option>)}
          </optgroup>
          {kind === 'anchor' && link !== '#top' && !headings.some((h) => `#${h.id}` === link) && <option value={link}>{link}</option>}
          {kind === 'page' && !pages.some((p) => p.id === link) && <option value={link}>（ないページ: {link}）</option>}
          <option value={URL}>Web サイト（URL）…</option>
        </select>
      </div>
      {kind === 'url' && (
        <div className={styles.row}>
          <span className={styles.label}>URL</span>
          <DraftField value={link} valid={(v) => HREF_RE.test(v.trim())} onSave={(v) => onChange(v.trim(), false)} />
        </div>
      )}
    </>
  );
}

// 項目の並べ替え・削除のボタン
function ItemButtons<T>({ items, i, save }: { items: T[]; i: number; save(next: T[]): void }) {
  return (
    <>
      <button className={styles.iconBtn} disabled={i === 0} title="上へ" onClick={() => save(items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)))}>↑</button>
      <button className={styles.iconBtn} disabled={items.length <= 1} title="この項目を削除" onClick={() => save(items.filter((_, j) => j !== i))}>×</button>
    </>
  );
}

const noBar = (v: string) => v.replace(/[|\n]/g, '');

// メニューの項目：ラベルとリンク先（ページ・ページ内の位置・URL）。スマホでは ☰ ボタンで開く
function NavSection({ el }: { el: PageElement }) {
  const { update } = useEditor.getState();
  const items = navItems(el.text);
  const save = (next: NavItem[], done = true) => update(el.id, { text: navText(next) }, done);
  const setItem = (i: number, patch: Partial<NavItem>, done = true) => save(items.map((it, j) => (j === i ? { ...it, ...patch } : it)), done);
  return (
    <div className={styles.section}>
      <div className={styles.title}>メニューの項目</div>
      {items.map((it, i) => (
        <div key={i} className={styles.navItem}>
          <div className={styles.row}>
            <DraftField value={it.label} valid={(v) => !!v.trim()} clean={noBar} onSave={(label) => setItem(i, { label: label.trim() }, false)} />
            <ItemButtons items={items} i={i} save={save} />
          </div>
          <ItemLinkFields link={it.link} onChange={(link, done) => setItem(i, { link }, done)} />
        </div>
      ))}
      <div className={styles.buttons} style={{ marginTop: 4 }}>
        <button className={styles.btnGhost} onClick={() => save([...items, { label: `項目${items.length + 1}`, link: '' }])}>＋ 項目を追加</button>
      </div>
      <div className={styles.hint} style={{ marginLeft: 0, marginTop: 6 }}>
        スマホの画面では ☰ ボタンになり、押すと画面いっぱいにメニューを開きます。塗りの色がメニューの背景になります。表示中のページの項目には下線が付きます
      </div>
    </div>
  );
}

// 今日の日付（2026.10.14）
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// お知らせ一覧：1件ずつ日付・タイトル・リンク先。新しいお知らせは先頭に足す
function NewsSection({ el }: { el: PageElement }) {
  const { update } = useEditor.getState();
  const items = newsItems(el.text);
  const save = (next: NewsItem[], done = true) => update(el.id, { text: newsText(next) }, done);
  const setItem = (i: number, patch: Partial<NewsItem>, done = true) => save(items.map((it, j) => (j === i ? { ...it, ...patch } : it)), done);
  return (
    <div className={styles.section}>
      <div className={styles.title}>お知らせ</div>
      <div className={styles.buttons} style={{ marginTop: 0, marginBottom: 6 }}>
        <button className={styles.btnGhost} onClick={() => save([{ date: today(), title: '新しいお知らせ', link: '' }, ...items])}>＋ お知らせを追加（先頭）</button>
      </div>
      {items.map((it, i) => (
        <div key={i} className={styles.navItem}>
          <div className={styles.row}>
            <DraftField value={it.title} valid={(v) => !!v.trim()} clean={noBar} onSave={(title) => setItem(i, { title: title.trim() }, false)} />
            <ItemButtons items={items} i={i} save={save} />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>日付</span>
            <DraftField value={it.date} valid={() => true} clean={noBar} onSave={(date) => setItem(i, { date: date.trim() }, false)} />
          </div>
          <ItemLinkFields link={it.link} onChange={(link, done) => setItem(i, { link }, done)} />
        </div>
      ))}
      <div className={styles.hint} style={{ marginLeft: 0, marginTop: 6 }}>
        リンク先を設定したお知らせは、クリックでそのページを開きます。スマホの画面では日付の下にタイトルを表示します
      </div>
    </div>
  );
}

// よく使う組み合わせ
const HOVER_PRESETS: [string, BoxHover][] = [
  ['浮き上がる', { y: -4, shadow: '0 12px 32px rgba(0,0,0,.18)' }],
  ['少し拡大', { scale: 1.05 }],
  ['下線', { underline: true }],
];

// マウスを乗せたときの見た目。設定している間は、キャンバスでもその見た目で表示する
function HoverSection({ el }: { el: PageElement }) {
  const colors = useEditor((s) => s.site.colors);
  const { update, commit, setHoverPreview } = useEditor.getState();
  const h = el.hover ?? {};
  // 値が undefined のキーは消す（何も変えないなら hover ごと外す）
  const set = (patch: BoxHover, save = false) => {
    const next = Object.fromEntries(Object.entries({ ...h, ...patch }).filter(([, v]) => v !== undefined)) as BoxHover;
    update(el.id, { hover: Object.keys(next).length ? next : undefined }, save);
  };
  const reset = (key: keyof BoxHover) => h[key] !== undefined && (
    <button className={styles.linkBtn} onClick={() => set({ [key]: undefined }, true)} title="変えないようにする">戻す</button>
  );
  useEffect(() => () => setHoverPreview(null), [setHoverPreview]);
  if (ITEM_HOVER_TYPES.includes(el.type)) {
    // メニュー・お知らせ一覧は項目ごと：文字色と下線
    return (
      <div className={styles.section} onMouseEnter={() => setHoverPreview(el.id)} onMouseLeave={() => setHoverPreview(null)}>
        <div className={styles.title}>マウスを乗せたとき（項目ごと）</div>
        <div className={styles.chips}>
          <button className={styles.chip} onClick={() => set({ color: 'var(--c1)' }, true)}>色を変える</button>
          <button className={styles.chip} onClick={() => set({ underline: true }, true)}>下線</button>
          {el.hover && <button className={styles.chip} onClick={() => update(el.id, { hover: undefined }, true)}>なし</button>}
        </div>
        <Row label="文字色">
          <ColorPicker title="マウスを乗せたときの文字色" value={h.color ?? el.color} onChange={(color) => set({ color })} onCommit={commit} />
          <span className={styles.colorName}>{h.color ? colorLabel(h.color, colors) : '変えない'}</span>
          {reset('color')}
        </Row>
        <Row label="">
          <label className={styles.check}>
            <input type="checkbox" checked={!!h.underline} onChange={(e) => set({ underline: e.target.checked || undefined }, true)} />
            下線を引く
          </label>
        </Row>
        <div className={styles.hint}>ここにマウスを乗せている間、キャンバスでは{el.type === 'nav' ? '最初の項目' : 'リンクのある最初のお知らせ'}をその見た目で表示します</div>
      </div>
    );
  }
  return (
    <div className={styles.section} onMouseEnter={() => setHoverPreview(el.id)} onMouseLeave={() => setHoverPreview(null)}>
      <div className={styles.title}>マウスを乗せたとき</div>
      <div className={styles.chips}>
        {HOVER_PRESETS.map(([label, preset]) => (
          <button key={label} className={styles.chip} onClick={() => set(preset, true)}>{label}</button>
        ))}
        {el.hover && <button className={styles.chip} onClick={() => update(el.id, { hover: undefined }, true)}>なし</button>}
      </div>
      <Row label="塗り">
        <ColorPicker title="マウスを乗せたときの塗り" transparent value={h.bg ?? el.bg} onChange={(bg) => set({ bg })} onCommit={commit} />
        <span className={styles.colorName}>{h.bg ? colorLabel(h.bg, colors) : '変えない'}</span>
        {reset('bg')}
      </Row>
      <Row label="文字色">
        <ColorPicker title="マウスを乗せたときの文字色" value={h.color ?? el.color} onChange={(color) => set({ color })} onCommit={commit} />
        <span className={styles.colorName}>{h.color ? colorLabel(h.color, colors) : '変えない'}</span>
        {reset('color')}
      </Row>
      <Row label="影">
        <select className={styles.input} value={h.shadow ?? ''} onChange={(e) => set({ shadow: e.target.value || undefined }, true)}>
          <option value="">変えない</option>
          {SHADOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {h.shadow && !SHADOWS.some(([v]) => v === h.shadow) && <option value={h.shadow}>カスタム</option>}
        </select>
      </Row>
      <Row label="拡大">
        <NumberField className={styles.input} value={Math.round((h.scale ?? 1) * 100)} min={50} max={200} onChange={(v) => set({ scale: v === 100 ? undefined : v / 100 })} onCommit={commit} />
        <span className={styles.unit}>%</span>
      </Row>
      <Row label="上へ移動">
        <NumberField className={styles.input} value={-(h.y ?? 0)} min={-100} max={100} onChange={(v) => set({ y: v ? -Math.round(v) : undefined })} onCommit={commit} />
        <span className={styles.unit}>px</span>
      </Row>
      {!NO_FONT_TYPES.includes(el.type) && (
        <Row label="">
          <label className={styles.check}>
            <input type="checkbox" checked={!!h.underline} onChange={(e) => set({ underline: e.target.checked || undefined }, true)} />
            文字に下線を引く
          </label>
        </Row>
      )}
      <div className={styles.hint}>ここにマウスを乗せている間、キャンバスでもその見た目で表示します。プレビューで動きを確かめられます</div>
    </div>
  );
}

// 全ページ共通のヘッダー・フッター
function SharedSection({ ids }: { ids: string[] }) {
  const site = useEditor((s) => s.site);
  const sp = useEditor((s) => s.device === 'sp');
  const { setShared } = useEditor.getState();
  const kinds = new Set(ids.map((id) => sharedKind(site, id)));
  const kind = kinds.size === 1 ? [...kinds][0] : undefined;
  return (
    <div className={styles.section}>
      <div className={styles.title}>全ページ共通</div>
      {kind ? (
        <>
          <div className={styles.note}>全ページ共通の{kind === 'header' ? 'ヘッダー' : 'フッター'}です。ここでの変更は、すべてのページに反映されます。</div>
          {kind === 'header' && (
            <label className={styles.check} style={{ marginTop: 6 }}>
              <input type="checkbox" checked={!!site.stickyHeader} onChange={(e) => useEditor.getState().setSite({ stickyHeader: e.target.checked || undefined })} />
              スクロールしても画面の上に固定する
            </label>
          )}
          {!sp && (
            <div className={styles.buttons} style={{ marginTop: 6 }}>
              <button className={styles.btnGhost} onClick={() => setShared(null)} title="ほかのページからは消えます">このページだけの要素に戻す</button>
            </div>
          )}
        </>
      ) : sp ? (
        <div className={styles.hint} style={{ marginLeft: 0 }}>PC の表示で設定します</div>
      ) : (
        <>
          <div className={styles.buttons} style={{ marginTop: 0 }}>
            <button className={styles.btnGhost} onClick={() => setShared('header')}>ヘッダーにする</button>
            <button className={styles.btnGhost} onClick={() => setShared('footer')}>フッターにする</button>
          </div>
          <div className={styles.hint} style={{ marginLeft: 0, marginTop: 6 }}>
            すべてのページに同じものを表示します（グループごと移ります）。フッターは各ページの一番下に付きます
          </div>
        </>
      )}
    </div>
  );
}

// 複数選択中：整列と、まとめての操作
function MultiSelection() {
  const els = useEditor(useShallow((s) => s.elements.filter((e) => s.selectedIds.includes(e.id))));
  const { remove, duplicate, group, ungroup } = useEditor.getState();
  const locked = els.filter((e) => e.locked).length;
  return (
    <>
      <div className={styles.badge}>{els.length}個の要素を選択中</div>
      <div className={styles.section}>
        <div className={styles.title}>整列</div>
        <div className={styles.alignGrid}>
          <AlignButtons className={styles.alignBtn} />
        </div>
        {locked > 0 && <div className={styles.hint} style={{ marginLeft: 0 }}>ロック中の{locked}個は動きません</div>}
      </div>
      <div className={styles.section}>
        <div className={styles.title}>グループ</div>
        <div className={styles.tools}>
          <ToolButton icon={ICONS.group} title="グループ化 (Ctrl+G)" onClick={group} />
          <ToolButton icon={ICONS.ungroup} title="グループ解除 (Ctrl+Shift+G)" disabled={!els.some((e) => e.group)} onClick={ungroup} />
        </div>
      </div>
      <SharedSection ids={els.map((e) => e.id)} />
      <div className={styles.buttons}>
        <button className={styles.btnGhost} onClick={() => duplicate()}>複製</button>
        <button className={styles.btnDanger} onClick={() => remove()} disabled={locked === els.length}>削除</button>
      </div>
      <div className={styles.hint} style={{ marginLeft: 0, marginTop: 10 }}>キャンバス上でドラッグすると、まとめて移動できます。矢印キーでも動かせます。</div>
    </>
  );
}

function ToolButton({ icon, title, onClick, disabled, active, onDoubleClick }: {
  icon: string; title: string; onClick(): void; disabled?: boolean; active?: boolean; onDoubleClick?(): void;
}) {
  return (
    <button className={`${styles.tool} ${active ? styles.toolOn : ''}`} title={title} disabled={disabled} onClick={onClick} onDoubleClick={onDoubleClick}>
      <Icon path={icon} size={15} />
    </button>
  );
}

// 選んだ要素の操作：複製・削除・書式のコピー・重なり順・回転・ロック・表示と、ページに対する整列
function ElementTools({ el }: { el: PageElement }) {
  const s = useEditor.getState();
  const brush = useEditor((st) => st.brush);
  const locked = el.locked;
  const rotate = (deg: number | null) => s.update(el.id, { rotate: deg === null ? 0 : normalizeAngle(el.rotate + deg) }, true);
  return (
    <div className={styles.section}>
      <div className={styles.tools}>
        <ToolButton icon={ICONS.duplicate} title="複製 (Ctrl+D)" onClick={() => s.duplicate()} />
        <ToolButton icon={ICONS.delete} title="削除 (Delete)" disabled={locked} onClick={() => s.remove()} />
        <ToolButton
          icon={ICONS.brush}
          title="書式のコピー：次にクリックした要素に書式を貼り付け（ダブルクリックで続けて貼り付け、Esc で終了）"
          active={!!brush}
          onClick={() => (brush ? s.endBrush() : s.startBrush(false))}
          onDoubleClick={() => s.startBrush(true)}
        />
        <span className={styles.toolSep} />
        <ToolButton icon={ICONS.front} title="最前面へ" onClick={() => s.moveZ(el.id, 'front')} />
        <ToolButton icon={ICONS.forward} title="前面へ" onClick={() => s.moveZ(el.id, 'forward')} />
        <ToolButton icon={ICONS.backward} title="背面へ" onClick={() => s.moveZ(el.id, 'backward')} />
        <ToolButton icon={ICONS.back} title="最背面へ" onClick={() => s.moveZ(el.id, 'back')} />
        <ToolButton icon={ICONS.rotateRight} title="右へ 90° 回転" disabled={locked} onClick={() => rotate(90)} />
        <ToolButton icon={ICONS.rotateLeft} title="左へ 90° 回転" disabled={locked} onClick={() => rotate(-90)} />
        <ToolButton icon={ICONS.rotateReset} title="回転を戻す" disabled={locked || !el.rotate} onClick={() => rotate(null)} />
        <ToolButton icon={ICONS.lock} title={locked ? 'ロック解除' : 'ロック（動かせないようにする）'} active={locked} onClick={() => s.toggleLock(el.id)} />
        <ToolButton icon={ICONS.hide} title="非表示にする（レイヤーから表示に戻せます）" onClick={() => s.toggleHidden(el.id)} />
        {el.group && <ToolButton icon={ICONS.ungroup} title="グループ解除 (Ctrl+Shift+G)" onClick={s.ungroup} />}
      </div>
      <div className={styles.alignGrid} style={{ marginTop: 6 }}>
        <AlignButtons className={styles.alignBtn} />
      </div>
    </div>
  );
}
