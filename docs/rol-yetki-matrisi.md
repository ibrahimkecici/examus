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
- Import öncesi önizleme yapılır; eksik/tanınmayan kolonlar, department eşleşmeleri, yeni/güncellenecek kayıtlar ve otomatik oluşacak hesap sayısı gösterilir.
- Veri yükleme ekranında her import tipi için CSV şablonu indirilebilir.

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

Bu kontroller kullanıcı deneyimi içindir. Asıl yetki kontrolü backend route ve scope kontrollerindedir.

## Backend Kaynakları

Başlıca uygulama noktaları:

- `src/middleware/auth.js`: JWT doğrulama, kullanıcı yükleme, ilk şifre zorunluluğu
- `src/utils/accessControl.js`: rol etiketleri, geçerli roller, resource scope ve yazma yetkileri
- `src/utils/crudRouter.js`: scope-aware CRUD filtreleri
- `src/routes/planningRoutes.js`: admin-only planlama aksiyonları
- `src/routes/importRoutes.js`: import rol ayrımı
- `src/routes/userRoutes.js`: admin-only kullanıcı yönetimi ve öğrenci hesap üretimi
- `src/services/operationService.js`: rol bazlı dashboard ve sınav operasyon verisi
- `src/services/manualValidationService.js`: manuel düzenleme hard constraint validasyonları
- `frontend/src/lib/auth.ts`: frontend rol etiketleri, menü ve ekran erişim yardımcıları

## Bilinen Sınırlar

- Rapor export endpointleri tüm rollere açıktır, ancak her rol kendi kapsamına filtrelenmiş çıktı alır.
- Ders sorumlusu raporları yalnızca kendi derslerinin sınavlarını içerir.
- Gözetmen raporları yalnızca gözetmenin görevli olduğu sınavlarla filtrelenir.
- Öğrenci raporları yalnızca öğrencinin kendi sınavlarını ve kendi koltuk bilgisini içerir.
- Eski `department` string alanları migration uyumluluğu için tutulur; sonraki temizlik fazında kaldırılabilir.
- Planlama senaryosu listeleme/görüntüleme endpointleri rol kapsamına göre filtrelenir; çalıştırma ve onaylama sadece admindedir.
- Salon değiştirme gibi manuel düzenlemeler hard constraint validasyonu olmadan kaydedilmez; daha zengin sürükle-bırak düzenleme deneyimi ayrı UI fazında geliştirilebilir.
