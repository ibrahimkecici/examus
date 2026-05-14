# Examus Gereksinim Dokümanı

## 1. Proje Adı

**Examus**

## 2. Proje Tanımı

Examus, üniversite, fakülte veya bölüm bazlı sınav dönemlerinde öğrencilerin sınav salonlarına, sınıflara ve sıralara en verimli şekilde yerleştirilmesini sağlayan yapay zeka destekli bir sınav planlama ve oturma düzeni optimizasyon sistemidir.

Sistem; öğrenci listeleri, dersler, sınav takvimi, sınıf kapasiteleri, sıra düzenleri, gözetmen bilgileri ve çeşitli kısıtları dikkate alarak sınavların en kısa sürede, en az kaynak kullanımıyla ve en adil dağılımla yapılmasını hedefler.

Examus’un temel amacı, manuel olarak uzun süren sınav yerleşim ve planlama sürecini otomatikleştirmek; örneğin normalde iki hafta sürebilecek bir sınav dönemini uygun optimizasyon stratejileriyle bir haftaya kadar düşürebilecek planlar üretmektir.

## 3. Projenin Amacı

Bu projenin amacı, sınav haftalarında yaşanan salon planlama, öğrenci yerleşimi, sınıf kapasitesi kullanımı, çakışma kontrolü ve gözetmen dağıtımı problemlerini merkezi ve akıllı bir sistem üzerinden çözmektir.

Sistem aşağıdaki hedeflere odaklanır:

- Sınav sürecinin toplam süresini azaltmak
- Sınıf ve sıra kapasitesini daha verimli kullanmak
- Öğrencilerin sınav çakışmalarını engellemek
- Aynı ders veya aynı öğrenci gruplarının uygun şekilde ayrıştırılmasını sağlamak
- Gözetmen ihtiyacını daha dengeli dağıtmak
- Manuel planlama hatalarını azaltmak
- Sınav takvimini alternatif senaryolarla optimize etmek
- Yapay zeka destekli önerilerle yöneticilere karar desteği sunmak

## 4. Problem Tanımı

Üniversitelerde final ve vize haftalarında sınav planlama süreci çoğu zaman manuel veya yarı manuel yöntemlerle yapılmaktadır. Bu süreçte şu problemler ortaya çıkar:

- Sınıfların gerçek kapasitesi verimli kullanılamaz.
- Aynı öğrencinin farklı sınavları çakışabilir.
- Büyük öğrenci sayısına sahip dersler için uygun salon bulmak zorlaşır.
- Sınavlar gereğinden fazla güne yayılabilir.
- Gözetmen dağılımı dengesiz olabilir.
- Sıra aralığı, boşluk bırakma veya kopya riskini azaltma gibi kurallar manuel olarak uygulanmakta zorlanır.
- Son dakika değişikliklerinde tüm planın yeniden düzenlenmesi gerekir.

Examus bu problemleri optimizasyon algoritmaları ve yapay zeka destekli karar mekanizmaları ile çözmeyi hedefler.

## 5. Kapsam

### 5.1 Kapsama Dahil Olanlar

- Öğrenci, ders, sınıf, sınav ve gözetmen verilerinin sisteme girilmesi
- Excel/CSV dosyalarından veri aktarımı
- Sınav takvimi oluşturma
- Öğrencileri sınıflara ve sıralara otomatik yerleştirme
- Sınıf kapasitesi ve sıra düzeni yönetimi
- Çakışma kontrolü
- Yapay zeka destekli optimizasyon önerileri
- Alternatif sınav planı senaryoları üretme
- Gözetmen atama desteği
- Planın görsel olarak incelenmesi
- PDF/Excel çıktı alma
- Yönetici paneli

### 5.2 Kapsam Dışı Olanlar

- Sınav sorularının hazırlanması
- Online sınav altyapısı
- Öğrencilerin sınav notlarının hesaplanması
- Öğrenci bilgi sistemi yerine geçme
- Biyometrik yoklama sistemi
- Kamera ile kopya tespiti

## 6. Kullanıcı Rolleri

### 6.1 Sistem Yöneticisi

Sistemin genel ayarlarını, kullanıcıları ve veri girişlerini yönetir.

Yetkileri:

- Kullanıcı oluşturma ve yetkilendirme
- Fakülte/bölüm/ders/sınıf tanımlama
- Sistem parametrelerini düzenleme
- Tüm sınav planlarını görüntüleme ve düzenleme

### 6.2 Bölüm Yetkilisi

