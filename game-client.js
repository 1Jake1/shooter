// Получаем параметры из URL (уже определено в game.html)
// const selectedMap, selectedTeam, enableBots, socket, lobbyId уже доступны

const gameState = {
	selectedMap: selectedMap,
	selectedTeam: selectedTeam,
	teamScores: { red: 0, blue: 0 },
	zombieWave: 1,
	zombiesKilled: 0,
};

const CONFIG = {
	mapSize: 60,
	zombieMapSize: 120,
	wallHeight: 4,
	wallThickness: 0.5,
	playerHeight: 1.7,
	playerRadius: 0.4,
	moveSpeed: 8,
	sprintSpeed: 13,
	jumpForce: 8,
	gravity: 20,
	mouseSensitivity: 0.002,
	zombie: {
		health: 100,
		damage: 15,
		speed: 3.5,
		attackRange: 2,
		attackCooldown: 1000,
		detectionRange: 30,
	},
	weapons: {
		pistol: {
			name: 'ПИСТОЛЕТ',
			damage: 25,
			fireRate: 300,
			magSize: 12,
			reserveAmmo: Infinity,
			reloadTime: 1800,
			spread: 0.01,
			auto: false,
			recoil: 0.04,
		},
		rifle: {
			name: 'АВТОМАТ',
			damage: 18,
			fireRate: 100,
			magSize: 30,
			reserveAmmo: Infinity,
			reloadTime: 2800,
			spread: 0.03,
			auto: true,
			recoil: 0.025,
		},
		ssg: {
			name: 'SSG-08',
			damage: 110,
			fireRate: 1200,
			magSize: 10,
			reserveAmmo: Infinity,
			reloadTime: 3500,
			spread: 0.001,
			auto: false,
			recoil: 0.08,
			zoom: 2.8,
			hasScope: true,
		},
	},
	grenades: {
		frag: {
			name: 'ОСКОЛОЧНАЯ',
			fuseTime: 2.5,
			blastRadius: 7,
			blastDamage: 100,
			throwForce: 18,
		},
		smoke: {
			name: 'ДЫМОВАЯ',
			fuseTime: 1.5,
			smokeDuration: 12,
			smokeRadius: 6,
			throwForce: 16,
		},
	},
};

// ============ SOUND SYSTEM ============
class SoundSystem {
	constructor() {
		this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.value = 0.5;
		this.masterGain.connect(this.ctx.destination);
		this.compressor = this.ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -20;
		this.compressor.knee.value = 10;
		this.compressor.ratio.value = 8;
		this.compressor.connect(this.masterGain);

		this.buffers = {};
		this.soundsLoaded = false;
	}

	resume() {
		if (this.ctx.state === 'suspended') this.ctx.resume();
	}

	async loadSound(name, url) {
		try {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
			this.buffers[name] = audioBuffer;
			console.log(`✅ Звук загружен: ${name}`);
		} catch (error) {
			console.error(`❌ Ошибка загрузки звука ${name}:`, error);
		}
	}

	async initSounds() {
		// Звуки выстрелов
		await this.loadSound('pistol', 'sounds/pistol.mp3');
		await this.loadSound('rifle', 'sounds/rifle.mp3');
		await this.loadSound('ssg', 'sounds/ssg.mp3');

		// НОВЫЕ ЗВУКИ: Перезарядка
		await this.loadSound('reload_pistol', 'sounds/reload_pistol.mp3');
		await this.loadSound('reload_rifle', 'sounds/reload_rifle.mp3');
		await this.loadSound('reload_ssg', 'sounds/reload_ssg.mp3');

		// НОВЫЕ ЗВУКИ: Ходьба
		await this.loadSound('footstep', 'sounds/footstep.mp3');
		await this.loadSound('footstep2', 'sounds/footstep2.mp3');

		this.soundsLoaded = true;
		console.log('🔊 Все основные звуки загружены');
	}

	playBuffer(name, pitchVariance = 0.05) {
		if (!this.soundsLoaded || !this.buffers[name]) {
			console.warn(`Звук ${name} не найден или не загружен`);
			return;
		}
		this.resume();
		const source = this.ctx.createBufferSource();
		source.buffer = this.buffers[name];
		if (pitchVariance > 0) {
			source.playbackRate.value =
				1.0 + (Math.random() * pitchVariance * 2 - pitchVariance);
		}
		source.connect(this.compressor);
		source.start(0);
	}

	playPistolShot() {
		this.playBuffer('pistol', 0.03);
		this._reverbTail(this.ctx.currentTime, 0.15, 0.1);
	}

	playRifleShot() {
		this.playBuffer('rifle', 0.04);
		this._reverbTail(this.ctx.currentTime, 0.1, 0.08);
	}

	playSSGShot() {
		this.playBuffer('ssg', 0.02);
		this._reverbTail(this.ctx.currentTime, 0.4, 0.25);
		this._click(this.ctx.currentTime + 0.25, 800, 0.03, 0.2);
	}

	playReloadSound(weapon) {
		const soundMap = {
			pistol: 'reload_pistol',
			rifle: 'reload_rifle',
			ssg: 'reload_ssg',
		};
		const soundName = soundMap[weapon] || 'reload_rifle';

		this.playBuffer(soundName, 0.05);
	}

	playEmptyClick() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 2000, 0.015, 0.3);
		this._click(t + 0.02, 1500, 0.01, 0.2);
	}

	playFootstep() {
		// Проигрываем звук шага с вариацией тона (10%),
		// чтобы последовательные шаги не звучали как робот
		this.playBuffer('footstep', 0.1);
	}

	playHitSound() {
		this.resume();
		const t = this.ctx.currentTime;
		const o = this.ctx.createOscillator(),
			g = this.ctx.createGain();
		o.type = 'sine';
		o.frequency.setValueAtTime(1800, t);
		o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
		g.gain.setValueAtTime(0.15, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
		o.connect(g);
		g.connect(this.compressor);
		o.start(t);
		o.stop(t + 0.1);
	}

	playKillSound() {
		this.resume();
		const t = this.ctx.currentTime;
		[1400, 1800, 2200].forEach((f, i) => {
			const o = this.ctx.createOscillator(),
				g = this.ctx.createGain();
			o.type = 'sine';
			o.frequency.value = f;
			g.gain.setValueAtTime(0, t + i * 0.06);
			g.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.02);
			g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
			o.connect(g);
			g.connect(this.compressor);
			o.start(t + i * 0.06);
			o.stop(t + i * 0.06 + 0.15);
		});
	}

	playGrenadeThrow() {
		this.resume();
		const t = this.ctx.currentTime;
		this._noiseBurst(t, 0.1, 0.3);
		const o = this.ctx.createOscillator(),
			g = this.ctx.createGain();
		o.type = 'sawtooth';
		o.frequency.setValueAtTime(400, t);
		o.frequency.exponentialRampToValueAtTime(100, t + 0.15);
		g.gain.setValueAtTime(0.2, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		o.connect(g);
		g.connect(this.compressor);
		o.start(t);
		o.stop(t + 0.15);
	}

	playGrenadeBounce() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 300 + Math.random() * 100, 0.05, 0.25);
		this._noiseBurst(t, 0.03, 0.15);
	}

	playGrenadePin() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 3000, 0.01, 0.3);
		this._click(t + 0.02, 2500, 0.01, 0.2);
	}

	playExplosion() {
		this.resume();
		const t = this.ctx.currentTime;
		const o1 = this.ctx.createOscillator(),
			g1 = this.ctx.createGain();
		o1.type = 'sine';
		o1.frequency.setValueAtTime(80, t);
		o1.frequency.exponentialRampToValueAtTime(20, t + 0.5);
		g1.gain.setValueAtTime(0.8, t);
		g1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
		o1.connect(g1);
		g1.connect(this.compressor);
		o1.start(t);
		o1.stop(t + 0.6);
		const o2 = this.ctx.createOscillator(),
			g2 = this.ctx.createGain();
		o2.type = 'sawtooth';
		o2.frequency.setValueAtTime(400, t);
		o2.frequency.exponentialRampToValueAtTime(50, t + 0.2);
		g2.gain.setValueAtTime(0.5, t);
		g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		o2.connect(g2);
		g2.connect(this.compressor);
		o2.start(t);
		o2.stop(t + 0.3);
		this._noiseBurst(t, 0.4, 0.8);
		this._noiseBurst(t + 0.05, 0.6, 0.4);
		this._reverbTail(t, 1.0, 0.5);
	}

	playSmokeStart() {
		this.resume();
		const t = this.ctx.currentTime;
		const len = Math.floor(this.ctx.sampleRate * 1.5);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++)
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.5) * 0.3;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const f = this.ctx.createBiquadFilter();
		f.type = 'highpass';
		f.frequency.value = 2000;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(0.4, t);
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}

	playSmokeLoop() {
		this.resume();
		const t = this.ctx.currentTime;
		const len = Math.floor(this.ctx.sampleRate * 0.3);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.05;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const f = this.ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.frequency.value = 1500;
		f.Q.value = 0.5;
		const g = this.ctx.createGain();
		g.gain.value = 0.15;
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}

	playScopeIn() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 600, 0.03, 0.15);
		this._click(t + 0.02, 900, 0.02, 0.1);
	}

	playScopeOut() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 400, 0.02, 0.12);
	}

	_click(t, freq, dur, vol) {
		const o = this.ctx.createOscillator(),
			g = this.ctx.createGain();
		o.type = 'square';
		o.frequency.setValueAtTime(freq, t);
		o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		o.connect(g);
		g.connect(this.compressor);
		o.start(t);
		o.stop(t + dur);
	}

	_noiseBurst(t, dur, vol) {
		const len = Math.floor(this.ctx.sampleRate * dur);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++)
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		const f = this.ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.frequency.value = 3000;
		f.Q.value = 0.5;
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}

	_reverbTail(t, dur, vol) {
		const len = Math.floor(this.ctx.sampleRate * dur);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++)
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5) * 0.3;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		const f = this.ctx.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = 1500;
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}
}

const soundSystem = new SoundSystem();

// ============ TEXTURES & SCENE SETUP ============
const wallTextureURL =
	'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/137338be7-b6f0-4fa1-b1ff-74443c54a241.png';
const floorTextureURL =
	'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/11c465004-2539-4864-93b5-a5687798c7b2.png';
const ceilingTextureURL =
	'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/1bc635045-e83d-4be1-96f7-b9699a5e6478.png';

function createTexture(url, rx, ry) {
	const tex = new THREE.TextureLoader().load(url);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(rx, ry);
	return tex;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x111111, 0.015);

const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	200,
);
camera.position.set(0, CONFIG.playerHeight, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x334455, 0.6));
const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left = -35;
dirLight.shadow.camera.right = 35;
dirLight.shadow.camera.top = 35;
dirLight.shadow.camera.bottom = -35;
scene.add(dirLight);

const pointLights = [];
function setupLightsForMap(mapId) {
	pointLights.forEach(l => scene.remove(l));
	pointLights.length = 0;
	const lightsConfig =
		mapId === 1
			? [
					[0xff4444, [-15, 3, -15]],
					[0x4488ff, [15, 3, -15]],
					[0xff8800, [-15, 3, 15]],
					[0x44ff44, [15, 3, 15]],
					[0xff4444, [0, 3, -20]],
					[0x4488ff, [0, 3, 20]],
					[0xff8800, [-20, 3, 0]],
					[0x44ff44, [20, 3, 0]],
				]
			: [
					[0xff4444, [-20, 3, -10]],
					[0xff6644, [-20, 3, 10]],
					[0xff3333, [-15, 3, 0]],
					[0x4488ff, [20, 3, -10]],
					[0x4466ff, [20, 3, 10]],
					[0x3388ff, [15, 3, 0]],
					[0xffaa44, [0, 3, -20]],
					[0x44aaff, [0, 3, 20]],
				];
	lightsConfig.forEach(([c, p]) => {
		const pl = new THREE.PointLight(
			c,
			mapId === 1 ? 0.8 : 0.9,
			mapId === 1 ? 20 : 22,
		);
		pl.position.set(...p);
		scene.add(pl);
		pointLights.push(pl);
	});
}

const wallMat = new THREE.MeshStandardMaterial({
	map: createTexture(wallTextureURL, 3, 3),
	roughness: 0.85,
	metalness: 0.1,
});
const floorMat = new THREE.MeshStandardMaterial({
	map: createTexture(floorTextureURL, 8, 8),
	roughness: 0.7,
	metalness: 0.3,
});
const ceilingMat = new THREE.MeshStandardMaterial({
	map: createTexture(ceilingTextureURL, 8, 8),
	roughness: 0.6,
	metalness: 0.5,
});
const pillarMat = new THREE.MeshStandardMaterial({
	color: 0x555555,
	roughness: 0.5,
	metalness: 0.6,
});
const targetMat = new THREE.MeshStandardMaterial({
	color: 0xff2222,
	roughness: 0.3,
	metalness: 0.2,
	emissive: 0x330000,
});
const targetHitMat = new THREE.MeshStandardMaterial({
	color: 0xffaa00,
	roughness: 0.3,
	metalness: 0.2,
	emissive: 0x442200,
});
const redMat = new THREE.MeshStandardMaterial({
	color: 0xcc2222,
	roughness: 0.5,
	metalness: 0.3,
	emissive: 0x220000,
});
const blueMat = new THREE.MeshStandardMaterial({
	color: 0x2244cc,
	roughness: 0.5,
	metalness: 0.3,
	emissive: 0x000022,
});

const walls = [],
	targets = [],
	mapObjects = [],
	zombies = [];
let mapHalf = CONFIG.mapSize / 2;

function clearMap() {
	walls.length = 0;
	targets.forEach(t => scene.remove(t.group));
	targets.length = 0;
	mapObjects.forEach(o => scene.remove(o));
	mapObjects.length = 0;
}

function addWall(x, z, w, d, h) {
	h = h || CONFIG.wallHeight;
	const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
	m.position.set(x, h / 2, z);
	m.castShadow = true;
	m.receiveShadow = true;
	scene.add(m);
	walls.push({ mesh: m, x, z, w, d, h });
	mapObjects.push(m);
}

function addPillar(x, z) {
	const m = new THREE.Mesh(
		new THREE.BoxGeometry(1, CONFIG.wallHeight, 1),
		pillarMat,
	);
	m.position.set(x, CONFIG.wallHeight / 2, z);
	m.castShadow = true;
	m.receiveShadow = true;
	scene.add(m);
	walls.push({ mesh: m, x, z, w: 1, d: 1, h: CONFIG.wallHeight });
	mapObjects.push(m);
}

