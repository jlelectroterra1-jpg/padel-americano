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
        `;
    });

    return html;
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
