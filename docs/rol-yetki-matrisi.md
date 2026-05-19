# Examus Rol ve Yetki Matrisi

Bu doküman Examus içinde kullanılan rol bazlı erişim kontrolünü açıklar. Güvenlik katmanı backend tarafındadır; frontend menü ve buton görünürlüğü sadece kullanıcı deneyimini sadeleştirir.

## Roller

| Enum | Türkçe rol | Temel kullanım |
|---|---|---|
| `ADMIN` | Sistem Yöneticisi | Tüm sistem yönetimi, planlama çalıştırma, kullanıcı ve bölüm yönetimi |
| `DEPARTMENT_MANAGER` | Bölüm Koordinatörü | Kendi bölümünün öğrenci, ders, gözetmen, sınav ve rapor süreçleri |
| `INSTRUCTOR` | Ders Sorumlusu | Kendi verdiği dersler ve bu derslerin sınavları |
| `INVIGILATOR` | Gözetmen | Kendi gözetmen profili ve görevleri |
| `STUDENT` | Öğrenci | Kendi sınavları ve oturma bilgileri |

## Yetki Özeti

| İşlem / ekran | Admin | Bölüm koordinatörü | Ders sorumlusu | Gözetmen | Öğrenci |
|---|---:|---:|---:|---:|---:|
| Kullanıcı yönetimi | Tam | Yok | Yok | Yok | Yok |
| Bölüm yönetimi | Tam | Yok | Yok | Yok | Yok |
| Veri yükleme | Tam | Kendi bölümü, derslik hariç | Yok | Yok | Yok |
| Öğrenci kayıtları | Tam | Kendi bölümü | Kendi derslerine kayıtlı öğrenciler | Yok | Kendi profili |
| Ders kayıtları | Tam | Kendi bölümü | Kendi dersleri | Yok | Kayıtlı olduğu dersler |
| Gözetmen kayıtları | Tam | Kendi bölümü | Yok | Kendi profili | Yok |
| Derslik kayıtları | Tam | Okuma | Okuma | Yok | Yok |
| Sınav dönemleri | Tam | Okuma | Okuma | Yok | Yok |
| Sınav kayıtları | Tam | Kendi bölümü | Kendi dersleri | Atandığı sınavlar | Kayıtlı olduğu derslerin sınavları |
| Planlama senaryosu görüntüleme | Tam | Görüntüleme | Yok | Yok | Yok |
| Senaryo oluşturma / çalıştırma / recheck / onay | Tam | Yok | Yok | Yok | Yok |
| Manuel sınav zamanı düzenleme | Tam | Kendi bölümü | Kendi dersi | Yok | Yok |
| Manuel koltuk düzenleme | Tam | Kendi bölümü | Yok | Yok | Yok |
| PDF / Excel rapor export | Tam | Kendi bölümü | Kendi dersleri | Kendi görevli olduğu sınavlar | Kendi sınav/koltuk bilgisi |
| AI önerisi üretme | Tam | Açık | Yok | Yok | Yok |

## Rol Bazlı Dashboard

Dashboard her rol için günlük iş akışına göre daraltılır.

- `ADMIN`: sistem geneli kayıt sayıları, son planlama senaryoları, uyarı sağlığı ve planlama aksiyonlarına geçiş.
- `DEPARTMENT_MANAGER`: kendi bölümünün sınav operasyonu, son senaryoları, uyarıları ve bölüm kapsamındaki raporlar.
- `INSTRUCTOR`: kendi derslerinin sınavları, salonları, atanan/beklenen öğrenci sayısı ve gözetmen özeti.
- `INVIGILATOR`: kendi görevleri, salon/saat bilgisi, tam oturma grid’i, kapı listesi, kitapçık ve özel ihtiyaç özeti.
- `STUDENT`: kendi sınavları, salon, koltuk, kitapçık ve varsa özel ihtiyaç notu.

Gözetmen ve öğrenci dashboard verileri yalnızca ilgili kişinin kapsamındaki sınav ve oturma kayıtlarını içerir.

