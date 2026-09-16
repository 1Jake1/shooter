import { SOUNDS } from '../config.js';

/**
 * SoundSystem - Аудио система игры
 * Отвечает за загрузку и воспроизведение звуков
 */
export class SoundSystem {
	constructor() {
		this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.value = 0.5;
		this.masterGain.connect(this.ctx.destination);
		this.compressor = this.ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -20;
		this.compressor.knee.value = 10;
		this.compressor.ratio.value = 8;
		this.compressor.connect(this.masterGain);

		this.buffers = {};
		this.soundsLoaded = false;
	}

	resume() {
		if (this.ctx.state === 'suspended') this.ctx.resume();
	}

	async loadSound(name, url) {
		try {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
			this.buffers[name] = audioBuffer;
			console.log(`✅ Звук загружен: ${name}`);
		} catch (error) {
			console.error(`❌ Ошибка загрузки звука ${name}:`, error);
		}
	}

	async initSounds() {
		// Звуки выстрелов
		await this.loadSound('pistol', SOUNDS.pistol);
		await this.loadSound('rifle', SOUNDS.rifle);
		await this.loadSound('ssg', SOUNDS.ssg);

		// Звуки перезарядки
		await this.loadSound('reload_pistol', SOUNDS.reload_pistol);
		await this.loadSound('reload_rifle', SOUNDS.reload_rifle);
		await this.loadSound('reload_ssg', SOUNDS.reload_ssg);

		// Звуки ходьбы
		await this.loadSound('footstep', SOUNDS.footstep);
		await this.loadSound('footstep2', SOUNDS.footstep2);

		this.soundsLoaded = true;
		console.log('🔊 Все основные звуки загружены');
	}

	playBuffer(name, pitchVariance = 0.05) {
		if (!this.soundsLoaded || !this.buffers[name]) {
			console.warn(`Звук ${name} не найден или не загружен`);
			return;
		}
		this.resume();
		const source = this.ctx.createBufferSource();
		source.buffer = this.buffers[name];
		if (pitchVariance > 0) {
			source.playbackRate.value =
				1.0 + (Math.random() * pitchVariance * 2 - pitchVariance);
		}
		source.connect(this.compressor);
		source.start(0);
	}

	playPistolShot() {
		this.playBuffer('pistol', 0.03);
		this._reverbTail(this.ctx.currentTime, 0.15, 0.1);
	}

	playRifleShot() {
		this.playBuffer('rifle', 0.04);
		this._reverbTail(this.ctx.currentTime, 0.1, 0.08);
	}

	playSSGShot() {
		this.playBuffer('ssg', 0.02);
		this._reverbTail(this.ctx.currentTime, 0.4, 0.25);
		this._click(this.ctx.currentTime + 0.25, 800, 0.03, 0.2);
	}

	playReloadSound(weapon) {
		const soundMap = {
			pistol: 'reload_pistol',
			rifle: 'reload_rifle',
			ssg: 'reload_ssg',
		};
		const soundName = soundMap[weapon] || 'reload_rifle';
		this.playBuffer(soundName, 0.05);
	}

	playEmptyClick() {
		this.resume();
		const t = this.ctx.currentTime;
		this._click(t, 2000, 0.015, 0.3);
		this._click(t + 0.02, 1500, 0.01, 0.2);
	}

	playFootstep() {
		this.playBuffer('footstep', 0.1);
	}

	playHitSound() {
		this.resume();
		const t = this.ctx.currentTime;
		const o = this.ctx.createOscillator(),
			g = this.ctx.createGain();
		o.type = 'sine';
		o.frequency.setValueAtTime(1800, t);
		o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
		g.gain.setValueAtTime(0.15, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
		o.connect(g);
		g.connect(this.compressor);
		o.start(t);
		o.stop(t + 0.1);
	}

	playKillSound() {
		this.resume();
		const t = this.ctx.currentTime;
		[1400, 1800, 2200].forEach((f, i) => {
			const o = this.ctx.createOscillator(),
				g = this.ctx.createGain();
			o.type = 'sine';
			o.frequency.value = f;
			g.gain.setValueAtTime(0, t + i * 0.06);
			g.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.02);
			g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
			o.connect(g);
			g.connect(this.compressor);
			o.start(t + i * 0.06);
			o.stop(t + i * 0.06 + 0.15);
		});
	}

	playExplosion() {
		this.resume();
		const t = this.ctx.currentTime;
		
		// Низкочастотный удар
		const o1 = this.ctx.createOscillator(),
			g1 = this.ctx.createGain();
		o1.type = 'sine';
		o1.frequency.setValueAtTime(80, t);
		o1.frequency.exponentialRampToValueAtTime(20, t + 0.5);
		g1.gain.setValueAtTime(0.8, t);
		g1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
		o1.connect(g1);
		g1.connect(this.compressor);
		o1.start(t);
		o1.stop(t + 0.6);

		// Высокочастотный слой
		const o2 = this.ctx.createOscillator(),
			g2 = this.ctx.createGain();
		o2.type = 'sawtooth';
		o2.frequency.setValueAtTime(400, t);
		o2.frequency.exponentialRampToValueAtTime(50, t + 0.2);
		g2.gain.setValueAtTime(0.5, t);
		g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		o2.connect(g2);
		g2.connect(this.compressor);
		o2.start(t);
		o2.stop(t + 0.3);

		this._noiseBurst(t, 0.4, 0.8);
		this._noiseBurst(t + 0.05, 0.6, 0.4);
		this._reverbTail(t, 1.0, 0.5);
	}

	_click(t, freq, dur, vol) {
		const o = this.ctx.createOscillator(),
			g = this.ctx.createGain();
		o.type = 'square';
		o.frequency.setValueAtTime(freq, t);
		o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		o.connect(g);
		g.connect(this.compressor);
		o.start(t);
		o.stop(t + dur);
	}

	_noiseBurst(t, dur, vol) {
		const len = Math.floor(this.ctx.sampleRate * dur);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++)
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		const f = this.ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.frequency.value = 3000;
		f.Q.value = 0.5;
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}

	_reverbTail(t, dur, vol) {
		const len = Math.floor(this.ctx.sampleRate * dur);
		const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++)
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5) * 0.3;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		const f = this.ctx.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = 1500;
		src.connect(f);
		f.connect(g);
		g.connect(this.compressor);
		src.start(t);
	}
}
