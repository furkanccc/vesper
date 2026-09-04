<p align="center">
  <img src="all/readme-assets/vesper-banner.svg" alt="Vesper animated banner" width="100%">
</p>

<p align="center">
  <strong>English</strong> &nbsp;•&nbsp; <a href="README_TR.md">Türkçe</a>
</p>

<p align="center">
  <strong>A focused, voice-first AI experience for macOS.</strong><br>
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

Vesper is a cinematic browser-based voice assistant built around one simple interaction: **talk, listen, continue**. Its interface and lightweight proxy run locally on your Mac, while language-model responses are streamed from the NVIDIA API.

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

- macOS
- Chrome or Edge
- Python 3
- An NVIDIA API key for AI responses
- Microphone permission for your browser

### 1. Download

Download the repository as a ZIP and extract it, or clone it with Git.

### 2. Allow the launcher to run

The `.command` files downloaded in a GitHub ZIP can lose their executable permission. From Terminal, inside the extracted Vesper folder, run:

```bash
chmod +x openvesper.command closevesper.command
```

If you do not want to navigate to the folder in Terminal, type `chmod +x `, drag both `openvesper.command` and `closevesper.command` onto the same command line, then press Return.

### 3. Start Vesper

Double-click `openvesper.command`. It starts the local server at `http://localhost:8777/vesper.html` and opens the interface in your default browser.

### 4. Configure

1. Enter your NVIDIA API key (`nvapi-…`).
2. Pick one of the included NVIDIA models.
3. Choose a reasoning effort when the selected model supports it.
4. Choose **Türkçe** or **English**.
5. Save the generated `apikey.json` beside `vesper.html`.

> Never commit or share a populated `apikey.json`. The repository contains an empty template only.

### 5. Talk

Click once when Vesper asks you to start, then speak. Click the orb or bottom bar to pause, resume, or interrupt. Press `F` for fullscreen.

### Stop Vesper

Double-click `closevesper.command`.

## Optional: local Piper voices

Vesper works without Piper by falling back to the browser voice. For the intended local neural voices, install Piper once:

```bash
/opt/homebrew/bin/python3.12 -m venv all/.piper-venv
all/.piper-venv/bin/pip install piper-tts
```

On the first Piper request, Vesper downloads and caches the selected voice model under `all/voices/`:

- Turkish: `tr_TR-fahrettin-medium`
- English: `en_US-lessac-medium`

After the model is cached, speech synthesis works locally. The voice environment and model files are intentionally excluded from the repository because they are large and device-specific.

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
├── openvesper.command        # local proxy + optional Piper launcher
├── closevesper.command       # clean shutdown
├── README.md                 # language landing page
├── README_EN.md              # English documentation
├── README_TR.md              # Turkish documentation
└── all/
    ├── piper_server.py       # local Piper TTS service
    ├── tests/                # behavior regression tests
    ├── readme-assets/        # repository-owned visuals
    ├── vesper.py             # earlier terminal edition
    └── web/                  # earlier React prototype
```

## Privacy and network boundaries

| Data or component | Where it goes |
|---|---|
| Interface and proxy | Runs locally on your Mac |
| Configuration | Stored in the local `apikey.json` file |
| AI prompts and replies | Sent to and received from the NVIDIA API |
| Live search queries | Sent to DuckDuckGo through the local proxy |
| Speech recognition | Provided by the selected browser |
| Piper speech synthesis | Runs locally after installation and initial model download |

## Browser support

Vesper targets **Chrome and Edge** because it relies on the Web Speech API. Firefox, Opera, Brave, and Vivaldi are not supported by the current voice-recognition flow.

On macOS, also enable the browser under **System Settings → Privacy & Security → Microphone**.

## Tests

Run the focused behavior suite with:

```bash
node --test all/tests/*.test.mjs
```

The suite covers emoji-safe speech, fullscreen behavior, fixed language configuration, empty-config startup, and GitHub link styling.

## Troubleshooting

<details>
<summary><strong>The .command file will not open</strong></summary>

If macOS says **“The file could not be executed because you do not have appropriate access privileges”**, the executable permission is missing:

1. Open Terminal.
2. Type `chmod +x `, including the trailing space, but do not press Return yet.
3. Drag both `openvesper.command` and `closevesper.command` from Finder into Terminal.
4. When both file paths appear on the same command line, press Return.
5. Double-click `openvesper.command` again.

If macOS says **“Apple could not verify this file is free of malware”**:

1. Click **Done** in the warning; do not move the file to the Trash.
2. Open **Apple menu → System Settings → Privacy & Security**.
3. Scroll to **Security** and click **Open Anyway** for `openvesper.command`.
4. Authenticate with your password or Touch ID, then click **Open** in the final prompt.

Only grant this exception to a file downloaded from a source you trust.
</details>

<details>
<summary><strong>The microphone does not start</strong></summary>

Use Chrome or Edge, allow the site-level microphone prompt, and verify the macOS microphone permission for that browser.
</details>

<details>
<summary><strong>Vesper shows an authentication or model error</strong></summary>

Open Settings, verify that the key begins with `nvapi-`, and select a model enabled for that NVIDIA account.
</details>

<details>
<summary><strong>The intended Fahrettin or lessac voice is missing</strong></summary>

Install Piper using the optional setup above. Without it, Vesper deliberately falls back to an available browser voice.
</details>

## Runtime dependencies

NVIDIA is Vesper's primary AI service. The following supporting dependencies are used for voice input, live search, local speech, and the macOS launcher:

| Dependency | Used for | If unavailable |
|---|---|---|
| **Chrome/Edge Web Speech API** | Converts your speech to text | Voice input does not work |
| **DuckDuckGo** | Provides live web-search results | Only live search fails; normal AI conversations continue |
| **Piper + Hugging Face** | Downloads and runs the Fahrettin and lessac voices | Vesper falls back to the browser's voice |
| **PyPI** | Installs the `piper-tts` package | Piper cannot be installed; the browser voice remains available |
| **Python 3 + macOS tools** | Starts and stops the local server | The `.command` launchers do not work |

These services are not used to host this README. Every banner and screenshot displayed here is stored inside the repository.

---

<p align="center">
  Built for focused, hands-free conversations.<br>
  <a href="README_TR.md">Türkçe README’ye geç →</a>
</p>
