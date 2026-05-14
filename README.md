# Examus

Examus, üniversite sınav dönemleri için sınav takvimi, derslik kapasitesi, öğrenci oturma düzeni, gözetmen ataması, çakışma kontrolü ve raporlama akışlarını yöneten bir sınav planlama sistemidir.

Bu sürüm, `examus_gereksinim_dokumani.md` içindeki tam v1 hedeflerine göre Express + Prisma + PostgreSQL backend ve Next.js frontend olarak güncellenmiştir.

## Özellikler

- Rol bazlı kullanıcı altyapısı ve JWT kimlik doğrulama
- Öğrenci, ders, derslik, gözetmen, sınav ve sınav dönemi yönetimi
- CSV/XLSX veri içe aktarma
- Sınav dönemi bazlı planlama senaryoları
- Kapasite, öğrenci çakışması, salon çakışması ve gözetmen çakışması kontrolleri
- Otomatik salon, sıra ve gözetmen atama
- Manuel sınav zamanı ve oturma düzeni müdahalesi için endpointler
- LLM destekli AI önerileri ve heuristic fallback
- PDF/Excel rapor çıktıları
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
- `/api/exam-periods`
- `/api/imports`
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