Kendi bölümüne ait sınav planlama işlemlerini yürütür.

Yetkileri:

- Bölüm derslerini yönetme
- Öğrenci listelerini yükleme
- Sınav tarih aralıklarını belirleme
- Otomatik planlama başlatma
- Planı onaylama veya revize etme

### 6.3 Öğretim Elemanı

Kendi dersine ait sınav bilgilerini görüntüler ve gerekli bilgileri sisteme girer.

Yetkileri:

- Ders sınav süresi bilgisini girme
- Özel sınav kurallarını belirtme
- Sınava girecek öğrenci listesini kontrol etme
- Sınav salonu ve oturma düzenini görüntüleme

### 6.4 Gözetmen

Kendisine atanan sınav görevlerini görüntüler.

Yetkileri:

- Görevli olduğu sınavları görüntüleme
- Salon bilgilerini görme
- Öğrenci oturma listesini indirme

### 6.5 Öğrenci

Kendi sınav salonu, sıra numarası ve sınav saatini görüntüler.

Yetkileri:

- Sınav takvimini görüntüleme
- Salon ve sıra bilgisini görme
- Kişisel sınav programını indirme

## 7. Fonksiyonel Gereksinimler

### 7.1 Kullanıcı Yönetimi

- Sistem kullanıcı girişi desteklemelidir.
- Kullanıcılar role göre farklı yetkilere sahip olmalıdır.
- Yönetici yeni kullanıcı ekleyebilmelidir.
- Kullanıcı şifre değiştirebilmelidir.
- Kullanıcı işlemleri kayıt altına alınmalıdır.

### 7.2 Veri Girişi ve İçe Aktarma

- Sistem öğrenci listesini Excel veya CSV formatında içe aktarabilmelidir.
- Sistem ders listesini Excel veya CSV formatında içe aktarabilmelidir.
- Sistem sınıf ve sıra kapasitesi bilgilerini içe aktarabilmelidir.
- Hatalı veya eksik veriler kullanıcıya raporlanmalıdır.
- Veri yükleme sırasında tekrar eden kayıtlar tespit edilmelidir.

### 7.3 Ders ve Sınav Yönetimi

- Her ders için sınav tarihi, süresi, öğrenci sayısı ve öğretim elemanı bilgisi tutulmalıdır.
- Sınavlar vize, final, bütünleme gibi türlere ayrılabilmelidir.
- Her sınav için minimum/maximum salon sayısı belirlenebilmelidir.
- Bazı dersler için özel kurallar tanımlanabilmelidir.

Örnek özel kurallar:

- Bu dersin öğrencileri yan yana oturamaz.
- Bu sınav sadece belirli sınıflarda yapılabilir.
- Bu sınav belirli saat aralığında yapılmalıdır.
- Bu sınav için en az iki gözetmen gerekir.

### 7.4 Sınıf ve Sıra Yönetimi

- Her sınıf için kapasite bilgisi tutulmalıdır.
- Her sınıf için sıra düzeni tanımlanabilmelidir.
- Sınıflar bina, kat, blok ve kapasite bilgilerine göre gruplanabilmelidir.
- Sıralar tekli, ikili veya çoklu oturma düzenine göre modellenebilmelidir.
- Kopya riskini azaltmak için boşluklu yerleşim kuralları uygulanabilmelidir.

### 7.5 Otomatik Sınav Planlama

Sistem, girilen verilere göre otomatik sınav takvimi oluşturabilmelidir.

Otomatik planlama şu kısıtları dikkate almalıdır:

- Öğrencinin aynı anda iki sınavı olmamalıdır.
- Sınıf kapasitesi aşılmamalıdır.
- Sınav süresi zaman aralığına uygun olmalıdır.
- Aynı sınıfta aynı anda birden fazla sınav yapılamamalıdır.
- Gözetmenlerin aynı anda birden fazla görevi olmamalıdır.
- Sınavlar mümkün olan en kısa toplam süreye yayılmalıdır.
- Büyük öğrenci sayılı dersler için uygun salon kombinasyonları seçilmelidir.

### 7.6 Öğrenci Yerleştirme

- Sistem öğrencileri sınav salonlarına otomatik yerleştirmelidir.
- Öğrenciler sıra numarası bazında atanmalıdır.
- Aynı dersin öğrencileri istenirse aralıklı oturtulmalıdır.
- Farklı derslerin öğrencileri aynı salonda karma şekilde oturtulabilmelidir.
- Öğrenci yerleşimi sonradan manuel olarak düzenlenebilmelidir.
- Engelli veya özel durumu olan öğrenciler için özel yerleşim yapılabilmelidir.

