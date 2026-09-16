/**
 * WeaponSystem - Система оружия, стрельбы и гранат
 */

import { CONFIG } from '../config.js';
import { weaponState, playerState } from '../state/weaponState.js';
import { soundSystem } from './SoundSystem.js';

export class WeaponSystem {
    constructor(camera, scene, walls, targets, otherPlayers, zombies) {
        this.camera = camera;
        this.scene = scene;
        this.walls = walls;
        this.targets = targets;
        this.otherPlayers = otherPlayers;
        this.zombies = zombies;
        
        this.currentWeapon = 'pistol';
        this.weaponModels = {};
        this.weaponGroup = new THREE.Group();
        this.muzzleFlashGroup = new THREE.Group();
        this.bulletTrails = [];
        this.shellCasings = [];
        this.activeGrenades = [];
        this.explosions = [];
        this.smokeClouds = [];
        
        this.raycaster = new THREE.Raycaster();
        this.cameraRecoilX = 0;
        this.cameraRecoilY = 0;
        
        this.weaponAnim = {
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
        
        this.setupMuzzleFlash();
        this.createWeaponModels();
        this.camera.add(this.weaponGroup);
        this.scene.add(this.camera);
    }
    
    setupMuzzleFlash() {
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa33,
            transparent: true,
            opacity: 0,
        });
        const flashGeo1 = new THREE.PlaneGeometry(0.15, 0.15);
        this.muzzleFlashGroup.add(new THREE.Mesh(flashGeo1, flashMat.clone()));
        const f2 = new THREE.Mesh(flashGeo1, flashMat.clone());
        f2.rotation.z = Math.PI / 4;
        this.muzzleFlashGroup.add(f2);
        const f3 = new THREE.Mesh(
            new THREE.PlaneGeometry(0.08, 0.25),
            flashMat.clone()
        );
        f3.rotation.z = Math.PI / 2;
        this.muzzleFlashGroup.add(f3);
        this.muzzleFlashGroup.visible = false;
        
