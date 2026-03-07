// ===== Globális állapot =====
let player = "";
let score = 0;
let questions = [];
const HS_KEY = "kocsmakviz_highscore"; // eszköz-rekord kulcs

// ========== Firestore: leaderboard lekérdezés (COMPAT) ==========
async function firestoreLoadLeaderboard() {
  try {
    let queryRef = db.collection("leaderboard").orderBy("score", "desc");
    // queryRef = queryRef.orderBy("playedAt", "desc"); // ha kell másodlagos rendezés + index
    const snap = await queryRef.get();

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      rows.push({
        name: d.name ?? "",
        score: Number(d.score) || 0,
        total: Number(d.total) || 0,
        playedAt: d.playedAt ?? null // lehet Date vagy Timestamp; megjelenítéskor formázd
      });
    });
    return rows;
  } catch (err) {
    console.error("[LoadLeaderboard] Firestore hiba:", err);
    return [];
  }
}

// ========== Firestore: próbálkozások számolása (COMPAT) ==========
async function firestoreCountAttempts(name) {
  if (!name || !name.trim()) return 0;
  const normalized = name.trim(); // vagy .toLowerCase()
  try {
    const snap = await db
      .collection("leaderboard")
      .where("name", "==", normalized)
      .get();
    return snap.size;
  } catch (err) {
    console.error("[CountAttempts] Firestore hiba:", err);
    return 0;
  }
}

// ========== Firestore: eredmény mentése (COMPAT) ==========
async function firestoreAddResult(name, score, total) {
  console.log("[AddResult] start", { name, score, total });
  try {
    await db.collection("leaderboard").add({
      name: name,                 // egységesítéshez használhatsz: String(name).trim().toLowerCase()
      score: Number(score) || 0,
      total: Number(total) || 0,
      playedAt: new Date()
    });
    console.log("[AddResult] success");
  } catch (err) {
    console.error("[AddResult] error", err);
  }
}

