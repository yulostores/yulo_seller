import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("jsqr", () => ({ default: vi.fn(() => null) }));

import jsQR from "jsqr";
import { QrScanner } from "./QrScanner";

const realMediaDevices = navigator.mediaDevices;
let stopTrack;

function fakeCamera() {
  stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  // jsdom has no media pipeline: pretend the video is playing with frames ready.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => 4,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => 64,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    get: () => 64,
  });
  return stream;
}

beforeEach(() => {
  delete window.BarcodeDetector;
});
afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: realMediaDevices,
  });
  delete HTMLMediaElement.prototype.readyState;
  delete HTMLVideoElement.prototype.videoWidth;
  delete HTMLVideoElement.prototype.videoHeight;
  delete window.BarcodeDetector;
  vi.restoreAllMocks();
});

describe("QrScanner", () => {
  it("no camera API at all: explains, and offers typing instead", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    const onClose = vi.fn();
    render(<QrScanner onScan={vi.fn()} onClose={onClose} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "can't use the camera",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Type the code" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("camera permission refused: says how to allow it, or type", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("denied"), { name: "NotAllowedError" }),
          ),
      },
    });
    render(<QrScanner onScan={vi.fn()} onClose={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Camera access was blocked",
    );
  });

  it("no camera on the device", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("none"), { name: "NotFoundError" }),
          ),
      },
    });
    render(<QrScanner onScan={vi.fn()} onClose={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "No camera was found",
    );
  });

  it("with the browser's BarcodeDetector: the decoded text is handed over once and the camera stopped", async () => {
    fakeCamera();
    const detect = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ rawValue: "KM4T7QXH2P" }]);
    window.BarcodeDetector = vi.fn(function BarcodeDetector() {
      return { detect };
    });
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} onClose={vi.fn()} />);
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("KM4T7QXH2P"), {
      timeout: 2000,
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(window.BarcodeDetector).toHaveBeenCalledWith({
      formats: ["qr_code"],
    });
    expect(stopTrack).toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
      audio: false,
    });
  });

  it("without BarcodeDetector: frames go through jsQR", async () => {
    fakeCamera();
    const ctx = {
      drawImage: vi.fn(),
      getImageData: () => ({
        data: new Uint8ClampedArray(64 * 64 * 4),
        width: 64,
        height: 64,
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
    jsQR.mockReturnValueOnce(null).mockReturnValue({ data: "ABCDE23456" });
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} onClose={vi.fn()} />);
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("ABCDE23456"), {
      timeout: 2000,
    });
    expect(jsQR).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("closing stops the camera", async () => {
    fakeCamera();
    window.BarcodeDetector = vi.fn(function BarcodeDetector() {
      return { detect: vi.fn().mockResolvedValue([]) };
    });
    const { unmount } = render(
      <QrScanner onScan={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    );
    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });
});