## Bölüm Kapsamı

Bölüm bazlı güvenlik string karşılaştırmasına bağlı değildir. Yetkilendirme `Department.id` ve ilişkili `departmentId` alanları üzerinden yapılır.

Kapsamlı modeller:

- `User.departmentId`
- `Student.departmentId`
- `Course.departmentId`
- `Invigilator.departmentId`

Geçiş uyumluluğu için eski `department` string alanları korunur, ancak yetki kararlarında esas alınmaz. Yeni kayıt ve import akışları `Department` kaydıyla eşleştirme yapar.

Bölüm koordinatörü için önemli kural:

- Kullanıcının `departmentId` değeri yoksa kapsamlı veri işlemleri reddedilir veya boş sonuç döner.
- Kendi bölümünden farklı `departmentId` taşıyan kayıtları güncelleyemez veya silemez.
- Derslik ve bölüm yönetimi yapamaz.

## Planlama Yetkisi

Sınav planlama motorunu çalıştırma yetkisi sadece `ADMIN` rolündedir.

Sadece admin tarafından yapılabilen işlemler:

- Planlama senaryosu oluşturma
- Senaryo çalıştırma
- Senaryo tekrar kontrolü
- Senaryo onaylama

Bölüm koordinatörü planlama sonuçlarını görüntüleyebilir ve rapor alabilir, fakat planlama motorunu çalıştıramaz veya onaylayamaz.

## Manuel Düzenleme ve Plan Kalitesi

Planlama detay ekranında yetkili roller için kontrollü manuel düzenleme akışları bulunur:

- Sınav zamanı değiştirme: `ADMIN`, `DEPARTMENT_MANAGER` ve ilgili `INSTRUCTOR`.
- Salon değiştirme: `ADMIN` ve `DEPARTMENT_MANAGER`.
- Koltuk değiştirme/kilitleme: `ADMIN` ve `DEPARTMENT_MANAGER`.
- Gözetmen değiştirme: `ADMIN` ve `DEPARTMENT_MANAGER`.

Her manuel işlem backend validasyonundan geçer. Hard ihlal varsa kayıt yapılmaz ve UI’da kırmızı validasyon mesajı gösterilir. Soft uyarılar kayıt engellemez, ancak kullanıcıya açıklanır.

Salon değiştirme yalnızca tek sınavlı salon-slot için açıktır. Karma/çoklu salon slotlarında tek sınav üzerinden salon taşıma kilitlidir. Hedef salonda mevcut koltuk etiketleri karşılanamıyorsa değişiklik reddedilir.

Plan kalitesi ekranı mevcut senaryoyu aynı dönemdeki önceki tamamlanmış/onaylı senaryo ile karşılaştırır:

- Skor
- Fiziksel salon doluluğu
- Boş kapasite
- Gözetmen yük farkı
- Öğrenci günlük yükü
- Ardışık sınav yükü

## Veri Yükleme

Veri yükleme ekranı `ADMIN` ve `DEPARTMENT_MANAGER` rollerine açıktır.

| Import tipi | Admin | Bölüm koordinatörü |
|---|---:|---:|
| Öğrenci | Evet | Evet, kendi bölümü |
| Ders | Evet | Evet, kendi bölümü |
| Gözetmen | Evet | Evet, kendi bölümü |
| Derslik | Evet | Hayır |

Import sırasında `department` kolonu `Department` kaydıyla eşleştirilir.

