
// High score kulcs (helyi, eszközön tárolt rekordhoz)
const HS_KEY = "kocsmakviz_highscore";


// ========== Firestore: leaderboard lekérdezés (COMPAT) ==========
async function firestoreLoadLeaderboard() {
  try {
    // 1) Lekérdezés összeállítása
    //    Elsődleges rendezés: score DESC
    //    (opcionális) másodlagos rendezés: playedAt DESC – ha szeretnéd, vedd fel második orderBy-ként
    let queryRef = db.collection("leaderboard").orderBy("score", "desc");
    // Ha szeretnél másodlagos rendezést is:
    // queryRef = queryRef.orderBy("playedAt", "desc"); // ha van index hozzá

    // 2) Lekérdezés futtatása
    const snap = await queryRef.get();

    // 3) Átalakítás JS tömbbé
    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      rows.push({
        name:  d.name  ?? "",
        score: Number(d.score) || 0,
        total: Number(d.total) || 0,
        playedAt: d.playedAt ?? null   // lehet Date vagy Firestore Timestamp – formázd megjelenítéskor
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
      name,
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

 // --- Játék vége: mentés + UI frissítés ---

async function endGame() {
  quizScreen.style.display = "none";
  resultScreen.style.display = "block";

  // Helyi (eszköz) rekord frissítés – védetten
  try {
    const highRaw = localStorage.getItem(HS_KEY);
    const high = Number(highRaw || 0);
    if (score > high) localStorage.setItem(HS_KEY, String(score));
    if (typeof highView !== "undefined" && highView) {
      highView.textContent = String(Math.max(score, high));
    }
  } catch (e) {
    console.warn("[EndGame] High score frissítés kihagyva:", e);
  }

  // Firestore mentés
  try {
    await firestoreAddResult(player, score, questions.length);
    console.log("[EndGame] Mentve Firestore-ba");
  } catch (e) {
    console.error("[EndGame] Mentési hiba:", e);
  }

  if (typeof resultText !== "undefined" && resultText) {
    resultText.innerHTML = `${player}, a pontszámod: <strong>${score} / ${questions.length}</strong>`;
  }
}
window.endGame = endGame;




document.addEventListener("DOMContentLoaded", () => {
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

  // ======= Konstansok (storage kulcsok) =======
  const HS_KEY     = "kocsmakviz_highscore";           // eszköz-rekord
  const LEADER_KEY = "kocsmakviz_leaderboard_v1";      // eredménytábla

  // ======= Állapot =======
  const TOTAL   = 10;
  const LIMIT_MS = 15000; // 15 mp/kérdés
  let questions = [];
  let player = "";
  let score = 0;
  let current = 0;

  // Timer
  let t0 = 0, rafId = null;

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
  const tableBody = document.getElementById("leaderTableBody");

  // ======= Storage segédfüggvények =======
  const loadBoard = () => {
    try { return JSON.parse(localStorage.getItem(LEADER_KEY) || "[]"); }
    catch { return []; }
  };
  const saveBoard = (arr) => localStorage.setItem(LEADER_KEY, JSON.stringify(arr));

  // DUPLA NÉV TILTÁS TÖRÖLVE → mindig felvesszük az eredményt időbélyeggel
  const addResult = (name, pts, total) => {
    const board = loadBoard();
    const entry = {
      name: String(name || "").trim(),
      score: Number(pts) || 0,
      total: Number(total) || TOTAL,
      // ISO időbélyeg – ezt tesszük el, megőrizve a „mikor történt” információt
      playedAt: new Date().toISOString()
    };
    board.push(entry);
    // Rendezés: pont (desc), majd név ABC
    board.sort((a,b)=> (b.score - a.score) || a.name.localeCompare(b.name));
    saveBoard(board);
  };

  // ======= Kvíz segédfüggvények =======
  const shuffle = arr => arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  const pickRandom10 = () => shuffle(allQuestions).slice(0, TOTAL);

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

  // ======= Admin nézet (kmadmin) =======
  function showAdminScreen() {
    nameScreen.style.display   = "none";
    quizScreen.style.display   = "none";
    resultScreen.style.display = "none";
    adminScreen.style.display  = "block";
    renderBoard();
  }

  function renderBoard() {
    const board = loadBoard();
    if (!tableBody) return;
    if (!board.length) {
      tableBody.innerHTML = `<tr><td colspan="5" style="opacity:.8">Nincs még tárolt eredmény.</td></tr>`;
      return;
    }
    // Rendezés (biztonságból újra): pont desc, név ABC
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

  // ======= Start gomb =======
startBtn.addEventListener("click", () => {
    const name = (playerName.value || "").trim();
    if (!name) { 
        alert("Kérlek add meg a neved!"); 
        return; 
    }

    // ---- ADMIN mód ----
    if (name === "kmadmin") {
        showAdminScreen();
        return;
    }

    // ---- 5 próbálkozás limit névre ----
    const board = loadBoard();
    const attempts = board.filter(e => e.name.toLowerCase() === name.toLowerCase()).length;

    if (attempts >= 5) {
        alert("Ezzel a névvel elérted az 5 próbálkozás limitet. "
            + "Töröld az eredménytáblát az új próbálkozáshoz.");
        return;
    }

    // ---- Kvíz indul ----
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
  clearBoardBtn?.addEventListener("click", () => {
    if (confirm("Biztosan törlöd az összes eredményt?")) {
      saveBoard([]);
      renderBoard();
      alert("Eredménytábla törölve.");
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

    answersEl.innerHTML = shuffled.map((o,i)=>
      `<button class="answerBtn" data-id="${i}">${o.text}</button>`
    ).join("");

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
    if (current < questions.length) showQuestion();
    else  endGame(); 
  }


 console.log("[NextQuestion] Vége – endGame() hívás következik");
 endGame();

  
 /* function endGame() {
    quizScreen.style.display = "none";
    resultScreen.style.display = "block";

    // eszköz-rekord frissítése
    const high = Number(localStorage.getItem(HS_KEY) || 0);
    if (score > high) localStorage.setItem(HS_KEY, String(score));
    if (highView) highView.textContent = Math.max(score, high);

    // Eredmény mentése (NINCS dupla név tiltás) + időbélyeg eltárolása
    addResult(player, score, questions.length);

    const rank = score >= 9 ? "Elit kocsma‑matematikus 🍻"
               : score >= 7 ? "Haladó túraszakértő 🍺"
               : score >= 5 ? "Rutin kocsmaturista 🍻"
               : "Kezdő felfedező 🍺";

    resultText.innerHTML =
      `${player}, a pontszámod: <strong>${score} / ${questions.length}</strong><br>` +
      `Rangod: <strong>${rank}</strong><br>` +
      `Eredményed mentve az eredménytáblára.`;
  } */
});










