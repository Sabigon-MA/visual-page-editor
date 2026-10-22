import { useMemo, useState, type CSSProperties } from 'react';
import { pageBg } from '../../model/pages';
import { DEFAULT_SCREEN } from '../../model/screens';
import { composePage } from '../../model/shared';
import { buildTemplate, TEMPLATES, type SiteTemplate } from '../../model/templates';
import { THEME_PRESETS } from '../../model/theme';
import { useEditor } from '../../store/elements';
import { useRecent } from '../../store/recent';
import { openTuneFolder } from '../../tune/actions';
import { Icon } from '../common/Fields';
import { PageThumb } from '../common/PageThumb';
import { baseName, desktop, newProject, openProjectFile, openProjectPath, projectName } from '../Shell/fileActions';
import { ICONS } from '../Shell/icons';
import styles from './StartScreen.module.css';

// 作るものの種類。選ぶと、その種類に合うテンプレートを並べる（templates はテンプレートの id）
interface Goal {
  id: string;
  name: string;
  hint: string;
  icon: string;
  color: string;
  templates: string[];
}

const GOALS: Goal[] = [
  { id: 'site', name: 'Webサイト', hint: '会社・お店・採用・作品集', icon: ICONS.globe, color: '#3b6ef6', templates: ['business', 'cafe', 'recruit', 'portfolio'] },
  { id: 'product', name: '商品紹介', hint: 'サービス紹介・LP', icon: ICONS.image, color: '#e0703a', templates: ['business', 'event'] },
  { id: 'app', name: 'Webアプリ', hint: '管理画面・フォーム', icon: ICONS.screen, color: '#2f9e7a', templates: [] },
  { id: 'event', name: 'イベント', hint: '告知・申し込み', icon: ICONS.section, color: '#a35bd6', templates: ['event'] },
];

type Step = { kind: 'goal' } | { kind: 'templates'; goal: Goal } | { kind: 'setup'; goal: Goal; template: SiteTemplate };

// スタート画面：「何を作りますか？」から、作るもの → テンプレート → サイト名と配色 の順に選んで編集を始める
export function StartScreen() {
  const [step, setStep] = useState<Step>({ kind: 'goal' });
  return (
    <div className={styles.start}>
      <header className={styles.top}>
        <button className={styles.brand} onClick={() => setStep({ kind: 'goal' })} title="最初の画面に戻る">
          <span className={styles.mark}>P</span>PageEdit
        </button>
        <span className={styles.grow} />
        <button className={styles.topBtn} onClick={openProjectFile}>
          <Icon path={ICONS.open} size={15} />{desktop ? 'ファイルを開く…' : 'プロジェクトファイルを開く…'}
        </button>
      </header>
      <main className={styles.main}>
        {step.kind === 'goal' && <Goals onPick={(goal) => setStep({ kind: 'templates', goal })} />}
        {step.kind === 'templates' && (
          <Templates goal={step.goal} onBack={() => setStep({ kind: 'goal' })} onPick={(template) => setStep({ kind: 'setup', goal: step.goal, template })} />
        )}
        {step.kind === 'setup' && <Setup template={step.template} onBack={() => setStep({ kind: 'templates', goal: step.goal })} />}
      </main>
    </div>
  );
}

// 作業中のプロジェクト（自動保存から戻したものを含む）があるか
function useResumable() {
  return useEditor((s) => !!s.filePath || s.pages.length > 1 || s.pages.some((p) => p.elements.length > 0));
}

