/*  Tiny Tetris (no libs, single JS file)
    Runs in any browser. Just include this file in an HTML page.
    If you truly want “only JS”, paste into the browser console or load via <script src="tetris.js"></script>.

    Controls:
    - Left/Right: ArrowLeft / ArrowRight  (also A / D)
    - Soft drop: ArrowDown (also S)
    - Rotate:    ArrowUp (also W) or X
    - Rotate CCW: Z
    - Hard drop: Space
    - Hold:      C
    - Pause:     P
    - Restart:   R
*/

(() => {
  // ---------- DOM / Canvas ----------
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  document.body.style.margin = "0";
  document.body.style.background = "#0b0b10";
  document.body.style.overflow = "hidden";
  document.body.appendChild(canvas);

  // ---------- Game constants ----------
  const COLS = 10;
  const ROWS = 20;
  const HIDDEN = 2; // hidden spawn rows above the visible playfield
  const W = COLS;
  const H = ROWS + HIDDEN;

  const PIECES = {
    I: [
      [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0],
        [0,0,1,0],
      ],
    ],
    O: [
      [
        [0,1,1,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
    ],
    T: [
      [
        [0,1,0,0],
        [1,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [0,1,1,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
      [
        [0,0,0,0],
        [1,1,1,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [1,1,0,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
    ],
    S: [
      [
        [0,1,1,0],
        [1,1,0,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [0,1,1,0],
        [0,0,1,0],
        [0,0,0,0],
      ],
    ],
    Z: [
      [
        [1,1,0,0],
        [0,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,0,1,0],
        [0,1,1,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
    ],
    J: [
      [
        [1,0,0,0],
        [1,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,1,0],
        [0,1,0,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
      [
        [0,0,0,0],
        [1,1,1,0],
        [0,0,1,0],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [0,1,0,0],
        [1,1,0,0],
        [0,0,0,0],
      ],
    ],
    L: [
      [
        [0,0,1,0],
        [1,1,1,0],
        [0,0,0,0],
        [0,0,0,0],
      ],
      [
        [0,1,0,0],
        [0,1,0,0],
        [0,1,1,0],
        [0,0,0,0],
      ],
      [
        [0,0,0,0],
        [1,1,1,0],
        [1,0,0,0],
        [0,0,0,0],
      ],
      [
        [1,1,0,0],
        [0,1,0,0],
        [0,1,0,0],
        [0,0,0,0],
      ],
    ],
  };

  const ORDER = ["I", "O", "T", "S", "Z", "J", "L"];
  const COLORS = {
    I: "#4dd7ff",
    O: "#ffd84d",
    T: "#b86bff",
    S: "#62f06b",
    Z: "#ff5a5a",
    J: "#4d74ff",
    L: "#ff9a4d",
    GHOST: "rgba(255,255,255,0.12)",
    GRID: "rgba(255,255,255,0.08)",
    TEXT: "rgba(255,255,255,0.92)",
    DIM: "rgba(255,255,255,0.65)",
  };

  // ---------- State ----------
  let board, bag, nextQueue, holdPiece, canHold;
  let cur, score, lines, level;
  let paused = false;
  let gameOver = false;

  let dropTimer = 0;
  let dropIntervalMs = 800;

  // Input (simple DAS/ARR)
  const keys = new Set();
  let leftHeld = false, rightHeld = false;
  let dasMs = 150, arrMs = 45;
  let leftDas = 0, rightDas = 0, leftArr = 0, rightArr = 0;

  // ---------- Helpers ----------
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeBoard() {
    const b = [];
    for (let y = 0; y < H; y++) {
      const row = new Array(W).fill("");
      b.push(row);
    }
    return b;
  }

  function refillBag() {
    bag = ORDER.slice();
    // Fisher–Yates
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function takeFromBag() {
    if (!bag || bag.length === 0) refillBag();
    return bag.pop();
  }

  function ensureQueue(n = 5) {
    while (nextQueue.length < n) nextQueue.push(takeFromBag());
  }

  function pieceSpawn(type) {
    return {
      type,
      r: 0,
      x: 3,
      y: 0, // includes hidden rows
    };
  }

  function shapeOf(p) {
    const rots = PIECES[p.type];
    return rots[p.r % rots.length];
  }

  function collide(p, dx = 0, dy = 0, r = p.r) {
    const rots = PIECES[p.type];
    const shape = rots[r % rots.length];
    const px = p.x + dx;
    const py = p.y + dy;

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!shape[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= W || by >= H) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function lockPiece(p) {
    const shape = shapeOf(p);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!shape[y][x]) continue;
        const bx = p.x + x;
        const by = p.y + y;
        if (by >= 0 && by < H && bx >= 0 && bx < W) board[by][bx] = p.type;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = 0; y < H; y++) {
      let full = true;
      for (let x = 0; x < W; x++) {
        if (!board[y][x]) { full = false; break; }
      }
      if (full) {
        board.splice(y, 1);
        board.unshift(new Array(W).fill(""));
        cleared++;
      }
    }
    if (cleared > 0) {
      lines += cleared;
      // scoring (classic-ish)
      const add = [0, 100, 300, 500, 800][cleared] || 0;
      score += add * level;
      // level up every 10 lines
      level = 1 + Math.floor(lines / 10);
      dropIntervalMs = clamp(800 - (level - 1) * 60, 120, 800);
    }
  }

  function spawnNext() {
    ensureQueue(6);
    const type = nextQueue.shift();
    ensureQueue(6);
    cur = pieceSpawn(type);
    canHold = true;
    if (collide(cur, 0, 0)) {
      gameOver = true;
    }
  }

  function hardDrop() {
    if (gameOver || paused) return;
    let dist = 0;
    while (!collide(cur, 0, 1)) { cur.y++; dist++; }
    score += dist * 2;
    stepLock();
  }

  function softDrop() {
    if (gameOver || paused) return;
    if (!collide(cur, 0, 1)) {
      cur.y++;
      score += 1;
    } else {
      stepLock();
    }
  }

  function stepLock() {
    lockPiece(cur);
    clearLines();
    spawnNext();
  }

  function tryMove(dx, dy) {
    if (gameOver || paused) return false;
    if (!collide(cur, dx, dy)) {
      cur.x += dx;
      cur.y += dy;
      return true;
    }
    return false;
  }

  function rotate(dir) {
    if (gameOver || paused) return;
    const rots = PIECES[cur.type].length;
    const nr = (cur.r + dir + rots) % rots;

    // simple wall-kicks
    const kicks = [
      [0,0], [-1,0], [1,0], [-2,0], [2,0], [0,-1],
    ];
    for (const [kx, ky] of kicks) {
      if (!collide(cur, kx, ky, nr)) {
        cur.r = nr;
        cur.x += kx;
        cur.y += ky;
        return;
      }
    }
  }

  function hold() {
    if (gameOver || paused) return;
    if (!canHold) return;
    canHold = false;

    const t = cur.type;
    if (!holdPiece) {
      holdPiece = t;
      spawnNext();
    } else {
      const swap = holdPiece;
      holdPiece = t;
      cur = pieceSpawn(swap);
      if (collide(cur, 0, 0)) gameOver = true;
    }
  }

  function ghostY() {
    let gy = cur.y;
    while (!collide(cur, 0, gy - cur.y + 1)) gy++;
    return gy;
  }

  // ---------- Rendering ----------
  let cell = 24;
  let view = { x: 0, y: 0, w: 0, h: 0 };
  let ui = { x: 0, y: 0, w: 0, h: 0 };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Layout: playfield + right side UI (if space)
    const maxCellW = Math.floor((w * 0.62) / W);
    const maxCellH = Math.floor((h * 0.95) / ROWS);
    cell = clamp(Math.min(maxCellW, maxCellH), 12, 40);

    const fieldW = W * cell;
    const fieldH = ROWS * cell;

    view.w = fieldW;
    view.h = fieldH;
    view.x = Math.floor((w - fieldW) / 2) - Math.floor(cell * 2);
    view.y = Math.floor((h - fieldH) / 2);

    // If too far left, center
    if (view.x < 8) view.x = Math.floor((w - fieldW) / 2);

    ui.x = view.x + view.w + Math.floor(cell * 0.8);
    ui.y = view.y;
    ui.w = w - ui.x - 10;
    ui.h = fieldH;
  }

  function drawCell(x, y, color, alpha = 1) {
    const px = view.x + x * cell;
    const py = view.y + y * cell;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      const px = view.x + x * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, view.y);
      ctx.lineTo(px, view.y + view.h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      const py = view.y + y * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(view.x, py);
      ctx.lineTo(view.x + view.w, py);
      ctx.stroke();
    }
  }

  function drawBoard() {
    for (let y = HIDDEN; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = board[y][x];
        if (t) drawCell(x, y - HIDDEN, COLORS[t]);
      }
    }
  }

  function drawPiece(p, colorOverride = null, alpha = 1, yOverride = null) {
    const shape = shapeOf(p);
    const py0 = yOverride != null ? yOverride : p.y;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!shape[y][x]) continue;
        const bx = p.x + x;
        const by = py0 + y;
        if (by < HIDDEN) continue; // hidden
        if (bx < 0 || bx >= W) continue;
        if (by >= H) continue;
        drawCell(bx, by - HIDDEN, colorOverride || COLORS[p.type], alpha);
      }
    }
  }

  function drawMini(type, x, y, size) {
    const shape = PIECES[type][0];
    const s = size;
    for (let yy = 0; yy < 4; yy++) {
      for (let xx = 0; xx < 4; xx++) {
        if (!shape[yy][xx]) continue;
        ctx.fillStyle = COLORS[type];
        ctx.fillRect(x + xx * s, y + yy * s, s - 1, s - 1);
      }
    }
  }

  function text(x, y, str, size = 14, color = COLORS.TEXT, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(str, x, y);
  }

  function render() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, w, h);

    // playfield bg
    ctx.fillStyle = "#11111a";
    ctx.fillRect(view.x - 2, view.y - 2, view.w + 4, view.h + 4);

    drawGrid();
    drawBoard();

    // ghost
    if (!gameOver) {
      const gy = ghostY();
      drawPiece(cur, COLORS.GHOST, 1, gy);
      drawPiece(cur);
    }

    // UI panel (if space)
    const hasUI = ui.w > cell * 5;
    if (hasUI) {
      const bx = ui.x;
      const by = ui.y;

      text(bx, by, "TETRIS", 18);
      text(bx, by + 26, `Score: ${score}`, 14, COLORS.DIM);
      text(bx, by + 44, `Lines: ${lines}`, 14, COLORS.DIM);
      text(bx, by + 62, `Level: ${level}`, 14, COLORS.DIM);

      text(bx, by + 92, "Next", 14);
      const mini = Math.max(6, Math.floor(cell * 0.45));
      for (let i = 0; i < Math.min(5, nextQueue.length); i++) {
        drawMini(nextQueue[i], bx, by + 112 + i * (mini * 4 + 10), mini);
      }

      text(bx + mini * 5, by + 92, "Hold", 14);
      if (holdPiece) drawMini(holdPiece, bx + mini * 5, by + 112, mini);

      text(bx, by + ui.h - 110, "Controls", 14);
      text(bx, by + ui.h - 88, "←/→ move  ↓ drop", 12, COLORS.DIM);
      text(bx, by + ui.h - 72, "↑/W/X rotate  Z CCW", 12, COLORS.DIM);
      text(bx, by + ui.h - 56, "Space hard drop", 12, COLORS.DIM);
      text(bx, by + ui.h - 40, "C hold  P pause  R restart", 12, COLORS.DIM);
    } else {
      // minimal HUD
      text(view.x, view.y - 22, `Score ${score}  Lines ${lines}  Lv ${level}`, 14, COLORS.TEXT);
    }

    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(view.x, view.y, view.w, view.h);
      text(view.x + view.w / 2, view.y + view.h / 2 - 10, "PAUSED", 22, COLORS.TEXT, "center");
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(view.x, view.y, view.w, view.h);
      text(view.x + view.w / 2, view.y + view.h / 2 - 22, "GAME OVER", 22, COLORS.TEXT, "center");
      text(view.x + view.w / 2, view.y + view.h / 2 + 8, "Press R to restart", 14, COLORS.DIM, "center");
    }
  }

  // ---------- Input ----------
  function setKey(k, down) {
    if (down) keys.add(k); else keys.delete(k);
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    // Prevent page scroll on arrows/space
    if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(k)) e.preventDefault();

    // One-shot actions
    if (k === "p" || k === "P") { paused = !paused; return; }
    if (k === "r" || k === "R") { reset(); return; }
    if (paused || gameOver) { setKey(k, true); return; }

    if (k === "ArrowUp" || k === "w" || k === "W" || k === "x" || k === "X") rotate(+1);
    else if (k === "z" || k === "Z") rotate(-1);
    else if (k === " " ) hardDrop();
    else if (k === "c" || k === "C") hold();

    setKey(k, true);
  });

  window.addEventListener("keyup", (e) => setKey(e.key, false));
  window.addEventListener("resize", resize);

  // ---------- Game loop ----------
  let last = now();

  function handleHorizontal(dt) {
    const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
    const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");

    // If both held, ignore
    if (left && right) {
      leftHeld = rightHeld = false;
      leftDas = rightDas = leftArr = rightArr = 0;
      return;
    }

    if (left) {
      if (!leftHeld) {
        leftHeld = true;
        leftDas = 0; leftArr = 0;
        tryMove(-1, 0);
      } else {
        leftDas += dt;
        if (leftDas >= dasMs) {
          leftArr += dt;
          while (leftArr >= arrMs) {
            if (!tryMove(-1, 0)) break;
            leftArr -= arrMs;
          }
        }
      }
    } else {
      leftHeld = false;
      leftDas = leftArr = 0;
    }

    if (right) {
      if (!rightHeld) {
        rightHeld = true;
        rightDas = 0; rightArr = 0;
        tryMove(+1, 0);
      } else {
        rightDas += dt;
        if (rightDas >= dasMs) {
          rightArr += dt;
          while (rightArr >= arrMs) {
            if (!tryMove(+1, 0)) break;
            rightArr -= arrMs;
          }
        }
      }
    } else {
      rightHeld = false;
      rightDas = rightArr = 0;
    }
  }

  function loop() {
    const t = now();
    const dt = Math.min(33, t - last); // cap delta
    last = t;

    if (!paused && !gameOver) {
      handleHorizontal(dt);

      const down = keys.has("ArrowDown") || keys.has("s") || keys.has("S");
      const interval = down ? Math.max(35, dropIntervalMs * 0.08) : dropIntervalMs;

      dropTimer += dt;
      while (dropTimer >= interval) {
        dropTimer -= interval;
        if (!tryMove(0, 1)) {
          stepLock();
          dropTimer = 0;
          break;
        } else if (down) {
          score += 1; // soft drop scoring for continuous hold
        }
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  // ---------- Reset / Start ----------
  function reset() {
    board = makeBoard();
    nextQueue = [];
    holdPiece = "";
    canHold = true;

    score = 0;
    lines = 0;
    level = 1;
    dropIntervalMs = 800;

    paused = false;
    gameOver = false;

    refillBag();
    ensureQueue(6);
    spawnNext();

    dropTimer = 0;

    // reset input timers
    keys.clear();
    leftHeld = rightHeld = false;
    leftDas = rightDas = leftArr = rightArr = 0;
  }

  resize();
  reset();
  loop();
})();
