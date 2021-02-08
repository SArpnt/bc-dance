"use strict";

const LANES = 4;

createjs.Ticker.timingMode = createjs.Ticker.RAF;
const stage = new createjs.Stage("bc-dance"),
	tempShape = new createjs.Shape(); // TODO: get rid of this and use createjs properly
stage.addChild(tempShape);

let songTime = new DynamicTime(),
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
		let
			sec = songTime.sec,
			beat = songTime.beat;
		const
			size = 32, // temporary render variable
			xMod = 4; // temporary render variable

		tempShape.graphics.clear();
		tempShape.graphics.beginFill("#000000").drawRect(0, 0, 640, 480); // temporary background
		tempShape.graphics.beginFill("#666666");
		for ( // bar lines
			let i = Math.ceil(beat / 4) * 4;
			i < (Math.ceil(beat / 4) + 8) * 4;
			i += 4
		) {
			tempShape.graphics.drawRect(
				0 * size,
				(i - beat) * xMod * size,
				size * LANES,
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
		function renderNote(note, noteType = note.type, noteLength = note.beatLength) {
			if (note.sec - sec > 0)
				tempShape.graphics.beginFill({
					'M': _ => '#880000',
					'1': function () {
						for (let timing in noteTimings)
							if ((note.beat + 1e-4) % (4 / timing) < 2e-4)
								return noteTimings[timing];

						return noteTimings.def;
					},
					'2': _ => '#00ffff',
					'4': _ => '#00ff00',
				}[noteType]());
			else
				tempShape.graphics.beginFill('#ff00ff');

			tempShape.graphics.drawRoundRect(
				note.column * size,
				((note.beat - beat) * xMod * size) + (noteLength ? size / 2 : 0),
				size,
				((noteLength * xMod * size) || 0) + size,
				size / 4,
			);
			if (noteType == '2' || noteType == '4')
				renderNote(note, '1', false);
		}
		notes.filter(n =>
			(n.endTime ?? n).beat - songTime.beat > -1 &&
			n.beat - songTime.beat < 16
		).forEach(n => renderNote(n));

		stage.update();
		ELEMS.fps.innerHTML = createjs.Ticker.getMeasuredFPS();
		ELEMS.bpm.innerHTML = Bpm.getLastBpm('sec', sec).bpm;
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
	hitreg.noteTestBegin = 0;
	songTime.start();
	createjs.Ticker.on('tick', draw);
}

/**
 * Input
 */

const KEYMAP = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
};
let keyInput = {
	up: false,
	down: false,
	left: false,
	right: false,
};
function press(v) {
	return function _press(event) {
		if (!event.repeat) {
			let input = {
				pressed: v,
				type: KEYMAP[event.code],
				timeStamp: event.timeStamp,
			};
			if (songTime.running) {
				let t = songTime.startTime;
				t.sec = event.timeStamp / 1e3 - t.sec; // this is kinda ugly but it prevents having to make a new Time
				input.time = t;
			}
			keyInput[input.type] = input.pressed;
			hitreg.handleInput(input);
		}
	};
}
addEventListener("keydown", press(true));
addEventListener("keyup", press(false));

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

	audio.volume = 0;
	audio.play().then(function sg() {
		audio.pause();
		audio.currentTime = 0;
		audio.volume = 1;
		startGame(songData);
	});
};