function buildMap1() {
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
		floorMat,
	);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);
	mapObjects.push(floor);

	const ceil = new THREE.Mesh(
		new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
		ceilingMat,
	);
	ceil.rotation.x = Math.PI / 2;
	ceil.position.y = CONFIG.wallHeight;
	scene.add(ceil);
	mapObjects.push(ceil);

	const T = CONFIG.wallThickness,
		S = mapHalf;
	addWall(0, -S, CONFIG.mapSize, T);
	addWall(0, S, CONFIG.mapSize, T);
	addWall(-S, 0, T, CONFIG.mapSize);
	addWall(S, 0, T, CONFIG.mapSize);
	addWall(-10, 0, 10, T);
	addWall(10, 0, 10, T);
	addWall(0, -10, T, 10);
	addWall(0, 10, T, 10);
	addWall(-20, -15, 10, T);
	addWall(-15, -20, T, 10);
	addWall(20, -15, 10, T);
	addWall(15, -20, T, 10);
	addWall(-20, 15, 10, T);
	addWall(-15, 20, T, 10);
	addWall(20, 15, 10, T);
	addWall(15, 20, T, 10);
	addWall(-10, -20, T, 10);
	addWall(10, -20, T, 10);
	addWall(-10, 20, T, 10);
	addWall(10, 20, T, 10);

	[
		[-7, -7],
		[7, -7],
		[-7, 7],
		[7, 7],
		[-20, -7],
		[20, -7],
		[-20, 7],
		[20, 7],
		[-7, -20],
		[7, -20],
		[-7, 20],
		[7, 20],
		[-25, 0],
		[25, 0],
		[0, -25],
		[0, 25],
	].forEach(p => addPillar(p[0], p[1]));
	[
		[-12, -12],
		[12, -12],
		[-12, 12],
		[12, 12],
		[-22, -22],
		[22, -22],
		[-22, 22],
		[22, 22],
		[0, -18],
		[0, 18],
		[-18, 0],
		[18, 0],
		[-8, -22],
		[8, -22],
		[-8, 22],
		[8, 22],
	].forEach(([x, z]) => createTarget(x, z, 'neutral'));
}

function buildMap2() {
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
		floorMat,
	);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);
	mapObjects.push(floor);

	const ceil = new THREE.Mesh(
		new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
		ceilingMat,
	);
	ceil.rotation.x = Math.PI / 2;
	ceil.position.y = CONFIG.wallHeight;
	scene.add(ceil);
	mapObjects.push(ceil);

	const T = CONFIG.wallThickness,
		S = mapHalf;
	addWall(0, -S, CONFIG.mapSize, T);
	addWall(0, S, CONFIG.mapSize, T);
	addWall(-S, 0, T, CONFIG.mapSize);
	addWall(S, 0, T, CONFIG.mapSize);
	addWall(0, -18, T, 12);
	addWall(0, 0, T, 8);
	addWall(0, 18, T, 12);
	addWall(-22, -8, 8, T);
	addWall(-22, 8, 8, T);
	addWall(-26, 0, T, 10);
	addPillar(-20, -5);
	addPillar(-20, 5);
	addPillar(-24, 0);

	const redBase = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), redMat);
	redBase.rotation.x = -Math.PI / 2;
	redBase.position.set(-22, 0.02, 0);
	scene.add(redBase);
	mapObjects.push(redBase);

	addWall(22, -8, 8, T);
	addWall(22, 8, 8, T);
	addWall(26, 0, T, 10);
	addPillar(20, -5);
	addPillar(20, 5);
	addPillar(24, 0);

	const blueBase = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), blueMat);
	blueBase.rotation.x = -Math.PI / 2;
	blueBase.position.set(22, 0.02, 0);
	scene.add(blueBase);
	mapObjects.push(blueBase);

	addWall(-8, -20, 6, T);
	addWall(8, -20, 6, T);
	addPillar(-12, -20);
	addPillar(12, -20);
	addWall(0, -24, 4, T);
	addWall(-8, 20, 6, T);
	addWall(8, 20, 6, T);
	addPillar(-12, 20);
	addPillar(12, 20);
	addWall(0, 24, 4, T);
	addWall(-6, -5, T, 4);
	addWall(6, -5, T, 4);
	addWall(-6, 5, T, 4);
	addWall(6, 5, T, 4);
	addPillar(-4, 0);
	addPillar(4, 0);
	addWall(-14, -14, 4, T);
	addWall(14, -14, 4, T);
	addWall(-14, 14, 4, T);
	addWall(14, 14, 4, T);
	addPillar(-14, -8);
	addPillar(14, -8);
	addPillar(-14, 8);
	addPillar(14, 8);

	[
		[0, -10],
		[0, 10],
		[-4, -14],
		[4, -14],
		[-4, 14],
		[4, 14],
	].forEach(([x, z]) => createTarget(x, z, 'neutral'));
	[
		[-16, -3],
		[-16, 3],
		[-10, -10],
		[-10, 10],
	].forEach(([x, z]) => createTarget(x, z, 'blue'));
	[
		[16, -3],
		[16, 3],
		[10, -10],
		[10, 10],
	].forEach(([x, z]) => createTarget(x, z, 'red'));
}

function buildMap3() {
	mapHalf = CONFIG.zombieMapSize / 2;

	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(CONFIG.zombieMapSize, CONFIG.zombieMapSize),
		floorMat,
	);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);
	mapObjects.push(floor);

	scene.background = new THREE.Color(0x334455);
	scene.fog = new THREE.FogExp2(0x334455, 0.008);

	const T = CONFIG.wallThickness,
		S = mapHalf;
	addWall(0, -S, CONFIG.zombieMapSize, T);
	addWall(0, S, CONFIG.zombieMapSize, T);
	addWall(-S, 0, T, CONFIG.zombieMapSize);
	addWall(S, 0, T, CONFIG.zombieMapSize);

	// Центральное укрепление
	addWall(0, 0, 20, T, 3);
	addWall(0, 10, T, 10, 3);
	addWall(0, -10, T, 10, 3);
	addWall(-10, 5, 10, T, 3);
	addWall(10, 5, 10, T, 3);
	addWall(-10, -5, 10, T, 3);
	addWall(10, -5, 10, T, 3);

	// Платформы и укрытия с разной высотой
	addWall(-25, -25, 8, 8, 2);
	addWall(25, -25, 8, 8, 2);
	addWall(-25, 25, 8, 8, 2);
	addWall(25, 25, 8, 8, 2);

	// Высокие платформы
	const platform1 = new THREE.Mesh(
		new THREE.BoxGeometry(10, 1, 10),
		new THREE.MeshStandardMaterial({
			color: 0x666666,
			roughness: 0.8,
			metalness: 0.3,
		}),
	);
	platform1.position.set(-35, 3, 0);
	platform1.castShadow = true;
	platform1.receiveShadow = true;
	scene.add(platform1);
	mapObjects.push(platform1);

	const platform2 = new THREE.Mesh(
		new THREE.BoxGeometry(10, 1, 10),
		new THREE.MeshStandardMaterial({
			color: 0x666666,
			roughness: 0.8,
			metalness: 0.3,
		}),
	);
	platform2.position.set(35, 3, 0);
	platform2.castShadow = true;
	platform2.receiveShadow = true;
	scene.add(platform2);
	mapObjects.push(platform2);

	// Рампы для подъема
	const ramp1 = new THREE.Mesh(
		new THREE.BoxGeometry(6, 0.5, 8),
		new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }),
	);
	ramp1.position.set(-30, 1.5, 0);
	ramp1.rotation.z = -0.35;
	ramp1.castShadow = true;
	ramp1.receiveShadow = true;
	scene.add(ramp1);
	mapObjects.push(ramp1);

	const ramp2 = new THREE.Mesh(
		new THREE.BoxGeometry(6, 0.5, 8),
		new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }),
	);
	ramp2.position.set(30, 1.5, 0);
	ramp2.rotation.z = 0.35;
	ramp2.castShadow = true;
	ramp2.receiveShadow = true;
	scene.add(ramp2);
	mapObjects.push(ramp2);

	// Колонны разной высоты
	for (let i = 0; i < 12; i++) {
		const angle = (i / 12) * Math.PI * 2;
		const radius = 40;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const height = 2 + Math.random() * 4;
		const pillar = new THREE.Mesh(
			new THREE.BoxGeometry(2, height, 2),
			pillarMat,
		);
		pillar.position.set(x, height / 2, z);
		pillar.castShadow = true;
		pillar.receiveShadow = true;
		scene.add(pillar);
		walls.push({ mesh: pillar, x, z, w: 2, d: 2, h: height });
		mapObjects.push(pillar);
	}

	// Освещение для режима зомби
	const moonLight = new THREE.DirectionalLight(0x8899dd, 0.5);
	moonLight.position.set(-20, 40, 20);
	moonLight.castShadow = true;
	moonLight.shadow.mapSize.set(4096, 4096);
	moonLight.shadow.camera.left = -70;
	moonLight.shadow.camera.right = 70;
	moonLight.shadow.camera.top = 70;
	moonLight.shadow.camera.bottom = -70;
	scene.add(moonLight);
	mapObjects.push(moonLight);

	// Точечное освещение в центре
	const centerLight = new THREE.PointLight(0xffffaa, 2, 40);
	centerLight.position.set(0, 5, 0);
	centerLight.castShadow = true;
	scene.add(centerLight);
	mapObjects.push(centerLight);
}

function createTarget(x, z, team) {
	const g = new THREE.Group();
	let mat = targetMat;
	if (team === 'red')
		mat = new THREE.MeshStandardMaterial({
			color: 0xff4444,
			roughness: 0.3,
			metalness: 0.2,
			emissive: 0x330000,
		});
	else if (team === 'blue')
		mat = new THREE.MeshStandardMaterial({
			color: 0x4488ff,
			roughness: 0.3,
			metalness: 0.2,
			emissive: 0x000033,
		});

	const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.5), mat);
	body.position.y = 0.9;
	body.castShadow = true;
	g.add(body);

	const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mat);
	head.position.y = 2.1;
	head.castShadow = true;
	g.add(head);

	const la = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), mat);
	la.position.set(-0.55, 1.2, 0);
	g.add(la);

	const ra = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), mat);
	ra.position.set(0.55, 1.2, 0);
	g.add(ra);

	g.position.set(x, 0, z);
	scene.add(g);
	targets.push({
		group: g,
		body,
		head,
		x,
		z,
		health: 100,
		alive: true,
		hitTime: 0,
		team: team || 'neutral',
		origMat: mat,
	});
}

function getSpawnPosition() {
	if (gameState.selectedMap === 1) {
		const spawns = [
			{ x: 0, z: 0 },
			{ x: -15, z: -15 },
			{ x: 15, z: -15 },
			{ x: -15, z: 15 },
			{ x: 15, z: 15 },
			{ x: -20, z: 0 },
			{ x: 20, z: 0 },
			{ x: 0, z: -20 },
			{ x: 0, z: 20 },
		];
		return spawns[Math.floor(Math.random() * spawns.length)];
	} else if (gameState.selectedMap === 2) {
		if (gameState.selectedTeam === 'red')
			return {
				x: -22 + (Math.random() - 0.5) * 4,
				z: (Math.random() - 0.5) * 8,
			};
		else
			return {
				x: 22 + (Math.random() - 0.5) * 4,
				z: (Math.random() - 0.5) * 8,
			};
	} else {
		// Карта 3 - зомби режим
		return {
			x: (Math.random() - 0.5) * 10,
			z: (Math.random() - 0.5) * 10,
		};
	}
}

// ============ WEAPONS ============
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);

let currentWeapon = 'pistol';
let weaponModels = {};

const weaponAnim = {
	recoilZ: 0,
	recoilX: 0,
	recoilY: 0,
	reloadProgress: -1,
	bobPhase: 0,
	bobAmount: 0,
	swayX: 0,
	swayY: 0,
	switchProgress: -1,
	throwProgress: -1,
	throwCharge: 0,
	scopeProgress: 0,
	isScoped: false,
};

const muzzleFlashGroup = new THREE.Group();
const flashMat = new THREE.MeshBasicMaterial({
	color: 0xffaa33,
	transparent: true,
	opacity: 0,
});
const flashGeo1 = new THREE.PlaneGeometry(0.15, 0.15);
muzzleFlashGroup.add(new THREE.Mesh(flashGeo1, flashMat.clone()));
const f2 = new THREE.Mesh(flashGeo1, flashMat.clone());
f2.rotation.z = Math.PI / 4;
muzzleFlashGroup.add(f2);
const f3 = new THREE.Mesh(
	new THREE.PlaneGeometry(0.08, 0.25),
	flashMat.clone(),
);
f3.rotation.z = Math.PI / 2;
muzzleFlashGroup.add(f3);
muzzleFlashGroup.visible = false;
const muzzleLight = new THREE.PointLight(0xffaa44, 0, 8);
camera.add(muzzleLight);

function createPistol() {
	const g = new THREE.Group();
	const darkMat = new THREE.MeshStandardMaterial({
		color: 0x222222,
		roughness: 0.3,
		metalness: 0.9,
	});
	const gripMat = new THREE.MeshStandardMaterial({
		color: 0x1a1a1a,
		roughness: 0.8,
		metalness: 0.2,
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x111111,
		roughness: 0.2,
		metalness: 0.95,
	});
	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), darkMat),
	).position.set(0, 0.04, -0.05);
	const b = new THREE.Mesh(
		new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8),
		metalMat,
	);
	b.rotation.x = Math.PI / 2;
	b.position.set(0, 0.04, -0.22);
	g.add(b);
	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.18), darkMat),
	).position.set(0, -0.02, 0);
	const gr = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), gripMat);
	gr.position.set(0, -0.1, 0.06);
	gr.rotation.x = 0.2;
	g.add(gr);
	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.01), metalMat),
	).position.set(0, 0.09, -0.15);
	const mag = new THREE.Mesh(
		new THREE.BoxGeometry(0.035, 0.08, 0.04),
		new THREE.MeshStandardMaterial({
			color: 0x2a2a2a,
			roughness: 0.4,
			metalness: 0.8,
		}),
	);
	mag.position.set(0, -0.1, 0.02);
	mag.name = 'magazine';
	g.add(mag);
	const mp = new THREE.Object3D();
	mp.position.set(0, 0.04, -0.3);
	mp.name = 'muzzlePoint';
	g.add(mp);
	g.position.set(0.25, -0.22, -0.4);
	g.rotation.y = -0.05;
	return g;
}

function createRifle() {
	const g = new THREE.Group();
	const darkMat = new THREE.MeshStandardMaterial({
		color: 0x1a1a1a,
		roughness: 0.4,
		metalness: 0.8,
	});
	const woodMat = new THREE.MeshStandardMaterial({
		color: 0x3d2817,
		roughness: 0.8,
		metalness: 0.1,
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x222222,
		roughness: 0.3,
		metalness: 0.9,
	});
	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), darkMat),
	).position.set(0, 0, 0);
	const b = new THREE.Mesh(
		new THREE.CylinderGeometry(0.012, 0.015, 0.3, 8),
		metalMat,
	);
	b.rotation.x = Math.PI / 2;
	b.position.set(0, 0.01, -0.3);
	g.add(b);
	const sh = new THREE.Mesh(
		new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8),
		darkMat,
	);
	sh.rotation.x = Math.PI / 2;
	sh.position.set(0, 0.01, -0.22);
	g.add(sh);
	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.2), woodMat),
	).position.set(0, -0.01, 0.25);
	const gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), woodMat);
	gr.position.set(0, -0.08, 0.1);
	gr.rotation.x = 0.3;
	g.add(gr);
	const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), darkMat);
	mag.position.set(0, -0.1, -0.02);
	mag.rotation.x = 0.1;
	mag.name = 'magazine';
	g.add(mag);
	const mz = new THREE.Mesh(
		new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8),
		metalMat,
	);
	mz.rotation.x = Math.PI / 2;
	mz.position.set(0, 0.01, -0.46);
	g.add(mz);
	const mp = new THREE.Object3D();
	mp.position.set(0, 0.01, -0.5);
	mp.name = 'muzzlePoint';
	g.add(mp);
	g.position.set(0.2, -0.2, -0.45);
	g.rotation.y = -0.03;
	return g;
}

