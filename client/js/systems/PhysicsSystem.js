import { CONFIG } from '../config.js';

/**
 * PhysicsSystem - Физическая система
 * Обрабатывает коллизии и движение игрока
 */
export class PhysicsSystem {
	constructor(renderSystem) {
		this.renderSystem = renderSystem;
	}

	checkCollision(newX, newZ) {
		const walls = this.renderSystem.getWalls();
		const playerRadius = CONFIG.playerRadius;

		for (const wall of walls) {
			const halfW = wall.w / 2;
			const halfD = wall.d / 2;

			const closestX = Math.max(wall.x - halfW, Math.min(newX, wall.x + halfW));
			const closestZ = Math.max(wall.z - halfD, Math.min(newZ, wall.z + halfD));

			const dx = newX - closestX;
			const dz = newZ - closestZ;
			const distance = Math.sqrt(dx * dx + dz * dz);

			if (distance < playerRadius) {
				return true;
			}
		}

		return false;
	}

	getSpawnPosition(mapId, team) {
		// Простая логика спавна - можно расширить для разных карт
		if (mapId === 2) {
			// Командная карта - разные стороны
			return team === 'red' 
				? { x: -25, z: 0 }
				: { x: 25, z: 0 };
		}
		// Остальные карты - центр
		return { x: 0, z: 0 };
	}
}
