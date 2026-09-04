<p align="center">
  <img src="all/readme-assets/vesper-banner.svg" alt="Vesper hareketli banner" width="100%">
</p>

<p align="center">
  <a href="README_EN.md">English</a> &nbsp;•&nbsp; <strong>Türkçe</strong>
</p>

<p align="center">
  <strong>macOS, Windows ve Linux için odaklı, ses öncelikli bir yapay zekâ deneyimi.</strong><br>
  Doğal konuş. Yanıtı anlık al. Vesper’dan sesli dinle.
</p>

<p align="center">
  <code>Yerel arayüz</code>&nbsp;&nbsp;
  <code>NVIDIA API</code>&nbsp;&nbsp;
  <code>Türkçe + English</code>&nbsp;&nbsp;
  <code>Opsiyonel çevrimdışı TTS</code>
</p>

---

## Vesper ile tanış

Vesper, tek bir doğal etkileşim etrafında tasarlanmış sinematik bir tarayıcı sesli asistanıdır: **konuş, dinle, devam et**. Arayüzü ve hafif proxy sunucusu bilgisayarında yerel olarak çalışır; dil modeli yanıtları NVIDIA API üzerinden anlık olarak aktarılır.

Kurulumda seçilen dil tüm oturum boyunca belirleyicidir. Türkçeyi seçersen Vesper her zaman Türkçe, İngilizceyi seçersen her zaman İngilizce cevap verir; konuşma sırasında başka bir dil kullansan bile seçim değişmez.

<p align="center">
  <img src="all/readme-assets/vesper-setup.png" alt="Vesper kurulum ekranı" width="92%">
</p>

<p align="center"><sub>Gerçek Vesper kurulum ekranı. Harici görsel barındırma veya CDN kullanılmaz.</sub></p>

## Öne çıkanlar

| | Yetenek | Ne sağlar? |
|---|---|---|
| ◉ | Ses öncelikli akış | Konuşma tanıma, anlık yapay zekâ yanıtı ve sesli okuma tek akışta birleşir |
| ◇ | İki sabit dil | Türkçe ve İngilizce; arayüzü, tanımayı, yanıt dilini ve sesi birlikte yönetir |
| ⌁ | Yerel yapılandırma | Tek kalıcı ayar kaynağı `apikey.json` dosyasıdır; eski tarayıcı kayıtları temizlenir |
| ≋ | Yerel nöral sesler | Piper kurulduğunda Türkçede **Fahrettin**, İngilizcede **lessac** kullanılır |
| ⌕ | Canlı web araması | Güncel sorularda Vesper cevaplamadan önce sunucu taraflı arama yapabilir |
| ⏸ | Doğal kesme | Düşünürken, ararken veya konuşurken dokunarak Vesper’ı anında susturabilirsin |
| ⛶ | Tam ekran odak | `F` tuşuyla tam ekrana girip çıkabilirsin |
| ♢ | Temiz seslendirme | Emojiler yazıda görünür; seslendirmeden önce otomatik çıkarılır |

## Nasıl çalışır?

```text
Sesin
  │
  ▼
Tarayıcı konuşma tanıma
  │
  ▼
Yerel Vesper proxy :8777 ─────► NVIDIA API
  │                                 │
  │                                 ▼
  │                            anlık yanıt
  │                                 │
  └─────────────────────────────────┘
                    │
                    ▼
        Piper :8778 veya tarayıcı sesi
                    │
                    ▼
                sesli cevap
```

Yerel proxy, tarayıcının CORS kısıtlamasını çözer; opsiyonel arama ve Piper uçlarını sunar. Dil modelini çevrimdışı hâle getirmez: **yapay zekâ yanıtları için NVIDIA API ve internet bağlantısı gerekir**.

## Hızlı başlangıç

### Gereksinimler

- macOS, Windows 10/11 veya yaygın bir masaüstü Linux dağıtımı
- Chrome veya Edge
- Python 3.9 veya daha yeni bir sürüm
- Yapay zekâ yanıtları için NVIDIA API anahtarı
- Tarayıcı için mikrofon izni

### 1. İndir

Depoyu ZIP olarak indirip çıkart veya Git ile klonla.

### 2. Vesper’ı başlat

İşletim sistemine uygun adımları kullan.

#### macOS

Terminal’de, çıkarttığın Vesper klasöründen bir kez izin ver:

```bash
chmod +x macosstart/openvesper.command macosstart/closevesper.command
```