function createSSG() {
	const g = new THREE.Group();
	const darkMat = new THREE.MeshStandardMaterial({
		color: 0x1a1a1a,
		roughness: 0.3,
		metalness: 0.85,
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x111111,
		roughness: 0.2,
		metalness: 0.95,
	});
	const stockMat = new THREE.MeshStandardMaterial({
		color: 0x2a2a2a,
		roughness: 0.6,
		metalness: 0.4,
	});
	const scopeMat = new THREE.MeshStandardMaterial({
		color: 0x0a0a0a,
		roughness: 0.1,
		metalness: 0.95,
	});
	const glassMat = new THREE.MeshStandardMaterial({
		color: 0x4488ff,
		roughness: 0.0,
		metalness: 0.3,
		transparent: true,
		opacity: 0.5,
	});

	g.add(
		new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.45), darkMat),
	).position.set(0, 0, -0.05);
	const barrel = new THREE.Mesh(
		new THREE.CylinderGeometry(0.012, 0.014, 0.45, 8),
		metalMat,
	);
	barrel.rotation.x = Math.PI / 2;
	barrel.position.set(0, 0.01, -0.48);
	g.add(barrel);
	const shroud = new THREE.Mesh(
		new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
		darkMat,
	);
	shroud.rotation.x = Math.PI / 2;
	shroud.position.set(0, 0.01, -0.32);
	g.add(shroud);
	const stock = new THREE.Mesh(
		new THREE.BoxGeometry(0.04, 0.06, 0.25),
		stockMat,
	);
	stock.position.set(0, -0.01, 0.32);
	g.add(stock);
	const cheek = new THREE.Mesh(
		new THREE.BoxGeometry(0.04, 0.03, 0.1),
		stockMat,
	);
	cheek.position.set(0, 0.04, 0.3);
	g.add(cheek);
	const buttpad = new THREE.Mesh(
		new THREE.BoxGeometry(0.04, 0.08, 0.02),
		new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }),
	);
	buttpad.position.set(0, -0.01, 0.45);
	g.add(buttpad);
	const grip = new THREE.Mesh(
		new THREE.BoxGeometry(0.035, 0.1, 0.04),
		stockMat,
	);
	grip.position.set(0, -0.08, 0.08);
	grip.rotation.x = 0.25;
	g.add(grip);
	const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), darkMat);
	mag.position.set(0, -0.08, -0.05);
	mag.rotation.x = 0.05;
	mag.name = 'magazine';
	g.add(mag);
	const bolt = new THREE.Mesh(
		new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6),
		metalMat,
	);
	bolt.rotation.z = Math.PI / 2;
	bolt.position.set(0.035, 0.02, 0.05);
	g.add(bolt);
	const boltKnob = new THREE.Mesh(
		new THREE.SphereGeometry(0.012, 6, 6),
		metalMat,
	);
	boltKnob.position.set(0.055, 0.02, 0.05);
	g.add(boltKnob);

	const scopeTube = new THREE.Mesh(
		new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12),
		scopeMat,
	);
	scopeTube.rotation.x = Math.PI / 2;
	scopeTube.position.set(0, 0.065, -0.05);
	g.add(scopeTube);
	const scopeObj = new THREE.Mesh(
		new THREE.CylinderGeometry(0.028, 0.022, 0.06, 12),
		scopeMat,
	);
	scopeObj.rotation.x = Math.PI / 2;
	scopeObj.position.set(0, 0.065, -0.17);
	g.add(scopeObj);
	const scopeEye = new THREE.Mesh(
		new THREE.CylinderGeometry(0.025, 0.022, 0.04, 12),
		scopeMat,
	);
	scopeEye.rotation.x = Math.PI / 2;
	scopeEye.position.set(0, 0.065, 0.06);
	g.add(scopeEye);
	const scopeLens = new THREE.Mesh(
		new THREE.CircleGeometry(0.026, 16),
		glassMat,
	);
	scopeLens.position.set(0, 0.065, -0.2);
	g.add(scopeLens);
	const turretTop = new THREE.Mesh(
		new THREE.CylinderGeometry(0.012, 0.012, 0.025, 8),
		scopeMat,
	);
	turretTop.position.set(0, 0.095, -0.05);
	g.add(turretTop);
	const turretSide = new THREE.Mesh(
		new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8),
		scopeMat,
	);
	turretSide.rotation.z = Math.PI / 2;
	turretSide.position.set(0.032, 0.065, -0.03);
	g.add(turretSide);
	const ring1 = new THREE.Mesh(
		new THREE.TorusGeometry(0.024, 0.005, 6, 12),
		darkMat,
	);
	ring1.position.set(0, 0.065, -0.1);
	ring1.rotation.y = Math.PI / 2;
	g.add(ring1);
	const ring2 = new THREE.Mesh(
		new THREE.TorusGeometry(0.024, 0.005, 6, 12),
		darkMat,
	);
	ring2.position.set(0, 0.065, 0.0);
	ring2.rotation.y = Math.PI / 2;
	g.add(ring2);
	const bipodL = new THREE.Mesh(
		new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4),
		metalMat,
	);
	bipodL.position.set(-0.02, -0.04, -0.25);
	bipodL.rotation.z = 0.2;
	g.add(bipodL);
	const bipodR = new THREE.Mesh(
		new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4),
		metalMat,
	);
	bipodR.position.set(0.02, -0.04, -0.25);
	bipodR.rotation.z = -0.2;
	g.add(bipodR);
	const muzzle = new THREE.Mesh(
		new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8),
		metalMat,
	);
	muzzle.rotation.x = Math.PI / 2;
	muzzle.position.set(0, 0.01, -0.72);
	g.add(muzzle);
	const mp = new THREE.Object3D();
	mp.position.set(0, 0.01, -0.75);
	mp.name = 'muzzlePoint';
	g.add(mp);
	g.position.set(0.22, -0.22, -0.4);
	g.rotation.y = -0.02;
	return g;
}

function createFragGrenade() {
	const g = new THREE.Group();
	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0x3a4a2a,
		roughness: 0.6,
		metalness: 0.4,
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x222222,
		roughness: 0.3,
		metalness: 0.8,
	});
	const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), bodyMat);
	body.scale.set(1, 1.3, 1);
	g.add(body);
	for (let i = -2; i <= 2; i++) {
		const ring = new THREE.Mesh(
			new THREE.TorusGeometry(0.075, 0.008, 4, 12),
			bodyMat,
		);
		ring.position.y = i * 0.03;
		ring.rotation.x = Math.PI / 2;
		g.add(ring);
	}
	const cap = new THREE.Mesh(
		new THREE.CylinderGeometry(0.04, 0.05, 0.03, 8),
		metalMat,
	);
	cap.position.y = 0.11;
	g.add(cap);
	const lever = new THREE.Mesh(
		new THREE.BoxGeometry(0.02, 0.08, 0.04),
		metalMat,
	);
	lever.position.set(0.04, 0.1, 0);
	lever.name = 'lever';
	g.add(lever);
	return g;
}

function createSmokeGrenade() {
	const g = new THREE.Group();
	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0x556677,
		roughness: 0.5,
		metalness: 0.5,
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x333333,
		roughness: 0.3,
		metalness: 0.8,
	});
	g.add(
		new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16), bodyMat),
	);
	const top = new THREE.Mesh(
		new THREE.CylinderGeometry(0.035, 0.05, 0.02, 16),
		metalMat,
	);
	top.position.y = 0.1;
	g.add(top);
	const bot = new THREE.Mesh(
		new THREE.CylinderGeometry(0.05, 0.04, 0.02, 16),
		metalMat,
	);
	bot.position.y = -0.1;
	g.add(bot);
	const lever = new THREE.Mesh(
		new THREE.BoxGeometry(0.015, 0.04, 0.03),
		metalMat,
	);
	lever.position.set(0.04, 0.11, 0);
	lever.name = 'lever';
	g.add(lever);
	return g;
}

weaponModels.pistol = createPistol();
weaponModels.rifle = createRifle();
weaponModels.ssg = createSSG();
weaponModels.frag = createFragGrenade();
weaponModels.smoke = createSmokeGrenade();
weaponModels.frag.position.set(0.2, -0.15, -0.3);
weaponModels.frag.rotation.set(0.3, 0, 0.2);
weaponModels.smoke.position.set(0.2, -0.15, -0.3);
weaponModels.smoke.rotation.set(0, 0, 0.3);
weaponGroup.add(weaponModels.pistol);

// ============ PARTICLES & STATE ============
const shellCasings = [],
	activeGrenades = [],
	explosions = [],
	smokeClouds = [],
	bulletTrails = [];

function spawnShellCasing() {
	const geo = new THREE.CylinderGeometry(0.008, 0.006, 0.025, 6);
	const mat = new THREE.MeshStandardMaterial({
		color: 0xddaa44,
		roughness: 0.3,
		metalness: 0.9,
	});
	const shell = new THREE.Mesh(geo, mat);
	const wp = new THREE.Vector3();
	camera.getWorldPosition(wp);
	const rd = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
	const ud = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
	shell.position
		.copy(wp)
		.add(rd.clone().multiplyScalar(0.3))
		.add(ud.clone().multiplyScalar(-0.1));
	const vel = rd
		.clone()
		.multiplyScalar(2 + Math.random() * 2)
		.add(ud.clone().multiplyScalar(3 + Math.random() * 2))
		.add(
			new THREE.Vector3(
				(Math.random() - 0.5) * 2,
				0,
				(Math.random() - 0.5) * 2,
			),
		);
	scene.add(shell);
	shellCasings.push({
		mesh: shell,
		velocity: vel,
		rotVel: new THREE.Vector3(
			Math.random() * 10,
			Math.random() * 10,
			Math.random() * 10,
		),
		life: 2.0,
	});
}

const playerState = {
	velocity: new THREE.Vector3(),
	onGround: true,
	health: 100,
	score: 0,
	yaw: 0,
	pitch: 0,
};
const weaponState = {
	pistol: {
		ammo: 12,
		reserve: Infinity,
		lastFire: 0,
		reloading: false,
		_fired: false,
	},
	rifle: {
		ammo: 30,
		reserve: Infinity,
		lastFire: 0,
		reloading: false,
		_fired: false,
	},
	ssg: {
		ammo: 10,
		reserve: Infinity,
		lastFire: 0,
		reloading: false,
		_fired: false,
	},
};

const keys = {};
let mouseDown = false,
	mouseDownTime = 0,
	rightMouseDown = false,
	isLocked = false;

renderer.domElement.addEventListener('click', () => {
	if (!isLocked) {
		renderer.domElement.requestPointerLock();
		soundSystem.resume();
	}
});

document.addEventListener('keydown', e => {
	keys[e.code] = true;
});
document.addEventListener('keyup', e => {
	keys[e.code] = false;
});
document.addEventListener('mousedown', e => {
	if (e.button === 0) {
		mouseDown = true;
		mouseDownTime = performance.now();
	}
	if (e.button === 2) {
		rightMouseDown = true;
		if (currentWeapon === 'ssg' && !weaponState.ssg.reloading) {
			weaponAnim.isScoped = !weaponAnim.isScoped;
			if (weaponAnim.isScoped) soundSystem.playScopeIn();
			else soundSystem.playScopeOut();
		}
	}
});
document.addEventListener('mouseup', e => {
	if (e.button === 0) {
		const held = performance.now() - mouseDownTime;
		if (mouseDown && (currentWeapon === 'frag' || currentWeapon === 'smoke'))
			throwGrenade(currentWeapon, Math.min(held / 1000, 1.5));
		mouseDown = false;
	}
	if (e.button === 2) rightMouseDown = false;
});
document.addEventListener('mousemove', e => {
	if (!isLocked) return;
	const sens = weaponAnim.isScoped
		? CONFIG.mouseSensitivity * 0.4
		: CONFIG.mouseSensitivity;
	playerState.yaw -= e.movementX * sens;
	playerState.pitch -= e.movementY * sens;
	playerState.pitch = Math.max(
		-Math.PI / 2 + 0.1,
		Math.min(Math.PI / 2 - 0.1, playerState.pitch),
	);
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
	isLocked = document.pointerLockElement === renderer.domElement;
	document.body.classList.toggle('in-game', isLocked);
	if (!isLocked && weaponAnim.isScoped) {
		weaponAnim.isScoped = false;
		const scopeOverlay = document.getElementById('scope-overlay');
		if (scopeOverlay) scopeOverlay.classList.remove('active');
		camera.fov = 75;
		camera.updateProjectionMatrix();
	}
});
document.addEventListener('keydown', e => {
	if (e.code === 'Escape' && isLocked) document.exitPointerLock();
});

function switchWeapon(name) {
	if (name === currentWeapon) return;
	if (weaponState[currentWeapon]?.reloading) return;
	if (weaponAnim.throwProgress >= 0) return;
	if (weaponAnim.isScoped) {
		weaponAnim.isScoped = false;
		const scopeOverlay = document.getElementById('scope-overlay');
		if (scopeOverlay) scopeOverlay.classList.remove('active');
		camera.fov = 75;
		camera.updateProjectionMatrix();
	}
	weaponGroup.remove(weaponModels[currentWeapon]);
	currentWeapon = name;
	weaponGroup.add(weaponModels[name]);
	weaponAnim.recoilZ = 0;
	weaponAnim.recoilX = 0;
	weaponAnim.recoilY = 0;
	weaponAnim.switchProgress = 0;
	['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.classList.remove('active');
	});
	const slotMap = {
		pistol: 'slot-1',
		rifle: 'slot-2',
		ssg: 'slot-3',
		frag: 'slot-4',
		smoke: 'slot-5',
	};
	const slotEl = document.getElementById(slotMap[name]);
	if (slotEl) slotEl.classList.add('active');

	const nameMap = {
		pistol: 'ПИСТОЛЕТ',
		rifle: 'АВТОМАТ',
		ssg: 'SSG-08',
		frag: 'ОСКОЛОЧНАЯ',
		smoke: 'ДЫМОВАЯ',
	};
	const nameEl = document.getElementById('weapon-name');
	if (nameEl) nameEl.textContent = nameMap[name];
	updateAmmoDisplay();
}

