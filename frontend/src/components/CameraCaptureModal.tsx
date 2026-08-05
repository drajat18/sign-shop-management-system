import { useEffect, useRef, useState } from "react";

// Works on any device with a camera (desktop webcam, phone/tablet camera) —
// unlike an <input capture>, which only opens a native camera app on mobile
// and is a no-op file-picker everywhere else.
export default function CameraCaptureModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setError("Couldn't access the camera — check your browser's camera permission and try again.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    const ctx = video && document.createElement("canvas").getContext("2d");
    if (!video || !ctx) return;

    const canvas = ctx.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhotoBlob(blob);
        setPhotoUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92
    );
  }

  function handleRetake() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoBlob(null);
  }

  function handleUsePhoto() {
    if (!photoBlob) return;
    onCapture(new File([photoBlob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Stops here so this camera overlay closing doesn't also bubble up
        // and close whichever order/new-item modal it's nested inside.
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Take photo</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error ? (
          <p className="form-error">{error}</p>
        ) : photoUrl ? (
          <img src={photoUrl} alt="Captured" style={{ width: "100%", borderRadius: 8 }} />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", borderRadius: 8, background: "#000" }}
          />
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          {photoUrl ? (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleRetake}>
                Retake
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleUsePhoto}>
                Use photo
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCapture} disabled={!!error}>
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