Ardından `macosstart/openvesper.command` dosyasına çift tıkla.

#### Windows

`windowsstart\openvesper.bat` dosyasına çift tıkla.

#### Linux

Terminal’de, çıkarttığın Vesper klasöründen:

```bash
chmod +x linuxstart/openvesper.sh linuxstart/closevesper.sh
./linuxstart/openvesper.sh
```

Başlatıcı yerel sunucuyu `http://localhost:8777/vesper.html` adresinde çalıştırır ve mevcutsa Chrome veya Edge’i açar.

### 3. Yapılandır

1. NVIDIA API anahtarını (`nvapi-…`) gir.
2. Dahil edilen NVIDIA modellerinden birini seç.
3. Seçilen model destekliyorsa akıl yürütme çabasını belirle.
4. **Türkçe** veya **English** seç.
5. Oluşturulan `apikey.json` dosyasını `vesper.html` ile aynı klasöre kaydet.

> Dolu bir `apikey.json` dosyasını asla commit etme veya paylaşma. Depoda yalnızca boş şablon bulunur.

### 4. Konuş

Vesper başlatmanı istediğinde ekrana bir kez tıkla ve konuş. Duraklatmak, devam etmek veya cevabı kesmek için küreye ya da alt çubuğa dokun. Tam ekran için `F` tuşuna bas.

### Vesper’ı kapat

| Platform | Kapatma yöntemi |
|---|---|
| macOS | `macosstart/closevesper.command` dosyasına çift tıkla |
| Windows | `windowsstart\closevesper.bat` dosyasına çift tıkla |
| Linux | `./linuxstart/closevesper.sh` komutunu çalıştır |

## Otomatik yerel Piper sesleri

İlk başlatmada platform dosyası otomatik olarak `all/.piper-venv` ortamını oluşturur, uyumlu `piper-tts 1.8.0` paketini kurar ve iki ses modelini `all/voices/` klasörüne indirir:

- Türkçe: `tr_TR-fahrettin-medium`
- İngilizce: `en_US-lessac-medium`

İlk başlangıç internet gerektirir ve birkaç dakika sürebilir. Sonraki ses sentezi önbellekteki modellerle yerel çalışır. Piper o cihazda kurulamazsa Vesper yine açılır ve uyumlu bir tarayıcı sesine geçer.

macOS’te yayımlanan Piper paketindeki gömülü eSpeak yolu sorunu da başlatıcı tarafından otomatik düzeltilir; kullanıcıdan Homebrew veya elle Piper kurulumu istenmez.

## Yapılandırma

```json
{
  "provider": "",
  "apikey": "",
  "model": "",
  "effort": "",
  "language": ""
}
```

Vesper bu ayarları `localStorage` veya IndexedDB’den geri yüklemez. Boş bir `apikey.json`, her zaman kapatma düğmesi olmayan kurulum ekranını açar.

## Proje yapısı

```text
vesper/
├── vesper.html               # güncel arayüz ve uygulama mantığının tamamı
├── apikey.json               # boş yapılandırma şablonu
├── macosstart/               # macOS başlatma ve kapatma .command dosyaları
├── windowsstart/             # Windows başlatma ve kapatma .bat dosyaları
├── linuxstart/               # Linux başlatma ve kapatma .sh dosyaları
├── README.md                 # dil seçim sayfası
├── README_EN.md              # İngilizce dokümantasyon
├── README_TR.md              # Türkçe dokümantasyon
└── all/
    ├── vesper_launcher.py    # ortak platformlar arası süreç yöneticisi
    ├── vesper_server.py      # yerel web sunucusu ve NVIDIA proxy
    ├── piper_server.py       # yerel Piper TTS servisi
    ├── tests/                # davranış regresyon testleri
    ├── readme-assets/        # depoya ait görseller
    ├── vesper.py             # önceki terminal sürümü
    └── web/                  # önceki React prototipi
```

## Gizlilik ve ağ sınırları

| Veri veya bileşen | Nereye gider? |
|---|---|
| Arayüz ve proxy | Bilgisayarında yerel çalışır |
| Yapılandırma | Yerel `apikey.json` dosyasında tutulur |
| Yapay zekâ istemleri ve yanıtları | NVIDIA API’ye gönderilir ve oradan alınır |
| Canlı arama sorguları | Yerel proxy üzerinden DuckDuckGo’ya gönderilir |
| Konuşma tanıma | Seçilen tarayıcı tarafından sağlanır |
| Piper ses sentezi | Kurulum ve ilk model indirmesinden sonra yerel çalışır |

