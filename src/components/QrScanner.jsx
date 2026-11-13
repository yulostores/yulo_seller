import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Keyboard, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Camera QR scanner (as the restaurant portal's QRScannerModal). Uses the browser's own
 * BarcodeDetector where it exists (Chrome on Android — fast, low battery) and jsQR on a canvas
 * everywhere else (iOS Safari). Hands the raw text to `onScan` once. With no camera, or no
 * permission, it says so and offers typing instead.
 */
export function QrScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState("starting"); // starting | scanning | unavailable
  const [message, setMessage] = useState("");
  // The latest callback, so the camera starts once — not again on every parent render.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;
    let detector = null;

    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const found = (text) => {
      if (stopped) return;
      stop();
      onScanRef.current(text);
    };

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes?.[0]?.rawValue) return found(codes[0].rawValue);
          } else {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d", { willReadFrequently: true });
            if (ctx && video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });
              if (code?.data) return found(code.data);
            }
          }
        } catch {
          /* a frame that couldn't be read — try the next one */
        }
      }
      timer = setTimeout(tick, 150);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        setMessage(
          "This device or browser can't use the camera here. Type the code instead.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if ("BarcodeDetector" in window) {
          try {
            detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          } catch {
            detector = null;
          }
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play?.();
        setState("scanning");
        tick();
      } catch (err) {
        setState("unavailable");
        setMessage(
          err?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser settings, or type the code instead."
            : err?.name === "NotFoundError"
              ? "No camera was found. Type the code instead."
              : "The camera couldn't be started. Type the code instead.",
        );
      }
    }

    start();
    return stop;
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan coupon QR"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-[#1a1a1a] sm:rounded-2xl">
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <span className="text-sm font-semibold">Scan the coupon QR</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="rounded-full p-2 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative aspect-square w-full bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          {state === "scanning" ? (
            <div
              className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-brand-orange/80"
              aria-hidden="true"
            />
          ) : null}
          {state === "starting" ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Starting the camera…
            </p>
          ) : null}
          {state === "unavailable" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p role="alert" className="text-sm text-white/85">
                {message}
              </p>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={onClose}
              >
                <Keyboard aria-hidden="true" /> Type the code
              </Button>
            </div>
          ) : null}
        </div>
        <p className="px-4 py-3 text-center text-xs text-white/50">
          Hold the customer&apos;s QR inside the frame
        </p>
      </div>
    </div>
  );
}
