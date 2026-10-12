import keyframesCss from '../runtime/animations.css?raw';

export const ANIM_GROUPS: [string, [string, string][]][] = [
  ['フェード', [['fadeIn', 'フェードイン'], ['fadeOut', 'フェードアウト']]],
  ['スライド', [['slideLeft', '左からスライド'], ['slideRight', '右からスライド'], ['slideUp', '下からスライド'], ['slideDown', '上からスライド']]],
  ['スケール', [['zoomIn', 'ズームイン'], ['zoomOut', 'ズームアウト']]],
  ['注目', [['bounce', 'バウンス'], ['pulse', 'パルス'], ['shake', 'シェイク'], ['spin', '回転'], ['flip', 'フリップ'], ['rubberBand', 'ラバーバンド'], ['swing', 'スウィング'], ['tada', 'タダ！'], ['heartbeat', '鼓動']]],
];

export const ANIM_NAMES = ANIM_GROUPS.flatMap(([, list]) => list.map(([v]) => v));

// animations.css を1行ずつキーフレーム名で引けるようにする（書き出し時に使用分だけ出力するため）
export const KEYFRAMES: Record<string, string> = Object.fromEntries(
  keyframesCss
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('@keyframes kf-'))
    .map((line) => [line.slice('@keyframes kf-'.length, line.indexOf('{')), line]),
);

export const ITERATIONS = [['1', '1回'], ['2', '2回'], ['3', '3回'], ['infinite', 'ループ']];
export const EASINGS = [
  ['ease', 'ease'], ['ease-in', 'ease-in'], ['ease-out', 'ease-out'], ['ease-in-out', 'ease-in-out'],
  ['linear', 'linear'], ['cubic-bezier(0.34,1.56,0.64,1)', 'spring'],
];
export const DIRECTIONS = ['normal', 'reverse', 'alternate'];
export const TRIGGERS = [['onLoad', 'ページ読込時'], ['onClick', 'クリック時'], ['onHover', 'ホバー時']];

export const SHADOWS: [string, string][] = [
  ['none', 'なし'],
  ['0 1px 3px rgba(0,0,0,.12)', '小'],
  ['0 4px 14px rgba(0,0,0,.14)', '中'],
  ['0 12px 32px rgba(0,0,0,.18)', '大'],
];

export const FONTS: [string, string][] = [
  ["'DM Sans',sans-serif", 'DM Sans'],
  ["'Playfair Display',serif", 'Playfair Display'],
  ["'DM Mono',monospace", 'DM Mono'],
  ['sans-serif', 'sans-serif'],
  ['serif', 'serif'],
  ['monospace', 'monospace'],
  ['Georgia,serif', 'Georgia'],
  ['Arial,sans-serif', 'Arial'],
];
