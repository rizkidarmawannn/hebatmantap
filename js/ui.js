import { SoundEngine } from "./audio.js";
import { TerraceRenderer, getWordIconDataURL } from "./art.js";
import { GameEngine } from "./engine.js";

const PREFS_KEY = "melestarikan_prefs_v1";

const CATEGORY_LABELS = {
  benda: "Benda rumah tangga",
  alam: "Alam & hewan",
  tindakan: "Tindakan",
  kerabat: "Kerabat",
  perasaan: "Perasaan & waktu"
};

const TERRACE_HINTS = {
  mat: { words: ["w01", "w02", "w08"], sensory: "Alas anyaman daun pandan terbentang di atas papan teras." },
  pot: { words: ["w03"], sensory: "Wadah tanah liat bulat yang mengeluarkan uap hangat." },
  stove: { words: ["w04"], sensory: "Bara api masih menyala redup di bawah peralatan masak." },
  mortar: { words: ["w05", "w06"], sensory: "Kayu jati tua berlubang dalam dengan batang kayu di sisinya." },
  sirih: { words: ["w07"], sensory: "Kotak kuningan kecil dengan daun hijau di tepi bantal." },
  basket: { words: ["w09"], sensory: "Wadah anyaman bambu bundar di sudut teras." },
  lamp: { words: ["w10"], sensory: "Wadah minyak bersumbu yang digantung di tiang teras." },
  tree: { words: ["w11"], sensory: "Pohon berdaun rindang yang menaungi ujung halaman." },
  chicken: { words: ["w12"], sensory: "Unggas desa yang sibuk mematuk tanah di halaman." },
  bird: { words: ["w14"], sensory: "Makhluk bersayap kecil yang bertengger di dahan." },
  photo: { words: ["w15", "w16"], sensory: "Bingkai foto keluarga berwarna kecokelatan di dinding papan." },
  book: { words: ["w20"], sensory: "Buku catatanmu sendiri untuk menyimpan tutur yang hampir hilang." },
  sky: { words: ["w18"], sensory: "Langit sore perlahan berubah warna menuju malam." },
  nenek: { words: ["w17"], sensory: "Nenek Wati menatapmu dengan sabar dari atas tikar." }
};

class GameUI {
  constructor() {
    this.sound = new SoundEngine();
    this.tuning = null;
    this.story = null;
    this.engine = null;
    this.renderer = null;
    this.endingRenderer = null;

    this._typewriterTimer = null;
    this._typewriterDone = true;
    this._currentBeatObj = null;
    this._lastTickTime = 0;
    this._toastTimer = null;
    this._latestTelemetry = null;

    this.prefs = {
      volume: 70,
      muted: false,
      textSize: "medium",
      highContrast: false
    };

    this._cacheElements();
  }