- Admin için department yoksa oluşturulabilir.
- Bölüm koordinatörü için kayıtlar kendi `departmentId` kapsamına bağlanır.
- Öğrenci importunda bağlı kullanıcı hesabı yoksa otomatik öğrenci kullanıcısı oluşturulur.
- Gözetmen importunda bağlı kullanıcı hesabı yoksa otomatik gözetmen kullanıcısı oluşturulur.
- Ders importunda eşleşmeyen ders sorumluları varsayılan olarak yeni `User(role=INSTRUCTOR)` hesabı oluşturacak şekilde işaretlenir.
- Ders import şablonu `instructorEmail`, `instructorStaffNo` ve `instructorName` kolonlarını içerir. Öncelik e-posta, sonra personel/sicil no, sonra ad eşleşmesidir.
- Eşleşmeyen derslerde önizleme ekranında varsayılan seçenek `Yeni ders sorumlusu hesabı oluştur` olur; kullanıcı isterse mevcut `INSTRUCTOR` kullanıcısını manuel seçebilir.
- Birden fazla olası eşleşme bulunan derslerde manuel `Ders Sorumlusu Seç` alanı gösterilir.
- Var olan e-posta farklı roldeki bir kullanıcıya aitse satır hata sayılır ve düzeltilmeden import başlatılmaz.
- Import öncesi önizleme yapılır; eksik/tanınmayan kolonlar, department eşleşmeleri, yeni/güncellenecek kayıtlar ve otomatik oluşacak öğrenci/gözetmen/ders sorumlusu hesap sayısı gösterilir.
- Veri yükleme ekranında her import tipi için varsayılan şablon XLSX formatındadır. Şablonlarda `Veri` ve `Açıklamalar` sayfaları bulunur.

## Ders Sorumlusu ve Gözetmen Ayrımı

`INSTRUCTOR` dersin akademik sorumlusudur. `INVIGILATOR` sınav salonundaki görevli gözetmendir. Bu iki rol import, yetkilendirme, dashboard ve raporlarda ayrı kabul edilir.

Ders sorumluluğunun tek güvenilir kaynağı:

- `Course.instructorId -> User(id)`
- İlgili kullanıcının rolü `INSTRUCTOR` olmalıdır.

`Course.instructorName` geçiş uyumluluğu ve görüntüleme için tutulur. Yetki kapsamı, dashboard, sınav detayları ve raporlar `instructorId` üzerinden çalışır.

Ders sorumlusu için kapsam:

- Sadece `Course.instructorId = currentUser.id` olan dersleri görür.
- Bu derslerin sınav, salon, öğrenci yerleşimi ve rapor özetlerini görür.
- Gözetmen profili yoksa gözetmen görev ekranı kapsamına girmez.

Ders sorumlusu hesapları ders importu sırasında otomatik oluşturulabilir:

- Kullanıcı adı/e-posta: `instructorEmail` varsa o adres; yoksa `instructorStaffNo@instructors.examus.local` veya ders kodu tabanlı sistem içi adres.
- İlk şifre: `12345678`
- `mustChangePassword=true` ile oluşturulur.
- Ders sorumlusu ilk girişte yeni şifre belirlemeden sistemi kullanamaz.

Gözetmen için kapsam:

- Sadece `Invigilator.userId = currentUser.id` profiline bağlı görevleri görür.
- Görevli olduğu salonların oturma grid’i ve kapı listesini görebilir.
- Ders sorumlusu olmadığı derslerin akademik yönetim verilerini görmez.

Bu fazda çoklu rol modeli yoktur. Aynı gerçek kişi hem ders sorumlusu hem gözetmen olarak kullanılacaksa sistemde ana rolü seçilmelidir; çoklu rol sonraki fazda ayrı ele alınacaktır.

## Öğrenci Hesapları

Öğrenci hesapları öğrenci numarasıyla giriş yapacak şekilde tasarlanmıştır.

- Kullanıcı adı: `Student.studentNo`
- İlk şifre: `12345678`
- `mustChangePassword=true` ile oluşturulur.
- Öğrenci ilk girişte yeni şifre belirlemeden sistemi kullanamaz.

Backend, `mustChangePassword=true` olan kullanıcıların `/api/auth/me` ve `/api/auth/complete-password-setup` dışındaki API erişimini engeller.

## Gözetmen Hesapları

Gözetmen hesapları import sırasında otomatik oluşturulur.

- Kullanıcı adı: `Invigilator.staffNo`
- E-posta varsa kullanıcı hesabında gerçek e-posta kullanılır; yoksa sistem içi `staffNo@invigilators.examus.local` adresi üretilir.
- İlk şifre: `12345678`
- `mustChangePassword=true` ile oluşturulur.
- Gözetmen ilk girişte yeni şifre belirlemeden sistemi kullanamaz.

