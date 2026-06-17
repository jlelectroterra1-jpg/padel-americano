(function(){
    const config =
        window.LIVE_CONFIG || {};

    const storageKey =
        `padel-americano:${config.tournamentId || "main-tournament"}`;

    function hasSupabase(){
        return Boolean(
            config.supabaseUrl &&
            config.supabaseAnonKey
        );
    }

    async function saveTournamentState(state){
        const savedState = {
            ...state,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(
            storageKey,
            JSON.stringify(savedState)
        );

        if(!hasSupabase()){
            return savedState;
        }

        const response =
            await fetch(
            `${config.supabaseUrl}/rest/v1/tournaments?on_conflict=id`,
            {
                method:"POST",
                headers:{
                    "apikey":config.supabaseAnonKey,
                    "Authorization":`Bearer ${config.supabaseAnonKey}`,
                    "Content-Type":"application/json",
                    "Prefer":"resolution=merge-duplicates,return=minimal"
                },
                body:JSON.stringify({
                    id:config.tournamentId,
                    state:savedState,
                    updated_at:savedState.updatedAt
                })
            }
        );

        if(!response.ok){
            throw new Error(
                await response.text()
            );
        }

        return savedState;
    }

    async function loadTournamentState(){
        if(hasSupabase()){
            const response =
                await fetch(
                    `${config.supabaseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(config.tournamentId)}&select=state`,
                    {
                        headers:{
                            "apikey":config.supabaseAnonKey,
                            "Authorization":`Bearer ${config.supabaseAnonKey}`
                        }
                    }
                );

            if(!response.ok){
                throw new Error(
                    await response.text()
                );
            }

            const rows =
                await response.json();

            if(rows[0] && rows[0].state){
                localStorage.setItem(
                    storageKey,
                    JSON.stringify(rows[0].state)
                );

                return rows[0].state;
            }
        }

        const localState =
            localStorage.getItem(storageKey);

        return localState
            ? JSON.parse(localState)
            : null;
    }

    window.PadelLive = {
        saveTournamentState,
        loadTournamentState,
        hasSupabase
    };
})();
