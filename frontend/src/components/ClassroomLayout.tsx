'use client';

import {
  buildLayoutMatrix,
  ClassroomLayoutPlan,
  ClassroomSeat,
  getLayoutStats,
} from '@/lib/classroom-layout';

type ClassroomLayoutProps = {
  layout: ClassroomLayoutPlan;
  editable?: boolean;
  onSeatClick?: (seat: ClassroomSeat) => void;
  title?: string;
  subtitle?: string;
  showLegend?: boolean;
};

export default function ClassroomLayout({
  layout,
  editable = false,
  onSeatClick,
  title = 'Fiziki Oturma Planı',
  subtitle = 'Sınıfın grid (matris) görünümü',
  showLegend = true,
}: ClassroomLayoutProps) {
  const grid = buildLayoutMatrix(layout);
  const stats = getLayoutStats(layout);

  return (
    <div className="bg-white dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        {showLegend ? (
          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-teal-500"></span> Aktif</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gray-200 dark:bg-gray-700"></span> Boşluk/Koridor</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-rose-500"></span> Pasif/Bozuk</div>
          </div>
        ) : null}
      </div>

      <div className="w-full md:w-1/2 mx-auto h-12 mb-12 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm shadow-inner relative">
        Öğretmen / Tahta
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 text-[10px] text-gray-400">
          <span>Ön</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div
        className="mx-auto grid gap-4 place-items-center overflow-x-auto pb-2"
        style={{ gridTemplateColumns: `repeat(${layout.sutunSayisi}, minmax(64px, 1fr))` }}
      >
        {grid.flat().map((seat) => {
          const isAktif = seat.durum === 'Aktif';
          const isBosluk = seat.durum === 'Boşluk';
          const isClickable = editable && onSeatClick;

          if (isBosluk) {
            return (
              <button
                key={`${seat.satir}-${seat.sutun}`}
                type="button"
                onClick={() => onSeatClick?.(seat)}
                disabled={!isClickable}
                className={`w-16 h-16 flex items-center justify-center rounded-xl transition-all ${
                  isClickable ? 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'
                }`}
                title={editable ? `${seat.siraNo} - Boşluk` : undefined}
              >
                <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 opacity-50"></span>
              </button>
            );
          }

          return (
            <button
              key={`${seat.satir}-${seat.sutun}`}
              type="button"
              onClick={() => onSeatClick?.(seat)}
              disabled={!isClickable}
              title={`${seat.siraNo} - ${seat.durum}`}
              className={`
                group relative w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-md transition-all border-2
                ${isAktif
                  ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-300'
                  : 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-800/50 text-rose-500 dark:text-rose-400 opacity-70'}
                ${isClickable ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
              `}
            >
              <span className="text-xs font-black">{seat.siraNo}</span>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: seat.kapasite }).map((_, index) => (
                  <span
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full ${isAktif ? 'bg-teal-400' : 'bg-rose-400'}`}
                  ></span>
                ))}
              </div>

              {isClickable ? (
                <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap">
                  Durumu değiştir
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {editable ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>Hücreye tıklayarak durum değiştir.</span>
          <span>Aktif: {stats.aktifSira}</span>
          <span>Pasif: {stats.pasifSira}</span>
          <span>Boşluk: {stats.boslukSayisi}</span>
        </div>
      ) : null}
    </div>
  );
}
