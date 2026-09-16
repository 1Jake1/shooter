/**
 * InputSystem - Система ввода
 * Обрабатывает нажатия клавиш и движение мыши
 */
export class InputSystem {
	constructor() {
		this.keys = {};
		this.mouseDown = false;
		this.mouseX = 0;
		this.mouseY = 0;
	}

	init() {
		// Обработка клавиатуры
		window.addEventListener('keydown', (e) => {
			this.keys[e.code] = true;
		});

		window.addEventListener('keyup', (e) => {
			this.keys[e.code] = false;
		});

		// Обработка мыши
		document.addEventListener('mousedown', () => {
			this.mouseDown = true;
		});

		document.addEventListener('mouseup', () => {
			this.mouseDown = false;
		});

		document.addEventListener('mousemove', (e) => {
			this.mouseX = e.movementX || 0;
			this.mouseY = e.movementY || 0;
		});
	}

	isKeyDown(code) {
		return this.keys[code] === true;
	}

	isMouseDown() {
		return this.mouseDown;
	}

	getMouseDelta() {
		const delta = { x: this.mouseX, y: this.mouseY };
		this.mouseX = 0;
		this.mouseY = 0;
		return delta;
	}

	reset() {
		this.keys = {};
		this.mouseDown = false;
		this.mouseX = 0;
		this.mouseY = 0;
	}
}
