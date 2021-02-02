"use strict";

let bpms = [];

class Time {
	static units = ['sec', 'beat'];
	constructor(unit, time, start = false, events = []) {
		this._sec = 0;
		this._beat = 0;
		this._startTime = null;
		this._autoEventChecker = null;
		this._events = events;
		if (unit)
			if (Time.units.includes(unit))
				this[unit] = time;
			else
				throw new TypeError(`Invalid unit '${unit}'`);
		if (start)
			this.start();
		else
			this._checkEvents();
	}
	destructor() {
		clearInterval(this._autoEventChecker);
	}

	when(unit, time, callback) {
		if (!Time.units.includes(unit))
			throw new TypeError(`Invalid unit '${unit}'`);
		if (typeof time != 'number')
			throw new TypeError(`time is type '${typeof time}' instead of 'number'`);

		if (this._getUnit(unit) >= time)
			this._checkEvents({ unit, time, callback });
		else
			this._events.push({ unit, time, callback });
	}
	_checkEvents(events = this._events) {
		if (!Array.isArray(events))
			events = [events];
		for (let i in events) {
			let e = events[i];
			if (this._getUnit(e.unit, true) >= e.time) {
				let params = {};
				for (let u of Time.units) {
					let unitInfo = {};
					if (u == e.unit)
						unitInfo.intendedTime = e.time;
					else if (u == 'beat') // TODO: find a better way to do this that doesn't rely on hardcoded units
						unitInfo.intendedTime = Time.secToBeat(e.time);
					else if (u == 'sec')
						unitInfo.intendedTime = Time.beatToSec(e.time);
					unitInfo.currentTime = this._getUnit(u);
					unitInfo.delay = unitInfo.currentTime - unitInfo.intendedTime;
					params = Object.assign(params, { [u]: unitInfo });
				}
				e.callback(params);
				events.splice(i, 1);
			}
		}
	}

	start(autoCheck = true) {
		this._startTime = performance.now() / 1e3;

		if (autoCheck)
			this._autoEventChecker = setInterval(_ => this._checkEvents(), 0); // TODO: decide on reasonable number for this
	}
	stop(unit, time) {
		if (unit == undefined && time == undefined) {
			unit = 'sec';
			time = this.sec;
		}
		this.when(unit, time, function _stop({ sec: { intendedTime } }) {
			this._startTime = null;
			this._sec = intendedTime;

			clearInterval(this._autoEventChecker);
		});
	}

	_getUnit(unit, suppressWarn, startTime = this._startTime) {
		let addTime = 0;
		if (startTime != null)
			addTime = performance.now() / 1e3 - startTime;
		if (unit == 'sec') // TODO: find a better way to do this that doesn't rely on hardcoded units
			return this._sec + addTime;
		else {
			let a = Time.secToBeat(addTime, suppressWarn);
			if (typeof a == 'number')
				return this._beat + Time.secToBeat(addTime);
			else
				return;
		}
	}
	get sec() { return this._getUnit('sec'); }
	get beat() { return this._getUnit('beat'); }
	set sec(value) {
		if (this._startTime != null) {
			console.warn(`Sec set while running, this can cause precision issues. This should be sceduled instead`);
			this._startTime = performance.now() / 1e3;
		}
		this._sec = value;
		this._beat = Time.secToBeat(value);

		this._checkEvents();
	}
	set beat(value) {
		if (this._startTime != null) {
			console.warn(`Beat set while running, this can cause precision issues. This should be sceduled instead`);
			this._startTime = performance.now() / 1e3;
		}
		this._beat = value;
		this._sec = Time.beatToSec(value);

		this._checkEvents();
	}
	get running() {
		return this._startTime;
	}

	static secToBeat(sec, bpmList = bpms, suppressWarn) {
		if (sec == 0)
			return 0;
		let lb = Time.getLastBpm('sec', sec, bpmList, suppressWarn);
		return (sec - lb.sec) * (lb.bpm / 60) + lb.beat;
	}
	static beatToSec(beat, bpmList = bpms, suppressWarn) {
		if (beat == 0)
			return 0;
		let lb = Time.getLastBpm('beat', beat, bpmList, suppressWarn);
		return (beat - lb.beat) / (lb.bpm / 60) + lb.sec;
	}
	static getLastBpm(unit, time, bpmList = bpms, suppressWarn) {
		if (!Time.units.includes(unit))
			throw new TypeError(`Invalid unit '${unit}'`);
		if (!Array.isArray(bpmList))
			throw new TypeError(`bpms is type '${typeof bpmList}' instead of 'Array'`);
		let sortedBpmList = bpmList.sort((a, b) => b[unit] - a[unit]);
		let lastBpm = sortedBpmList.find(b => b[unit] <= time);
		if (!lastBpm && time < 0)
			lastBpm = sortedBpmList.find(b => b[unit] <= 0);

		if (!(lastBpm instanceof Bpm)) {
			let err;
			if (bpmList.length)
				err = new TypeError(`Bpm missing or bpms array is contaminated!`);
			else
				err = new ReferenceError(`Tried to convert beat/sec when no bpms exist!`);
			if (!suppressWarn)
				console.warn(err, bpmList, lastBpm, time);
			return err;
		}
		return lastBpm;
	}
}

class Bpm extends Time {
	constructor(bpm, unit, time) {
		super(unit, time);
		if (typeof bpm != 'number')
			throw new TypeError(`bpm is type '${typeof bpm}' instead of 'number'`);
		this.bpm = bpm;
	}
}

class Note extends Time {
	constructor(unit, time, { type, column }, endUnit, endTime) {
		super(unit, time);
		this.type = type;
		this.column = column;
		if (endUnit)
			this.endTime = new Time(endUnit, endTime);
	}

	get secLength() { return this.endTime && this.endTime.sec - this.sec; }
	get beatLength() { return this.endTime && this.endTime.beat - this.beat; }
	get secEnd() { return this.endTime && this.endTime.sec; }
	get beatEnd() { return this.endTime && this.endTime.beat; }

	set secEnd(val) { this.endTime && (this.endTime.sec = val); }
	set beatEnd(val) { this.endTime && (this.endTime.beat = val); }
}