### 7.7 Yapay Zeka Destekli Optimizasyon

Sistem yapay zekayı karar destek mekanizması olarak kullanmalıdır.

Yapay zeka aşağıdaki alanlarda destek sağlayabilir:

- En verimli sınav haftası planını önermek
- Sınav süresini azaltacak alternatif takvimler üretmek
- Sınıf kapasite kullanım oranını artırmak
- Çakışma riski yüksek dersleri tespit etmek
- Büyük dersler için en uygun salon kombinasyonlarını önermek
- Manuel değişiklik sonrası planı yeniden optimize etmek
- Hatalı veya riskli planları kullanıcıya açıklamak

Yapay zeka çıktıları doğrudan uygulanmadan önce kullanıcı onayına sunulmalıdır.

### 7.8 Optimizasyon Kriterleri

Sistem aşağıdaki kriterleri optimize etmeye çalışmalıdır:

- Toplam sınav günü sayısını azaltmak
- Boş kalan sınıf kapasitesini azaltmak
- Öğrenci sınav çakışmalarını sıfırlamak
- Gözetmen yükünü dengeli dağıtmak
- Aynı öğrencinin bir günde çok fazla sınava girmesini engellemek
- Büyük dersleri uygun salonlara verimli bölmek
- Sınavların bina ve salon bazında lojistik olarak yönetilebilir olmasını sağlamak

### 7.9 Manuel Müdahale ve Yeniden Optimizasyon

- Kullanıcı otomatik oluşturulan planı manuel olarak değiştirebilmelidir.
- Manuel değişiklik sonrası sistem oluşan çakışmaları kontrol etmelidir.
- Sistem, kullanıcı değişikliğini bozmadan kalan planı yeniden optimize edebilmelidir.
- Kullanıcı belirli sınavları sabitleyebilmelidir.

### 7.10 Raporlama ve Çıktılar

Sistem aşağıdaki çıktıları oluşturabilmelidir:

- Genel sınav takvimi
- Ders bazlı sınav salonu listesi
- Öğrenci bazlı sınav programı
- Salon bazlı oturma planı
- Gözetmen görev listesi
- Kapasite kullanım raporu
- Çakışma ve hata raporu
- PDF ve Excel çıktıları

## 8. Yapay Zeka ve Optimizasyon Yaklaşımı

Examus’ta yapay zeka, klasik optimizasyon algoritmalarıyla birlikte kullanılmalıdır. Sistem tamamen tahmine dayalı olmamalı; kesin kurallar algoritmik olarak uygulanmalı, yapay zeka ise öneri, açıklama ve alternatif senaryo üretme tarafında kullanılmalıdır.

### 8.1 Kural Tabanlı Katman

Bu katman kesin olarak sağlanması gereken kuralları uygular.

Örnekler:

- Bir öğrenci aynı anda iki sınava atanamaz.
- Salon kapasitesi aşılamaz.
- Aynı salona aynı anda iki sınav atanamaz.
- Gözetmen aynı anda iki salonda görev alamaz.

### 8.2 Optimizasyon Katmanı

Bu katman en iyi yerleşimi bulmaya çalışır.

Kullanılabilecek yöntemler:

- Constraint Satisfaction Problem yaklaşımı
- Integer Linear Programming
- Greedy algoritmalar
- Genetic Algorithm
- Simulated Annealing
- Tabu Search
- Hybrid optimization yaklaşımı

### 8.3 Yapay Zeka Destek Katmanı

Bu katman kullanıcıya açıklanabilir öneriler sunar.

Örnekler:

- “Bu plan 8 günde tamamlanıyor, ancak büyük kapasiteli A blok sınıfları kullanılırsa 6 güne düşebilir.”
- “MAT101 ve FIZ102 derslerinde ortak öğrenci sayısı yüksek olduğu için aynı zaman dilimine yerleştirilmemelidir.”
- “B101 salonunun kapasite kullanımı %42 olduğu için bu salona ek bir küçük ders atanabilir.”

## 9. Veri Gereksinimleri

### 9.1 Öğrenci Verisi

- Öğrenci numarası
- Ad soyad
- Bölüm
- Sınıf seviyesi
- Aldığı dersler
- Özel durum bilgisi

### 9.2 Ders Verisi

- Ders kodu
- Ders adı
- Öğretim elemanı
- Öğrenci sayısı
- Sınav süresi
- Sınav türü
- Özel kısıtlar

