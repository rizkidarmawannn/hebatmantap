const LOGICAL_W = 320;
const LOGICAL_H = 180;

// Hotspot hitboxes in logical 320x180 coordinates for clicking & spotlighting
export const TERRACE_OBJECTS = {
  sky: { x: 185, y: 12, w: 120, h: 52 },
  tree: { x: 222, y: 20, w: 72, h: 98 },
  bird: { x: 244, y: 40, w: 22, h: 18 },
  rain: { x: 185, y: 20, w: 128, h: 95 },
  chicken: { x: 238, y: 132, w: 26, h: 24 },
  yard_children: { x: 215, y: 108, w: 85, h: 58 },
  photo: { x: 96, y: 52, w: 24, h: 22 },
  lamp: { x: 175, y: 46, w: 18, h: 26 },
  stove: { x: 22, y: 112, w: 32, h: 24 },
  pot: { x: 24, y: 94, w: 28, h: 22 },
  mortar: { x: 60, y: 112, w: 28, h: 24 },
  basket: { x: 90, y: 114, w: 24, h: 22 },
  mat: { x: 118, y: 122, w: 86, h: 26 },
  sirih: { x: 126, y: 118, w: 18, h: 14 },
  book: { x: 178, y: 126, w: 20, h: 14 },
  nenek: { x: 144, y: 80, w: 34, h: 52 }
};

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpColor(hex1, hex2, t) {
  const c1 = parseInt(hex1.slice(1), 16);
  const c2 = parseInt(hex2.slice(1), 16);
  const r = Math.round(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t));
  const g = Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t));
  const b = Math.round(lerp(c1 & 255, c2 & 255, t));
  return `rgb(${r}, ${g}, ${b})`;
}

