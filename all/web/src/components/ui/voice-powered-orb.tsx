// @ts-nocheck -- vendored WebGL component; ogl's strict GL context types clash with lib.dom
"use client";

import { useEffect, useRef } from "react";
import type { FC } from "react";
import { Renderer, Program, Mesh, Triangle, Vec3 } from "ogl";
import { cn } from "@/lib/utils";
import { VoiceActivityDetector } from "@/lib/voice-activity";

interface VoicePoweredOrbProps {
  className?: string;
  hue?: number;
  enableVoiceControl?: boolean;
  voiceSensitivity?: number;
  maxRotationSpeed?: number;
  maxHoverIntensity?: number;
  onVoiceDetected?: (detected: boolean) => void;
  /** Acoustic echo cancellation — stops the orb hearing speaker playback. */
  echoCancellation?: boolean;
  /** Browser noise suppression on the captured stream. */
  noiseSuppression?: boolean;
  /** dB the voice must rise above the adaptive noise floor to register. */
  noiseGateDb?: number;
  /** Analysed speech band [lowHz, highHz]; energy outside is ignored. */
  speechBand?: [number, number];
  /** 0..1 — how sure it must be that a sound is a voice. Higher = stricter. */
  voiceStrictness?: number;
  /** Max time-domain crest factor; spikier frames are treated as transients. */
  transientCrestMax?: number;
  /** Log per-frame VAD metrics to the console (~4×/s) for tuning. */
  debugVoice?: boolean;
}