  _cacheElements() {
    this.el = {
      titleScreen: document.getElementById("title-screen"),
      culturalNotice: document.getElementById("cultural-notice"),
      btnStart: document.getElementById("btn-start"),
      btnHowTo: document.getElementById("btn-how-to"),
      btnTitleSettings: document.getElementById("btn-title-settings"),

      hudEnergyBox: document.getElementById("hud-energy-box"),
      energyLabel: document.getElementById("energy-label"),
      energyFill: document.getElementById("energy-fill"),
      energyBarAria: document.getElementById("energy-bar-aria"),
      lowEnergyBadge: document.getElementById("low-energy-badge"),

      hudCounterBox: document.getElementById("hud-counter-box"),
      wordCounter: document.getElementById("word-counter"),
      counterStatus: document.getElementById("counter-status"),

      trustBadge: document.getElementById("trust-badge"),
      trustTierText: document.getElementById("trust-tier-text"),

      btnToggleBookMobile: document.getElementById("btn-toggle-book-mobile"),
      btnCloseBookMobile: document.getElementById("btn-close-book-mobile"),
      mobileUnguessedBadge: document.getElementById("mobile-unguessed-badge"),
      btnPause: document.getElementById("btn-pause"),

      sceneCanvas: document.getElementById("scene-canvas"),
      segmentPill: document.getElementById("segment-pill"),
      terraceToast: document.getElementById("terrace-toast"),

      dialogPanel: document.getElementById("dialog-panel"),
      speakerName: document.getElementById("speaker-name"),
      dialogTapHint: document.getElementById("dialog-tap-hint"),
      dialogText: document.getElementById("dialog-text"),
      dialogReaction: document.getElementById("dialog-reaction"),
      tutorialHint: document.getElementById("tutorial-hint"),
      btnOpenQuestions: document.getElementById("btn-open-questions"),
      questionsLeftLabel: document.getElementById("questions-left-label"),
      btnNextDialog: document.getElementById("btn-next-dialog"),

      questionPanel: document.getElementById("question-panel"),
      qTargetNote: document.getElementById("q-target-note"),
      qCostBadge: document.getElementById("q-cost-badge"),
      btnCloseQuestions: document.getElementById("btn-close-questions"),
      questionGrid: document.getElementById("question-grid"),

      bookColumn: document.getElementById("book-column"),
      bookSub: document.getElementById("book-sub"),
      wordSlotsGrid: document.getElementById("word-slots-grid"),
      guessEmpty: document.getElementById("guess-empty"),
      guessActive: document.getElementById("guess-active"),
      guessWordIcon: document.getElementById("guess-word-icon"),
      guessWordForm: document.getElementById("guess-word-form"),
      guessWordStatus: document.getElementById("guess-word-status"),
      guessWordCategory: document.getElementById("guess-word-category"),
      clueNotesList: document.getElementById("clue-notes-list"),
      guessChoicesArea: document.getElementById("guess-choices-area"),
      choicesGrid: document.getElementById("choices-grid"),
      guessResolved: document.getElementById("guess-resolved"),
      guessResolvedText: document.getElementById("guess-resolved-text"),

      howtoModal: document.getElementById("howto-modal"),
      btnCloseHowto: document.getElementById("btn-close-howto"),

      settingsModal: document.getElementById("settings-modal"),
      optVolume: document.getElementById("opt-volume"),
      optVolumeVal: document.getElementById("opt-volume-val"),
      optMute: document.getElementById("opt-mute"),
      optTextSize: document.getElementById("opt-text-size"),
      optContrast: document.getElementById("opt-contrast"),
      btnResume: document.getElementById("btn-resume"),
      btnRestartFromPause: document.getElementById("btn-restart-from-pause"),

      endingScreen: document.getElementById("ending-screen"),
      endingBadge: document.getElementById("ending-badge"),
      endingTitle: document.getElementById("ending-title"),
      endingSummary: document.getElementById("ending-summary"),
      endingCanvas: document.getElementById("ending-canvas"),
      endingEpilogue: document.getElementById("ending-epilogue"),
      endingReviewGrid: document.getElementById("ending-review-grid"),
      endingTelemetryBox: document.getElementById("ending-telemetry-box"),
      btnPlayAgain: document.getElementById("btn-play-again"),
      btnCopyTelemetry: document.getElementById("btn-copy-telemetry")
    };
  }

  async init() {
    this._loadPrefs();
    this._applyPrefs();
    this._bindEvents();

    const [tuningRes, storyRes] = await Promise.all([
      fetch("data/tuning.json"),
      fetch("data/story.json")
    ]);
    this.tuning = await tuningRes.json();
    this.story = await storyRes.json();

    if (this.story.meta?.culturalNotice) {
      this.el.culturalNotice.textContent = this.story.meta.culturalNotice;
    }

    this.renderer = new TerraceRenderer(this.el.sceneCanvas);
    this.renderer.start();

    this.endingRenderer = new TerraceRenderer(this.el.endingCanvas);

    this.engine = new GameEngine(this.tuning, this.story, {
      onStateChange: (state) => this._renderHUD(state),
      onLowEnergy: () => {
        this.sound.setLowEnergyMode(true);
        this.sound.playCough();
        this.renderer.triggerCough();
      },
      onCoughPulse: () => {
        this.sound.playCough();
        this.renderer.triggerCough();
      },
      onGuessResult: (res) => this._handleGuessReaction(res),
      onQuestionAnswered: (payload) => this._handleQuestionResponse(payload),
      onEnding: (outcome) => this._showEnding(outcome)
    });

    this._renderQuestionButtons();
    this._startLoop();
  }