document.addEventListener('keydown', e => {
	if (!isLocked) return;
	if (e.code === 'Digit1') switchWeapon('pistol');
	if (e.code === 'Digit2') switchWeapon('rifle');
	if (e.code === 'Digit3') switchWeapon('ssg');
	if (e.code === 'Digit4') switchWeapon('frag');
	if (e.code === 'Digit5') switchWeapon('smoke');
	if (
		e.code === 'KeyR' &&
		(currentWeapon === 'pistol' ||
			currentWeapon === 'rifle' ||
			currentWeapon === 'ssg')
	)
		reload();
});
document.addEventListener('wheel', e => {
	if (!isLocked) return;
	const order = ['pistol', 'rifle', 'ssg', 'frag', 'smoke'];
	const idx = order.indexOf(currentWeapon);
	const next = e.deltaY > 0 ? (idx + 1) % 5 : (idx + 4) % 5;
	switchWeapon(order[next]);
});

function throwGrenade(type, chargeTime) {
	if (weaponAnim.throwProgress >= 0) return;
	weaponAnim.throwProgress = 0;
	weaponAnim.throwCharge = Math.min(chargeTime / 1.5, 1);
	soundSystem.playGrenadePin();
	setTimeout(() => {
		spawnGrenade(type);
		weaponAnim.throwProgress = -1;
	}, 400);
}

function spawnGrenade(type) {
	const cfg = CONFIG.grenades[type];
	const model = type === 'frag' ? createFragGrenade() : createSmokeGrenade();
	const wp = new THREE.Vector3();
	camera.getWorldPosition(wp);
	const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
	const spawnPos = wp.clone().add(dir.clone().multiplyScalar(0.5));
	spawnPos.y -= 0.2;
	model.position.copy(spawnPos);
	const throwStrength = 0.5 + weaponAnim.throwCharge * 0.5;
	const velocity = dir.clone().multiplyScalar(cfg.throwForce * throwStrength);
	velocity.y += 3 + weaponAnim.throwCharge * 2;
	velocity.x += (Math.random() - 0.5) * 0.5;
	velocity.z += (Math.random() - 0.5) * 0.5;
	scene.add(model);
	soundSystem.playGrenadeThrow();

	const grenadeData = {
		mesh: model,
		type,
		velocity,
		angularVel: new THREE.Vector3(
			(Math.random() - 0.5) * 10,
			(Math.random() - 0.5) * 10,
			(Math.random() - 0.5) * 10,
		),
		fuseTime: cfg.fuseTime,
		age: 0,
		bounces: 0,
		pinPulled: true,
		isLocal: true,
	};
	activeGrenades.push(grenadeData);

	if (typeof socket !== 'undefined') {
		socket.emit('grenade_thrown', {
			type: type,
			position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
			velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
			fuseTime: cfg.fuseTime,
		});
	}
}

function updateAmmoDisplay() {
	const ws = weaponState[currentWeapon];
	if (ws) {
		const curEl = document.getElementById('ammo-current');
		const resEl = document.getElementById('ammo-reserve');
		if (curEl) curEl.textContent = ws.ammo;
		if (resEl) resEl.textContent = ws.reserve === Infinity ? '∞' : ws.reserve;
	}
}

function updateGrenades(dt) {
	for (let i = activeGrenades.length - 1; i >= 0; i--) {
		const g = activeGrenades[i];
		g.age += dt;
		g.velocity.y -= CONFIG.gravity * dt;
		const newPos = g.mesh.position
			.clone()
			.add(g.velocity.clone().multiplyScalar(dt));
		if (newPos.y < 0.08) {
			newPos.y = 0.08;
			g.velocity.y *= -0.4;
			g.velocity.x *= 0.7;
			g.velocity.z *= 0.7;
			g.angularVel.multiplyScalar(0.6);
			if (Math.abs(g.velocity.y) > 1) soundSystem.playGrenadeBounce();
		}
		for (const wall of walls) {
			const halfW = wall.w / 2 + 0.08,
				halfD = wall.d / 2 + 0.08;
			if (
				newPos.x > wall.x - halfW &&
				newPos.x < wall.x + halfW &&
				newPos.z > wall.z - halfD &&
				newPos.z < wall.z + halfD &&
				newPos.y < wall.h
			) {
				const dx = newPos.x - wall.x,
					dz = newPos.z - wall.z;
				if (Math.abs(dx / halfW) > Math.abs(dz / halfD)) {
					g.velocity.x *= -0.5;
					newPos.x = dx > 0 ? wall.x + halfW : wall.x - halfW;
				} else {
					g.velocity.z *= -0.5;
					newPos.z = dz > 0 ? wall.z + halfD : wall.z - halfD;
				}
				g.angularVel.multiplyScalar(0.7);
				soundSystem.playGrenadeBounce();
				break;
			}
		}
		if (Math.abs(newPos.x) > mapHalf - 0.1) {
			g.velocity.x *= -0.5;
			newPos.x = Math.sign(newPos.x) * (mapHalf - 0.1);
		}
		if (Math.abs(newPos.z) > mapHalf - 0.1) {
			g.velocity.z *= -0.5;
			newPos.z = Math.sign(newPos.z) * (mapHalf - 0.1);
		}
		g.mesh.position.copy(newPos);
		g.mesh.rotation.x += g.angularVel.x * dt;
		g.mesh.rotation.y += g.angularVel.y * dt;
		g.mesh.rotation.z += g.angularVel.z * dt;
		if (g.pinPulled && g.age > 0.1) {
			const lever = g.mesh.getObjectByName('lever');
			if (lever && !lever.userData.flying) {
				lever.userData.flying = true;
				lever.userData.flyTime = 0;
			}
			if (lever && lever.userData.flying) {
				lever.userData.flyTime += dt;
				lever.position.y += dt * 2;
				lever.position.x += dt;
				lever.rotation.z += dt * 5;
				if (lever.userData.flyTime > 0.5) g.mesh.remove(lever);
			}
		}
		if (g.age >= g.fuseTime) {
			const explosionPos = g.mesh.position.clone();
			if (g.type === 'frag') detonateFrag(explosionPos);
			else activateSmoke(explosionPos);

			if (g.isLocal && typeof socket !== 'undefined') {
				socket.emit('grenade_exploded', {
					type: g.type,
					position: { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z },
				});
			}
			scene.remove(g.mesh);
			activeGrenades.splice(i, 1);
		}
		if (g.type === 'frag' && g.age > g.fuseTime - 0.5) {
			g.mesh.children[0].material.emissive.setHex(
				Math.sin(g.age * 30) > 0 ? 0xff2200 : 0x000000,
			);
		}
	}
}

function detonateFrag(position) {
	const cfg = CONFIG.grenades.frag;
	const explosionLight = new THREE.PointLight(
		0xff6622,
		10,
		cfg.blastRadius * 2,
	);
	explosionLight.position.copy(position);
	scene.add(explosionLight);
	const fireball = new THREE.Mesh(
		new THREE.SphereGeometry(0.5, 16, 16),
		new THREE.MeshBasicMaterial({
			color: 0xff6622,
			transparent: true,
			opacity: 0.9,
		}),
	);
	fireball.position.copy(position);
	scene.add(fireball);
	const shock = new THREE.Mesh(
		new THREE.SphereGeometry(0.5, 24, 24),
		new THREE.MeshBasicMaterial({
			color: 0xffaa44,
			transparent: true,
			opacity: 0.5,
			side: THREE.BackSide,
		}),
	);
	shock.position.copy(position);
	scene.add(shock);
	explosions.push({
		light: explosionLight,
		fireball,
		shock,
		age: 0,
		maxAge: 0.6,
		radius: cfg.blastRadius,
		position: position.clone(),
		dealt: false,
	});
	for (let i = 0; i < 30; i++) {
		const p = new THREE.Mesh(
			new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 4, 4),
			new THREE.MeshBasicMaterial({
				color: Math.random() > 0.5 ? 0xff6622 : 0x444444,
				transparent: true,
				opacity: 1,
			}),
		);
		p.position.copy(position);
		scene.add(p);
		const dir = new THREE.Vector3(
			Math.random() - 0.5,
			Math.random() * 0.8 + 0.2,
			Math.random() - 0.5,
		)
			.normalize()
			.multiplyScalar(8 + Math.random() * 12);
		explosions.push({
			debris: p,
			velocity: dir,
			age: 0,
			maxAge: 1.5 + Math.random(),
			isDebris: true,
		});
	}
	soundSystem.playExplosion();
	cameraShake = 1.0;
}

function activateSmoke(position) {
	const cfg = CONFIG.grenades.smoke;
	const cloudGroup = new THREE.Group();
	cloudGroup.position.copy(position);
	const puffs = [];
	for (let i = 0; i < 50; i++) {
		const size = 0.6 + Math.random() * 0.8;
		const puff = new THREE.Mesh(
			new THREE.SphereGeometry(size, 12, 12),
			new THREE.MeshBasicMaterial({
				color: 0xdddddd,
				transparent: true,
				opacity: 0,
				depthWrite: false,
			}),
		);
		const offset = new THREE.Vector3(
			(Math.random() - 0.5) * cfg.smokeRadius * 0.3,
			Math.random() * 1.5,
			(Math.random() - 0.5) * cfg.smokeRadius * 0.3,
		);
		puff.position.copy(offset);
		cloudGroup.add(puff);
		puffs.push({
			mesh: puff,
			targetPos: offset
				.clone()
				.normalize()
				.multiplyScalar(cfg.smokeRadius * (0.5 + Math.random() * 0.5)),
			drift: new THREE.Vector3(
				(Math.random() - 0.5) * 0.2,
				Math.random() * 0.1,
				(Math.random() - 0.5) * 0.2,
			),
			size,
		});
	}
	scene.add(cloudGroup);
	smokeClouds.push({
		group: cloudGroup,
		puffs,
		position: position.clone(),
		age: 0,
		duration: cfg.smokeDuration,
		maxRadius: cfg.smokeRadius,
		lastSound: 0,
	});
	soundSystem.playSmokeStart();
}

function updateSmokeClouds(dt) {
	const smokeOverlay = document.getElementById('smoke-overlay');
	let maxSmokeIntensity = 0;
	for (let i = smokeClouds.length - 1; i >= 0; i--) {
		const cloud = smokeClouds[i];
		cloud.age += dt;
		if (cloud.age - cloud.lastSound > 1.5 && cloud.age < cloud.duration - 2) {
			soundSystem.playSmokeLoop();
			cloud.lastSound = cloud.age;
		}
		let masterOpacity;
		if (cloud.age < 1) masterOpacity = cloud.age;
		else if (cloud.age > cloud.duration - 2)
			masterOpacity = (cloud.duration - cloud.age) / 2;
		else masterOpacity = 1;
		masterOpacity = Math.max(0, Math.min(1, masterOpacity));
		cloud.puffs.forEach((p, idx) => {
			const expandProgress = Math.min(cloud.age / 2, 1);
			p.mesh.position.lerp(
				p.targetPos.clone().multiplyScalar(expandProgress),
				0.05,
			);
			p.mesh.position.add(p.drift.clone().multiplyScalar(dt));
			p.mesh.position.x += Math.sin(cloud.age * 0.5 + idx) * 0.003;
			p.mesh.position.z += Math.cos(cloud.age * 0.5 + idx * 1.3) * 0.003;
			p.mesh.position.y += dt * 0.1;
			p.mesh.material.opacity = masterOpacity * 0.85;
			p.mesh.scale.setScalar(1 + cloud.age * 0.05);
		});
		const camPos = camera.position;
		const dist = Math.sqrt(
			(camPos.x - cloud.position.x) ** 2 +
				(camPos.y - cloud.position.y) ** 2 +
				(camPos.z - cloud.position.z) ** 2,
		);
		if (
			dist < cloud.maxRadius &&
			cloud.age > 1 &&
			cloud.age < cloud.duration - 2
		) {
			const intensity = 1 - dist / cloud.maxRadius;
			maxSmokeIntensity = Math.max(maxSmokeIntensity, intensity);
		}
		if (cloud.age >= cloud.duration) {
			scene.remove(cloud.group);
			smokeClouds.splice(i, 1);
		}
	}
	if (smokeOverlay) smokeOverlay.style.opacity = maxSmokeIntensity * 0.92;
}

let cameraShake = 0;
const raycaster = new THREE.Raycaster();
let cameraRecoilX = 0,
	cameraRecoilY = 0,
	stepTimer = 0;
const defaultFOV = 75;

function showMuzzleFlash() {
	muzzleFlashGroup.visible = true;
	muzzleFlashGroup.children.forEach(c => {
		c.material.opacity = 1;
		c.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1);
		c.rotation.z = Math.random() * Math.PI;
	});
	muzzleLight.intensity = currentWeapon === 'ssg' ? 8 : 5;
	setTimeout(
		() => {
			muzzleFlashGroup.visible = false;
			muzzleLight.intensity = 0;
		},
		currentWeapon === 'ssg' ? 80 : 50,
	);
}

function createBulletTrail(origin, direction) {
	const end = origin.clone().add(direction.clone().multiplyScalar(80));
	const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
	const mat = new THREE.LineBasicMaterial({
		color: currentWeapon === 'ssg' ? 0xffff88 : 0xffcc44,
		transparent: true,
		opacity: currentWeapon === 'ssg' ? 0.6 : 0.4,
	});
	const line = new THREE.Line(geo, mat);
	scene.add(line);
	bulletTrails.push({ line, life: 0.2 });
}

function createImpactSpark(position, normal) {
	for (let i = 0; i < 5; i++) {
		const spark = new THREE.Mesh(
			new THREE.SphereGeometry(0.02, 4, 4),
			new THREE.MeshBasicMaterial({
				color: 0xffaa44,
				transparent: true,
				opacity: 1,
			}),
		);
		spark.position.copy(position);
		scene.add(spark);
		const vel = normal
			.clone()
			.multiplyScalar(2 + Math.random() * 3)
			.add(
				new THREE.Vector3(
					(Math.random() - 0.5) * 4,
					Math.random() * 3,
					(Math.random() - 0.5) * 4,
				),
			);
		bulletTrails.push({
			mesh: spark,
			velocity: vel,
			life: 0.3 + Math.random() * 0.3,
			isSpark: true,
		});
	}
	const hole = new THREE.Mesh(
		new THREE.CircleGeometry(0.06, 8),
		new THREE.MeshBasicMaterial({
			color: 0x111111,
			transparent: true,
			opacity: 0.8,
		}),
	);
	hole.position.copy(position).add(normal.clone().multiplyScalar(0.01));
	hole.lookAt(position.clone().add(normal));
	scene.add(hole);
	setTimeout(() => scene.remove(hole), 8000);
}

