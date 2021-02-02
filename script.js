"use strict";

const canvas = document.getElementById('canvas'),
	ctx = canvas.getContext('2d');

let songTime = new DynamicTime(),
	notes = [];

let step, draw;
{
	const ELEMS = {
		bpm: document.getElementById('bpm'),
		beat: document.getElementById('beat'),
		sec: document.getElementById('sec'),
		fps: document.getElementById('fps'),
		tps: document.getElementById('tps'),
	};
	let
		tpsC = 0,
		fpsC = 0;

	step = function step() {
		window.setTimeout(step, 0);
		let now = songTime.sec;
		ELEMS.tps.innerHTML = Math.round(1 / (now - tpsC));
		tpsC = now;
	};

	draw = function draw() {
		requestAnimationFrame(draw);
		let
			sec = songTime.sec,
			beat = songTime.beat;
		const
			size = 32, //temporary render variable
			xMod = 4; //temporary render variable
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, 640, 480); //temporary background
		ctx.fillStyle = "#666666";
		for ( //bar lines
			let i = Math.ceil(beat / 4) * 4;
			i < (Math.ceil(beat / 4) + 8) * 4;
			i += 4
		) {
			ctx.fillRect(
				0 * size,
				(i - beat) * xMod * size,
				size * 4,
				size / 4
			);
		}

		const noteTimings = {
			4: '#ff0000',
			8: '#0000ff',
			12: '#8800ff',
			16: '#00ff00',
			24: '#8800ff',
			32: '#ffff00',
			48: '#8800ff',
			64: '#00ffff',
			192: '#00ffff',
			def: '#888888',
		};
		function renderNote(note) { //notes
			if (note.sec - sec > 0)
				ctx.fillStyle = {
					'M': _ => '#880000',
					'1': function () {
						for (let timing in noteTimings)
							if ((note.beat + 1e-4) % (4 / timing) < 2e-4)
								return noteTimings[timing];

						return noteTimings.def;
					},
					'2': _ => '#00ffff',
					'4': _ => '#00ff00',
				}[note.type]();
			else
				ctx.fillStyle = '#ff00ff';

			ctx.fillRect(
				note.column * size,
				(note.beat - beat) * xMod * size,
				size,
				(note.beatLength * xMod * size || 0) + size
			);
		}
		notes.forEach(renderNote);

		ELEMS.fps.innerHTML = Math.round(1 / (sec - fpsC));
		ELEMS.bpm.innerHTML = Bpm.getLastBpm('sec', sec).bpm;
		fpsC = sec;

		ELEMS.sec.innerHTML = sec;
		ELEMS.beat.innerHTML = beat;
	};
}

function startGame({ audio, offset }) {
	if (audio)
		audio.play();
	else
		console.warn(`No audio found`);
	songTime.sec = offset;
	songTime.start();
	step();
	requestAnimationFrame(draw);
}

let keyInput = {
	up: false,
	down: false,
	left: false,
	right: false
};
function press(v) {
	return function (key) {
		switch (key.code) {
			case "ArrowUp":
				keyInput.up = v; break;
			case "ArrowDown":
				keyInput.down = v; break;
			case "ArrowLeft":
				keyInput.left = v; break;
			case "ArrowRight":
				keyInput.right = v; break;
		}
	};
}
addEventListener("keydown", press(true));
addEventListener("keyup", press(false));

document.getElementById('startButton').onclick = async function () {
	this.disabled = true;

	const songName = "classicPursuit",
		difficulty = "Easy";

	let songData;
	try {
		songData = await (await fetch(`./songs/${songName}.json`)).json();
	} catch (e) {
		try {
			console.warn("No json file exists! Using sm file as fallback.");
			let smFile = await (await fetch(`./songs/${songName}.sm`)).text();
			songData = parseSM(smFile);
		} catch (e) {
			throw `No song file for ${songName} found!`;
		}
	}
	console.log("Got songData:", songData);
	let audio = new Audio(`./songs/${songName}.mp3`);
	audio.volume = 0;
	audio.play();
	audio.pause();
	audio.currentTime = 0;
	audio.volume = 1;
	songData.audio = audio;

	bpms = [];
	notes = [];
	for (let oBpm of songData.bpms) {
		let cBpm = new Bpm(oBpm.bpm, 'beat', oBpm.beat);
		bpms.push(cBpm);
	}
	for (let stop of songData.stops) {
		let lbpm = Time.getLastBpm('beat', stop.beat).bpm,
			begin = new Bpm(0, 'beat', stop.beat),
			end = new Bpm(lbpm, 'beat', stop.beat);
		end.sec += stop.len;
		bpms.push(begin, end);
	}
	for (let oNote of songData.charts[difficulty]) {
		let nNote;
		if (typeof oNote.beatEnd == 'undefined')
			nNote = new Note('beat', oNote.beat, oNote);
		else
			nNote = new Note('beat', oNote.beat, oNote, 'beat', oNote.beatEnd);
		notes.push(nNote);
	}

	let sg;
	sg = function sg() {
		songData.audio.removeEventListener('canplaythrough', sg);
		startGame(songData);
	};
	songData.audio.addEventListener('canplaythrough', sg);
};
ctx.fillStyle = "grey";
ctx.fillRect(0, 0, 640, 480);