## Tarayıcı desteği

Vesper, Web Speech API kullandığı için **Chrome ve Edge** hedeflenmiştir. Firefox, Opera, Brave ve Vivaldi mevcut konuşma tanıma akışında desteklenmez.

Chrome veya Edge’e hem tarayıcıdan hem işletim sisteminin gizlilik ayarlarından mikrofon izni ver. Linux’ta ayarın yeri masaüstü ortamına göre değişir.

## Testler

Odaklı davranış testlerini çalıştırmak için:

```bash
node --test all/tests/*.test.mjs
```

Testler; emojilerin seslendirilmemesini, tam ekran davranışını, sabit dil yapılandırmasını, boş ayarla açılışı ve GitHub bağlantısının stilini kapsar.

## Sorun giderme

<details>
<summary><strong>macOS .command dosyası açılmıyor</strong></summary>

macOS erişim ayrıcalığı hatası gösterirse Hızlı başlangıç bölümündeki `chmod +x` komutunu çalıştır. Gatekeeper dosyayı doğrulayamadığını söylerse **Bitti** seçeneğine bas, **Sistem Ayarları → Gizlilik ve Güvenlik** bölümünü aç ve `openvesper.command` için **Yine de Aç** seçeneğini kullan. Bu izni yalnızca güvendiğin kaynaktan gelen dosyaya ver.
</details>

<details>
<summary><strong>Linux .sh dosyası çalışmıyor</strong></summary>

Hızlı başlangıç bölümündeki Linux `chmod +x` komutunu çalıştır; ardından çıkartılan Vesper klasöründen `./linuxstart/openvesper.sh` komutunu kullan.
</details>

<details>
<summary><strong>Windows .bat dosyasını engelliyor</strong></summary>

ZIP dosyasını resmî depodan indirdiğini doğrula. Windows SmartScreen görünürse yayıncı uyarısını incele ve yalnızca dosyalara güveniyorsan **Daha fazla bilgi → Yine de çalıştır** seçeneğini kullan.
</details>

<details>
<summary><strong>Mikrofon başlamıyor</strong></summary>

Chrome veya Edge kullan, “başlamak için ekrana dokun” yazdığında sayfaya bir kez tıkla, site mikrofon iznini onayla ve işletim sisteminde doğru giriş aygıtını seç.
</details>

<details>
<summary><strong>Vesper kimlik doğrulama veya model hatası gösteriyor</strong></summary>

Ayarları aç, anahtarın `nvapi-` ile başladığını doğrula ve NVIDIA hesabında etkin olan başka bir model seç.
</details>

<details>
<summary><strong>Fahrettin veya lessac sesi gelmiyor</strong></summary>

İlk başlangıç terminalini otomatik kurulum bitene kadar açık tut. Kurulum başarısızsa `all/.vesper-piper.log` dosyasını kontrol et; Vesper uygun bir tarayıcı sesine bilinçli olarak geçer.
</details>

## Çalışma zamanı bağımlılıkları

Vesper’ın temel yapay zekâ servisi NVIDIA’dır. Aşağıdaki yardımcı bağımlılıklar sesli giriş, canlı arama, yerel seslendirme ve platform başlatıcıları için kullanılır:

| Bağımlılık | Ne için? | Olmazsa ne olur? |
|---|---|---|
| **Chrome/Edge Web Speech API** | Konuşmanı yazıya çevirmek | Sesli giriş çalışmaz |
| **DuckDuckGo** | Güncel web araması | Yalnızca canlı arama başarısız olur; normal yapay zekâ sohbeti devam eder |
| **Piper + Hugging Face** | Fahrettin ve lessac seslerini indirmek ve çalıştırmak | Vesper tarayıcının kendi sesine geçer |
| **PyPI** | `piper-tts` paketinin ilk kurulumu | Piper kurulamaz; tarayıcı sesi kullanılabilir |
| **Python 3.9+ + işletim sistemi araçları** | Yerel sunucuyu macOS, Windows ve Linux’ta başlatıp kapatmak | Platform başlatıcıları çalışmaz |

Bu servislerin hiçbiri README’yi barındırmak için kullanılmaz. Burada görünen tüm banner ve ekran görüntüleri doğrudan projenin içinde tutulur.

---

<p align="center">
  Odaklı ve eller serbest konuşmalar için geliştirildi.<br>
  <a href="README_EN.md">Switch to the English README →</a>
</p>
