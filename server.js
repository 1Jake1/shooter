const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

app.use(express.static(__dirname));

const lobbies = new Map();
const players = new Map();

class Lobby {
	constructor(id, hostId) {
		this.id = id;
		this.hostId = hostId;
		this.players = new Map();
		this.maxPlayers = 10;
		this.selectedMap = 1;
		this.enableBots = false;
		this.gameStarted = false;
	}

	addPlayer(playerId, playerName) {
		if (this.players.size >= this.maxPlayers) return false;
		this.players.set(playerId, {
			id: playerId,
			name: playerName,
			team: null,
			ready: false,
		});
		return true;
	}

	removePlayer(playerId) {
		this.players.delete(playerId);
		if (this.players.size === 0) {
			return true;
		}
		if (playerId === this.hostId && this.players.size > 0) {
			this.hostId = this.players.keys().next().value;
		}
		return false;
	}

	setPlayerTeam(playerId, team) {
		const player = this.players.get(playerId);
		if (player) {
			player.team = team;
		}
	}

	setPlayerReady(playerId, ready) {
		const player = this.players.get(playerId);
		if (player) {
			player.ready = ready;
		}
	}

	canStart() {
		if (this.selectedMap === 2) {
			const redTeam = Array.from(this.players.values()).filter(
				p => p.team === 'red',
			);
			const blueTeam = Array.from(this.players.values()).filter(
				p => p.team === 'blue',
			);
			return redTeam.length > 0 && blueTeam.length > 0;
		}
		return this.players.size > 0;
	}

	toJSON() {
		return {
			id: this.id,
			hostId: this.hostId,
			players: Array.from(this.players.values()),
			maxPlayers: this.maxPlayers,
			selectedMap: this.selectedMap,
			enableBots: this.enableBots,
			gameStarted: this.gameStarted,
		};
	}
}

