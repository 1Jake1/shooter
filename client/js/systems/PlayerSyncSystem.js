/**
 * PlayerSyncSystem - Синхронизация игроков в мультиплеере
 */

import { gameState } from '../state/gameState.js';

export class PlayerSyncSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.otherPlayers = new Map();
        this.fbxLoader = new THREE.FBXLoader();
        
        this.characterModelTemplate = null;
        this.characterAnimations = {};
        this.animationCache = new Map();
    }
    
    loadCharacterModel(callback) {
        if (this.characterModelTemplate) {
            const clone = THREE.SkeletonUtils.clone(this.characterModelTemplate);
            callback(clone);
            return;
        }
        
        this.fbxLoader.load(
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
                
                this.characterModelTemplate = fbx;
                callback(fbx);
            },
            xhr => {
                console.log('📥 Character model loading:', ((xhr.loaded / xhr.total) * 100).toFixed(2) + '%');
            },
            error => console.error('❌ Ошибка загрузки модели персонажа:', error)
        );
    }
    
    loadCharacterAnimations(callback) {
        let loaded = 0;
        const animFiles = {
            idle: 'models/Anim_Char_Shooting_gun.fbx',
            run: 'models/Anim_Char_Rifle_Run.fbx',
            shoot: 'models/Anim_Char_Firing_Rifle.fbx',
        };
        
        Object.keys(animFiles).forEach(key => {
            if (this.animationCache.has(key)) {
                this.characterAnimations[key] = this.animationCache.get(key);
                loaded++;
                if (loaded === Object.keys(animFiles).length) callback();
                return;
            }
            
            this.fbxLoader.load(
                animFiles[key],
                fbx => {
                    if (fbx.animations && fbx.animations.length > 0) {
                        this.characterAnimations[key] = fbx.animations[0];
                        this.animationCache.set(key, fbx.animations[0]);
                    }
                    loaded++;
                    if (loaded === Object.keys(animFiles).length) callback();
                },
                undefined,
                error => {
                    console.error(`❌ Error loading animation ${key}:`, error);
                    loaded++;
                    if (loaded === Object.keys(animFiles).length) callback();
                }
            );
        });
    }
    
    createPlayerModel(playerId, team, initialX, initialZ, initialYaw) {
        const group = new THREE.Group();
        const color = team === 'red' ? 0xff4444 : team === 'blue' ? 0x4488ff : 0x44ff44;
        
        if (initialX !== undefined && initialZ !== undefined) {
            group.position.set(initialX, 0, initialZ);
            if (initialYaw !== undefined) group.rotation.y = initialYaw;
        }
        
        this.loadCharacterModel(model => {
            const box = new THREE.Box3().setFromObject(model);
            model.position.y = -box.min.y;
            model.rotation.y = Math.PI;
            
            model.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.emissiveIntensity = 0.2;
                }
            });
            
            group.add(model);
            
            const mixer = new THREE.AnimationMixer(model);
            group.userData.mixer = mixer;
            group.userData.animations = {};
            
            if (Object.keys(this.characterAnimations).length > 0) {
                Object.keys(this.characterAnimations).forEach(key => {
                    const action = mixer.clipAction(this.characterAnimations[key]);
                    group.userData.animations[key] = action;
                    if (key === 'idle') {
                        action.play();
                        group.userData.currentAnimation = 'idle';
                    }
                });
            }
        });
        
        this.scene.add(group);
        
        return {
            group,
            playerId,
            lastUpdate: Date.now(),
            currentAnimation: 'idle',
        };
    }
    
    playAnimation(player, animName) {
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
    
    setupSocketListeners(socket) {
        socket.on('player_update', data => {
            const { playerId, x, z, yaw, animation, team } = data;
            
            if (!this.otherPlayers.has(playerId)) {
                const playerTeam = team || gameState.selectedTeam;
                this.otherPlayers.set(
                    playerId,
                    this.createPlayerModel(playerId, playerTeam, x, z, yaw)
                );
            }
            
            const player = this.otherPlayers.get(playerId);
            if (player) {
                player.targetPosition = new THREE.Vector3(x, 0, z);
                player.targetRotation = yaw;
                player.lastUpdate = Date.now();
                
                if (!player.hasInitialPosition) {
                    player.group.position.copy(player.targetPosition);
                    player.group.rotation.y = player.targetRotation;
                    player.hasInitialPosition = true;
                }
                
                if (animation && animation !== player.currentAnimation) {
                    this.playAnimation(player, animation);
                }
            }
        });
        
        socket.on('player_disconnected', data => {
            const player = this.otherPlayers.get(data.playerId);
            if (player) {
                this.scene.remove(player.group);
                this.otherPlayers.delete(data.playerId);
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
                // Обработка получения урона будет в main.js
                console.log('Player damaged:', data.damage);
            }
        });
        
        socket.on('player_death', data => {
            if (data.killerId === socket.id) {
                // Обработка убийства будет в main.js
                console.log('Player killed someone');
            }
        });
        
        socket.on('player_shot', () => {
            // Проигрывание звука выстрела другого игрока
        });
        
        socket.on('grenade_spawn', data => {
            // Спавн гранаты от другого игрока будет обработан в WeaponSystem
        });
        
        socket.on('grenade_explosion', data => {
            // Взрыв гранаты от другого игрока
        });
    }
    
    update(dt) {
        this.otherPlayers.forEach((player, playerId) => {
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
        
        // Удаление неактивных игроков
        const now = Date.now();
        this.otherPlayers.forEach((player, playerId) => {
            if (now - player.lastUpdate > 5000) {
                this.scene.remove(player.group);
                this.otherPlayers.delete(playerId);
            }
        });
    }
    
    sendPosition(socket, keys, mouseDown, currentWeapon, camera, playerState) {
        const now = Date.now();
        if (now - this.lastPositionSend < 50) return;
        this.lastPositionSend = now;
        
        let currentAnim = 'idle';
        const isMoving = keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'];
        const isShooting = mouseDown && 
            (currentWeapon === 'pistol' || currentWeapon === 'rifle' || currentWeapon === 'ssg');
        
        if (isShooting) currentAnim = 'shoot';
        else if (isMoving) currentAnim = 'run';
        
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
    
    getOtherPlayers() {
        return this.otherPlayers;
    }
    
    clear() {
        this.otherPlayers.forEach((player, id) => {
            this.scene.remove(player.group);
        });
        this.otherPlayers.clear();
    }
}
