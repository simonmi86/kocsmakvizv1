document.addEventListener("DOMContentLoaded", () => {

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
        {q:"Melyik évben volt a legkevesebb látogatás?",a:["2015","2017","2021","2024"],correct:2},
        {q:"Hol a legtöbb hely?",a:["József körút","Erzsébet körút","Wesselényi","Akácfa"],correct:1},
        {q:"Melyik hónap üres?",a:["Április","Október","Június","December"],correct:3},
        {q:"Mikor tértél vissza a Nagytemplomra?",a:["2020","2021","2022","2023"],correct:1},
        {q:"Mikor jelent meg Bakáts először?",a:["2018","2019","2022","2024"],correct:2},
        {q:"Hányszor szerepel a Lónyay?",a:["1","2","3","4"],correct:1},
        {q:"Mi NEM szerepelt 2013-ban?",a:["Hunyadi tér","Rákóczi","Kazinczy","Ráday"],correct:3},
        {q:"Melyik évben volt a legtöbb új hely?",a:["2022","2023","2024","2025"],correct:2}
    ];

    let questions = [];
    let player = "";
    let score = 0;
    let current = 0;

    function pickRandom10() {
        return [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 10);
    }

    document.getElementById("startBtn").addEventListener("click", () => {
        const name = document.getElementById("playerName").value.trim();
        if (!name) { alert("Kérlek add meg a neved!"); return; }

        player = name;
        score = 0;
        current = 0;
        questions = pickRandom10();

        document.getElementById("nameScreen").style.display = "none";
        document.getElementById("quizScreen").style.display = "block";

        showQuestion();
    });

    function showQuestion() {
        const q = questions[current];
        document.getElementById("question").innerText = q.q;

        let html = "";
        q.a.forEach((ans, idx) => {
            html += `<button class="answerBtn" data-id="${idx}">${ans}</button>`;
        });

        const answersDiv = document.getElementById("answers");
        answersDiv.innerHTML = html;

        document.querySelectorAll(".answerBtn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const chosen = parseInt(e.target.dataset.id);
                if (chosen === q.correct) score++;
                current++;
                if (current < questions.length) showQuestion();
                else endGame();
            });
        });
    }

    function endGame() {
        document.getElementById("quizScreen").style.display = "none";
        document.getElementById("resultScreen").style.display = "block";
        document.getElementById("resultText").innerHTML =
            `${player}, a pontszámod: <strong>${score} / ${questions.length}</strong>`;
    }

});