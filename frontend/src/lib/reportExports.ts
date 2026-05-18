import { CurrentUser } from '@/lib/auth';

export type ReportExport = {
  label: string;
  path: string;
  description?: string;
};

const ADMIN_PDF_EXPORTS: ReportExport[] = [
  { label: 'Kapsamlı Operasyon PDF', description: 'Özet, takvim, salon kapı listeleri, oturma planı, gözetmenler ve uyarılar.', path: 'full.pdf' },
  { label: 'Takvim PDF', description: 'Tarih, saat, salon, ders, kapasite ve gözetmen özeti.', path: 'calendar.pdf' },
  { label: 'Salon PDF', description: 'Salon bazlı kapı listeleri ve koltuk gridleri.', path: 'classrooms.pdf' },
  { label: 'Gözetmen PDF', description: 'Gözetmen görevleri, günlük ve toplam yük sayaçları.', path: 'invigilators.pdf' },
  { label: 'Öğrenci/Oturma PDF', description: 'Öğrenci no, ad, ders, kitapçık ve koltuk listesi.', path: 'students.pdf' },
];

const ADMIN_EXCEL_EXPORTS: ReportExport[] = [
  { label: 'Takvim Excel', path: 'calendar.xlsx' },
  { label: 'Gözetmen Excel', path: 'invigilators.xlsx' },
  { label: 'Öğrenci Excel', path: 'students.xlsx' },
  { label: 'Derslik Excel', path: 'classrooms.xlsx' },
];

const SINGLE_REPORT_BY_ROLE: Record<Exclude<CurrentUser['role'], 'ADMIN'>, ReportExport> = {
  DEPARTMENT_MANAGER: {
    label: 'Bölüm Raporu',
    description: 'Kendi bölümünüzle sınırlı takvim, salon, oturma ve görev bilgileri.',
    path: 'full.pdf',
  },
  INSTRUCTOR: {
    label: 'Derslerim',
    description: 'Sorumlu olduğunuz derslerin sınav saati, salonu ve öğrenci oturma özeti.',
    path: 'full.pdf',
  },
  INVIGILATOR: {
    label: 'Görev ve Oturma Düzeni',
    description: 'Size atanmış sınavların görev, salon, kapı listesi ve koltuk düzeni.',
    path: 'full.pdf',
  },
  STUDENT: {
    label: 'Sınavlarım',
    description: 'Kendi sınav saati, salonu, koltuğu ve kitapçık bilgisi.',
    path: 'students.pdf',
  },
};

export function getRoleReportExports(user: CurrentUser | null): {
  pdfExports: ReportExport[];
  excelExports: ReportExport[];
  allowSingleExamExport: boolean;
  note: string;
} {
  if (user?.role === 'ADMIN') {
    return {
      pdfExports: ADMIN_PDF_EXPORTS,
      excelExports: ADMIN_EXCEL_EXPORTS,
      allowSingleExamExport: true,
      note: 'PDF çıktıları sınav günü kullanımına göre ayrıldı. Tekil sınav çıktısını aşağıdaki listeden alabilirsiniz.',
    };
  }

  const role = user?.role ?? 'STUDENT';
  return {
    pdfExports: [SINGLE_REPORT_BY_ROLE[role]],
    excelExports: [],
    allowSingleExamExport: false,
    note: 'Rolünüze göre yalnızca gerekli olan tek rapor gösteriliyor.',
  };
}