function shoot() {
	const ws = weaponState[currentWeapon];
	const cfg = CONFIG.weapons[currentWeapon];
	const now = performance.now();
	if (ws.reloading) return;
	if (now - ws.lastFire < cfg.fireRate) return;
	if (ws.ammo <= 0) {
		reload();
		return;
	}
	ws.lastFire = now;
	ws.ammo--;
	updateAmmoDisplay();
	weaponAnim.recoilZ = cfg.recoil * 8;
	weaponAnim.recoilX = -cfg.recoil * 15;
	weaponAnim.recoilY = (Math.random() - 0.5) * cfg.recoil * 5;
	cameraRecoilX += cfg.recoil * 0.8;
	cameraRecoilY += (Math.random() - 0.5) * cfg.recoil * 0.3;
	showMuzzleFlash();
	spawnShellCasing();
	if (currentWeapon === 'pistol') soundSystem.playPistolShot();
	else if (currentWeapon === 'rifle') soundSystem.playRifleShot();
	else if (currentWeapon === 'ssg') soundSystem.playSSGShot();

	let spread = cfg.spread;
	if (weaponAnim.isScoped) spread *= 0.1;
	const spreadX = (Math.random() - 0.5) * spread,
		spreadY = (Math.random() - 0.5) * spread;
	const dir = new THREE.Vector3(spreadX, spreadY, -1)
		.applyQuaternion(camera.quaternion)
		.normalize();
	raycaster.set(camera.position, dir);
	let hitTarget = false;
	const targetMeshes = [];

	targets.forEach(t => {
		if (!t.alive) return;
		t.group.traverse(child => {
			if (child.isMesh)
				targetMeshes.push({ mesh: child, target: t, type: 'bot' });
		});
	});

	otherPlayers.forEach((player, playerId) => {
		player.group.traverse(child => {
			if (child.isMesh)
				targetMeshes.push({
					mesh: child,
					player: player,
					playerId: playerId,
					type: 'player',
				});
		});
	});

	// Проверка попадания по зомби
	zombies.forEach(zombie => {
		if (zombie.alive) {
			zombie.group.traverse(child => {
				if (child.isMesh) {
					targetMeshes.push({ mesh: child, zombie: zombie, type: 'zombie' });
				}
			});
		}
	});

	const intersects = raycaster.intersectObjects(
		targetMeshes.map(tm => tm.mesh),
	);
	if (intersects.length > 0) {
		const td = targetMeshes.find(tm => tm.mesh === intersects[0].object);
		if (td) {
			if (td.type === 'player') {
				let dmg = cfg.damage;
				const hitPoint = intersects[0].point;
				if (hitPoint.y > td.player.group.position.y + 1.5) dmg *= 1.5;
				soundSystem.playHitSound();
				if (typeof socket !== 'undefined') {
					socket.emit('player_hit', {
						targetId: td.playerId,
						damage: dmg,
						position: hitPoint,
					});
				}
				hitTarget = true;
			} else if (td.type === 'zombie') {
				const z = td.zombie;
				let dmg = cfg.damage;
				const hitPoint = intersects[0].point;
				if (hitPoint.y > z.group.position.y + 1.5) dmg *= 2.0; // Хедшот
				z.health -= dmg;
				z.hitTime = performance.now();
				soundSystem.playHitSound();
				if (z.health <= 0) {
					z.alive = false;
					gameState.zombiesKilled++;
					playerState.score += 50;
					const scoreEl = document.getElementById('score-value');
					if (scoreEl) scoreEl.textContent = playerState.score;
					soundSystem.playKillSound();
					playZombieAnimation(z, 'death');
					z.group.traverse(child => {
						if (child.isMesh && child.material) {
							child.material.transparent = true;
							setTimeout(() => {
								const fadeOut = setInterval(() => {
									child.material.opacity -= 0.02;
									if (child.material.opacity <= 0) clearInterval(fadeOut);
								}, 50);
							}, 2000);
						}
					});
				}
				hitTarget = true;
			} else if (td.type === 'bot') {
				const t = td.target;
				let dmg = cfg.damage;
				const hitPoint = intersects[0].point;
				const headPos = new THREE.Vector3();
				t.head.getWorldPosition(headPos);
				if (hitPoint.distanceTo(headPos) < 0.35) dmg *= 1.5;
				t.health -= dmg;
				t.hitTime = performance.now();
				t.body.material = targetHitMat;
				t.head.material = targetHitMat;
				soundSystem.playHitSound();
				if (t.health <= 0) {
					t.alive = false;
					let pts = 100;
					if (gameState.selectedMap === 2) {
						if (
							(gameState.selectedTeam === 'red' && t.team === 'blue') ||
							(gameState.selectedTeam === 'blue' && t.team === 'red') ||
							t.team === 'neutral'
						) {
							gameState.teamScores[gameState.selectedTeam]++;
							pts = 150;
						} else pts = 0;
						updateTeamScores();
					}
					playerState.score += pts;
					const scoreEl = document.getElementById('score-value');
					if (scoreEl) scoreEl.textContent = playerState.score;
					soundSystem.playKillSound();
					t.group.rotation.x = -Math.PI / 2;
					t.group.position.y = 0.3;
					setTimeout(() => {
						t.health = 100;
						t.alive = true;
						t.group.visible = true;
						t.group.rotation.x = 0;
						t.group.position.y = 0;
						t.body.material = t.origMat;
						t.head.material = t.origMat;
					}, 4000);
				}
				hitTarget = true;
			}
		}
	}
	const wallMeshes = walls.map(w => w.mesh);
	const wallIntersects = raycaster.intersectObjects(wallMeshes);
	if (
		wallIntersects.length > 0 &&
		(!intersects.length || wallIntersects[0].distance < intersects[0].distance)
	) {
		createImpactSpark(wallIntersects[0].point, wallIntersects[0].face.normal);
	}
	createBulletTrail(
		camera.position.clone().add(dir.clone().multiplyScalar(0.5)),
		dir,
	);
	if (hitTarget) {
		const hm = document.getElementById('hit-marker');
		if (hm) {
			hm.classList.add('show');
			setTimeout(() => hm.classList.remove('show'), 150);
		}
	}
}

function updateTeamScores() {
	const redEl = document.getElementById('red-score-val');
	const blueEl = document.getElementById('blue-score-val');
	if (redEl) redEl.textContent = gameState.teamScores.red;
	if (blueEl) blueEl.textContent = gameState.teamScores.blue;
}

function reload() {
	const ws = weaponState[currentWeapon];
	const cfg = CONFIG.weapons[currentWeapon];
	if (ws.reloading || ws.ammo === cfg.magSize) return;
	if (weaponAnim.isScoped) {
		weaponAnim.isScoped = false;
		const scopeOverlay = document.getElementById('scope-overlay');
		if (scopeOverlay) scopeOverlay.classList.remove('active');
		camera.fov = defaultFOV;
		camera.updateProjectionMatrix();
	}
	ws.reloading = true;
	weaponAnim.reloadProgress = 0;
	const reloadText = document.getElementById('reload-text');
	const reloadBarContainer = document.getElementById('reload-bar-container');
	if (reloadText) reloadText.classList.add('show');
	if (reloadBarContainer) reloadBarContainer.classList.add('show');
	soundSystem.playReloadSound(currentWeapon);
	const startTime = performance.now();
	function updateReload() {
		if (
			currentWeapon !==
			Object.keys(weaponState).find(k => weaponState[k] === ws)
		)
			return;
		const elapsed = performance.now() - startTime;
		const progress = Math.min(elapsed / cfg.reloadTime, 1);
		weaponAnim.reloadProgress = progress;
		const reloadBar = document.getElementById('reload-bar');
		if (reloadBar) reloadBar.style.width = progress * 100 + '%';
		if (progress < 1) requestAnimationFrame(updateReload);
		else {
			ws.ammo = cfg.magSize;
			ws.reloading = false;
			weaponAnim.reloadProgress = -1;
			if (reloadText) reloadText.classList.remove('show');
			if (reloadBarContainer) reloadBarContainer.classList.remove('show');
			if (reloadBar) reloadBar.style.width = '0%';
			updateAmmoDisplay();
		}
	}
	requestAnimationFrame(updateReload);
}

function checkCollision(newX, newZ) {
	const r = CONFIG.playerRadius;
	for (const wall of walls) {
		const halfW = wall.w / 2 + r,
			halfD = wall.d / 2 + r;
		if (
			newX > wall.x - halfW &&
			newX < wall.x + halfW &&
			newZ > wall.z - halfD &&
			newZ < wall.z + halfD
		)
			return true;
	}
	const currentMapSize =
		gameState.selectedMap === 3 ? CONFIG.zombieMapSize : CONFIG.mapSize;
	const currentMapHalf = currentMapSize / 2;
	if (
		Math.abs(newX) > currentMapHalf - r ||
		Math.abs(newZ) > currentMapHalf - r
	)
		return true;
	return false;
}

// ============ ZOMBIE SYSTEM ============
const zombieAnimations = {};
let zombieModelTemplate = null;

function loadZombieModel(callback) {
	console.log('🧟 Starting zombie model load from: models/Zombie.fbx');
	fbxLoader.load(
		'models/Zombie.fbx',
		fbx => {
			console.log('✅ Zombie FBX loaded successfully:', fbx);
			const box = new THREE.Box3().setFromObject(fbx);
			const size = new THREE.Vector3();
			box.getSize(size);
			console.log('📦 Original zombie size:', size);

			const targetHeight = 1.8;
			const scale = size.y > 0 ? (targetHeight / size.y) * 1.32 : 0.01;
			fbx.scale.setScalar(scale);
			console.log('📏 Applied scale:', scale);

			const scaledBox = new THREE.Box3().setFromObject(fbx);
			const center = new THREE.Vector3();
			scaledBox.getCenter(center);
			fbx.position.x -= center.x;
			fbx.position.z -= center.z;
			const finalBox = new THREE.Box3().setFromObject(fbx);
			fbx.position.y -= finalBox.min.y;
			fbx.rotation.y = Math.PI;
			console.log('📍 Final zombie position:', fbx.position);

			fbx.traverse(child => {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
					if (child.material) {
						child.material = child.material.clone();
						child.material.color.setHex(0x446644);
						child.material.emissive.setHex(0x112211);
						child.material.emissiveIntensity = 0.3;
					}
					console.log('🎨 Configured zombie mesh:', child.name);
				}
			});

			zombieModelTemplate = fbx;
			console.log('✅ Zombie model template saved');
			callback(fbx);
		},
		xhr => {
			console.log(
				'📥 Zombie model loading:',
				((xhr.loaded / xhr.total) * 100).toFixed(2) + '%',
			);
		},
		error => {
			console.error('❌ Ошибка загрузки модели зомби:', error);
			console.error('Путь: models/Zombie.fbx');
		},
	);
}

function loadZombieAnimations(callback) {
	let loaded = 0;
	const animFiles = {
		idle: 'models/Anim_Zombie-IDLE.fbx',
		run: 'models/Anim_Zombie-Run.fbx',
		attack: 'models/Anim_Zombie-Attack.fbx',
		death: 'models/Anim_Zombie-Death.fbx',
	};

	console.log('🎬 Loading zombie animations:', Object.keys(animFiles));

	Object.keys(animFiles).forEach(key => {
		fbxLoader.load(
			animFiles[key],
			fbx => {
				if (fbx.animations && fbx.animations.length > 0) {
					zombieAnimations[key] = fbx.animations[0];
					console.log(
						`✅ Loaded zombie animation: ${key} (${fbx.animations[0].tracks.length} tracks)`,
					);
				} else {
					console.warn(`⚠️ No animations found in: ${animFiles[key]}`);
				}
				loaded++;
				if (loaded === Object.keys(animFiles).length) {
					console.log(
						'✅ All zombie animations loaded:',
						Object.keys(zombieAnimations),
					);
					callback();
				}
			},
			xhr => {
				console.log(
					`📥 ${key}:`,
					((xhr.loaded / xhr.total) * 100).toFixed(2) + '%',
				);
			},
			error => {
				console.error(`❌ Error loading zombie animation ${key}:`, error);
				loaded++;
				if (loaded === Object.keys(animFiles).length) callback();
			},
		);
	});
}

function createZombie(x, z) {
	if (!zombieModelTemplate) {
		console.error('❌ Zombie model template not loaded yet!');
		return null;
	}

	const group = new THREE.Group();
	group.position.set(x, 0, z);

	// Клонируем модель с deep clone
	const model = THREE.SkeletonUtils.clone(zombieModelTemplate);

	// Позиционируем модель внутри группы
	const box = new THREE.Box3().setFromObject(model);
	model.position.y = -box.min.y;
	model.rotation.y = Math.PI;

	// Применяем материалы
	model.traverse(child => {
		if (child.isMesh) {
			if (child.material) {
				child.material = child.material.clone();
				child.material.color.setHex(0x668844);
				child.material.emissive.setHex(0x223311);
				child.material.emissiveIntensity = 0.4;
			}
		}
	});

	group.add(model);
	scene.add(group);

	// Создаем миксер для анимаций
	const mixer = new THREE.AnimationMixer(model);
	const animations = {};

	// Привязываем анимации
	if (Object.keys(zombieAnimations).length > 0) {
		Object.keys(zombieAnimations).forEach(key => {
			const action = mixer.clipAction(zombieAnimations[key]);
			animations[key] = action;
			if (key === 'idle') {
				action.play();
			}
		});
	}

	const zombie = {
		group,
		model,
		mixer,
		animations,
		currentAnimation: 'idle',
		health: CONFIG.zombie.health,
		alive: true,
		lastAttack: 0,
		targetPlayer: null,
		hitTime: 0,
	};

	zombies.push(zombie);
	console.log('✅ Zombie created at', x, z, '- total zombies:', zombies.length);
	return zombie;
}

function playZombieAnimation(zombie, animName) {
	if (!zombie.mixer || !zombie.animations) return;
	const newAnim = zombie.animations[animName];
	if (!newAnim || zombie.currentAnimation === animName) return;
	if (zombie.currentAnimation && zombie.animations[zombie.currentAnimation]) {
		zombie.animations[zombie.currentAnimation].fadeOut(0.2);
	}
	newAnim.reset().fadeIn(0.2).play();
	zombie.currentAnimation = animName;
}

function spawnZombieWave() {
	if (gameState.selectedMap !== 3) {
		console.warn('Not in zombie mode, skipping wave spawn');
		return;
	}

	if (!zombieModelTemplate) {
		console.error('❌ Cannot spawn zombies: model not loaded');
		return;
	}

	const count = 5 + gameState.zombieWave * 2;
	const spawnRadius = 55;
	let spawned = 0;

	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2;
		const x = Math.cos(angle) * spawnRadius;
		const z = Math.sin(angle) * spawnRadius;
		const zombie = createZombie(x, z);
		if (zombie) spawned++;
	}

	console.log(
		`🧟 Волна ${gameState.zombieWave}: ${spawned}/${count} зомби заспавнено`,
	);
}

