/*  Tesseract <-> Cube (no libs, single JS file)
    - Press "1" => rotating 3D cube
    - Press "2" => rotating 4D tesseract (projected to 3D then to 2D)
    Works in a browser. Put into a .js file and include via <script>.

    Tip: If you want it truly standalone, paste into console on a blank page.
*/

(() => {
  // ---------- Canvas ----------
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.style.margin = "0";
  document.body.style.background = "#0b0b10";
  document.body.appendChild(canvas);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Mode handling ----------
  let mode = "tesseract"; // "cube" or "tesseract"
  window.addEventListener("keydown", (e) => {
    if (e.key === "1") mode = "cube";
    if (e.key === "2") mode = "tesseract";
  });

  // ---------- Math helpers ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 3D rotation matrices applied directly
  function rot3(v, ax, ay, az) {
    let { x, y, z } = v;

    // X
    {
      const c = Math.cos(ax), s = Math.sin(ax);
      const y2 = y * c - z * s;
      const z2 = y * s + z * c;
      y = y2; z = z2;
    }
    // Y
    {
      const c = Math.cos(ay), s = Math.sin(ay);
      const x2 = x * c + z * s;
      const z2 = -x * s + z * c;
      x = x2; z = z2;
    }
    // Z
    {
      const c = Math.cos(az), s = Math.sin(az);
      const x2 = x * c - y * s;
      const y2 = x * s + y * c;
      x = x2; y = y2;
    }
    return { x, y, z };
  }

  // 4D rotation in a plane (i,j) by angle
  function rot4(v, i, j, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const arr = [v.x, v.y, v.z, v.w];
    const vi = arr[i], vj = arr[j];
    arr[i] = vi * c - vj * s;
    arr[j] = vi * s + vj * c;
    return { x: arr[0], y: arr[1], z: arr[2], w: arr[3] };
  }

  // 4D -> 3D perspective projection
  function proj4to3(v, wDist = 3.0) {
    // Factor similar to 3D perspective but with w
    const denom = (wDist - v.w);
    const k = denom !== 0 ? (wDist / denom) : 999;
    return { x: v.x * k, y: v.y * k, z: v.z * k };
  }

  // 3D -> 2D perspective projection
  function proj3to2(v, zDist = 5.0, scale = 1.0) {
    const denom = (zDist - v.z);
    const k = denom !== 0 ? (zDist / denom) : 999;
    return { x: v.x * k * scale, y: v.y * k * scale };
  }

  // ---------- Geometry ----------
  function cubeVertices(size = 1) {
    const s = size;
    const vs = [];
    for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) {
      vs.push({ x, y, z });
    }
    return vs;
  }

  function tesseractVertices(size = 1) {
    const s = size;
    const vs = [];
    for (const x of [-s, s])
      for (const y of [-s, s])
        for (const z of [-s, s])
          for (const w of [-s, s]) {
            vs.push({ x, y, z, w });
          }
    return vs;
  }

  // Edges: connect vertices that differ in exactly one coordinate sign
  function edgesFromVerticesN(vertices, dims) {
    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        let diff = 0;
        for (let d = 0; d < dims; d++) {
          const a = d === 0 ? vertices[i].x : d === 1 ? vertices[i].y : d === 2 ? vertices[i].z : vertices[i].w;
          const b = d === 0 ? vertices[j].x : d === 1 ? vertices[j].y : d === 2 ? vertices[j].z : vertices[j].w;
          if (a !== b) diff++;
          if (diff > 1) break;
        }
        if (diff === 1) edges.push([i, j]);
      }
    }
    return edges;
  }

  const cubeV = cubeVertices(1);
  const cubeE = edgesFromVerticesN(cubeV, 3);

  const tessV = tesseractVertices(1);
  const tessE = edgesFromVerticesN(tessV, 4);

  // ---------- Rendering ----------
  function clear(w, h) {
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, w, h);
  }

  function text(x, y, str, size = 14, align = "left") {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(str, x, y);
  }

  function drawWire(points2, edges, cx, cy, lineAlpha = 0.85) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`;

    ctx.beginPath();
    for (const [a, b] of edges) {
      const p = points2[a], q = points2[b];
      ctx.moveTo(cx + p.x, cy + p.y);
      ctx.lineTo(cx + q.x, cy + q.y);
    }
    ctx.stroke();

    // tiny nodes
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const p of points2) {
      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, 2.5, 0, TAU);
      ctx.fill();
    }
  }

  // Sort edges by average depth (simple painter's trick)
  function sortEdgesByDepth(points3, edges) {
    return edges
      .map((e) => {
        const a = points3[e[0]], b = points3[e[1]];
        const dz = (a.z + b.z) * 0.5;
        return { e, dz };
      })
      .sort((u, v) => u.dz - v.dz)
      .map((x) => x.e);
  }

  // ---------- Animation loop ----------
  let last = performance.now();
  let t = 0;

  function frame(now) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    clear(w, h);

    const cx = w / 2;
    const cy = h / 2;

    // shared “camera”
    const scale = Math.min(w, h) * 0.18;

    if (mode === "cube") {
      const ax = t * 0.9;
      const ay = t * 0.7;
      const az = t * 0.5;

      const pts3 = cubeV.map((v) => rot3(v, ax, ay, az));
      // perspective
      const pts2 = pts3.map((v) => {
        const p = proj3to2(v, 4.5, scale);
        return { x: p.x, y: p.y };
      });

      const edgesSorted = sortEdgesByDepth(pts3, cubeE);
      drawWire(pts2, edgesSorted, cx, cy, 0.9);

      text(14, 14, "Mode: Cube (press 2 for tesseract)", 14);
      text(14, 34, "Press 1 = cube, 2 = tesseract", 12);
    } else {
      // 4D rotations in multiple planes
      const a1 = t * 0.7;
      const a2 = t * 0.5;
      const a3 = t * 0.9;

      // 4D rotate then project to 3D, then rotate 3D a bit and project to 2D
      const pts4 = tessV.map((v0) => {
        let v = v0;
        v = rot4(v, 0, 3, a1); // x-w
        v = rot4(v, 1, 3, a2); // y-w
        v = rot4(v, 0, 2, a3); // x-z
        return v;
      });

      const pts3 = pts4.map((v) => proj4to3(v, 3.2));
      const pts3r = pts3.map((v) => rot3(v, t * 0.35, t * 0.25, t * 0.15));

      const pts2 = pts3r.map((v) => {
        const p = proj3to2(v, 5.3, scale);
        return { x: p.x, y: p.y };
      });

      // Depth-sort edges using projected 3D depth
      const edgesSorted = sortEdgesByDepth(pts3r, tessE);

      // Slight depth-based alpha: closer = brighter
      // We'll do one pass with thicker lines for a clean look
      drawWire(pts2, edgesSorted, cx, cy, 0.85);

      text(14, 14, "Mode: Tesseract (press 1 for cube)", 14);
      text(14, 34, "Press 1 = cube, 2 = tesseract", 12);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
