import React, { useState } from 'react';
import { Pill, MessageSquareHeart, ExternalLink, Heart } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';
import { MONOBANK_JAR_URL } from '../config/constants';
import { scheduleApi } from '../api/schedule.api';

export const Footer: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDonateClick = () => {
    // Неблокуюча відправка трекінгу кліку донату на бекенд
    scheduleApi.trackDonateClick().catch(() => {
      // Ігноруємо помилки мережі, якщо користувач офлайн
    });
  };

  return (
    <>
      <footer className="w-full bg-white/70 backdrop-blur-md border-t border-sage-100 py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 flex-wrap">
          {/* Бренд та копірайт */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-6 h-6 rounded-lg bg-sage-600 text-white flex items-center justify-center">
              <Pill className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-700">VitaTrack</span>
            <span className="text-slate-300">•</span>
            <span>Твій спокійний ритм прийому ліків</span>
          </div>

          {/* Адаптивні кнопки зворотного зв'язку та підтримки */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border border-sage-200 bg-white text-slate-700 hover:bg-sage-50 hover:text-sage-800 hover:border-sage-300 shadow-2xs transition active:scale-95"
            >
              <MessageSquareHeart className="w-4 h-4 text-sage-600" />
              <span>Залишити відгук</span>
            </button>

            <a
              href={MONOBANK_JAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDonateClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm hover:shadow transition group active:scale-95"
              title="Підтримати проєкт через Банку в Монобанку"
            >
              <Heart className="w-4 h-4 fill-white/30 text-white group-hover:scale-110 transition-transform" />
              <span>Підтримати проєкт 🫙</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-100 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </footer>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
