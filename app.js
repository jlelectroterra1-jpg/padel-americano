


function getTournamentFormat(){
    const select =
        document.getElementById("tournamentFormat");

    return select ? select.value : "singles";
}

const COURT_COUNT_STORAGE_KEY = "padel-americano:preferredCourtCount";

function getMaxCourts(count){
    return Math.max(1, Math.floor(count / 4));
}

function refreshCourtOptions(){
    const count = parseInt(
        document.getElementById("playerCount").value
    );

    const select =
        document.getElementById("courtCount");

    if(!select || isNaN(count)){
        return;
    }

    const maxCourts =
        getMaxCourts(count);

    const savedValue =
        parseInt(localStorage.getItem(COURT_COUNT_STORAGE_KEY)) || null;

    select.innerHTML = "";

    for(let courts=1; courts<=maxCourts; courts++){
        const option =
            document.createElement("option");

        option.value = courts;
        option.textContent = courts;
        select.appendChild(option);
    }

    /*
     * Always prefer the saved preference over the previous DOM value
     * - the old select value is just leftover from whatever player
     * count was showing a moment ago, not something the user chose
     * for THIS count, so it shouldn't take priority.
     */
    select.value =
        savedValue && savedValue <= maxCourts
            ? savedValue
            : maxCourts;
}

function saveCourtCountPreference(){
    const select =
        document.getElementById("courtCount");

    if(!select){
        return;
    }

    localStorage.setItem(COURT_COUNT_STORAGE_KEY, select.value);
}

function getCourtCount(){
    const select =
        document.getElementById("courtCount");

    return select ? parseInt(select.value) || 1 : 1;
}

function playerFieldHtml(index, useRatings){
    return `
<div class="player-card">
    <h4>Player ${index}</h4>

    <label>Name</label>
    <input
        type="text"
        placeholder="Player ${index} Name"
        id="player${index}"
    >

    <div class="rating-field" style="${useRatings ? "" : "display:none;"}">
    <label>Playtomic Rating</label>
    <input
        type="number"
        step="0.01"
        placeholder="e.g. 3.25"
        id="rating${index}"
    >
    </div>
</div>
`;
}

function updateCourtCountVisibility(){
    const isKotc =
        getTournamentFormat() === "kotc";

    const courtGroup =
        document.getElementById("courtCountGroup");

    const kotcNote =
        document.getElementById("kotcCourtNote");

    if(courtGroup){
        courtGroup.style.display = isKotc ? "none" : "block";
    }

    if(kotcNote){
        kotcNote.style.display = isKotc ? "block" : "none";
    }
}

function generatePlayers(){

    const count = parseInt(
        document.getElementById("playerCount").value
    );

    refreshCourtOptions();
    updateCourtCountVisibility();

    const container =
        document.getElementById("players");

    container.innerHTML = "";

    const useRatings =
        shouldUsePlaytomicRatings();

    if(getTournamentFormat() === "teams"){
        for(let team=0; team<count / 2; team++){
            const playerA = team * 2 + 1;
            const playerB = team * 2 + 2;

            container.innerHTML += `
<div class="team-card">
    <h4>Team ${team + 1}</h4>
    <div class="team-players">
        ${playerFieldHtml(playerA, useRatings)}
        ${playerFieldHtml(playerB, useRatings)}
    </div>
</div>
`;
        }

        return;
    }

    for(let i=1;i<=count;i++){
        container.innerHTML += playerFieldHtml(i, useRatings);
    }
}

function shouldUsePlaytomicRatings(){
    const checkbox =
        document.getElementById("usePlaytomicRatings");

    return Boolean(checkbox && checkbox.checked);
}

function togglePlaytomicRatings(){
    const useRatings =
        shouldUsePlaytomicRatings();

    document.querySelectorAll(".rating-field").forEach(field=>{
        field.style.display =
            useRatings ? "block" : "none";
    });
}



let tournamentPlayers = [];
let tournamentFormat = "singles";
let courtCount = 1;

let currentRound = 1;
let totalRounds = 0;
let targetScore = 21;
let americanoRounds = [];
let kotcPartnerCounts = {};

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

