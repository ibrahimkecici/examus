# Planlama Ağırlıkları

Bu doküman Examus planlama motorundaki mevcut ağırlıkları ve göreli önemlerini açıklar.

## CP-SAT Kesin Optimizasyon

`optimal_cp_sat` seçildiğinde ana karar `src/services/planning/cp_sat_worker.py` içindeki CP-SAT objective ile verilir. Önce hard constraint'ler sağlanır; bu kurallar ağırlık değil zorunluluktur:

- Her aktif sınav tam bir kez planlanır.
- Ortak öğrencili sınavlar çakışmaz.
- Aynı salon aynı anda iki farklı slotta kullanılmaz.
- Aynı gözetmen aynı anda iki görev alamaz.
- Gözetmen `maxAssignments` ve varsa `maxPerDay` sınırları aşılmaz.
- Kapasite ve güvenli oturma kapasitesi aşılmaz.
- Sıfır öğrencili sınavlar planlama dışı bırakılır.

Hard constraint sağlandıktan sonra aşağıdaki ağırlıklar minimize edilir. Büyük katsayı daha yüksek öncelik demektir.

| Kriter | Katsayı | Önem | Etki |
|---|---:|---|---|
| Son kullanılan gün indeksi (`max_date`) | `1,000,000` | En yüksek | Sınavları mümkün olan en erken günlere sıkıştırır. |
| Kullanılan gün sayısı | `500,000` | Çok yüksek | Toplam sınav günü sayısını azaltır. |
| Her boş fiziksel kapasite | `260` | Yüksek | Büyük salonların az öğrenciyle kullanılmasını doğrudan cezalandırır. |
| Her boş sınav kapasitesi | `130` | Orta-yüksek | Emniyetli/efektif sınav kapasitesi israfını azaltır. |
| Fiziksel doluluk `< %40` | `(%40 - doluluk%) * 2,500` | Yüksek | Düşük fiziksel dolulukta kademeli ceza başlatır. |
| Fiziksel doluluk `< %30` | Ek `(%30 - doluluk%) * 5,000` | Çok yüksek | 20-30 kişilik sınavların büyük salonlara gitmesini güçlü biçimde engeller. |
| Fiziksel doluluk `< %25` | Ek `(%25 - doluluk%) * 12,000` | Aşırı yüksek | Çok düşük doluluklu büyük salon kullanımını yalnızca zorunluysa kabul ettirir. |
| Fiziksel kapasite `> 2x öğrenci` | Fazla koltuk başına `750` | Çok yüksek | Kapasitesi öğrenci sayısının iki katından fazla olan salonları pahalılaştırır. |
| Fiziksel kapasite `> 3x öğrenci` | Ek fazla koltuk başına `1,300` | Aşırı yüksek | Kapasitesi üç katı aşan salonları daha sert cezalandırır. |
| Düşük sınav kapasitesi doluluğu | `(82 - sınav doluluk%) * 120` | Orta | Efektif sınav kapasitesinin gereksiz şişmesini azaltır. |
| Salon adedi | `220` | Orta-yüksek | Aynı sınav/grup için daha az salon kullanmayı tercih eder. |
| Aynı öğrencinin aynı gün birden fazla sınavı | öğrenci başına `320` | Orta-yüksek | Çakışma olmasa bile öğrenci günlük yükünü azaltır. |
| Öğrenci back-to-back sınavı | öğrenci başına ek `180` | Orta | Aralıksız veya çok yakın sınavları azaltır. |
| Gözetmen yük farkı | `1,700` | Orta | En yoğun ve en az yoğun gözetmen arasındaki farkı azaltır. |
| Son kullanılan slot indeksi (`max_slot`) | `20,000` | Orta | Aynı gün içinde daha erken/kompakt slotları tercih eder. |
| Karma salon oda tasarrufu bonusu | Tasarruf edilen salon başına `-220` | Düşük-orta | Karma planı yalnızca gerçek salon tasarrufu varsa teşvik eder. |
| Karma salon gözetmen tasarrufu bonusu | Tasarruf edilen gözetmen başına `-180` | Düşük-orta | Karma planı gerçek gözetmen tasarrufu varsa destekler. |
| Oda aday skoru | `roomScore` | Yardımcı | JS oda seçici tarafından hesaplanan kapasite/oda verimi cezasını taşır. |
| Gözetmen aday skoru | `invigilatorScore` | Yardımcı | Availability, yük, bina geçişi ve öncelik gibi gözetmen skorlarını taşır. |

Öncelik sırası pratikte şöyledir:

