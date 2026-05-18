# Examus

Examus, üniversite sınav dönemleri için sınav takvimi, derslik kapasitesi, öğrenci oturma düzeni, gözetmen ataması, çakışma kontrolü ve raporlama akışlarını yöneten bir sınav planlama sistemidir.

Bu sürüm, `examus_gereksinim_dokumani.md` içindeki tam v1 hedeflerine göre Express + Prisma + PostgreSQL backend ve Next.js frontend olarak güncellenmiştir.

## Özellikler

- Rol bazlı kullanıcı altyapısı ve JWT kimlik doğrulama
- Öğrenci, ders, derslik, gözetmen, sınav ve sınav dönemi yönetimi
- CSV/XLSX veri içe aktarma
- Import önizleme, CSV şablonları ve otomatik öğrenci/gözetmen hesap üretimi
- Sınav dönemi bazlı planlama senaryoları
- Kapasite, öğrenci çakışması, salon çakışması ve gözetmen çakışması kontrolleri
- Otomatik salon, sıra ve gözetmen atama
- Manuel sınav zamanı ve oturma düzeni müdahalesi için endpointler
- Manuel düzenleme sonrası hard constraint validasyonu
- LLM destekli AI önerileri ve heuristic fallback
- PDF/Excel rapor çıktıları
- Rol bazlı dashboard, operasyon detayları ve filtreli raporlar
- Canlı API kullanan Next.js yönetim paneli

## Teknoloji Stack

Backend:

- Node.js
- Express
- Prisma
- PostgreSQL
- JWT
- bcryptjs
- multer
- xlsx / csv-parse
- exceljs
- pdfkit

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

## Proje Yapısı

```text
.
├── index.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
├── frontend/
│   └── src/
├── docs/
│   └── examus-v1-degisiklikleri.md
├── test/
└── examus_gereksinim_dokumani.md
```

## Kurulum

Backend bağımlılıkları kök dizinde, frontend bağımlılıkları `frontend/` dizinindedir.

```bash
npm install
cd frontend
npm install
```

## Ortam Değişkenleri

Kök dizindeki `.env.example` dosyasını referans alarak `.env` oluşturun:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/examus?schema=public"
JWT_SECRET="change-me"
AI_PROVIDER="heuristic"
AI_API_KEY=""
AI_MODEL=""
PORT=5001
```

Gerçek LLM önerileri için:

```bash
AI_PROVIDER="openai"
AI_API_KEY="..."
AI_MODEL="gpt-4o-mini"
```

AI anahtarı tanımlanmadığında sistem heuristic öneri üretir.

## CP-SAT Optimizasyon

Varsayılan sınav planlama akışı Python OR-Tools CP-SAT worker kullanır. Backend bağımlılıklarına ek olarak Python bağımlılığını kurun:

```bash
npm run python:setup
```

Bu komut repo içinde `.venv` oluşturur ve OR-Tools’u sistem Python’una dokunmadan oraya kurar. Manuel kurulum isterseniz:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

OR-Tools kurulu değilse `optimal_cp_sat` planlama çalıştırması anlaşılır hata ile `FAILED` döner. Eski JS tabanlı planlayıcıyı kullanmak için planlama stratejisini `heuristic` seçin.

## Veritabanı

PostgreSQL çalışır durumda olmalıdır. Sonra Prisma client ve migration çalıştırılır:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Prisma schema:

```text
prisma/schema.prisma
```

İlk migration:

```text
prisma/migrations/20260514120000_init/migration.sql
```

## Çalıştırma

Backend:

```bash
npm run dev
```

Backend varsayılan adres:

```text
http://localhost:5001
```

Backend dev komutu watch mode kullanmaz. Backend dosyalarında değişiklik yaptıktan sonra `npm run dev` sürecini durdurup yeniden başlatın.

Frontend:

```bash
cd frontend
npm run dev
```

Frontend varsayılan adres:

```text
http://localhost:3000
```

İlk kurulumda:

1. `http://localhost:3000/login` adresine gidin.
2. “İlk admin hesabını oluştur” butonunu kullanın.
3. Ardından panel üzerinden veri yükleme, dönem oluşturma ve planlama akışını başlatın.

Öğrenci ve gözetmen importları bağlı kullanıcı hesabını otomatik oluşturur. İlk şifre `12345678` olarak hash’lenir ve kullanıcı ilk girişte yeni şifre belirlemek zorundadır.

## Veri Yükleme

Veri yükleme ekranında her import tipi için CSV şablonu indirilebilir. Dosya önce “Önizle” akışından geçirilir:

- Eksik zorunlu kolonlar ve tanınmayan kolonlar gösterilir.
- Department eşleşmeleri listelenir; bölüm koordinatörü importu kendi bölümüne sabitlenir.
- Yeni/güncellenecek kayıt sayısı ve otomatik oluşturulacak öğrenci/gözetmen hesabı sayısı gösterilir.
- Hatalı satır varsa import başlatılmaz.

## Rol Bazlı Kullanım

Beş rol desteklenir: `ADMIN`, `DEPARTMENT_MANAGER`, `INSTRUCTOR`, `INVIGILATOR`, `STUDENT`.

- Admin tüm sistemi, planlama çalıştırma/onaylama aksiyonlarını ve tüm raporları görür.
- Bölüm koordinatörü kendi bölümünün operasyonunu ve raporunu görür; planlama çalıştıramaz.
- Ders sorumlusu kendi derslerinin sınav, salon, öğrenci yerleşimi ve gözetmen özetini görür.
- Gözetmen kendi görevlerini, salon/kapı listesini ve tam oturma düzenini görür.
- Öğrenci kendi sınavlarını, salonunu, koltuğunu ve kitapçık bilgisini görür.

Detaylı matris için `docs/rol-yetki-matrisi.md` dosyasına bakın.

## Ana API Grupları

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/bootstrap-admin`
- `/api/users`
- `/api/students`
- `/api/courses`
- `/api/classrooms`
- `/api/invigilators`
- `/api/exams`
- `GET /api/exams/:id/operations`
- `/api/exam-periods`
- `/api/imports`
- `POST /api/imports/:type/preview`
- `/api/planning/scenarios`
- `/api/ai/scenarios/:id/insights`
- `/api/reports/scenarios/:id/calendar.xlsx`
- `/api/reports/scenarios/:id/calendar.pdf`

Türkçe alias endpointleri:

- `/api/derslikler`
- `/api/gozetmenler`
- `/api/sinavlar`

## Test ve Doğrulama

Backend testleri:

```bash
npm test
```

Prisma doğrulama:

```bash
npx prisma validate
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend build:

```bash
cd frontend
npm run build
```

## Dokümantasyon

Tam v1 değişiklik dokümanı:

```text
docs/examus-v1-degisiklikleri.md
```

Gereksinim dokümanı:

```text
examus_gereksinim_dokumani.md
```

## Notlar

- PostgreSQL bağlantısı yoksa backend çalışır, ancak `/api/health` içinde `db.connected` değeri `false` döner.
- Rapor indirme endpointleri auth gerektirir; frontend token’ı indirme linklerine query parametresi olarak ekler.
- Next.js build sırasında Turbopack workspace root ayarı `frontend/next.config.ts` içinde tanımlanmıştır.