function updateZombies(dt) {
	if (gameState.selectedMap !== 3) return;

	const playerPos = camera.position;
	let aliveCount = 0;

	for (let i = zombies.length - 1; i >= 0; i--) {
		const zombie = zombies[i];

		if (zombie.mixer) {
			zombie.mixer.update(dt);
		}

		if (!zombie.alive) {
			// Удаляем мертвых зомби через 3 секунды
			if (performance.now() - zombie.hitTime > 3000) {
				scene.remove(zombie.group);
				zombies.splice(i, 1);
				console.log('🗑️ Removed dead zombie, remaining:', zombies.length);
			}
			continue;
		}

		aliveCount++;

		// AI: движение к игроку
		const dx = playerPos.x - zombie.group.position.x;
		const dz = playerPos.z - zombie.group.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);

		if (dist < CONFIG.zombie.detectionRange) {
			const angle = Math.atan2(dx, dz);
			zombie.group.rotation.y = angle;

			if (dist > CONFIG.zombie.attackRange) {
				// Движение к игроку
				const dirX = dx / dist;
				const dirZ = dz / dist;
				const newX = zombie.group.position.x + dirX * CONFIG.zombie.speed * dt;
				const newZ = zombie.group.position.z + dirZ * CONFIG.zombie.speed * dt;

				// Проверка коллизий
				if (!checkZombieCollision(newX, newZ)) {
					zombie.group.position.x = newX;
					zombie.group.position.z = newZ;
				}

				playZombieAnimation(zombie, 'run');
			} else {
				// Атака
				playZombieAnimation(zombie, 'attack');
				const now = performance.now();
				if (now - zombie.lastAttack > CONFIG.zombie.attackCooldown) {
					zombie.lastAttack = now;
					playerState.health = Math.max(
						0,
						playerState.health - CONFIG.zombie.damage,
					);
					const healthEl = document.getElementById('health-value');
					if (healthEl) healthEl.textContent = Math.floor(playerState.health);
					const overlay = document.getElementById('damage-overlay');
					if (overlay) {
						overlay.classList.add('show');
						setTimeout(() => overlay.classList.remove('show'), 300);
					}
					soundSystem.playHitSound();

					if (playerState.health <= 0) {
						handlePlayerDeath();
					}
				}
			}
		} else {
			playZombieAnimation(zombie, 'idle');
		}

		// Визуальная реакция на попадание
		if (performance.now() - zombie.hitTime < 200) {
			const ht = (performance.now() - zombie.hitTime) / 200;
			zombie.group.position.y = Math.sin(ht * Math.PI) * 0.1;
		} else {
			zombie.group.position.y *= 0.9;
		}
	}
	if (aliveCount === 0 && zombies.length === 0 && gameState.zombieWave !== 1) {
		// Спавн новой волны - только если все зомби мертвы
		// gameState.zombieWave++;
		console.log(`📈 Wave completed! Starting wave ${gameState.zombieWave}`);
		setTimeout(() => spawnZombieWave(), 3000);
	}

	// Обновление UI
	const waveEl = document.getElementById('zombie-wave');
	if (waveEl) waveEl.textContent = `Волна: ${gameState.zombieWave}`;
	const killsEl = document.getElementById('zombies-killed');
	if (killsEl) killsEl.textContent = `Убито: ${gameState.zombiesKilled}`;
}

function checkZombieCollision(x, z) {
	const r = 0.5;
	for (const wall of walls) {
		const halfW = wall.w / 2 + r;
		const halfD = wall.d / 2 + r;
		if (
			x > wall.x - halfW &&
			x < wall.x + halfW &&
			z > wall.z - halfD &&
			z < wall.z + halfD
		)
			return true;
	}
	const currentMapSize =
		gameState.selectedMap === 3 ? CONFIG.zombieMapSize : CONFIG.mapSize;
	const half = currentMapSize / 2;
	if (Math.abs(x) > half - r || Math.abs(z) > half - r) return true;
	return false;
}

function handlePlayerDeath() {
	const deathScreen = document.getElementById('death-screen');
	if (deathScreen) {
		deathScreen.classList.add('show');
		let respawnTime = 5;
		const timerElement = document.getElementById('respawn-timer');
		if (timerElement) timerElement.textContent = respawnTime;
		const countdown = setInterval(() => {
			respawnTime--;
			if (timerElement) timerElement.textContent = respawnTime;
			if (respawnTime <= 0) clearInterval(countdown);
		}, 1000);
		setTimeout(() => {
			deathScreen.classList.remove('show');
			const spawn = getSpawnPosition();
			camera.position.set(spawn.x, CONFIG.playerHeight, spawn.z);
			playerState.health = 100;
			playerState.velocity.set(0, 0, 0);
			const healthEl = document.getElementById('health-value');
			if (healthEl) healthEl.textContent = '100';

			// ВАЖНО: Полный сброс зомби-режима при смерти
			if (gameState.selectedMap === 3) {
				console.log('💀 Player died - resetting zombie mode');
				zombies.forEach(z => scene.remove(z.group));
				zombies.length = 0;
				gameState.zombieWave = 1;
				gameState.zombiesKilled = 0;
				// Небольшая задержка перед спавном первой волны
				// setTimeout(() => spawnZombieWave(), 2000);
			}
		}, 5000);
	}
}

const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

