# Examus v1 Değişiklik Dokümantasyonu

Bu doküman, `examus_gereksinim_dokumani.md` içindeki tam v1 hedeflerine göre yapılan mimari ve ürün güncellemelerini özetler.

## Mimari Değişiklikler

- Backend artık Express + Prisma + PostgreSQL üzerinde çalışır.
- MongoDB/Mongoose tabanlı eski model, controller ve route dosyaları aktif koddan kaldırıldı.
- Prisma veri modeli `prisma/schema.prisma` içinde tanımlandı.
- İlk PostgreSQL migration SQL’i `prisma/migrations/20260514120000_init/migration.sql` altında eklendi.
- Backend API giriş noktası `index.js` içinde yeni route modülleriyle yeniden düzenlendi.
- Frontend Next.js paneli mock veriden çıkarılıp REST API ile çalışan sayfalara taşındı.

## Yeni Backend Kapsamı

Eklenen ana modüller:

- Kimlik doğrulama: JWT tabanlı login, mevcut kullanıcı bilgisi ve şifre değiştirme.
- Kullanıcı yönetimi: `ADMIN`, `DEPARTMENT_MANAGER`, `INSTRUCTOR`, `INVIGILATOR`, `STUDENT` rolleri.
- Veri yönetimi: öğrenci, ders, derslik, gözetmen, sınav ve sınav dönemi CRUD endpointleri.
- Veri içe aktarma: XLSX şablonları, önizleme, öğrenci/ders/derslik/gözetmen importu ve gerekli kullanıcı hesaplarının otomatik oluşturulması.
- Planlama: sınav dönemi üzerinden senaryo oluşturma, CP-SAT/heuristic stratejiyle planlama çalıştırma, tekrar kontrol, onaylama ve yeniden çakışma kontrolü.
- Oturma düzeni: derslik koltuk/sıra modeli ve öğrenci-sıra atamaları.
- Gözetmen atama: sınav ve senaryo bazlı gözetmen görevlendirme.
- AI önerileri: `heuristic`, OpenAI ve LM Studio OpenAI-compatible sağlayıcıları; provider başarısızsa deterministic heuristic fallback.
- Raporlama: sınav takvimi, oturma planı ve gözetmen listeleri için PDF/Excel çıktı endpointleri.

## Public API Özeti

Temel endpoint grupları:

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
- `/api/imports/*`
- `/api/planning/scenarios`
- `/api/ai/scenarios/:id/insights`
- `DELETE /api/ai/insights/:id`
- `/api/reports/scenarios/:id/*.xlsx`
- `/api/reports/scenarios/:id/*.pdf`

Geriye dönük uyumluluk için bazı Türkçe alias endpointleri korunmuştur:

- `/api/derslikler`
- `/api/gozetmenler`
- `/api/sinavlar`

## Frontend Değişiklikleri

Yeni veya güncellenen ekranlar:

- `/login`: giriş ve ilk admin oluşturma.
- `/`: dashboard, sayaçlar, son senaryolar ve plan sağlığı.
- `/veri-yukleme`: XLSX şablon indirme, import önizleme, loading durumları ve ders sorumlusu eşleştirme/oluşturma ekranı.
- `/ogrenciler`: öğrenci listeleme ve hızlı kayıt.
- `/dersler`: ders listeleme ve hızlı kayıt.
- `/derslikler`: canlı API ile derslik listesi.
- `/derslikler/[id]`: canlı derslik oturma planı.
- `/gozetmenler`: canlı API ile gözetmen listesi.
- `/gozetmenler/[id]`: gözetmen profil ve görev detayları.
- `/donemler`: sınav dönemi oluşturma ve listeleme.
- `/sinavlar`: canlı API ile sınav listesi.
- `/sinavlar/[id]`: sınav detay ve salon atamaları.
- `/planlama`: senaryo oluşturma, çalıştırma, tekrar kontrol, AI yorumu, eski AI önerisini silme ve onaylama.
- `/raporlar`: Excel/PDF çıktı linkleri.
- Tüm panel: kalıcı light/dark tema toggle.

## Veri Modeli

Prisma ana tabloları:

- `User`
- `Student`
- `Course`
- `CourseEnrollment`
- `Classroom`
- `Seat`
- `Invigilator`
- `Availability`
- `ExamPeriod`
- `Exam`
- `PlanningScenario`
- `ScenarioExamSchedule`
- `ExamRoomSlot`
- `ExamRoomAssignment`
- `SeatAssignment`
- `InvigilatorAssignment`
- `ImportBatch`
- `AiInsight`
- `AuditLog`

## Planlama Motoru Güncellemesi

Planlama motoru tek adımlı “ilk uygun atama” yaklaşımından ayrıldı. Yeni akışta sınav grubu, zaman dilimi, derslik ve gözetmen kombinasyonları skorlanır; hard constraint ihlali olan adaylar elenir.

Uygulanan kontroller:

- Aynı öğrencinin aynı saat aralığında iki sınavı olamaz.
- Aynı derslik aynı saat aralığında iki sınava atanamaz.
- Aynı gözetmen aynı saat aralığında iki göreve atanamaz.
- Derslik kapasitesi yetersizse aday geçersizdir.
- Gözetmen `maxAssignments` sınırı ve varsa availability kayıtları dikkate alınır.
- Gereksiz boş kapasite, büyük dersliği küçük sınava verme ve öğrenci günlük sınav yığılması cezalandırılır.
- `fair_invigilator` stratejisinde gözetmen yük dengesine daha yüksek ağırlık verilir.
- `efficient`, `compact`, `balanced`, `minimum_rooms`, `fair_invigilator` ve `student_friendly` stratejileri aday skorlarını farklı ağırlıklarla etkiler.

