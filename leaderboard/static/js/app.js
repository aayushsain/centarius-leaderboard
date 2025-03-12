document.addEventListener('DOMContentLoaded', () => {
    // Select DOM elements
    const gameSelector = document.getElementById('game-selector');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const statTotalPlayers = document.getElementById('stat-total-players');
    const statTopScore = document.getElementById('stat-top-score');
    
    const scoreForm = document.getElementById('score-form');
    const inputGameId = document.getElementById('input-game-id');
    const inputPlayerId = document.getElementById('input-player-id');
    const inputDisplayName = document.getElementById('input-display-name');
    const inputScore = document.getElementById('input-score');
    const submitBtn = document.getElementById('submit-btn');

    let currentSelectedGame = '';
    let pollingTimeout = null;

    // Load available games
    async function loadGames(selectGameId = null) {
        try {
            const response = await fetch('/api/get-games/');
            if (!response.ok) throw new Error('Failed to load games list');
            
            const games = await response.json();
            
            // Clear current options
            gameSelector.innerHTML = '';

            if (games.length === 0) {
                // Default option if no games exist yet
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No games active. Submit a score to register a game!';
                opt.disabled = true;
                opt.selected = true;
                gameSelector.appendChild(opt);
                
                // Clear metadata
                statTotalPlayers.textContent = '0';
                statTopScore.textContent = '-';
                leaderboardTitle.textContent = 'Leaderboard';
                leaderboardBody.innerHTML = `
                    <tr class="info-row">
                        <td colspan="4">No scores submitted yet. Be the first by using the form!</td>
                    </tr>
                `;
                return;
            }

            games.forEach((game, index) => {
                const opt = document.createElement('option');
                opt.value = game.game_id;
                opt.textContent = game.title;
                
                // Select either the specified game, or the first game by default
                if (selectGameId) {
                    if (game.game_id === selectGameId) opt.selected = true;
                } else {
                    if (index === 0) opt.selected = true;
                }
                gameSelector.appendChild(opt);
            });

            currentSelectedGame = gameSelector.value;
            if (currentSelectedGame) {
                loadLeaderboard(currentSelectedGame);
                startPolling(currentSelectedGame);
            }

        } catch (error) {
            console.error(error);
            showToast('Connection Error', 'Could not fetch active tournaments.', 'error');
        }
    }

    // Load leaderboard for a game
    async function loadLeaderboard(gameId) {
        if (!gameId) return;

        try {
            const response = await fetch(`/api/get-game-leaderboard/?game_id=${encodeURIComponent(gameId)}&limit=10`);
            if (!response.ok) throw new Error('Failed to load leaderboard data');

            const scores = await response.json();
            renderLeaderboard(scores);

            // Update stats
            statTotalPlayers.textContent = scores.length;
            if (scores.length > 0) {
                statTopScore.textContent = scores[0].score.toLocaleString();
            } else {
                statTopScore.textContent = '-';
            }

            // Sync with Selected Option Title
            const selectedOpt = gameSelector.options[gameSelector.selectedIndex];
            if (selectedOpt) {
                leaderboardTitle.textContent = `${selectedOpt.textContent} Standings`;
            }

        } catch (error) {
            console.error(error);
            showToast('Loading Error', 'Failed to retrieve rankings.', 'error');
        }
    }

    // Render leaderboard table
    function renderLeaderboard(scores) {
        leaderboardBody.innerHTML = '';

        if (scores.length === 0) {
            leaderboardBody.innerHTML = `
                <tr class="info-row">
                    <td colspan="4">No scores submitted for this game yet.</td>
                </tr>
            `;
            return;
        }

        scores.forEach(entry => {
            const tr = document.createElement('tr');
            
            // Format Rank Badge
            let rankHtml = '';
            if (entry.rank === 1) {
                rankHtml = `<span class="rank-badge rank-1">1</span>`;
            } else if (entry.rank === 2) {
                rankHtml = `<span class="rank-badge rank-2">2</span>`;
            } else if (entry.rank === 3) {
                rankHtml = `<span class="rank-badge rank-3">3</span>`;
            } else {
                rankHtml = `<span class="rank-badge rank-other">${entry.rank}</span>`;
            }

            // Format timestamp
            const date = new Date(entry.date_saved);
            const formattedDate = date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            tr.innerHTML = `
                <td>${rankHtml}</td>
                <td class="player-cell">${escapeHtml(entry.display_name)} <span style="font-size: 0.75rem; color: var(--text-secondary)">(${escapeHtml(entry.player_id)})</span></td>
                <td class="score-cell">${entry.score.toLocaleString()}</td>
                <td class="date-cell">${formattedDate}</td>
            `;

            leaderboardBody.appendChild(tr);
        });
    }

    // Handle score submission
    scoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const gameId = inputGameId.value.trim();
        const playerId = inputPlayerId.value.trim();
        const displayName = inputDisplayName.value.trim();
        const score = parseInt(inputScore.value);

        if (!gameId || !playerId || !displayName || isNaN(score)) {
            showToast('Validation Error', 'Please fill out all fields correctly.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch('/api/enter-leaderboard/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: gameId,
                    player_id: playerId,
                    display_name: displayName,
                    score: score
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Server error occurred');
            }

            const result = await response.json();

            if (result.status === 'success') {
                const updated = result.data.updated;
                if (updated) {
                    showToast('High Score Saved!', `${result.data.display_name} achieved ${result.data.highest_score.toLocaleString()}!`, 'success');
                } else {
                    showToast('Score Submitted', `Your attempt was saved. Your high score remains ${result.data.highest_score.toLocaleString()}.`, 'info');
                }

                // Clear input score and player fields
                inputScore.value = '';
                
                // Refresh list and select the game we just submitted to
                const gameKey = gameId.toLowerCase();
                await loadGames(gameKey);
            }

        } catch (error) {
            console.error(error);
            showToast('Submission Failed', error.message || 'Could not save score.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Score';
        }
    });

    // Handle Dropdown selection change
    gameSelector.addEventListener('change', () => {
        currentSelectedGame = gameSelector.value;
        loadLeaderboard(currentSelectedGame);
        startPolling(currentSelectedGame);
    });

    // Polling setup for live updates (using recursive setTimeout to prevent request stacking)
    function startPolling(gameId) {
        if (pollingTimeout) clearTimeout(pollingTimeout);
        
        async function poll() {
            await loadLeaderboard(gameId);
            // Schedule next execution strictly after the current request resolves
            pollingTimeout = setTimeout(poll, 10000);
        }
        
        pollingTimeout = setTimeout(poll, 10000); // Wait 10 seconds before the first automatic poll
    }

    // HTML sanitizer helper
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Toast notification logic
    function showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        `;
        
        container.appendChild(toast);

        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    // Initial project load
    loadGames();
});
