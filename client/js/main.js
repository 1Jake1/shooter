import * as THREE from 'three';

/**
 * main.js - Точка входа в приложение
 * Координирует инициализацию всех систем и игровой цикл
 */

import { CONFIG } from './config.js';
import { gameState } from './state/gameState.js';
import { playerState, resetPlayer } from './state/playerState.js';
import { weaponState } from './state/weaponState.js';
import { SoundSystem } from './systems/SoundSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';

class Game {
	constructor() {
		this.soundSystem = new SoundSystem();
		this.inputSystem = new InputSystem();
		this.renderSystem = new RenderSystem();
		this.physicsSystem = null;
		this.lastTime = performance.now();
		this.isRunning = false;
	}

	async init() {
		console.log('🚀 Инициализация игры...');

		// Инициализация систем
		this.renderSystem.init();
		this.inputSystem.init();
		this.physicsSystem = new PhysicsSystem(this.renderSystem);

		// Загрузка звуков
		await this.soundSystem.initSounds();

		// Сброс состояния
		resetPlayer();

		// Настройка управления камерой
		this.setupCameraControls();

		this.isRunning = true;
		this.gameLoop();

		console.log('✅ Игра запущена!');
	}

	setupCameraControls() {
		document.addEventListener('click', () => {
			document.body.requestPointerLock();
		});

		document.addEventListener('mousemove', (e) => {
			if (document.pointerLockElement === document.body) {
				const sensitivity = CONFIG.mouseSensitivity;
				playerState.yaw -= e.movementX * sensitivity;
				playerState.pitch -= e.movementY * sensitivity;
				playerState.pitch = Math.max(
					-Math.PI / 2,
					Math.min(Math.PI / 2, playerState.pitch),
				);
			}
		});
	}

	gameLoop() {
		if (!this.isRunning) return;

		const currentTime = performance.now();
		const deltaTime = (currentTime - this.lastTime) / 1000;
		this.lastTime = currentTime;

		this.update(deltaTime);
		this.render();

		requestAnimationFrame(() => this.gameLoop());
	}

	update(deltaTime) {
		// Обновление состояния игрока
		this.updatePlayer(deltaTime);
	}

	updatePlayer(deltaTime) {
		const camera = this.renderSystem.getCamera();
		const speed = this.inputSystem.isKeyDown('ShiftLeft')
			? CONFIG.sprintSpeed
			: CONFIG.moveSpeed;

		let dx = 0;
		let dz = 0;

		if (this.inputSystem.isKeyDown('KeyW')) dz -= 1;
		if (this.inputSystem.isKeyDown('KeyS')) dz += 1;
		if (this.inputSystem.isKeyDown('KeyA')) dx -= 1;
		if (this.inputSystem.isKeyDown('KeyD')) dx += 1;

		if (dx !== 0 || dz !== 0) {
			// Нормализуем диагональное движение
			const length = Math.sqrt(dx * dx + dz * dz);
			dx /= length;
			dz /= length;

			// Поворачиваем направление относительно взгляда игрока
			const sin = Math.sin(playerState.yaw);
			const cos = Math.cos(playerState.yaw);

			const moveX = (dx * cos - dz * sin) * speed * deltaTime;
			const moveZ = (dx * sin + dz * cos) * speed * deltaTime;

			const newX = camera.position.x + moveX;
			const newZ = camera.position.z + moveZ;

			// Проверка коллизий
			if (!this.physicsSystem.checkCollision(newX, camera.position.z)) {
				camera.position.x = newX;
			}
			if (!this.physicsSystem.checkCollision(camera.position.x, newZ)) {
				camera.position.z = newZ;
			}
		}

		// Гравитация и прыжки
		if (this.inputSystem.isKeyDown('Space') && playerState.isOnGround) {
			playerState.velocity.y = CONFIG.jumpForce;
			playerState.isOnGround = false;
		}

		playerState.velocity.y -= CONFIG.gravity * deltaTime;
		camera.position.y += playerState.velocity.y * deltaTime;

		// Проверка земли
		if (camera.position.y <= CONFIG.playerHeight) {
			camera.position.y = CONFIG.playerHeight;
			playerState.velocity.y = 0;
			playerState.isOnGround = true;
		}

		// Обновление вращения камеры
		camera.rotation.setFromQuaternion(
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(playerState.pitch, playerState.yaw, 0, 'YXZ'),
			),
		);
	}

	render() {
		this.renderSystem.render();
	}

	stop() {
		this.isRunning = false;
	}
}

// Экспорт для использования в HTML
window.Game = Game;

// Автозапуск при загрузке DOM
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		const game = new Game();
		game.init();
	});
} else {
	const game = new Game();
	game.init();
}
