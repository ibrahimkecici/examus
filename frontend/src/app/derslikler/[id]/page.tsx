import Link from 'next/link';
import ClassroomLayout from '@/components/ClassroomLayout';
import { ClassroomLayoutPlan, getLayoutStats } from '@/lib/classroom-layout';

// Şablon olarak kullanacağımız parametre arayüzü
export default function DerslikDetay({ params }: { params: { id: string } }) {
  // Gerçek uygulamada burada params.id üzerinden API'den veri çekilecek.
  // Aşağıdaki mock datayı veritabanı şemanıza ("ad", "bina", "kapasite", "yerlesimPlani") tam uygun hazırladım.
  
  const yerlesimPlani: ClassroomLayoutPlan = {
    satirSayisi: 5,
    sutunSayisi: 6,
    siralar: [
      ...Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => {
          const satir = r + 1;
          const sutun = c + 1;
          let durum: 'Aktif' | 'Pasif' | 'Boşluk' = 'Aktif';

          if (sutun === 3) durum = 'Boşluk';
          else if (satir === 5 && sutun === 6) durum = 'Pasif';

          return {
            siraNo: `${String.fromCharCode(64 + satir)}${sutun}`,
            satir,
            sutun,
            durum,
            kapasite: 1,
          };
        }),
      ).flat(),
    ],
  };

  const layoutStats = getLayoutStats(yerlesimPlani);

  const mockDerslik = {
    _id: params.id,
    ad: 'Bilişim Lab - Z14',
    bina: 'Mühendislik Fakültesi',
    kapasite: layoutStats.toplamKapasite,
    aktifSira: layoutStats.aktifSira,
    pasifSira: layoutStats.pasifSira,
    yerlesimPlani,
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      {/* Header Kısmı */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6 relative">
        <div className="flex items-start gap-4 z-10">
          <Link href="/derslikler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">{mockDerslik.ad}</h2>
              <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Detay
              </span>
            </div>
            <p className="text-gray-500 font-medium">📍 {mockDerslik.bina}</p>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex gap-3 z-10">
          <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm">
            <span>✏️</span> Düzenle
          </button>
          <button className="px-4 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-2 shadow-sm">
            <span>🗑️</span> Sil
          </button>
        </div>
      </header>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center text-xl">👥</div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Toplam Kapasite</p>
            <p className="text-2xl font-bold">{mockDerslik.kapasite} Öğrenci</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xl">🪑</div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Aktif Oturulabilir Sıra</p>
            <p className="text-2xl font-bold">{mockDerslik.aktifSira}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center text-xl">⚠️</div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pasif / Arızalı Sıra</p>
            <p className="text-2xl font-bold">{mockDerslik.pasifSira}</p>
          </div>
        </div>
      </div>

      <ClassroomLayout layout={mockDerslik.yerlesimPlani} />
    </div>
  );
}
