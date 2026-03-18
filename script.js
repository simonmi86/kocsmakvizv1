/* script.js – Kocsmakvíz (helyes válasznál 3 mp-es indoklás + admin LOCK Firestore + fallback) */

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Beállítások ----------
  const TOTAL_QUESTIONS = 10;
  const LIMIT_MS = 15_000; // 15 mp/kérdés
  const HS_KEY = "kocsmakviz_highscore";
  const LS_BOARD_KEY = "kocsmakviz_leaderboard_v1";
  const HAS_DB = typeof window !== "undefined" && window.db && typeof window.db.collection === "function";

  // ⬇️ LOCK fallback kulcs (Firestore az elsődleges, de maradjon localStorage is)
  const LOCK_KEY = "kocsmakviz_locked_v1";

  // ---------- DOM ----------
  const nameScreen   = document.getElementById("nameScreen");
  const adminScreen  = document.getElementById("adminScreen");
  const quizScreen   = document.getElementById("quizScreen");
  const resultScreen = document.getElementById("resultScreen");

  const startBtn     = document.getElementById("startBtn");
  const playerNameEl = document.getElementById("playerName");

  const clearBoardBtn= document.getElementById("clearBoardBtn");
  const backBtn      = document.getElementById("backBtn");

  const qNumEl       = document.getElementById("qNum");
  const qTotalEl     = document.getElementById("qTotal");
  const scoreView    = document.getElementById("scoreView");
  const highView     = document.getElementById("highView");

  const timerBar     = document.getElementById("timerBar");
  const questionEl   = document.getElementById("question");
  const explainBox   = document.getElementById("explainBox");
  const answersEl    = document.getElementById("answers");
  const resultText   = document.getElementById("resultText");
  const leaderBody   = document.getElementById("leaderTableBody");

  // ⬇️ ÚJ: Admin lock gomb
  const toggleLockBtn = document.getElementById("toggleLockBtn");

  // ---------- Állapot ----------
  let state = {
    player: "",
    score: 0,
    allQuestions: [],
    questions: [],
    current: 0,
    rafId: null,
    t0: 0
  };

  // ---------- Segédek ----------
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const show = (el) => [nameScreen, adminScreen, quizScreen, resultScreen].forEach(x => x && (x.style.display = (x===el ? "block":"none")));
  const stopTimer = () => { if (state.rafId) cancelAnimationFrame(state.rafId); state.rafId = null; };
  const startTimer = (onTimeout) => {
    stopTimer(); state.t0 = performance.now();
    const tick = (now) => {
      const left = Math.max(0, LIMIT_MS - (now - state.t0));
      timerBar.style.width = `${(left / LIMIT_MS) * 100}%`;
      if (left <= 0) { onTimeout(); return; }
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
  };

  // ---------- Adatbetöltés ----------
  async function loadQuestionsJson() {
    const res = await fetch(`questions.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`questions.json betöltési hiba: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length < TOTAL_QUESTIONS) {
      console.warn("[Questions] Kevés kérdés vagy hibás formátum.");
    }
    state.allQuestions = data;
  }

  function pickRandomQuestions() {
    // A JSON szerkezete: { q, a:[], correct, explain? }
    return shuffle(state.allQuestions).slice(0, TOTAL_QUESTIONS).map((q) => {
      const opts = q.a.map((text, idx) => ({ text, idx }));
      const mixed = shuffle(opts);
      const newCorrect = mixed.findIndex(o => o.idx === q.correct);
      return {
        q: q.q,
        a: mixed.map(o => o.text),
        correct: newCorrect,
        explain: q.explain ? String(q.explain) : ""
      };
    });
  }

  // ---------- Ranglista (Firestore + fallback) ----------
  async function firestoreLoadLeaderboard() {
    if (!HAS_DB) return loadBoardLocal();
    try {
      const snap = await db.collection("leaderboard").orderBy("score","desc").get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        rows.push({
          name: d.name ?? "",
          score: Number(d.score) || 0,
          total: Number(d.total) || 0,
          playedAt: d.playedAt ?? null
        });
      });
      return rows;
    } catch (err) {
      console.error("[LoadLeaderboard] Firestore hiba:", err);
      return loadBoardLocal();
    }
  }

  async function firestoreAddResult(name, score, total) {
    if (!HAS_DB) { saveResultLocal(name, score, total); return; }
    try {
      await db.collection("leaderboard").add({
        name: String(name || "").trim(),
        score: Number(score) || 0,
        total: Number(total) || 0,
        playedAt: new Date()
      });
    } catch (err) {
      console.error("[AddResult] Firestore hiba:", err);
      saveResultLocal(name, score, total);
    }
  }

  async function firestoreCountAttempts(name) {
    if (!HAS_DB) return countAttemptsLocal(name);
    try {
      const snap = await db.collection("leaderboard").where("name","==", String(name||"").trim()).get();
      return snap.size || 0;
    } catch (err) {
      console.error("[CountAttempts] Firestore hiba:", err);
      return countAttemptsLocal(name);
    }
  }

  async function firestoreClearLeaderboard() {
    if (!HAS_DB) { clearBoardLocal(); return; }
    try {
      const snap = await db.collection("leaderboard").get();
      const batch = db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.error("[ClearLeaderboard] Firestore hiba:", err);
    }
  }

  // --- localStorage fallbackok ---
  function loadBoardLocal() {
    try { return JSON.parse(localStorage.getItem(LS_BOARD_KEY) || "[]"); }
    catch { return []; }
  }
  function saveBoardLocal(arr) {
    localStorage.setItem(LS_BOARD_KEY, JSON.stringify(arr));
  }
  function saveResultLocal(name, score, total) {
    const board = loadBoardLocal();
    board.push({ name: String(name||"").trim(), score: Number(score)||0, total: Number(total)||0, playedAt: Date.now() });
    board.sort((a,b) => (b.score - a.score) || (b.playedAt - a.playedAt));
    saveBoardLocal(board.slice(0,100));
  }
  function countAttemptsLocal(name) {
    const n = String(name||"").trim();
    return loadBoardLocal().filter(x => (x.name||"") === n).length;
  }
  function clearBoardLocal() {
    localStorage.removeItem(LS_BOARD_KEY);
  }

  async function renderLeaderboard() {
    if (!leaderBody) return;
    leaderBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Betöltés…</td></tr>`;
    const rows = await firestoreLoadLeaderboard();

    if (!rows.length) {
      leaderBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Nincs még tárolt eredmény.</td></tr>`;
      return;
    }

    const toDate = (p) => (p?.toDate ? p.toDate() : new Date(p || Date.now()));
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    leaderBody.innerHTML = rows.map((e, i) => {
      const d = toDate(e.playedAt);
      return `<tr>
        <td>${i+1}</td>
        <td>${escapeHtml(e.name)}</td>
        <td>${e.score}</td>
        <td>${e.total}</td>
        <td>${fmt(d)}</td>
      </tr>`;
    }).join("");
  }

  // ---------- Kvíz zárolás / nyitás (Firestore + fallback) ----------
  async function firestoreGetLock() {
    if (!HAS_DB) return null;
    try {
      const ref = db.collection("config").doc("global");
      const snap = await ref.get();
      if (!snap.exists) return false;
      const d = snap.data() || {};
      return !!d.locked;
    } catch (e) {
      console.warn("[Lock] Nem sikerült lekérdezni Firestore-ból:", e);
      return null; // fallback
    }
  }

  async function firestoreSetLock(locked) {
    if (!HAS_DB) return false;
    try {
      const ref = db.collection("config").doc("global");
      await ref.set({ locked: !!locked }, { merge: true });
      return true;
    } catch (e) {
      console.error("[Lock] Nem sikerült menteni Firestore-ba:", e);
      return false;
    }
  }

  function getLockLocal() {
    try { return localStorage.getItem(LOCK_KEY) === "1"; }
    catch { return false; }
  }
  function setLockLocal(locked) {
    try { localStorage.setItem(LOCK_KEY, locked ? "1" : "0"); }
    catch {}
  }

  async function getLockState() {
    const fs = await firestoreGetLock();
    if (typeof fs === "boolean") return fs;
    return getLockLocal();
  }

  async function setLockState(locked) {
    let ok = await firestoreSetLock(locked);
    if (!ok) setLockLocal(locked);
    return locked;
  }

  async function refreshLockButton() {
    if (!toggleLockBtn) return;
    const locked = await getLockState();
    if (locked) {
      toggleLockBtn.textContent = "Kvíz zárolása: ZÁROLVA";
      toggleLockBtn.classList.add("locked");
    } else {
      toggleLockBtn.textContent = "Kvíz zárolása: NYITVA";
      toggleLockBtn.classList.remove("locked");
    }
  }

  // ---------- Kvíz logika ----------
  function showQuestion() {
    if (!Array.isArray(state.questions) || state.current < 0 || state.current >= state.questions.length) {
      endGame(); return;
    }

    const q = state.questions[state.current];
    qNumEl.textContent = String(state.current + 1);
    questionEl.textContent = q.q;

    // indoklás doboz alaphelyzetbe
    explainBox.style.display = "none";
    explainBox.textContent = "";

    answersEl.innerHTML = q.a.map((text, i) =>
      `<button class="answerBtn" data-id="${i}">${escapeHtml(text)}</button>`
    ).join("");

    // kattintáskezelés
    answersEl.querySelectorAll(".answerBtn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        stopTimer();
        const chosen = Number(e.currentTarget.dataset.id);

        // minden gomb letiltása
        answersEl.querySelectorAll(".answerBtn").forEach(b => { b.disabled = true; });

        const isCorrect = (chosen === q.correct);

        // csak a kiválasztott gombot jelöljük
        const chosenBtn = answersEl.querySelector(`.answerBtn[data-id="${chosen}"]`);
        if (chosenBtn) {
          chosenBtn.classList.add(isCorrect ? "correct" : "wrong");
        }

        if (isCorrect) {
          state.score++;
          scoreView.textContent = String(state.score);

          // Ha van indoklás → megjelenítjük 3 mp-ig
          if (q.explain && q.explain.trim()) {
            explainBox.textContent = q.explain.trim();
            explainBox.style.display = "block";
            setTimeout(nextQuestion, 3000);
            return;
          }
        }

        // rossz válasz (vagy nincs indoklás): rövid várakozás, majd tovább
        setTimeout(nextQuestion, 600);
      }, { passive: true });
    });

    // timer indul (lejáratnál NEM jelöljük a helyest)
    startTimer(() => {
      answersEl.querySelectorAll(".answerBtn").forEach(b => { b.disabled = true; });
      setTimeout(nextQuestion, 600);
    });

  }

  function nextQuestion() {
    stopTimer();
    state.current++;
    if (state.current >= state.questions.length) { endGame(); return; }
    showQuestion();
  }

  async function endGame() {
    stopTimer();
    show(resultScreen);

    // High score (eszköz)
    try {
      const high = Number(localStorage.getItem(HS_KEY) || 0);
      if (state.score > high) localStorage.setItem(HS_KEY, String(state.score));
      highView.textContent = String(Math.max(state.score, high));
    } catch {}

    // Mentés
    try {
      await firestoreAddResult(state.player, state.score, state.questions.length);
    } catch (e) {
      console.error("[EndGame] mentési hiba:", e);
    }

    resultText.innerHTML = `${escapeHtml(state.player)}, a pontszámod: <strong>${state.score} / ${state.questions.length}</strong>`;
  }

  // ---------- Admin ----------
  async function showAdmin() {
    show(adminScreen);
    await refreshLockButton();  // frissítjük a zárolás gomb feliratát
    await renderLeaderboard();
  }

  // ---------- Bootstrap ----------
  (async function bootstrap() {
    const orig = startBtn.textContent;
    startBtn.disabled = true;
    startBtn.textContent = "Betöltés…";

    try {
      await loadQuestionsJson();
      startBtn.disabled = false;
      startBtn.textContent = orig;
    } catch (e) {
      console.error("[Bootstrap] Kérdésbetöltési hiba:", e);
      startBtn.textContent = "Hiba (frissítsd az oldalt)";
      alert("Nem sikerült betölteni a kérdéseket. Kérlek frissítsd az oldalt.");
    }

    // kezdő nézet + HUD init
    show(nameScreen);
    qTotalEl.textContent = String(TOTAL_QUESTIONS);
    scoreView.textContent = "0";
    highView.textContent = String(Number(localStorage.getItem(HS_KEY) || 0));
  })();

  // ---------- Események ----------
  startBtn.addEventListener("click", async () => {
    const name = (playerNameEl.value || "").trim();
    if (!name) { alert("Kérlek add meg a neved!"); return; }

    if (name.toLowerCase() === "kmadmin") {
      await showAdmin(); 
      return;
    }

    // ⬇️ Zároltság ellenőrzés (csak nem-admin nevekre)
    try {
      const locked = await getLockState();
      if (locked) {
        alert("A kvíz jelenleg nem elérhető!");
        return;
      }
    } catch (e) {
      console.warn("[Lock] ellenőrzés sikertelen, továbblépnénk:", e);
    }

    // limit: max 3 próbálkozás / név (a kérésed szerint)
    try {
      const attempts = await firestoreCountAttempts(name);
      if (attempts >= 3) {
        alert("Ezzel a névvel elérted a 3 próbálkozás limitet. Várj az ereményhírdetésig.");
        return;
      }
    } catch (e) {
      console.warn("[Attempts] ellenőrzés kihagyva:", e);
    }

    // játékállapot
    state.player = name;
    state.score = 0;
    state.current = 0;

    // kiválasztott kérdések (a válaszok sorrendje keverve, correct újraszámolva)
    state.questions = pickRandomQuestions();
    if (!state.questions.length) {
      alert("Nincs elérhető kérdés. Kérlek frissítsd az oldalt.");
      return;
    }

    qTotalEl.textContent = String(state.questions.length);
    scoreView.textContent = "0";

    show(quizScreen);
    showQuestion();
  });

  // Admin: kvíz zárolása / nyitása
  toggleLockBtn?.addEventListener("click", async () => {
    const current = await getLockState();
    const next = !current;
    await setLockState(next);
    await refreshLockButton();
    alert(next
      ? "A kvíz mostantól ZÁROLVA (csak kmadmin léphet be)."
      : "A kvíz mostantól NYITVA."
    );
  });

  clearBoardBtn?.addEventListener("click", async () => {
    if (!confirm("Biztosan törlöd az összes eredményt?")) return;
    await firestoreClearLeaderboard();
    await renderLeaderboard();
    alert("Eredménytábla törölve.");
  });

  backBtn?.addEventListener("click", () => {
    show(nameScreen);
  });
});