function Goals({ onPick }: { onPick(goal: Goal): void }) {
  const resumable = useResumable();
  const recent = useRecent((r) => r.files);
  const filePath = useEditor((s) => s.filePath);
  // 作業中のファイルは「続きから編集」に出すので、最近使ったファイルからは外す
  const others = (desktop ? recent : []).filter((p) => p !== filePath).slice(0, resumable ? 3 : 4);
  return (
    <div className={styles.center}>
      <h1 className={styles.question}>何を作りますか？</h1>
      <p className={styles.sub}>作るものを選ぶと、合うテンプレートが並びます</p>
      <div className={styles.goals}>
        {GOALS.map((g) => {
          const ready = g.templates.length > 0;
          return (
            <button key={g.id} className={styles.goal} disabled={!ready} onClick={() => onPick(g)} title={ready ? `${g.name}のテンプレートを見る` : 'テンプレートを準備中です'}>
              <span className={styles.goalIcon} style={{ background: g.color }}><Icon path={g.icon} size={18} /></span>
              <b>{g.name}</b>
              <span>{g.hint}</span>
              {!ready && <em className={styles.soon}>準備中</em>}
            </button>
          );
        })}
        <button className={styles.goal} onClick={() => void newProject()} title="何もないページから作る">
          <span className={styles.goalIcon} style={{ background: '#8a93a5' }}><Icon path={ICONS.plus} size={18} /></span>
          <b>白紙から</b>
          <span>何もないページ</span>
        </button>
        {desktop && (
          <button
            className={styles.goal}
            onClick={() => void openTuneFolder()}
            title="Vite + React のプロジェクトをそのまま動かして、色・文字・余白だけを変えます。変更は CSS にだけ書くので、送信やデータの取得などの動きは変わりません"
          >
            <span className={styles.goalIcon} style={{ background: '#c2508a' }}><Icon path={ICONS.palette} size={18} /></span>
            <b>見た目の調整</b>
            <span>作ってあるサイトのフォルダを開く</span>
          </button>
        )}
      </div>

      {(resumable || others.length > 0) && (
        <section className={styles.recent}>
          <h2>続きから</h2>
          <div className={styles.recentRow}>
            {resumable && <ResumeCard />}
            {others.map((path) => (
              <button key={path} className={styles.fileCard} onClick={() => void openProjectPath(path)} title={path}>
                <Icon path={ICONS.newFile} size={20} />
                <span className={styles.fileText}>
                  <b>{projectName(path)}</b>
                  <span>{baseName(path)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// 前回の続き（作業中のプロジェクト）
function ResumeCard() {
  const page = useEditor((s) => s.pages[0]);
  const pageCount = useEditor((s) => s.pages.length);
  const screen = useEditor((s) => s.screen);
  const site = useEditor((s) => s.site);
  const filePath = useEditor((s) => s.filePath);
  return (
    <button className={styles.resumeCard} onClick={() => useEditor.getState().closeHome()} title="作業中のプロジェクトを開く">
      <span className={styles.resumeThumb}>
        <PageThumb elements={composePage(page.elements, site, screen).elements} screen={screen} width={Math.round(Math.min(84, (52 * screen.w) / screen.h))} bg={pageBg(page, site)} />
      </span>
      <span className={styles.fileText}>
        <b>{projectName(filePath)}</b>
        <span>作業中・{pageCount}ページ</span>
      </span>
    </button>
  );
}

function Templates({ goal, onBack, onPick }: { goal: Goal; onBack(): void; onPick(t: SiteTemplate): void }) {
  const list = goal.templates.map((id) => TEMPLATES.find((t) => t.id === id)).filter((t): t is SiteTemplate => !!t);
  return (
    <div className={styles.wide}>
      <button className={styles.back} onClick={onBack}>← 作るものを選び直す</button>
      <h1 className={styles.heading}>{goal.name}のテンプレート</h1>
      <p className={styles.sub}>文章や画像は仮のものが入っています。選んだあとで、上から書き換えていきます</p>
      <div className={styles.templates}>
        {list.map((t) => <TemplateCard key={t.id} template={t} onPick={() => onPick(t)} />)}
        <button className={`${styles.templateCard} ${styles.blankCard}`} onClick={() => void newProject()}>
          <span className={styles.blankIcon}><Icon path={ICONS.plus} size={26} /></span>
          <span className={styles.templateText}>
            <b>白紙から</b>
            <span>テンプレートを使わずに、何もないページから作ります</span>
          </span>
        </button>
      </div>
    </div>
  );
}

// テンプレートの最初のページを、指定した配色で縮小表示する
function TemplatePreview({ template, colors, width }: { template: SiteTemplate; colors: string[]; width: number }) {
  const project = useMemo(() => buildTemplate(template, DEFAULT_SCREEN), [template]);
  const site = project.site!;
  const page = project.pages[0];
  const { screen } = project;
  // テーマの色（var(--c1) など）を、選んでいる配色にする
  const vars = Object.fromEntries(site.colors.map((c, i) => [`--${c.id}`, colors[i] ?? c.value])) as CSSProperties;
  const bg = pageBg(page, site).replace(/var\(--c(\d)\)/, (_m, n) => colors[Number(n) - 1] ?? '#fff');
  return (
    <span className={styles.preview} style={vars}>
      <PageThumb elements={composePage(page.elements, site, screen).elements} screen={screen} width={width} bg={bg} />
    </span>
  );
}

function TemplateCard({ template, onPick }: { template: SiteTemplate; onPick(): void }) {
  return (
    <button className={styles.templateCard} onClick={onPick} title={`「${template.name}」で作る`}>
      <span className={styles.thumbBox}><TemplatePreview template={template} colors={template.colors} width={236} /></span>
      <span className={styles.templateText}>
        <b>{template.name}</b>
        <span>{template.description}（{template.pages.length}ページ）</span>
      </span>
    </button>
  );
}

const PRESET_PICKS = ['スタンダード', 'ナチュラル', 'ポップ', 'エレガント', 'ビジネス'];

// サイト名と配色を決める（どちらもあとで変えられる）
function Setup({ template, onBack }: { template: SiteTemplate; onBack(): void }) {
  const [name, setName] = useState(template.siteName);
  const same = (a: string[], b: string[]) => a.every((c, i) => c.toLowerCase() === b[i]?.toLowerCase());
  const choices = useMemo(() => [
    { name: 'テンプレートの色', colors: template.colors },
    ...PRESET_PICKS.map((n) => THEME_PRESETS.find((p) => p.name === n)!).filter((p) => !same(p.colors, template.colors)).slice(0, 3),
  ], [template]);
  const [pick, setPick] = useState(0);
  const colors = choices[pick].colors;
  const start = () => void newProject({ ...template, siteName: name.trim() || template.siteName, colors });
  return (
    <div className={styles.wide}>
      <button className={styles.back} onClick={onBack}>← テンプレートを選び直す</button>
      <h1 className={styles.heading}>サイトの名前と色を決める</h1>
      <p className={styles.sub}>「{template.name}」で作ります。どちらもあとで変えられます（名前はサイトの設定、色は左の「テーマ」）</p>
      <div className={styles.setup}>
        <div className={styles.setupPreview}>
          <TemplatePreview template={{ ...template, siteName: name.trim() || template.siteName }} colors={colors} width={440} />
        </div>
        <div className={styles.setupForm}>
          <label className={styles.field}>
            <span>サイトの名前</span>
            <input
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
            />
          </label>
          <div className={styles.field}>
            <span>配色</span>
            <div className={styles.palettes} role="radiogroup" aria-label="配色">
              {choices.map((c, i) => (
                <button key={c.name} role="radio" aria-checked={pick === i} className={`${styles.palette} ${pick === i ? styles.paletteOn : ''}`} onClick={() => setPick(i)}>
                  <span className={styles.swatches}>{c.colors.slice(0, 3).map((v, k) => <i key={k} style={{ background: v }} />)}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onBack}>戻る</button>
            <button className={styles.create} onClick={start}>編集を始める</button>
          </div>
        </div>
      </div>
    </div>
  );
}
