# Vesper

Sesli asistan — tarayıcıda çalışır, tamamen NVIDIA üzerinden konuşur ve cevap verir.

## Başlatma / kapatma

| Platform | Başlat | Kapat |
|---|---|---|
| macOS | `macosstart/openvesper.command` | `macosstart/closevesper.command` |
| Windows | `windowsstart/openvesper.bat` | `windowsstart/closevesper.bat` |
| Linux | `linuxstart/openvesper.sh` | `linuxstart/closevesper.sh` |

Başlatıcılar ortak `all/vesper_launcher.py` süreç yöneticisini kullanır; yerel sunucu ve NVIDIA proxy `all/vesper_server.py` tarafından çalıştırılır.

> NVIDIA, tarayıcıdan gelen istekleri doğrudan reddediyor (CORS). Platform başlatıcısının çalıştırdığı proxy bu isteği kendi arkasından NVIDIA'ya iletip cevabı sana CORS izniyle geri veriyor — bu yüzden `localhost` gerekiyor, sade `.html` çift tıklaması yetmiyor.

## Nasıl konuşulur

Açılınca **"başlamak için ekrana dokun"** — bir kez tıkla. Konuş → sol panelde **Sen —** olarak yazıya döker → NVIDIA'ya gider → **Vesper —** cevabı sol panelde belirir ve **sesli okunur**.

**Orb'a (ya da alt çubuğa) dokunmak tek kontrol noktası:**
- dinlerken dokun → **durur** (mikrofon kapanır, cevap vermez)
- durmuşken dokun → **tekrar dinlemeye başlar**
- Vesper düşünür/ararken/konuşurken dokun → **sözünü keser**
- hata varsa dokun → **tekrar dener**

## Gerçek zamanlı web araması

Vesper'a **hava durumu, güncel haberler, fiyat, skor** gibi anlık bir şey sorarsan, kendiliğinden web'de arama yapıp sonuca göre cevap verir (DuckDuckGo, sunucu tarafında — anahtar gerekmez). Alt çubukta bu sırada **"webde aranıyor…"** yazar. Modelin bunu desteklememesi durumunda normal cevaba döner.

## Ses — tamamen yerel, offline (Piper)

Vesper'ın sesi artık tarayıcının/işletim sisteminin kendi TTS'ine bağımlı değil — [Piper](https://github.com/OHF-Voice/piper1-gpl) adında açık kaynak, tamamen offline çalışan bir nöral ses motoru kullanıyor. Ne API key, ne hesap, ne de sürekli internet gerekir:

- Platform başlatıcısı ilk çalışmada `all/.piper-venv` ortamını oluşturur, uyumlu `piper-tts 1.8.0` paketini kurar ve iki sesi otomatik indirir. Ardından `all/piper_server.py` port `8778` üzerinde başlar; ana proxy `/tts` isteklerini ona yönlendirir.
- macOS Piper paketindeki gömülü eSpeak yolu sorunu da başlatıcı tarafından otomatik düzeltilir; Homebrew veya elle Piper kurulumu gerekmez.
- Başlangıçta yalnızca **Türkçe** veya **English** seçilir. Bu seçim hem konuşma tanımayı hem arayüzü hem de yapay zekânın cevap dilini oturum boyunca sabitler; kullanıcı başka bir dilde konuşsa bile Vesper seçilen dilde cevap verir.
- Türkçe için sabit ses **Fahrettin**, İngilizce için sabit ses **lessac**'tır. İki model de `all/voices/` klasöründe yerel tutulur ve tamamen offline çalışır.
- Piper kurulu değilse veya `all/piper_server.py` çalışmıyorsa da hiçbir şey bozulmaz — Vesper direkt tarayıcının kendi sesine düşer.
- Tarayıcı-sesi yedeği de seçilen dilde uygun bir sistem sesi kullanır; ayrıca ses seçici yoktur.

Kurulum veya model indirme başarısız olursa uygulama yine çalışır; ses tarayıcıdan gelir.

## Dosyalar

| Dosya | |
|---|---|
| `vesper.html` | Uygulamanın tamamı (arayüz + mantık, tek dosya) |
| `macosstart/`, `windowsstart/`, `linuxstart/` | Her platform için başlatma ve kapatma dosyaları |
| `all/vesper_launcher.py` | Ortak süreç, otomatik Piper kurulumu ve tarayıcı açma mantığı |
| `all/vesper_server.py` | Yerel arayüz sunucusu, NVIDIA proxy ve web araması |
| `all/piper_server.py` | Offline ses motoru (`all/.piper-venv` içinde çalışır, port 8778) |
| `all/.piper-venv/` | Piper için ayrı Python ortamı (git'e girmez) |
| `all/voices/` | İndirilen ses modelleri + `voices.json` önbelleği (git'e girmez) |
| `apikey.json` | Kaydettiğin ayarlar: `{provider, apikey, model, effort, language}`. Her açılışta buradan okunur. **Paylaşma.** |

## Ayarlar (⚙)

- **API Anahtarı** — `nvapi-…` ile başlamalı
- **Model** — 10 seçili NVIDIA modeli (build.nvidia.com güncel kataloğu, Eylül 2026). Varsayılan: `openai/gpt-oss-20b` (test edildi, temiz Türkçe cevap veriyor).
  Bir model **hesabında etkin değilse** sohbet anında hata gösterir — ayarlardan başka model dene.
- **Çaba** — sadece akıl yürüten/hibrit modellerde çıkar
- **Dil** — yalnızca Türkçe veya İngilizce; cihaz Türkçe değilse ilk varsayılan İngilizcedir

## Gereksinim

**Chrome veya Edge** (Web Speech API). Firefox / Opera / Brave / Vivaldi çalışmaz.

Chrome veya Edge için hem tarayıcıda hem işletim sisteminde mikrofon izni açık olmalı. Doğru giriş aygıtının seçili olduğunu da kontrol et.

## Diğer
- `all/vesper.py` — eski terminal Python sürümü
- `all/web/` — eski React denemesi (kullanılmıyor)
