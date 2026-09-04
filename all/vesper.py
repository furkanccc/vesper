"""
Vesper - sesli yapay zeka asistanı (Jarvis gibi).

Nasıl çalışır:
  1. Mikrofonu sürekli dinler.
  2. Cümlende "vesper" kelimesini duyunca uyanır.
  3. Ne söylediğini anlar, NVIDIA API'ye sorar.
  4. Cevabı sesli söyler.

Kapatmak için: Ctrl+C  (ya da "vesper kapan" / "vesper görüşürüz" de).
"""

import os
import re
import subprocess
import sys

import speech_recognition as sr
from dotenv import load_dotenv
from faster_whisper import WhisperModel
from openai import OpenAI

load_dotenv()

API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
MODEL = os.getenv("VESPER_MODEL", "meta/llama-3.3-70b-instruct").strip()
VOICE = os.getenv("VESPER_VOICE", "Yelda").strip()
WAKE_WORDS = ("vesper", "wesper", "vasper", "vesber")
STOP_PHRASES = ("kapan", "görüşürüz", "kapat kendini", "uyu")

if not API_KEY or "BURAYA" in API_KEY:
    sys.exit(".env dosyasına geçerli bir NVIDIA_API_KEY yazmalısın.")

client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=API_KEY)

SYSTEM_PROMPT = (
    "Senin adın Vesper. Türkçe konuşan, yardımsever, kısa ve net cevap veren "
    "bir sesli asistansın. Cevapların sesli okunacağı için sade cümleler kur, "
    "madde işareti ve kod bloğu kullanma. Gereksiz uzatma."
)
history = [{"role": "system", "content": SYSTEM_PROMPT}]

print("Whisper modeli yükleniyor (ilk seferde birkaç dakika sürebilir)...")
stt = WhisperModel("small", device="cpu", compute_type="int8")
print("Hazır.")


def speak(text: str) -> None:
    print(f"Vesper: {text}")
    subprocess.run(["say", "-v", VOICE, text], check=False)


def transcribe(audio: sr.AudioData) -> str:
    with open("/tmp/vesper_input.wav", "wb") as f:
        f.write(audio.get_wav_data())
    segments, _ = stt.transcribe("/tmp/vesper_input.wav", language="tr")
    return " ".join(s.text for s in segments).strip()


def ask_nvidia(prompt: str) -> str:
    history.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=MODEL, messages=history, temperature=0.6, max_tokens=512
    )
    answer = resp.choices[0].message.content.strip()
    history.append({"role": "assistant", "content": answer})
    if len(history) > 21:  # sistem mesajı + son 10 tur
        del history[1:3]
    return answer


def strip_wake_word(text: str) -> str:
    pattern = r"\b(" + "|".join(WAKE_WORDS) + r")\b[\s,:-]*"
    return re.sub(pattern, "", text, count=1, flags=re.IGNORECASE).strip()


def main() -> None:
    recognizer = sr.Recognizer()
    recognizer.pause_threshold = 1.0
    mic = sr.Microphone()
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)

    speak("Vesper hazır. Beni çağırmak için Vesper de.")

    while True:
        try:
            with mic as source:
                audio = recognizer.listen(source, phrase_time_limit=15)
        except KeyboardInterrupt:
            break

        try:
            text = transcribe(audio)
        except Exception as e:  # noqa: BLE001
            print(f"(anlaşılamadı: {e})")
            continue

        if not text:
            continue
        print(f"Duydum: {text}")

        low = text.lower()
        if not any(w in low for w in WAKE_WORDS):
            continue

        command = strip_wake_word(text)
        if not command:
            speak("Efendim?")
            continue

        if any(p in command.lower() for p in STOP_PHRASES):
            speak("Görüşürüz.")
            break

        try:
            speak(ask_nvidia(command))
        except Exception as e:  # noqa: BLE001
            print(f"API hatası: {e}")
            speak("NVIDIA'ya ulaşamadım. Bağlantını ve anahtarını kontrol et.")

    speak("Kapanıyorum.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nÇıkılıyor.")