// ========== Firestore: leaderboard törlése (COMPAT) ==========
async function firestoreClearLeaderboard() {
  try {
    const snap = await db.collection("leaderboard").get();
    const deletions = [];
    snap.forEach(doc => deletions.push(doc.ref.delete()));
    await Promise.all(deletions);
  } catch (err) {
    console.error("[ClearLeaderboard] Firestore hiba:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {

// ---- Kérdésbank betöltése JSON-ból ----
let bank = [];        // a teljes kérdésbank (JSON)
const TOTAL = 10;     // menetenként ennyi kérdés

async function loadQuestions() {
  // cache-bust: GitHub Pages-n ne kapj régi fájlt
  const res = await fetch(`questions.json?v=${Date.now()}`);
  if (!res.ok) throw new Error(`questions.json letöltési hiba: ${res.status}`);
  const data = await res.json();

  // alapszintű validáció
  if (!Array.isArray(data) || data.length < TOTAL) {
    console.warn("[Questions] Kevés kérdés vagy hibás formátum a questions.json-ben.");
  }
  bank = data;
}

// Véletlen sorrendből kivágunk TOTAL darabot
function pickRandomFromBank() {
  return bank
    .map(v => [Math.random(), v])
    .sort((a,b) => a[0]-b[0])
    .map(x => x[1])
    .slice(0, TOTAL);
}

document.addEventListener("DOMContentLoaded", () => {
  // ... itt jönnek a DOM elemek lekérései (startBtn, playerName, stb.) ...

  // --- Start gomb átmeneti letiltása, amíg a kérdések betöltődnek ---
  const originalStartLabel = startBtn.textContent;
  startBtn.disabled = true;
  startBtn.textContent = "Betöltés…";

  loadQuestions()
    .then(() => {
      // siker: Start gomb engedélyezése
      startBtn.disabled = false;
      startBtn.textContent = originalStartLabel;
    })
    .catch(err => {
      console.error("[Questions] Betöltési hiba:", err);
      startBtn.textContent = "Hiba a betöltésnél";
      alert("Nem sikerült betölteni a kérdéseket (questions.json). Kérlek frissítsd az oldalt.");
      // ha szeretnéd, itt is visszaengedheted, de alapértelmezetten tiltva hagyjuk
    });

  // ... itt mehet tovább a kódod (gomb listenerek, stb.) ...
});
  


  
  // ======= Kérdésbank (18 kérdés) =======
  const allQuestions = [
    {q:"Melyik utca szerepelt a legtöbbször?",a:["Kazinczy u.","Erzsébet körút","Kertész u.","Wesselényi u."],correct:1},
    {q:"Melyik évben volt a legtöbb látogatásod?",a:["2018","2019","2023","2024"],correct:2},
    {q:"Melyik hónap volt a legerősebb?",a:["Április","Július","Október","November"],correct:2},
    {q:"Melyik helyet látogattad a legtöbbször?",a:["Főbejárat","Krúdy","57-es italbolt","Bakegér"],correct:1},
    {q:"Melyik évben volt a legtöbb aktív utca?",a:["2018","2019","2023","2024"],correct:2},
    {q:"Melyik utca volt aktív 10 évben?",a:["Klauzál","Erzsébet körút","Dob","Tompa"],correct:1},
    {q:"Melyik kerület dominál?",a:["6.","7.","8.","9."],correct:1},
    {q:"Melyik a kocsma háromszög?",a:["Király–Kazinczy–Dob","Ráday–Mester–Tompa","Nagymező–Paulay–Andrássy","Üllői–Lónyay–Bakáts"],correct:0},
    {q:"Hány év telt el 2013–2026 között?",a:["8","10","12","13"],correct:3},
    {q:"Melyik utca 7 évben is szerepel?",a:["Klauzál","Wesselényi","Kazinczy","Ráday"],correct:1},
    {q:"Melyik évben volt a legkevesebb látogatás 2013 után?",a:["2015","2017","2021","2024"],correct:2},
    {q:"Melyik utcában van a legtöbb hely?",a:["József körút","Erzsébet körút","Wesselényi","Akácfa"],correct:1},
    {q:"Melyik hónap teljesen üres?",a:["Április","Október","Június","December"],correct:3},
    {q:"Mikor tértél vissza a Nagytemplom utcára?",a:["2020","2021","2022","2023"],correct:1},
    {q:"Mikor jelent meg először Bakáts környéke?",a:["2018","2019","2022","2024"],correct:2},
    {q:"Hányszor szerepel a Lónyay utca?",a:["1","2","3","4"],correct:1},
    {q:"Mi NEM szerepelt 2013-ban?",a:["Hunyadi tér","Rákóczi","Kazinczy","Ráday"],correct:3},
    {q:"Melyik évben volt a legtöbb új hely?",a:["2022","2023","2024","2025"],correct:2}
  ];

  // ======= Konstansok =======
  // const TOTAL   = 10;
  const LIMIT_MS = 15000; // 15 mp/kérdés
  let current = 0;        // jelenlegi kérdés index

  // ======= DOM =======
  const nameScreen   = document.getElementById("nameScreen");
  const adminScreen  = document.getElementById("adminScreen");
  const quizScreen   = document.getElementById("quizScreen");
  const resultScreen = document.getElementById("resultScreen");

  const startBtn     = document.getElementById("startBtn");
  const playerName   = document.getElementById("playerName");
  const clearBoardBtn= document.getElementById("clearBoardBtn");
  const backBtn      = document.getElementById("backBtn");

  const qNum      = document.getElementById("qNum");
  const qTotal    = document.getElementById("qTotal");
  const scoreView = document.getElementById("scoreView");
  const highView  = document.getElementById("highView");

  const timerBar  = document.getElementById("timerBar");
  const questionEl= document.getElementById("question");
  const answersEl = document.getElementById("answers");
  const resultText= document.getElementById("resultText");
  // const tableBody = document.getElementById("leaderTableBody"); // showAdminScreen / renderBoard helyben kérdezi le

  // ======= Segédfüggvények =======
  const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a,b) => a[0]-b[0]).map(x => x[1]);
  const pickRandom10 = () => shuffle(allQuestions).slice(0, TOTAL);

  // Timer
  let t0 = 0, rafId = null;
  function startTimer() {
    cancelAnimationFrame(rafId);
    t0 = performance.now();
    const tick = (now) => {
      const left = Math.max(0, LIMIT_MS - (now - t0));
      timerBar.style.width = `${(left / LIMIT_MS) * 100}%`;
      if (left <= 0) {
        lockAnswers();
        revealCorrect();          // idő lejárt → mutasd a helyeset
        setTimeout(nextQuestion, 600);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopTimer() { cancelAnimationFrame(rafId); }

  function lockAnswers() {
    answersEl.classList.add("disabled");
    answersEl.querySelectorAll("button").forEach(b => b.disabled = true);
  }
  function unlockAnswers() {
    answersEl.classList.remove("disabled");
    answersEl.querySelectorAll("button").forEach(b => b.disabled = false);
  }
  function revealCorrect(chosenIdx = null) {
    const q = questions[current];
    answersEl.querySelectorAll("button").forEach((btn, i) => {
      if (i === q.correct) btn.classList.add("correct");
      else if (chosenIdx !== null && i === chosenIdx) btn.classList.add("wrong");
    });
  }

  // ======= Admin (kmadmin) ======= — localStorage segédek (ha offline listát is akarsz)
  function loadBoard() {
    try { return JSON.parse(localStorage.getItem("kocsmakviz_leaderboard_v1") || "[]"); }
    catch { return []; }
  }
  function saveBoard(arr) {
    localStorage.setItem("kocsmakviz_leaderboard_v1", JSON.stringify(arr));
  }
  function renderBoard() {
    const tableBody = document.getElementById("leaderTableBody"); // HELYBEN kérdezzük le
    if (!tableBody) return;

    const board = loadBoard();
    if (!board.length) {
      tableBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Nincs még tárolt eredmény.</td></tr>`;
      return;
    }
    board.sort((a,b)=> (b.score - a.score) || a.name.localeCompare(b.name));
    tableBody.innerHTML = board.map((e, i) => {
      const d = e.playedAt ? new Date(e.playedAt) : new Date();
      const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} `
               + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `<tr>
        <td>${i+1}</td>
        <td>${e.name}</td>
        <td>${e.score}</td>
        <td>${e.total || TOTAL}</td>
        <td>${dt}</td>
      </tr>`;
    }).join("");
  }

  // 🔥 Firestore‑os admin betöltés
  async function showAdminScreen() {
    // UI váltás
    nameScreen.style.display   = "none";
    quizScreen.style.display   = "none";
    resultScreen.style.display = "none";
    adminScreen.style.display  = "block";

    const tableBody = document.getElementById("leaderTableBody");
    if (!tableBody) {
      console.warn("[Admin] Nincs #leaderTableBody a DOM-ban.");
      return;
    }

    tableBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Betöltés…</td></tr>`;

    try {
      const rows = await firestoreLoadLeaderboard();   // Firestore-ból jönnek a sorok
      if (!rows.length) {
        tableBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Nincs még tárolt eredmény.</td></tr>`;
        return;
      }

      const toDate = (p) => (p?.toDate ? p.toDate() : new Date(p || Date.now()));
      const fmt = (d) => {
        const Y=d.getFullYear(), M=String(d.getMonth()+1).padStart(2,'0'),
              D=String(d.getDate()).padStart(2,'0'), h=String(d.getHours()).padStart(2,'0'),
              m=String(d.getMinutes()).padStart(2,'0');
        return `${Y}-${M}-${D} ${h}:${m}`;
      };

      tableBody.innerHTML = rows.map((e, i) => {
        const d = toDate(e.playedAt);
        return `<tr>
          <td>${i+1}</td>
          <td>${e.name}</td>
          <td>${e.score}</td>
          <td>${e.total}</td>
          <td>${fmt(d)}</td>
        </tr>`;
      }).join("");
    } catch (e) {
      console.error("[Admin] betöltési hiba:", e);
      tableBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Hiba történt a betöltés közben.</td></tr>`;
    }
  }

  // ======= Start gomb =======
  startBtn.addEventListener("click", async () => {
    const name = (playerName.value || "").trim();
    if (!name) { alert("Kérlek add meg a neved!"); return; }

    // ADMIN mód
    if (name === "kmadmin") { showAdminScreen(); return; }

    // 5 próbálkozás limit névre – Firestore-ból
    const attempts = await firestoreCountAttempts(name);
    if (attempts >= 5) {
      alert("Ezzel a névvel elérted az 5 próbálkozás limitet. Töröld az eredménytáblát az új próbálkozáshoz.");
      return;
    }

    // Kvíz indul
    player = name;
    score = 0;
    current = 0;
    questions = pickRandom10();

    if (qTotal) qTotal.textContent = TOTAL;
    if (scoreView) scoreView.textContent = score;

    const high = Number(localStorage.getItem(HS_KEY) || 0);
    if (highView) highView.textContent = high;

    nameScreen.style.display   = "none";
    adminScreen.style.display  = "none";
    resultScreen.style.display = "none";
    quizScreen.style.display   = "block";

    showQuestion();
  });

  // ======= Admin gombok =======
  clearBoardBtn?.addEventListener("click", async () => {
    if (!confirm("Biztosan törlöd az összes eredményt?")) return;
    try {
      await firestoreClearLeaderboard(); // Firestore kiürítése
      await showAdminScreen();           // azonnali újratöltés Firestore-ból
      alert("Eredménytábla törölve.");
    } catch (e) {
      console.error("[Admin] törlés hiba:", e);
      alert("Hiba történt a törlés közben.");
    }
  });

  backBtn?.addEventListener("click", () => {
    adminScreen.style.display = "none";
    nameScreen.style.display  = "block";
  });

  // ======= Kérdés / válasz kezelése =======
  function showQuestion() {
    const q = questions[current];

    if (qNum) qNum.textContent = (current + 1).toString();
    questionEl.textContent = q.q;

    // válaszok keverése + helyes index újraszámolása
    const opts = q.a.map((text, idx) => ({ text, idx }));
    const shuffled = shuffle(opts);
    const newCorrect = shuffled.findIndex(o => o.idx === q.correct);
    q.correct = newCorrect;

    answersEl.innerHTML = shuffled
      .map((o,i)=> `<button class="answerBtn" data-id="${i}">${o.text}</button>`)
      .join("");

    unlockAnswers();
    answersEl.querySelectorAll(".answerBtn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        stopTimer();
        const chosen = Number(e.currentTarget.dataset.id);
        lockAnswers();
        if (chosen === q.correct) {
          score++;
          if (scoreView) scoreView.textContent = score;
        }
        revealCorrect(chosen);
        setTimeout(nextQuestion, 600);
      }, { passive:true });
    });

    startTimer();
  }

  function nextQuestion() {
    stopTimer();
    current++;
    if (current < questions.length) {
      showQuestion();
    } else {
      console.log("[NextQuestion] Vége – endGame() hívás következik, args:", { player, score, total: questions.length });
      endGame(player, score, questions.length); // PARAMÉTERREL hívjuk
    }
  }

  // --- Játék vége: mentés + UI frissítés (PARAMÉTERES) ---
  async function endGame(playerName, finalScore, totalQuestions) {
    // UI
    quizScreen.style.display = "none";
    resultScreen.style.display = "block";

    // Helyi (eszköz) rekord frissítése – védetten
    try {
      const high = Number(localStorage.getItem(HS_KEY) || 0);
      if (finalScore > high) localStorage.setItem(HS_KEY, String(finalScore));
      if (typeof highView !== "undefined" && highView) {
        highView.textContent = String(Math.max(finalScore, high));
      }
    } catch (e) {
      console.warn("[EndGame] High score frissítés kihagyva:", e);
    }

    // Firestore mentés (COMPAT)
    try {
      console.log("[EndGame] mentés indul", { playerName, finalScore, totalQuestions });
      await firestoreAddResult(playerName, finalScore, totalQuestions);
      console.log("[EndGame] Mentve Firestore-ba");
    } catch (e) {
      console.error("[EndGame] Mentési hiba:", e);
    }

    // Eredmény kiírás
    if (typeof resultText !== "undefined" && resultText) {
      resultText.innerHTML =
        `${playerName}, a pontszámod: <strong>${finalScore} / ${totalQuestions}</strong>`;
    }
  }
});


