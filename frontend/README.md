# Examus Frontend

Bu dizin, Examus yönetim panelinin Next.js uygulamasını içerir. Panel canlı REST API ile çalışır ve mock veri kullanmaz.

## Ekranlar

- `/login`: kullanıcı girişi ve ilk admin oluşturma
- `/`: dashboard
- `/veri-yukleme`: XLSX şablon indirme, dosya önizleme, import loading durumları ve ders sorumlusu eşleştirme/oluşturma
- `/ogrenciler`: öğrenci yönetimi
- `/dersler`: ders yönetimi
- `/derslikler`: derslik ve oturma planı yönetimi
- `/gozetmenler`: gözetmen yönetimi
- `/donemler`: sınav dönemi yönetimi
- `/sinavlar`: sınav yönetimi
- `/planlama`: senaryo oluşturma, çalıştırma, tekrar kontrol, AI önerisi, eski AI önerisini silme ve onaylama
- `/raporlar`: role göre sadeleştirilmiş PDF/Excel çıktı linkleri

## Tema

Panel light/dark tema toggle içerir. Seçim `localStorage.examus_theme` içinde saklanır ve sonraki oturumlarda korunur.

## Import Davranışı

Veri yükleme ekranında şablonlar varsayılan olarak XLSX formatındadır. Ders importunda eşleşmeyen ders sorumluları varsayılan olarak yeni `INSTRUCTOR` hesabı oluşturacak şekilde seçilir; kullanıcı isterse mevcut bir ders sorumlusunu manuel seçebilir.

## AI Önerileri

AI öneri kartı provider/model bilgisini, gönderim durumunu ve fallback notunu gösterir. Eski AI önerileri arayüzden silinebilir.

## Ortam Değişkeni

Varsayılan API adresi:

```text
http://localhost:5001/api
```

Farklı bir backend adresi için:

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:5001/api"
```

## Çalıştırma

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak şu adreste çalışır:

```text
http://localhost:3000
```

## Doğrulama

```bash
npm run lint
npm run build
```

## Backend Bağımlılığı

Paneldeki ekranların çoğu backend API gerektirir. Backend kök dizinden çalıştırılır:

```bash
cd ..
npm run dev
```

PostgreSQL migration tamamlanmadan API istekleri veritabanı hatası döndürebilir. Kurulum ve migration ayrıntıları için kök `README.md` dosyasına bakın.
