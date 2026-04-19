'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClassroomLayout from '@/components/ClassroomLayout';
import { getApiUrl } from '@/lib/api';
import {
  ClassroomLayoutPlan,
  createClassroomLayout,
  cycleSeatStatus,
  getLayoutStats,
  resizeClassroomLayout,
} from '@/lib/classroom-layout';

export default function YeniDerslik() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    ad: '',
    bina: '',
  });
  const [layout, setLayout] = useState<ClassroomLayoutPlan>(() => createClassroomLayout(5, 6));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const stats = getLayoutStats(layout);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (stats.aktifSira === 0) {
      setErrorMessage('Kaydetmeden önce en az bir aktif sıra bırakın.');
      return;
    }

    setLoading(true);

    const payload = {
      ad: formData.ad,
      bina: formData.bina,
      kapasite: stats.toplamKapasite,
      yerlesimPlani: layout,
    };

    try {
      const response = await fetch(getApiUrl('/derslikler'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || 'Derslik kaydedilemedi.');
      }

      setSuccessMessage('Derslik başarıyla kaydedildi. Listeye yönlendiriliyorsunuz.');
      setFormData({ ad: '', bina: '' });
      setLayout(createClassroomLayout(5, 6));

      window.setTimeout(() => {
        router.push('/derslikler');
      }, 800);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Beklenmeyen bir hata oluştu. API bağlantısını kontrol edin.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSeatToggle = (satir: number, sutun: number) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      siralar: currentLayout.siralar.map((seat) =>
        seat.satir === satir && seat.sutun === sutun
          ? { ...seat, durum: cycleSeatStatus(seat.durum) }
          : seat,
      ),
    }));
  };

  const handleResize = (type: 'satir' | 'sutun', delta: -1 | 1) => {
    setLayout((currentLayout) => {
      const nextSatir = type === 'satir' ? Math.max(1, currentLayout.satirSayisi + delta) : currentLayout.satirSayisi;
      const nextSutun = type === 'sutun' ? Math.max(1, currentLayout.sutunSayisi + delta) : currentLayout.sutunSayisi;

      return resizeClassroomLayout(currentLayout, nextSatir, nextSutun);
    });
  };

  const handlePreset = (satir: number, sutun: number) => {
    setLayout(createClassroomLayout(satir, sutun));
  };

  const handleReset = () => {
    setLayout(createClassroomLayout(layout.satirSayisi, layout.sutunSayisi));
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      <header className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <Link href="/derslikler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-teal-600 dark:text-teal-400">Yeni Derslik Oluştur</h2>
          <p className="text-gray-500 text-sm">Kat planı, kapasite ve fiziki bilgileri girin.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800/40 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-8 relative overflow-hidden">
        {/* Dekoratif Işık */}
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        {errorMessage ? (
          <div className="relative z-10 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="relative z-10 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300">
            {successMessage}
          </div>
        ) : null}

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-8 items-start">
          <div className="space-y-6">
            <h3 className="text-lg font-bold border-b border-gray-100 dark:border-gray-700 pb-2">Temel Bilgiler</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Derslik / Sınıf Adı <span className="text-red-500">*</span></label>
              <input required type="text" name="ad" value={formData.ad} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium" placeholder="Örn: BZ-04" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Toplam Öğrenci Kapasitesi</label>
              <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-semibold text-teal-600 dark:text-teal-400">
                {stats.toplamKapasite} öğrenci
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bulunduğu Bina</label>
              <input type="text" name="bina" value={formData.bina} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium" placeholder="Örn: Fakülte Binası, 2. Kat" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                <p className="text-xs text-gray-500 mb-1">Aktif sıra</p>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.aktifSira}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                <p className="text-xs text-gray-500 mb-1">Pasif sıra</p>
                <p className="text-2xl font-bold text-rose-500 dark:text-rose-400">{stats.pasifSira}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Harita Araçları</p>
                <p className="text-xs text-gray-500 mt-1">Satır ve sütunu alan kontrolüyle büyüt; koltuk durumlarını doğrudan haritada düzenle.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Satır</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleResize('satir', -1)} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">−</button>
                    <span className="w-10 text-center font-semibold">{layout.satirSayisi}</span>
                    <button type="button" onClick={() => handleResize('satir', 1)} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Sütun</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleResize('sutun', -1)} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">−</button>
                    <span className="w-10 text-center font-semibold">{layout.sutunSayisi}</span>
                    <button type="button" onClick={() => handleResize('sutun', 1)} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">+</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-400">Hazır Düzenler</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { satir: 4, sutun: 5 },
                    { satir: 5, sutun: 6 },
                    { satir: 6, sutun: 7 },
                  ].map((preset) => (
                    <button
                      key={`${preset.satir}-${preset.sutun}`}
                      type="button"
                      onClick={() => handlePreset(preset.satir, preset.sutun)}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {preset.satir} x {preset.sutun}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="w-full px-4 py-3 rounded-xl border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/30"
              >
                Haritayı Sıfırla
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <ClassroomLayout
              layout={layout}
              editable
              title="Yerleşim Planı Editörü"
              subtitle="Hücreye tıklayarak Aktif → Boşluk → Pasif akışında düzenleyin."
              onSeatClick={(seat) => handleSeatToggle(seat.satir, seat.sutun)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button disabled={loading} type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-teal-500/30 flex items-center gap-2">
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span>Dersliği Kaydet</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
