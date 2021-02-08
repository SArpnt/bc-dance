"use strict";

const LANES = 4;

createjs.Ticker.timingMode = createjs.Ticker.RAF;
const stage = new createjs.Stage("bc-dance"),
	tempShape = new createjs.Shape(); // TODO: get rid of this and use createjs properly
stage.addChild(tempShape);

let songTime = new AudioTime(),
	notes = [];

let draw;
{
	const ELEMS = {
		bpm: document.getElementById('bpm'),
		beat: document.getElementById('beat'),
		sec: document.getElementById('sec'),
		fps: document.getElementById('fps'),
	};

	draw = function draw() {
		let curTime = new Time(songTime);
		const
			size = 32, // temporary render variable
			xMod = 4; // temporary render variable

		hitreg.calculateMissed(curTime.sec);

		tempShape.graphics.clear();
		tempShape.graphics.beginFill("#000").drawRect(0, 0, 640, 480); // temporary background
		tempShape.graphics.beginFill("#666");
		for ( // bar lines
			let i = Math.ceil(curTime.beat / 4) * 4;
			i < (Math.ceil(curTime.beat / 4) + 8) * 4;
			i += 4
		) {
			tempShape.graphics.drawRect(
				0 * size,
				(i - curTime.beat) * xMod * size,
				size * LANES,
				size / 4
			);
		}

		const noteTimings = {
			4: '#f00',
			8: '#00f',
			12: '#80f',
			16: '#0f0',
			24: '#80f',
			32: '#ff0',
			48: '#80f',
			64: '#0ff',
			192: '#0ff',
			def: '#888',
		};
		function renderNote(note, notePos = note.beat - curTime.beat, noteType = note.type, noteLength = note.beatLength) {
			tempShape.graphics.beginFill('#f0f')
			tempShape.graphics.beginFill({
				'M': _ => '#700',
				'1': function () {
					for (let timing in noteTimings)
						if ((note.beat + 1e-4) % (4 / timing) < 2e-4)
							return noteTimings[timing];

					return noteTimings.def;
				},
				'2': _ => '#0ff',
				'4': _ => '#0f0',
				'receptor': _ => `hsl(0, 0%, ${Math.max(1 - (curTime.beat % 1) * 2, 0) * 12.5 + 37.5}%)`,
			}[noteType]());

			tempShape.graphics.drawRoundRect(
				note.column * size,
				(notePos * xMod * size) + (noteLength ? size / 2 : 0),
				size,
				((noteLength * xMod * size) || 0) + (noteLength ? size / 2 : size),
				size / 4,
			);
			if (noteType == '2' || noteType == '4')
				renderNote(note, undefined, '1', false);
		}
		for (let c = 0; c < 4; c++)
			renderNote({ column: c }, 0, 'receptor');
		notes.filter(n =>
			(n.endTime ?? n).beat - curTime.beat > -1 &&
			n.beat - curTime.beat < 16
		).forEach(n => renderNote(n));

		stage.update();
		ELEMS.fps.innerHTML = createjs.Ticker.getMeasuredFPS();
		ELEMS.bpm.innerHTML = Bpm.getLastBpm('sec', curTime.sec).bpm;
		ELEMS.sec.innerHTML = curTime.sec;
		ELEMS.beat.innerHTML = curTime.beat;
	};
}

function startGame({ audio, offset }) {
	if (audio)
		audio.play();
	else
		console.warn(`No audio found`);
	songTime.offset = offset;
	hitreg.ntb = -Infinity;
	songTime.start();
	createjs.Ticker.on('tick', draw);
}

/**
 * Input
 */

const KEYMAP = {
	ArrowLeft: 'left',
	ArrowDown: 'down',
	ArrowUp: 'up',
	ArrowRight: 'right',
};
const INPUT_PROPS = {
	left: { column: 0 },
	down: { column: 1 },
	up: { column: 2 },
	right: { column: 3 },
};
let curInput = {
	left: false,
	down: false,
	up: false,
	right: false,
};
function press(event) {
	if (!event.repeat) {
		let input = {
			pressed: event.type == 'keydown',
			type: KEYMAP[event.code],
			timeStamp: event.timeStamp,
		};
		if (songTime.running) {
			let t = songTime.startTime;
			t.sec = event.timeStamp / 1e3 - t.sec; // this is kinda ugly but it prevents having to make a new Time
			input.time = t;
		} else
			input.time = new Time(songTime);
		curInput[input.type] = input.pressed;
		input = Object.assign(input, INPUT_PROPS[input.type]);

		if (input.column)
			hitreg.handleInput(input);
	}
}
addEventListener("keydown", press);
addEventListener("keyup", press);

/**
 * start song
 */

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
	audio.playbackRate = 1;
	songTime.audio = songData.audio = audio;

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

	audio.play().then(function _a() {
		audio.addEventListener('canplaythrough', function _b() {
			startGame(songData);
		});
	});
};