import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Состояние игрока
export const playerState = {
	health: 100,
	maxHealth: 100,
	yaw: 0,
	pitch: 0,
	velocity: new THREE.Vector3(0, 0, 0),
	isOnGround: false,
	isDead: false,
};

export function resetPlayer() {
	playerState.health = 100;
	playerState.velocity.set(0, 0, 0);
	playerState.yaw = 0;
	playerState.pitch = 0;
	playerState.isDead = false;
}

export function takeDamage(amount) {
	playerState.health = Math.max(0, playerState.health - amount);
	return playerState.health <= 0;
}

export function heal(amount) {
	playerState.health = Math.min(playerState.maxHealth, playerState.health + amount);
}
