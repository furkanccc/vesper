<p align="center">
  <img src="all/readme-assets/vesper-banner.svg" alt="Vesper animated banner" width="100%">
</p>

<p align="center">
  <strong>English</strong> &nbsp;•&nbsp; <a href="README_TR.md">Türkçe</a>
</p>

<p align="center">
  <strong>A focused, voice-first AI experience for macOS, Windows, and Linux.</strong><br>
  Speak naturally. Get a streamed answer. Hear it back.
</p>

<p align="center">
  <code>Local interface</code>&nbsp;&nbsp;
  <code>NVIDIA API</code>&nbsp;&nbsp;
  <code>Turkish + English</code>&nbsp;&nbsp;
  <code>Optional offline TTS</code>
</p>

---

## Meet Vesper

Vesper is a cinematic browser-based voice assistant built around one simple interaction: **talk, listen, continue**. Its interface and lightweight proxy run locally on your computer, while language-model responses are streamed from the NVIDIA API.

The language selected during setup stays authoritative for the whole session. Choose Turkish and Vesper keeps answering in Turkish; choose English and it stays in English—even when the spoken input changes language.

<p align="center">
  <img src="all/readme-assets/vesper-setup.png" alt="Vesper setup screen" width="92%">
</p>

<p align="center"><sub>The real Vesper setup screen. No external image hosting or CDN is used.</sub></p>

## Highlights

| | Capability | What it means |
|---|---|---|
| ◉ | Voice-first loop | Speech recognition, streamed AI response, and spoken playback in one flow |
| ◇ | Two fixed languages | Turkish and English control the interface, recognition, answer language, and voice |
| ⌁ | Local configuration | `apikey.json` is the only persisted configuration source; legacy browser storage is cleared |
| ≋ | Local neural voices | Piper provides **Fahrettin** for Turkish and **lessac** for English when installed |
| ⌕ | Live web search | Time-sensitive questions can invoke server-side search before Vesper answers |
| ⏸ | Natural interruption | Tap while Vesper is thinking, searching, or speaking to interrupt it immediately |
| ⛶ | Distraction-free mode | Press `F` to enter or leave fullscreen |
| ♢ | Clean speech | Emoji stays visible in text but is removed before speech synthesis |

## How it works

```text
Your voice
    │
    ▼
Browser speech recognition
    │
    ▼
Local Vesper proxy :8777 ─────► NVIDIA API
    │                               │
    │                               ▼
    │                         streamed answer
    │                               │
    └───────────────────────────────┘
                    │
                    ▼
        Piper :8778 or browser voice
                    │
                    ▼
                spoken reply
```

The local proxy solves browser CORS restrictions and exposes the optional search and Piper endpoints. It does not turn the language model into an offline model: **AI responses still require the NVIDIA API and an internet connection**.

## Quick start

### Requirements

- macOS, Windows 10/11, or a common desktop Linux distribution
- Chrome or Edge
- Python 3.9 or newer
- An NVIDIA API key for AI responses
- Microphone permission for your browser

### 1. Download

Download the repository as a ZIP and extract it, or clone it with Git.

### 2. Start Vesper

Choose the instructions for your operating system.

#### macOS

In Terminal, from the extracted Vesper folder, grant permission once:

```bash
chmod +x macosstart/openvesper.command macosstart/closevesper.command
```

Then double-click `macosstart/openvesper.command`.

#### Windows

Double-click `windowsstart\openvesper.bat`.

#### Linux

In a terminal, from the extracted Vesper folder:

```bash
chmod +x linuxstart/openvesper.sh linuxstart/closevesper.sh
./linuxstart/openvesper.sh
```

The launcher starts the local server at `http://localhost:8777/vesper.html` and opens Chrome or Edge when available.

### 3. Configure

1. Enter your NVIDIA API key (`nvapi-…`).
2. Pick one of the included NVIDIA models.
3. Choose a reasoning effort when the selected model supports it.
4. Choose **Türkçe** or **English**.
5. Save the generated `apikey.json` beside `vesper.html`.

> Never commit or share a populated `apikey.json`. The repository contains an empty template only.

### 4. Talk

Click once when Vesper asks you to start, then speak. Click the orb or bottom bar to pause, resume, or interrupt. Press `F` for fullscreen.

### Stop Vesper

| Platform | Stop command |
|---|---|
| macOS | Double-click `macosstart/closevesper.command` |
| Windows | Double-click `windowsstart\closevesper.bat` |
| Linux | Run `./linuxstart/closevesper.sh` |

## Automatic local Piper voices

On the first start, the platform launcher automatically creates `all/.piper-venv`, installs the compatible `piper-tts 1.8.0` package, and downloads both voice models into `all/voices/`:

- Turkish: `tr_TR-fahrettin-medium`
- English: `en_US-lessac-medium`

