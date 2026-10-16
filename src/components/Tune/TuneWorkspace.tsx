import { useEffect, useRef, useState } from 'react';
import { closeTune, saveTune, startTune } from '../../tune/actions';
import { rgbToHex } from '../../tune/overrides';
import { commit, isTuneDirty, redo, setProp, setRules, undo, useTune, type Inspected, type Picked } from '../../tune/store';
import { baseName } from '../Shell/fileActions';
import { ICONS } from '../Shell/icons';
import { ColorField, Icon } from '../common/Fields';
import styles from './Tune.module.css';

// 既存サイトの見た目調整：プロジェクトを開発サーバーで動かしたままプレビューし、選んだ要素の見た目だけを CSS で変える

interface PropDef {
  key: string;
  label: string;
  color?: boolean;
  options?: string[];
}

const GROUPS: { title: string; props: PropDef[] }[] = [
  {
    title: '文字',
    props: [
      { key: 'color', label: '色', color: true },
      { key: 'font-family', label: 'フォント' },
      { key: 'font-size', label: 'サイズ' },
      { key: 'font-weight', label: '太さ', options: ['400', '500', '600', '700', '800'] },
      { key: 'line-height', label: '行間' },
      { key: 'letter-spacing', label: '字間' },
      { key: 'text-align', label: '揃え', options: ['left', 'center', 'right'] },
    ],
  },
  { title: '背景', props: [{ key: 'background-color', label: '背景色', color: true }] },
  {
    title: '余白と大きさ',
    props: [
      { key: 'padding', label: '内側' },
      { key: 'margin', label: '外側' },
      { key: 'gap', label: '間隔' },
      { key: 'width', label: '幅' },
      { key: 'height', label: '高さ' },
    ],
  },
  {
    title: '枠と効果',
    props: [
      { key: 'border-radius', label: '角丸' },
      { key: 'border-width', label: '枠の太さ' },
      { key: 'border-style', label: '枠の種類', options: ['none', 'solid', 'dashed', 'dotted'] },
      { key: 'border-color', label: '枠の色', color: true },
      { key: 'box-shadow', label: '影' },
      { key: 'opacity', label: '不透明度' },
    ],
  },
];
const PROP_KEYS = GROUPS.flatMap((g) => g.props.map((p) => p.key));

const WIDTHS: { label: string; w: number | null }[] = [
  { label: 'いっぱい', w: null },
  { label: 'PC 1440', w: 1440 },
  { label: 'タブレット 768', w: 768 },
  { label: 'スマホ 390', w: 390 },
];

interface ColorInfo {
  colors: { value: string; count: number }[];
  vars: { name: string; value: string }[];
}

const KEY = '__pageedit';