/*
 * Scheduler design (replaces the old partner-only round robin):
 * every round fills as many courts as the player count allows
 * (floor(count/4), instead of a hardcoded 2), and both who partners
 * whom AND who ends up on the opposing team are chosen by greedily
 * minimising repeat history, not by array order. Several randomised
 * attempts are generated and the most evenly balanced one is kept.
 */

function choosePlayingPlayers(players, playCount, playersNeeded){
    const shuffled =
        [...players].sort(()=> Math.random() - 0.5);

    shuffled.sort((a,b)=>{
        return playCount[a.name] - playCount[b.name];
    });

    return shuffled.slice(0, playersNeeded);
}

function formPartnerships(playingPlayers, partnerCount){
    const available =
        [...playingPlayers].sort(()=> Math.random() - 0.5);

    const pairs = [];

    while(available.length > 1){
        const playerA = available.shift();

        let bestIndex = 0;
        let bestScore = Number.POSITIVE_INFINITY;

        for(let i=0; i<available.length; i++){
            const playerB = available[i];
            const key = getPairKey(playerA, playerB);

            const score =
                (partnerCount[key] || 0) + Math.random() * 0.01;

            if(score < bestScore){
                bestScore = score;
                bestIndex = i;
            }
        }

        const playerB =
            available.splice(bestIndex, 1)[0];

        pairs.push([playerA, playerB]);
    }

    return pairs;
}

function opponentScore(pairA, pairB, opponentCount){
    let score = 0;

    pairA.forEach(playerA=>{
        pairB.forEach(playerB=>{
            score += opponentCount[playerA.name][playerB.name] || 0;
        });
    });

    return score;
}

function assignCourts(pairs, opponentCount){
    const available =
        [...pairs].sort(()=> Math.random() - 0.5);

    const ordered = [];

    while(available.length > 1){
        const pairA = available.shift();

        let bestIndex = 0;
        let bestScore = Number.POSITIVE_INFINITY;

        for(let i=0; i<available.length; i++){
            const score =
                opponentScore(pairA, available[i], opponentCount) +
                Math.random() * 0.01;

            if(score < bestScore){
                bestScore = score;
                bestIndex = i;
            }
        }

        const pairB =
            available.splice(bestIndex, 1)[0];

        ordered.push(pairA, pairB);
    }

    return ordered;
}

