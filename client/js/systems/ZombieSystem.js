/**
 * ZombieSystem - ИИ зомби, спавн волн и анимации
 */

import { CONFIG } from '../config.js';
import { gameState, playerState } from '../state/gameState.js';

export class ZombieSystem {
    constructor(scene, walls, camera) {
        this.scene = scene;
        this.walls = walls;
        this.camera = camera;
        
        this.zombies = [];
        this.zombieAnimations = {};
        this.zombieModelTemplate = null;
        this.fbxLoader = new THREE.FBXLoader();
        
        this.mapHalf = CONFIG.zombieMapSize / 2;
    }
    
    loadZombieModel(callback) {
        console.log('🧟 Загрузка модели зомби...');
        
        this.fbxLoader.load(
            'models/Zombie.fbx',
            fbx => {
                const box = new THREE.Box3().setFromObject(fbx);
                const size = new THREE.Vector3();
                box.getSize(size);
                
                const targetHeight = 1.8;
                const scale = size.y > 0 ? (targetHeight / size.y) * 1.32 : 0.01;
                fbx.scale.setScalar(scale);
                
                const scaledBox = new THREE.Box3().setFromObject(fbx);
                const center = new THREE.Vector3();
                scaledBox.getCenter(center);
                fbx.position.x -= center.x;
                fbx.position.z -= center.z;
                
                const finalBox = new THREE.Box3().setFromObject(fbx);
                fbx.position.y -= finalBox.min.y;
                fbx.rotation.y = Math.PI;
                
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
                    }
                });
                