### 9.3 Sınıf Verisi

- Sınıf kodu
- Bina
- Kat
- Kapasite
- Sıra sayısı
- Sıra düzeni
- Kullanılabilirlik saatleri

### 9.4 Gözetmen Verisi

- Gözetmen adı
- Bölüm
- Uygunluk saatleri
- Maksimum görev sayısı
- Öncelik veya kısıt bilgisi

### 9.5 Sınav Planı Verisi

- Sınav ID
- Ders
- Tarih
- Saat
- Süre
- Salonlar
- Atanan öğrenciler
- Atanan gözetmenler

## 10. Sistem Ekranları

### 10.1 Giriş Ekranı

- Kullanıcı adı/e-posta ve şifre ile giriş
- Rol bazlı yönlendirme

### 10.2 Yönetim Paneli

- Genel sınav dönemi durumu
- Toplam ders, öğrenci, salon ve gözetmen sayısı
- Planlama durumu
- Uyarılar ve çakışmalar

### 10.3 Veri Yükleme Ekranı

- Öğrenci listesi yükleme
- Ders listesi yükleme
- Sınıf listesi yükleme
- Gözetmen listesi yükleme
- Hata kontrolü

### 10.4 Sınav Planlama Ekranı

- Tarih aralığı seçimi
- Günlük sınav saat aralıkları
- Planlama kuralları
- Optimizasyon başlatma
- Alternatif planları karşılaştırma

### 10.5 Oturma Planı Ekranı

- Salon bazlı sıra görünümü
- Öğrenci yerleşimleri
- Manuel taşıma/düzenleme
- Boş ve dolu sıralar

### 10.6 Raporlama Ekranı

- PDF/Excel çıktı alma
- Salon listesi
- Öğrenci listesi
- Gözetmen listesi
- Kapasite kullanım analizi

## 11. Fonksiyonel Olmayan Gereksinimler

### 11.1 Performans

- Sistem orta ölçekli bir fakülte için binlerce öğrenciyi işleyebilmelidir.
- Otomatik planlama işlemi makul sürede tamamlanmalıdır.
- Büyük veri setlerinde planlama işlemi arka planda çalıştırılabilmelidir.

### 11.2 Güvenlik

- Kullanıcılar sadece yetkili oldukları verilere erişebilmelidir.
- Şifreler güvenli şekilde saklanmalıdır.
- Öğrenci verileri gizlilik kurallarına uygun işlenmelidir.
- Sistem işlemleri loglanmalıdır.

### 11.3 Kullanılabilirlik

- Arayüz sade ve anlaşılır olmalıdır.
- Planlama sonuçları görsel olarak kolay incelenebilmelidir.
- Hatalar kullanıcıya açık şekilde gösterilmelidir.
- Manuel düzenleme işlemleri kolay yapılabilmelidir.

### 11.4 Ölçeklenebilirlik

- Sistem farklı fakülteler veya bölümler için kullanılabilir olmalıdır.
- Salon, ders ve öğrenci sayısı arttığında sistem genişletilebilir olmalıdır.

### 11.5 Bakım Kolaylığı

- Sistem modüler yapıda geliştirilmelidir.
- Optimizasyon algoritması ayrı bir servis veya modül olarak tasarlanmalıdır.
- Veri modeli ileride yeni kurallar eklemeye uygun olmalıdır.

## 12. Başarı Kriterleri

Projenin başarılı kabul edilmesi için aşağıdaki kriterlerin sağlanması beklenir:

- Sistem öğrenci, ders, sınıf ve gözetmen verilerini başarıyla alabilmelidir.
- Sınav çakışması olmayan bir plan oluşturabilmelidir.
- Öğrencileri salonlara ve sıralara otomatik yerleştirebilmelidir.
- Sınıf kapasitesini aşmadan oturma planı oluşturabilmelidir.
- Kullanıcı manuel değişiklik yapabilmelidir.
- Sistem değişiklik sonrası çakışmaları gösterebilmelidir.
- En az iki farklı planlama senaryosu karşılaştırılabilmelidir.
- PDF veya Excel formatında çıktı alınabilmelidir.
- Optimizasyon sonucunda manuel plana göre daha kısa veya daha verimli bir sınav takvimi üretilebilmelidir.

## 13. Örnek Kullanım Senaryosu

Bir bölüm yetkilisi sisteme final haftası için öğrenci, ders, sınıf ve gözetmen verilerini yükler. Sistem verileri kontrol eder ve eksik bilgileri raporlar. Yetkili sınavların yapılabileceği tarih aralığını ve günlük sınav saatlerini belirler.

