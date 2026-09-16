import * as THREE from 'three';
import { CONFIG, TEXTURES } from '../config.js';

/**
 * RenderSystem - Система рендеринга
 * Управляет Three.js сценой, камерой и отрисовкой
 */
export class RenderSystem {
	constructor() {
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.walls = [];
		this.targets = [];
		this.mapObjects = [];
	}

	init() {
		// Создание сцены
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x111111);
		this.scene.fog = new THREE.FogExp2(0x111111, 0.015);

		// Камера
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			200,
		);
		this.camera.position.set(0, CONFIG.playerHeight, 0);

		// Рендерер
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;

		document.body.appendChild(this.renderer.domElement);

		// Освещение
		this.setupLights();

		// Обработка изменения размера окна
		window.addEventListener('resize', () => this.onResize());
	}

	setupLights() {
		// Ambient light
		this.scene.add(new THREE.AmbientLight(0x334455, 0.6));

		// Directional light
		const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
		dirLight.position.set(10, 20, 10);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set(2048, 2048);
		dirLight.shadow.camera.near = 0.5;
		dirLight.shadow.camera.far = 80;
		dirLight.shadow.camera.left = -35;
		dirLight.shadow.camera.right = 35;
		dirLight.shadow.camera.top = 35;
		dirLight.shadow.camera.bottom = -35;
		this.scene.add(dirLight);
	}

	createTexture(url, rx, ry) {
		const tex = new THREE.TextureLoader().load(url);
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(rx, ry);
		return tex;
	}

	onResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(window.innerWidth, window.innerHeight);
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}

	clearMap() {
		this.walls.length = 0;
		this.targets.forEach(t => this.scene.remove(t.group));
		this.targets.length = 0;
		this.mapObjects.forEach(o => this.scene.remove(o));
		this.mapObjects.length = 0;
	}

	addWall(x, z, w, d, h, material) {
		h = h || CONFIG.wallHeight;
		const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
		m.position.set(x, h / 2, z);
		m.castShadow = true;
		m.receiveShadow = true;
		this.scene.add(m);
		this.walls.push({ mesh: m, x, z, w, d, h });
		this.mapObjects.push(m);
	}

	getScene() {
		return this.scene;
	}

	getCamera() {
		return this.camera;
	}

	getRenderer() {
		return this.renderer;
	}

	getWalls() {
		return this.walls;
	}
}
