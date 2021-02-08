"use strict";

let bpms = [];

class Time {
	constructor(unit, time) {
		this._units = {};
		for (let u of Time.units)
			this._units[u] = 0;
		if (unit) {
			Time.verifyUnit(unit);
			this.setTime(unit, time);
		}
	}

	getTime(unit) {
		Time.verifyUnit(unit);
		return this._units[unit];
	}
	setTime(unit, value) {
		Time.verifyUnit(unit);
		this._units[unit] = value;
		for (let u of Time.units)
			if (u != unit)
				this._units[u] = Time.convertTime(unit, u, value);
	}
	get sec() { return this.getTime('sec'); }
	get beat() { return this.getTime('beat'); }
	set sec(value) { return this.setTime('sec', value); }
	set beat(value) { return this.setTime('beat', value); }

	static convertTime(inUnit, outUnit, value, bpmList = bpms, suppressWarn) {
		Time.verifyUnit(inUnit, outUnit);
		if (value == 0)
			return 0;
		if (inUnit == outUnit)
			return value;

		let lb = Bpm.getLastBpm(inUnit, value, bpmList, suppressWarn);
		if (lb instanceof Error)
			return lb;

		let out = (value - lb.getTime(inUnit));
		switch (inUnit) { // TODO: deal with outunits
			case 'sec':
				out *= (lb.bpm / 60);
				break;
			case 'beat':
				out /= (lb.bpm / 60);
				break;
		}
		return out + lb.getTime(outUnit);
	};

	static verifyUnit() {
		for (let unit of arguments)
			if (!Time.units.includes(unit))
				throw new TypeError(`Invalid unit '${unit}'`);
	}
}
Time.units = ['sec', 'beat'];

class DynamicTime extends Time {
	constructor(unit, time, start = false, events = []) {
		super(unit, time);
		this._startTime = null;
		this._autoEventChecker = null;
		this._events = events;
		if (start)
			this.start();
		else
			this._checkEvents();
	}
	destructor() {
		clearInterval(this._autoEventChecker);
	}

	when(unit, time, callback) {
		Time.verifyUnit(unit);
		if (typeof time != 'number')
			throw new TypeError(`time is type '${typeof time}' instead of 'number'`);

		if (this.getTime(unit) >= time)
			this._checkEvents({ unit, time, callback });
		else
			this._events.push({ unit, time, callback });
	}
	_checkEvents(events = this._events) {
		if (!Array.isArray(events))
			events = [events];
		for (let i in events) {
			let e = events[i];
			if (this.getTime(e.unit, true) >= e.time) {
				let params = {};
				for (let u of Time.units) {
					let unitInfo = {};
					unitInfo.intendedTime = Time.convertTime(e.unit, u, e.time);
					unitInfo.currentTime = this.getTime(u);
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
			this._autoEventChecker = setInterval(_ => this._checkEvents(), DynamicTime.eventCheckRate);
	}
	stop(unit, time) {
		if (unit == undefined && time == undefined) {
			unit = 'sec';
			time = this.sec;
		}
		this.when(unit, time, this._stopEvent);
	}
	_stopEvent({ sec: { intendedTime } }) {
		this._startTime = null;
		this.sec = intendedTime;

		clearInterval(this._autoEventChecker);
	}

	getTime(unit, suppressWarn, startTime = this._startTime) {
		let addTime = 0;
		if (startTime != null)
			addTime = performance.now() / 1e3 - startTime;

		let a = Time.convertTime('sec', unit, addTime, suppressWarn);
		if (typeof a == 'number')
			return super.getTime(unit) + a;
		else
			return a;
	}
	setTime(unit, value) {
		if (this._startTime != null) {
			console.warn(`Set time while running, this can cause precision issues. This should be sceduled instead`);
			this._startTime = performance.now() / 1e3;
		}

		super.setTime(unit, value);

		this._checkEvents();
	}

	get running() {
		return !!this._startTime;
	}
	get startTime() {
		return new Time('sec', this._startTime);
	}
}
DynamicTime.eventCheckRate = 0; // TODO: decide on reasonable number for this

class AudioTime extends DynamicTime {
	constructor(audio, unit, time, start, events) {
		this.muted = audio.muted;
		this.audio = audio;
		super(unit, time, start, events);
	}

	get audio() { return this._audio; }
	set audio(audio) {
		if (typeof audio == 'string')
			audio = new Audio(audio);
		this._audio = audio;

		this._audio.muted = true;
		this._audio.play();
	}

	start(autoCheck = true) {
		this._startTime = performance.now() / 1e3;
		this._audio.currentTime = this._startTime;
		this._audio.muted = this.muted;

		if (autoCheck)
			this._autoEventChecker = setInterval(_ => this._checkEvents(), DynamicTime.eventCheckRate);
	}
	_stopEvent({ sec: { intendedTime } }) {
		this._startTime = null;
		this.sec = intendedTime;

		clearInterval(this._autoEventChecker);
	}
	getTime(unit) {
		Time.verifyUnit(unit);
		return this._units[unit];
	}
	setTime(unit, value) {
		if (this._startTime != null) {
			console.warn(`Set time while running, this can cause precision issues. This should be sceduled instead`);
			this._startTime = performance.now() / 1e3;
			this._audio.currentTime = this._startTime;
		}

		super.setTime(unit, value);

		this._checkEvents();
	}

	get running() {
		return !!this._startTime;
	}
}

class Bpm extends Time {
	constructor(bpm, unit, time) {
		super(unit, time);
		if (typeof bpm != 'number')
			throw new TypeError(`bpm is type '${typeof bpm}' instead of 'number'`);
		this.bpm = bpm;
	}

	static getLastBpm(unit, time, bpmList = bpms, suppressWarn) {
		Time.verifyUnit(unit);
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

class Note extends Time {
	constructor(unit, time, { type, column }, endUnit, endTime) {
		super(unit, time);
		this.type = type;
		this.column = column;
		if (endUnit)
			this.endTime = new Time(endUnit, endTime);
	}

	getEndTime(unit) {
		if (this.endTime)
			return this.endTime.getTime(unit);
	}
	setEndTime(unit, value) {
		if (this.endTime)
			this.endTime.setTime(unit, value);
	}

	get secLength() { return this.getEndTime('sec') - this.sec; }
	get beatLength() { return this.getEndTime('beat') - this.beat; }
	get secEnd() { return this.getEndTime('beat'); }
	get beatEnd() { return this.getEndTime('beat'); }

	set secEnd(val) { setEndTime('sec', val); }
	set beatEnd(val) { setEndTime('beat', val); }
}