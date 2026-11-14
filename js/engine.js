function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class GameEngine {
  constructor(tuning, story, callbacks = {}) {
    this.tuning = tuning;
    this.story = story;
    this.cb = callbacks;

    this.wordMap = new Map(story.words.map((w) => [w.id, w]));
    this.reset();
  }

  reset() {
    const t = this.tuning;
    this.phase = "title"; // title | tutorial | story | closing | ending
    this.paused = false;

    this.energy = t.energy.initial;
    this.trust = t.trust.initial;
    this.questionsLeft = t.questions.maxPerSession;

    this.tutorialIndex = 0;
    this.segmentIndex = 0;
    this.beatIndex = 0;

    this.selectedWordId = null;
    this.lowEnergyTriggered = false;
    this._lastCoughAt = 0;
    this.sessionStartMs = 0;
    this.sessionEndMs = 0;
    this.activeElapsedSec = 0;

    // Initialize 20 vocabulary slots with per-session shuffled choices
    this.slots = this.story.words.map((w) => ({
      id: w.id,
      word: w,
      discovered: false,
      status: "unguessed", // unguessed | correct | missed
      attemptsLeft: t.guessing.maxAttemptsPerWord,
      choices: shuffleArray([w.meaning, ...w.distractors]),
      wrongChoices: [],
      seenContexts: [],
      extraNotes: []
    }));
    this.slotMap = new Map(this.slots.map((s) => [s.id, s]));

    this.telemetry = {
      wrongGuesses: [],
      questionsAsked: [],
      endReason: null,
      endingId: null,
      energyAtEnd: 0,
      trustAtEnd: 0,
      durationSec: 0
    };
  }

  startSession() {
    this.reset();
    this.phase = "tutorial";
    this.tutorialIndex = 0;
    this.sessionStartMs = Date.now();
    this._emitState();
    return this.getCurrentDialog();
  }

  setPaused(isPaused) {
    this.paused = Boolean(isPaused);
    this._emitState();
  }

  tick(dtSeconds) {
    if (this.paused) return;
    if (this.phase !== "story" && this.phase !== "closing") return;
    if (dtSeconds <= 0) return;

    this.activeElapsedSec += dtSeconds;

    const eCfg = this.tuning.energy;
    const isLow = this.energy <= eCfg.lowThreshold;
    const drainRate = eCfg.passiveDrainPerSecond * (isLow ? eCfg.lowDrainMultiplier : 1);

    this._changeEnergy(-drainRate * dtSeconds, true);

    if (this.energy <= eCfg.lowThreshold) {
      if (!this.lowEnergyTriggered) {
        this.lowEnergyTriggered = true;
        this._lastCoughAt = Date.now();
        this.cb.onLowEnergy?.();
      } else if (Date.now() - this._lastCoughAt > 26000) {
        this._lastCoughAt = Date.now();
        this.cb.onCoughPulse?.();
      }
    }
  }

  getTrustTier() {
    const tiers = this.tuning.trust.tiers;
    if (this.trust >= tiers.percaya.min) return { id: "percaya", ...tiers.percaya };
    if (this.trust >= tiers.ragu.min) return { id: "ragu", ...tiers.ragu };
    return { id: "waspada", ...tiers.waspada };
  }

  getCounts() {
    let correct = 0;
    let missed = 0;
    let discovered = 0;
    let unguessed = 0;
    for (const s of this.slots) {
      if (s.discovered) discovered += 1;
      if (s.status === "correct") correct += 1;
      else if (s.status === "missed") missed += 1;
      else if (s.discovered) unguessed += 1;
    }
    return {
      correct,
      missed,
      discovered,
      unguessed,
      total: this.slots.length,
      target: this.tuning.guessing.targetWordsToWin
    };
  }

  getCurrentDialog() {
    if (this.phase === "tutorial") {
      const tut = this.story.tutorial[this.tutorialIndex];
      return {
        kind: "tutorial",
        segmentNumber: 0,
        totalSegments: this.story.segments.length,
        segmentTitle: "Pengantar di Teras",
        speaker: tut.speaker,
        rawText: tut.text,
        tokens: [{ type: "text", text: tut.text }],
        hint: tut.hint,
        gesture: tut.gesture,
        expression: tut.expression,
        weather: "clear",
        lampLit: false,
        focusWord: null
      };
    }

    if (this.phase === "story") {
      const seg = this.story.segments[this.segmentIndex];
      const beat = seg.beats[this.beatIndex];
      const tokens = this._parseBeatText(beat.text);
      const focusWord = beat.focusWord ? this.wordMap.get(beat.focusWord) : null;

      return {
        kind: "story",
        segmentNumber: seg.id,
        totalSegments: this.story.segments.length,
        segmentTitle: seg.title,
        speaker: "Nenek Wati",
        rawText: beat.text,
        tokens,
        hint: null,
        gesture: focusWord ? focusWord.gesture : "idle",
        expression: this.energy <= this.tuning.energy.lowThreshold ? "tired" : "neutral",
        weather: beat.weather || "clear",
        lampLit: seg.id >= 5,
        focusWord
      };
    }

    if (this.phase === "closing") {
      const counts = this.getCounts();
      const text = counts.unguessed > 0
        ? `Cerita sore ini sudah sampai di ujung, Nak. Masih ada ${counts.unguessed} kata di bukumu yang belum tertebak—kalau mau menebak sebelum pelita padam, silakan. Atau tutup catatanmu bila sudah siap.`
        : "Semua kata sudah kau catat dengan tekun, Nak. Mari kita lihat apa yang tersisa sebelum malam benar-benar turun.";

      return {
        kind: "closing",
        segmentNumber: this.story.segments.length,
        totalSegments: this.story.segments.length,
        segmentTitle: "Penutup Senja",
        speaker: "Nenek Wati",
        rawText: text,
        tokens: [{ type: "text", text }],
        hint: "Kamu masih dapat membuka Buku Kosakata atau bertanya selama energi Nenek tersisa.",
        gesture: "hold_book",
        expression: this.energy <= this.tuning.energy.lowThreshold ? "tired" : "happy",
        weather: "clear",
        lampLit: true,
        focusWord: null
      };
    }

    return null;
  }

  enterCurrentBeat() {
    if (this.phase !== "story") return;
    const seg = this.story.segments[this.segmentIndex];
    const beat = seg.beats[this.beatIndex];
    const tokens = this._parseBeatText(beat.text);
    const plainSentence = tokens.map((tk) => tk.text).join("");

    let newestUnguessedId = null;
    for (const tk of tokens) {
      if (tk.type === "word") {
        const slot = this.slotMap.get(tk.wordId);
        if (slot) {
          const wasDiscovered = slot.discovered;
          slot.discovered = true;
          if (!slot.seenContexts.some((c) => c.beatId === beat.id)) {
            slot.seenContexts.push({
              beatId: beat.id,
              segment: seg.id,
              sentence: plainSentence
            });
          }
          if (!wasDiscovered && slot.status === "unguessed") {
            newestUnguessedId = slot.id;
          }
        }
      }
    }

    if (newestUnguessedId) {
      this.selectedWordId = newestUnguessedId;
    } else if (beat.focusWord) {
      const focusSlot = this.slotMap.get(beat.focusWord);
      if (focusSlot && focusSlot.status === "unguessed") {
        this.selectedWordId = focusSlot.id;
      }
    }

    this._emitState();
  }

  advanceDialog() {
    if (this.phase === "tutorial") {
      if (this.tutorialIndex < this.story.tutorial.length - 1) {
        this.tutorialIndex += 1;
      } else {
        this.phase = "story";
        this.segmentIndex = 0;
        this.beatIndex = 0;
        this.enterCurrentBeat();
      }
      this._emitState();
      return this.getCurrentDialog();
    }

    if (this.phase === "story") {
      const seg = this.story.segments[this.segmentIndex];
      if (this.beatIndex < seg.beats.length - 1) {
        this.beatIndex += 1;
        this.enterCurrentBeat();
      } else if (this.segmentIndex < this.story.segments.length - 1) {
        this.segmentIndex += 1;
        this.beatIndex = 0;
        this.enterCurrentBeat();
      } else {
        const counts = this.getCounts();
        if (counts.unguessed === 0) {
          this.finishSession("story_completed");
          return null;
        }
        this.phase = "closing";
      }
      this._emitState();
      return this.getCurrentDialog();
    }

    if (this.phase === "closing") {
      this.finishSession("player_finished");
      return null;
    }

    return null;
  }

  selectWord(wordId) {
    const slot = this.slotMap.get(wordId);
    if (!slot || !slot.discovered) return false;
    this.selectedWordId = wordId;
    this._emitState();
    return true;
  }

  submitGuess(wordId, chosenMeaning) {
    if (this.phase !== "story" && this.phase !== "closing") return null;
    const slot = this.slotMap.get(wordId);
    if (!slot || !slot.discovered || slot.status !== "unguessed") return null;
    if (slot.wrongChoices.includes(chosenMeaning)) return null;

    const isCorrect = chosenMeaning === slot.word.meaning;
    const eCfg = this.tuning.energy;
    const trCfg = this.tuning.trust;

    if (isCorrect) {
      slot.status = "correct";
      this._changeEnergy(eCfg.onCorrect, false);
      this._changeTrust(trCfg.onCorrect);

      // Select next unguessed discovered word if convenient
      const nextUnguessed = this.slots.find((s) => s.discovered && s.status === "unguessed");
      if (nextUnguessed) {
        this.selectedWordId = nextUnguessed.id;
      }

      const result = {
        correct: true,
        lockedMissed: false,
        word: slot.word,
        reaction: slot.word.reactions.correct,
        expression: "happy"
      };
      this.cb.onGuessResult?.(result);
      this._emitState();

      if (this.phase === "closing" && this.getCounts().unguessed === 0) {
        setTimeout(() => {
          if (this.phase === "closing") {
            this.finishSession("all_words_resolved");
          }
        }, 1200);
      }
      return result;
    }

    // Wrong guess
    slot.wrongChoices.push(chosenMeaning);
    slot.attemptsLeft -= 1;
    this.telemetry.wrongGuesses.push({
      wordId: slot.id,
      form: slot.word.form,
      meaning: slot.word.meaning,
      guessed: chosenMeaning,
      segment: this.segmentIndex + 1
    });

    this._changeTrust(trCfg.onWrong);
    this._changeEnergy(eCfg.onWrong, false);

    if (this.energy <= 0) {
      // Energy hit 0 from the penalty; still mark missed if 0 attempts left
      if (slot.attemptsLeft <= 0) slot.status = "missed";
      return {
        correct: false,
        lockedMissed: slot.attemptsLeft <= 0,
        word: slot.word,
        reaction: slot.attemptsLeft <= 0 ? slot.word.reactions.wrongSecond : slot.word.reactions.wrongFirst,
        expression: "tired"
      };
    }

    let reaction;
    let lockedMissed = false;
    if (slot.attemptsLeft <= 0) {
      slot.status = "missed";
      lockedMissed = true;
      reaction = slot.word.reactions.wrongSecond;
      const nextUnguessed = this.slots.find((s) => s.discovered && s.status === "unguessed");
      if (nextUnguessed) {
        this.selectedWordId = nextUnguessed.id;
      }
    } else {
      reaction = slot.word.reactions.wrongFirst;
    }

    const result = {
      correct: false,
      lockedMissed,
      word: slot.word,
      reaction,
      expression: lockedMissed ? "tired" : "correcting"
    };
    this.cb.onGuessResult?.(result);
    this._emitState();

    if (this.phase === "closing" && this.getCounts().unguessed === 0) {
      setTimeout(() => {
        if (this.phase === "closing") {
          this.finishSession("all_words_resolved");
        }
      }, 1400);
    }

    return result;
  }

  askQuestion(wordId, questionId) {
    if (this.phase !== "story" && this.phase !== "closing") return null;
    if (this.questionsLeft <= 0) return null;

    const targetId = wordId || this.selectedWordId;
    const slot = this.slotMap.get(targetId);
    if (!slot || !slot.discovered) return null;

    const tier = this.getTrustTier();
    const cost = tier.id === "waspada" ? this.tuning.energy.onQuestionWaspada : this.tuning.energy.onQuestion;
    this.questionsLeft -= 1;

    const qEntry = slot.word.questions[questionId];
    const responseText = tier.id === "waspada" ? qEntry.vague : qEntry.clear;
    const template = this.story.questionTemplates.find((q) => q.id === questionId);

    slot.extraNotes.push({
      question: template ? template.label : "",
      answer: responseText
    });

    this.telemetry.questionsAsked.push({
      wordId: slot.id,
      form: slot.word.form,
      questionId,
      trustTier: tier.id
    });

    this._changeEnergy(cost, false);
    if (this.phase === "ending") {
      return null;
    }

    const payload = {
      word: slot.word,
      questionLabel: template ? template.label : "",
      answer: responseText,
      cost: Math.abs(cost),
      trustTier: tier,
      replayClue: questionId === "q_repeat"
    };

    this.cb.onQuestionAnswered?.(payload);
    this._emitState();
    return payload;
  }

  finishSession(reason = "completed") {
    if (this.phase === "ending") return null;
    this.phase = "ending";
    this.sessionEndMs = Date.now();

    const counts = this.getCounts();
    const endCfg = this.tuning.endings;
    let endingDef;
    if (counts.correct >= endCfg.fullWinMin) {
      endingDef = this.story.endings.fullWin;
    } else if (counts.correct >= endCfg.winMin) {
      endingDef = this.story.endings.win;
    } else if (counts.correct >= endCfg.thinWinMin) {
      endingDef = this.story.endings.thinWin;
    } else {
      endingDef = this.story.endings.loss;
    }

    this.telemetry.endReason = reason;
    this.telemetry.endingId = endingDef.id;
    this.telemetry.energyAtEnd = Math.round(this.energy);
    this.telemetry.trustAtEnd = Math.round(this.trust);
    this.telemetry.durationSec = Math.round(this.activeElapsedSec || (this.sessionEndMs - this.sessionStartMs) / 1000);
    this.telemetry.correctCount = counts.correct;
    this.telemetry.missedCount = counts.missed;

    const outcome = {
      reason,
      ending: endingDef,
      counts,
      slots: this.slots,
      telemetry: this.telemetry
    };

    this.cb.onEnding?.(outcome);
    this._emitState();
    return outcome;
  }

  _changeEnergy(delta, silent = false) {
    const eCfg = this.tuning.energy;
    this.energy = Math.max(eCfg.min, Math.min(eCfg.max, this.energy + delta));
    if (this.energy <= eCfg.min && (this.phase === "story" || this.phase === "closing")) {
      this.energy = 0;
      this.finishSession("energy_depleted");
      return;
    }
    if (!silent) {
      this._emitState();
    }
  }

  _changeTrust(delta) {
    const tCfg = this.tuning.trust;
    this.trust = Math.max(tCfg.min, Math.min(tCfg.max, this.trust + delta));
  }

  _parseBeatText(text) {
    const parts = [];
    const regex = /\{(w\d{2})\}/g;
    let lastIdx = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: "text", text: text.slice(lastIdx, match.index) });
      }
      const wId = match[1];
      const word = this.wordMap.get(wId);
      parts.push({
        type: "word",
        wordId: wId,
        text: word ? word.form : wId
      });
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push({ type: "text", text: text.slice(lastIdx) });
    }
    return parts;
  }

  _emitState() {
    this.cb.onStateChange?.({
      phase: this.phase,
      paused: this.paused,
      energy: this.energy,
      trust: this.trust,
      trustTier: this.getTrustTier(),
      questionsLeft: this.questionsLeft,
      selectedWordId: this.selectedWordId,
      counts: this.getCounts()
    });
  }
}
