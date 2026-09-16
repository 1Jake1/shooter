/**
 * UIManager - Управление UI компонентами (HUD, Minimap, Loading)
 */

import { gameState } from '../state/gameState.js';
import { CONFIG } from '../config.js';

export class UIManager {
    constructor() {
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
        
        this.loadingManager = {
            progress: 0,
            status: 'Инициализация...',
            playersReady: new Map(),
            isMultiplayer: false,
            allPlayersReady: false,
        };
    }
    
    updateMinimap(walls, targets, otherPlayers, zombies, activeGrenades, smokeClouds, camera, playerState, selectedTeam, selectedMap) {
        if (!this.minimapCtx) return;
        
        const ctx = this.minimapCtx;
        const w = 150, h = 150;
        const currentMapSize = selectedMap === 3 ? CONFIG.zombieMapSize : CONFIG.mapSize;
        const scale = w / currentMapSize;
        const currentMapHalf = currentMapSize / 2;
        
        // Фон
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);
        
        // Базы для карты 2
        if (selectedMap === 2) {
            ctx.fillStyle = 'rgba(255,68,68,0.2)';
            ctx.fillRect(
                (-currentMapHalf - 26 + currentMapHalf) * scale,
                (-7 + currentMapHalf) * scale,
                8 * scale,
                14 * scale
            );
            ctx.fillStyle = 'rgba(68,136,255,0.2)';
            ctx.fillRect(
                (18 + currentMapHalf) * scale,
                (-7 + currentMapHalf) * scale,
                8 * scale,
                14 * scale
            );
        }
        
        // Стены
        ctx.fillStyle = '#555';
        walls.forEach(wall => {
            const x = (wall.x + currentMapHalf) * scale;
            const z = (wall.z + currentMapHalf) * scale;
            ctx.fillRect(
                x - (wall.w * scale) / 2,
                z - (wall.d * scale) / 2,
                wall.w * scale,
                wall.d * scale
            );
        });
        
