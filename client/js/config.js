// Конфигурация игры
export const CONFIG = {
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

// Текстуры
export const TEXTURES = {
	wall: 'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/137338be7-b6f0-4fa1-b1ff-74443c54a241.png',
	floor: 'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/11c465004-2539-4864-93b5-a5687798c7b2.png',
	ceiling: 'https://image.qwenlm.ai/public_source/68419407-1f96-425b-8414-0fe117c8cfd4/1bc635045-e83d-4be1-96f7-b9699a5e6478.png',
};

// Звуки
export const SOUNDS = {
	pistol: 'sounds/pistol.mp3',
	rifle: 'sounds/rifle.mp3',
	ssg: 'sounds/ssg.mp3',
	reload_pistol: 'sounds/reload_pistol.mp3',
	reload_rifle: 'sounds/reload_rifle.mp3',
	reload_ssg: 'sounds/reload_ssg.mp3',
	footstep: 'sounds/footstep.mp3',
	footstep2: 'sounds/footstep2.mp3',
};