  _bindEvents() {
    this.el.btnStart.addEventListener("click", () => this._startNewSession());
    this.el.btnPlayAgain.addEventListener("click", () => {
      this.el.endingScreen.classList.add("hidden");
      this.endingRenderer.stop();
      this._startNewSession();
    });

    this.el.btnHowTo.addEventListener("click", () => this.el.howtoModal.classList.remove("hidden"));
    this.el.btnCloseHowto.addEventListener("click", () => this.el.howtoModal.classList.add("hidden"));

    this.el.btnTitleSettings.addEventListener("click", () => this._openSettings(false));
    this.el.btnPause.addEventListener("click", () => this._openSettings(true));
    this.el.btnResume.addEventListener("click", () => this._closeSettings());
    this.el.btnRestartFromPause.addEventListener("click", () => {
      this._closeSettings();
      this._startNewSession();
    });

    this.el.btnToggleBookMobile.addEventListener("click", () => {
      const open = this.el.bookColumn.classList.toggle("mobile-open");
      this.el.btnToggleBookMobile.setAttribute("aria-expanded", String(open));
    });
    this.el.btnCloseBookMobile.addEventListener("click", () => {
      this.el.bookColumn.classList.remove("mobile-open");
      this.el.btnToggleBookMobile.setAttribute("aria-expanded", "false");
    });

    this.el.dialogPanel.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (!this._typewriterDone) {
        this._finishTypewriterImmediately();
      }
    });

    this.el.btnNextDialog.addEventListener("click", () => {
      if (!this._typewriterDone) {
        this._finishTypewriterImmediately();
        return;
      }
      this._clearReaction();
      const next = this.engine.advanceDialog();
      if (next) this._presentDialogBeat(next);
    });

    this.el.btnOpenQuestions.addEventListener("click", () => {
      const hidden = this.el.questionPanel.classList.toggle("hidden");
      if (!hidden) this._updateQuestionPanelHeader();
    });
    this.el.btnCloseQuestions.addEventListener("click", () => {
      this.el.questionPanel.classList.add("hidden");
    });

    this.el.sceneCanvas.addEventListener("click", (e) => {
      const hit = this.renderer.hitTest(e.clientX, e.clientY);
      if (!hit || !this.engine) return;
      this._handleTerraceClick(hit);
    });

    // Settings controls
    this.el.optVolume.addEventListener("input", (e) => {
      this.prefs.volume = Number(e.target.value);
      this._applyPrefs();
      this._savePrefs();
    });
    this.el.optMute.addEventListener("change", (e) => {
      this.prefs.muted = e.target.checked;
      this._applyPrefs();
      this._savePrefs();
    });
    this.el.optTextSize.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-size]");
      if (!btn) return;
      this.prefs.textSize = btn.dataset.size;
      this._applyPrefs();
      this._savePrefs();
    });
    this.el.optContrast.addEventListener("change", (e) => {
      this.prefs.highContrast = e.target.checked;
      this._applyPrefs();
      this._savePrefs();
    });

    this.el.btnCopyTelemetry.addEventListener("click", () => {
      if (!this._latestTelemetry) return;
      navigator.clipboard?.writeText(JSON.stringify(this._latestTelemetry, null, 2))
        .then(() => this._showTerraceToast("Log playtest disalin ke clipboard."))
        .catch(() => {});
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.engine && (this.engine.phase === "story" || this.engine.phase === "closing")) {
        this._lastTickTime = performance.now();
      }
    });
  }

  _startNewSession() {
    this.el.titleScreen.classList.add("hidden");
    this.el.endingScreen.classList.add("hidden");
    this.el.questionPanel.classList.add("hidden");
    this.el.bookColumn.classList.remove("mobile-open");
    this._clearReaction();

    this.sound.startAtmosphere();
    this.sound.setLowEnergyMode(false);

    this.renderer.updateState({
      energy: this.tuning.energy.initial,
      endingMode: null,
      weather: "clear",
      lampLit: false,
      expression: "neutral",
      gesture: "idle"
    });

    const firstBeat = this.engine.startSession();
    this._presentDialogBeat(firstBeat);
    this._renderBook();
  }

  _startLoop() {
    this._lastTickTime = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.25, (now - this._lastTickTime) / 1000);
      this._lastTickTime = now;

      if (this.engine) {
        this.engine.tick(dt);
        this.renderer.updateState({
          energy: this.engine.energy,
          trustTier: this.engine.getTrustTier().id
        });
        this._renderEnergyOnly();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  _presentDialogBeat(beat) {
    if (!beat || !beat.tokens) return;
    this._currentBeatObj = beat;

    this.el.segmentPill.textContent = beat.segmentNumber > 0
      ? `Segmen ${beat.segmentNumber}/${beat.totalSegments} · ${beat.segmentTitle}`
      : beat.segmentTitle;

    this.el.speakerName.textContent = beat.speaker;

    if (beat.hint) {
      this.el.tutorialHint.textContent = `💡 ${beat.hint}`;
      this.el.tutorialHint.classList.remove("hidden");
    } else {
      this.el.tutorialHint.classList.add("hidden");
    }

    if (this.engine.phase === "closing") {
      this.el.btnNextDialog.innerHTML = "Tutup Catatan &amp; Akhiri ▸";
    } else {
      this.el.btnNextDialog.innerHTML = "Lanjut ▸";
    }

    // Update canvas scene mood & visual clues
    const tier = this.engine.getTrustTier();
    this.renderer.updateState({
      weather: beat.weather || "clear",
      lampLit: Boolean(beat.lampLit),
      expression: beat.expression || "neutral"
    });

    if (beat.focusWord) {
      this.renderer.triggerClue(
        beat.focusWord.terraceTarget,
        beat.focusWord.gesture,
        tier.clueDurationMs,
        tier.gestureLoops
      );
    } else if (beat.gesture) {
      this.renderer.triggerClue(null, beat.gesture, 0, 2);
    }

    this._runTypewriter(beat.tokens);
    this._renderBook();
    this._updateQuestionPanelHeader();
  }

  _runTypewriter(tokens) {
    if (this._typewriterTimer) clearInterval(this._typewriterTimer);
    this._typewriterDone = false;
    this.el.dialogTapHint.textContent = "Ketuk teks untuk mempercepat";

    // Build full DOM nodes upfront with hidden char spans, or progressive char reveal across tokens
    const totalChars = tokens.reduce((sum, tk) => sum + tk.text.length, 0);
    let shownChars = 0;

    const renderUpTo = (limit) => {
      this.el.dialogText.innerHTML = "";
      let remaining = limit;
      for (const tk of tokens) {
        if (remaining <= 0) break;
        const slice = tk.text.slice(0, remaining);
        remaining -= slice.length;

        if (tk.type === "word") {
          const slot = this.engine.slotMap.get(tk.wordId);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "regional-word";
          if (slot?.status === "correct") btn.classList.add("word-correct");
          if (slot?.status === "missed") btn.classList.add("word-missed");
          btn.textContent = slice;
          btn.title = "Klik untuk melihat di Buku Kosakata";
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this._focusWordFromDialog(tk.wordId);
          });
          this.el.dialogText.appendChild(btn);
        } else {
          this.el.dialogText.appendChild(document.createTextNode(slice));
        }
      }
    };

    const stepMs = this.engine.energy <= this.tuning.energy.lowThreshold ? 32 : 20;
    this._typewriterTimer = setInterval(() => {
      shownChars += 1;
      renderUpTo(shownChars);
      if (shownChars % 4 === 1) this.sound.playDialogTick();
      if (shownChars >= totalChars) {
        this._finishTypewriterImmediately();
      }
    }, stepMs);
  }

  _finishTypewriterImmediately() {
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer);
      this._typewriterTimer = null;
    }
    this._typewriterDone = true;
    this.el.dialogTapHint.textContent = "Klik Lanjut atau pilih kata bergaris bawah";

    if (!this._currentBeatObj) return;
    this.el.dialogText.innerHTML = "";
    for (const tk of this._currentBeatObj.tokens) {
      if (tk.type === "word") {
        const slot = this.engine.slotMap.get(tk.wordId);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "regional-word";
        if (slot?.status === "correct") btn.classList.add("word-correct");
        if (slot?.status === "missed") btn.classList.add("word-missed");
        btn.textContent = tk.text;
        btn.title = "Klik untuk menebak kata ini di Buku Kosakata";
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this._focusWordFromDialog(tk.wordId);
        });
        this.el.dialogText.appendChild(btn);
      } else {
        this.el.dialogText.appendChild(document.createTextNode(tk.text));
      }
    }
  }

  _focusWordFromDialog(wordId) {
    if (!this.engine.selectWord(wordId)) return;
    const word = this.engine.wordMap.get(wordId);
    const tier = this.engine.getTrustTier();
    if (word && tier.clueDurationMs > 0) {
      this.renderer.triggerClue(word.terraceTarget, word.gesture, tier.clueDurationMs, tier.gestureLoops);
    }
    this._renderBook();
    this._updateQuestionPanelHeader();
    if (window.innerWidth <= 960) {
      this.el.bookColumn.classList.add("mobile-open");
      this.el.btnToggleBookMobile.setAttribute("aria-expanded", "true");
    }
  }

  _handleTerraceClick(hitKey) {
    const info = TERRACE_HINTS[hitKey];
    if (!info) return;

    const solvedWord = info.words
      .map((id) => this.engine.slotMap.get(id))
      .find((s) => s && s.status === "correct");

    if (solvedWord) {
      this._showTerraceToast(`${solvedWord.word.form} (${solvedWord.word.meaning}) — sudah tercatat ✓`);
    } else {
      this._showTerraceToast(info.sensory);
    }
  }

  _showTerraceToast(msg) {
    this.el.terraceToast.textContent = msg;
    this.el.terraceToast.classList.remove("hidden");
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.el.terraceToast.classList.add("hidden");
    }, 3400);
  }

  _renderHUD(state) {
    this._renderEnergyOnly();

    const { counts, trustTier, questionsLeft, phase } = state;
    const targetMet = counts.correct >= counts.target;
    this.el.wordCounter.textContent = targetMet
      ? `${counts.correct}/${counts.total}`
      : `${counts.correct}/${counts.target}`;
    this.el.counterStatus.textContent = targetMet ? "✓ Target Tercapai!" : `Target: ${counts.target}`;
    this.el.hudCounterBox.classList.toggle("target-met", targetMet);

    this.el.trustTierText.textContent = trustTier.label;
    this.el.trustBadge.className = `trust-badge tier-${trustTier.id}`;
    this.el.trustBadge.title = trustTier.description;

    this.el.questionsLeftLabel.textContent = `${questionsLeft}/${this.tuning.questions.maxPerSession}`;
    this.el.btnOpenQuestions.disabled = (phase !== "story" && phase !== "closing") || questionsLeft <= 0 || counts.discovered === 0;

    this.el.mobileUnguessedBadge.textContent = String(counts.unguessed);
  }

  _renderEnergyOnly() {
    if (!this.engine) return;
    const pct = Math.max(0, Math.min(100, Math.round(this.engine.energy)));
    const isLow = this.engine.energy <= this.tuning.energy.lowThreshold;

    this.el.energyLabel.textContent = `${pct}%`;
    this.el.energyFill.style.width = `${pct}%`;
    this.el.energyBarAria.setAttribute("aria-valuenow", String(pct));
    this.el.hudEnergyBox.classList.toggle("low-energy", isLow);
    this.el.lowEnergyBadge.classList.toggle("hidden", !isLow);
  }

  _renderBook() {
    if (!this.engine) return;
    const slots = this.engine.slots;
    const counts = this.engine.getCounts();

    this.el.bookSub.textContent = `${counts.discovered}/20 kata terdengar · ${counts.unguessed} menunggu tebakan`;
    this.el.wordSlotsGrid.innerHTML = "";

    for (const slot of slots) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-slot";
      btn.setAttribute("role", "option");

      if (!slot.discovered) {
        btn.classList.add("locked-future");
        btn.disabled = true;
        btn.innerHTML = `<span class="slot-form">???</span><span class="slot-status-tag">Belum muncul</span>`;
      } else {
        if (slot.id === this.engine.selectedWordId) btn.classList.add("selected");
        if (slot.status === "correct") btn.classList.add("status-correct");
        if (slot.status === "missed") btn.classList.add("status-missed");

        const iconImg = document.createElement("img");
        iconImg.className = "slot-icon";
        iconImg.src = getWordIconDataURL(slot.word.visualClue);
        iconImg.alt = "";

        const formEl = document.createElement("span");
        formEl.className = "slot-form";
        formEl.textContent = slot.word.form;

        const tagEl = document.createElement("span");
        tagEl.className = "slot-status-tag";
        tagEl.textContent =
          slot.status === "correct"
            ? `✓ ${slot.word.meaning}`
            : slot.status === "missed"
              ? "✕ Terlewat"
              : "○ Tebak";

        btn.append(iconImg, formEl, tagEl);
        btn.addEventListener("click", () => {
          this.engine.selectWord(slot.id);
          this._renderBook();
          this._updateQuestionPanelHeader();
        });
      }

      this.el.wordSlotsGrid.appendChild(btn);
    }

    this._renderSelectedSlot();
  }

  _renderSelectedSlot() {
    const slot = this.engine.selectedWordId ? this.engine.slotMap.get(this.engine.selectedWordId) : null;
    if (!slot || !slot.discovered) {
      this.el.guessEmpty.classList.remove("hidden");
      this.el.guessActive.classList.add("hidden");
      return;
    }

    this.el.guessEmpty.classList.add("hidden");
    this.el.guessActive.classList.remove("hidden");

    this.el.guessWordIcon.src = getWordIconDataURL(slot.word.visualClue);
    this.el.guessWordForm.textContent = slot.word.form;

    const statusMap = {
      unguessed: { text: "○ Belum ditebak", cls: "" },
      correct: { text: "✓ Terkunci benar", cls: "correct" },
      missed: { text: "✕ Terlewat", cls: "missed" }
    };
    const st = statusMap[slot.status];
    this.el.guessWordStatus.textContent = st.text;
    this.el.guessWordStatus.className = `word-status-pill ${st.cls}`;

    const catName = CATEGORY_LABELS[slot.word.category] || slot.word.category;
    this.el.guessWordCategory.textContent =
      slot.status === "unguessed"
        ? `${catName} · Kesempatan tersisa: ${slot.attemptsLeft}/2`
        : `${catName} · Arti: "${slot.word.meaning}"`;

    // Render narrative clues + question hints accumulated
    this.el.clueNotesList.innerHTML = "";
    slot.seenContexts.forEach((ctxItem) => {
      const li = document.createElement("li");
      li.textContent = `(Segmen ${ctxItem.segment}) "${ctxItem.sentence}"`;
      this.el.clueNotesList.appendChild(li);
    });
    slot.extraNotes.forEach((note) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${note.question}</strong> → ${note.answer}`;
      this.el.clueNotesList.appendChild(li);
    });

    if (slot.status === "unguessed") {
      this.el.guessChoicesArea.classList.remove("hidden");
      this.el.guessResolved.classList.add("hidden");
      this.el.choicesGrid.innerHTML = "";

      const letters = ["A", "B", "C", "D"];
      slot.choices.forEach((choiceText, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn choice-btn";
        const alreadyTried = slot.wrongChoices.includes(choiceText);
        if (alreadyTried) {
          btn.classList.add("wrong-tried");
          btn.disabled = true;
        }
        btn.textContent = `${letters[idx]}. ${choiceText}`;
        btn.addEventListener("click", () => {
          this.engine.submitGuess(slot.id, choiceText);
        });
        this.el.choicesGrid.appendChild(btn);
      });
    } else {
      this.el.guessChoicesArea.classList.add("hidden");
      this.el.guessResolved.classList.remove("hidden");
      this.el.guessResolved.classList.toggle("is-missed", slot.status === "missed");
      this.el.guessResolvedText.textContent =
        slot.status === "correct"
          ? `Tercatat dengan baik: "${slot.word.form}" berarti "${slot.word.meaning}".`
          : `Kata ini terlewat (${slot.word.form} = "${slot.word.meaning}"). Tidak dihitung ke skor.`;
    }
  }

  _handleGuessReaction(res) {
    if (res.correct) {
      this.sound.playCorrect();
      this.renderer.updateState({ expression: "happy", gesture: res.word.gesture });
      this._showReaction(
        `✓ Tepat! "${res.word.form}" = ${res.word.meaning} (+3 Energi, +8 Kepercayaan). — Nenek: "${res.reaction}"`,
        "reaction-correct"
      );
    } else {
      this.sound.playWrong();
      this.renderer.updateState({ expression: res.expression });
      const msgPrefix = res.lockedMissed ? "✕ Kata terlewat" : "✕ Belum tepat";
      this._showReaction(
        `${msgPrefix} (−8 Energi, −15 Kepercayaan). — Nenek: "${res.reaction}"`,
        "reaction-wrong"
      );
    }
    this._finishTypewriterImmediately();
    this._renderBook();
    this._updateQuestionPanelHeader();
  }

  _renderQuestionButtons() {
    this.el.questionGrid.innerHTML = "";
    this.story.questionTemplates.forEach((qt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn question-btn";
      btn.textContent = qt.label;
      btn.addEventListener("click", () => {
        const targetId = this._getQuestionTargetWordId();
        if (!targetId) return;
        this.engine.askQuestion(targetId, qt.id);
      });
      this.el.questionGrid.appendChild(btn);
    });
  }

  _getQuestionTargetWordId() {
    const selected = this.engine.selectedWordId ? this.engine.slotMap.get(this.engine.selectedWordId) : null;
    if (selected && selected.discovered && selected.status === "unguessed") {
      return selected.id;
    }
    const fallback = this.engine.slots.find((s) => s.discovered && s.status === "unguessed");
    return fallback ? fallback.id : null;
  }

  _updateQuestionPanelHeader() {
    if (!this.engine) return;
    const targetId = this._getQuestionTargetWordId();
    const tier = this.engine.getTrustTier();
    const cost = tier.id === "waspada" ? this.tuning.energy.onQuestionWaspada : this.tuning.energy.onQuestion;
    this.el.qCostBadge.textContent = `${cost} Energi`;

    const qButtons = this.el.questionGrid.querySelectorAll("button");
    if (!targetId || this.engine.questionsLeft <= 0) {
      this.el.qTargetNote.textContent = this.engine.questionsLeft <= 0
        ? "Kesempatan bertanya (6/6) sudah habis."
        : "Pilih kata yang belum ditebak di Buku Kosakata.";
      qButtons.forEach((b) => { b.disabled = true; });
    } else {
      const slot = this.engine.slotMap.get(targetId);
      this.el.qTargetNote.textContent = `Menanyakan kata: "${slot.word.form}"`;
      qButtons.forEach((b) => { b.disabled = false; });
    }
  }

  _handleQuestionResponse(payload) {
    this.sound.playQuestion();
    this._showReaction(
      `💬 [${payload.word.form}] "${payload.questionLabel}" (−${payload.cost} Energi) → Nenek: "${payload.answer}"`,
      "reaction-question"
    );

    if (payload.replayClue) {
      const duration = payload.trustTier.id === "waspada" ? 1600 : Math.max(3500, payload.trustTier.clueDurationMs);
      const loops = Math.max(2, payload.trustTier.gestureLoops);
      this.renderer.triggerClue(payload.word.terraceTarget, payload.word.gesture, duration, loops);
    } else {
      this.renderer.triggerClue(null, payload.word.gesture, 0, 2);
    }

    this.el.questionPanel.classList.add("hidden");
    this._renderBook();
    this._updateQuestionPanelHeader();
  }

  _showReaction(text, className) {
    this.el.dialogReaction.textContent = text;
    this.el.dialogReaction.className = `dialog-reaction ${className}`;
    this.el.dialogReaction.classList.remove("hidden");
  }

  _clearReaction() {
    this.el.dialogReaction.classList.add("hidden");
    this.el.dialogReaction.textContent = "";
  }

  _openSettings(pauseGame) {
    if (pauseGame && this.engine && (this.engine.phase === "story" || this.engine.phase === "closing")) {
      this.engine.setPaused(true);
    }
    this.el.settingsModal.classList.remove("hidden");
  }

  _closeSettings() {
    this.el.settingsModal.classList.add("hidden");
    if (this.engine) {
      this.engine.setPaused(false);
    }
  }

  _showEnding(outcome) {
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer);
      this._typewriterTimer = null;
    }

    const { ending, counts, slots, telemetry } = outcome;
    this._latestTelemetry = telemetry;

    this.sound.stopAtmosphere();
    this.sound.playEnding(ending.isWin);

    this.el.endingBadge.textContent = `${counts.correct} / ${counts.total} Kata Terjaga`;
    this.el.endingTitle.textContent = ending.title;
    this.el.endingSummary.textContent = ending.summary;
    this.el.endingEpilogue.textContent = ending.epilogue;

    this.endingRenderer.updateState({
      energy: ending.isWin ? 85 : 0,
      endingMode: ending.isWin ? "win" : "loss",
      expression: ending.isWin ? "happy" : "sleeping",
      lampLit: !ending.isWin,
      weather: "clear",
      gesture: "idle"
    });
    this.endingRenderer.start();

    this.el.endingReviewGrid.innerHTML = "";
    slots.forEach((s) => {
      const card = document.createElement("div");
      card.className = `review-item ${s.status === "correct" ? "rev-correct" : s.status === "missed" ? "rev-missed" : ""}`;
      const icon = document.createElement("img");
      icon.src = getWordIconDataURL(s.word.visualClue);
      icon.width = 24;
      icon.height = 24;
      icon.alt = "";
      icon.style.imageRendering = "pixelated";

      const txt = document.createElement("div");
      const statusIcon = s.status === "correct" ? "✓" : s.status === "missed" ? "✕" : "○";
      txt.innerHTML = `<strong>${statusIcon} ${s.word.form}</strong><br /><span>${s.word.meaning}</span>`;
      card.append(icon, txt);
      this.el.endingReviewGrid.appendChild(card);
    });

    const mins = Math.floor(telemetry.durationSec / 60);
    const secs = telemetry.durationSec % 60;
    const wrongList = telemetry.wrongGuesses.length
      ? telemetry.wrongGuesses.map((w) => `${w.form} (tebak "${w.guessed}")`).join(", ")
      : "Tidak ada";

    this.el.endingTelemetryBox.innerHTML = `
      <div>• <strong>Durasi sesi aktif:</strong> ${mins}m ${secs}d (Sasaran GDD: 5–8 menit)</div>
      <div>• <strong>Alasan berakhir:</strong> ${telemetry.endReason}</div>
      <div>• <strong>Sisa energi akhir:</strong> ${telemetry.energyAtEnd}% · <strong>Kepercayaan akhir:</strong> ${telemetry.trustAtEnd}/100</div>
      <div>• <strong>Pertanyaan terpakai:</strong> ${telemetry.questionsAsked.length}/${this.tuning.questions.maxPerSession}</div>
      <div>• <strong>Riwayat tebakan salah:</strong> ${wrongList}</div>
    `;

    this.el.questionPanel.classList.add("hidden");
    this.el.bookColumn.classList.remove("mobile-open");
    this.el.settingsModal.classList.add("hidden");
    this.el.endingScreen.classList.remove("hidden");

    // Optional anonymous telemetry to localhost server
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry)
    }).catch(() => {});
  }

  _loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved) Object.assign(this.prefs, saved);
    } catch {
      // Ignore storage failures
    }
  }

  _savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      // Ignore storage failures
    }
  }

  _applyPrefs() {
    this.sound.setVolume(this.prefs.volume / 100);
    this.sound.setMuted(this.prefs.muted);

    this.el.optVolume.value = String(this.prefs.volume);
    this.el.optVolumeVal.textContent = `${this.prefs.volume}%`;
    this.el.optMute.checked = this.prefs.muted;
    this.el.optContrast.checked = this.prefs.highContrast;

    document.documentElement.setAttribute("data-text-size", this.prefs.textSize);
    document.documentElement.setAttribute("data-contrast", this.prefs.highContrast ? "high" : "normal");

    this.el.optTextSize.querySelectorAll("[data-size]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.size === this.prefs.textSize);
    });
  }
}

const ui = new GameUI();
ui.init().catch((err) => {
  console.error("Gagal memuat game:", err);
});