export function TuneWorkspace() {
  const s = useTune();
  const frame = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [colors, setColors] = useState<ColorInfo | null>(null);
  const [tab, setTab] = useState<'colors' | 'changes'>('colors');
  // 色の置き換え：その色を使っている要素（届くまでは、選んだ色を pending にしておく）
  const replace = useRef<{ from: string; targets: { selector: string; prop: string }[] | null; pending: string | null } | null>(null);
  const dirty = isTuneDirty(s);

  const post = (msg: object) => frame.current?.contentWindow?.postMessage({ [KEY]: true, ...msg }, '*');
  const css = cssText(s);

  // プレビューからのメッセージ
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!frame.current || e.source !== frame.current.contentWindow || !d || !d[KEY]) return;
      const st = useTune.getState();
      if (d.type === 'hello') {
        // 読み込み直したページに、調整中の CSS と選択の状態を伝え直す
        post({ type: 'css', text: cssText(st) });
        post({ type: 'pick', on: st.pick });
        if (st.selector) post({ type: 'inspect', selector: st.selector, props: PROP_KEYS });
        post({ type: 'scanColors' });
      } else if (d.type === 'picked') {
        const picked = d as Picked;
        // すでに変更のあるセレクターがあれば、それを選ぶ
        const sel = picked.candidates.find((c) => st.rules.some((r) => r.selector === c.selector)) ?? picked.candidates[0];
        useTune.setState({ picked, selector: sel?.selector ?? null, inspected: null });
      } else if (d.type === 'inspected') {
        if (d.selector === st.selector) useTune.setState({ inspected: d as Inspected });
      } else if (d.type === 'colors') {
        setColors({ colors: d.colors, vars: d.vars });
      } else if (d.type === 'colorTargets') {
        const r = replace.current;
        if (!r || r.from !== d.from) return;
        r.targets = d.list;
        if (r.pending) applyReplace(r.pending);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => post({ type: 'css', text: css }), [css]);
  useEffect(() => post({ type: 'pick', on: s.pick }), [s.pick]);
  useEffect(() => {
    if (s.selector) post({ type: 'inspect', selector: s.selector, props: PROP_KEYS });
    else post({ type: 'clear' });
  }, [s.selector, css]);

  // キーボード（Ctrl + Z / Y / S）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (!mod || document.querySelector('[role="dialog"]')) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
      if (k === 's') {
        e.preventDefault();
        void saveTune();
      } else if (!typing && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!typing && k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function startReplace(from: string, to: string) {
    if (replace.current?.from !== from) {
      replace.current = { from, targets: null, pending: to };
      post({ type: 'replaceColor', from });
    } else if (!replace.current.targets) {
      replace.current.pending = to;
    } else {
      applyReplace(to);
    }
  }
  function applyReplace(to: string) {
    const r = replace.current!;
    let rules = useTune.getState().rules;
    for (const t of r.targets!) {
      const idx = rules.findIndex((x) => x.selector === t.selector);
      const props = { ...(idx >= 0 ? rules[idx].props : {}), [t.prop]: to };
      rules = idx >= 0 ? rules.map((x, i) => (i === idx ? { selector: t.selector, props } : x)) : [...rules, { selector: t.selector, props }];
    }
    setRules(rules);
    r.pending = null;
  }
  function finishReplace() {
    commit();
    replace.current = null;
    setTimeout(() => post({ type: 'scanColors' }), 50);
  }

  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <div className={styles.brand}><span className={styles.mark}>P</span>見た目の調整</div>
        <span className={styles.project} title={s.dir}>{baseName(s.dir)}{dirty && <i className={styles.dirty} title="保存していない変更があります" />}</span>
        <span className={styles.sep} />
        <button className={`${styles.btn} ${s.pick ? styles.btnOn : ''}`} onClick={() => useTune.setState({ pick: !s.pick })} title="オンのときは、ページをクリックすると要素を選びます。オフにすると、ページを普通に操作できます">
          <Icon path='<path d="M3 2l9 5-4 1.5L6.5 13z"/>' />要素を選ぶ
        </button>
        <button className={styles.icon} onClick={undo} disabled={s.past.length === 0 && JSON.stringify(s.rules) === JSON.stringify(s.committed)} title="元に戻す（Ctrl + Z）"><Icon path={ICONS.undo} /></button>
        <button className={styles.icon} onClick={redo} disabled={s.future.length === 0} title="やり直す（Ctrl + Y）"><Icon path={ICONS.redo} /></button>
        <button className={styles.icon} onClick={() => setReloadKey((k) => k + 1)} disabled={s.status !== 'ready'} title="ページを読み込み直す"><Icon path={ICONS.reload} /></button>
        <span className={styles.sep} />
        {WIDTHS.map((w) => (
          <button key={w.label} className={`${styles.chip} ${s.previewW === w.w ? styles.chipOn : ''}`} onClick={() => useTune.setState({ previewW: w.w })}>{w.label}</button>
        ))}
        <span className={styles.grow} />
        <button className={`${styles.btn} ${styles.btnAccent}`} onClick={() => void saveTune()} disabled={!dirty} title="pageedit-overrides.css に保存（Ctrl + S）"><Icon path={ICONS.save} />保存</button>
        <button className={styles.btn} onClick={() => void closeTune()}>閉じる</button>
      </header>

      <div className={styles.body}>
        <aside className={styles.side}>
          <div className={styles.tabs}>
            <button className={tab === 'colors' ? styles.tabOn : ''} onClick={() => setTab('colors')}>色</button>
            <button className={tab === 'changes' ? styles.tabOn : ''} onClick={() => setTab('changes')}>変更の一覧{s.rules.length > 0 && `（${s.rules.length}）`}</button>
          </div>
          <div className={styles.sideBody}>
            {tab === 'colors' ? (
              <ColorsTab info={colors} rescan={() => post({ type: 'scanColors' })} onReplace={startReplace} onReplaceEnd={finishReplace} />
            ) : (
              <ChangesTab />
            )}
          </div>
        </aside>

        <main className={styles.center}>
          {s.status === 'ready' ? (
            <div className={styles.stage}>
              <iframe
                key={`${s.url}#${reloadKey}`}
                ref={frame}
                className={styles.frame}
                style={s.previewW ? { width: s.previewW } : undefined}
                src={s.url}
                title="プレビュー"
              />
            </div>
          ) : (
            <div className={styles.status}>
              {s.status === 'starting' ? (
                <>
                  <b>開発サーバーを起動しています…</b>
                  <p>プロジェクトの設定（vite.config）のまま起動します。はじめて開くときは少し時間がかかります。</p>
                </>
              ) : (
                <>
                  <b className={styles.error}>開けませんでした</b>
                  <p>{s.error}</p>
                  <button className={styles.btn} onClick={() => void startTune()}>もう一度試す</button>
                </>
              )}
              {s.log && <pre className={styles.log}>{s.log.replace(/PAGEEDIT_\w+ ?/g, '')}</pre>}
            </div>
          )}
        </main>

        <aside className={styles.right}>
          <ElementPanel />
        </aside>
      </div>
    </div>
  );
}

