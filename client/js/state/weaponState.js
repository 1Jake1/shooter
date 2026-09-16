import { CONFIG } from '../config.js';

// Состояние оружия
export const weaponState = {
	currentWeapon: 'pistol',
	isReloading: false,
	isShooting: false,
	lastShotTime: 0,
	lastReloadTime: 0,
};

const weapons = {
	pistol: { ...CONFIG.weapons.pistol },
	rifle: { ...CONFIG.weapons.rifle },
	ssg: { ...CONFIG.weapons.ssg },
};

export function getWeapon(name) {
	return weapons[name] || weapons.pistol;
}

export function getCurrentWeapon() {
	return weapons[weaponState.currentWeapon];
}

export function switchWeapon(name) {
	if (weapons[name] && !weaponState.isReloading) {
		weaponState.currentWeapon = name;
		return true;
	}
	return false;
}

export function canShoot() {
	const weapon = getCurrentWeapon();
	const now = performance.now();
	return (
		!weaponState.isReloading &&
		now - weaponState.lastShotTime >= weapon.fireRate
	);
}

export function markShot() {
	weaponState.lastShotTime = performance.now();
}

export function startReload() {
	if (weaponState.isReloading) return false;
	weaponState.isReloading = true;
	weaponState.lastReloadTime = performance.now();
	return true;
}

export function finishReload() {
	weaponState.isReloading = false;
}

export function isReloading() {
	return weaponState.isReloading;
}