export class TerraceRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = LOGICAL_W;
    this.canvas.height = LOGICAL_H;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.state = {
      energy: 100,
      trustTier: "percaya",
      expression: "neutral",
      gesture: "idle",
      gestureUntil: 0,
      highlightTarget: null,
      highlightUntil: 0,
      weather: "clear",
      lampLit: false,
      endingMode: null, // null | 'win' | 'loss'
      coughFlashUntil: 0
    };

    this._raf = null;
    this._rainDrops = Array.from({ length: 34 }, () => ({
      x: 175 + Math.random() * 145,
      y: Math.random() * 165,
      speed: 1.8 + Math.random() * 1.4
    }));
    this._fireflies = Array.from({ length: 12 }, (_, i) => ({
      baseX: 200 + (i * 19) % 110,
      baseY: 45 + (i * 23) % 95,
      phase: i * 1.3
    }));
  }

  start() {
    if (this._raf) return;
    const loop = (ts) => {
      this.render(ts);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  updateState(partial) {
    Object.assign(this.state, partial);
  }

  triggerClue(target, gesture, durationMs, gestureLoops = 2) {
    const now = performance.now();
    this.state.highlightTarget = durationMs > 0 ? target : null;
    this.state.highlightUntil = durationMs > 0 ? now + durationMs : 0;
    if (gesture && gestureLoops > 0) {
      this.state.gesture = gesture;
      this.state.gestureUntil = now + Math.max(1400, gestureLoops * 1200);
    } else {
      this.state.gesture = "idle";
      this.state.gestureUntil = 0;
    }
  }

  triggerCough() {
    this.state.coughFlashUntil = performance.now() + 900;
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const lx = ((clientX - rect.left) / rect.width) * LOGICAL_W;
    const ly = ((clientY - rect.top) / rect.height) * LOGICAL_H;

    // Prioritize smaller foreground objects over large sky/yard regions
    const priorityOrder = [
      "sirih", "book", "lamp", "photo", "pot", "stove", "mortar",
      "basket", "bird", "chicken", "mat", "nenek", "tree", "sky"
    ];
    for (const key of priorityOrder) {
      const box = TERRACE_OBJECTS[key];
      if (!box) continue;
      if (lx >= box.x && lx <= box.x + box.w && ly >= box.y && ly <= box.y + box.h) {
        return key;
      }
    }
    return null;
  }

  render(ts) {
    const ctx = this.ctx;
    const { energy, weather, lampLit, endingMode } = this.state;

    // Sky progression from warm orange sunset (energy=100) to deep violet night (energy=0)
    // Or warm golden dawn if endingMode === 'win'
    let topSky, midSky, botSky;
    if (endingMode === "win") {
      topSky = "#5b86b8";
      midSky = "#e89f6b";
      botSky = "#ffd58a";
    } else {
      const duskProgress = 1 - Math.max(0, Math.min(100, energy)) / 100;
      if (duskProgress < 0.5) {
        const t = duskProgress * 2;
        topSky = lerpColor("#4b3b6b", "#2d2148", t);
        midSky = lerpColor("#d96b43", "#8a3c5c", t);
        botSky = lerpColor("#f5a65b", "#c95b54", t);
      } else {
        const t = (duskProgress - 0.5) * 2;
        topSky = lerpColor("#2d2148", "#120c22", t);
        midSky = lerpColor("#8a3c5c", "#2a193d", t);
        botSky = lerpColor("#c95b54", "#472552", t);
      }
    }

    // 1. Sky bands (pixel-art stepped bands for authentic aesthetic)
    const bands = 14;
    const skyH = 128;
    const bandH = Math.ceil(skyH / bands);
    for (let i = 0; i < bands; i++) {
      const frac = i / (bands - 1);
      ctx.fillStyle = frac < 0.5 ? lerpColor(topSky, midSky, frac * 2) : lerpColor(midSky, botSky, (frac - 0.5) * 2);
      ctx.fillRect(0, i * bandH, LOGICAL_W, bandH);
    }

    // Sun / horizon glow
    if (endingMode === "win") {
      ctx.fillStyle = "#ffe596";
      ctx.fillRect(256, 72, 18, 18);
      ctx.fillStyle = "#fff4cc";
      ctx.fillRect(260, 76, 10, 10);
    } else if (energy > 18) {
      const sunY = Math.round(lerp(82, 114, 1 - energy / 100));
      ctx.fillStyle = energy > 45 ? "#ffcf70" : "#d46a4e";
      ctx.fillRect(254, sunY, 16, 16);
      ctx.fillStyle = "#ffe39f";
      ctx.fillRect(257, sunY + 3, 10, 10);
    }

    // Stars appear as energy drops
    if (endingMode !== "win" && energy < 65) {
      const starAlpha = Math.min(1, (65 - energy) / 45);
      const stars = [
        [195, 14], [218, 22], [242, 10], [278, 18], [302, 12],
        [208, 36], [262, 32], [295, 42], [182, 26]
      ];
      stars.forEach(([sx, sy], idx) => {
        const twinkle = 0.5 + 0.5 * Math.sin(ts * 0.004 + idx);
        ctx.fillStyle = `rgba(255, 245, 214, ${(starAlpha * twinkle).toFixed(2)})`;
        ctx.fillRect(sx, sy, 1, 1);
      });
    }

    // Distant village hills
    ctx.fillStyle = endingMode === "win" ? "#3b4f48" : "#241932";
    ctx.fillRect(160, 104, 160, 24);
    ctx.fillRect(190, 96, 70, 12);
    ctx.fillRect(275, 99, 45, 10);

    // Yard ground
    ctx.fillStyle = endingMode === "win" ? "#4b5a36" : "#2a2325";
    ctx.fillRect(0, 122, LOGICAL_W, 58);
    ctx.fillStyle = endingMode === "win" ? "#3b472a" : "#1f191c";
    ctx.fillRect(0, 152, LOGICAL_W, 28);

    // 2. Mango Tree on the right yard
    this._drawTree(ctx, ts, endingMode);

    // 3. Bird on tree branch
    this._drawBird(ctx, ts, weather);

    // 4. Chicken pecking in yard
    this._drawChicken(ctx, ts, endingMode);

    // 5. Rumah Panggung (Terrace Structure)
    this._drawTerraceHouse(ctx, ts, energy, lampLit, endingMode);

    // 6. Terrace Props (Pot, Stove, Mortar, Basket, Mat, Sirih, Photo, Lamp, Book)
    this._drawProps(ctx, ts, energy, lampLit);

    // 7. Nenek Wati Sprite
    this._drawNenek(ctx, ts);

    // 8. Village Children (Win Ending)
    if (endingMode === "win") {
      this._drawChildren(ctx, ts);
    }

    // 9. Rain or Fireflies
    if (weather === "rain") {
      this._drawRain(ctx);
    } else if (endingMode !== "win" && energy < 55) {
      this._drawFireflies(ctx, ts, energy);
    }

    // 10. Active Clue Spotlight (drawn cleanly on top)
    if (this.state.highlightTarget && ts < this.state.highlightUntil) {
      this._drawSpotlight(ctx, ts, this.state.highlightTarget);
    }
  }

  _drawTree(ctx, ts, endingMode) {
    // Trunk
    ctx.fillStyle = "#3f2820";
    ctx.fillRect(256, 72, 12, 56);
    ctx.fillRect(252, 120, 20, 8);
    ctx.fillStyle = "#52352a";
    ctx.fillRect(259, 75, 5, 48);

    // Branch extending left
    ctx.fillStyle = "#3f2820";
    ctx.fillRect(236, 58, 24, 5);
    ctx.fillRect(264, 62, 16, 5);

    // Leaf clusters (swaying slightly)
    const sway = Math.round(Math.sin(ts * 0.0018) * 1);
    const darkLeaf = endingMode === "win" ? "#2f5e3b" : "#1f332d";
    const midLeaf = endingMode === "win" ? "#457d4b" : "#2c4738";
    const hiLeaf = endingMode === "win" ? "#679c59" : "#3f5f46";

    ctx.fillStyle = darkLeaf;
    ctx.fillRect(226 + sway, 32, 68, 34);
    ctx.fillRect(238 + sway, 22, 44, 14);
    ctx.fillStyle = midLeaf;
    ctx.fillRect(232 + sway, 36, 54, 24);
    ctx.fillRect(244 + sway, 26, 32, 12);
    ctx.fillStyle = hiLeaf;
    ctx.fillRect(238 + sway, 30, 20, 10);
    ctx.fillRect(262 + sway, 38, 18, 10);
  }

  _drawBird(ctx, ts, weather) {
    const hop = Math.round(Math.sin(ts * 0.005) * 1);
    const bx = 246;
    const by = 52 + (weather === "rain" ? 0 : hop);

    // Tiny plump sparrow/bird perched on branch
    ctx.fillStyle = "#7b533e";
    ctx.fillRect(bx, by, 7, 5);
    ctx.fillStyle = "#a37455";
    ctx.fillRect(bx + 1, by + 1, 5, 3);
    // Wing flutter
    const wingUp = Math.floor(ts / 350) % 4 === 0;
    ctx.fillStyle = "#563829";
    ctx.fillRect(bx + 2, by + (wingUp ? 0 : 2), 4, 2);
    // Tail & beak
    ctx.fillRect(bx - 3, by + 1, 3, 2);
    ctx.fillStyle = "#f2b84b";
    ctx.fillRect(bx + 7, by + 2, 2, 1);
    ctx.fillStyle = "#18141c";
    ctx.fillRect(bx + 5, by + 1, 1, 1);
  }

  _drawChicken(ctx, ts, endingMode) {
    if (endingMode === "loss") return;
    const cycle = Math.floor(ts / 450) % 4;
    const peck = cycle === 2;
    const cx = 244 + (Math.floor(ts / 2200) % 2 === 0 ? 0 : 3);
    const cy = 140;

    // Legs
    ctx.fillStyle = "#d99238";
    ctx.fillRect(cx + 3, cy + 7, 1, 4);
    ctx.fillRect(cx + 6, cy + 7, 1, 4);

    // Body
    ctx.fillStyle = "#e6d2b5";
    ctx.fillRect(cx, cy + 2, 10, 6);
    ctx.fillStyle = "#c9ab88";
    ctx.fillRect(cx + 1, cy + 5, 8, 3);
    // Tail
    ctx.fillStyle = "#7c523c";
    ctx.fillRect(cx - 2, cy, 3, 4);
    // Head
    const hx = peck ? cx + 10 : cx + 8;
    const hy = peck ? cy + 4 : cy - 1;
    ctx.fillStyle = "#f2e5cf";
    ctx.fillRect(hx, hy, 4, 4);
    // Comb & beak
    ctx.fillStyle = "#d64545";
    ctx.fillRect(hx + 1, hy - 1, 2, 1);
    ctx.fillStyle = "#f0a93b";
    ctx.fillRect(hx + 4, hy + 2, 2, 1);
  }

  _drawTerraceHouse(ctx, ts, energy, lampLit, endingMode) {
    // Stilts under Rumah Panggung
    ctx.fillStyle = "#3a2219";
    ctx.fillRect(14, 146, 8, 24);
    ctx.fillRect(102, 146, 8, 24);
    ctx.fillRect(194, 146, 8, 24);

    // Under-house shadow
    ctx.fillStyle = "#190f12";
    ctx.fillRect(22, 146, 172, 16);

    // Wooden stairs on right edge of terrace
    ctx.fillStyle = "#5c3928";
    ctx.fillRect(198, 136, 16, 4);
    ctx.fillRect(204, 144, 16, 4);
    ctx.fillRect(210, 152, 16, 4);
    ctx.fillStyle = "#41271c";
    ctx.fillRect(200, 140, 3, 18);
    ctx.fillRect(218, 140, 3, 18);

    // Woven bamboo back wall (gedek)
    ctx.fillStyle = "#7a5337";
    ctx.fillRect(8, 34, 178, 92);
    // Bamboo weave stripes
    ctx.fillStyle = "#68442b";
    for (let y = 38; y < 124; y += 6) {
      ctx.fillRect(8, y, 178, 2);
    }
    for (let x = 14; x < 184; x += 10) {
      ctx.fillRect(x, 34, 2, 92);
    }

    // Kitchen doorway on left
    ctx.fillStyle = "#2b1918";
    ctx.fillRect(16, 48, 38, 76);
    ctx.fillStyle = "#4d2f22";
    ctx.fillRect(14, 46, 42, 3);
    ctx.fillRect(14, 46, 3, 78);
    ctx.fillRect(53, 46, 3, 78);

    // Terrace roof overhang (atap rumbia)
    ctx.fillStyle = "#3a241d";
    ctx.fillRect(0, 14, 212, 22);
    ctx.fillStyle = "#4f3328";
    ctx.fillRect(0, 14, 212, 14);
    ctx.fillStyle = "#291814";
    ctx.fillRect(0, 34, 214, 4);

    // Main terrace wooden pillar
    ctx.fillStyle = "#4a2c1e";
    ctx.fillRect(182, 34, 8, 110);
    ctx.fillStyle = "#633c29";
    ctx.fillRect(184, 34, 3, 110);

    // Wooden Terrace Floorboards
    ctx.fillStyle = "#6b422a";
    ctx.fillRect(6, 124, 200, 22);
    ctx.fillStyle = "#825236";
    ctx.fillRect(6, 124, 200, 6);
    ctx.fillStyle = "#4d2d1d";
    ctx.fillRect(6, 142, 200, 4);
    for (let x = 20; x < 200; x += 24) {
      ctx.fillRect(x, 124, 1, 18);
    }

    // Wooden railing on right side
    ctx.fillStyle = "#543222";
    ctx.fillRect(188, 98, 20, 4);
    ctx.fillRect(194, 102, 4, 22);
    ctx.fillRect(204, 102, 4, 22);

    // Warm interior glow spill when lamp lit or early dusk
    if (lampLit || energy < 60) {
      const flicker = 0.08 + 0.04 * Math.sin(ts * 0.012);
      ctx.fillStyle = `rgba(255, 184, 92, ${flicker.toFixed(3)})`;
      ctx.fillRect(120, 46, 76, 86);
    }
  }

  _drawProps(ctx, ts, energy, lampLit) {
    // 1. Framed Sepia Family Photo on wall
    ctx.fillStyle = "#3b2316";
    ctx.fillRect(98, 54, 20, 18);
    ctx.fillStyle = "#cbb08a";
    ctx.fillRect(100, 56, 16, 14);
    // Tiny pixel silhouettes in photo (Kakek, Nenek, 2 Anak)
    ctx.fillStyle = "#5c412f";
    ctx.fillRect(103, 59, 4, 6);
    ctx.fillRect(109, 60, 4, 5);
    ctx.fillStyle = "#7a5b44";
    ctx.fillRect(104, 65, 3, 4);
    ctx.fillRect(110, 65, 3, 4);

    // 2. Hanging Oil Lamp (Pelita) on pillar
    ctx.fillStyle = "#3c2a21";
    ctx.fillRect(180, 42, 8, 2);
    ctx.fillRect(183, 44, 2, 6);
    ctx.fillStyle = "#a66c38";
    ctx.fillRect(179, 54, 10, 8);
    ctx.fillStyle = "#784c25";
    ctx.fillRect(181, 62, 6, 2);
    // Flame
    if (lampLit || energy < 75) {
      const flick = Math.floor(ts / 140) % 2;
      ctx.fillStyle = "rgba(255, 198, 84, 0.25)";
      ctx.fillRect(172, 44, 24, 22);
      ctx.fillStyle = "#ffaa33";
      ctx.fillRect(182, 49 + flick, 4, 5);
      ctx.fillStyle = "#fff1a8";
      ctx.fillRect(183, 51 + flick, 2, 3);
    }

    // 3. Stove (Tungku) & Clay Pot (Periuk) at kitchen doorway
    // Tungku (clay hearth)
    ctx.fillStyle = "#5e433a";
    ctx.fillRect(26, 114, 22, 14);
    ctx.fillStyle = "#422c26";
    ctx.fillRect(30, 118, 14, 10);
    // Glowing embers inside tungku
    const emberPulse = Math.floor(ts / 250) % 2 === 0;
    ctx.fillStyle = emberPulse ? "#e85d2a" : "#c73d1e";
    ctx.fillRect(32, 121, 10, 5);
    ctx.fillStyle = "#ffb84d";
    ctx.fillRect(34, 122, 6, 3);

    // Periuk (clay pot sitting on top of tungku)
    ctx.fillStyle = "#8a4630";
    ctx.fillRect(28, 102, 18, 12);
    ctx.fillStyle = "#a85a3e";
    ctx.fillRect(30, 104, 12, 8);
    ctx.fillStyle = "#613022";
    ctx.fillRect(31, 99, 12, 3);
    // Rising steam pixels
    const steamY = (Math.floor(ts / 240) % 6);
    ctx.fillStyle = "rgba(255, 244, 232, 0.45)";
    ctx.fillRect(34, 93 - steamY, 2, 2);
    ctx.fillRect(39, 95 - ((steamY + 3) % 6), 2, 2);

    // 4. Wooden Mortar & Pestle (Lesung / Bonto)
    ctx.fillStyle = "#5c3823";
    ctx.fillRect(64, 116, 20, 12);
    ctx.fillStyle = "#784b30";
    ctx.fillRect(62, 114, 24, 4);
    ctx.fillStyle = "#361e12";
    ctx.fillRect(67, 114, 14, 2);
    // Alu (pestle leaning)
    ctx.fillStyle = "#8c5b3c";
    ctx.fillRect(77, 102, 3, 14);

    // 5. Woven Bamboo Basket (Bakul / Kandi)
    ctx.fillStyle = "#9c6d3b";
    ctx.fillRect(93, 114, 18, 14);
    ctx.fillStyle = "#c29053";
    ctx.fillRect(91, 112, 22, 4);
    ctx.fillStyle = "#785028";
    ctx.fillRect(95, 118, 14, 2);
    ctx.fillRect(95, 122, 14, 2);

    // 6. Woven Pandan Mat (Tikar / Kalasa)
    ctx.fillStyle = "#b8965c";
    ctx.fillRect(120, 127, 78, 14);
    ctx.fillStyle = "#9e7c44";
    ctx.fillRect(120, 127, 78, 2);
    ctx.fillRect(120, 139, 78, 2);
    for (let x = 126; x < 194; x += 8) {
      ctx.fillStyle = "#cfa96b";
      ctx.fillRect(x, 130, 4, 8);
    }

    // 7. Brass Betel Box (Wadah Sirih / Sorai)
    ctx.fillStyle = "#b88a2e";
    ctx.fillRect(129, 120, 12, 7);
    ctx.fillStyle = "#e0b653";
    ctx.fillRect(130, 118, 10, 3);
    // Little green betel leaf peeking out
    ctx.fillStyle = "#599141";
    ctx.fillRect(136, 116, 3, 3);

    // 8. Player's Vocabulary Notebook on the mat
    ctx.fillStyle = "#4d2f24";
    ctx.fillRect(180, 127, 14, 10);
    ctx.fillStyle = "#f2e7d0";
    ctx.fillRect(181, 128, 12, 8);
    ctx.fillStyle = "#9c856b";
    ctx.fillRect(183, 130, 8, 1);
    ctx.fillRect(183, 133, 6, 1);
  }

  _drawNenek(ctx, ts) {
    const now = performance.now();
    const activeGesture = now < this.state.gestureUntil ? this.state.gesture : "idle";
    const isCoughing = now < this.state.coughFlashUntil;
    const { expression, energy } = this.state;

    // Gentle breathing bob
    const breath = Math.floor(ts / 900) % 2;
    const coughOffset = isCoughing ? (Math.floor(ts / 80) % 2 === 0 ? -1 : 1) : 0;
    const nx = 152 + coughOffset;
    const ny = 96 + (expression === "sleeping" ? 4 : 0) + (breath && expression !== "sleeping" ? 1 : 0);

    // Batik sarung seated legs
    ctx.fillStyle = "#4f2c22";
    ctx.fillRect(nx - 6, ny + 26, 28, 10);
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(nx - 4, ny + 28, 24, 3);
    ctx.fillStyle = "#c99563";
    ctx.fillRect(nx - 2, ny + 32, 4, 2);
    ctx.fillRect(nx + 8, ny + 32, 4, 2);

    // Kebaya torso (warm dusty maroon/terracotta)
    ctx.fillStyle = "#7a3843";
    ctx.fillRect(nx - 2, ny + 12, 18, 16);
    ctx.fillStyle = "#964b56";
    ctx.fillRect(nx + 1, ny + 13, 12, 13);
    // Kebaya shawl / selendang
    ctx.fillStyle = "#d4a46a";
    ctx.fillRect(nx, ny + 12, 4, 14);

    // Head
    ctx.fillStyle = "#c98e6b";
    ctx.fillRect(nx + 1, ny, 12, 12);
    // Cheek shadow / warmth
    ctx.fillStyle = "#b57654";
    ctx.fillRect(nx + 1, ny + 9, 12, 3);

    // Silver-white hair & bun (konde)
    ctx.fillStyle = "#dcd9d2";
    ctx.fillRect(nx, ny - 2, 14, 4);
    ctx.fillRect(nx - 1, ny + 1, 3, 6);
    ctx.fillStyle = "#c2beb6";
    ctx.fillRect(nx - 5, ny + 1, 5, 6); // konde bun

    // Eyes & Mouth based on expression
    const blink = Math.floor(ts / 3400) % 12 === 0;
    ctx.fillStyle = "#2b1c17";
    if (expression === "sleeping" || blink) {
      ctx.fillRect(nx + 5, ny + 5, 2, 1);
      ctx.fillRect(nx + 9, ny + 5, 2, 1);
    } else if (expression === "happy") {
      ctx.fillRect(nx + 5, ny + 4, 2, 1);
      ctx.fillRect(nx + 9, ny + 4, 2, 1);
      // Smile
      ctx.fillStyle = "#7d3d35";
      ctx.fillRect(nx + 6, ny + 8, 4, 1);
    } else if (expression === "tired" || energy <= 25) {
      ctx.fillRect(nx + 5, ny + 5, 2, 1);
      ctx.fillRect(nx + 9, ny + 5, 2, 1);
      ctx.fillStyle = "#6e4238";
      ctx.fillRect(nx + 6, ny + 9, 3, 1);
    } else {
      ctx.fillRect(nx + 5, ny + 4, 2, 2);
      ctx.fillRect(nx + 9, ny + 4, 2, 2);
      ctx.fillStyle = "#7d3d35";
      ctx.fillRect(nx + 7, ny + 8, 3, 1);
    }

    // Gesture animations for arms/hands
    ctx.fillStyle = "#c98e6b";
    const wavePhase = Math.floor(ts / 260) % 2;

    if (activeGesture === "pound") {
      // Both hands moving up and down miming pestle
      const py = wavePhase === 0 ? -3 : 2;
      ctx.fillRect(nx + 14, ny + 14 + py, 6, 4);
      ctx.fillRect(nx + 12, ny + 16 + py, 6, 4);
    } else if (activeGesture === "weave") {
      const wx = wavePhase === 0 ? 1 : -1;
      ctx.fillRect(nx + 13 + wx, ny + 18, 5, 3);
      ctx.fillRect(nx + 15 - wx, ny + 21, 5, 3);
    } else if (activeGesture === "hand_heart") {
      ctx.fillRect(nx + 7, ny + 16, 5, 4);
    } else if (activeGesture === "wave" || activeGesture === "point_sky") {
      ctx.fillRect(nx + 14, ny + 6 + wavePhase * 2, 5, 4);
    } else if (activeGesture.startsWith("point_pot") || activeGesture.startsWith("point_stove") || activeGesture.startsWith("point_mortar") || activeGesture.startsWith("point_basket") || activeGesture.startsWith("point_photo")) {
      // Pointing left toward terrace interior/kitchen
      ctx.fillRect(nx - 8 - wavePhase * 2, ny + 16, 7, 3);
    } else if (activeGesture.startsWith("point_")) {
      // Pointing right toward yard/lamp/children/mat
      ctx.fillRect(nx + 15 + wavePhase * 2, ny + 16, 7, 3);
    } else if (activeGesture === "sit_pat") {
      ctx.fillRect(nx + 15, ny + 24 + wavePhase * 2, 6, 3);
    } else if (activeGesture === "hold_book" || activeGesture === "hold_sirih") {
      ctx.fillRect(nx + 14, ny + 22, 6, 4);
    } else {
      // Calm resting hands
      ctx.fillRect(nx + 10, ny + 22, 6, 4);
    }
  }

  _drawChildren(ctx, ts) {
    // 3 little village children sitting happily on the right side of the mat/steps
    const kids = [
      { x: 184, y: 112, shirt: "#4e8098", hair: "#211816" },
      { x: 198, y: 116, shirt: "#d97a41", hair: "#2b1d19" },
      { x: 214, y: 120, shirt: "#5d8c52", hair: "#1a1414" }
    ];
    kids.forEach((k, idx) => {
      const bob = Math.floor((ts + idx * 320) / 500) % 2;
      ctx.fillStyle = "#c98e6b";
      ctx.fillRect(k.x + 2, k.y + bob, 7, 7);
      ctx.fillStyle = k.hair;
      ctx.fillRect(k.x + 1, k.y - 1 + bob, 9, 3);
      ctx.fillStyle = k.shirt;
      ctx.fillRect(k.x, k.y + 7 + bob, 11, 9);
      ctx.fillStyle = "#3c3240";
      ctx.fillRect(k.x + 1, k.y + 16, 9, 5);
    });
  }

  _drawRain(ctx) {
    ctx.fillStyle = "rgba(182, 212, 238, 0.55)";
    this._rainDrops.forEach((d) => {
      d.x -= 0.7;
      d.y += d.speed;
      if (d.y > 168) {
        d.y = 10 + Math.random() * 20;
        d.x = 180 + Math.random() * 145;
      }
      if (d.x < 178) d.x = 318;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
    });
  }

  _drawFireflies(ctx, ts, energy) {
    const count = energy <= 25 ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const f = this._fireflies[i];
      const fx = Math.round(f.baseX + Math.sin(ts * 0.002 + f.phase) * 7);
      const fy = Math.round(f.baseY + Math.cos(ts * 0.0016 + f.phase) * 5);
      const glow = 0.4 + 0.6 * Math.abs(Math.sin(ts * 0.004 + f.phase));
      ctx.fillStyle = `rgba(255, 224, 120, ${glow.toFixed(2)})`;
      ctx.fillRect(fx, fy, 2, 2);
    }
  }

  _drawSpotlight(ctx, ts, targetKey) {
    const box = TERRACE_OBJECTS[targetKey];
    if (!box) return;

    const pulse = 0.55 + 0.45 * Math.sin(ts * 0.008);
    ctx.strokeStyle = `rgba(255, 216, 107, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    ctx.setLineDash([]);

    // Small bouncing pixel pointer arrow above target
    const bounce = Math.round(Math.sin(ts * 0.01) * 2);
    const ax = Math.round(box.x + box.w / 2);
    const ay = Math.max(8, box.y - 6 + bounce);
    ctx.fillStyle = "#ffe17d";
    ctx.fillRect(ax - 3, ay - 3, 7, 2);
    ctx.fillRect(ax - 2, ay - 1, 5, 2);
    ctx.fillRect(ax - 1, ay + 1, 3, 2);
    ctx.fillRect(ax, ay + 3, 1, 1);
  }
}

// 16x16 Crisp Pixel-Art Icon Generator for the Vocabulary Book
const ICON_CACHE = new Map();

export function getWordIconDataURL(visualClue) {
  if (ICON_CACHE.has(visualClue)) return ICON_CACHE.get(visualClue);

  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;

  const px = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };

  switch (visualClue) {
    case "duduk":
      // Seated figure silhouette
      px(6, 2, 4, 4, "#f0c29c");
      px(5, 6, 6, 5, "#b85c68");
      px(5, 11, 8, 3, "#6b4334");
      px(3, 14, 11, 1, "#d9ae6c");
      break;
    case "tikar":
      // Woven mat roll/square
      px(2, 5, 12, 7, "#cfa25f");
      px(2, 5, 12, 1, "#8c6532");
      px(2, 11, 12, 1, "#8c6532");
      for (let x = 4; x <= 11; x += 3) px(x, 6, 1, 5, "#a67c40");
      break;
    case "periuk":
      // Clay cooking pot
      px(5, 3, 6, 2, "#7d3d29");
      px(3, 5, 10, 8, "#a8573b");
      px(5, 7, 4, 4, "#c97455");
      px(4, 13, 8, 1, "#66301f");
      break;
    case "tungku":
      // Clay hearth with fire
      px(2, 7, 12, 7, "#6e4e44");
      px(5, 9, 6, 5, "#2b1916");
      px(6, 10, 4, 4, "#e8632a");
      px(7, 11, 2, 3, "#ffd257");
      break;
    case "lesung":
      // Wooden mortar
      px(3, 5, 10, 2, "#8c5737");
      px(5, 5, 6, 1, "#331b0e");
      px(4, 7, 8, 6, "#6b4027");
      px(3, 13, 10, 1, "#4d2c19");
      break;
    case "menumbuk":
      // Pestle pounding into mortar
      px(7, 1, 2, 8, "#d49c6a");
      px(4, 8, 8, 5, "#6b4027");
      px(3, 6, 2, 1, "#ffe082");
      px(11, 6, 2, 1, "#ffe082");
      break;
    case "wadah sirih":
      // Brass betel box + leaf
      px(3, 7, 10, 6, "#bd8c2d");
      px(4, 5, 8, 2, "#e8be5a");
      px(10, 3, 3, 3, "#589e47");
      break;
    case "menganyam":
      // Criss-cross weave pattern
      px(3, 3, 10, 10, "#9e7742");
      px(5, 3, 2, 10, "#e3be7a");
      px(9, 3, 2, 10, "#e3be7a");
      px(3, 5, 10, 2, "#cfa059");
      px(3, 9, 10, 2, "#cfa059");
      break;
    case "bakul":
      // Woven basket
      px(3, 4, 10, 2, "#d19b58");
      px(4, 6, 8, 7, "#9e6b35");
      px(5, 8, 6, 1, "#6e471f");
      px(5, 11, 6, 1, "#6e471f");
      break;
    case "pelita":
      // Oil lamp with flame
      px(7, 2, 2, 4, "#ffae33");
      px(7, 3, 2, 2, "#fff5a8");
      px(5, 7, 6, 5, "#b87a3d");
      px(4, 12, 8, 2, "#784c22");
      break;
    case "pohon":
      // Green tree
      px(6, 9, 4, 6, "#66402c");
      px(3, 3, 10, 7, "#3a7342");
      px(5, 2, 6, 4, "#579e59");
      break;
    case "ayam":
      // Chicken
      px(4, 7, 7, 5, "#f0dfc2");
      px(9, 4, 3, 4, "#f5ebd8");
      px(10, 3, 2, 1, "#d94545");
      px(12, 5, 2, 1, "#f2a93b");
      px(6, 12, 1, 2, "#d99238");
      px(8, 12, 1, 2, "#d99238");
      break;
    case "hujan":
      // Cloud + raindrops
      px(4, 3, 8, 4, "#8aa0ba");
      px(3, 4, 10, 3, "#aebfd4");
      px(4, 9, 1, 3, "#78b9eb");
      px(8, 10, 1, 3, "#78b9eb");
      px(11, 8, 1, 3, "#78b9eb");
      break;
    case "burung":
      // Little bird
      px(4, 7, 7, 4, "#9c6d4e");
      px(8, 5, 4, 4, "#b88766");
      px(12, 6, 2, 1, "#f2b84b");
      px(2, 7, 2, 2, "#63412d");
      break;
    case "kakek":
      // Elder man with peci cap
      px(5, 2, 6, 3, "#2b252c");
      px(5, 5, 6, 5, "#d49a77");
      px(6, 10, 4, 1, "#dcdcdc");
      px(4, 11, 8, 4, "#5a6978");
      break;
    case "anak":
      // Younger person silhouette
      px(5, 3, 6, 3, "#2b1d19");
      px(5, 6, 6, 4, "#dda381");
      px(4, 10, 8, 5, "#598399");
      break;
    case "rindu":
      // Warm heart glow
      px(3, 4, 4, 4, "#e06c75");
      px(9, 4, 4, 4, "#e06c75");
      px(4, 6, 8, 4, "#e06c75");
      px(6, 10, 4, 2, "#e06c75");
      px(7, 12, 2, 1, "#e06c75");
      break;
    case "senja":
      // Dusk horizon sun
      px(2, 2, 12, 5, "#5e3369");
      px(2, 7, 12, 4, "#cf5c4c");
      px(5, 7, 6, 4, "#ffbf61");
      px(2, 11, 12, 3, "#2b1c36");
      break;
    case "cucu":
      // Small child
      px(6, 4, 4, 3, "#2b1d19");
      px(6, 7, 4, 3, "#e3ad8b");
      px(5, 10, 6, 4, "#e08748");
      break;
    case "menjaga":
      // Hands cradling book/light
      px(5, 4, 6, 6, "#f2e5c9");
      px(4, 3, 8, 1, "#704531");
      px(3, 10, 4, 3, "#d99e79");
      px(9, 10, 4, 3, "#d99e79");
      px(5, 12, 6, 2, "#c28561");
      break;
    default:
      px(4, 4, 8, 8, "#cfa25f");
  }

  const url = c.toDataURL();
  ICON_CACHE.set(visualClue, url);
  return url;
}