        // Зомби на миникарте
        if (selectedMap === 3) {
            zombies.forEach(z => {
                if (!z.alive) return;
                ctx.fillStyle = '#88ff88';
                ctx.beginPath();
                ctx.arc(
                    (z.group.position.x + currentMapHalf) * scale,
                    (z.group.position.z + currentMapHalf) * scale,
                    3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            });
        }
        
        // Другие игроки
        otherPlayers.forEach(player => {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(
                (player.group.position.x + currentMapHalf) * scale,
                (player.group.position.z + currentMapHalf) * scale,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        
        // Боты/цели
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
                Math.PI * 2
            );
            ctx.fill();
        });
        
        // Гранаты
        activeGrenades.forEach(g => {
            ctx.fillStyle = g.type === 'frag' ? '#ffaa00' : '#88bbff';
            ctx.beginPath();
            ctx.arc(
                (g.mesh.position.x + currentMapHalf) * scale,
                (g.mesh.position.z + currentMapHalf) * scale,
                3,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        
        // Дым
        smokeClouds.forEach(c => {
            ctx.fillStyle = 'rgba(200,200,200,0.4)';
            ctx.beginPath();
            ctx.arc(
                (c.position.x + currentMapHalf) * scale,
                (c.position.z + currentMapHalf) * scale,
                c.maxRadius * scale,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        
        // Игрок
        const px = (camera.position.x + currentMapHalf) * scale;
        const pz = (camera.position.z + currentMapHalf) * scale;
        ctx.fillStyle = selectedMap === 2 
            ? (selectedTeam === 'red' ? '#ff4444' : '#4488ff') 
            : '#44ff44';
        
        ctx.beginPath();
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Направление взгляда
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(
            px - Math.sin(playerState.yaw) * 10,
            pz - Math.cos(playerState.yaw) * 10
        );
        ctx.stroke();
    }
    
    updateTeamScores(teamScores) {
        const redEl = document.getElementById('red-score-val');
        const blueEl = document.getElementById('blue-score-val');
        if (redEl) redEl.textContent = teamScores.red;
        if (blueEl) blueEl.textContent = teamScores.blue;
    }
    
    updateHealth(health) {
        const healthEl = document.getElementById('health-value');
        if (healthEl) healthEl.textContent = Math.floor(health);
    }
    
    updateScore(score) {
        const scoreEl = document.getElementById('score-value');
        if (scoreEl) scoreEl.textContent = score;
    }
    
    updateZombieUI(wave, killed) {
        const waveEl = document.getElementById('zombie-wave');
        const killsEl = document.getElementById('zombies-killed');
        if (waveEl) waveEl.textContent = `Волна: ${wave}`;
        if (killsEl) killsEl.textContent = `Убито: ${killed}`;
    }
    
    showDamageOverlay() {
        const overlay = document.getElementById('damage-overlay');
        if (overlay) {
            overlay.classList.add('show');
            setTimeout(() => overlay.classList.remove('show'), 300);
        }
    }
    
    showHitMarker() {
        const hm = document.getElementById('hit-marker');
        if (hm) {
            hm.classList.add('show');
            setTimeout(() => hm.classList.remove('show'), 150);
        }
    }
    
    updateAmmo(current, reserve) {
        const curEl = document.getElementById('ammo-current');
        const resEl = document.getElementById('ammo-reserve');
        if (curEl) curEl.textContent = current;
        if (resEl) resEl.textContent = reserve === Infinity ? '∞' : reserve;
    }
    
    updateWeaponName(name) {
        const nameEl = document.getElementById('weapon-name');
        if (nameEl) nameEl.textContent = name;
    }
    
    updateWeaponSlot(weaponName) {
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
        
        const slotEl = document.getElementById(slotMap[weaponName]);
        if (slotEl) slotEl.classList.add('active');
    }
    
    showReloadUI(show) {
        const reloadText = document.getElementById('reload-text');
        const reloadBarContainer = document.getElementById('reload-bar-container');
        if (reloadText) reloadText.classList.toggle('show', show);
        if (reloadBarContainer) reloadBarContainer.classList.toggle('show', show);
    }
    
    updateReloadBar(progress) {
        const reloadBar = document.getElementById('reload-bar');
        if (reloadBar) reloadBar.style.width = progress * 100 + '%';
    }
    
    showThrowIndicator(show) {
        const indicator = document.getElementById('throw-indicator');
        if (indicator) indicator.classList.toggle('show', show);
    }
    
    updateScopeOverlay(isScoped) {
        const scopeOverlay = document.getElementById('scope-overlay');
        const crosshair = document.getElementById('crosshair');
        if (scopeOverlay) scopeOverlay.classList.toggle('active', isScoped);
        if (crosshair) crosshair.classList.toggle('hidden', isScoped);
    }
    
    showDeathScreen(onDeathCallback) {
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
                if (onDeathCallback) onDeathCallback();
            }, 5000);
        }
    }
    
    // Loading Manager методы
    setLoadingProgress(value, status) {
        this.loadingManager.progress = value;
        if (status) this.loadingManager.status = status;
        this.updateLoadingUI();
        console.log(`📊 Loading: ${Math.floor(value)}% - ${this.loadingManager.status}`);
    }
    
    updateLoadingUI() {
        const progressBar = document.getElementById('loading-progress-bar');
        const statusEl = document.getElementById('loading-status');
        const percentageEl = document.getElementById('loading-percentage');
        const playersReadyEl = document.getElementById('players-ready-status');
        
        if (progressBar) progressBar.style.width = this.loadingManager.progress + '%';
        if (statusEl) statusEl.textContent = this.loadingManager.status;
        if (percentageEl) percentageEl.textContent = Math.floor(this.loadingManager.progress) + '%';
        
        if (this.loadingManager.isMultiplayer && playersReadyEl) {
            const readyCount = Array.from(this.loadingManager.playersReady.values()).filter(r => r).length;
            const totalPlayers = this.loadingManager.playersReady.size;
            playersReadyEl.textContent = `Игроки готовы: ${readyCount}/${totalPlayers}`;
        }
    }
    
    setMultiplayer(isMultiplayer) {
        this.loadingManager.isMultiplayer = isMultiplayer;
    }
    
    markPlayerReady(playerId, ready) {
        this.loadingManager.playersReady.set(playerId, ready);
        this.updateLoadingUI();
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    setupTeamScoreVisibility(selectedMap) {
        const teamScoreEl = document.getElementById('team-score');
        const zombieUIEl = document.getElementById('zombie-ui');
        
        if (teamScoreEl) {
            teamScoreEl.classList.toggle('show', selectedMap === 2);
        }
        if (zombieUIEl) {
            zombieUIEl.classList.toggle('show', selectedMap === 3);
        }
    }
}
