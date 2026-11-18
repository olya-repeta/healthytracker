import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FeedbackRecord {
  id: string;
  type: 'feedback' | 'donate_click';
  rating?: number | null;
  comment?: string | null;
  userId?: string | null;
  createdAt: string;
}

export class FeedbackStore {
  private items: FeedbackRecord[] = [];
  private filePath: string;

  constructor(customFilePath?: string) {
    this.filePath =
      customFilePath ||
      path.resolve(process.cwd(), 'data', 'feedback_store.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch {
      // Якщо файл пошкоджено або немає доступу, продовжуємо з пам'яттю
      this.items = [];
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch {
      // Безпечний фолбек для середовищ з файловою системою read-only
    }
  }

  add(record: Omit<FeedbackRecord, 'id' | 'createdAt'>): FeedbackRecord {
    const item: FeedbackRecord = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()),
      type: record.type,
      rating: record.rating ?? null,
      comment: record.comment ? record.comment.trim() : null,
      userId: record.userId ?? null,
      createdAt: new Date().toISOString(),
    };
    this.items.push(item);
    this.saveToDisk();
    return item;
  }

  getStats(): { feedbackCount: number; donateClicks: number; totalEntries: number } {
    const feedbackCount = this.items.filter((i) => i.type === 'feedback').length;
    const donateClicks = this.items.filter((i) => i.type === 'donate_click').length;
    return {
      feedbackCount,
      donateClicks,
      totalEntries: this.items.length,
    };
  }

  getAll(): FeedbackRecord[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
    this.saveToDisk();
  }
}

export const feedbackStore = new FeedbackStore();
