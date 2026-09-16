/**
 * MapSystem - Создание и управление картами (Map1, Map2, Map3)
 */

import { CONFIG } from '../config.js';

export class MapSystem {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.targets = [];
        this.mapObjects = [];
        this.mapHalf = CONFIG.mapSize / 2;
        
        // Материалы
        this.wallMat = null;
        this.floorMat = null;
        this.ceilingMat = null;
        this.pillarMat = null;
        this.targetMat = null;
        this.targetHitMat = null;
        this.redMat = null;
        this.blueMat = null;
    }
    
    createMaterials(wallTextureURL, floorTextureURL, ceilingTextureURL) {
        const createTexture = (url, rx, ry) => {
            const tex = new THREE.TextureLoader().load(url);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(rx, ry);
            return tex;
        };
        
        this.wallMat = new THREE.MeshStandardMaterial({
            map: createTexture(wallTextureURL, 3, 3),
            roughness: 0.85,
            metalness: 0.1,
        });
        
        this.floorMat = new THREE.MeshStandardMaterial({
            map: createTexture(floorTextureURL, 8, 8),
            roughness: 0.7,
            metalness: 0.3,
        });
        
        this.ceilingMat = new THREE.MeshStandardMaterial({
            map: createTexture(ceilingTextureURL, 8, 8),
            roughness: 0.6,
            metalness: 0.5,
        });
        
        this.pillarMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.5,
            metalness: 0.6,
        });
        
        this.targetMat = new THREE.MeshStandardMaterial({
            color: 0xff2222,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x330000,
        });
        
        this.targetHitMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x442200,
        });
        
        this.redMat = new THREE.MeshStandardMaterial({
            color: 0xcc2222,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0x220000,
        });
        
        this.blueMat = new THREE.MeshStandardMaterial({
            color: 0x2244cc,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0x000022,
        });
    }
    
    clear() {
        this.walls.length = 0;
        this.targets.forEach(t => this.scene.remove(t.group));
        this.targets.length = 0;
        this.mapObjects.forEach(o => this.scene.remove(o));
        this.mapObjects.length = 0;
    }
    
    addWall(x, z, w, d, h) {
        h = h || CONFIG.wallHeight;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.wallMat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        this.walls.push({ mesh, x, z, w, d, h });
        this.mapObjects.push(mesh);
    }
    
    addPillar(x, z) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, CONFIG.wallHeight, 1),
            this.pillarMat
        );
        mesh.position.set(x, CONFIG.wallHeight / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        this.walls.push({ mesh, x, z, w: 1, d: 1, h: CONFIG.wallHeight });
        this.mapObjects.push(mesh);
    }
    
    createTarget(x, z, team) {
        const group = new THREE.Group();
        let mat = this.targetMat;
        
        if (team === 'red') {
            mat = new THREE.MeshStandardMaterial({
                color: 0xff4444,
                roughness: 0.3,
                metalness: 0.2,
                emissive: 0x330000,
            });
        } else if (team === 'blue') {
            mat = new THREE.MeshStandardMaterial({
                color: 0x4488ff,
                roughness: 0.3,
                metalness: 0.2,
                emissive: 0x000033,
            });
        }
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.5), mat);
        body.position.y = 0.9;
        body.castShadow = true;
        group.add(body);
        
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mat);
        head.position.y = 2.1;
        head.castShadow = true;
        group.add(head);
        
        const la = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), mat);
        la.position.set(-0.55, 1.2, 0);
        group.add(la);
        
        const ra = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), mat);
        ra.position.set(0.55, 1.2, 0);
        group.add(ra);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        
        this.targets.push({
            group,
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
    
    buildMap1() {
        this.mapHalf = CONFIG.mapSize / 2;
        
        // Пол
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
            this.floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.mapObjects.push(floor);
        
        // Потолок
        const ceil = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
            this.ceilingMat
        );
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = CONFIG.wallHeight;
        this.scene.add(ceil);
        this.mapObjects.push(ceil);
        
        const T = CONFIG.wallThickness;
        const S = this.mapHalf;
        
        // Границы
        this.addWall(0, -S, CONFIG.mapSize, T);
        this.addWall(0, S, CONFIG.mapSize, T);
        this.addWall(-S, 0, T, CONFIG.mapSize);
        this.addWall(S, 0, T, CONFIG.mapSize);
        
        // Центральные стены
        this.addWall(-10, 0, 10, T);
        this.addWall(10, 0, 10, T);
        this.addWall(0, -10, T, 10);
        this.addWall(0, 10, T, 10);
        
        // Угловые структуры
        this.addWall(-20, -15, 10, T);
        this.addWall(-15, -20, T, 10);
        this.addWall(20, -15, 10, T);
        this.addWall(15, -20, T, 10);
        this.addWall(-20, 15, 10, T);
        this.addWall(-15, 20, T, 10);
        this.addWall(20, 15, 10, T);
        this.addWall(15, 20, T, 10);
        
        // Дополнительные стены
        this.addWall(-10, -20, T, 10);
        this.addWall(10, -20, T, 10);
        this.addWall(-10, 20, T, 10);
        this.addWall(10, 20, T, 10);
        
        // Колонны
        [
            [-7, -7], [7, -7], [-7, 7], [7, 7],
            [-20, -7], [20, -7], [-20, 7], [20, 7],
            [-7, -20], [7, -20], [-7, 20], [7, 20],
            [-25, 0], [25, 0], [0, -25], [0, 25],
        ].forEach(p => this.addPillar(p[0], p[1]));
        
        // Боты
        [
            [-12, -12], [12, -12], [-12, 12], [12, 12],
            [-22, -22], [22, -22], [-22, 22], [22, 22],
            [0, -18], [0, 18], [-18, 0], [18, 0],
            [-8, -22], [8, -22], [-8, 22], [8, 22],
        ].forEach(([x, z]) => this.createTarget(x, z, 'neutral'));
    }
    
    buildMap2() {
        this.mapHalf = CONFIG.mapSize / 2;
        
        // Пол
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
            this.floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.mapObjects.push(floor);
        
        // Потолок
        const ceil = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
            this.ceilingMat
        );
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = CONFIG.wallHeight;
        this.scene.add(ceil);
        this.mapObjects.push(ceil);
        
        const T = CONFIG.wallThickness;
        const S = this.mapHalf;
        
        // Границы
        this.addWall(0, -S, CONFIG.mapSize, T);
        this.addWall(0, S, CONFIG.mapSize, T);
        this.addWall(-S, 0, T, CONFIG.mapSize);
        this.addWall(S, 0, T, CONFIG.mapSize);
        
        // Центральная линия
        this.addWall(0, -18, T, 12);
        this.addWall(0, 0, T, 8);
        this.addWall(0, 18, T, 12);
        
        // Красная база (левая сторона)
        this.addWall(-22, -8, 8, T);
        this.addWall(-22, 8, 8, T);
        this.addWall(-26, 0, T, 10);
        this.addPillar(-20, -5);
        this.addPillar(-20, 5);
        this.addPillar(-24, 0);
        
        const redBase = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), this.redMat);
        redBase.rotation.x = -Math.PI / 2;
        redBase.position.set(-22, 0.02, 0);
        this.scene.add(redBase);
        this.mapObjects.push(redBase);
        
        // Синяя база (правая сторона)
        this.addWall(22, -8, 8, T);
        this.addWall(22, 8, 8, T);
        this.addWall(26, 0, T, 10);
        this.addPillar(20, -5);
        this.addPillar(20, 5);
        this.addPillar(24, 0);
        
        const blueBase = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), this.blueMat);
        blueBase.rotation.x = -Math.PI / 2;
        blueBase.position.set(22, 0.02, 0);
        this.scene.add(blueBase);
        this.mapObjects.push(blueBase);
        
        // Спавны и укрытия
        this.addWall(-8, -20, 6, T);
        this.addWall(8, -20, 6, T);
        this.addPillar(-12, -20);
        this.addPillar(12, -20);
        this.addWall(0, -24, 4, T);
        
        this.addWall(-8, 20, 6, T);
        this.addWall(8, 20, 6, T);
        this.addPillar(-12, 20);
        this.addPillar(12, 20);
        this.addWall(0, 24, 4, T);
        
        // Центр
        this.addWall(-6, -5, T, 4);
        this.addWall(6, -5, T, 4);
        this.addWall(-6, 5, T, 4);
        this.addWall(6, 5, T, 4);
        this.addPillar(-4, 0);
        this.addPillar(4, 0);
        
        // Углы
        this.addWall(-14, -14, 4, T);
        this.addWall(14, -14, 4, T);
        this.addWall(-14, 14, 4, T);
        this.addWall(14, 14, 4, T);
        this.addPillar(-14, -8);
        this.addPillar(14, -8);
        this.addPillar(-14, 8);
        this.addPillar(14, 8);
        
        // Боты - нейтральные
        [
            [0, -10], [0, 10],
            [-4, -14], [4, -14],
            [-4, 14], [4, 14],
        ].forEach(([x, z]) => this.createTarget(x, z, 'neutral'));
        
        // Боты синей команды
        [
            [-16, -3], [-16, 3],
            [-10, -10], [-10, 10],
        ].forEach(([x, z]) => this.createTarget(x, z, 'blue'));
        
        // Боты красной команды
        [
            [16, -3], [16, 3],
            [10, -10], [10, 10],
        ].forEach(([x, z]) => this.createTarget(x, z, 'red'));
    }
    
    buildMap3() {
        this.mapHalf = CONFIG.zombieMapSize / 2;
        
        // Пол
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.zombieMapSize, CONFIG.zombieMapSize),
            this.floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.mapObjects.push(floor);
        
        // Фон и туман для зомби режима
        this.scene.background = new THREE.Color(0x334455);
        this.scene.fog = new THREE.FogExp2(0x334455, 0.008);
        
        const T = CONFIG.wallThickness;
        const S = this.mapHalf;
        
        // Границы
        this.addWall(0, -S, CONFIG.zombieMapSize, T);
        this.addWall(0, S, CONFIG.zombieMapSize, T);
        this.addWall(-S, 0, T, CONFIG.zombieMapSize);
        this.addWall(S, 0, T, CONFIG.zombieMapSize);
        
        // Центральное укрепление
        this.addWall(0, 0, 20, T, 3);
        this.addWall(0, 10, T, 10, 3);
        this.addWall(0, -10, T, 10, 3);
        this.addWall(-10, 5, 10, T, 3);
        this.addWall(10, 5, 10, T, 3);
        this.addWall(-10, -5, 10, T, 3);
        this.addWall(10, -5, 10, T, 3);
        
        // Платформы по углам
        this.addWall(-25, -25, 8, 8, 2);
        this.addWall(25, -25, 8, 8, 2);
        this.addWall(-25, 25, 8, 8, 2);
        this.addWall(25, 25, 8, 8, 2);
        
        // Высокие платформы
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.8,
            metalness: 0.3,
        });
        
        const platform1 = new THREE.Mesh(
            new THREE.BoxGeometry(10, 1, 10),
            platformMat
        );
        platform1.position.set(-35, 3, 0);
        platform1.castShadow = true;
        platform1.receiveShadow = true;
        this.scene.add(platform1);
        this.mapObjects.push(platform1);
        
        const platform2 = new THREE.Mesh(
            new THREE.BoxGeometry(10, 1, 10),
            platformMat
        );
        platform2.position.set(35, 3, 0);
        platform2.castShadow = true;
        platform2.receiveShadow = true;
        this.scene.add(platform2);
        this.mapObjects.push(platform2);
        
        // Рампы
        const rampMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
        
        const ramp1 = new THREE.Mesh(
            new THREE.BoxGeometry(6, 0.5, 8),
            rampMat
        );
        ramp1.position.set(-30, 1.5, 0);
        ramp1.rotation.z = -0.35;
        ramp1.castShadow = true;
        ramp1.receiveShadow = true;
        this.scene.add(ramp1);
        this.mapObjects.push(ramp1);
        
        const ramp2 = new THREE.Mesh(
            new THREE.BoxGeometry(6, 0.5, 8),
            rampMat
        );
        ramp2.position.set(30, 1.5, 0);
        ramp2.rotation.z = 0.35;
        ramp2.castShadow = true;
        ramp2.receiveShadow = true;
        this.scene.add(ramp2);
        this.mapObjects.push(ramp2);
        
        // Колонны по кругу
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 40;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const height = 2 + Math.random() * 4;
            
            const pillar = new THREE.Mesh(
                new THREE.BoxGeometry(2, height, 2),
                this.pillarMat
            );
            pillar.position.set(x, height / 2, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);
            
            this.walls.push({ mesh: pillar, x, z, w: 2, d: 2, h });
            this.mapObjects.push(pillar);
        }
        
        // Освещение
        const moonLight = new THREE.DirectionalLight(0x8899dd, 0.5);
        moonLight.position.set(-20, 40, 20);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(4096, 4096);
        moonLight.shadow.camera.left = -70;
        moonLight.shadow.camera.right = 70;
        moonLight.shadow.camera.top = 70;
        moonLight.shadow.camera.bottom = -70;
        this.scene.add(moonLight);
        this.mapObjects.push(moonLight);
        
        const centerLight = new THREE.PointLight(0xffffaa, 2, 40);
        centerLight.position.set(0, 5, 0);
        centerLight.castShadow = true;
        this.scene.add(centerLight);
        this.mapObjects.push(centerLight);
    }
    
    getSpawnPosition(selectedMap, selectedTeam) {
        if (selectedMap === 1) {
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
        } else if (selectedMap === 2) {
            if (selectedTeam === 'red') {
                return {
                    x: -22 + (Math.random() - 0.5) * 4,
                    z: (Math.random() - 0.5) * 8,
                };
            } else {
                return {
                    x: 22 + (Math.random() - 0.5) * 4,
                    z: (Math.random() - 0.5) * 8,
                };
            }
        } else {
            return {
                x: (Math.random() - 0.5) * 10,
                z: (Math.random() - 0.5) * 10,
            };
        }
    }
    
    checkCollision(newX, newZ, playerRadius) {
        const r = playerRadius || CONFIG.playerRadius;
        
        for (const wall of this.walls) {
            const halfW = wall.w / 2 + r;
            const halfD = wall.d / 2 + r;
            if (newX > wall.x - halfW && newX < wall.x + halfW &&
                newZ > wall.z - halfD && newZ < wall.z + halfD) {
                return true;
            }
        }
        
        const currentMapSize = CONFIG.zombieMapSize;
        const currentMapHalf = currentMapSize / 2;
        if (Math.abs(newX) > currentMapHalf - r || Math.abs(newZ) > currentMapHalf - r) {
            return true;
        }
        
        return false;
    }
    
    getWalls() {
        return this.walls;
    }
    
    getTargets() {
        return this.targets;
    }
}
