// 画像ファイルを読み込み、プロジェクトに埋め込める data URL にする。大きな画像は縮小する。
export const MAX_IMAGE_SIZE = 2000; // 長い辺の最大（px）

export interface LoadedImage {
  dataUrl: string;
  ext: string; // png / jpg / gif / webp / svg
  w: number; // 縮小後の大きさ
  h: number;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

export function mimeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
}

export function isImageType(type: string): boolean {
  return type in EXT;
}

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 200 });
    img.onerror = () => reject(new Error('画像として読み込めません'));
    img.src = src;
  });
}

// 画像を描き直す（縮小・形式の変換）
async function redraw(dataUrl: string, w: number, h: number, type: string, quality: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(type, quality);
}

// WebP の画質。写真（JPEG）は少し下げても見た目はほとんど変わらない
const WEBP_QUALITY: Record<string, number> = { jpg: 0.82, png: 0.9, webp: 0.85 };

// optimize：Web で表示が速くなるよう、WebP にして小さくなるならそうする（ファビコン・SNS 用の画像は元の形式のまま）
export async function loadImage(blob: Blob, { optimize = true } = {}): Promise<LoadedImage> {
  let ext = EXT[blob.type];
  if (!ext) throw new Error('PNG・JPEG・GIF・WebP・SVG の画像を選んでください');
  let dataUrl = await readAsDataURL(blob);
  let { w, h } = await imageSize(dataUrl);
  // アニメーション GIF と SVG はそのまま
  if (ext === 'gif' || ext === 'svg') return { dataUrl, ext, w, h };
  // 大きければ縮小する
  const scale = MAX_IMAGE_SIZE / Math.max(w, h);
  if (scale < 1) {
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    dataUrl = await redraw(dataUrl, w, h, blob.type, 0.9);
  }
  if (optimize) {
    // WebP に対応していないブラウザでは PNG になるので、そのときは使わない
    const webp = await redraw(dataUrl, w, h, 'image/webp', WEBP_QUALITY[ext] ?? 0.85).catch(() => '');
    if (webp.startsWith('data:image/webp') && webp.length < dataUrl.length * 0.95) {
      dataUrl = webp;
      ext = 'webp';
    }
  }
  return { dataUrl, ext, w, h };
}

// data URL → バイト列（書き出しの zip に入れる）
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