function recordRoundHistory(round, courts, playCount, partnerCount, opponentCount){
    round.pairs.forEach(pair=>{
        pair.forEach(player=>{
            playCount[player.name]++;
        });

        const key = getPairKey(pair[0], pair[1]);
        partnerCount[key] = (partnerCount[key] || 0) + 1;
    });

    for(let court=0; court<courts; court++){
        const teamA = round.pairs[court * 2];
        const teamB = round.pairs[court * 2 + 1];

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

function buildScheduleAttempt(players, courts, playersPerRound, totalRounds){
    const playCount = {};
    const partnerCount = {};
    const opponentCount = {};

    players.forEach(player=>{
        playCount[player.name] = 0;
        opponentCount[player.name] = {};
    });

    const rounds = [];

    for(let i=0; i<totalRounds; i++){
        const playing =
            choosePlayingPlayers(players, playCount, playersPerRound);

        const pairs =
            formPartnerships(playing, partnerCount);

        const courtOrder =
            assignCourts(pairs, opponentCount);

        const round =
            createRound(players, courtOrder);

        recordRoundHistory(
            round,
            courts,
            playCount,
            partnerCount,
            opponentCount
        );

        rounds.push(round);
    }

    return rounds;
}

function scheduleQuality(rounds, players){
    const opponentCount = {};
    const partnerCount = {};

    players.forEach(player=>{
        opponentCount[player.name] = {};
        partnerCount[player.name] = {};
    });

    let maxRepeat = 0;
    let sumSquares = 0;
    let maxPartnerRepeat = 0;
    let partnerSumSquares = 0;

    rounds.forEach(round=>{
        const courtCount =
            Math.floor(round.pairs.length / 2);

        round.pairs.forEach(pair=>{
            const count =
                (partnerCount[pair[0].name][pair[1].name] || 0) + 1;

            partnerCount[pair[0].name][pair[1].name] = count;
            partnerCount[pair[1].name][pair[0].name] = count;

            maxPartnerRepeat = Math.max(maxPartnerRepeat, count);
        });

        for(let court=0; court<courtCount; court++){
            const teamA = round.pairs[court * 2];
            const teamB = round.pairs[court * 2 + 1];

            if(!teamA || !teamB) continue;

            teamA.forEach(playerA=>{
                teamB.forEach(playerB=>{
                    const count =
                        (opponentCount[playerA.name][playerB.name] || 0) + 1;

                    opponentCount[playerA.name][playerB.name] = count;
                    opponentCount[playerB.name][playerA.name] = count;

                    maxRepeat = Math.max(maxRepeat, count);
                });
            });
        }
    });

    players.forEach(player=>{
        Object.values(opponentCount[player.name]).forEach(count=>{
            sumSquares += count * count;
        });

        Object.values(partnerCount[player.name]).forEach(count=>{
            partnerSumSquares += count * count;
        });
    });

    return {maxRepeat, sumSquares, maxPartnerRepeat, partnerSumSquares};
}

function generateBalancedSchedule(players, courts, attempts = 250){
    const count = players.length;

    const playersPerRound = courts * 4;

    const totalPartnerships = count * (count - 1) / 2;
    const partnershipsPerRound = courts * 2;

    /*
     * Rounding DOWN (rather than up) keeps rounds within the
     * partnership budget whenever count doesn't divide evenly - going
     * one round over that budget forces at least one repeat partner
     * that would otherwise be avoidable (e.g. 10 players: 12 rounds
     * needs 48 partner-slots for only 45 possible pairs, guaranteeing
     * a repeat; 11 rounds needs 44, fits with room to spare).
     */
    const totalRounds =
        Math.floor(totalPartnerships / partnershipsPerRound);

    let best = null;

    for(let attempt=0; attempt<attempts; attempt++){
        const rounds =
            buildScheduleAttempt(
                players,
                courts,
                playersPerRound,
                totalRounds
            );

        const quality =
            scheduleQuality(rounds, players);

        const isBetter =
            !best ||
            quality.maxRepeat < best.quality.maxRepeat ||
            (
                quality.maxRepeat === best.quality.maxRepeat &&
                quality.maxPartnerRepeat < best.quality.maxPartnerRepeat
            ) ||
            (
                quality.maxRepeat === best.quality.maxRepeat &&
                quality.maxPartnerRepeat === best.quality.maxPartnerRepeat &&
                quality.sumSquares < best.quality.sumSquares
            ) ||
            (
                quality.maxRepeat === best.quality.maxRepeat &&
                quality.maxPartnerRepeat === best.quality.maxPartnerRepeat &&
                quality.sumSquares === best.quality.sumSquares &&
                quality.partnerSumSquares < best.quality.partnerSumSquares
            );

        if(isBetter){
            best = {rounds, quality};
        }
    }

    return best.rounds;
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

            const maxPartners =
                tournamentPlayers.length - 1;

            const partnersLabel =
                `${player.partners.length}/${maxPartners}` +
                (player.partners.length >= maxPartners ? " ✅" : "");

            return {
                name:player.name,
                points:player.points,
                average,
                diff:diff > 0 ? `+${diff}` : diff,
                played:player.played,
                wins:player.wins,
                partners:partnersLabel
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

function setLiveSyncStatus(text, isError){
    const status =
        document.getElementById("liveSyncStatus");

    if(!status){
        return;
    }

    status.textContent = text;
    status.classList.toggle("error", Boolean(isError));
    status.classList.toggle("ok", !isError);
}

function publishTournamentState(){
    if(
        window.PadelLive &&
        americanoRounds.length > 0
    ){
        if(!window.PadelLive.hasSupabase()){
            setLiveSyncStatus(
                "Live sync: not configured (players on other devices won't see updates).",
                true
            );
            return;
        }

        window.PadelLive.saveTournamentState(
            getPublicTournamentState()
        ).then(()=>{
            setLiveSyncStatus(
                `Live sync: OK · updated ${new Date().toLocaleTimeString()}`,
                false
            );
        }).catch(error=>{
            console.warn(
                "Could not publish live tournament state",
                error
            );

            setLiveSyncStatus(
                `Live sync failed: ${error.message}. Check your Supabase project is active and the API key is valid.`,
                true
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

/* ================================================================== rounds generation ============================================================== */
/*
 * Teams format: partners are fixed (player 1+2 = team 1, 3+4 = team 2,
 * ...), so this is a plain round-robin between teams - every team
 * plays every other team exactly once - via the classic "circle
 * method": fix the first team, rotate the rest each round. A null
 * placeholder handles an odd team count by giving one team a bye.
 *
 * The circle method naturally produces floor(teamCount/2) matches per
 * cycle-round. When the available courts are fewer than that, the
 * matches get re-chunked into as many actual rounds as it takes to
 * fit everyone within the real court count, without breaking the
 * round-robin guarantee (each pairing still happens exactly once) -
 * matches that don't fit in the current chunk (because one of their
 * teams is already playing in it) simply roll over to the next one.
 */
function generateTeamSchedule(players, courts){
    const teams = [];

    for(let i=0; i<players.length; i+=2){
        teams.push([players[i], players[i + 1]]);
    }

    const hasBye = teams.length % 2 !== 0;
    const rotating = hasBye ? [...teams, null] : [...teams];
    const cycleRounds = rotating.length - 1;

    const allMatches = [];

    for(let round=0; round<cycleRounds; round++){
        for(let i=0; i<rotating.length / 2; i++){
            const teamA = rotating[i];
            const teamB = rotating[rotating.length - 1 - i];

            if(teamA && teamB){
                allMatches.push([teamA, teamB]);
            }
        }

        const fixed = rotating[0];
        const rest = rotating.slice(1);

        rest.unshift(rest.pop());

        rotating.splice(0, rotating.length, fixed, ...rest);
    }

    const rounds = [];
    let index = 0;

    while(index < allMatches.length){
        const roundPairs = [];
        const usedTeams = new Set();

        while(roundPairs.length / 2 < courts && index < allMatches.length){
            const [teamA, teamB] = allMatches[index];
            const teamAKey = teamA.map(p=>p.name).join("|");
            const teamBKey = teamB.map(p=>p.name).join("|");

            if(usedTeams.has(teamAKey) || usedTeams.has(teamBKey)){
                break;
            }

            roundPairs.push(teamA, teamB);
            usedTeams.add(teamAKey);
            usedTeams.add(teamBKey);
            index++;
        }

        rounds.push(createRound(players, roundPairs));
    }

    return rounds;
}

/*
 * King of the Court: partners are NOT fixed - every round, the four
 * players who land on a court (via promotion/relegation from the
 * previous round's results) get split into two brand new pairs.
 * Court 1 is the top ("king") court. Each round:
 *   - Court 1 gets: winners of court 1 + winners of court 2
 *   - a middle court gets: losers of the court above + winners of
 *     the court below
 *   - the bottom court gets: losers of the two bottom courts
 * When splitting a court's four arrivals into two new pairs, the
 * only two valid splits are the ones that DON'T recreate either pair
 * they arrived as - between those two, pick whichever pairs up
 * players who've partnered least (0 times beats 1, etc).
 */
function recordKotcPartnership(pairs){
    pairs.forEach(pair=>{
        const key =
            getPairKey(pair[0], pair[1]);

        kotcPartnerCounts[key] =
            (kotcPartnerCounts[key] || 0) + 1;
    });
}

function splitIntoNewKotcPairs(fourPlayers){
    const [a, b, c, d] = fourPlayers;

    const optionOne = [[a, c], [b, d]];
    const optionTwo = [[a, d], [b, c]];

    function optionScore(option){
        return option.reduce((sum, pair)=>{
            const key =
                getPairKey(pair[0], pair[1]);

            return sum + (kotcPartnerCounts[key] || 0);
        }, 0);
    }

    const scoreOne = optionScore(optionOne);
    const scoreTwo = optionScore(optionTwo);

    if(scoreOne === scoreTwo){
        return Math.random() < 0.5 ? optionOne : optionTwo;
    }

    return scoreOne < scoreTwo ? optionOne : optionTwo;
}

function generateInitialKotcRound(players, courts){
    const shuffled =
        [...players].sort(()=> Math.random() - 0.5);

    const pairs = [];

    for(let court=0; court<courts; court++){
        const courtPlayers =
            shuffled.slice(court * 4, court * 4 + 4);

        pairs.push(
            [courtPlayers[0], courtPlayers[1]],
            [courtPlayers[2], courtPlayers[3]]
        );
    }

    recordKotcPartnership(pairs);

    return createRound(players, pairs);
}

function generateNextKotcRound(courtResults, players, courts){
    const newPairs = [];

    for(let court=0; court<courts; court++){
        let arrivingTeamA;
        let arrivingTeamB;

        if(court === 0){
            arrivingTeamA = courtResults[0].winner;
            arrivingTeamB = courtResults[1].winner;
        } else if(court === courts - 1){
            arrivingTeamA = courtResults[court - 1].loser;
            arrivingTeamB = courtResults[court].loser;
        } else {
            arrivingTeamA = courtResults[court - 1].loser;
            arrivingTeamB = courtResults[court + 1].winner;
        }

        const fourPlayers =
            [...arrivingTeamA, ...arrivingTeamB];

        const newTeams =
            splitIntoNewKotcPairs(fourPlayers);

        newPairs.push(newTeams[0], newTeams[1]);
    }

    recordKotcPartnership(newPairs);

    return createRound(players, newPairs);
}

function generateAmericanoSchedule(players, courts) {
    const count = players.length;

    if(count < 6 || count > 20 || count % 2 !== 0){
        alert("Please choose an even player count from 6 to 20.");
        return [];
    }

    return tournamentFormat === "teams"
        ? generateTeamSchedule(players, courts)
        : generateBalancedSchedule(players, courts);
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

if(count < 6 || count > 20 || count % 2 !== 0){
    alert("Please choose an even player count from 6 to 20.");
    return;
}

if(!continueTournament && getTournamentFormat() === "kotc" && (count < 8 || count % 4 !== 0)){
    alert("King of the Court needs a player count divisible by 4 (8, 12, 16, or 20) so every court has 4 players.");
    return;
}

    targetScore =
    count <= 8 ? 21 :
    count <= 12 ? 19 :
    count <= 16 ? 17 :
    15;

if (!continueTournament) {
tournamentFormat = getTournamentFormat();
courtCount = getCourtCount();
saveCourtCountPreference();

const useRatings =
    shouldUsePlaytomicRatings();

for(let i=1;i<=count;i++){

    const playerName =
        document.getElementById(`player${i}`).value || `Player ${i}`;

    const ratingInput =
        document.getElementById(`rating${i}`);

    const playerRating =
        useRatings && ratingInput
            ? parseFloat(ratingInput.value) || 0
            : 0;

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
    if(tournamentFormat === "kotc"){
        kotcPartnerCounts = {};

        americanoRounds = [
            generateInitialKotcRound(
                tournamentPlayers,
                tournamentPlayers.length / 4
            )
        ];
    } else {
        americanoRounds =
            generateAmericanoSchedule(tournamentPlayers, courtCount);
    }

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
            <span>Courts</span>
            <strong>${courtCount}</strong>
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
                : targetScore === 19
                    ? "5 / 5 / 5 / 4"
                    : targetScore === 17
                        ? "4 / 4 / 4 / 5"
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
        <p id="liveSyncStatus" class="live-sync-status"></p>
    </div>
    <img
        src="${getQrCodeUrl()}"
        alt="QR code for player live view">
</section>
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

    if(tournamentFormat === "kotc"){
        scoresHTML += `
        <button type="button" class="ghost-button" onclick="endKotcTournament()">
            End Session &amp; Show Final Standings
        </button>
        `;
    }

    scoresContainer.innerHTML = scoresHTML;
}

let compactLeaderboardMode = false;

function toggleCompactLeaderboard(){
    compactLeaderboardMode = !compactLeaderboardMode;

    document.body.classList.toggle(
        "compact-mode",
        compactLeaderboardMode
    );

    if(compactLeaderboardMode){
        showTab("leaderboard");
    }

    updateLeaderboard();
}

function getLeaderboardStatusLabel(){
    if(americanoRounds.length === 0){
        return "No results yet";
    }

    if(currentRound > totalRounds){
        return `${totalRounds} rounds played`;
    }

    return `Standings after Round ${Math.max(currentRound - 1, 0)} of ${totalRounds}`;
}

function renderCompactLeaderboardHtml(sortedPlayers){
    const listClass =
        tournamentPlayers.length > 10
            ? "compact-list two-col"
            : "compact-list";

    let rows = "";

    sortedPlayers.forEach((player, index)=>{
        const average =
            player.played > 0
                ? (player.points / player.played).toFixed(1)
                : "0.0";

        rows += `
        <div class="compact-row">
            <span class="compact-rank">${index + 1}</span>
            <span class="compact-name">${player.name}</span>
            <span class="compact-avg">${average}</span>
            <span class="compact-wins">${player.wins}W</span>
        </div>
        `;
    });

    return `
    <div class="compact-summary-header">
        <h2>${currentRound > totalRounds ? "🏆 Final Standings" : "Standings"}</h2>
        <p>${getLeaderboardStatusLabel()}</p>
    </div>
    <div class="compact-exit-row">
        <button type="button" class="ghost-button" onclick="toggleCompactLeaderboard()">
            Exit Compact View
        </button>
    </div>
    <div class="${listClass}">
        ${rows}
    </div>
    `;
}

function updateLeaderboard(){

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

    if(compactLeaderboardMode){
        document.getElementById("leaderboard").innerHTML =
            renderCompactLeaderboardHtml(sortedPlayers);

        return;
    }

    let html = `
    <div class="leaderboard-note">
        Ranked by average points per game. Each player receives their team's score for the match.
    </div>
    `;

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

        const maxPartners =
            tournamentPlayers.length - 1;

        const partnersComplete =
            player.partners.length >= maxPartners;

        html += `
        <div class="leaderboard-row">
            <div class="rank">${index + 1}</div>
            <div class="leaderboard-player">
                <strong>${player.name}</strong>
                <span>Partners ${player.partners.length}/${maxPartners}${partnersComplete ? " ✅" : ""}</span>
            </div>
            <div class="leaderboard-stats">
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

    const courtResults = [];

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

        courtResults.push({
            winner: scoreA > scoreB ? teamA : teamB,
            loser: scoreA > scoreB ? teamB : teamA
        });

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

if(tournamentFormat === "kotc"){
    const nextRound =
        generateNextKotcRound(
            courtResults,
            tournamentPlayers,
            tournamentPlayers.length / 4
        );

    americanoRounds.push(nextRound);
    totalRounds = americanoRounds.length;

    alert(
        `Round ${round} complete!\n\nProceeding to Round ${round + 1}`
    );

    currentRound++;

    createTournament(true);
    showTab("scores");
    return;
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

function endKotcTournament(){
    if(!confirm("End the King of the Court session and show final standings?")){
        return;
    }

    currentRound = totalRounds + 1;
    createTournament(true);
}

/*
 * Auto-fill the other score in a court as soon as one is entered
 * (they have to add up to targetScore anyway), styled as a "ghost"
 * value the player can just accept or type over. Bound once via
 * delegation on the stable #scores container since its contents get
 * replaced on every round render.
 */
function handleScoreInput(event){
    const input = event.target;

    if(!input.classList.contains("score-input")){
        return;
    }

    const court =
        input.closest(".court-card");

    if(!court){
        return;
    }

    const inputs =
        Array.from(court.querySelectorAll(".score-input"));

    const other =
        inputs.find(el => el !== input);

    if(!other){
        return;
    }

    input.classList.remove("ghost-value");

    const enteredValue = parseInt(input.value);

    const isValid =
        !isNaN(enteredValue) &&
        enteredValue >= 0 &&
        enteredValue <= targetScore;

    if(!isValid){
        return;
    }

    const otherIsUnconfirmed =
        other.classList.contains("ghost-value") ||
        other.value === "";

    if(otherIsUnconfirmed){
        other.value = targetScore - enteredValue;
        other.classList.add("ghost-value");
    }
}

document.getElementById("scores")
    .addEventListener("input", handleScoreInput);

generatePlayers();