## Frontend Davranışı

Frontend rol bilgisine göre menü ve aksiyonları saklar.

- Yetkisiz doğrudan URL girişinde `Erişim yetkiniz yok` ekranı gösterilir.
- Admin olmayan kullanıcıda planlama çalıştırma, tekrar kontrol ve onay butonları görünmez.
- İlk giriş şifresi değişmemiş kullanıcıda sidebar ve normal ekranlar gösterilmez; sadece yeni şifre belirleme ekranı açılır.
- Admin dışı roller raporlarda varsayılan olarak tek ana PDF görür.
- Gözetmen kendi panelinde oturma düzeni önizlemesine tıklayarak tam grid ve kapı listesini uygulama içinde açabilir.
- Sınav detay ekranı `/api/exams/:id/operations` üzerinden role göre filtrelenmiş operasyon verisi gösterir.
- Tema seçimi light/dark toggle ile yapılır ve `localStorage.examus_theme` içinde kalıcı tutulur.
- AI önerisi ekranında gönderim durumu, provider/model bilgisi, fallback notu ve eski öneriyi silme aksiyonu görünür.

Bu kontroller kullanıcı deneyimi içindir. Asıl yetki kontrolü backend route ve scope kontrollerindedir.

## Backend Kaynakları

Başlıca uygulama noktaları:

- `src/middleware/auth.js`: JWT doğrulama, kullanıcı yükleme, ilk şifre zorunluluğu
- `src/utils/accessControl.js`: rol etiketleri, geçerli roller, resource scope ve yazma yetkileri
- `src/utils/crudRouter.js`: scope-aware CRUD filtreleri
- `src/routes/planningRoutes.js`: admin-only planlama aksiyonları
- `src/routes/manualEditRoutes.js`: validasyonlu manuel düzenleme endpointleri ve audit kayıtları
- `src/routes/importRoutes.js`: import rol ayrımı
- `src/routes/userRoutes.js`: admin-only kullanıcı yönetimi ve öğrenci hesap üretimi
- `src/services/importService.js`: XLSX şablonları, import preview, ders sorumlusu eşleştirme ve otomatik öğrenci/gözetmen/ders sorumlusu hesap üretimi
- `src/services/aiService.js`: heuristic, OpenAI ve LM Studio AI sağlayıcıları
- `src/routes/aiRoutes.js`: AI insight üretme, listeleme ve silme endpointleri
- `src/utils/auditLog.js`: import ve operasyon aksiyonları için toleranslı audit log yazımı
- `src/services/operationService.js`: rol bazlı dashboard ve sınav operasyon verisi
- `src/services/manualValidationService.js`: manuel düzenleme hard constraint validasyonları
- `frontend/src/components/ThemeToggle.tsx`: kalıcı light/dark tema seçimi
- `frontend/src/lib/auth.ts`: frontend rol etiketleri, menü ve ekran erişim yardımcıları

## Bilinen Sınırlar

- Rapor export endpointleri tüm rollere açıktır, ancak her rol kendi kapsamına filtrelenmiş çıktı alır.
- Ders sorumlusu raporları yalnızca kendi derslerinin sınavlarını içerir.
- Gözetmen raporları yalnızca gözetmenin görevli olduğu sınavlarla filtrelenir.
- Öğrenci raporları yalnızca öğrencinin kendi sınavlarını ve kendi koltuk bilgisini içerir.
- Eski `department` string alanları migration uyumluluğu için tutulur; sonraki temizlik fazında kaldırılabilir.
- Planlama senaryosu listeleme/görüntüleme endpointleri rol kapsamına göre filtrelenir; çalıştırma ve onaylama sadece admindedir.
- Salon değiştirme gibi manuel düzenlemeler hard constraint validasyonu olmadan kaydedilmez; daha zengin sürükle-bırak düzenleme deneyimi ayrı UI fazında geliştirilebilir.