function drawMinimap() {
	if (!minimapCtx) return;
	const ctx = minimapCtx;
	const w = 150,
		h = 150;
	const currentMapSize =
		gameState.selectedMap === 3 ? CONFIG.zombieMapSize : CONFIG.mapSize;
	const scale = w / currentMapSize;
	const currentMapHalf = currentMapSize / 2;
	ctx.fillStyle = 'rgba(0,0,0,0.8)';
	ctx.fillRect(0, 0, w, h);
	if (gameState.selectedMap === 2) {
		ctx.fillStyle = 'rgba(255,68,68,0.2)';
		ctx.fillRect(
			(-currentMapHalf - 26 + currentMapHalf) * scale,
			(-7 + currentMapHalf) * scale,
			8 * scale,
			14 * scale,
		);
		ctx.fillStyle = 'rgba(68,136,255,0.2)';
		ctx.fillRect(
			(18 + currentMapHalf) * scale,
			(-7 + currentMapHalf) * scale,
			8 * scale,
			14 * scale,
		);
	}
	ctx.fillStyle = '#555';
	walls.forEach(wall => {
		const x = (wall.x + currentMapHalf) * scale,
			z = (wall.z + currentMapHalf) * scale;
		ctx.fillRect(
			x - (wall.w * scale) / 2,
			z - (wall.d * scale) / 2,
			wall.w * scale,
			wall.d * scale,
		);
	});

	// Зомби на миникарте
	if (gameState.selectedMap === 3) {
		zombies.forEach(z => {
			if (!z.alive) return;
			ctx.fillStyle = '#88ff88';
			ctx.beginPath();
			ctx.arc(
				(z.group.position.x + currentMapHalf) * scale,
				(z.group.position.z + currentMapHalf) * scale,
				3,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		});
	}

	otherPlayers.forEach(player => {
		ctx.fillStyle = '#ffff00';
		ctx.beginPath();
		ctx.arc(
			(player.group.position.x + currentMapHalf) * scale,
			(player.group.position.z + currentMapHalf) * scale,
			4,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	});

	targets.forEach(t => {
		if (!t.alive) return;
		if (t.team === 'red') ctx.fillStyle = '#ff4444';
		else if (t.team === 'blue') ctx.fillStyle = '#4488ff';
		else ctx.fillStyle = '#ffaa44';
		ctx.beginPath();
		ctx.arc(
			(t.x + currentMapHalf) * scale,
			(t.z + currentMapHalf) * scale,
			3,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	});
	activeGrenades.forEach(g => {
		ctx.fillStyle = g.type === 'frag' ? '#ffaa00' : '#88bbff';
		ctx.beginPath();
		ctx.arc(
			(g.mesh.position.x + currentMapHalf) * scale,
			(g.mesh.position.z + currentMapHalf) * scale,
			3,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	});
	smokeClouds.forEach(c => {
		ctx.fillStyle = 'rgba(200,200,200,0.4)';
		ctx.beginPath();
		ctx.arc(
			(c.position.x + currentMapHalf) * scale,
			(c.position.z + currentMapHalf) * scale,
			c.maxRadius * scale,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	});
	const px = (camera.position.x + currentMapHalf) * scale,
		pz = (camera.position.z + currentMapHalf) * scale;
	ctx.fillStyle =
		gameState.selectedMap === 2
			? gameState.selectedTeam === 'red'
				? '#ff4444'
				: '#4488ff'
			: '#44ff44';
	ctx.beginPath();
	ctx.arc(px, pz, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = ctx.fillStyle;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(px, pz);
	ctx.lineTo(
		px - Math.sin(playerState.yaw) * 10,
		pz - Math.cos(playerState.yaw) * 10,
	);
	ctx.stroke();
}

// ============ GAME LOOP ============
let lastTime = performance.now();
function update() {
	requestAnimationFrame(update);
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.05);
	lastTime = now;
	if (!isLocked) {
		renderer.render(scene, camera);
		return;
	}

	if (cameraShake > 0) {
		camera.position.x += (Math.random() - 0.5) * cameraShake * 0.1;
		camera.position.y += (Math.random() - 0.5) * cameraShake * 0.05;
		cameraShake *= 0.9;
		if (cameraShake < 0.01) cameraShake = 0;
	}

	cameraRecoilX *= 0.9;
	cameraRecoilY *= 0.9;
	playerState.pitch += cameraRecoilX * dt * 5;
	playerState.yaw += cameraRecoilY * dt * 5;
	playerState.pitch = Math.max(
		-Math.PI / 2 + 0.1,
		Math.min(Math.PI / 2 - 0.1, playerState.pitch),
	);
	camera.rotation.order = 'YXZ';
	camera.rotation.y = playerState.yaw;
	camera.rotation.x = playerState.pitch;

	const targetFOV = weaponAnim.isScoped
		? defaultFOV / CONFIG.weapons.ssg.zoom
		: defaultFOV;
	camera.fov += (targetFOV - camera.fov) * 0.15;
	camera.updateProjectionMatrix();

	const scopeOverlay = document.getElementById('scope-overlay');
	const crosshair = document.getElementById('crosshair');
	if (weaponAnim.isScoped) {
		if (scopeOverlay) scopeOverlay.classList.add('active');
		if (crosshair) crosshair.classList.add('hidden');
	} else {
		if (scopeOverlay) scopeOverlay.classList.remove('active');
		if (crosshair) crosshair.classList.remove('hidden');
	}

	const forward = new THREE.Vector3(
		-Math.sin(playerState.yaw),
		0,
		-Math.cos(playerState.yaw),
	);
	const right = new THREE.Vector3(
		Math.cos(playerState.yaw),
		0,
		-Math.sin(playerState.yaw),
	);
	const moveDir = new THREE.Vector3();
	if (keys['KeyW']) moveDir.add(forward);
	if (keys['KeyS']) moveDir.sub(forward);
	if (keys['KeyA']) moveDir.sub(right);
	if (keys['KeyD']) moveDir.add(right);
	if (moveDir.length() > 0) moveDir.normalize();

	let speed = keys['ShiftLeft'] ? CONFIG.sprintSpeed : CONFIG.moveSpeed;
	if (weaponAnim.isScoped) speed *= 0.4;
	const isMoving = moveDir.length() > 0;
	if (keys['Space'] && playerState.onGround) {
		playerState.velocity.y = CONFIG.jumpForce;
		playerState.onGround = false;
	}
	playerState.velocity.y -= CONFIG.gravity * dt;
	const newX = camera.position.x + moveDir.x * speed * dt;
	const newZ = camera.position.z + moveDir.z * speed * dt;
	if (!checkCollision(newX, camera.position.z)) camera.position.x = newX;
	if (!checkCollision(camera.position.x, newZ)) camera.position.z = newZ;
	camera.position.y += playerState.velocity.y * dt;
	if (camera.position.y <= CONFIG.playerHeight) {
		camera.position.y = CONFIG.playerHeight;
		playerState.velocity.y = 0;
		playerState.onGround = true;
	}
	if (isMoving && playerState.onGround) {
		stepTimer += dt * (keys['ShiftLeft'] ? 2.2 : 1.5);
		if (stepTimer >= 1) {
			stepTimer = 0;
			soundSystem.playFootstep();
		}
	}

	const throwIndicator = document.getElementById('throw-indicator');
	if (throwIndicator) {
		throwIndicator.classList.toggle(
			'show',
			currentWeapon === 'frag' || currentWeapon === 'smoke',
		);
	}

	// WEAPON ANIMATION
	const currentModel = weaponModels[currentWeapon];
	const basePos = {
		pistol: { x: 0.25, y: -0.22, z: -0.4 },
		rifle: { x: 0.2, y: -0.2, z: -0.45 },
		ssg: { x: 0.22, y: -0.22, z: -0.4 },
		frag: { x: 0.2, y: -0.15, z: -0.3 },
		smoke: { x: 0.2, y: -0.15, z: -0.3 },
	}[currentWeapon];

	if (isMoving && playerState.onGround) {
		weaponAnim.bobPhase += dt * (keys['ShiftLeft'] ? 14 : 10);
		weaponAnim.bobAmount = Math.min(weaponAnim.bobAmount + dt * 5, 1);
	} else weaponAnim.bobAmount *= 0.92;

	const scopeActive = currentWeapon === 'ssg' && weaponAnim.scopeProgress > 0.3;
	const bobX = scopeActive
		? 0
		: Math.sin(weaponAnim.bobPhase) * 0.006 * weaponAnim.bobAmount;
	const bobY = scopeActive
		? 0
		: Math.abs(Math.cos(weaponAnim.bobPhase)) * 0.008 * weaponAnim.bobAmount;

	weaponAnim.recoilZ *= 0.82;
	weaponAnim.recoilX *= 0.85;
	weaponAnim.recoilY *= 0.85;
	const swayTargetX = scopeActive ? 0 : -playerState.yaw * 0.01;
	const swayTargetY = scopeActive ? 0 : playerState.pitch * 0.01;
	weaponAnim.swayX += (swayTargetX - weaponAnim.swayX) * 0.1;
	weaponAnim.swayY += (swayTargetY - weaponAnim.swayY) * 0.1;

	let reloadOffsetY = 0,
		reloadOffsetZ = 0,
		reloadRotX = 0,
		magOffsetY = 0;
	if (weaponAnim.reloadProgress >= 0) {
		const p = weaponAnim.reloadProgress;
		if (currentWeapon === 'pistol') {
			if (p < 0.3) {
				const t = p / 0.3;
				reloadOffsetY = -0.15 * t;
				reloadRotX = -0.4 * t;
				magOffsetY = -0.15 * t;
			} else if (p < 0.6) {
				reloadOffsetY = -0.15;
				reloadRotX = -0.4;
				magOffsetY = -0.15;
			} else if (p < 0.85) {
				const t = (p - 0.6) / 0.25;
				reloadOffsetY = -0.15;
				reloadRotX = -0.4;
				magOffsetY = -0.15 * (1 - t);
			} else {
				const t = (p - 0.85) / 0.15;
				reloadOffsetY = -0.15 * (1 - t);
				reloadRotX = -0.4 * (1 - t);
			}
		} else if (currentWeapon === 'ssg') {
			if (p < 0.2) {
				const t = p / 0.2;
				reloadOffsetY = -0.18 * t;
				reloadRotX = -0.35 * t + 0.15 * t;
			} else if (p < 0.4) {
				reloadOffsetY = -0.18;
				reloadRotX = -0.2;
			} else if (p < 0.6) {
				const t = (p - 0.4) / 0.2;
				reloadOffsetY = -0.18;
				reloadRotX = -0.2;
				magOffsetY = -0.12 * t;
			} else if (p < 0.75) {
				const t = (p - 0.6) / 0.15;
				reloadOffsetY = -0.18;
				reloadRotX = -0.2;
				magOffsetY = -0.12 * (1 - t);
			} else if (p < 0.9) {
				const t = (p - 0.75) / 0.15;
				reloadOffsetY = -0.18 * (1 - t);
				reloadRotX = -0.2 * (1 - t);
			} else {
				reloadOffsetY = 0;
				reloadRotX = 0;
			}
		} else {
			if (p < 0.25) {
				const t = p / 0.25;
				reloadOffsetY = -0.2 * t;
				reloadRotX = -0.3 * t;
				reloadOffsetZ = -0.05 * t;
				magOffsetY = -0.2 * t;
			} else if (p < 0.5) {
				reloadOffsetY = -0.2;
				reloadRotX = -0.3;
				reloadOffsetZ = -0.05;
				magOffsetY = -0.2;
			} else if (p < 0.75) {
				const t = (p - 0.5) / 0.25;
				reloadOffsetY = -0.2;
				reloadRotX = -0.3;
				reloadOffsetZ = -0.05;
				magOffsetY = -0.2 * (1 - t);
			} else {
				const t = (p - 0.75) / 0.25;
				reloadOffsetY = -0.2 * (1 - t);
				reloadRotX = -0.3 * (1 - t);
				reloadOffsetZ = -0.05 * (1 - t);
			}
		}
	}

	let switchOffsetY = 0;
	if (weaponAnim.switchProgress >= 0) {
		weaponAnim.switchProgress += dt * 3;
		if (weaponAnim.switchProgress >= 1) weaponAnim.switchProgress = -1;
		else switchOffsetY = -0.3 * Math.sin(weaponAnim.switchProgress * Math.PI);
	}

	let throwOffsetY = 0,
		throwOffsetZ = 0,
		throwRotX = 0;
	if (weaponAnim.throwProgress >= 0) {
		weaponAnim.throwProgress += dt * 3;
		if (weaponAnim.throwProgress >= 1) weaponAnim.throwProgress = -1;
		else {
			const t = weaponAnim.throwProgress;
			if (t < 0.4) {
				const p = t / 0.4;
				throwOffsetZ = 0.1 * p;
				throwOffsetY = -0.05 * p;
				throwRotX = 0.3 * p;
			} else {
				const p = (t - 0.4) / 0.6;
				throwOffsetZ = 0.1 - 0.5 * p;
				throwOffsetY = -0.05 + 0.1 * p;
				throwRotX = 0.3 - 0.8 * p;
			}
		}
	}

	let scopeOffsetX = 0,
		scopeOffsetY = 0,
		scopeOffsetZ = 0;
	let ssgOpacity = 1;
	if (currentWeapon === 'ssg') {
		const scopeT = weaponAnim.isScoped ? 1 : 0;
		weaponAnim.scopeProgress += (scopeT - weaponAnim.scopeProgress) * 0.15;
		const sp = weaponAnim.scopeProgress;
		scopeOffsetX = -basePos.x * sp;
		scopeOffsetY = -0.15 * sp;
		scopeOffsetZ = 0.05 * sp;
		if (sp > 0.4) {
			ssgOpacity = 1.0 - (sp - 0.4) / 0.45;
			ssgOpacity = Math.max(0, Math.min(1, ssgOpacity));
		}
	}

	if (currentWeapon === 'ssg') {
		weaponModels.ssg.traverse(child => {
			if (child.isMesh && child.material) {
				child.material.transparent = true;
				child.material.opacity = ssgOpacity;
				child.material.needsUpdate = true;
			}
		});
	}

	currentModel.position.set(
		basePos.x + bobX + weaponAnim.swayX + weaponAnim.recoilY + scopeOffsetX,
		basePos.y +
			bobY +
			reloadOffsetY +
			switchOffsetY +
			throwOffsetY +
			scopeOffsetY,
		basePos.z +
			weaponAnim.recoilZ +
			reloadOffsetZ +
			throwOffsetZ +
			scopeOffsetZ,
	);

	const baseRotY = {
		pistol: -0.05,
		rifle: -0.03,
		ssg: -0.02,
		frag: 0.2,
		smoke: 0.3,
	}[currentWeapon];
	const baseRotZ = { pistol: 0, rifle: 0, ssg: 0, frag: 0.2, smoke: 0.3 }[
		currentWeapon
	];
	currentModel.rotation.set(
		weaponAnim.recoilX + reloadRotX + throwRotX,
		baseRotY,
		weaponAnim.recoilY * 0.5 + baseRotZ,
	);

	const mag = currentModel.getObjectByName('magazine');
	if (mag) {
		if (currentWeapon === 'pistol')
			mag.position.set(0, -0.1 + magOffsetY, 0.02);
		else if (currentWeapon === 'rifle')
			mag.position.set(0, -0.1 + magOffsetY, -0.02);
		else if (currentWeapon === 'ssg')
			mag.position.set(0, -0.08 + magOffsetY, -0.05);
	}

	const muzzlePoint = currentModel.getObjectByName('muzzlePoint');
	if (muzzlePoint && muzzleFlashGroup.parent !== muzzlePoint) {
		muzzlePoint.add(muzzleFlashGroup);
		muzzleFlashGroup.position.set(0, 0, 0);
		muzzleFlashGroup.rotation.set(0, 0, 0);
	}
	muzzleLight.position.set(
		currentModel.position.x,
		currentModel.position.y + 0.05,
		currentModel.position.z - 0.5,
	);

	if (
		currentWeapon === 'pistol' ||
		currentWeapon === 'rifle' ||
		currentWeapon === 'ssg'
	) {
		const cfg = CONFIG.weapons[currentWeapon];
		if (mouseDown) {
			if (cfg.auto || !weaponState[currentWeapon]._fired) {
				shoot();
				weaponState[currentWeapon]._fired = true;
			}
		} else weaponState[currentWeapon]._fired = false;
	}

	for (let i = bulletTrails.length - 1; i >= 0; i--) {
		const bt = bulletTrails[i];
		bt.life -= dt;
		if (bt.isSpark) {
			bt.velocity.y -= 15 * dt;
			bt.mesh.position.add(bt.velocity.clone().multiplyScalar(dt));
			bt.mesh.material.opacity = bt.life;
			if (bt.mesh.position.y < 0) {
				bt.mesh.position.y = 0;
				bt.velocity.y *= -0.3;
				bt.velocity.x *= 0.5;
				bt.velocity.z *= 0.5;
			}
		} else bt.line.material.opacity = bt.life / 0.2;
		if (bt.life <= 0) {
			if (bt.line) scene.remove(bt.line);
			if (bt.mesh) scene.remove(bt.mesh);
			bulletTrails.splice(i, 1);
		}
	}

	for (let i = shellCasings.length - 1; i >= 0; i--) {
		const sc = shellCasings[i];
		sc.velocity.y -= 12 * dt;
		sc.mesh.position.add(sc.velocity.clone().multiplyScalar(dt));
		sc.mesh.rotation.x += sc.rotVel.x * dt;
		sc.mesh.rotation.y += sc.rotVel.y * dt;
		sc.mesh.rotation.z += sc.rotVel.z * dt;
		sc.life -= dt;
		if (sc.mesh.position.y < 0.01) {
			sc.mesh.position.y = 0.01;
			sc.velocity.y *= -0.3;
			sc.velocity.x *= 0.6;
			sc.velocity.z *= 0.6;
			sc.rotVel.multiplyScalar(0.5);
		}
		if (sc.life <= 0) {
			scene.remove(sc.mesh);
			shellCasings.splice(i, 1);
		}
	}

	updateGrenades(dt);

	for (let i = explosions.length - 1; i >= 0; i--) {
		const e = explosions[i];
		e.age += dt;
		if (e.isDebris) {
			e.velocity.y -= 15 * dt;
			e.debris.position.add(e.velocity.clone().multiplyScalar(dt));
			e.debris.material.opacity = 1 - e.age / e.maxAge;
			if (e.debris.position.y < 0.02) {
				e.debris.position.y = 0.02;
				e.velocity.y *= -0.3;
				e.velocity.x *= 0.5;
				e.velocity.z *= 0.5;
			}
			if (e.age >= e.maxAge) {
				scene.remove(e.debris);
				explosions.splice(i, 1);
			}
		} else {
			const t = e.age / e.maxAge;
			e.fireball.scale.setScalar(1 + t * e.radius * 1.5);
			e.fireball.material.opacity = 0.9 * (1 - t);
			e.shock.scale.setScalar(1 + t * e.radius * 2);
			e.shock.material.opacity = 0.5 * (1 - t);
			e.light.intensity = 10 * (1 - t);
			if (!e.dealt && t > 0.1) {
				e.dealt = true;
				targets.forEach(tgt => {
					if (!tgt.alive) return;
					const dist = Math.sqrt(
						(tgt.x - e.position.x) ** 2 + (tgt.z - e.position.z) ** 2,
					);
					if (dist < e.radius) {
						const dmg =
							CONFIG.grenades.frag.blastDamage * (1 - dist / e.radius);
						tgt.health -= dmg;
						tgt.hitTime = performance.now();
						tgt.body.material = targetHitMat;
						tgt.head.material = targetHitMat;
						if (tgt.health <= 0) {
							tgt.alive = false;
							let pts = 150;
							if (gameState.selectedMap === 2) {
								if (
									(gameState.selectedTeam === 'red' && tgt.team === 'blue') ||
									(gameState.selectedTeam === 'blue' && tgt.team === 'red') ||
									tgt.team === 'neutral'
								) {
									gameState.teamScores[gameState.selectedTeam]++;
								} else pts = 0;
								updateTeamScores();
							}
							playerState.score += pts;
							const scoreEl = document.getElementById('score-value');
							if (scoreEl) scoreEl.textContent = playerState.score;
							soundSystem.playKillSound();
							tgt.group.rotation.x = -Math.PI / 2;
							tgt.group.position.y = 0.3;
							setTimeout(() => {
								tgt.health = 100;
								tgt.alive = true;
								tgt.group.visible = true;
								tgt.group.rotation.x = 0;
								tgt.group.position.y = 0;
								tgt.body.material = tgt.origMat;
								tgt.head.material = tgt.origMat;
							}, 4000);
						}
					}
				});
				const pdist = Math.sqrt(
					(camera.position.x - e.position.x) ** 2 +
						(camera.position.z - e.position.z) ** 2 +
						(camera.position.y - e.position.y) ** 2,
				);
				if (pdist < e.radius) {
					const dmg =
						CONFIG.grenades.frag.blastDamage * (1 - pdist / e.radius) * 0.3;
					playerState.health = Math.max(0, playerState.health - dmg);
					const healthEl = document.getElementById('health-value');
					if (healthEl) healthEl.textContent = Math.round(playerState.health);
					const damageOverlay = document.getElementById('damage-overlay');
					if (damageOverlay) {
						damageOverlay.classList.add('show');
						setTimeout(() => damageOverlay.classList.remove('show'), 300);
					}
				}
			}
			if (e.age >= e.maxAge) {
				scene.remove(e.fireball);
				scene.remove(e.shock);
				scene.remove(e.light);
				explosions.splice(i, 1);
			}
		}
	}

	updateSmokeClouds(dt);
	updateZombies(dt);

	otherPlayers.forEach(player => {
		if (player.targetPosition) {
			player.group.position.lerp(player.targetPosition, 0.2);
			if (player.targetRotation !== undefined) {
				const currentRot = player.group.rotation.y;
				let targetRot = player.targetRotation;
				let diff = targetRot - currentRot;
				if (diff > Math.PI) diff -= Math.PI * 2;
				if (diff < -Math.PI) diff += Math.PI * 2;
				player.group.rotation.y = currentRot + diff * 0.2;
			}
		}
		if (player.group.userData.mixer) {
			player.group.userData.mixer.update(dt);
		}
	});

	targets.forEach(t => {
		if (!t.alive) return;
		if (performance.now() - t.hitTime < 200) {
			const ht = (performance.now() - t.hitTime) / 200;
			t.group.position.y = Math.sin(ht * Math.PI) * 0.15;
			t.group.rotation.z = Math.sin(ht * Math.PI * 2) * 0.05;
		} else {
			t.group.position.y *= 0.9;
			t.group.rotation.z *= 0.9;
		}
		t.group.children.forEach((child, idx) => {
			if (idx > 1) child.rotation.x = Math.sin(now * 0.002 + idx) * 0.1;
		});
	});

	drawMinimap();

	if (isLocked) sendPosition();
	renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============ MULTIPLAYER SYNC ============
const otherPlayers = new Map();
const fbxLoader = new THREE.FBXLoader();
const modelCache = new Map();
const animationCache = new Map();
const characterAnimations = {};

let characterModelTemplate = null;

function loadCharacterModel(callback) {
	// Если есть шаблон - клонируем его
	if (characterModelTemplate) {
		const clone = THREE.SkeletonUtils.clone(characterModelTemplate);
		callback(clone);
		return;
	}

	// Если шаблона нет - загружаем модель
	fbxLoader.load(
		'models/Character_V1.fbx',
		fbx => {
			const box = new THREE.Box3().setFromObject(fbx);
			const size = new THREE.Vector3();
			box.getSize(size);
			const targetHeight = 1.65;
			const scale = size.y > 0 ? (targetHeight / size.y) * 1.32 : 0.01;
			fbx.scale.setScalar(scale);
			const scaledBox = new THREE.Box3().setFromObject(fbx);
			const center = new THREE.Vector3();
			scaledBox.getCenter(center);
			fbx.position.x -= center.x;
			fbx.position.z -= center.z;
			const finalBox = new THREE.Box3().setFromObject(fbx);
			fbx.position.y -= finalBox.min.y;
			fbx.traverse(child => {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});

			// Сохраняем как шаблон
			characterModelTemplate = fbx;
			console.log('✅ Character model template saved');
			callback(fbx);
		},
		xhr => {
			console.log(
				'📥 Character model loading:',
				((xhr.loaded / xhr.total) * 100).toFixed(2) + '%',
			);
		},
		error => console.error('❌ Ошибка загрузки модели персонажа:', error),
	);
}

function loadCharacterAnimations(callback) {
	let loaded = 0;
	const animFiles = {
		idle: 'models/Anim_Char_Shooting_gun.fbx',
		run: 'models/Anim_Char_Rifle_Run.fbx',
		shoot: 'models/Anim_Char_Firing_Rifle.fbx',
	};

	Object.keys(animFiles).forEach(key => {
		if (animationCache.has(key)) {
			characterAnimations[key] = animationCache.get(key);
			loaded++;
			if (loaded === Object.keys(animFiles).length) callback();
			return;
		}
		fbxLoader.load(
			animFiles[key],
			fbx => {
				if (fbx.animations && fbx.animations.length > 0) {
					characterAnimations[key] = fbx.animations[0];
					animationCache.set(key, fbx.animations[0]);
				}
				loaded++;
				if (loaded === Object.keys(animFiles).length) callback();
			},
			undefined,
			error => {
				console.error(`❌ Error loading animation ${key}:`, error);
				loaded++;
				if (loaded === Object.keys(animFiles).length) callback();
			},
		);
	});
}

function createPlayerModel(playerId, team, initialX, initialZ, initialYaw) {
	const g = new THREE.Group();
	const color =
		team === 'red' ? 0xff4444 : team === 'blue' ? 0x4488ff : 0x44ff44;

	if (initialX !== undefined && initialZ !== undefined) {
		g.position.set(initialX, 0, initialZ);
		if (initialYaw !== undefined) g.rotation.y = initialYaw;
	}

	loadCharacterModel(model => {
		const box = new THREE.Box3().setFromObject(model);
		model.position.y = -box.min.y;
		model.rotation.y = Math.PI;
		model.traverse(child => {
			if (child.isMesh && child.material) {
				child.material = child.material.clone();
				//colorize by team
				// child.material.color.setHex(color);
				// child.material.emissive.setHex(color);
				child.material.emissiveIntensity = 0.2;
			}
		});
		g.add(model);
		const mixer = new THREE.AnimationMixer(model);
		g.userData.mixer = mixer;
		g.userData.animations = {};

		if (Object.keys(characterAnimations).length > 0) {
			Object.keys(characterAnimations).forEach(key => {
				const action = mixer.clipAction(characterAnimations[key]);
				g.userData.animations[key] = action;
				if (key === 'idle') {
					action.play();
					g.userData.currentAnimation = 'idle';
				}
			});
		}
	});

	scene.add(g);
	return {
		group: g,
		playerId: playerId,
		lastUpdate: Date.now(),
		currentAnimation: 'idle',
	};
}

function playAnimation(player, animName) {
	if (!player.group.userData.mixer || !player.group.userData.animations) return;
	const animations = player.group.userData.animations;
	const newAnim = animations[animName];
	if (!newAnim || player.currentAnimation === animName) return;
	if (player.currentAnimation && animations[player.currentAnimation]) {
		animations[player.currentAnimation].fadeOut(0.2);
	}
	newAnim.reset().fadeIn(0.2).play();
	player.currentAnimation = animName;
}

let lastPositionSend = 0;
function sendPosition() {
	const now = Date.now();
	if (now - lastPositionSend < 50) return;
	lastPositionSend = now;

	let currentAnim = 'idle';
	const isMoving = keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'];
	const isShooting =
		mouseDown &&
		(currentWeapon === 'pistol' ||
			currentWeapon === 'rifle' ||
			currentWeapon === 'ssg');

	if (isShooting) currentAnim = 'shoot';
	else if (isMoving) currentAnim = 'run';

	if (typeof socket !== 'undefined') {
		socket.emit('player_position', {
			x: camera.position.x,
			y: camera.position.y,
			z: camera.position.z,
			yaw: playerState.yaw,
			pitch: playerState.pitch,
			health: playerState.health,
			animation: currentAnim,
		});
	}
}

if (typeof socket !== 'undefined') {
	socket.on('player_update', data => {
		const { playerId, x, z, yaw, animation, team } = data;
		if (!otherPlayers.has(playerId)) {
			const playerTeam = team || gameState.selectedTeam;
			otherPlayers.set(
				playerId,
				createPlayerModel(playerId, playerTeam, x, z, yaw),
			);
		}
		const player = otherPlayers.get(playerId);
		if (player) {
			player.targetPosition = new THREE.Vector3(x, 0, z);
			player.targetRotation = yaw;
			player.lastUpdate = Date.now();
			if (!player.hasInitialPosition) {
				player.group.position.copy(player.targetPosition);
				player.group.rotation.y = player.targetRotation;
				player.hasInitialPosition = true;
			}
			if (animation && animation !== player.currentAnimation)
				playAnimation(player, animation);
		}
	});

	socket.on('player_disconnected', data => {
		const player = otherPlayers.get(data.playerId);
		if (player) {
			scene.remove(player.group);
			otherPlayers.delete(data.playerId);
		}
	});

	socket.on('players_ready_update', data => {
		const playersReadyEl = document.getElementById('players-ready-status');
		if (playersReadyEl) {
			playersReadyEl.textContent = `Игроки готовы: ${data.loadedCount}/${data.totalCount}`;
		}
		console.log(`📊 Players ready: ${data.loadedCount}/${data.totalCount}`);
	});

	socket.on('player_damaged', data => {
		if (data.targetId === socket.id) {
			playerState.health = Math.max(0, playerState.health - data.damage);
			const healthEl = document.getElementById('health-value');
			if (healthEl) healthEl.textContent = Math.floor(playerState.health);
			const overlay = document.getElementById('damage-overlay');
			if (overlay) {
				overlay.classList.add('show');
				setTimeout(() => overlay.classList.remove('show'), 300);
			}
			soundSystem.playHitSound();
			if (playerState.health <= 0) {
				playerState.health = 0;
				socket.emit('player_killed', { killerId: data.playerId });
				const deathScreen = document.getElementById('death-screen');
				if (deathScreen) {
					deathScreen.classList.add('show');
					let respawnTime = 2;
					const timerElement = document.getElementById('respawn-timer');
					if (timerElement) timerElement.textContent = respawnTime;
					const countdown = setInterval(() => {
						respawnTime--;
						if (timerElement) timerElement.textContent = respawnTime;
						if (respawnTime <= 0) clearInterval(countdown);
					}, 1000);
					setTimeout(() => {
						deathScreen.classList.remove('show');
						const spawn = getSpawnPosition();
						camera.position.set(spawn.x, CONFIG.playerHeight, spawn.z);
						playerState.health = 100;
						playerState.velocity.set(0, 0, 0);
						if (healthEl) healthEl.textContent = '100';
					}, 2000);
				}
			}
		}
	});

	socket.on('player_death', data => {
		if (data.killerId === socket.id) {
			playerState.score += 100;
			const scoreEl = document.getElementById('score-value');
			if (scoreEl) scoreEl.textContent = playerState.score;
			soundSystem.playKillSound();
		}
	});

	socket.on('player_shot', () => soundSystem.playRifleShot());

	socket.on('grenade_spawn', data => {
		const model =
			data.type === 'frag' ? createFragGrenade() : createSmokeGrenade();
		model.position.set(data.position.x, data.position.y, data.position.z);
		scene.add(model);
		activeGrenades.push({
			mesh: model,
			type: data.type,
			velocity: new THREE.Vector3(
				data.velocity.x,
				data.velocity.y,
				data.velocity.z,
			),
			angularVel: new THREE.Vector3(
				(Math.random() - 0.5) * 10,
				(Math.random() - 0.5) * 10,
				(Math.random() - 0.5) * 10,
			),
			fuseTime: data.fuseTime,
			age: 0,
			bounces: 0,
			pinPulled: true,
			isLocal: false,
		});
		soundSystem.playGrenadeThrow();
	});

	socket.on('grenade_explosion', data => {
		const explosionPos = new THREE.Vector3(
			data.position.x,
			data.position.y,
			data.position.z,
		);
		if (data.type === 'frag') detonateFrag(explosionPos);
		else activateSmoke(explosionPos);
	});
}

setInterval(() => {
	const now = Date.now();
	otherPlayers.forEach((player, playerId) => {
		if (now - player.lastUpdate > 5000) {
			scene.remove(player.group);
			otherPlayers.delete(playerId);
		}
	});
}, 1000);

// ============ RESOURCE LOADING MANAGER ============
const LoadingManager = {
	progress: 0,
	status: 'Инициализация...',
	playersReady: new Map(),
	isMultiplayer: false,
	allPlayersReady: false,

	updateUI() {
		const progressBar = document.getElementById('loading-progress-bar');
		const statusEl = document.getElementById('loading-status');
		const percentageEl = document.getElementById('loading-percentage');
		const playersReadyEl = document.getElementById('players-ready-status');

		if (progressBar) progressBar.style.width = this.progress + '%';
		if (statusEl) statusEl.textContent = this.status;
		if (percentageEl)
			percentageEl.textContent = Math.floor(this.progress) + '%';

		if (this.isMultiplayer && playersReadyEl) {
			const readyCount = Array.from(this.playersReady.values()).filter(
				r => r,
			).length;
			const totalPlayers = this.playersReady.size;
			playersReadyEl.textContent = `Игроки готовы: ${readyCount}/${totalPlayers}`;
		}
	},

	setProgress(value, status) {
		this.progress = value;
		if (status) this.status = status;
		this.updateUI();
		console.log(`📊 Loading: ${Math.floor(value)}% - ${this.status}`);
	},

	hideLoadingScreen() {
		const loadingScreen = document.getElementById('loading-screen');
		if (loadingScreen) {
			loadingScreen.classList.add('hidden');
			setTimeout(() => {
				loadingScreen.style.display = 'none';
			}, 500);
		}
	},
};

// ============ ЕДИНАЯ ТОЧКА ВХОДА (Инициализация игры) ============
async function initGame() {
	try {
		console.log('🔄 Запуск инициализации игры...');

		// Проверка на мультиплеер
		LoadingManager.isMultiplayer =
			typeof socket !== 'undefined' && typeof lobbyId !== 'undefined';

		// 1. Загружаем звуки (0-20%)
		LoadingManager.setProgress(0, 'Загрузка звуков...');
		await soundSystem.initSounds();
		LoadingManager.setProgress(20, 'Звуки загружены');

		// 2. Загрузка текстур карты (20-30%)
		LoadingManager.setProgress(20, 'Загрузка текстур...');
		await new Promise(resolve => {
			let loaded = 0;
			const textures = [wallTextureURL, floorTextureURL, ceilingTextureURL];
			textures.forEach(url => {
				const img = new Image();
				img.onload = () => {
					loaded++;
					LoadingManager.setProgress(
						20 + (loaded / textures.length) * 10,
						'Загрузка текстур...',
					);
					if (loaded === textures.length) resolve();
				};
				img.onerror = () => {
					loaded++;
					if (loaded === textures.length) resolve();
				};
				img.src = url;
			});
		});
		LoadingManager.setProgress(30, 'Текстуры загружены');

		// 3. Загрузка модели персонажа (30-45%)
		LoadingManager.setProgress(30, 'Загрузка модели персонажа...');
		await new Promise(resolve => {
			loadCharacterModel(() => {
				LoadingManager.setProgress(45, 'Модель персонажа загружена');
				resolve();
			});
		});

		// 4. Загрузка анимаций персонажа (45-60%)
		LoadingManager.setProgress(45, 'Загрузка анимаций персонажа...');
		await new Promise(resolve => {
			loadCharacterAnimations(() => {
				LoadingManager.setProgress(60, 'Анимации персонажа загружены');
				resolve();
			});
		});

		// 5. Загрузка зомби для режима 3 (60-90%)
		if (gameState.selectedMap === 3) {
			LoadingManager.setProgress(60, 'Загрузка моделей зомби...');
			await new Promise(resolve => {
				loadZombieModel(() => {
					LoadingManager.setProgress(75, 'Загрузка анимаций зомби...');
					loadZombieAnimations(() => {
						LoadingManager.setProgress(90, 'Зомби загружены');
						resolve();
					});
				});
			});
		} else {
			LoadingManager.setProgress(90, 'Подготовка карты...');
		}

		// 5. Построение карты
		clearMap();
		if (gameState.selectedMap === 1) {
			buildMap1();
			const teamScoreEl = document.getElementById('team-score');
			if (teamScoreEl) teamScoreEl.classList.remove('show');
			const zombieUIEl = document.getElementById('zombie-ui');
			if (zombieUIEl) zombieUIEl.classList.remove('show');
		} else if (gameState.selectedMap === 2) {
			buildMap2();
			const teamScoreEl = document.getElementById('team-score');
			if (teamScoreEl) teamScoreEl.classList.add('show');
			updateTeamScores();
			const zombieUIEl = document.getElementById('zombie-ui');
			if (zombieUIEl) zombieUIEl.classList.remove('show');
		} else if (gameState.selectedMap === 3) {
			buildMap3();
			const teamScoreEl = document.getElementById('team-score');
			if (teamScoreEl) teamScoreEl.classList.remove('show');
			const zombieUIEl = document.getElementById('zombie-ui');
			if (zombieUIEl) zombieUIEl.classList.add('show');
			gameState.zombieWave = 1;
			gameState.zombiesKilled = 0;
			zombies.forEach(z => scene.remove(z.group));
			zombies.length = 0;
		}

		// 6. Обработка ботов
		if (typeof enableBots !== 'undefined' && !enableBots) {
			targets.forEach(t => scene.remove(t.group));
			targets.length = 0;
		}

		// 7. Спавн игрока
		const spawn = getSpawnPosition();
		camera.position.set(spawn.x, CONFIG.playerHeight, spawn.z);
		playerState.velocity.set(0, 0, 0);
		playerState.health = 100;
		playerState.yaw =
			gameState.selectedMap === 2
				? gameState.selectedTeam === 'red'
					? Math.PI / 2
					: -Math.PI / 2
				: 0;
		playerState.pitch = 0;

		const healthEl = document.getElementById('health-value');
		if (healthEl) healthEl.textContent = '100';

		setupLightsForMap(gameState.selectedMap);
		updateAmmoDisplay();

		// 8. Подключение к лобби и синхронизация с другими игроками
		LoadingManager.setProgress(95, 'Ресурсы загружены');

		if (LoadingManager.isMultiplayer) {
			// Сначала подключаемся к лобби
			console.log('🔌 Joining lobby room:', lobbyId);
			socket.emit('rejoin_game', { lobbyId });

			// Даем время на подключение
			await new Promise(resolve => setTimeout(resolve, 100));

			// Теперь сообщаем о загрузке ресурсов
			LoadingManager.setProgress(95, 'Ожидание других игроков...');
			socket.emit('player_resources_loaded', { lobbyId });

			// Ждем сигнал от сервера о готовности всех игроков
			await new Promise(resolve => {
				socket.once('all_players_ready', () => {
					LoadingManager.allPlayersReady = true;
					resolve();
				});
			});
		}

		LoadingManager.setProgress(100, 'Игра готова!');

		// 9. Запуск игры
		setTimeout(() => {
			LoadingManager.hideLoadingScreen();

			// Спавн зомби для режима 3
			if (gameState.selectedMap === 3) {
				setTimeout(() => spawnZombieWave(), 1000);
			}

			// ЗАПУСК ИГРОВОГО ЦИКЛА
			update();

			console.log('🎮 Игра запущена! Кликните для захвата курсора.');
		}, 500);
	} catch (error) {
		console.error('❌ Критическая ошибка инициализации игры:', error);
		LoadingManager.setProgress(0, 'Ошибка загрузки');
	}
}

// Запускаем инициализацию только после полной загрузки DOM
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initGame);
} else {
	initGame();
}
