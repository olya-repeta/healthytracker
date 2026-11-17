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
  source?: string;
  reason?: string;
}

export class ScraperService {
  private isDirectImageUrl(url: string): boolean {
    return /\.(jpeg|jpg|gif|png|webp|avif|svg)(\?.*)?$/i.test(url);
  }

  /**
   * Перевіряє, чи не є URL технічною іконкою, логотипом, банером або порожнім пікселем
   */
  private isExcludedNonProductImage(url: string): boolean {
    const lower = url.toLowerCase();
    if (lower.startsWith('data:image/gif') || lower.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE')) {
      return true;
    }
    const excludedPatterns = [
      'logo',
      'favicon',
      'sprite',
      'icon',
      'avatar',
      'banner',
      '/bmg/',
      '2560x30',
      'pixel',
      'placeholder',
      'no-image',
      'no_image',
      'noimage',
      'nophoto',
      'no-photo',
      'no_photo',
      'loader',
      'spinner',
      'flag',
      'payment',
      'visa',
      'mastercard',
    ];
    if (lower.endsWith('.svg') || lower.includes('.svg?')) {
      return true;
    }
    return excludedPatterns.some((pattern) => lower.includes(pattern));
  }

  /**
   * Конвертує відносний або протокол-незалежний URL у валідний абсолютний URL
   */
  private resolveUrl(baseUrl: string, candidateUrl?: string | null): string | null {
    if (!candidateUrl || !candidateUrl.trim()) {
      return null;
    }
    const trimmed = candidateUrl.trim();
    if (trimmed.startsWith('data:image/')) {
      return this.isExcludedNonProductImage(trimmed) ? null : trimmed;
    }
    try {
      const absolute = new URL(trimmed, baseUrl).href;
      if (!['http:', 'https:'].includes(new URL(absolute).protocol)) {
        return null;
      }
      return absolute;
    } catch {
      return null;
    }
  }

  /**
   * Витягує найкращий URL із атрибута srcset (бере останній/найбільший варіант)
   */
  private parseBestFromSrcset(srcset?: string | null): string | null {
    if (!srcset || !srcset.trim()) return null;
    const parts = srcset
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }

