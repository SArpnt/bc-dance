"use strict";

function parseSM(sm) {
	let songData = {
		bpms: [],
		stops: [],
		charts: {},
		offset: null,
	};
	sm = sm.replace(/\/\/.*/g, '')
		.replace(/\r?\n|\r/g, '')
		.split(';');
	for (let i = sm.length - 1; i >= 0; i -= 1) {
		if (sm[i]) {
			sm[i] = sm[i].split(/:/g);
			for (let p in sm[i])
				sm[i][p] = sm[i][p].trim();
		} else
			sm.splice(i, 1);
	}

	console.log("seperated SM:", sm);

	for (let smLine of sm) {
		switch (smLine[0]) {
			case '#OFFSET':
				songData.offset = +smLine[1];
				break;
			case '#BPMS':
				{
					let bpmList = smLine[1].split(','); // bpm list
					bpmList = bpmList.filter(i => /=/.exec(i));

					bpmList = bpmList.map(function bpmMap(bpm) {
						let v = bpm.split('=');
						return {
							beat: +v[0],
							bpm: +v[1],
						};
					});
					songData.bpms.push(...bpmList);
				}
				break;
			case '#STOPS':
				{
					let stopList = smLine[1].split(','); // stop list
					stopList = stopList.filter(i => i.includes('='));

					stopList = stopList.map(function stopMap(stop) {
						let v = stop.split('=');
						return {
							beat: +v[0],
							len: +v[1],
						};
					});
					songData.stops.push(...stopList);
				}
				break;
			case '#NOTES':
				let chart = smLine[6].split(',').map(m => m.trim());
				for (let measure in chart) {
					if (chart[measure].length % 4)
						throw `Invalid length on measure ${measure}, length is ${chart[measure].length}, full string: ${chart[measure]}`;
					chart[measure] = chart[measure].match(/(.{4})/g);
				}
				songData.charts[smLine[3]] = chart;
				break;
			default:
				console.debug(`Unrecognised sm property "${smLine[0]}"`);
		}
	}

	console.log("Got basic songData from SM:", songData);

	for (let difficulty in songData.charts) {
		let chart = songData.charts[difficulty];

		let currentHolds = [null, null, null, null];
		for (let measure in chart) {
			let noteInterval = chart[measure].length;
			for (let lineNum in chart[measure]) {
				let line = chart[measure][lineNum];
				let note = [{}, {}, {}, {}];
				let b = measure * 4 + lineNum / noteInterval * 4; // for efficiency
				for (let column = 0; column < note.length; column++) {
					switch (line[column]) {
						case '3': // hold end
							if (currentHolds[column] == null)
								throw `Hold end without any hold before at measure ${measure}, line ${lineNum}`;
							{
								let i = notes[currentHolds[column]];
								i.beatEnd = b;
							}
							// add more hold end script
							currentHolds[column] = null;
						case '0': // none
							note[column] = null;
							continue;
						case '4': // roll
						case '2': // hold
							if (currentHolds[column]) throw `New hold started before last ended at measure ${measure}, line ${lineNum}`;
							currentHolds[column] = notes.length + column;
						case '1': // regular note
						case 'M': // mine
							note[column].type = line[column];
							break;
						default:
							throw `Invalid note type ${line[column]} at measure ${measure}, line ${lineNum}`;
					}
					note[column].beat = b;
					note[column].column = column;
				}
				notes = notes.concat(note);
			}
		}
		notes = notes.filter(i => i !== null);
		console.log("Parsed chart:", notes);
		songData.charts[difficulty] = notes;
	}

	console.log("Parsed all charts:", songData);

	return songData;
}