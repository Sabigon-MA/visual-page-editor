import { useMemo, type CSSProperties } from 'react';
import { pageBg } from '../../model/pages';
import { DEFAULT_SCREEN } from '../../model/screens';
import { composePage } from '../../model/shared';
import { buildTemplate, TEMPLATES, type SiteTemplate } from '../../model/templates';
import { useEditor } from '../../store/elements';
import { useRecent } from '../../store/recent';
import { openTuneFolder } from '../../tune/actions';
import { Icon } from '../common/Fields';
import { PageThumb } from '../common/PageThumb';
import { baseName, desktop, newProject, openProjectFile, openProjectPath, projectName } from '../Shell/fileActions';
import { ICONS } from '../Shell/icons';
import styles from './StartScreen.module.css';

// スタート画面（パワーポイントのホーム画面と同じ形）：
// 新しいプロジェクトの作成、開く、前回の続き、最近使ったファイル
export function StartScreen() {
  return (
    <div className={styles.start}>
      <nav className={styles.nav}>
        <div className={styles.brand}>PageEdit</div>
        <button className={`${styles.navItem} ${styles.navOn}`} onClick={() => useEditor.getState().openHome('start')}>
          <Icon path={ICONS.home} />ホーム
        </button>
        <button className={styles.navItem} onClick={() => void newProject()}>
          <Icon path={ICONS.newFile} />新規
        </button>
        <button className={styles.navItem} onClick={openProjectFile}>
          <Icon path={ICONS.open} />開く
        </button>
      </nav>
      <main className={styles.main}><Home /></main>
    </div>
  );
}

// 作業中のプロジェクト（自動保存から戻したものを含む）があるか
function useResumable() {
  return useEditor((s) => !!s.filePath || s.pages.length > 1 || s.pages.some((p) => p.elements.length > 0));
}

function Home() {
  const resumable = useResumable();
  const recent = useRecent((r) => r.files);
  const filePath = useEditor((s) => s.filePath);
  return (
    <>
      <h1 className={styles.title}>ようこそ</h1>
      <section className={styles.section}>
        <h2>はじめる</h2>
        <div className={styles.tiles}>
          <button className={styles.newTile} onClick={() => void newProject()}>
            <span className={styles.newIcon}><Icon path='<path d="M8 3v10M3 8h10"/>' size={30} /></span>
            <b>新しいプロジェクトを作成</b>
            <span>空白のページから作ります。PC とスマホの両方に合わせて表示されます</span>
          </button>
          {resumable && <ResumeTile />}
        </div>
      </section>

      {desktop && (
        <section className={styles.section}>
          <h2>作ってあるサイトの見た目を調整する</h2>
          <div className={styles.tiles}>
            <button className={styles.newTile} onClick={() => void openTuneFolder()}>
              <span className={styles.newIcon}><Icon path={ICONS.palette} size={30} /></span>
              <b>プロジェクトのフォルダを開く…</b>
              <span>Vite + React のプロジェクトをそのまま動かして、色・文字・余白だけを変えます。変更は CSS にだけ書くので、送信やデータの取得などの動きは変わりません</span>
            </button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2>テンプレートから作る</h2>
        <div className={styles.tiles}>
          {TEMPLATES.map((t) => <TemplateTile key={t.id} template={t} />)}
        </div>
      </section>

      {desktop && (
        <section className={styles.section}>
          <h2>最近使ったファイル</h2>
          {recent.length === 0 && <div className={styles.empty}>まだありません。保存したり開いたりしたファイルがここに並びます。</div>}
          <div className={styles.list}>
            {recent.map((path) => (
              <button key={path} className={styles.row} onClick={() => void openProjectPath(path)} title={path}>
                <Icon path={ICONS.newFile} size={22} />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{baseName(path)}{path === filePath ? '（作業中）' : ''}</span>
                  <span className={styles.rowPath}>{path}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <button className={styles.openBtn} onClick={openProjectFile}>
          <Icon path={ICONS.open} />
          {desktop ? 'ほかのファイルを開く…' : 'プロジェクトファイルを開く…'}
        </button>
      </section>
    </>
  );
}

// 前回の続き（作業中のプロジェクト）
function ResumeTile() {
  const page = useEditor((s) => s.pages[0]);
  const pageCount = useEditor((s) => s.pages.length);
  const screen = useEditor((s) => s.screen);
  const site = useEditor((s) => s.site);
  const filePath = useEditor((s) => s.filePath);
  return (
    <button className={styles.resumeTile} onClick={() => useEditor.getState().closeHome()} title="作業中のプロジェクトを開く">
      <span className={styles.resumeThumb}>
        {/* 枠（幅 222・高さ 110）に収まる大きさで、画面1つ分を表示する */}
        <PageThumb elements={composePage(page.elements, site, screen).elements} screen={screen} width={Math.round(Math.min(222, (106 * screen.w) / screen.h))} bg={pageBg(page, site)} />
      </span>
      <span className={styles.resumeText}>
        <b>続きから編集：{projectName(filePath)}</b>
        <span>{pageCount}ページ</span>
      </span>
    </button>
  );
}

// テンプレート：最初のページの見た目（テンプレートの配色で描く）と説明
function TemplateTile({ template }: { template: SiteTemplate }) {
  const project = useMemo(() => buildTemplate(template, DEFAULT_SCREEN), [template]);
  const site = project.site!;
  const page = project.pages[0];
  const { screen } = project;
  // テーマの色（var(--c1) など）を、このテンプレートの色にする
  const vars = Object.fromEntries(site.colors.map((c) => [`--${c.id}`, c.value])) as CSSProperties;
  return (
    <button className={styles.resumeTile} onClick={() => void newProject(template)} title={`「${template.name}」のテンプレートで新しいプロジェクトを作る`}>
      <span className={styles.resumeThumb} style={vars}>
        <PageThumb elements={composePage(page.elements, site, screen).elements} screen={screen} width={Math.round(Math.min(222, (106 * screen.w) / screen.h))} bg={pageBg(page, site)} />
      </span>
      <span className={styles.resumeText}>
        <b>{template.name}</b>
        <span>{template.description}（{project.pages.length}ページ）</span>
      </span>
    </button>
  );
}
