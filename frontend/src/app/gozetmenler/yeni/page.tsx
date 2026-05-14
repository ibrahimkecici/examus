'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function YeniGozetmen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    ad: '',
    soyad: '',
    sicilNo: '',
    unvan: '',
    email: '',
    telefon: '',
    bolum: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/invigilators', { method: 'POST', body: JSON.stringify(formData) });
      router.push('/gozetmenler');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <Link href="/gozetmenler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Yeni Gözetmen Ekle</h2>
          <p className="text-gray-500 text-sm">Sisteme yeni bir personel (gözetmen) kaydedin.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800/40 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-8 relative overflow-hidden">
        {/* Dekoratif Arka Plan Işığı */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ad <span className="text-red-500">*</span></label>
            <input required type="text" name="ad" value={formData.ad} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Örn: Ahmet" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Soyad <span className="text-red-500">*</span></label>
            <input required type="text" name="soyad" value={formData.soyad} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Örn: Yılmaz" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sicil No <span className="text-red-500">*</span></label>
            <input required type="text" name="sicilNo" value={formData.sicilNo} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Benzersiz bir sicil numarası" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Unvan</label>
            <input type="text" name="unvan" value={formData.unvan} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Örn: Arş. Gör." />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="ornek@universite.edu.tr" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Telefon</label>
            <input type="text" name="telefon" value={formData.telefon} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="+90 XXX XXX XX XX" />
          </div>

          <div className="space-y-2 md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-6 mt-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bağlı Olduğu Bölüm/Departman</label>
            <input type="text" name="bolum" value={formData.bolum} onChange={handleChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Örn: Bilgisayar Mühendisliği" />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button disabled={loading} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2">
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span>Gözetmen Kaydet</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
