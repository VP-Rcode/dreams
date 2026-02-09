"use client";

import { useMemo, useRef, useState } from "react";

type Result = {
  style: string;
  prompts: string[];
  imagesB64: string[]; // 4 base64 PNGs
};

function b64ToImgSrc(b64: string) {
  return `data:image/png;base64,${b64}`;
}

export default function Page() {
  const [dream, setDream] = useState("");
  const [aesthetic, setAesthetic] = useState("dreamy collage, cinematic, soft glow");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canGo = useMemo(() => dream.trim().length >= 20 && !loading, [dream, loading]);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dream, aesthetic })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Request failed.");
        setLoading(false);
        return;
      }

      setResult(data);
      // Draw collage after setting result
      setTimeout(() => drawCollage(data), 50);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function drawCollage(data: Result) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 2x2 collage, each cell 512 -> total 1024
    const W = 1024;
    const H = 1024;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    // Load images
    const imgs = await Promise.all(
      data.imagesB64.map((b64) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = b64ToImgSrc(b64);
        });
      })
    );

    // Draw cells with a subtle border/gap
    const gap = 10;
    const cell = (W - gap * 3) / 2; // 2 cells + 3 gaps
    const positions = [
      { x: gap, y: gap },
      { x: gap * 2 + cell, y: gap },
      { x: gap, y: gap * 2 + cell },
      { x: gap * 2 + cell, y: gap * 2 + cell }
    ];

    // Background
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.fillRect(0, 0, W, H);

    imgs.forEach((img, i) => {
      const { x, y } = positions[i];
      // cover-fit into cell
      const sx = 0;
      const sy = 0;
      const sW = img.width;
      const sH = img.height;

      // compute cover crop
      const scale = Math.max(cell / sW, cell / sH);
      const cW = cell / scale;
      const cH = cell / scale;
      const cx = (sW - cW) / 2;
      const cy = (sH - cH) / 2;

      // Rounded corners
      roundRect(ctx, x, y, cell, cell, 18);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, cx, cy, cW, cH, x, y, cell, cell);
      ctx.restore();

      // Soft frame
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cell, cell, 18);
      ctx.stroke();
    });

    // Title label
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Dream Collage", 24, 40);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const a = document.createElement("a");
    a.download = "dream-collage.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <main style={{ maxWidth: 1100, margin: "28px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 34 }}>Dream Decoder — Visualizer</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Type a dream. The app turns it into a 4-panel AI image collage. (Interpretive + for fun/creativity.)
      </p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr", marginTop: 14 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 16, padding: 14 }}>
          <label style={{ fontWeight: 700 }}>Your dream</label>
          <textarea
            value={dream}
            onChange={(e) => setDream(e.target.value)}
            rows={7}
            placeholder="Example: I was in a library where the books were alive, whispering my name..."
            style={{
              width: "100%",
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 15,
              lineHeight: 1.4
            }}
          />

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <label style={{ fontWeight: 700 }}>Visual style (optional)</label>
            <input
              value={aesthetic}
              onChange={(e) => setAesthetic(e.target.value)}
              placeholder="dreamy collage, cinematic, watercolor, surreal..."
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                fontSize: 14
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <button
              disabled={!canGo}
              onClick={generate}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                cursor: canGo ? "pointer" : "not-allowed",
                fontWeight: 700
              }}
            >
              {loading ? "Generating…" : "Generate collage"}
            </button>

            {result && (
              <button
                onClick={download}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                Download PNG
              </button>
            )}

            <span style={{ opacity: 0.7, fontSize: 13 }}>
              Tip: include emotions + key objects/places for better images.
            </span>
          </div>

          {error && <div style={{ marginTop: 10, color: "crimson", fontWeight: 700 }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr", alignItems: "start" }}>
            <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Generated collage</h2>
                <span style={{ opacity: 0.7, fontSize: 12 }}>2×2, 1024×1024</span>
              </div>

              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  maxWidth: 700,
                  marginTop: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)"
                }}
              />
            </div>

            <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 16, padding: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Scene prompts (what the AI “drew”)</h2>
              <ol style={{ marginTop: 10, paddingLeft: 18 }}>
                {result.prompts.map((p, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    {p}
                  </li>
                ))}
              </ol>
              <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
                Style: {result.style}
              </p>
            </div>
          </div>
        )}
      </div>

      <footer style={{ marginTop: 18, opacity: 0.65, fontSize: 13 }}>
        This is a creative visualization tool, not medical or psychological advice.
      </footer>
    </main>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