export const VoicePoweredOrb: FC<VoicePoweredOrbProps> = ({
  className,
  hue = 0,
  enableVoiceControl = true,
  voiceSensitivity = 1.5,
  maxRotationSpeed = 1.2,
  maxHoverIntensity = 0.8,
  onVoiceDetected,
  echoCancellation = true,
  noiseSuppression = true,
  noiseGateDb = 11,
  speechBand = [140, 3800],
  voiceStrictness = 0.45,
  transientCrestMax = 7,
  debugVoice = false,
}) => {
  const ctnDom = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number>();
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);

  const vert = /* glsl */ `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = /* glsl */ `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }

    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i;
      yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0),
        dot(d1, d1),
        dot(d2, d2),
        dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.6;
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }

    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);

      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);
      v0 *= smoothstep(r0 * 1.05, r0, len);
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);

      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

      vec3 col = mix(color1, color2, cl);
      col = mix(color3, col, v0);
      col = (col + v1) * v2 * v3;
      col = clamp(col, 0.0, 1.0);

      return extractAlpha(col);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;

      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  // Per-frame voice activity result (0 level / not speaking when the detector
  // is gone). Steady background noise is rejected inside the detector.
  const analyzeVoice = (now: number) => {
    if (!vadRef.current) return { level: 0, speaking: false };
    return vadRef.current.frame(now);
  };

  // Stop microphone and cleanup
  const stopMicrophone = () => {
    try {
      // Tear down the voice-activity graph first
      if (vadRef.current) {
        vadRef.current.dispose();
        vadRef.current = null;
      }

      // Stop all tracks in the media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }

      // Disconnect and cleanup audio nodes
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      dataArrayRef.current = null;
      console.log('Microphone stopped and cleaned up');
    } catch (error) {
      console.warn('Error stopping microphone:', error);
    }
  };

  // Initialize microphone access
  const initMicrophone = async () => {
    try {
      // Clean up any existing microphone first
      stopMicrophone();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Browser-side AEC + noise suppression so the orb reacts to the
          // user's voice, not to speaker echo or steady room noise.
          echoCancellation,
          noiseSuppression,
          autoGainControl: true,
          channelCount: 1,
          // Chromium-only extra isolation; harmless where unsupported.
          // @ts-expect-error non-standard constraint
          voiceIsolation: true,
        },
      });

      // Store the stream reference for cleanup
      mediaStreamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume audio context if needed
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      // Speech-band voice-activity detector (rejects background noise).
      vadRef.current = new VoiceActivityDetector(
        audioContextRef.current,
        microphoneRef.current,
        {
          minHz: speechBand[0],
          maxHz: speechBand[1],
          gateDb: noiseGateDb,
          voicenessMin: voiceStrictness,
          crestMax: transientCrestMax,
          sensitivity: voiceSensitivity,
        },
      );

      console.log('Microphone initialized (AEC + noise gate active)');
      return true;
    } catch (error) {
      console.warn("Microphone access denied or not available:", error);
      return false;
    }
  };

  useEffect(() => {
    const container = ctnDom.current;
    if (!container) return;

    let rendererInstance: Renderer | null = null;
    let glContext: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let rafId: number;
    let program: Program | null = null;

    try {
      rendererInstance = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: window.devicePixelRatio || 1
      });
      glContext = rendererInstance.gl;
      // Set clear color to transparent to avoid white flash
      glContext.clearColor(0, 0, 0, 0);
      // Enable alpha blending for proper transparency
      glContext.enable(glContext.BLEND);
      glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);

      // Clear any existing canvas
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(glContext.canvas);

      const geometry = new Triangle(glContext);
      program = new Program(glContext, {
        vertex: vert,
        fragment: frag,
        uniforms: {
          iTime: { value: 0 },
          iResolution: {
            value: new Vec3(
              glContext.canvas.width,
              glContext.canvas.height,
              glContext.canvas.width / glContext.canvas.height
            ),
          },
          hue: { value: hue },
          hover: { value: 0 },
          rot: { value: 0 },
          hoverIntensity: { value: 0 },
        },
      });

      const mesh = new Mesh(glContext, { geometry, program });

      const resize = () => {
        if (!container || !rendererInstance || !glContext) return;
        const dpr = window.devicePixelRatio || 1;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width === 0 || height === 0) return;

        rendererInstance.setSize(width * dpr, height * dpr);
        glContext.canvas.style.width = width + "px";
        glContext.canvas.style.height = height + "px";

        if (program) {
          program.uniforms.iResolution.value.set(
            glContext.canvas.width,
            glContext.canvas.height,
            glContext.canvas.width / glContext.canvas.height
          );
        }
      };
      window.addEventListener("resize", resize);
      resize();

      let lastTime = 0;
      let currentRot = 0;
      let voiceLevel = 0;
      const baseRotationSpeed = 0.3;
      let isMicrophoneInitialized = false;

      let lastDbg = 0;

      // Initialize or stop microphone based on voice control setting
      if (enableVoiceControl) {
        initMicrophone().then((success) => {
          isMicrophoneInitialized = success;
        });
      } else {
        // Stop microphone when voice control is disabled
        stopMicrophone();
        isMicrophoneInitialized = false;
      }

      const update = (t: number) => {
        rafId = requestAnimationFrame(update);
        if (!program) return;

        const dt = (t - lastTime) * 0.001;
        lastTime = t;
        program.uniforms.iTime.value = t * 0.001;
        program.uniforms.hue.value = hue;

        // Handle voice input
        if (enableVoiceControl && isMicrophoneInitialized) {
          const vad = analyzeVoice(t);
          // Only a real human voice moves the orb; noise-gated to ~0.
          voiceLevel = vad.speaking ? vad.level : 0;

          if (debugVoice && t - lastDbg > 250) {
            lastDbg = t;
            const f = vad as any;
            console.log(
              `[VAD] speak=${f.speaking ? 1 : 0}` +
                ` voiceness=${f.voiceness?.toFixed(2)}` +
                ` period=${f.periodicity?.toFixed(2)}` +
                ` flat=${f.flatness?.toFixed(2)}` +
                ` crest=${f.crest?.toFixed(1)}` +
                ` snr=${f.snrDb?.toFixed(1)}dB` +
                ` floor=${f.floorDb?.toFixed(0)}dB`,
            );
          }

          // Notify parent component about voice detection
          if (onVoiceDetected) {
            onVoiceDetected(vad.speaking);
          }

          // Map voice level to rotation speed with more visible effect
          const voiceRotationSpeed = baseRotationSpeed + (voiceLevel * maxRotationSpeed * 2.0);

          // Rotate while the user is actually speaking
          if (vad.speaking) {
            currentRot += dt * voiceRotationSpeed;
          }

          // Use voice level to drive hover effects for visual feedback
          program.uniforms.hover.value = Math.min(voiceLevel * 2.0, 1.0);
          program.uniforms.hoverIntensity.value = Math.min(voiceLevel * maxHoverIntensity * 0.8, maxHoverIntensity);
        } else {
          // Keep effects at 0 when not using voice control
          program.uniforms.hover.value = 0;
          program.uniforms.hoverIntensity.value = 0;
          if (onVoiceDetected) {
            onVoiceDetected(false);
          }
        }

        program.uniforms.rot.value = currentRot;

        if (rendererInstance && glContext) {
          // Clear the canvas with transparent background before rendering
          glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);
          rendererInstance.render({ scene: mesh });
        }
      };

      rafId = requestAnimationFrame(update);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);

        // Clean up canvas safely
        if (container && glContext && glContext.canvas) {
          try {
            if (container.contains(glContext.canvas)) {
              container.removeChild(glContext.canvas);
            }
          } catch (error) {
            console.warn("Canvas cleanup error:", error);
          }
        }

        // Stop microphone and clean up audio resources
        stopMicrophone();

        if (glContext) {
          glContext.getExtension("WEBGL_lose_context")?.loseContext();
        }
      };

    } catch (error) {
      console.error("Error initializing Voice Powered Orb:", error);
      if (container && container.firstChild) {
        container.removeChild(container.firstChild);
      }
      return () => {
        window.removeEventListener("resize", () => {});
      };
    }
  }, [
    hue,
    enableVoiceControl,
    voiceSensitivity,
    maxRotationSpeed,
    maxHoverIntensity,
    echoCancellation,
    noiseSuppression,
    noiseGateDb,
    speechBand[0],
    speechBand[1],
    voiceStrictness,
    transientCrestMax,
    debugVoice,
    vert,
    frag
  ]);

  // Handle microphone state changes separately
  useEffect(() => {
    let isMounted = true;

    const handleMicrophoneState = async () => {
      if (enableVoiceControl) {
        const success = await initMicrophone();
        if (!isMounted) return;
        // Update the microphone state in the WebGL context if needed
      } else {
        stopMicrophone();
      }
    };

    handleMicrophoneState();

    return () => {
      isMounted = false;
      // Don't stop microphone here as it will be handled by the main cleanup
    };
  }, [enableVoiceControl]);

  return (
    <div
      ref={ctnDom}
      className={cn(
        "w-full h-full relative",
        className
      )}
    >

    </div>
  );
};