1. Hard constraint ihlali olmaması.
2. Sınav döneminin mümkün olduğunca az güne yayılması.
3. Aşırı büyük salonların düşük dolulukla kullanılmaması.
4. Fiziksel salon doluluğunun yükselmesi ve boş kapasitenin azalması.
5. Öğrenci günlük yükünün ve back-to-back durumlarının azalması.
6. Gözetmen yükünün dengelenmesi.
7. Aynı gün içinde daha erken/kompakt slot kullanımı.

## Kapasite Metrikleri

CP-SAT girdisinde iki kapasite ayrı taşınır:

- `effectiveExamCapacity`: Sınav oturma düzeni, kitapçık ve güvenli aralık kısıtlarından sonra kullanılabilir sınav kapasitesidir. Hard kapasite kontrolü bununla yapılır.
- `physicalCapacity`: `classroom.capacity` toplamıdır. Salon verimliliği ve büyük salon cezası bununla hesaplanır.

Rapor metriklerinde de bu ayrım korunur:

- `averageRoomUtilization` ve `averagePhysicalRoomUtilization`: Fiziksel salon doluluğu.
- `averageEffectiveExamUtilization`: Sınav kapasitesi doluluğu.
- `totalUnusedCapacity` ve `totalPhysicalUnusedCapacity`: Fiziksel boş kapasite.
- `totalEffectiveUnusedCapacity`: Sınav kapasitesine göre boş kapasite.

## Heuristic Strateji Ağırlıkları

`heuristic` veya `legacy_heuristic` seçilirse `src/services/planning/config.js` içindeki `STRATEGY_WEIGHTS` kullanılır. `optimal_cp_sat` ise aday üretirken `efficient` ağırlıklarını yardımcı skor olarak kullanır, ana karar yine CP-SAT objective'indedir.

| Strateji | Gün cezası | Boş kapasite | Salon sayısı | Gözetmen adaleti | Aynı gün öğrenci | Back-to-back | Karma bonus | Özel ihtiyaç | Kompakt slot |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `efficient` | 55 | 55 | 35 | 45 | 45 | 30 | 55 | 90 | 25 |
| `compact` | 120 | 24 | 30 | 24 | 45 | 25 | 48 | 90 | 4 |
| `balanced` | 45 | 50 | 35 | 50 | 85 | 55 | 35 | 95 | 22 |
| `minimum_rooms` | 45 | 35 | 120 | 28 | 50 | 30 | 110 | 90 | 16 |
| `fair_invigilator` | 35 | 35 | 25 | 120 | 55 | 45 | 25 | 95 | 18 |
| `student_friendly` | 30 | 35 | 25 | 45 | 135 | 100 | 20 | 100 | 25 |

### Heuristic Alanları

- `usedDayCountPenalty`: Yeni gün kullanmayı cezalandırır.
- `roomWastePenalty`: Boş kalan kapasiteyi cezalandırır.
- `roomCountPenalty`: Daha fazla salon kullanımını cezalandırır.
- `invigilatorFairnessPenalty`: Gözetmen yük dengesizliğini cezalandırır.
- `sameDayStudentPenalty`: Aynı öğrencinin aynı gün birden fazla sınava girmesini cezalandırır.
- `backToBackStudentPenalty`: Aynı öğrencinin arka arkaya sınavını cezalandırır.
- `mixedRoomEfficiencyBonus`: Karma salonu teşvik eder; yüksek değer daha agresif birleştirme demektir.
- `specialNeedsPenalty`: Özel ihtiyaç uyumsuzluklarını daha pahalı hale getirir.
- `compactSlotPenalty`: Tarih/slot indeksini cezalandırarak daha erken/kompakt plan üretir.

## Gözetmen Sayısı Kuralları

Gözetmen sayısı ağırlık değil eşik kuralıdır:

| Öğrenci sayısı | Gerekli gözetmen |
|---:|---:|
| `0-30` | 1 |
| `31-70` | 2 |
| `71+` | 3 |

Bu eşikler `DEFAULT_PLANNING_CONFIG.invigilatorRules` içinde tanımlıdır.

## Mevcut Varsayım

Mevcut sistemde pratik olarak en önemli hedefler şunlardır:

1. Hard constraint'leri sıfır ihlalle sağlamak.
2. Aktif sınavları az güne yaymak.
3. Salon verimliliğini yükseltmek.
4. Öğrenci yükünü yumuşatmak.
5. Gözetmen yükünü dengeli dağıtmak.

Salon verimliliği şu anda CP-SAT objective'inde yüksek önceliklidir; ancak gün sayısı hâlâ salon doluluğundan daha önemlidir. Yani sistem, bir günü daha kullanmak yerine bazı salonlarda daha düşük doluluğu kabul edebilir.