const cssText = (s: { rules: { selector: string; props: Record<string, string> }[]; extra: string }) =>
  s.rules.map((r) => `${r.selector}{${Object.entries(r.props).map(([k, v]) => `${k}:${v} !important`).join(';')}}`).join('\n') + '\n' + s.extra;

function ColorsTab({ info, rescan, onReplace, onReplaceEnd }: { info: ColorInfo | null; rescan(): void; onReplace(from: string, to: string): void; onReplaceEnd(): void }) {
  const root = useTune((s) => s.rules.find((r) => r.selector === ':root'));
  if (!info) return <div className={styles.hint}>ページを読み込むと、使われている色がここに並びます。</div>;
  return (
    <>
      {info.vars.length > 0 && (
        <>
          <div className={styles.groupLabel}>テーマの色（CSS 変数）</div>
          {info.vars.map((v) => {
            const value = root?.props[v.name] ?? v.value;
            return (
              <div key={v.name} className={styles.colorRow}>
                <ColorField value={rgbToHex(value) ?? '#000000'} onChange={(c) => setProp(':root', v.name, c)} onCommit={commit} className={styles.swatch} />
                <span className={styles.colorName} title={v.name}>{v.name}</span>
                <span className={styles.colorValue}>{value}</span>
              </div>
            );
          })}
        </>
      )}
      <div className={styles.groupLabel}>
        使われている色
        <button className={styles.link} onClick={rescan}>調べ直す</button>
      </div>
      <div className={styles.hint}>色の四角をクリックして選ぶと、その色を使っている所をまとめて置き換えます。</div>
      {info.colors.map((c) => {
        const hex = rgbToHex(c.value);
        return (
          <div key={c.value} className={styles.colorRow}>
            <ColorField value={hex ?? '#000000'} onChange={(to) => onReplace(c.value, to)} onCommit={onReplaceEnd} className={styles.swatch} title="この色を置き換える" />
            <span className={styles.colorName}>{hex ?? c.value}</span>
            <span className={styles.colorValue}>{c.count}か所</span>
          </div>
        );
      })}
    </>
  );
}

