function renderPublicRound(title, round, type){
    if(!round){
        return "";
    }

    let html = `
    <section class="round-panel public-round ${type || ""}">
        <h4>${title}</h4>
        <p class="resting-line">
            <strong>Resting:</strong>
            ${round.resting.length ? round.resting.join(", ") : "No resting players"}
        </p>
    `;

    round.courts.forEach(court=>{
        html += `
        <div class="court-card">
            <div class="court-title">Court ${court.court}</div>
            <div class="team">${court.teamA.join(" & ")}</div>
            <div class="vs">VS</div>
            <div class="team">${court.teamB.join(" & ")}</div>
        </div>
        `;
    });

    html += `</section>`;

    return html;
}

function renderPublicLeaderboard(players){
    if(!players || players.length === 0){
        return `<div class="empty-state">No leaderboard yet.</div>`;
    }

    let html = `
    <h3 class="section-title">Leaderboard</h3>
    `;

    players.forEach((player,index)=>{
        html += `
        <div class="leaderboard-row">
            <div class="rank">${index + 1}</div>
            <div class="leaderboard-player">
                <strong>${player.name}</strong>
                <span>Partners ${player.partners}</span>
            </div>
            <div class="leaderboard-stats">
                <div class="leaderboard-stat">
                    <span>Total Points</span>
                    <strong>${player.points}</strong>
                </div>
                <div class="leaderboard-stat">
                    <span>Avg/Game</span>
                    <strong>${player.average}</strong>
                </div>
                <div class="leaderboard-stat">
                    <span>+/-</span>
                    <strong>${player.diff}</strong>
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
        </div>
        `;
    });

    return html;
}

let compactMode = false;

function toggleCompactView(){
    compactMode = !compactMode;

    document.body.classList.toggle(
        "compact-mode",
        compactMode
    );

    refreshPlayerView();
}

function renderCompactPublicLeaderboard(state){
    const players = state.leaderboard || [];

    const listClass =
        players.length > 10
            ? "compact-list two-col"
            : "compact-list";

    let rows = "";

    players.forEach((player, index)=>{
        rows += `
        <div class="compact-row">
            <span class="compact-rank">${index + 1}</span>
            <span class="compact-name">${player.name}</span>
            <span class="compact-avg">${player.average}</span>
            <span class="compact-wins">${player.wins}W</span>
        </div>
        `;
    });

    const statusLabel =
        state.isComplete
            ? `${state.totalRounds} rounds played`
            : `Standings after Round ${Math.max(state.currentRound - 1, 0)} of ${state.totalRounds}`;

    return `
    <div class="compact-summary-header">
        <h2>${state.isComplete ? "🏆 Final Standings" : "Standings"}</h2>
        <p>${statusLabel}</p>
    </div>
    <div class="compact-exit-row">
        <button type="button" class="ghost-button" onclick="toggleCompactView()">
            Exit Compact View
        </button>
    </div>
    <div class="${listClass}">
        ${rows}
    </div>
    `;
}

async function refreshPlayerView(){
    let state = null;

    try{
        state =
            await window.PadelLive.loadTournamentState();
    } catch(error){
        document.getElementById("playerStatus").textContent =
            `Live connection error: ${error.message}`;
        return;
    }

    if(!state){
        document.getElementById("playerStatus").textContent =
            "Waiting for the organiser to generate a tournament.";
        return;
    }

    document.getElementById("playerStatus").textContent =
        state.isComplete
            ? `Tournament complete - Updated ${new Date(state.updatedAt).toLocaleTimeString()}`
            : `Round ${state.currentRound} of ${state.totalRounds} - Updated ${new Date(state.updatedAt).toLocaleTimeString()}`;

    if(compactMode){
        document.getElementById("playerCurrentRound").innerHTML = "";
        document.getElementById("playerNextRound").innerHTML = "";
        document.getElementById("playerLeaderboard").innerHTML =
            renderCompactPublicLeaderboard(state);

        return;
    }

    document.getElementById("playerCurrentRound").innerHTML =
        state.isComplete
            ? ""
            : renderPublicRound("Current Round", state.currentRoundData, "current-public-round");

    document.getElementById("playerNextRound").innerHTML =
        state.isComplete
            ? ""
            : renderPublicRound("Next Round", state.nextRoundData, "next-public-round");

    document.getElementById("playerLeaderboard").innerHTML =
        renderPublicLeaderboard(state.leaderboard);
}

refreshPlayerView();
setInterval(refreshPlayerView, 3000);
