let hitreg = new function HitregNamespace() {
	this.timingWindows = {
		miss: { name: "Miss", hit: false, sec: .2 }, // miss is hardcoded, name can't be changed
		bad: { name: "Bad", hit: true, sec: .125 },
		good: { name: "Good", hit: true, sec: .05 },
		perfect: { name: "Perfect", hit: true },
	};

	let noteTestBegin = null;
	/**
	 * @param {number} [currentTime]
	 */
	function updateNTB(currentTime = songTime.sec) {
		noteTestBegin = Math.max(noteTestBegin, currentTime - this.timingWindows);
	};
	/**
	 * Get array of all notes in range
	 * Default is hittable notes
	 * @param {number|Time} [currentTime] (Not used if using start and end)
	 * @param {number|Time} [start] Time in sec if number
	 * @param {number|Time} [end] Time in sec if number
	 * @param {Time[]} [arr] Notes to check
	 * @return {Time[]} Notes in range
	 */
	this.getNoteRange = function (currentTime = songTime.sec, start, end, arr = notes) {
		if (currentTime instanceof Time)
			currentTime = currentTime.sec;

		if (start instanceof Time)
			start = start.sec;
		else if (typeof start != 'number')
			start = currentTime - this.timingWindows.miss.sec;

		if (end instanceof Time)
			end = end.sec;
		else if (typeof end != 'number')
			start = currentTime + this.timingWindows.miss.sec;

		return arr.filter(n => n.sec > start && n.sec < end);
	};
	/**
	 * Checks if any notes have been completely missed
	 * @param {number|Time} [currentTime]
	 */
	this.calculateMissed = function (currentTime = songTime.sec) {
		if (currentTime instanceof Time)
			currentTime = currentTime.sec;

		let lastNTB = noteTestBegin;
		updateNTB(currentTime);
		let missed = this.getNoteRange(undefined, lastNTB, noteTestBegin)
		for (let note of missed) {

		}
	};
	/**
	 * 
	 * @param {boolean} input.pressed
	 * @param {string} input.type
	 * @param {Time} input.time
	 * @param {number} input.timestamp
	 */
	this.handleInput = function (input) {
		this.calculateMissed(input.time);

	};
	/**
	 * Find timing window
	 * @param {Time|Note} note Time of note
	 * @param {Time} inputTime Time of input
	 * @returns {string} Timing window
	 */
	this.getTimingWindow = function (note, inputTime) {
		let hdt = Math.abs(inputTime.sec - note.sec);

		for (let i in this.timingWindows)
			if (hdt <= (this.timingWindows[i].sec ?? 0))
				return i;
	};
	/**
	 * Hits or misses a note
	 * @param {string|timingWindow} tw Timing window
	 * @param {Note} note
	 * @param {bool} [doHit]
	 * @param {bool} [doMiss]
	 */
	this.hitNote = function (tw, note, doHit, doMiss) {
		if (tw.hit) {
			if (doHit) { // hit

			}
		} else
			if (doMiss) { // miss

			}
	};
}