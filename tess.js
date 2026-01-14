/*  ES5 Cube <-> Tesseract
    - Only var
    - No arrow functions
    - No const / let
    - No external libs
*/

(function () {

  /* ---------- Canvas ---------- */
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  document.body.style.margin = "0";
  document.body.style.background = "#000";
  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- Mode ---------- */
  var mode = "tesseract"; // "cube" or "tesseract"

  window.addEventListener("keydown", function (e) {
    if (e.keyCode === 49) mode = "cube";       // 1
    if (e.keyCode === 50) mode = "tesseract";  // 2
  });

  /* ---------- Math ---------- */
  function rot3(v, ax, ay, az) {
    var x = v.x, y = v.y, z = v.z;
    var c, s;

    c = Math.cos(ax); s = Math.sin(ax);
    y = y * c - z * s;
    z = y * s + z * c;

    c = Math.cos(ay); s = Math.sin(ay);
    x = x * c + z * s;
    z = -x * s + z * c;

    c = Math.cos(az); s = Math.sin(az);
    x = x * c - y * s;
    y = x * s + y * c;

    return { x: x, y: y, z: z };
  }

  function rot4(v, i, j, a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    var arr = [v.x, v.y, v.z, v.w];
    var vi = arr[i];
    var vj = arr[j];
    arr[i] = vi * c - vj * s;
    arr[j] = vi * s + vj * c;
    return { x: arr[0], y: arr[1], z: arr[2], w: arr[3] };
  }

  function proj4to3(v) {
    var d = 3;
    var k = d / (d - v.w);
    return { x: v.x * k, y: v.y * k, z: v.z * k };
  }

  function proj3to2(v, scale) {
    var d = 5;
    var k = d / (d - v.z);
    return { x: v.x * k * scale, y: v.y * k * scale };
  }

  /* ---------- Geometry ---------- */
  function cubeVertices() {
    var v = [];
    var s = 1;
    var xs = [-s, s];
    var ys = [-s, s];
    var zs = [-s, s];
    var i, j, k;

    for (i = 0; i < 2; i++)
      for (j = 0; j < 2; j++)
        for (k = 0; k < 2; k++)
          v.push({ x: xs[i], y: ys[j], z: zs[k] });

    return v;
  }

  function tesseractVertices() {
    var v = [];
    var s = 1;
    var xs = [-s, s];
    var ys = [-s, s];
    var zs = [-s, s];
    var ws = [-s, s];
    var i, j, k, l;

    for (i = 0; i < 2; i++)
      for (j = 0; j < 2; j++)
        for (k = 0; k < 2; k++)
          for (l = 0; l < 2; l++)
            v.push({ x: xs[i], y: ys[j], z: zs[k], w: ws[l] });

    return v;
  }

  function buildEdges(vertices, dims) {
    var edges = [];
    var i, j, d, diff, a, b;

    for (i = 0; i < vertices.length; i++) {
      for (j = i + 1; j < vertices.length; j++) {
        diff = 0;
        for (d = 0; d < dims; d++) {
          a = d === 0 ? vertices[i].x :
              d === 1 ? vertices[i].y :
              d === 2 ? vertices[i].z : vertices[i].w;
          b = d === 0 ? vertices[j].x :
              d === 1 ? vertices[j].y :
              d === 2 ? vertices[j].z : vertices[j].w;
          if (a !== b) diff++;
        }
        if (diff === 1) edges.push([i, j]);
      }
    }
    return edges;
  }

  var cubeV = cubeVertices();
  var cubeE = buildEdges(cubeV, 3);

  var tessV = tesseractVertices();
  var tessE = buildEdges(tessV, 4);

  /* ---------- Draw ---------- */
  function draw(points, edges, cx, cy) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    var i, e, p, q;
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      p = points[e[0]];
      q = points[e[1]];
      ctx.moveTo(cx + p.x, cy + p.y);
      ctx.lineTo(cx + q.x, cy + q.y);
    }
    ctx.stroke();
  }

  /* ---------- Loop ---------- */
  var t = 0;

  function loop() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var scale = Math.min(canvas.width, canvas.height) * 0.2;

    var i, v, p;

    if (mode === "cube") {
      var pts3 = [];
      var pts2 = [];

      for (i = 0; i < cubeV.length; i++) {
        v = rot3(cubeV[i], t, t * 0.7, t * 0.4);
        pts3.push(v);
        p = proj3to2(v, scale);
        pts2.push(p);
      }
      draw(pts2, cubeE, cx, cy);

    } else {
      var pts4 = [];
      var pts3b = [];
      var pts2b = [];

      for (i = 0; i < tessV.length; i++) {
        v = tessV[i];
        v = rot4(v, 0, 3, t);
        v = rot4(v, 1, 3, t * 0.7);
        v = rot4(v, 0, 2, t * 0.5);
        pts4.push(v);
      }

      for (i = 0; i < pts4.length; i++) {
        v = proj4to3(pts4[i]);
        v = rot3(v, t * 0.3, t * 0.2, t * 0.1);
        pts3b.push(v);
        p = proj3to2(v, scale);
        pts2b.push(p);
      }
      draw(pts2b, tessE, cx, cy);
    }

    t += 0.01;
    requestAnimationFrame(loop);
  }

  loop();

})();