                this.zombieModelTemplate = fbx;
                callback(fbx);
            },
            xhr => {
                console.log('📥 Загрузка зомби:', ((xhr.loaded / xhr.total) * 100).toFixed(2) + '%');
            },
            error => {
                console.error('❌ Ошибка загрузки модели зомби:', error);
            }
        );
    }
    
    loadZombieAnimations(callback) {
        let loaded = 0;
        const animFiles = {
            idle: 'models/Anim_Zombie-IDLE.fbx',
            run: 'models/Anim_Zombie-Run.fbx',
            attack: 'models/Anim_Zombie-Attack.fbx',
            death: 'models/Anim_Zombie-Death.fbx',
        };
        
        Object.keys(animFiles).forEach(key => {
            this.fbxLoader.load(
                animFiles[key],
                fbx => {
                    if (fbx.animations && fbx.animations.length > 0) {
                        this.zombieAnimations[key] = fbx.animations[0];
                        console.log(`✅ Анимация зомби загружена: ${key}`);
                    }
                    loaded++;
                    if (loaded === Object.keys(animFiles).length) {
                        callback();
                    }
                },
                xhr => {
                    console.log(`📥 ${key}:`, ((xhr.loaded / xhr.total) * 100).toFixed(2) + '%');
                },
                error => {
                    console.error(`❌ Ошибка загрузки анимации ${key}:`, error);
                    loaded++;
                    if (loaded === Object.keys(animFiles).length) callback();
                }
            );
        });
    }
    
    createZombie(x, z) {
        if (!this.zombieModelTemplate) {
            console.error('❌ Модель зомби не загружена!');
            return null;
        }
        
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        
        const model = THREE.SkeletonUtils.clone(this.zombieModelTemplate);
        
        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;
        model.rotation.y = Math.PI;
        
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
        this.scene.add(group);
        
        const mixer = new THREE.AnimationMixer(model);
        const animations = {};
        
        if (Object.keys(this.zombieAnimations).length > 0) {
            Object.keys(this.zombieAnimations).forEach(key => {
                const action = mixer.clipAction(this.zombieAnimations[key]);
                animations[key] = action;
                if (key === 'idle') action.play();
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
            hitTime: 0,
        };
        
        this.zombies.push(zombie);
        return zombie;
    }
    
    playAnimation(zombie, animName) {
        if (!zombie.mixer || !zombie.animations) return;
        
        const newAnim = zombie.animations[animName];
        if (!newAnim || zombie.currentAnimation === animName) return;
        
        if (zombie.currentAnimation && zombie.animations[zombie.currentAnimation]) {
            zombie.animations[zombie.currentAnimation].fadeOut(0.2);
        }
        
        newAnim.reset().fadeIn(0.2).play();
        zombie.currentAnimation = animName;
    }
    
    spawnWave(waveNumber) {
        if (!this.zombieModelTemplate) {
            console.error('❌ Нельзя заспавнить зомби: модель не загружена');
            return;
        }
        
        const count = 5 + waveNumber * 2;
        const spawnRadius = 55;
        let spawned = 0;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * spawnRadius;
            const z = Math.sin(angle) * spawnRadius;
            
            const zombie = this.createZombie(x, z);
            if (zombie) spawned++;
        }
        
        console.log(`🧟 Волна ${waveNumber}: ${spawned}/${count} зомби заспавнено`);
    }
    
    update(dt) {
        const playerPos = this.camera.position;
        let aliveCount = 0;
        
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            
            if (zombie.mixer) {
                zombie.mixer.update(dt);
            }
            
            if (!zombie.alive) {
                if (performance.now() - zombie.hitTime > 3000) {
                    this.scene.remove(zombie.group);
                    this.zombies.splice(i, 1);
                }
                continue;
            }
            
            aliveCount++;
            
            const dx = playerPos.x - zombie.group.position.x;
            const dz = playerPos.z - zombie.group.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < CONFIG.zombie.detectionRange) {
                const angle = Math.atan2(dx, dz);
                zombie.group.rotation.y = angle;
                
                if (dist > CONFIG.zombie.attackRange) {
                    const dirX = dx / dist;
                    const dirZ = dz / dist;
                    const newX = zombie.group.position.x + dirX * CONFIG.zombie.speed * dt;
                    const newZ = zombie.group.position.z + dirZ * CONFIG.zombie.speed * dt;
                    
                    if (!this.checkCollision(newX, newZ)) {
                        zombie.group.position.x = newX;
                        zombie.group.position.z = newZ;
                    }
                    
                    this.playAnimation(zombie, 'run');
                } else {
                    this.playAnimation(zombie, 'attack');
                    
                    const now = performance.now();
                    if (now - zombie.lastAttack > CONFIG.zombie.attackCooldown) {
                        zombie.lastAttack = now;
                        playerState.health = Math.max(0, playerState.health - CONFIG.zombie.damage);
                        
                        const healthEl = document.getElementById('health-value');
                        if (healthEl) healthEl.textContent = Math.floor(playerState.health);
                        
                        const overlay = document.getElementById('damage-overlay');
                        if (overlay) {
                            overlay.classList.add('show');
                            setTimeout(() => overlay.classList.remove('show'), 300);
                        }
                        
                        if (playerState.health <= 0) {
                            this.handlePlayerDeath();
                        }
                    }
                }
            } else {
                this.playAnimation(zombie, 'idle');
            }
            
            if (performance.now() - zombie.hitTime < 200) {
                const ht = (performance.now() - zombie.hitTime) / 200;
                zombie.group.position.y = Math.sin(ht * Math.PI) * 0.1;
            } else {
                zombie.group.position.y *= 0.9;
            }
        }
        
        return aliveCount;
    }
    
    checkCollision(x, z) {
        const r = 0.5;
        for (const wall of this.walls) {
            const halfW = wall.w / 2 + r;
            const halfD = wall.d / 2 + r;
            if (x > wall.x - halfW && x < wall.x + halfW &&
                z > wall.z - halfD && z < wall.z + halfD) {
                return true;
            }
        }
        
        if (Math.abs(x) > this.mapHalf - r || Math.abs(z) > this.mapHalf - r) {
            return true;
        }
        
        return false;
    }
    
    handlePlayerDeath() {
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
                
                // Сброс зомби при смерти
                this.zombies.forEach(z => this.scene.remove(z.group));
                this.zombies.length = 0;
                gameState.zombieWave = 1;
                gameState.zombiesKilled = 0;
                
                // Обновление UI
                const waveEl = document.getElementById('zombie-wave');
                const killsEl = document.getElementById('zombies-killed');
                if (waveEl) waveEl.textContent = 'Волна: 1';
                if (killsEl) killsEl.textContent = 'Убито: 0';
            }, 5000);
        }
    }
    
    getZombies() {
        return this.zombies;
    }
    
    clear() {
        this.zombies.forEach(z => this.scene.remove(z.group));
        this.zombies.length = 0;
    }
}
