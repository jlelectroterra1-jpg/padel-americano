


function generatePlayers(){


    const count = parseInt(
        document.getElementById("playerCount").value
    );

    const container =
        document.getElementById("players");

    container.innerHTML = "";

    for(let i=1;i<=count;i++){

      container.innerHTML += `
<div class="player-card">
    <h4>Player ${i}</h4>

    <label>Name</label>
    <input
        type="text"
        placeholder="Player ${i} Name"
        id="player${i}"
    >

    <label>Playtomic Rating</label>
    <input
        type="number"
        step="0.01"
        placeholder="e.g. 3.25"
        id="rating${i}"
    >
</div>
`;
    }
}



let tournamentPlayers = [];

let currentRound = 1;
let totalRounds = 0;
let targetScore = 21; 
let americanoRounds = [];

function getPlayerViewUrl(){
    const publicAppUrl =
        window.LIVE_CONFIG &&
        window.LIVE_CONFIG.publicAppUrl;

    if(publicAppUrl){
        return new URL(
            "player.html",
            publicAppUrl
        ).href;
    }

    return new URL(
        "player.html",
        window.location.href
    ).href;
}

function isLocalPlayerView(){
    const publicAppUrl =
        window.LIVE_CONFIG &&
        window.LIVE_CONFIG.publicAppUrl;

    if(publicAppUrl){
        return false;
    }

    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function getPlayerViewNote(){
    if(!isLocalPlayerView()){
        return "Share this with players so they can see the live leaderboard, current courts, and next round.";
    }

    return "This link is local to this computer. For phones, host the app online or use your computer network IP while everyone is on the same WiFi.";
}

function getQrCodeUrl(){
    return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(getPlayerViewUrl())}`;
}

async function copyPlayerLink(){
    const link =
        getPlayerViewUrl();

    if(navigator.clipboard){
        await navigator.clipboard.writeText(link);
        alert("Player leaderboard link copied.");
        return;
    }

    prompt("Copy this player leaderboard link:", link);
}

function getRoundCount(count){
    const totalPartnerships =
        count * (count - 1) / 2;

    return Math.ceil(totalPartnerships / 4);
}

function getCurrentRoundData(){
    return americanoRounds[currentRound - 1];
}

function getPairKey(playerA, playerB){
    return [playerA.name, playerB.name]
        .sort()
        .join("|");
}

function getRestingPlayers(players, pairs){
    const playingNames = new Set();

    pairs.forEach(pair=>{
        playingNames.add(pair[0].name);
        playingNames.add(pair[1].name);
    });

    return players.filter(player=>{
        return !playingNames.has(player.name);
    });
}

function createRound(players, pairs){
    return {
        resting: getRestingPlayers(players, pairs),
        pairs
    };
}

function findDisjointPair(pairs, pairToAvoid){
    return pairs.findIndex(pair=>{
        return !pair.includes(pairToAvoid[0]) &&
            !pair.includes(pairToAvoid[1]);
    });
}

function selectDisjointPairs(pairs, maxPairs){
    const selected = [];
    const usedPlayers = new Set();

    for(let i=0; i<pairs.length; i++){
        const pair = pairs[i];

        if(
            usedPlayers.has(pair[0].name) ||
            usedPlayers.has(pair[1].name)
        ){
            continue;
        }

        selected.push(i);
        usedPlayers.add(pair[0].name);
        usedPlayers.add(pair[1].name);

        if(selected.length === maxPairs){
            break;
        }
    }

    return selected;
}

function removeSelectedPairs(pairs, selectedIndexes){
    return pairs.filter((pair,index)=>{
        return !selectedIndexes.includes(index);
    });
}

function generateRoundRobinPartnerSchedule(players){
    const rotatingPlayers = [...players];
    const rounds = [];
    let pendingPairs = [];

    for(let round=0; round<players.length - 1; round++){
        const pairs = [];

        for(let i=0; i<players.length / 2; i++){
            pairs.push([
                rotatingPlayers[i],
                rotatingPlayers[players.length - 1 - i]
            ]);
        }

        let availablePairs = [
            ...pendingPairs,
            ...pairs
        ];

        pendingPairs = [];

        while(availablePairs.length >= 4){
            const selectedIndexes =
                selectDisjointPairs(availablePairs, 4);

            if(selectedIndexes.length < 4){
                break;
            }

            const roundPairs =
                selectedIndexes.map(index=>{
                    return availablePairs[index];
                });

            rounds.push(
                createRound(
                    players,
                    roundPairs
                )
            );

            availablePairs =
                removeSelectedPairs(
                    availablePairs,
                    selectedIndexes
                );
        }

        pendingPairs = availablePairs;

        const fixedPlayer =
            rotatingPlayers[0];

        const rest =
            rotatingPlayers.slice(1);

        rest.unshift(rest.pop());

        rotatingPlayers.splice(
            0,
            rotatingPlayers.length,
            fixedPlayer,
            ...rest
        );
    }

    while(pendingPairs.length > 0){
        const selectedIndexes =
            selectDisjointPairs(
                pendingPairs,
                Math.min(4,pendingPairs.length)
            );

        let finalPairs =
            selectedIndexes.map(index=>{
                return pendingPairs[index];
            });

        pendingPairs =
            removeSelectedPairs(
                pendingPairs,
                selectedIndexes
            );

        if(finalPairs.length % 2 !== 0){
            const finalRoundPlayers =
                new Set();

            finalPairs.forEach(pair=>{
                finalRoundPlayers.add(pair[0]);
                finalRoundPlayers.add(pair[1]);
            });

            const repeatPair =
                players.find(playerA=>{
                    return !finalRoundPlayers.has(playerA);
                });

            const repeatPartner =
                players.find(playerB=>{
                    return playerB !== repeatPair &&
                        !finalRoundPlayers.has(playerB);
                });

            finalPairs.push([
                repeatPair,
                repeatPartner
            ]);
        }

        rounds.push(
            createRound(
                players,
                finalPairs
            )
        );
    }

    return rounds;
}

function countUniquePartners(rounds){
    const partnerCounts = {};

    rounds.forEach(round=>{
        round.pairs.forEach(pair=>{
            const playerA = pair[0].name;
            const playerB = pair[1].name;

            if(!partnerCounts[playerA]){
                partnerCounts[playerA] = new Set();
            }

            if(!partnerCounts[playerB]){
                partnerCounts[playerB] = new Set();
            }

            partnerCounts[playerA].add(playerB);
            partnerCounts[playerB].add(playerA);
        });
    });

    return partnerCounts;
}

function publicRoundData(round){
    if(!round){
        return null;
    }

    const courts = [];
    const courtCount =
        Math.floor(round.pairs.length / 2);

    for(let court=0; court<courtCount; court++){
        const teamA =
            round.pairs[court * 2];
        const teamB =
            round.pairs[court * 2 + 1];

        courts.push({
            court:court + 1,
            teamA:teamA.map(player=>player.name),
            teamB:teamB.map(player=>player.name)
        });
    }

    return {
        resting:round.resting.map(player=>player.name),
        courts
    };
}

function getLeaderboardData(){
    return [...tournamentPlayers]
        .sort((a,b) => {
            const averageA =
                a.played > 0 ? a.points / a.played : 0;
            const averageB =
                b.played > 0 ? b.points / b.played : 0;

            if(averageB !== averageA){
                return averageB - averageA;
            }

            if(b.wins !== a.wins){
                return b.wins - a.wins;
            }

            const diffA =
                a.points - a.against;
            const diffB =
                b.points - b.against;

            if(diffB !== diffA){
                return diffB - diffA;
            }

            return b.points - a.points;
        })
        .map(player=>{
            const average =
                player.played > 0
                    ? (player.points / player.played).toFixed(1)
                    : "0.0";

            const diff =
                player.points - player.against;

            return {
                name:player.name,
                points:player.points,
                average,
                diff:diff > 0 ? `+${diff}` : diff,
                played:player.played,
                wins:player.wins,
                partners:`${player.partners.length}/${tournamentPlayers.length - 1}`
            };
        });
}

function getPublicTournamentState(){
    const isComplete =
        currentRound > totalRounds;

    return {
        currentRound:Math.min(currentRound,totalRounds),
        totalRounds,
        targetScore,
        isComplete,
        currentRoundData:publicRoundData(
            isComplete ? null : americanoRounds[currentRound - 1]
        ),
        nextRoundData:publicRoundData(
            isComplete ? null : americanoRounds[currentRound]
        ),
        leaderboard:getLeaderboardData()
    };
}

function publishTournamentState(){
    if(
        window.PadelLive &&
        americanoRounds.length > 0
    ){
        window.PadelLive.saveTournamentState(
            getPublicTournamentState()
        ).catch(error=>{
            console.warn(
                "Could not publish live tournament state",
                error
            );
        });
    }
}

function balanceTeamSides(rounds, players){
    const topSideCount = {};

    players.forEach(player=>{
        topSideCount[player.name] = 0;
    });

    rounds.forEach(round=>{
        const courtCount =
            Math.floor(round.pairs.length / 2);

        for(let court=0; court<courtCount; court++){
            const teamAIndex = court * 2;
            const teamBIndex = teamAIndex + 1;
            const teamA = round.pairs[teamAIndex];
            const teamB = round.pairs[teamBIndex];

            if(!teamA || !teamB) continue;

            const teamATopCount =
                topSideCount[teamA[0].name] +
                topSideCount[teamA[1].name];

            const teamBTopCount =
                topSideCount[teamB[0].name] +
                topSideCount[teamB[1].name];

            if(teamATopCount > teamBTopCount){
                round.pairs[teamAIndex] = teamB;
                round.pairs[teamBIndex] = teamA;
            }

            const topTeam = round.pairs[teamAIndex];

            topTeam.forEach(player=>{
                topSideCount[player.name]++;
            });
        }
    });

    return rounds;
}

function ensureEnoughRounds(rounds, players, neededRounds){
    const playCount = {};
    const partnerCount = {};
    const opponentCount = {};

    players.forEach(player=>{
        playCount[player.name] = 0;
        opponentCount[player.name] = {};
    });

    function pairKey(playerA, playerB){
        return [playerA.name, playerB.name]
            .sort()
            .join("|");
    }

    function updateHistory(round){
        round.pairs.forEach(pair=>{
            pair.forEach(player=>{
                playCount[player.name]++;
            });

            const key = pairKey(pair[0], pair[1]);
            partnerCount[key] =
                (partnerCount[key] || 0) + 1;
        });

        for(let i=0; i<round.pairs.length; i+=2){
            const teamA = round.pairs[i];
            const teamB = round.pairs[i + 1];

            if(!teamA || !teamB) continue;

            teamA.forEach(playerA=>{
                teamB.forEach(playerB=>{
                    opponentCount[playerA.name][playerB.name] =
                        (opponentCount[playerA.name][playerB.name] || 0) + 1;

                    opponentCount[playerB.name][playerA.name] =
                        (opponentCount[playerB.name][playerA.name] || 0) + 1;
                });
            });
        }
    }

    rounds.forEach(round=>{
        updateHistory(round);
    });

    while(rounds.length < neededRounds){
        const sortedPlayers =
            [...players].sort((a,b)=>{
                const diff =
                    playCount[a.name] - playCount[b.name];

                if(diff !== 0){
                    return diff;
                }

                return Math.random() - 0.5;
            });

        const playing =
            sortedPlayers.slice(0,8);

        const resting =
            sortedPlayers.slice(8);

        const available = [...playing];
        const pairs = [];

        while(available.length > 1){
            const p1 = available.shift();
            let bestPartnerIndex = 0;
            let bestScore = Number.POSITIVE_INFINITY;

            for(let i=0; i<available.length; i++){
                const p2 = available[i];
                const key = pairKey(p1, p2);

                const score =
                    ((partnerCount[key] || 0) * 100) +
                    ((opponentCount[p1.name][p2.name] || 0) * 10) +
                    Math.abs(playCount[p1.name] - playCount[p2.name]) +
                    Math.random();

                if(score < bestScore){
                    bestScore = score;
                    bestPartnerIndex = i;
                }
            }

            const p2 =
                available.splice(bestPartnerIndex,1)[0];

            pairs.push([p1,p2]);
        }

        const newRound = {
            resting,
            pairs
        };

        rounds.push(newRound);
        updateHistory(newRound);
    }

    return rounds;
}

/* ================================================================== rounds generation ============================================================== */
function generateAmericanoSchedule(players) {
    const count = players.length;

    if(count < 8 || count > 20 || count % 2 !== 0){
        alert("Please choose an even player count from 8 to 20.");
        return [];
    }

    return generateRoundRobinPartnerSchedule(players);
}

/* ================================================================== Create Tournament =============================================================== */
function createTournament(continueTournament = false){
    if (!continueTournament) {
        currentRound = 1;
        americanoRounds = [];
        tournamentPlayers = [];
    }

   const count =
    parseInt(
        document.getElementById("playerCount").value
    );

if(count < 8 || count > 20 || count % 2 !== 0){
    alert("Please choose an even player count from 8 to 20.");
    return;
}

    targetScore =
    count <= 8 ? 21 : 15;

    if (!continueTournament) {

for(let i=1;i<=count;i++){

    const playerName =
        document.getElementById(`player${i}`).value || `Player ${i}`;

    const playerRating =
        parseFloat(
            document.getElementById(`rating${i}`).value
        ) || 0;

    tournamentPlayers.push({
        name: playerName,
        rating: playerRating,
        points: 0,
        against: 0,
        played: 0,
        wins: 0,
        partners: []
    });
}
}

/* ================================================================== Rounds generation ============================================================== */
if (americanoRounds.length === 0) {
    americanoRounds =
        generateAmericanoSchedule(tournamentPlayers);

    americanoRounds =
        balanceTeamSides(
            americanoRounds,
            tournamentPlayers
        );

    console.log(
        "Unique partner counts:",
        Object.fromEntries(
            Object.entries(
                countUniquePartners(americanoRounds)
            ).map(([name, partners])=>{
                return [name, partners.size];
            })
        )
    );
}

totalRounds = americanoRounds.length;

/* ================================================================== Tournament info box ============================================================== */
let pairingsHTML = `
<section class="tournament-info">
    <h3>Tournament Info</h3>

    <div class="stat-grid">
        <div class="stat">
            <span>Players</span>
            <strong>${count}</strong>
        </div>
        <div class="stat">
            <span>Rounds</span>
            <strong>${totalRounds}</strong>
        </div>
        <div class="stat">
            <span>Target</span>
            <strong>${targetScore}</strong>
        </div>
        <div class="stat">
            <span>Serving</span>
            <strong>${targetScore === 21
                ? "5 / 5 / 5 / 6"
                : "4 / 4 / 4 / 3"}</strong>
        </div>
    </div>
</section>

<section class="share-panel">
    <div>
        <h3>Player Live View</h3>
        <p>${getPlayerViewNote()}</p>
        <a href="${getPlayerViewUrl()}" target="_blank">${getPlayerViewUrl()}</a>
        <button type="button" onclick="copyPlayerLink()">Copy Player Link</button>
    </div>
    <img
        src="${getQrCodeUrl()}"
        alt="QR code for player live view">
</section>

<h3 class="section-title">Pairings</h3>
`;

if(currentRound > totalRounds){
    document.getElementById("pairings").innerHTML = `
    <div class="card">
        <h3>Tournament Complete</h3>
        <p>All ${totalRounds} rounds have been completed.</p>
    </div>
    `;
    renderScores();
    updateLeaderboard();
    publishTournamentState();
    showTab("leaderboard");
    return;
}

for(let round=currentRound; round<=currentRound; round++){

    pairingsHTML += `<section class="round-panel">`;
    pairingsHTML += `<h4>Round ${round}</h4>`;

const currentRound = americanoRounds[round - 1];

pairingsHTML += `
<p class="resting-line">
    <strong>Resting:</strong>
    ${currentRound.resting.map(p => p.name).join(", ") || "No resting players"}
</p>
`;

const courtCount =
    Math.floor(currentRound.pairs.length / 2);

for(let court=0; court<courtCount; court++){

    const team1 = currentRound.pairs[court * 2];
    const team2 = currentRound.pairs[court * 2 + 1];
pairingsHTML += `
<div class="court-card">

    <div class="court-title">
        Court ${court+1}
    </div>

    <div class="team">
        ${team1[0].name} & ${team1[1].name}
    </div>

    <div class="vs">
        VS
    </div>

    <div class="team">
        ${team2[0].name} & ${team2[1].name}
    </div>

</div>
`;
}

pairingsHTML += `</section>`;

}


document.getElementById("pairings").innerHTML = pairingsHTML;
renderScores();
updateLeaderboard();
publishTournamentState();


showTab('pairings');

document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.remove("active");
});

document.querySelectorAll(".tab")[1].classList.add("active");
}
/* ============================================================================== TABS =============================================================== */
function showTab(tabName){

    document.getElementById("setupTab").style.display = "none";
    document.getElementById("pairingsTab").style.display = "none";
    document.getElementById("scoresTab").style.display = "none";
    document.getElementById("leaderboardTab").style.display = "none";

    document.getElementById(tabName + "Tab").style.display = "block";

    document.querySelectorAll(".tab").forEach(tab=>{
        tab.classList.remove("active");
    });

    const clickedTab =
        typeof event !== "undefined" &&
        event.target &&
        event.target.classList.contains("tab")
            ? event.target
            : document.querySelector(
                `button[onclick="showTab('${tabName}')"]`
            );

    if(clickedTab){
        clickedTab.classList.add("active");
    }
}

function renderScores(){

    const scoresContainer =
        document.getElementById("scores");

    if(!scoresContainer){
        return;
    }

    if(americanoRounds.length === 0){
    scoresContainer.innerHTML =
            `<div class="empty-state">Generate a tournament first...</div>`;
        return;
    }

    if(currentRound > totalRounds){
        scoresContainer.innerHTML = `
        <div class="score-summary">
            <p><strong>Tournament Complete</strong></p>
            <p>All ${totalRounds} rounds have been completed.</p>
        </div>
        `;
        return;
    }

    const roundData =
        getCurrentRoundData();

    if(!roundData){
        scoresContainer.innerHTML = `
        <div class="score-summary">
            <p><strong>Tournament Complete</strong></p>
            <p>No more rounds are available.</p>
        </div>
        `;
        return;
    }

    const roundsLeftAfterSubmit =
        totalRounds - currentRound;

    let scoresHTML = `
    <div class="score-summary">
        <div class="stat-grid">
            <div class="stat">
                <span>Current Round</span>
                <strong>${currentRound} of ${totalRounds}</strong>
            </div>
            <div class="stat">
                <span>Rounds Left</span>
                <strong>${roundsLeftAfterSubmit}</strong>
            </div>
            <div class="stat">
                <span>Target</span>
                <strong>${targetScore}</strong>
            </div>
        </div>
    </div>
    `;

    const courtCount =
        Math.floor(roundData.pairs.length / 2);

    for(let court=0; court<courtCount; court++){

        const team1 = roundData.pairs[court * 2];
        const team2 = roundData.pairs[court * 2 + 1];

        scoresHTML += `
        <div class="court-card">
            <div class="court-title">
                Court ${court + 1}
            </div>

            <div class="team">
                ${team1[0].name} & ${team1[1].name}

                <input
                    type="number"
                    class="score-input"
                    id="r${currentRound}c${court}a"
                    min="0"
                    max="${targetScore}"
                    placeholder="Score">
            </div>

            <div class="vs">
                VS
            </div>

            <div class="team">
                ${team2[0].name} & ${team2[1].name}

                <input
                    type="number"
                    class="score-input"
                    id="r${currentRound}c${court}b"
                    min="0"
                    max="${targetScore}"
                    placeholder="Score">
            </div>
        </div>
        `;
    }

    const nextRoundData =
        americanoRounds[currentRound];

    if(nextRoundData){
        const nextCourtCount =
            Math.floor(nextRoundData.pairs.length / 2);

        scoresHTML += `
        <div class="next-round-preview">
            <div class="preview-title">
                Next Round Preview
                <span>Round ${currentRound + 1} of ${totalRounds}</span>
            </div>
            <p>Use this to get players ready while the current round scores are being collected.</p>
        `;

        for(let court=0; court<nextCourtCount; court++){
            const team1 =
                nextRoundData.pairs[court * 2];
            const team2 =
                nextRoundData.pairs[court * 2 + 1];

            scoresHTML += `
            <div class="preview-court">
                <strong>Court ${court + 1}</strong>
                <span>${team1[0].name} & ${team1[1].name}</span>
                <em>vs</em>
                <span>${team2[0].name} & ${team2[1].name}</span>
            </div>
            `;
        }

        scoresHTML += `</div>`;
    }

    scoresHTML += `
    <button onclick="submitRound(${currentRound})">
        Submit Round ${currentRound}
    </button>
    `;

    scoresContainer.innerHTML = scoresHTML;
}

function updateLeaderboard(){

    let html = `
    <h3 class="section-title">Leaderboard</h3>
    <div class="leaderboard-note">
        Ranked by average points per game. Each player receives their team's score for the match.
    </div>
    `;

    const sortedPlayers =
        [...tournamentPlayers]
        .sort((a,b) => {
            const averageA =
                a.played > 0 ? a.points / a.played : 0;
            const averageB =
                b.played > 0 ? b.points / b.played : 0;

            if(averageB !== averageA){
                return averageB - averageA;
            }

            if(b.wins !== a.wins){
                return b.wins - a.wins;
            }

            const diffA =
                a.points - a.against;
            const diffB =
                b.points - b.against;

            if(diffB !== diffA){
                return diffB - diffA;
            }

            return b.points - a.points;
        });

    sortedPlayers.forEach((player,index)=>{
        const average =
            player.played > 0
                ? (player.points / player.played).toFixed(1)
                : "0.0";

        const pointDiff =
            player.points - player.against;

        const diffLabel =
            pointDiff > 0
                ? `+${pointDiff}`
                : pointDiff;

        html += `
        <div class="leaderboard-row">
            <div class="rank">${index + 1}</div>
            <div class="leaderboard-player">
                <strong>${player.name}</strong>
                <span>Partners ${player.partners.length}/${tournamentPlayers.length - 1}</span>
            </div>
            <div class="leaderboard-stat">
                <span>Total Points</span>
                <strong>${player.points}</strong>
            </div>
            <div class="leaderboard-stat">
                <span>Avg/Game</span>
                <strong>${average}</strong>
            </div>
            <div class="leaderboard-stat">
                <span>+/-</span>
                <strong>${diffLabel}</strong>
            </div>
            <div class="leaderboard-stat">
                <span>Played</span>
                <strong>${player.played}</strong>
            </div>
            <div class="leaderboard-stat">
                <span>Wins</span>
                <strong>${player.wins}</strong>
            </div>
        </div>
        `;
    });

    document.getElementById("leaderboard").innerHTML = html;
}
/* =========================================================================== Submit and score check ================================================== */
function submitRound(round){

    const roundData =
        americanoRounds[round - 1];

    if(!roundData || round > totalRounds){
        alert("Tournament complete. No more rounds to submit.");
        showTab("leaderboard");
        return;
    }

    const courts =
        document.querySelectorAll(
            `input[id^="r${round}c"]`
        );

    for(let i=0; i<courts.length; i+=2){

        const scoreA =
            parseInt(courts[i].value) || 0;

        const scoreB =
            parseInt(courts[i+1].value) || 0;

        if(scoreA + scoreB !== targetScore){

            alert(
                `Scores must add up to ${targetScore}`
            );

            return;
        }

        const courtIndex = i / 2;
        const teamA =
            roundData.pairs[courtIndex * 2];
        const teamB =
            roundData.pairs[courtIndex * 2 + 1];

        teamA.forEach(player=>{
            player.points += scoreA;
            player.against += scoreB;
            player.played++;
        });

        teamB.forEach(player=>{
            player.points += scoreB;
            player.against += scoreA;
            player.played++;
        });

        if(!teamA[0].partners.includes(teamA[1].name)){
            teamA[0].partners.push(teamA[1].name);
        }

        if(!teamA[1].partners.includes(teamA[0].name)){
            teamA[1].partners.push(teamA[0].name);
        }

        if(!teamB[0].partners.includes(teamB[1].name)){
            teamB[0].partners.push(teamB[1].name);
        }

        if(!teamB[1].partners.includes(teamB[0].name)){
            teamB[1].partners.push(teamB[0].name);
        }

        if(scoreA > scoreB){
            teamA.forEach(player=>{
                player.wins++;
            });
        }

        if(scoreB > scoreA){
            teamB.forEach(player=>{
                player.wins++;
            });
        }
    }

if(round >= totalRounds){
    alert(
        `Round ${round} complete!\n\nTournament complete!`
    );

    currentRound++;
    createTournament(true);
    showTab("leaderboard");
    return;
}

alert(
    `Round ${round} complete!\n\nProceeding to Round ${round + 1}`
);

currentRound++;

createTournament(true);
showTab("scores");
}

generatePlayers();
