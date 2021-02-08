let hitreg = new function HitregNamespace() {
	let hitreg = this;

	hitreg.timingWindows = {
		miss: { name: "Miss", hit: false, sec: .2 }, // miss is hardcoded, name can't be changed
		bad: { name: "Bad", hit: true, sec: .125 },
		good: { name: "Good", hit: true, sec: .05 },
		perfect: { name: "Perfect", hit: true },
	};

	hitreg.ntb = null; // Note test begin
	/**
	 * @param {number} [currentTime]
	 */
	function updateNTB(currentTime = songTime.sec) {
		hitreg.ntb = Math.max(hitreg.ntb, currentTime - hitreg.timingWindows.miss.sec);
	};
	/**
	 * Get array of all notes in range, default range is hittable notes
	 * @param {number|Time} [currentTime] Used for relative time, set to 0 to disable
	 * @param {number|Time} [start] Time in sec if number
	 * @param {number|Time} [end] Time in sec if number
	 * @param {boolean} [startInclu] Start time inclusive
	 * @param {boolean} [endInclu] End time inclusive
	 * @param {Time[]} [arr] Notes to check
	 * @return {Time[]} Notes in range
	 */
	hitreg.getNoteRange = function (currentTime = songTime.sec, start, end, startInclu = true, endInclu = false, arr = notes) {
		if (currentTime instanceof Time)
			currentTime = currentTime.sec;

		if (start instanceof Time)
			start = start.sec;
		else if (typeof start != 'number') {
			if (hitreg.ntb >= hitreg.timingWindows.miss.sec) {
				start = hitreg.ntb;
				startInclu = false;
			} else
				start = currentTime - hitreg.timingWindows.miss.sec;
		}

		if (end instanceof Time)
			end = end.sec;
		else if (typeof end != 'number')
			end = currentTime + hitreg.timingWindows.miss.sec;

		return arr.filter(n =>
			(startInclu ? n.sec >= start : n.sec > start) &&
			(endInclu ? n.sec <= end : n.sec < end)
		);
	};
	/**
	 * Checks if any notes have been completely missed
	 * @param {number|Time} [currentTime]
	 * @param {number} [setNTB]
	 */
	hitreg.calculateMissed = function (currentTime = songTime.sec, setNTB) {
		if (currentTime instanceof Time)
			currentTime = currentTime.sec;

		let lastNTB = hitreg.ntb;

		if (setNTB == undefined)
			updateNTB(currentTime);
		else
			hitreg.ntb = setNTB;

		hitreg.getNoteRange(0, lastNTB, hitreg.ntb, false, true)
			.filter(n => !n.hit)
			.forEach(n => hitreg.hitNote('miss', n));
	};
	/**
	 * @param {Object} input
	 * @param {boolean} input.pressed
	 * @param {string} input.type
	 * @param {Time} input.time
	 * @param {number} input.timestamp
	 */
	hitreg.handleInput = function (input) {
		if (input.pressed) {
			hitreg.calculateMissed(input.time);

			for (let note of hitreg.getNoteRange(input.time))
				if (input.column == note.column) {
					hitreg.hitNote(hitreg.getTimingWindow(note, input.time), note);
					break;
				}
		}
	};
	/**
	 * Find timing window
	 * @param {Time|Note} note Time of note
	 * @param {number|Time} inputTime Time of input in secs
	 * @returns {string} Timing window
	 */
	hitreg.getTimingWindow = function (note, inputTime) {
		if (inputTime instanceof Time)
			inputTime = inputTime.sec;

		let hdt = Math.abs(inputTime - note.sec);
		for (let i in hitreg.timingWindows)
			if (hdt > (hitreg.timingWindows[i].sec ?? -Infinity))
				return i;
	};
	/**
	 * Hits or misses a note
	 * @param {string} tw Timing window
	 * @param {Note} [note]
	 * @param {bool} [doHit]
	 * @param {bool} [doMiss]
	 */
	hitreg.hitNote = function (tw, note, doHit = true, doMiss = true) {
		if (typeof tw == 'string')
			tw = hitreg.timingWindows[tw];
		if (tw.hit) {
			if (doHit) { // hit
				console.log("%c Hit note:", "color: green", note, tw);
				if (note) {
					note.hit = true;
					hitreg.calculateMissed(undefined, note.sec);
				}
			}
		} else
			if (doMiss) { // miss
				console.log("%c Missed note:", "color: red", note, tw);
			}
	};
}