function generateLobbyId() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', socket => {
	console.log(`Player connected: ${socket.id}`);

	socket.on('create_lobby', ({ playerName }) => {
		const lobbyId = generateLobbyId();
		const lobby = new Lobby(lobbyId, socket.id);
		lobby.addPlayer(socket.id, playerName);
		lobbies.set(lobbyId, lobby);
		players.set(socket.id, { lobbyId, name: playerName });

		socket.join(lobbyId);
		socket.emit('lobby_created', { lobbyId, lobby: lobby.toJSON() });
		console.log(`Lobby created: ${lobbyId} by ${playerName}`);
	});

	socket.on('join_lobby', ({ lobbyId, playerName }) => {
		const lobby = lobbies.get(lobbyId);
		if (!lobby) {
			socket.emit('error', { message: 'Лобби не найдено' });
			return;
		}
		if (lobby.gameStarted) {
			socket.emit('error', { message: 'Игра уже началась' });
			return;
		}
		if (!lobby.addPlayer(socket.id, playerName)) {
			socket.emit('error', { message: 'Лобби заполнено' });
			return;
		}

		players.set(socket.id, { lobbyId, name: playerName });
		socket.join(lobbyId);
		socket.emit('lobby_joined', { lobby: lobby.toJSON() });
		io.to(lobbyId).emit('lobby_updated', { lobby: lobby.toJSON() });
		console.log(`${playerName} joined lobby ${lobbyId}`);
	});

	socket.on('get_lobbies', () => {
		const availableLobbies = Array.from(lobbies.values())
			.filter(lobby => !lobby.gameStarted && lobby.players.size < lobby.maxPlayers)
			.map(lobby => lobby.toJSON());
		socket.emit('lobbies_list', { lobbies: availableLobbies });
	});

	socket.on('set_team', ({ team }) => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		const lobby = lobbies.get(playerData.lobbyId);
		if (!lobby) return;

		lobby.setPlayerTeam(socket.id, team);
		io.to(playerData.lobbyId).emit('lobby_updated', { lobby: lobby.toJSON() });
	});

	socket.on('set_ready', ({ ready }) => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		const lobby = lobbies.get(playerData.lobbyId);
		if (!lobby) return;

		lobby.setPlayerReady(socket.id, ready);
		io.to(playerData.lobbyId).emit('lobby_updated', { lobby: lobby.toJSON() });
	});

	socket.on('set_map', ({ mapId }) => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		const lobby = lobbies.get(playerData.lobbyId);
		if (!lobby || lobby.hostId !== socket.id) return;

		lobby.selectedMap = mapId;
		io.to(playerData.lobbyId).emit('lobby_updated', { lobby: lobby.toJSON() });
	});

	socket.on('set_bots', ({ enableBots }) => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		const lobby = lobbies.get(playerData.lobbyId);
		if (!lobby || lobby.hostId !== socket.id) return;

		lobby.enableBots = enableBots;
		io.to(playerData.lobbyId).emit('lobby_updated', { lobby: lobby.toJSON() });
	});

	socket.on('start_game', () => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		const lobby = lobbies.get(playerData.lobbyId);
		if (!lobby || lobby.hostId !== socket.id) return;

		if (!lobby.canStart()) {
			socket.emit('error', {
				message:
					'Невозможно начать игру. Проверьте команды (для карты 2 нужны обе команды)',
			});
			return;
		}

		lobby.gameStarted = true;
		io.to(playerData.lobbyId).emit('game_starting', {
			lobby: lobby.toJSON(),
		});
		console.log(`Game starting in lobby ${playerData.lobbyId}`);
	});

	socket.on('rejoin_game', ({ lobbyId }) => {
		const lobby = lobbies.get(lobbyId);
		if (!lobby) {
			console.log(`❌ Rejoin failed: lobby ${lobbyId} not found`);
			return;
		}

		socket.join(lobbyId);
		console.log(`✅ Player ${socket.id} rejoined game room ${lobbyId}`);

		// Обновляем информацию об игроке
		if (!players.has(socket.id)) {
			players.set(socket.id, { lobbyId, name: 'Player' });
		}
	});

	socket.on('player_position', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;

		// Отправляем позицию всем ДРУГИМ игрокам в том же лобби
		socket.to(playerData.lobbyId).emit('player_update', {
			playerId: socket.id,
			...data,
		});
	});

	socket.on('player_shoot', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		socket.to(playerData.lobbyId).emit('player_shot', {
			playerId: socket.id,
			...data,
		});
	});

	socket.on('player_hit', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		io.to(playerData.lobbyId).emit('player_damaged', {
			playerId: socket.id,
			targetId: data.targetId,
			damage: data.damage,
		});
	});

	socket.on('player_killed', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		io.to(playerData.lobbyId).emit('player_death', {
			playerId: socket.id,
			killerId: data.killerId,
		});
	});

	socket.on('grenade_thrown', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		socket.to(playerData.lobbyId).emit('grenade_spawn', {
			playerId: socket.id,
			...data,
		});
	});

	socket.on('grenade_exploded', data => {
		const playerData = players.get(socket.id);
		if (!playerData) return;
		socket.to(playerData.lobbyId).emit('grenade_explosion', {
			playerId: socket.id,
			...data,
		});
	});

	socket.on('leave_lobby', () => {
		handleDisconnect(socket.id);
	});

	socket.on('disconnect', () => {
		console.log(`Player disconnected: ${socket.id}`);
		handleDisconnect(socket.id);
	});

	function handleDisconnect(socketId) {
		const playerData = players.get(socketId);
		if (!playerData) return;

		const lobby = lobbies.get(playerData.lobbyId);
		if (lobby) {
			const shouldDelete = lobby.removePlayer(socketId);
			if (shouldDelete) {
				lobbies.delete(playerData.lobbyId);
				console.log(`Lobby ${playerData.lobbyId} deleted (empty)`);
			} else {
				io.to(playerData.lobbyId).emit('lobby_updated', {
					lobby: lobby.toJSON(),
				});
				io.to(playerData.lobbyId).emit('player_disconnected', {
					playerId: socketId,
				});
			}
		}
		players.delete(socketId);
	}
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Open http://localhost:${PORT}/lobby.html to start`);
});