  /**
   * Рекурсивно шукає зображення продукту в об'єктах JSON-LD (Product, Drug, DietarySupplement, ImageObject)
   */
  private extractFromJsonLdNode(
    node: unknown,
    baseUrl: string
  ): { imageUrl: string; title?: string } | null {
    if (!node || typeof node !== 'object') return null;

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.extractFromJsonLdNode(item, baseUrl);
        if (found) return found;
      }
      return null;
    }

    const obj = node as Record<string, unknown>;

    // Якщо є @graph — рекурсивно перевіряємо його елементи
    if (Array.isArray(obj['@graph'])) {
      const foundInGraph = this.extractFromJsonLdNode(obj['@graph'], baseUrl);
      if (foundInGraph) return foundInGraph;
    }

    const rawType = obj['@type'];
    const types = Array.isArray(rawType)
      ? rawType.map(String)
      : rawType
      ? [String(rawType)]
      : [];

    // Ігноруємо мікророзмітку самої організації чи магазину, щоб не взяти логотип сайту
    const ignoredTypes = ['Organization', 'Store', 'Pharmacy', 'WebSite', 'BreadcrumbList', 'FAQPage'];
    if (types.some((t) => ignoredTypes.includes(t))) {
      return null;
    }

    const productTypes = ['Product', 'IndividualProduct', 'Drug', 'DietarySupplement', 'ImageObject'];
    const isProductOrImageNode =
      types.some((t) => productTypes.includes(t)) || 'sku' in obj || 'offers' in obj;

    if (!isProductOrImageNode) {
      return null;
    }

    const rawCandidates: unknown[] = [
      obj.image,
      obj.contentUrl,
      obj.thumbnailUrl,
      obj.url && types.includes('ImageObject') ? obj.url : undefined,
    ];

    for (const field of rawCandidates) {
      if (!field) continue;
      const list = Array.isArray(field) ? field : [field];
      for (const entry of list) {
        let candidateStr: string | undefined;
        if (typeof entry === 'string') {
          candidateStr = entry;
        } else if (entry && typeof entry === 'object') {
          const entryObj = entry as Record<string, unknown>;
          candidateStr =
            (typeof entryObj.contentUrl === 'string' && entryObj.contentUrl) ||
            (typeof entryObj.url === 'string' && entryObj.url) ||
            undefined;
        }

        const resolved = this.resolveUrl(baseUrl, candidateStr);
        if (resolved && !this.isExcludedNonProductImage(resolved)) {
          return {
            imageUrl: resolved,
            title: typeof obj.name === 'string' ? obj.name : undefined,
          };
        }
      }
    }

    return null;
  }

  async extractPreviewFromUrl(rawUrl?: string): Promise<ScrapePreviewResult> {
    console.log(`[Scraper] Запит на парсинг URL: "${rawUrl || ''}"`);

    if (!rawUrl || !rawUrl.trim()) {
      console.warn('[Scraper] Порожній URL -> повертаємо fallback-заглушку');
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
        reason: 'empty_url',
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.warn(`[Scraper] Непідтримуваний протокол (${parsedUrl.protocol}) -> fallback`);
        return {
          imageUrl: DEFAULT_MEDICATION_IMAGE,
          isFallback: true,
          reason: 'invalid_protocol',
        };
      }
    } catch {
      console.warn(`[Scraper] Некоректний формат URL: "${rawUrl}" -> fallback`);
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
        reason: 'invalid_url',
      };
    }

    const targetUrl = parsedUrl.toString();

    if (this.isDirectImageUrl(targetUrl)) {
      console.log(`[Scraper] Передано пряме посилання на зображення: ${targetUrl}`);
      return {
        imageUrl: targetUrl,
        isFallback: false,
        source: 'direct_image_url',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const finalBaseUrl = response.url || targetUrl;
      const contentType = response.headers.get('content-type') || '';

      console.log(
        `[Scraper] Відповідь від сервера: HTTP ${response.status} (${contentType}), фінальний URL: ${finalBaseUrl}`
      );

      if (contentType.startsWith('image/')) {
        console.log(`[Scraper] Content-Type є зображенням: ${finalBaseUrl}`);
        return {
          imageUrl: finalBaseUrl,
          isFallback: false,
          source: 'image_content_type',
        };
      }

      if (!response.ok) {
        console.warn(
          `[Scraper] Сайт повернув помилку HTTP ${response.status} для ${finalBaseUrl} (можливий захист Cloudflare/WAF) -> fallback`
        );
        return {
          imageUrl: DEFAULT_MEDICATION_IMAGE,
          isFallback: true,
          reason: `http_${response.status}`,
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const pageTitle =
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').first().text().trim() ||
        undefined;

      // Пріоритет 1: OpenGraph (<meta property="og:image" ...> та secure_url)
      const ogSelectors = [
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[property="og:image:url"]',
      ];

      for (const selector of ogSelectors) {
        const content = $(selector).first().attr('content');
        const resolved = this.resolveUrl(finalBaseUrl, content);
        if (resolved && !this.isExcludedNonProductImage(resolved)) {
          console.log(`[Scraper] Знайдено фото через ${selector}: ${resolved}`);
          return {
            imageUrl: resolved,
            title: pageTitle,
            isFallback: false,
            source: selector,
          };
        }
      }

      // Пріоритет 2: Twitter Card та link[rel="image_src"]
      const twitterSelectors = [
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image:src"]',
        'meta[itemprop="image"]',
      ];

      for (const selector of twitterSelectors) {
        const content = $(selector).first().attr('content');
        const resolved = this.resolveUrl(finalBaseUrl, content);
        if (resolved && !this.isExcludedNonProductImage(resolved)) {
          console.log(`[Scraper] Знайдено фото через ${selector}: ${resolved}`);
          return {
            imageUrl: resolved,
            title: pageTitle,
            isFallback: false,
            source: selector,
          };
        }
      }

      const linkImg = $('link[rel="image_src"]').first().attr('href');
      const resolvedLinkImg = this.resolveUrl(finalBaseUrl, linkImg);
      if (resolvedLinkImg && !this.isExcludedNonProductImage(resolvedLinkImg)) {
        console.log(`[Scraper] Знайдено фото через link[rel="image_src"]: ${resolvedLinkImg}`);
        return {
          imageUrl: resolvedLinkImg,
          title: pageTitle,
          isFallback: false,
          source: 'link[rel="image_src"]',
        };
      }

      // Пріоритет 3: Мікророзмітка application/ld+json (Product / ImageObject)
      const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
      for (const scriptEl of jsonLdScripts) {
        try {
          const rawJson = $(scriptEl).html();
          if (!rawJson) continue;
          const parsed = JSON.parse(rawJson);
          const extracted = this.extractFromJsonLdNode(parsed, finalBaseUrl);
          if (extracted) {
            console.log(
              `[Scraper] Знайдено фото через JSON-LD (Product/ImageObject): ${extracted.imageUrl}`
            );
            return {
              imageUrl: extracted.imageUrl,
              title: extracted.title || pageTitle,
              isFallback: false,
              source: 'json-ld',
            };
          }
        } catch {
          // Ігноруємо некоректний JSON-LD блок
        }
      }

      // Пріоритет 4: Зображення товару в DOM (<img> з src, data-src, data-lazy, data-original або srcset)
      const imgSelectors = [
        'img[itemprop="image"]',
        '[itemtype*="Product"] img',
        '.product-gallery img, .product-image img, .product-photo img, .product-media img, .gallery img',
        '.product img, #product img, [class*="product"] img',
        'main img, article img',
        'body img',
      ];

      for (const selector of imgSelectors) {
        const elements = $(selector).toArray();
        for (const el of elements) {
          const $el = $(el);
          const rawCandidate =
            $el.attr('data-src') ||
            $el.attr('data-lazy') ||
            $el.attr('data-lazy-src') ||
            $el.attr('data-original') ||
            $el.attr('data-zoom-image') ||
            this.parseBestFromSrcset($el.attr('data-srcset')) ||
            this.parseBestFromSrcset($el.attr('srcset')) ||
            $el.attr('src');

          const resolved = this.resolveUrl(finalBaseUrl, rawCandidate);
          if (!resolved || this.isExcludedNonProductImage(resolved)) {
            continue;
          }

          // Відсікаємо дрібні іконки, якщо вказані атрибути width/height < 64
          const widthAttr = parseInt($el.attr('width') || '0', 10);
          const heightAttr = parseInt($el.attr('height') || '0', 10);
          if ((widthAttr > 0 && widthAttr < 64) || (heightAttr > 0 && heightAttr < 64)) {
            continue;
          }

          console.log(`[Scraper] Знайдено фото через DOM (${selector}): ${resolved}`);
          return {
            imageUrl: resolved,
            title: pageTitle,
            isFallback: false,
            source: `dom:${selector}`,
          };
        }
      }

      console.warn(
        `[Scraper] На сторінці ${finalBaseUrl} не знайдено жодного релевантного фото товару -> fallback`
      );
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
        title: pageTitle,
        reason: 'no_image_found',
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Scraper] Помилка запиту до ${targetUrl}: ${errMsg} -> fallback`);
      return {
        imageUrl: DEFAULT_MEDICATION_IMAGE,
        isFallback: true,
        reason: 'fetch_error',
      };
    }
  }
}

export const scraperService = new ScraperService();