function ChangesTab() {
  const rules = useTune((s) => s.rules);
  const selector = useTune((s) => s.selector);
  if (rules.length === 0) return <div className={styles.hint}>まだ変更はありません。</div>;
  return (
    <div className={styles.changes}>
      {rules.map((r) => (
        <div key={r.selector} className={`${styles.change} ${r.selector === selector ? styles.changeOn : ''}`}>
          <button className={styles.changeBody} onClick={() => useTune.setState({ selector: r.selector, picked: null, inspected: null })}>
            <code>{r.selector}</code>
            <span>{Object.entries(r.props).map(([k, v]) => `${k}: ${v}`).join(' / ')}</span>
          </button>
          <button
            className={styles.icon}
            title="この変更を消す"
            onClick={() => {
              setRules(useTune.getState().rules.filter((x) => x.selector !== r.selector));
              commit();
            }}
          >
            <Icon path={ICONS.delete} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ElementPanel() {
  const selector = useTune((s) => s.selector);
  const picked = useTune((s) => s.picked);
  const inspected = useTune((s) => s.inspected);
  const rule = useTune((s) => s.rules.find((r) => r.selector === s.selector));
  const [draft, setDraft] = useState(selector ?? '');
  useEffect(() => setDraft(selector ?? ''), [selector]);

  if (!selector) {
    return (
      <div className={styles.hint}>
        上の「要素を選ぶ」をオンにして、ページの中の要素をクリックしてください。選んだ要素の色・文字・余白などを変えられます。
        <br />
        <br />
        変更は CSS（pageedit-overrides.css）にだけ書きます。サイトの動き（ボタンの処理・送信・データの取得など）は変わりません。
      </div>
    );
  }

  const changeSelector = (sel: string) => {
    const v = sel.trim();
    if (!v || v === selector) return;
    // 変更があれば新しいセレクターに引き継ぐ
    const rules = useTune.getState().rules;
    if (rule && !rules.some((r) => r.selector === v)) {
      setRules(rules.map((r) => (r.selector === selector ? { ...r, selector: v } : r)));
      commit();
    }
    useTune.setState({ selector: v, inspected: null });
  };

  return (
    <>
      <div className={styles.panelHead}>
        <b>{picked ? `<${picked.tag}>` : '選んだ要素'}</b>
        {picked?.text && <span className={styles.excerpt}>{picked.text}</span>}
      </div>
      <div className={styles.section}>
        <div className={styles.groupLabel}>変える範囲</div>
        {picked && picked.candidates.length > 1 && (
          <div className={styles.scopes}>
            {picked.candidates.map((c) => (
              <button key={c.selector} className={`${styles.chip} ${c.selector === selector ? styles.chipOn : ''}`} onClick={() => changeSelector(c.selector)}>
                {c.label}（{c.count}）
              </button>
            ))}
          </div>
        )}
        <input
          className={`${styles.input} ${styles.mono}`}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => changeSelector(draft)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          title="CSS のセレクター。書き換えて範囲を変えられます"
        />
        <div className={styles.matches}>
          {inspected?.error ? <span className={styles.error}>{inspected.error}</span> : inspected ? `${inspected.count}個の要素に当てはまります` : '…'}
          {inspected && inspected.count === 0 && !inspected.error && <span className={styles.error}>（いまのページにはありません）</span>}
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className={styles.section}>
          <div className={styles.groupLabel}>{g.title}</div>
          {g.props.map((p) => (
            <PropRow key={p.key} def={p} selector={selector} value={rule?.props[p.key] ?? ''} computed={inspected?.styles[p.key] ?? ''} />
          ))}
        </div>
      ))}

      {rule && (
        <div className={styles.section}>
          <button
            className={`${styles.btn} ${styles.wide}`}
            onClick={() => {
              setRules(useTune.getState().rules.filter((r) => r.selector !== selector));
              commit();
            }}
          >
            この範囲の変更をすべて消す
          </button>
        </div>
      )}
    </>
  );
}

function PropRow({ def, selector, value, computed }: { def: PropDef; selector: string; value: string; computed: string }) {
  const set = (v: string) => setProp(selector, def.key, v);
  return (
    <div className={styles.row}>
      <span className={`${styles.label} ${value ? styles.labelSet : ''}`}>{def.label}</span>
      {def.color && <ColorField value={rgbToHex(value || computed) ?? '#000000'} onChange={set} onCommit={commit} className={styles.swatch} />}
      {def.options ? (
        <select
          className={styles.input}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            commit();
          }}
        >
          <option value="">{computed ? `元のまま（${computed}）` : '元のまま'}</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className={styles.input} value={value} placeholder={computed} spellCheck={false} onChange={(e) => set(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      )}
      <button
        className={styles.reset}
        disabled={!value}
        title="元に戻す"
        onClick={() => {
          set('');
          commit();
        }}
      >
        ×
      </button>
    </div>
  );
}
