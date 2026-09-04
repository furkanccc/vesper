# Vesper

Sesli asistan — tarayıcıda çalışır, tamamen NVIDIA üzerinden konuşur ve cevap verir.

## Başlatma / kapatma

| Dosya | Ne yapar |
|---|---|
| **openvesper.command** | `localhost:8777`'de sunucu + **NVIDIA'ya CORS'lu proxy** başlatır, tarayıcıda `vesper.html`'i açar |
| **closevesper.command** | Sunucuyu durdurur, başka bir şey yapmaz |

Çift tıkla. `openvesper` penceresini kapatabilirsin — sunucu arka planda çalışmaya devam eder; durdurmak için `closevesper`.

> NVIDIA, tarayıcıdan gelen istekleri doğrudan reddediyor (CORS). `openvesper`'in başlattığı proxy bu isteği kendi arkasından NVIDIA'ya iletip cevabı sana CORS izniyle geri veriyor — bu yüzden artık `localhost` gerekiyor, sade `.html` çift tıklaması yetmiyor.

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

- `openvesper.command` çalıştığında `all/.piper-venv` içindeki ayrı bir Python süreci (`all/piper_server.py`, port `8778`) başlar, ana proxy `/tts` isteklerini ona yönlendirir.
- Başlangıçta yalnızca **Türkçe** veya **English** seçilir. Bu seçim hem konuşma tanımayı hem arayüzü hem de yapay zekânın cevap dilini oturum boyunca sabitler; kullanıcı başka bir dilde konuşsa bile Vesper seçilen dilde cevap verir.
- Türkçe için sabit ses **Fahrettin**, İngilizce için sabit ses **lessac**'tır. İki model de `all/voices/` klasöründe yerel tutulur ve tamamen offline çalışır.
- Piper kurulu değilse veya `all/piper_server.py` çalışmıyorsa da hiçbir şey bozulmaz — Vesper direkt tarayıcının kendi sesine düşer.
- Tarayıcı-sesi yedeği de seçilen dilde uygun bir sistem sesi kullanır; ayrıca ses seçici yoktur.

Piper'ı kurmak için (bir kere, ~150MB `pip` paketleri):
```bash
/opt/homebrew/bin/python3.12 -m venv all/.piper-venv
all/.piper-venv/bin/pip install piper-tts
```
Kurulum yoksa `openvesper.command` bunu otomatik atlar, uygulama yine çalışır — sadece ses tarayıcıdan gelir.

## Dosyalar

| Dosya | |
|---|---|
| `vesper.html` | Uygulamanın tamamı (arayüz + mantık, tek dosya) |
| `openvesper.command` / `closevesper.command` | Proxy + Piper ses sunucusunu başlatır/durdurur (birer betik) |
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

macOS: **Sistem Ayarları › Gizlilik ve Güvenlik › Mikrofon** altında Chrome açık olmalı — site izni tek başına yetmez.

## Diğer
- `all/vesper.py` — eski terminal Python sürümü
- `all/web/` — eski React denemesi (kullanılmıyor)
