// Состояние игры
export const gameState = {
	selectedMap: 1,
	selectedTeam: 'red',
	teamScores: { red: 0, blue: 0 },
	zombieWave: 1,
	zombiesKilled: 0,
};

export function resetGame() {
	gameState.teamScores = { red: 0, blue: 0 };
	gameState.zombieWave = 1;
	gameState.zombiesKilled = 0;
}

export function updateTeamScore(team, points) {
	gameState.teamScores[team] += points;
}