Senaryo bazlı tarih/saat planı için `ScenarioExamSchedule` modeli eklendi. Bu sayede farklı senaryolar aynı sınavlar için farklı zaman planları üretebilir. `Exam.date`, `Exam.startTime` ve `Exam.endTime` alanları onaylanan final plan için güncellenir.

Karma salon desteği için `ExamRoomSlot` modeli eklendi. Aynı süreli, ortak öğrencisi olmayan ve `requiresDedicatedRoom=true` olmayan küçük sınavlar aynı derslik slotunda birleştirilebilir. Karma salonlarda koltuklar ders kodlarına göre dönüşümlü yerleştirilir ve aynı ders öğrencilerinin yan yana/ön-arka kalması metriklere yazılır.

`PlanningScenario.metrics` artık şu kalite metriklerini içerir:

```json
{
  "score": 0,
  "usedDayCount": 0,
  "usedRoomCount": 0,
  "usedRoomSlotCount": 0,
  "studentConflictCount": 0,
  "roomConflictCount": 0,
  "invigilatorConflictCount": 0,
  "averageRoomUtilization": 0,
  "totalUnusedCapacity": 0,
  "invigilatorLoadDistribution": {},
  "specialNeedsHandledCount": 0,
  "specialNeedsWarningCount": 0,
  "mixedRoomCount": 0,
  "roomsSavedByMixing": 0,
  "invigilatorsSavedByMixing": 0,
  "averageMixedRoomUtilization": 0,
  "sameCourseAdjacentSeatCount": 0,
  "sameCourseFrontBackSeatCount": 0,
  "scoreBreakdown": {},
  "explanations": [],
  "warnings": []
}
```

## Rapor Kolonları

Excel çıktısındaki sayfalar genişletildi:

- `Genel Takvim`: tarih, saat, derslik, karma salon durumu, ders kodları/adları, süre, kapasite, atanan öğrenci, doluluk oranı, gözetmenler, özel ihtiyaç özeti ve uyarılar.
- `Oturma Planı`: tarih, saat, derslik kodu/adı, koltuk/sıra, öğrenci no/adı, ders kodu/adı, özel ihtiyaç ve not.
- `Gözetmenler`: gözetmen, sicil no, tarih, saat, derslik, karma salon durumu, dersler, rol, günlük görev sayısı, toplam görev sayısı ve özel ihtiyaç notları.

## Çalıştırma Akışı

1. PostgreSQL veritabanı oluşturulur.
2. `.env` içindeki `DATABASE_URL` gerçek PostgreSQL bağlantısına göre güncellenir.
3. Prisma client ve migration hazırlanır:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Backend başlatılır:

```bash
npm run dev
```

5. Frontend başlatılır:

```bash
cd frontend
npm run dev
```

6. Tarayıcıdan `http://localhost:3000/login` açılır.
7. İlk kurulumda “İlk admin hesabını oluştur” butonu ile admin kullanıcısı oluşturulur.

## Doğrulama

Uygulama değişiklikleri şu komutlarla doğrulandı:

```bash
npx prisma validate
find src -name '*.js' -print0 | xargs -0 -n1 node --check
npm test
cd frontend && npm run lint
cd frontend && npm run build
```

Not: `npm run build`, Next/Turbopack’in sandbox içinde port bind etmeye çalışması nedeniyle sandbox dışında çalıştırılarak doğrulandı.

## Güncel Import ve AI Davranışı

- Ders importunda `instructorEmail`, `instructorStaffNo` ve `instructorName` alanlarıyla `INSTRUCTOR` kullanıcısı aranır.
- Eşleşmeyen ders sorumluları önizlemede varsayılan olarak yeni ders sorumlusu hesabı oluşturacak şekilde seçilir; kullanıcı isterse mevcut `INSTRUCTOR` kullanıcısını manuel seçebilir.
- Otomatik oluşturulan öğrenci, gözetmen ve ders sorumlusu hesapları `12345678` geçici şifresi ve `mustChangePassword=true` ile oluşturulur.
- AI sağlayıcısı `.env` içindeki `AI_PROVIDER=heuristic|openai|lmstudio`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY` ve `AI_TIMEOUT_MS` ile ayarlanır.
- LM Studio için OpenAI-compatible server varsayılan olarak `http://127.0.0.1:1234/v1` üzerinden çağrılır; endpoint erişilemezse kayıt heuristic fallback olarak üretilir.
- AI önerileri planı değiştirmez; risk, öneri ve manuel kontrol listesi üretir. Arayüzde provider/model, gönderim durumu, fallback notu ve eski öneriyi silme aksiyonu gösterilir.

## Bilinen Gereksinimler

- PostgreSQL servisinin çalışır olması gerekir.
- `.env` içindeki `DATABASE_URL` geçerli olmalıdır.
- Rapor indirme linkleri auth token’ı query parametresiyle iletir.
- AI için gerçek LLM kullanılacaksa OpenAI tarafında `AI_PROVIDER=openai`, `AI_API_KEY` ve opsiyonel `AI_MODEL`; lokal LM Studio tarafında `AI_PROVIDER=lmstudio`, `AI_BASE_URL` ve `AI_MODEL` tanımlanmalıdır.
- OpenAI API key yoksa veya LM Studio endpoint’i erişilemezse sistem heuristic öneri üretmeye devam eder.