        this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 8);
        this.camera.add(this.muzzleLight);
    }
    
    createWeaponModels() {
        this.weaponModels.pistol = this.createPistol();
        this.weaponModels.rifle = this.createRifle();
        this.weaponModels.ssg = this.createSSG();
        this.weaponModels.frag = this.createFragGrenade();
        this.weaponModels.smoke = this.createSmokeGrenade();
        
        this.weaponModels.frag.position.set(0.2, -0.15, -0.3);
        this.weaponModels.frag.rotation.set(0.3, 0, 0.2);
        this.weaponModels.smoke.position.set(0.2, -0.15, -0.3);
        this.weaponModels.smoke.rotation.set(0, 0, 0.3);
        
        this.weaponGroup.add(this.weaponModels.pistol);
    }
    
    createPistol() {
        const g = new THREE.Group();
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.9 });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.2 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.95 });
        
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), darkMat)).position.set(0, 0.04, -0.05);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), metalMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(0, 0.04, -0.22);
        g.add(b);
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.18), darkMat)).position.set(0, -0.02, 0);
        const gr = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), gripMat);
        gr.position.set(0, -0.1, 0.06);
        gr.rotation.x = 0.2;
        g.add(gr);
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.01), metalMat)).position.set(0, 0.09, -0.15);
        
        const mag = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.08, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.8 })
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
    
    createRifle() {
        const g = new THREE.Group();
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.8, metalness: 0.1 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.9 });
        
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), darkMat)).position.set(0, 0, 0);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.3, 8), metalMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(0, 0.01, -0.3);
        g.add(b);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), darkMat);
        sh.rotation.x = Math.PI / 2;
        sh.position.set(0, 0.01, -0.22);
        g.add(sh);
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.2), woodMat)).position.set(0, -0.01, 0.25);
        const gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), woodMat);
        gr.position.set(0, -0.08, 0.1);
        gr.rotation.x = 0.3;
        g.add(gr);
        
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), darkMat);
        mag.position.set(0, -0.1, -0.02);
        mag.rotation.x = 0.1;
        mag.name = 'magazine';
        g.add(mag);
        
        const mz = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), metalMat);
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
    
    createSSG() {
        const g = new THREE.Group();
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.85 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.95 });
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 });
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1, metalness: 0.95 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.0, metalness: 0.3, transparent: true, opacity: 0.5 });
        
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.45), darkMat)).position.set(0, 0, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.45, 8), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.01, -0.48);
        g.add(barrel);
        const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8), darkMat);
        shroud.rotation.x = Math.PI / 2;
        shroud.position.set(0, 0.01, -0.32);
        g.add(shroud);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.25), stockMat);
        stock.position.set(0, -0.01, 0.32);
        g.add(stock);
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.1), stockMat);
        cheek.position.set(0, 0.04, 0.3);
        g.add(cheek);
        const buttpad = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.08, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
        );
        buttpad.position.set(0, -0.01, 0.45);
        g.add(buttpad);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), stockMat);
        grip.position.set(0, -0.08, 0.08);
        grip.rotation.x = 0.25;
        g.add(grip);
        
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), darkMat);
        mag.position.set(0, -0.08, -0.05);
        mag.rotation.x = 0.05;
        mag.name = 'magazine';
        g.add(mag);
        
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), metalMat);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(0.035, 0.02, 0.05);
        g.add(bolt);
        const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), metalMat);
        boltKnob.position.set(0.055, 0.02, 0.05);
        g.add(boltKnob);
        
        const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12), scopeMat);
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position.set(0, 0.065, -0.05);
        g.add(scopeTube);
        const scopeObj = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.06, 12), scopeMat);
        scopeObj.rotation.x = Math.PI / 2;
        scopeObj.position.set(0, 0.065, -0.17);
        g.add(scopeObj);
        const scopeEye = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.04, 12), scopeMat);
        scopeEye.rotation.x = Math.PI / 2;
        scopeEye.position.set(0, 0.065, 0.06);
        g.add(scopeEye);
        const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), glassMat);
        scopeLens.position.set(0, 0.065, -0.2);
        g.add(scopeLens);
        const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 8), scopeMat);
        turretTop.position.set(0, 0.095, -0.05);
        g.add(turretTop);
        const turretSide = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8), scopeMat);
        turretSide.rotation.z = Math.PI / 2;
        turretSide.position.set(0.032, 0.065, -0.03);
        g.add(turretSide);
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 12), darkMat);
        ring1.position.set(0, 0.065, -0.1);
        ring1.rotation.y = Math.PI / 2;
        g.add(ring1);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 12), darkMat);
        ring2.position.set(0, 0.065, 0.0);
        ring2.rotation.y = Math.PI / 2;
        g.add(ring2);
        const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), metalMat);
        bipodL.position.set(-0.02, -0.04, -0.25);
        bipodL.rotation.z = 0.2;
        g.add(bipodL);
        const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), metalMat);
        bipodR.position.set(0.02, -0.04, -0.25);
        bipodR.rotation.z = -0.2;
        g.add(bipodR);
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), metalMat);
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
    
    createFragGrenade() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.6, metalness: 0.4 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
        
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), bodyMat);
        body.scale.set(1, 1.3, 1);
        g.add(body);
        
        for (let i = -2; i <= 2; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.075, 0.008, 4, 12),
                bodyMat
            );
            ring.position.y = i * 0.03;
            ring.rotation.x = Math.PI / 2;
            g.add(ring);
        }
        
        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.05, 0.03, 8),
            metalMat
        );
        cap.position.y = 0.11;
        g.add(cap);
        
        const lever = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.08, 0.04),
            metalMat
        );
        lever.position.set(0.04, 0.1, 0);
        lever.name = 'lever';
        g.add(lever);
        
        return g;
    }
    
    createSmokeGrenade() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.5, metalness: 0.5 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.8 });
        
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16), bodyMat));
        
        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.05, 0.02, 16),
            metalMat
        );
        top.position.y = 0.1;
        g.add(top);
        
        const bot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.04, 0.02, 16),
            metalMat
        );
        bot.position.y = -0.1;
        g.add(bot);
        
        const lever = new THREE.Mesh(
            new THREE.BoxGeometry(0.015, 0.04, 0.03),
            metalMat
        );
        lever.position.set(0.04, 0.11, 0);
        lever.name = 'lever';
        g.add(lever);
        
        return g;
    }
    
    switchWeapon(name) {
        if (name === this.currentWeapon) return;
        if (weaponState[this.currentWeapon]?.reloading) return;
        if (this.weaponAnim.throwProgress >= 0) return;
        
        if (this.weaponAnim.isScoped) {
            this.weaponAnim.isScoped = false;
            const scopeOverlay = document.getElementById('scope-overlay');
            if (scopeOverlay) scopeOverlay.classList.remove('active');
            this.camera.fov = 75;
            this.camera.updateProjectionMatrix();
        }
        
        this.weaponGroup.remove(this.weaponModels[this.currentWeapon]);
        this.currentWeapon = name;
        this.weaponGroup.add(this.weaponModels[name]);
        
        this.weaponAnim.recoilZ = 0;
        this.weaponAnim.recoilX = 0;
        this.weaponAnim.recoilY = 0;
        this.weaponAnim.switchProgress = 0;
        
        // Обновляем UI
        ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        
        const slotMap = { pistol: 'slot-1', rifle: 'slot-2', ssg: 'slot-3', frag: 'slot-4', smoke: 'slot-5' };
        const slotEl = document.getElementById(slotMap[name]);
        if (slotEl) slotEl.classList.add('active');
        
        const nameMap = { pistol: 'ПИСТОЛЕТ', rifle: 'АВТОМАТ', ssg: 'SSG-08', frag: 'ОСКОЛОЧНАЯ', smoke: 'ДЫМОВАЯ' };
        const nameEl = document.getElementById('weapon-name');
        if (nameEl) nameEl.textContent = nameMap[name];
        
        this.updateAmmoDisplay();
    }
    
    updateAmmoDisplay() {
        const ws = weaponState[this.currentWeapon];
        if (ws) {
            const curEl = document.getElementById('ammo-current');
            const resEl = document.getElementById('ammo-reserve');
            if (curEl) curEl.textContent = ws.ammo;
            if (resEl) resEl.textContent = ws.reserve === Infinity ? '∞' : ws.reserve;
        }
    }
    
    shoot() {
        const ws = weaponState[this.currentWeapon];
        const cfg = CONFIG.weapons[this.currentWeapon];
        const now = performance.now();
        
        if (ws.reloading) return;
        if (now - ws.lastFire < cfg.fireRate) return;
        if (ws.ammo <= 0) {
            this.reload();
            return;
        }
        
        ws.lastFire = now;
        ws.ammo--;
        this.updateAmmoDisplay();
        
        this.weaponAnim.recoilZ = cfg.recoil * 8;
        this.weaponAnim.recoilX = -cfg.recoil * 15;
        this.weaponAnim.recoilY = (Math.random() - 0.5) * cfg.recoil * 5;
        this.cameraRecoilX += cfg.recoil * 0.8;
        this.cameraRecoilY += (Math.random() - 0.5) * cfg.recoil * 0.3;
        
        this.showMuzzleFlash();
        this.spawnShellCasing();
        
        if (this.currentWeapon === 'pistol') soundSystem.playPistolShot();
        else if (this.currentWeapon === 'rifle') soundSystem.playRifleShot();
        else if (this.currentWeapon === 'ssg') soundSystem.playSSGShot();
        
        let spread = cfg.spread;
        if (this.weaponAnim.isScoped) spread *= 0.1;
        const spreadX = (Math.random() - 0.5) * spread;
        const spreadY = (Math.random() - 0.5) * spread;
        
        const dir = new THREE.Vector3(spreadX, spreadY, -1)
            .applyQuaternion(this.camera.quaternion)
            .normalize();
        
        this.raycaster.set(this.camera.position, dir);
        let hitTarget = false;
        const targetMeshes = [];
        
        // Собираем все возможные цели
        this.targets.forEach(t => {
            if (!t.alive) return;
            t.group.traverse(child => {
                if (child.isMesh) targetMeshes.push({ mesh: child, target: t, type: 'bot' });
            });
        });
        
        this.otherPlayers.forEach((player, playerId) => {
            player.group.traverse(child => {
                if (child.isMesh) targetMeshes.push({ mesh: child, player, playerId, type: 'player' });
            });
        });
        
        this.zombies.forEach(zombie => {
            if (zombie.alive) {
                zombie.group.traverse(child => {
                    if (child.isMesh) targetMeshes.push({ mesh: child, zombie, type: 'zombie' });
                });
            }
        });
        
        const intersects = this.raycaster.intersectObjects(targetMeshes.map(tm => tm.mesh));
        
        if (intersects.length > 0) {
            const td = targetMeshes.find(tm => tm.mesh === intersects[0].object);
            if (td) {
                if (td.type === 'player') {
                    let dmg = cfg.damage;
                    const hitPoint = intersects[0].point;
                    if (hitPoint.y > td.player.group.position.y + 1.5) dmg *= 1.5;
                    soundSystem.playHitSound();
                    
                    if (typeof socket !== 'undefined') {
                        socket.emit('player_hit', { targetId: td.playerId, damage: dmg, position: hitPoint });
                    }
                    hitTarget = true;
                } else if (td.type === 'zombie') {
                    const z = td.zombie;
                    let dmg = cfg.damage;
                    const hitPoint = intersects[0].point;
                    if (hitPoint.y > z.group.position.y + 1.5) dmg *= 2.0;
                    
                    z.health -= dmg;
                    z.hitTime = performance.now();
                    soundSystem.playHitSound();
                    
                    if (z.health <= 0) {
                        z.alive = false;
                        // gameState.zombiesKilled++ будет обработано в main.js
                        playerState.score += 50;
                        soundSystem.playKillSound();
                        // Анимация смерти будет вызвана извне
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
                    soundSystem.playHitSound();
                    
                    if (t.health <= 0) {
                        t.alive = false;
                        playerState.score += 100;
                        soundSystem.playKillSound();
                        // Респавн бота будет обработан в main.js
                    }
                    hitTarget = true;
                }
            }
        }
        
        // Проверка попадания в стены
        const wallMeshes = this.walls.map(w => w.mesh);
        const wallIntersects = this.raycaster.intersectObjects(wallMeshes);
        if (wallIntersects.length > 0 && (!intersects.length || wallIntersects[0].distance < intersects[0].distance)) {
            this.createImpactSpark(wallIntersects[0].point, wallIntersects[0].face.normal);
        }
        
        this.createBulletTrail(
            this.camera.position.clone().add(dir.clone().multiplyScalar(0.5)),
            dir
        );
        
        if (hitTarget) {
            const hm = document.getElementById('hit-marker');
            if (hm) {
                hm.classList.add('show');
                setTimeout(() => hm.classList.remove('show'), 150);
            }
        }
    }
    
    showMuzzleFlash() {
        this.muzzleFlashGroup.visible = true;
        this.muzzleFlashGroup.children.forEach(c => {
            c.material.opacity = 1;
            c.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1);
            c.rotation.z = Math.random() * Math.PI;
        });
        this.muzzleLight.intensity = this.currentWeapon === 'ssg' ? 8 : 5;
        setTimeout(() => {
            this.muzzleFlashGroup.visible = false;
            this.muzzleLight.intensity = 0;
        }, this.currentWeapon === 'ssg' ? 80 : 50);
    }
    
    spawnShellCasing() {
        const geo = new THREE.CylinderGeometry(0.008, 0.006, 0.025, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0xddaa44, roughness: 0.3, metalness: 0.9 });
        const shell = new THREE.Mesh(geo, mat);
        
        const wp = new THREE.Vector3();
        this.camera.getWorldPosition(wp);
        const rd = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const ud = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        
        shell.position.copy(wp).add(rd.clone().multiplyScalar(0.3)).add(ud.clone().multiplyScalar(-0.1));
        
        const vel = rd.clone().multiplyScalar(2 + Math.random() * 2)
            .add(ud.clone().multiplyScalar(3 + Math.random() * 2))
            .add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
        
        this.scene.add(shell);
        this.shellCasings.push({
            mesh: shell,
            velocity: vel,
            rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
            life: 2.0,
        });
    }
    
    createBulletTrail(origin, direction) {
        const end = origin.clone().add(direction.clone().multiplyScalar(80));
        const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
        const mat = new THREE.LineBasicMaterial({
            color: this.currentWeapon === 'ssg' ? 0xffff88 : 0xffcc44,
            transparent: true,
            opacity: this.currentWeapon === 'ssg' ? 0.6 : 0.4,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.bulletTrails.push({ line, life: 0.2 });
    }
    
    createImpactSpark(position, normal) {
        for (let i = 0; i < 5; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 1 })
            );
            spark.position.copy(position);
            this.scene.add(spark);
            
            const vel = normal.clone().multiplyScalar(2 + Math.random() * 3)
                .add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
            
            this.bulletTrails.push({
                mesh: spark,
                velocity: vel,
                life: 0.3 + Math.random() * 0.3,
                isSpark: true,
            });
        }
        
        const hole = new THREE.Mesh(
            new THREE.CircleGeometry(0.06, 8),
            new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 })
        );
        hole.position.copy(position).add(normal.clone().multiplyScalar(0.01));
        hole.lookAt(position.clone().add(normal));
        this.scene.add(hole);
        setTimeout(() => this.scene.remove(hole), 8000);
    }
    
    reload() {
        const ws = weaponState[this.currentWeapon];
        const cfg = CONFIG.weapons[this.currentWeapon];
        
        if (ws.reloading || ws.ammo === cfg.magSize) return;
        
        if (this.weaponAnim.isScoped) {
            this.weaponAnim.isScoped = false;
            const scopeOverlay = document.getElementById('scope-overlay');
            if (scopeOverlay) scopeOverlay.classList.remove('active');
            this.camera.fov = 75;
            this.camera.updateProjectionMatrix();
        }
        
        ws.reloading = true;
        this.weaponAnim.reloadProgress = 0;
        
        const reloadText = document.getElementById('reload-text');
        const reloadBarContainer = document.getElementById('reload-bar-container');
        if (reloadText) reloadText.classList.add('show');
        if (reloadBarContainer) reloadBarContainer.classList.add('show');
        
        soundSystem.playReloadSound(this.currentWeapon);
        
        const startTime = performance.now();
        const updateReload = () => {
            const currentWs = weaponState[this.currentWeapon];
            if (!currentWs || currentWs !== ws) return;
            
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / cfg.reloadTime, 1);
            this.weaponAnim.reloadProgress = progress;
            
            const reloadBar = document.getElementById('reload-bar');
            if (reloadBar) reloadBar.style.width = progress * 100 + '%';
            
            if (progress < 1) {
                requestAnimationFrame(updateReload);
            } else {
                ws.ammo = cfg.magSize;
                ws.reloading = false;
                this.weaponAnim.reloadProgress = -1;
                
                if (reloadText) reloadText.classList.remove('show');
                if (reloadBarContainer) reloadBarContainer.classList.remove('show');
                if (reloadBar) reloadBar.style.width = '0%';
                
                this.updateAmmoDisplay();
            }
        };
        requestAnimationFrame(updateReload);
    }
    
    throwGrenade(type, chargeTime) {
        if (this.weaponAnim.throwProgress >= 0) return;
        
        this.weaponAnim.throwProgress = 0;
        this.weaponAnim.throwCharge = Math.min(chargeTime / 1000, 1.5);
        soundSystem.playGrenadePin();
        
        setTimeout(() => {
            this.spawnGrenade(type);
            this.weaponAnim.throwProgress = -1;
        }, 400);
    }
    
    spawnGrenade(type) {
        const cfg = CONFIG.grenades[type];
        const model = type === 'frag' ? this.createFragGrenade() : this.createSmokeGrenade();
        
        const wp = new THREE.Vector3();
        this.camera.getWorldPosition(wp);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const spawnPos = wp.clone().add(dir.clone().multiplyScalar(0.5));
        spawnPos.y -= 0.2;
        
        model.position.copy(spawnPos);
        
        const throwStrength = 0.5 + this.weaponAnim.throwCharge * 0.5;
        const velocity = dir.clone().multiplyScalar(cfg.throwForce * throwStrength);
        velocity.y += 3 + this.weaponAnim.throwCharge * 2;
        velocity.x += (Math.random() - 0.5) * 0.5;
        velocity.z += (Math.random() - 0.5) * 0.5;
        
        this.scene.add(model);
        soundSystem.playGrenadeThrow();
        
        const grenadeData = {
            mesh: model,
            type,
            velocity,
            angularVel: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ),
            fuseTime: cfg.fuseTime,
            age: 0,
            bounces: 0,
            pinPulled: true,
            isLocal: true,
        };
        
        this.activeGrenades.push(grenadeData);
        
        if (typeof socket !== 'undefined') {
            socket.emit('grenade_thrown', {
                type,
                position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
                velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
                fuseTime: cfg.fuseTime,
            });
        }
    }
    
    updateGrenades(dt, mapHalf) {
        for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
            const g = this.activeGrenades[i];
            g.age += dt;
            g.velocity.y -= CONFIG.gravity * dt;
            
            const newPos = g.mesh.position.clone().add(g.velocity.clone().multiplyScalar(dt));
            
            // Коллизия с полом
            if (newPos.y < 0.08) {
                newPos.y = 0.08;
                g.velocity.y *= -0.4;
                g.velocity.x *= 0.7;
                g.velocity.z *= 0.7;
                g.angularVel.multiplyScalar(0.6);
                if (Math.abs(g.velocity.y) > 1) soundSystem.playGrenadeBounce();
            }
            
            // Коллизия со стенами
            for (const wall of this.walls) {
                const halfW = wall.w / 2 + 0.08;
                const halfD = wall.d / 2 + 0.08;
                if (newPos.x > wall.x - halfW && newPos.x < wall.x + halfW &&
                    newPos.z > wall.z - halfD && newPos.z < wall.z + halfD &&
                    newPos.y < wall.h) {
                    
                    const dx = newPos.x - wall.x;
                    const dz = newPos.z - wall.z;
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
            
            // Границы карты
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
            
            // Анимация чеки гранаты
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
            
            // Взрыв
            if (g.age >= g.fuseTime) {
                const explosionPos = g.mesh.position.clone();
                if (g.type === 'frag') this.detonateFrag(explosionPos);
                else this.activateSmoke(explosionPos);
                
                if (g.isLocal && typeof socket !== 'undefined') {
                    socket.emit('grenade_exploded', {
                        type: g.type,
                        position: { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z },
                    });
                }
                
                this.scene.remove(g.mesh);
                this.activeGrenades.splice(i, 1);
            }
            
            // Мигание перед взрывом
            if (g.type === 'frag' && g.age > g.fuseTime - 0.5) {
                g.mesh.children[0].material.emissive.setHex(
                    Math.sin(g.age * 30) > 0 ? 0xff2200 : 0x000000
                );
            }
        }
    }
    
    detonateFrag(position) {
        const cfg = CONFIG.grenades.frag;
        
        const explosionLight = new THREE.PointLight(0xff6622, 10, cfg.blastRadius * 2);
        explosionLight.position.copy(position);
        this.scene.add(explosionLight);
        
        const fireball = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.9 })
        );
        fireball.position.copy(position);
        this.scene.add(fireball);
        
        const shock = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 24, 24),
            new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.5, side: THREE.BackSide })
        );
        shock.position.copy(position);
        this.scene.add(shock);
        
        this.explosions.push({
            light: explosionLight,
            fireball,
            shock,
            age: 0,
            maxAge: 0.6,
            radius: cfg.blastRadius,
            position: position.clone(),
            dealt: false,
        });
        
        // Осколки
        for (let i = 0; i < 30; i++) {
            const p = new THREE.Mesh(
                new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0xff6622 : 0x444444,
                    transparent: true,
                    opacity: 1,
                })
            );
            p.position.copy(position);
            this.scene.add(p);
            
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
                .normalize()
                .multiplyScalar(8 + Math.random() * 12);
            
            this.explosions.push({
                debris: p,
                velocity: dir,
                age: 0,
                maxAge: 1.5 + Math.random(),
                isDebris: true,
            });
        }
        
        soundSystem.playExplosion();
    }
    
    activateSmoke(position) {
        const cfg = CONFIG.grenades.smoke;
        const cloudGroup = new THREE.Group();
        cloudGroup.position.copy(position);
        
        const puffs = [];
        for (let i = 0; i < 50; i++) {
            const size = 0.6 + Math.random() * 0.8;
            const puff = new THREE.Mesh(
                new THREE.SphereGeometry(size, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false })
            );
            
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * cfg.smokeRadius * 0.3,
                Math.random() * 1.5,
                (Math.random() - 0.5) * cfg.smokeRadius * 0.3
            );
            puff.position.copy(offset);
            cloudGroup.add(puff);
            
            puffs.push({
                mesh: puff,
                targetPos: offset.clone().normalize().multiplyScalar(cfg.smokeRadius * (0.5 + Math.random() * 0.5)),
                drift: new THREE.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.1, (Math.random() - 0.5) * 0.2),
                size,
            });
        }
        
        this.scene.add(cloudGroup);
        this.smokeClouds.push({
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
    
    updateSmokeClouds(dt) {
        const smokeOverlay = document.getElementById('smoke-overlay');
        let maxSmokeIntensity = 0;
        
        for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
            const cloud = this.smokeClouds[i];
            cloud.age += dt;
            
            if (cloud.age - cloud.lastSound > 1.5 && cloud.age < cloud.duration - 2) {
                soundSystem.playSmokeLoop();
                cloud.lastSound = cloud.age;
            }
            
            let masterOpacity;
            if (cloud.age < 1) masterOpacity = cloud.age;
            else if (cloud.age > cloud.duration - 2) masterOpacity = (cloud.duration - cloud.age) / 2;
            else masterOpacity = 1;
            masterOpacity = Math.max(0, Math.min(1, masterOpacity));
            
            cloud.puffs.forEach((p, idx) => {
                const expandProgress = Math.min(cloud.age / 2, 1);
                p.mesh.position.lerp(p.targetPos.clone().multiplyScalar(expandProgress), 0.05);
                p.mesh.position.add(p.drift.clone().multiplyScalar(dt));
                p.mesh.position.x += Math.sin(cloud.age * 0.5 + idx) * 0.003;
                p.mesh.position.z += Math.cos(cloud.age * 0.5 + idx * 1.3) * 0.003;
                p.mesh.position.y += dt * 0.1;
                p.mesh.material.opacity = masterOpacity * 0.85;
                p.mesh.scale.setScalar(1 + cloud.age * 0.05);
            });
            
            const camPos = this.camera.position;
            const dist = Math.sqrt(
                (camPos.x - cloud.position.x) ** 2 +
                (camPos.y - cloud.position.y) ** 2 +
                (camPos.z - cloud.position.z) ** 2
            );
            
            if (dist < cloud.maxRadius && cloud.age > 1 && cloud.age < cloud.duration - 2) {
                const intensity = 1 - dist / cloud.maxRadius;
                maxSmokeIntensity = Math.max(maxSmokeIntensity, intensity);
            }
            
            if (cloud.age >= cloud.duration) {
                this.scene.remove(cloud.group);
                this.smokeClouds.splice(i, 1);
            }
        }
        
        if (smokeOverlay) smokeOverlay.style.opacity = maxSmokeIntensity * 0.92;
    }
    
    updateExplosions(dt, targets, teamScores, selectedTeam, selectedMap) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
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
                    this.scene.remove(e.debris);
                    this.explosions.splice(i, 1);
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
                    
                    // Урон по ботам
                    targets.forEach(tgt => {
                        if (!tgt.alive) return;
                        const dist = Math.sqrt((tgt.x - e.position.x) ** 2 + (tgt.z - e.position.z) ** 2);
                        if (dist < e.radius) {
                            const dmg = CONFIG.grenades.frag.blastDamage * (1 - dist / e.radius);
                            tgt.health -= dmg;
                            tgt.hitTime = performance.now();
                            
                            if (tgt.health <= 0) {
                                tgt.alive = false;
                                let pts = 150;
                                if (selectedMap === 2) {
                                    if ((selectedTeam === 'red' && tgt.team === 'blue') ||
                                        (selectedTeam === 'blue' && tgt.team === 'red') || tgt.team === 'neutral') {
                                        teamScores[selectedTeam]++;
                                    } else pts = 0;
                                }
                                playerState.score += pts;
                                soundSystem.playKillSound();
                            }
                        }
                    });
                    
                    // Урон по игроку
                    const pdist = Math.sqrt(
                        (this.camera.position.x - e.position.x) ** 2 +
                        (this.camera.position.z - e.position.z) ** 2 +
                        (this.camera.position.y - e.position.y) ** 2
                    );
                    if (pdist < e.radius) {
                        const dmg = CONFIG.grenades.frag.blastDamage * (1 - pdist / e.radius) * 0.3;
                        playerState.health = Math.max(0, playerState.health - dmg);
                    }
                }
                
                if (e.age >= e.maxAge) {
                    this.scene.remove(e.fireball);
                    this.scene.remove(e.shock);
                    this.scene.remove(e.light);
                    this.explosions.splice(i, 1);
                }
            }
        }
    }
    
    updateBulletTrails(dt) {
        for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
            const bt = this.bulletTrails[i];
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
            } else {
                bt.line.material.opacity = bt.life / 0.2;
            }
            
            if (bt.life <= 0) {
                if (bt.line) this.scene.remove(bt.line);
                if (bt.mesh) this.scene.remove(bt.mesh);
                this.bulletTrails.splice(i, 1);
            }
        }
    }
    
    updateShellCasings(dt) {
        for (let i = this.shellCasings.length - 1; i >= 0; i--) {
            const sc = this.shellCasings[i];
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
                this.scene.remove(sc.mesh);
                this.shellCasings.splice(i, 1);
            }
        }
    }
    
    handleInput(mouseDown, keys) {
        if (this.currentWeapon === 'pistol' || this.currentWeapon === 'rifle' || this.currentWeapon === 'ssg') {
            const cfg = CONFIG.weapons[this.currentWeapon];
            if (mouseDown) {
                if (cfg.auto || !weaponState[this.currentWeapon]._fired) {
                    this.shoot();
                    weaponState[this.currentWeapon]._fired = true;
                }
            } else {
                weaponState[this.currentWeapon]._fired = false;
            }
        }
    }
    
    getCurrentWeapon() {
        return this.currentWeapon;
    }
    
    getWeaponAnim() {
        return this.weaponAnim;
    }
    
    getCameraRecoil() {
        return { x: this.cameraRecoilX, y: this.cameraRecoilY };
    }
}
