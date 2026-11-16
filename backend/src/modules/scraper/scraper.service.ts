import * as cheerio from 'cheerio';

// Стильна векторна SVG-заглушка у м'яких шавлієво-зелених відтінках (Sage Wellness)
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none">
  <rect width="240" height="240" rx="40" fill="#EDF3EF"/>
  <circle cx="120" cy="120" r="72" fill="#DCE8E0"/>
  <g transform="rotate(-35 120 120)">
    <rect x="92" y="64" width="56" height="112" rx="28" fill="#FFFFFF" stroke="#52796F" stroke-width="6"/>
    <path d="M92 120H148V148C148 163.464 135.464 176 120 176C104.536 176 92 163.464 92 148V120Z" fill="#749F82"/>
    <line x1="92" y1="120" x2="148" y2="120" stroke="#52796F" stroke-width="6"/>
  </g>
</svg>`;

export const DEFAULT_MEDICATION_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  FALLBACK_SVG
)}`;

export interface ScrapePreviewResult {
  imageUrl: string;
  title?: string;
  isFallback: boolean;
}

export class ScraperService {
  private isDirectImageUrl(url: string): boolean {
    return /\.(jpeg|jpg|gif|png|webp|avif|svg)(\?.*)?$/i.test(url);
  }

  private resolveUrl(baseUrl: string, candidateUrl?: string | null): string | null {
    if (!candidateUrl || !candidateUrl.trim()) {
      return null;
    }
    const trimmed = candidateUrl.trim();
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    try {
      return new URL(trimmed, baseUrl).toString();
    } catch {
      return null;
    }
  }

  async extractPreviewFromUrl(rawUrl?: string): Promise<ScrapePreviewResult> {
    if (!rawUrl || !rawUrl.trim()) {
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          imageUrl: DEFAULT_MEDICATION_IMAGE,
          isFallback: true,
        };
      }
    } catch {
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
      };
    }

    const targetUrl = parsedUrl.toString();

    if (this.isDirectImageUrl(targetUrl)) {
      return {
        imageUrl: targetUrl,
        isFallback: false,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        return {
          imageUrl: targetUrl,
          isFallback: false,
        };
      }

      if (!response.ok) {
        return {
          imageUrl: DEFAULT_MEDICATION_IMAGE,
          isFallback: true,
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 1. Перевірка OpenGraph та Twitter Card мета-тегів
      const metaSelectors = [
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image"]',
        'meta[itemprop="image"]',
      ];

      for (const selector of metaSelectors) {
        const content = $(selector).first().attr('content');
        const resolved = this.resolveUrl(targetUrl, content);
        if (resolved) {
          const pageTitle =
            $('meta[property="og:title"]').attr('content') ||
            $('title').first().text().trim() ||
            undefined;
          return {
            imageUrl: resolved,
            title: pageTitle,
            isFallback: false,
          };
        }
      }

      // 2. Перевірка link[rel="image_src"]
      const linkImg = $('link[rel="image_src"]').first().attr('href');
      const resolvedLinkImg = this.resolveUrl(targetUrl, linkImg);
      if (resolvedLinkImg) {
        return {
          imageUrl: resolvedLinkImg,
          title: $('title').first().text().trim() || undefined,
          isFallback: false,
        };
      }

      // 3. Перевірка JSON-LD мікророзмітки продукту (часто в інтернет-аптеках)
      const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
      for (const scriptEl of jsonLdScripts) {
        try {
          const rawJson = $(scriptEl).html();
          if (!rawJson) continue;
          const parsed = JSON.parse(rawJson);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            const imgField = item?.image || item?.thumbnailUrl;
            const candidate = Array.isArray(imgField)
              ? typeof imgField[0] === 'string'
                ? imgField[0]
                : imgField[0]?.url
              : typeof imgField === 'string'
              ? imgField
              : imgField?.url;
            const resolved = this.resolveUrl(targetUrl, candidate);
            if (resolved) {
              return {
                imageUrl: resolved,
                title: item?.name || $('title').first().text().trim() || undefined,
                isFallback: false,
              };
            }
          }
        } catch {
          // Ігноруємо некоректний JSON-LD блок
        }
      }

      // 4. Пошук першого релевантного зображення товару на сторінці
      const productImg = $(
        'main img[src], article img[src], .product img[src], img[src]'
      )
        .filter((_, el) => {
          const src = $(el).attr('src') || '';
          return (
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('sprite') &&
            !src.endsWith('.svg')
          );
        })
        .first()
        .attr('src');

      const resolvedProductImg = this.resolveUrl(targetUrl, productImg);
      if (resolvedProductImg) {
        return {
          imageUrl: resolvedProductImg,
          title: $('title').first().text().trim() || undefined,
          isFallback: false,
        };
      }

      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
      };
    } catch {
      clearTimeout(timeoutId);
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
      };
    }
  }
}

export const scraperService = new ScraperService();
