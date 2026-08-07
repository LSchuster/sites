import { useRef, useState } from 'react';
import { t } from '../i18n';
import type { LogoPosition, LogoSize } from '../model/invoice';
import { updateSeller, useAppState } from '../state/store';

/**
 * Optional company logo: drag & drop or file picker. The image is downscaled
 * on a canvas and stored as a PNG data URL in the local profile only —
 * consistent with "nothing leaves the browser". The PDF embeds it via
 * embedPng (see src/pdf/generate.ts), the preview shows it directly.
 */
const MAX_W = 1200;
const MAX_H = 480;

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

async function fileToLogoDataUrl(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file);
  } catch {
    // e.g. SVG files in some browsers — fall back to an <img> decode.
    source = await loadViaImg(file);
  }
  const srcW = source.width;
  const srcH = source.height;
  if (!srcW || !srcH) throw new Error('empty image');
  const scale = Math.min(1, MAX_W / srcW, MAX_H / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(source, 0, 0, w, h);
  if ('close' in source) source.close();
  return canvas.toDataURL('image/png');
}

export function LogoUpload() {
  const { invoice } = useAppState();
  const logo = invoice.seller.logoDataUrl;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      updateSeller({ logoDataUrl: await fileToLogoDataUrl(file) });
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="field grow">
      <span className="field-label">{t.logoLabel}</span>
      {logo ? (
        <div className="logo-row">
          <img className="logo-thumb" src={logo} alt="Logo" />
          <label className="field">
            <span className="field-label">{t.logoSize}</span>
            <select
              value={invoice.seller.logoSize ?? 'M'}
              onChange={(e) => updateSeller({ logoSize: e.target.value as LogoSize })}
            >
              <option value="S">{t.logoSizeS}</option>
              <option value="M">{t.logoSizeM}</option>
              <option value="L">{t.logoSizeL}</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.logoPosition}</span>
            <select
              value={invoice.seller.logoPosition ?? 'right'}
              onChange={(e) => updateSeller({ logoPosition: e.target.value as LogoPosition })}
            >
              <option value="left">{t.logoLeft}</option>
              <option value="right">{t.logoRight}</option>
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            onClick={() => updateSeller({ logoDataUrl: undefined })}
          >
            {t.logoRemove}
          </button>
        </div>
      ) : (
        <div
          className={dragOver ? 'dropzone over' : 'dropzone'}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          {t.logoDrop}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {error ? (
        <span className="error" role="alert">
          {t.logoError}
        </span>
      ) : null}
    </div>
  );
}