Examus, bu verilere göre otomatik sınav planlama işlemini başlatır. Sistem, öğrencilerin sınav çakışmalarını kontrol eder, sınıf kapasitelerini değerlendirir ve sınavları en kısa sürede tamamlayacak alternatif planlar üretir.

Yetkili oluşturulan planları karşılaştırır. Örneğin birinci plan sınavları 10 güne yayarken, ikinci plan daha yüksek sınıf kapasitesi kullanımıyla sınav sürecini 6 güne düşürür. Yetkili uygun planı seçer, gerekli manuel düzenlemeleri yapar ve planı onaylar.

Onaylanan plan üzerinden öğrencilere salon ve sıra bilgisi, öğretim elemanlarına sınav bilgisi, gözetmenlere görev listesi ve yönetime genel sınav raporu oluşturulur.

## 14. Riskler ve Kısıtlar

- Gerçek üniversite verilerine erişim sınırlı olabilir.
- Sınıf ve sıra düzenleri her kurumda farklı olabilir.
- Çok büyük veri setlerinde optimizasyon süresi artabilir.
- Tüm kısıtları aynı anda sağlamak her zaman mümkün olmayabilir.
- Yapay zeka önerileri insan onayı olmadan uygulanmamalıdır.
- Eksik veya hatalı veri, planlama kalitesini düşürebilir.

## 15. MVP Kapsamı

İlk sürümde aşağıdaki özellikler geliştirilebilir:

- Kullanıcı girişi
- Öğrenci, ders ve sınıf verisi yükleme
- Basit sınav takvimi oluşturma
- Salon kapasitesine göre öğrenci yerleştirme
- Çakışma kontrolü
- Oturma planı görüntüleme
- PDF/Excel çıktı alma
- Basit optimizasyon skoru gösterme

MVP sonrası eklenebilecek gelişmiş özellikler:

- Gözetmen optimizasyonu
- Gelişmiş yapay zeka önerileri
- Alternatif senaryo karşılaştırma
- Sürükle-bırak oturma düzeni düzenleme
- Öğrenci paneli
- Mobil uyumlu arayüz
- Öğrenci bilgi sistemi entegrasyonu

## 16. Önerilen Teknoloji Mimarisi

### 16.1 Frontend

- Next.js veya React
- TypeScript
- Tailwind CSS
- Takvim ve tablo bileşenleri

### 16.2 Backend

- Node.js / Express veya NestJS
- REST API veya GraphQL
- Rol bazlı yetkilendirme
- Dosya yükleme ve veri doğrulama servisleri

### 16.3 Veritabanı

- PostgreSQL
- Prisma ORM

### 16.4 Optimizasyon Servisi

- Python tabanlı ayrı servis
- OR-Tools veya benzeri optimizasyon kütüphanesi
- Alternatif olarak Node.js içinde basit algoritmik çözüm

### 16.5 Yapay Zeka Katmanı

- LLM tabanlı açıklama ve öneri üretimi
- Optimizasyon sonuçlarını doğal dille yorumlama
- Riskli planları açıklama

## 17. Sistem Akışı

1. Yönetici sisteme giriş yapar.
2. Sınav dönemi oluşturur.
3. Öğrenci, ders, sınıf ve gözetmen verilerini yükler.
4. Sistem verileri doğrular.
5. Yönetici tarih aralığı ve planlama kurallarını belirler.
6. Sistem otomatik sınav planı üretir.
7. Sistem öğrencileri salonlara ve sıralara yerleştirir.
8. Yapay zeka planı yorumlar ve alternatif öneriler sunar.
9. Yönetici planı inceler ve gerekirse manuel düzenleme yapar.
10. Sistem çakışmaları tekrar kontrol eder.
11. Plan onaylanır.
12. Raporlar ve çıktılar oluşturulur.

## 18. Sonuç

Examus, sınav dönemlerinde karşılaşılan salon, sıra, öğrenci ve gözetmen planlama problemlerini çözmeyi amaçlayan yapay zeka destekli bir optimizasyon sistemidir. Sistem, manuel planlama sürecini azaltarak daha kısa, daha verimli ve daha hatasız sınav dönemleri oluşturmayı hedefler.

Bu proje, hem akademik açıdan optimizasyon problemlerini uygulamalı olarak ele alması hem de gerçek hayatta üniversitelerde kullanılabilecek pratik bir çözüm sunması açısından güçlü bir bitirme projesi adayıdır.

