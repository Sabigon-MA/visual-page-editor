import type { Page, PageElement, Project, Screen } from '../types/element';
import { createElement, nextGroupId, nextId } from './elementTypes';
import { createPage, DEFAULT_SITE } from './pages';
import { buildSection } from './sections';
import { renameFor } from './shared';
import { DEFAULT_COLORS } from './theme';

// デザインのテンプレート：ページ構成（セクションの並び）・配色・見出しのフォント・文章をひとまとめにしたもの。
// セクションのひな形（sections.ts）を組み合わせ、ひな形の文章を置き換えて作る。

type Texts = Record<string, string>; // ひな形の文章 → テンプレートの文章（文章の一部にも当てはめる）

interface TemplatePage {
  name: string;
  slug?: string;
  sections: [id: string, texts?: Texts][];
}

export interface SiteTemplate {
  id: string;
  name: string;
  description: string;
  colors: string[]; // メイン・アクセント・文字・背景・背景（薄）
  headingFont: string; // 見出しのフォント（font-family）
  siteName: string;
  menu: string[]; // ヘッダーのメニューの項目（同じ順でページにリンクする。ページがなければリンクなし）
  header?: Texts;
  footer?: Texts;
  pages: TemplatePage[];
}

export const TEMPLATES: SiteTemplate[] = [
  {
    id: 'cafe',
    name: 'カフェ・お店',
    description: 'お店の雰囲気・メニュー・アクセスを伝える3ページ',
    colors: ['#7b4b2a', '#c8875a', '#3a2a20', '#fbf7f2', '#efe5d9'],
    headingFont: "'Shippori Mincho',serif",
    siteName: 'こもれび珈琲',
    menu: ['ホーム', 'メニュー', 'アクセス'],
    header: { 'お問い合わせ': 'ご予約' },
    footer: { 'サービス': 'メニュー', '会社概要': 'アクセス', '〒000-0000 東京都〇〇区〇〇 1-2-3': '〒000-0000 〇〇県〇〇市 1-2-3　10:00–18:00（火曜定休）' },
    pages: [
      {
        name: 'ホーム',
        sections: [
          ['hero', { 'あなたの毎日を、\nもっと快適に。': '森の中の、\n小さな焙煎所。', 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。': '朝いちばんに焼いた豆で、一杯ずつ丁寧に淹れています。木漏れ日の入る席で、ゆっくりどうぞ。', '無料で始める': 'メニューを見る', '詳しく見る': 'アクセス' }],
          ['features', { '選ばれる3つの理由': 'こもれび珈琲のこだわり', 'セクションの説明をひとこと入れます': '小さなお店だからできること', '使いやすい': '毎朝の自家焙煎', '直感的な操作で、誰でもすぐに使い始められます。': 'その日に使う分だけを、小さな焙煎機で焼いています。', '安心のサポート': '季節の焼き菓子', '専任のスタッフが、導入から運用まで丁寧にサポートします。': '近くの農園の果物を使ったタルトを、週替わりで。', '低コスト': '静かな席', '必要な機能だけを選べるので、無駄なコストがかかりません。': '窓辺のカウンターは、読書や作業にも向いています。' }],
          ['news', { '新しいサービスを始めました': '秋の限定ブレンドが始まりました', '年末年始の営業についてのお知らせ': '年末年始の営業について', 'ホームページを公開しました': 'ホームページを公開しました', '夏季休業のお知らせ': '夏季休業のお知らせ' }],
        ],
      },
      {
        name: 'メニュー',
        slug: 'menu',
        sections: [
          ['pricing', { '料金プラン': 'メニュー', 'ライト': 'こもれびブレンド', 'スタンダード': '本日のおすすめセット', 'プロ': '季節のタルト', '¥980/月': '¥520', '¥2,980/月': '¥980', '¥9,800/月': '¥480', '基本機能\nメールサポート\n1ユーザー': '深煎り\n苦味とコク\nおかわり半額', 'すべての機能\nチャットサポート\n5ユーザー': 'お好きな珈琲\n季節の焼き菓子\n平日 14時から', 'すべての機能\n電話サポート\nユーザー数無制限': '週替わり\n近くの農園の果物\nテイクアウト可', 'このプランにする': 'ご予約はこちら' }],
          ['cta', { 'まずは無料でお試しください': '豆の販売もしています', '30日間、すべての機能を無料でお使いいただけます。': '100g から、お好みの挽き方でお分けします。', '無料で始める': 'アクセス' }],
        ],
      },
      {
        name: 'アクセス',
        slug: 'access',
        sections: [
          ['faq', { 'よくある質問': 'アクセス・よくある質問', '無料で試せますか？': '駐車場はありますか？', 'はい。30日間、すべての機能を無料でお使いいただけます。': 'お店の前に 3 台分あります。', '途中でプランを変更できますか？': '予約はできますか？', 'いつでも変更できます。変更は翌月から反映されます。': '4 名さま以上は、お問い合わせからご予約ください。', '解約に費用はかかりますか？': 'ペットと一緒に入れますか？', '解約手数料はかかりません。': 'テラス席でしたら大丈夫です。' }],
          ['contact', { 'お問い合わせ': 'ご予約・お問い合わせ', 'ご質問・ご相談は、こちらからお気軽にどうぞ。': 'ご予約は前日までにお願いします。' }],
        ],
      },
    ],
  },
  {
    id: 'business',
    name: '会社・サービス紹介',
    description: 'サービスの特長・料金・お問い合わせの3ページ',
    colors: ['#1d3b72', '#00a3a3', '#1a1f2b', '#ffffff', '#eef2f7'],
    headingFont: "'Zen Kaku Gothic New',sans-serif",
    siteName: 'ネクストリンク株式会社',
    menu: ['ホーム', 'サービス', 'お問い合わせ'],
    footer: { 'サービス': 'サービス', '会社概要': 'お問い合わせ' },
    pages: [
      {
        name: 'ホーム',
        sections: [
          ['hero', { 'あなたの毎日を、\nもっと快適に。': '経理の手間を、\nまるごと自動化。', 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。': '請求書の作成から入金の確認まで。中小企業の経理を、クラウドひとつで効率化します。', '無料で始める': '資料をもらう', '詳しく見る': 'サービス紹介' }],
          ['features', { '選ばれる3つの理由': '導入企業が増えている理由' }],
          ['news'],
          ['cta', { 'まずは無料でお試しください': 'まずは30日間、無料でお試しください' }],
        ],
      },
      {
        name: 'サービス',
        slug: 'service',
        sections: [
          ['features', { '選ばれる3つの理由': 'できること', 'セクションの説明をひとこと入れます': '毎月の経理作業を、ここまで減らせます', '使いやすい': '請求書をすぐ作成', '安心のサポート': '入金を自動で確認', '低コスト': '会計ソフトと連携' }],
          ['pricing'],
          ['faq'],
        ],
      },
      {
        name: 'お問い合わせ',
        slug: 'contact',
        sections: [['contact']],
      },
    ],
  },
  {
    id: 'portfolio',
    name: 'ポートフォリオ',
    description: '作品と自己紹介、お仕事の依頼を受ける2ページ',
    colors: ['#2b2b2b', '#b8975a', '#2b2b2b', '#ffffff', '#f6f3ee'],
    headingFont: "'Playfair Display',serif",
    siteName: 'Aoi Sato',
    menu: ['Works', 'Contact'],
    header: { 'お問い合わせ': 'お仕事の依頼' },
    footer: { 'サービス': 'Works', '会社概要': 'Contact', 'プライバシーポリシー': 'Instagram', '〒000-0000 東京都〇〇区〇〇 1-2-3': 'グラフィックデザイナー / イラストレーター' },
    pages: [
      {
        name: 'Works',
        sections: [
          ['hero', { 'あなたの毎日を、\nもっと快適に。': 'Design that\nfeels quiet.', 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。': '書籍の装丁、パッケージ、ブランドのロゴを中心に制作しています。静かで長く使えるデザインを目指しています。', '無料で始める': '作品を見る', '詳しく見る': 'プロフィール' }],
          ['features', { '選ばれる3つの理由': 'Works', 'セクションの説明をひとこと入れます': '最近のお仕事から', '使いやすい': '書籍『森の手紙』装丁', '直感的な操作で、誰でもすぐに使い始められます。': '紙の手ざわりを活かした、活版印刷の表紙。', '安心のサポート': '焼き菓子店のパッケージ', '専任のスタッフが、導入から運用まで丁寧にサポートします。': '季節ごとに色を替える、紙箱のシリーズ。', '低コスト': '建築事務所のロゴ', '必要な機能だけを選べるので、無駄なコストがかかりません。': '図面の線から生まれた、細い線のロゴ。' }],
          ['cta', { 'まずは無料でお試しください': 'お仕事のご依頼をお待ちしています', '30日間、すべての機能を無料でお使いいただけます。': '装丁・パッケージ・ロゴなど、まずはお気軽にご相談ください。', '無料で始める': '依頼する' }],
        ],
      },
      {
        name: 'Contact',
        slug: 'contact',
        sections: [['contact', { 'お問い合わせ': 'Contact', 'ご質問・ご相談は、こちらからお気軽にどうぞ。': 'ご依頼の内容とご希望の時期をお書きください。' }]],
      },
    ],
  },
  {
    id: 'event',
    name: 'イベント・LP',
    description: '1ページで内容・チケット・申し込みまで伝える',
    colors: ['#ff4f81', '#ffc93c', '#222222', '#ffffff', '#fff3f6'],
    headingFont: "'M PLUS Rounded 1c',sans-serif",
    siteName: 'まちなか音楽祭 2026',
    menu: ['見どころ', 'チケット', 'お申し込み'],
    header: { 'お問い合わせ': 'チケットを買う' },
    footer: { 'サービス': '見どころ', '会社概要': 'チケット', '〒000-0000 東京都〇〇区〇〇 1-2-3': '主催：まちなか音楽祭 実行委員会' },
    pages: [
      {
        name: 'ホーム',
        sections: [
          ['hero', { 'あなたの毎日を、\nもっと快適に。': '街じゅうが、\nステージになる。', 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。': '11月14日（土）・15日（日）開催。駅前広場から商店街まで、10か所で 40 組のライブ。', '無料で始める': 'チケットを買う', '詳しく見る': '見どころ' }],
          ['features', { '選ばれる3つの理由': '見どころ', 'セクションの説明をひとこと入れます': '家族みんなで楽しめます', '使いやすい': '10 か所のステージ', '直感的な操作で、誰でもすぐに使い始められます。': '歩いて回れる距離に、いろいろなステージ。', '安心のサポート': '屋台とワークショップ', '専任のスタッフが、導入から運用まで丁寧にサポートします。': '地元のお店の屋台や、楽器づくり体験も。', '低コスト': '小学生以下は無料', '必要な機能だけを選べるので、無駄なコストがかかりません。': 'お子さまは、チケットなしで入場できます。' }],
          ['pricing', { '料金プラン': 'チケット', 'ライト': '1日券', 'スタンダード': '2日通し券', 'プロ': 'サポーター券', '¥980/月': '¥2,500', '¥2,980/月': '¥4,000', '¥9,800/月': '¥10,000', '基本機能\nメールサポート\n1ユーザー': '土曜か日曜の\nどちらか1日\n全ステージ', 'すべての機能\nチャットサポート\n5ユーザー': '2日間\n全ステージ\n限定タオル付き', 'すべての機能\n電話サポート\nユーザー数無制限': '2日間\n前方エリア\nお名前を掲載', 'このプランにする': '申し込む' }],
          ['faq', { '無料で試せますか？': '雨の日も開催しますか？', 'はい。30日間、すべての機能を無料でお使いいただけます。': '屋根のあるステージで開催します。', '途中でプランを変更できますか？': '当日券はありますか？', 'いつでも変更できます。変更は翌月から反映されます。': '各日、会場の受付で販売します。', '解約に費用はかかりますか？': '払い戻しはできますか？', '解約手数料はかかりません。': '中止の場合のみ、全額払い戻します。' }],
          ['contact', { 'お問い合わせ': 'お申し込み・お問い合わせ' }],
        ],
      },
    ],
  },
  {
    id: 'recruit',
    name: '採用',
    description: '働く魅力・募集要項・応募フォームの3ページ',
    colors: ['#0f9d8a', '#3d8bfd', '#1e2a32', '#ffffff', '#eef8f6'],
    headingFont: "'Zen Maru Gothic',sans-serif",
    siteName: 'みどり訪問看護ステーション 採用',
    menu: ['ホーム', '募集要項', '応募する'],
    header: { 'お問い合わせ': '応募する' },
    footer: { 'サービス': '募集要項', '会社概要': '応募する' },
    pages: [
      {
        name: 'ホーム',
        sections: [
          ['hero', { 'あなたの毎日を、\nもっと快適に。': '地域の「おうち」で、\n看護をしませんか。', 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。': '残業ほぼなし、土日休み。ブランクのある方も、先輩と一緒に回るところから始められます。', '無料で始める': '募集要項を見る', '詳しく見る': '応募する' }],
          ['features', { '選ばれる3つの理由': '働きやすさの3つの理由', 'セクションの説明をひとこと入れます': 'スタッフの 9 割が、子育てや介護と両立しています', '使いやすい': '同行訪問から', '直感的な操作で、誰でもすぐに使い始められます。': 'はじめの1か月は、先輩と一緒に訪問します。', '安心のサポート': '夜間の当番は交代制', '専任のスタッフが、導入から運用まで丁寧にサポートします。': '月に2回まで。手当もしっかり付きます。', '低コスト': '直行直帰OK', '必要な機能だけを選べるので、無駄なコストがかかりません。': 'ご自宅から、そのまま訪問先へ向かえます。' }],
          ['cta', { 'まずは無料でお試しください': 'まずは見学からどうぞ', '30日間、すべての機能を無料でお使いいただけます。': '働く様子を見てから、応募を決められます。', '無料で始める': '見学を申し込む' }],
        ],
      },
      {
        name: '募集要項',
        slug: 'jobs',
        sections: [
          ['pricing', { '料金プラン': '募集している職種', 'ライト': '看護師（常勤）', 'スタンダード': '看護師（パート）', 'プロ': '理学療法士', '¥980/月': '月給 30万円〜', '¥2,980/月': '時給 2,000円〜', '¥9,800/月': '月給 28万円〜', '基本機能\nメールサポート\n1ユーザー': '9:00〜18:00\n土日祝休み\n車通勤可', 'すべての機能\nチャットサポート\n5ユーザー': '週2日〜OK\n1日4時間〜\n扶養内の相談可', 'すべての機能\n電話サポート\nユーザー数無制限': '9:00〜18:00\n土日祝休み\n経験1年以上', 'このプランにする': '応募する' }],
          ['faq', { '無料で試せますか？': '訪問看護の経験がなくても大丈夫ですか？', 'はい。30日間、すべての機能を無料でお使いいただけます。': 'はい。半数以上が、病院からの転職です。', '途中でプランを変更できますか？': 'パートから常勤に変われますか？', 'いつでも変更できます。変更は翌月から反映されます。': 'はい。ご希望に合わせて相談できます。', '解約に費用はかかりますか？': '車の運転は必要ですか？', '解約手数料はかかりません。': '電動自転車での訪問もできます。' }],
        ],
      },
      {
        name: '応募する',
        slug: 'entry',
        sections: [['contact', { 'お問い合わせ': '応募・見学のお申し込み', 'ご質問・ご相談は、こちらからお気軽にどうぞ。': '2〜3日以内に、担当からご連絡します。' }]],
      },
    ],
  },
];

// 文章を置き換える（ひな形の文章そのもの、または一部）
function replaceText(text: string, texts: Texts): string {
  if (texts[text] !== undefined) return texts[text];
  return Object.entries(texts).reduce((t, [from, to]) => (from.length > 1 && t.includes(from) ? t.split(from).join(to) : t), text);
}

// セクションを、要素の配列の下（top から）に入れる
function placeSection(id: string, screenW: number, els: PageElement[], top: number, texts: Texts, headingFont: string): { els: PageElement[]; h: number } {
  const layout = buildSection(id, screenW);
  if (!layout) return { els, h: 0 };
  const group = nextGroupId(els);
  let out = els;
  for (const part of layout.parts) {
    const el = createElement(part.type, nextId(out), {
      ...part,
      y: part.y + top,
      group,
      ...(part.text !== undefined ? { text: replaceText(part.text, texts) } : {}),
      ...(part.type === 'heading' ? { fontFamily: headingFont } : {}),
    });
    out = [...out, el];
  }
  return { els: out, h: layout.h };
}

// ボタンとメニューを、文章が同じページへリンクする
function linkTo(els: PageElement[], pages: Page[], labels: string[]): PageElement[] {
  const pageOf = (label: string) => {
    const i = labels.indexOf(label);
    return i >= 0 ? pages[i] : pages.find((p) => p.name === label);
  };
  return els.map((e) => {
    if (e.type === 'nav') {
      const lines = e.text.split('\n').map((l) => {
        const p = pageOf(l.trim());
        return p ? `${l.trim()} | ${p.id}` : l;
      });
      return { ...e, text: lines.join('\n') };
    }
    if (e.type !== 'button' || e.submit) return e;
    const p = pageOf(e.text);
    return p ? { ...e, to: p.id } : e;
  });
}

// テンプレートからプロジェクトを作る
export function buildTemplate(t: SiteTemplate, screen: Screen): Project {
  const colors = DEFAULT_COLORS.map((c, i) => ({ ...c, value: t.colors[i] ?? c.value }));
  // ページ（ID とリンクのために先に作る）
  const pages: Page[] = [];
  for (const p of t.pages) {
    const page = createPage(pages, p.name);
    pages.push({ ...page, ...(p.slug ? { slug: p.slug } : {}), ...(pages.length === 0 ? { flow: { x: 40, y: 40 } } : {}) });
  }
  // メニューの項目はページへ（ページが1つならリンクなし）
  const menuLabels = t.menu;
  const menuPages = t.pages.length > 1 ? pages : [];

  const shared = (id: 'header' | 'footer', texts: Texts = {}) => {
    const all: Texts = { ...texts, 'サイト名': t.siteName };
    if (id === 'header') all['サービス\n会社概要\nお知らせ'] = menuLabels.join('\n');
    const { els } = placeSection(id, screen.w, [], 0, all, t.headingFont);
    return renameFor(id, linkTo(els, menuPages, menuLabels), []);
  };
  const header = shared('header', t.header);
  const footer = shared('footer', t.footer);
  const headerH = header.reduce((m, e) => Math.max(m, e.y + e.h), 0);

  t.pages.forEach((tp, i) => {
    let els: PageElement[] = [];
    let top = headerH;
    for (const [id, texts = {}] of tp.sections) {
      const r = placeSection(id, screen.w, els, top, texts, t.headingFont);
      els = r.els;
      top += r.h;
    }
    pages[i] = { ...pages[i], elements: linkTo(els, menuPages, menuLabels) };
  });

  return {
    version: 1,
    screen,
    pages,
    site: { ...DEFAULT_SITE, name: t.siteName, colors, header, footer, stickyHeader: true, backToTop: true },
  };
}