The first start requires internet access and can take several minutes. Later speech synthesis runs locally from the cached models. If Piper installation is unavailable on that device, Vesper still opens and falls back to a compatible browser voice.

On macOS, the launcher also repairs the embedded eSpeak path issue in the published Piper package automatically; users do not need Homebrew or a manual Piper installation.

## Configuration

```json
{
  "provider": "",
  "apikey": "",
  "model": "",
  "effort": "",
  "language": ""
}
```

Vesper does not restore these settings from `localStorage` or IndexedDB. An empty `apikey.json` always opens the non-dismissible setup screen.

## Project structure

```text
vesper/
├── vesper.html               # complete current interface and application logic
├── apikey.json               # empty configuration template
├── macosstart/               # macOS start and stop .command files
├── windowsstart/             # Windows start and stop .bat files
├── linuxstart/               # Linux start and stop .sh files
├── README.md                 # language landing page
├── README_EN.md              # English documentation
├── README_TR.md              # Turkish documentation
└── all/
    ├── vesper_launcher.py    # shared cross-platform process manager
    ├── vesper_server.py      # local web server and NVIDIA proxy
    ├── piper_server.py       # local Piper TTS service
    ├── tests/                # behavior regression tests
    ├── readme-assets/        # repository-owned visuals
    ├── vesper.py             # earlier terminal edition
    └── web/                  # earlier React prototype
```

## Privacy and network boundaries

| Data or component | Where it goes |
|---|---|
| Interface and proxy | Runs locally on your computer |
| Configuration | Stored in the local `apikey.json` file |
| AI prompts and replies | Sent to and received from the NVIDIA API |
| Live search queries | Sent to DuckDuckGo through the local proxy |
| Speech recognition | Provided by the selected browser |
| Piper speech synthesis | Runs locally after installation and initial model download |

## Browser support

Vesper targets **Chrome and Edge** because it relies on the Web Speech API. Firefox, Opera, Brave, and Vivaldi are not supported by the current voice-recognition flow.

Also allow microphone access for Chrome or Edge in the browser and in your operating system's privacy settings. On Linux, the exact setting depends on the desktop environment.

## Tests

Run the focused behavior suite with:

```bash
node --test all/tests/*.test.mjs
```

The suite covers emoji-safe speech, fullscreen behavior, fixed language configuration, empty-config startup, and GitHub link styling.

## Troubleshooting

<details>
<summary><strong>The macOS .command file will not open</strong></summary>

If macOS reports missing access privileges, run the `chmod +x` command from Quick start. If Gatekeeper says Apple cannot verify the file, click **Done**, open **System Settings → Privacy & Security**, and use **Open Anyway** for `openvesper.command`. Only grant this exception to files from a source you trust.
</details>

<details>
<summary><strong>The Linux .sh file will not run</strong></summary>

Run the Linux `chmod +x` command from Quick start, then launch it from the extracted Vesper folder with `./linuxstart/openvesper.sh`.
</details>

<details>
<summary><strong>The Windows .bat file is blocked</strong></summary>

Make sure the ZIP was downloaded from the official repository. If Windows SmartScreen appears, review the publisher warning and choose **More info → Run anyway** only when you trust the downloaded files.
</details>

<details>
<summary><strong>The microphone does not start</strong></summary>

Use Chrome or Edge, click the page once when it says “click to start,” allow the site-level microphone prompt, and select the intended input device in the operating system.
</details>

<details>
<summary><strong>Vesper shows an authentication or model error</strong></summary>

Open Settings, verify that the key begins with `nvapi-`, and select a model enabled for that NVIDIA account.
</details>

<details>
<summary><strong>The intended Fahrettin or lessac voice is missing</strong></summary>

Keep the first-start terminal window open while the automatic installation finishes. If installation fails, check `all/.vesper-piper.log`; Vesper deliberately falls back to an available browser voice.
</details>

## Runtime dependencies

NVIDIA is Vesper's primary AI service. The following supporting dependencies are used for voice input, live search, local speech, and the platform launchers:

| Dependency | Used for | If unavailable |
|---|---|---|
| **Chrome/Edge Web Speech API** | Converts your speech to text | Voice input does not work |
| **DuckDuckGo** | Provides live web-search results | Only live search fails; normal AI conversations continue |
| **Piper + Hugging Face** | Downloads and runs the Fahrettin and lessac voices | Vesper falls back to the browser's voice |
| **PyPI** | Installs the `piper-tts` package | Piper cannot be installed; the browser voice remains available |
| **Python 3.9+ + operating-system tools** | Starts and stops the local server on macOS, Windows, and Linux | The platform launchers do not work |

These services are not used to host this README. Every banner and screenshot displayed here is stored inside the repository.

---

<p align="center">
  Built for focused, hands-free conversations.<br>
  <a href="README_TR.md">Türkçe README’ye geç →</a>
</p>
