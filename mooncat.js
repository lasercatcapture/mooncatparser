/*
Copyright © 2021 LaserCatCapture

Copyright © 2017 ponderware ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

Except with the prior written authorization from ponderware ltd., any modifications made to the Software shall not be represented, promoted, or sold as the official or canonical Software or property of MoonCatRescue or ponderware ltd., and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const { Canvas } = require('canvas');
const fs = require('fs');
const readline = require('readline');
const { once } = require('events');
const tinycolor = require('tinycolor2');
const Gradient = require('javascript-color-gradient');
const { rando, randoSequence } = require('@nastyox/rando.js');
const Gm = require('gm');

const mooncatparser = require("./mooncatparser.js");

var allLaserCats = [], lines = [], endowed = [], archetypes = [], archetypes1 = [], archetypeIds = [], archetypeIds1 = [];

var laserCatTypes = new Map();

const isPrime = n => {
	for (let i = 2; i < n; i++)
		if (n % i === 0) return false;
	return n > 1;
}

function hexToBytes(hex) {
	var result = []
	for (var i = 0; i < hex.length; i += 2) {
		result.push(parseInt(hex.slice(i, i + 2), 16));
	}
	return result;
}

function makeRainbow() {
	const rainbowColor = new Gradient();

	const red = "#E03C31";
	const ora = "#FF7F41";
	const yel = "#F7EA48";
	const grn = "#2DC84D";
	const blu = "#147BD1";
	const vio = "#753BBD";

	rainbowColor.setMidpoint(40);
	rainbowColor.setGradient(red, ora, yel, grn, blu, vio);

	return rainbowColor.getArray();
}

function getStripe(col) {
	let brightness = Math.floor(tinycolor(col).getBrightness());
	if (brightness < 140)
		return tinycolor(col).brighten(10).toString();
	else if (brightness < 188)
		return tinycolor(col).brighten(20).toString();
	else if (brightness < 220)
		return tinycolor(col).brighten(20).toString();
	else
		return tinycolor(col).darken(20).toString();
}

function expandSize(data, newSize) {
	let result = Array(newSize).fill(null).map(y => Array(newSize).fill(null))

	let x = Math.floor((newSize - data.length) / 2);
	let y = Math.floor((newSize - data[0].length) / 2);

	for (let row = 0; row < data.length; row++) {
		for (let col = 0; col < data[0].length; col++) {
			result[row + x][col + y] = data[row][col];
		}
	}

	return result;
}

function pad(number, width) {
	width -= number.toString().length;
	if (width > 0) {
		return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number;
	}
	return number + "";
}

function Distortion() {
	let frame = 0;
	this.calc = function(n) {
		frame += 0.002 * 0.03;
		return Math.sin(frame + n * 0.03 * 10);
	};
}

function getLaserStart(data) {
	let laserStart = [[], []];
	for (let i = 0; i < data.length - 4; i++) {
		for (let j = 0; j < data[i].length; j++) {
			let color = data[i][j];

			if (color == "#ff0000") {
				laserStart[0].push(i);
				laserStart[1].push(j);
			}
		}
	}

	return laserStart;
}

function getLaserData(design, frame, data) {
	let laserStart = getLaserStart(data);

	let direction;

	switch (design) { // DR1, DL2, UL3, UR4
		case 0:
			direction = frame == 1 ? 1 : 2;
			break;
		case 1:
			direction = frame == 1 ? 3 : 1;
			break;
		case 2:
			direction = frame == 1 ? 2 : 1;
			break;
		case 3:
			direction = frame == 1 ? 1 : 4;
			break;
		case 4:
			direction = frame == 1 ? 2 : 1;
			break;
		case 5:
			direction = frame == 1 ? 4 : 2;
			break;
		case 6:
			direction = frame == 1 ? 1 : 2;
			break;
		case 7:
			direction = frame == 1 ? 2 : 3;
			break;
	}

	for (let numLaser = 0; numLaser < laserStart[0].length; numLaser++) {
		let laserStartX = laserStart[0][numLaser];
		let laserStartY = laserStart[1][numLaser];

		switch (direction) {
			case 1:
				// down right laser
				for (let x = 0; laserStartX + x < data.length; x++) {
					if (laserStartY + x < data[laserStartX].length)
						data[laserStartX + x][laserStartY + x] = "#ff0000";
				}
				break;
			case 2:
				// down left laser
				for (let x = 0; laserStartX - x + 4 >= 0; x++) {
					if (laserStartX - x >= 0 && laserStartY + x < data[laserStartX].length)
						data[laserStartX - x][laserStartY + x] = "#ff0000";
				}
				break;
			case 3:
				// up left laser
				for (let x = 0; laserStartY - x >= 0; x++) {
					if (laserStartX - x >= 0)
						data[laserStartX - x][laserStartY - x] = "#ff0000";
				}
				break;
			case 4:
				// up right laser
				for (let x = 0; laserStartY - x >= 0; x++) {
					if (laserStartX + x < data.length)
						data[laserStartX + x][laserStartY - x] = "#ff0000";
				}
				break;
		}
	}

	return data;
}

function writeImage(canvas, catId, dimension, catIndex, design, data) {
	let size = Math.floor(dimension / data.length);
	let pad = Math.floor((dimension - (size * data.length)) / 2);
	pad = pad < 0 ? 0 : pad;

	let ctx = canvas.getContext('2d');
	for (let i = 0; i < data.length; i++) {
		for (let j = 0; j < data[i].length; j++) {
			let color = data[i][j];

			if (color) {
				ctx.fillStyle = color;
				ctx.fillRect((i * size) + pad, (j * size) + pad, size, size);
			}
		}
	}

	return canvas;
}

async function generateLaserCatImage(line, catIndex) {
	line = line.split(',');
	let catId = line[1];

	if (catId.slice(0, 2) == "0x") {
		catId = catId.slice(2);
	}
	let bytes = hexToBytes(catId);

	let metadata = {};
	metadata.name = 'LaserCat ' + catIndex.toString();
	metadata.description = 'Your LaserCat\'s ID tag is engraved with Genotype 0x' + catId;
	metadata.attributes = [];

	const twoHeaded = bytes[1] % 128 <= 3;

	let rainbow = false, spacebg = false, laserEyes = false, laserShow = false, distorted = false;

	if (twoHeaded) {
		for (let i = 0; i < archetypes.length; i++) {
			if (archetypeIds[i].indexOf(catId) > -1) {
				let arch = archetypes[i].split('');

				if (laserShow && !laserEyes) { } else {
					distorted = arch[0] == '1';
					laserEyes = arch[1] == '1';
					spacebg = arch[2] == '1';
					rainbow = arch[3] == '1';
					laserShow = arch[4] == '1';
				}

				break;
			}
		}

		if (!rainbow && !spacebg && !distorted && !laserEyes) {
			if (rando(0, 4) == 0) {
				rainbow = true;
				spacebg = true;
			} else {
				spacebg = rando(0, 2) == 0;
				if (!spacebg)
					rainbow = true;
			}
		}
	} else {
		let a = false;

		for (let i = 0; i < archetypes.length; i++) {
			if (archetypeIds1[i].indexOf(catId) > -1) {
				let arch = archetypes[i].split('');

				if (laserShow && !laserEyes) { } else {
					distorted = arch[0] == '1';
					laserEyes = arch[1] == '1';
					spacebg = arch[2] == '1';
					rainbow = arch[3] == '1';
					laserShow = arch[4] == '1';
					a = true;
				}

				break;
			}
		}

		if (!a) {
			rainbow = isPrime(catIndex) && rando(0, 3) == 0;
			laserEyes = rando(0, 15) == 0;
		}
	}

	let laserCatType = '';
	laserCatType = twoHeaded ? laserCatType.concat('1') : laserCatType.concat('0');
	laserCatType = distorted ? laserCatType.concat('1') : laserCatType.concat('0');
	laserCatType = laserEyes ? laserCatType.concat('1') : laserCatType.concat('0');
	laserCatType = spacebg ? laserCatType.concat('1') : laserCatType.concat('0');
	laserCatType = rainbow ? laserCatType.concat('1') : laserCatType.concat('0');
	laserCatType = laserShow && laserEyes ? laserCatType.concat('1') : laserCatType.concat('0');

	laserCatTypes.set(catIndex, laserCatType);

	if (twoHeaded) {
		metadata.attributes.push({ 'trait_type': 'Head', 'value': 'Two Headed' });
	} else {
		metadata.attributes.push({});
	}

	if (laserShow && laserEyes) {
		metadata.attributes.push({ 'trait_type': 'Eyes', 'value': 'Laser Show' });
	} else if (laserEyes && !laserShow) {
		metadata.attributes.push({ 'trait_type': 'Eyes', 'value': 'Laser Eyes' });
	} else {
		metadata.attributes.push({ 'trait_type': 'Eyes', 'value': "Pacified" });
	}

	if (rainbow) {
		metadata.attributes.push({ 'trait_type': 'Color', 'value': 'Rainbow' });
	} else {
		metadata.attributes.push({ 'trait_type': 'Color', 'value': line[8] });
	}

	if (spacebg) {
		metadata.attributes.push({ 'trait_type': 'Background', 'value': 'Space Background' });
	} else {
		metadata.attributes.push({});
	}

	if (distorted) {
		metadata.attributes.push({ 'trait_type': 'Ability', 'value': 'Spacetime Distortion' });
	} else {
		metadata.attributes.push({});
	}

	let generatedLaserCat = mooncatparser(catId);

	let data = generatedLaserCat.data,
		laserCatId = generatedLaserCat.laserCatId;

	metadata.laserCatId = laserCatId;

	let counts = new Map()
	for (let i = 0; i < data.length; i++) {
		for (let j = 0; j < data[i].length; j++) {
			if (!bytes[0] && data[i][j] && tinycolor(data[i][j]).getBrightness() > 50) {
				let n = counts.get(data[i][j]) || 0
				counts.set(data[i][j], n + 1)
			} else if (bytes[0] && data[i][j]) {
				let n = counts.get(data[i][j]) || 0
				counts.set(data[i][j], n + 1)
			}
		}
	}

	let max = Math.max(...counts.values());
	let col;
	for (let [key, value] of counts.entries()) {
		if (value === max)
			col = key;
	}

	let design = (bytes[1] % 4);
	design = (bytes[1] % 128) >= 64 ? design + 4 : design;

	let stripes = rando(0, 2);

	let rainbowColor = makeRainbow();

	for (let i = 0; i < data.length; i++) {
		for (let j = 0; j < data[i].length; j++) {
			let color = data[i][j];

			if (color == col) {
				if (stripes == 0) {
					if (i % 2 == 0) {
						color = getStripe(col);
					}
				} else if (stripes == 1) {
					if (j % 2 == 0) {
						color = getStripe(col);
					}
				} else if (stripes == 2) {
					if (i % 2 != 0 && j % 2 == 0) {
						color = getStripe(col);
					} else if (j % 2 != 0 && i % 2 == 0) {
						color = getStripe(col);
					}
				}

				if (rainbow) {
					color = rainbowColor[Math.floor((i / data.length) * rainbowColor.length)];
				}
			}

			if (bytes[1] % 128 > 3) { // single headed
				switch (design) {
					case 0:
						if (j == 5 && (i == 3 || i == 7))
							color = "#ff0000";
						break;
					case 1:
						if (j == 5 && (i == 4 || i == 8))
							color = "#ff0000";
						break;
					case 2:
						if (j == 5 && (i == 4 || i == 8))
							color = "#ff0000";
						break;
					case 3:
						if (j == 11 && (i == 3 || i == 7))
							color = "#ff0000";
						break;
					case 4:
						if (j == 5 && (i == 13 || i == 17))
							color = "#ff0000";
						break;
					case 5:
						if (j == 5 && (i == 11 || i == 15))
							color = "#ff0000";
						break;
					case 6:
						if (j == 5 && (i == 8 || i == 12))
							color = "#ff0000";
						break;
					case 7:
						if (j == 11 && (i == 12 || i == 16))
							color = "#ff0000";
						break;
				}
			}

			data[i][j] = color;
		}
	}

	// expand image for more laser
	let size = data.length > data[0].length ? data.length + 6 : data[0].length + 6;
	data = expandSize(data, size);

	let tokenIndex = pad(catIndex, 5);

	if (laserShow) {
		if (distorted) {
			let data0 = JSON.parse(JSON.stringify(data));
			let canvas0 = getCanvas(spacebg);
			let canvas1 = getDuplicateCanvas(canvas0);
			let canvas2 = getDuplicateCanvas(canvas0);

			canvas0 = writeImage(canvas0, catId, 1024, catIndex, design, data0);
			let data1 = JSON.parse(JSON.stringify(data));
			canvas1 = writeImage(canvas1, catId, 1024, catIndex, design, getLaserData(design, 1, data1));
			let data2 = JSON.parse(JSON.stringify(data));
			canvas2 = writeImage(canvas2, catId, 1024, catIndex, design, getLaserData(design, 2, data2));
			spacetimeDistortion(canvas0, catIndex, 'frame0');
			spacetimeDistortion(canvas1, catIndex, 'frame1');
			spacetimeDistortion(canvas2, catIndex, 'frame2');
			spacetimeGif(catIndex, ['frame0', 'frame1', 'frame2']);
		} else {
			let data0 = JSON.parse(JSON.stringify(data));
			let canvas0 = getCanvas(spacebg);
			let canvas1 = getDuplicateCanvas(canvas0);
			let canvas2 = getDuplicateCanvas(canvas0);

			canvas0 = writeImage(canvas0, catId, 1024, catIndex, design, data0);
			let buffer = canvas0.toBuffer('image/png');
			fs.writeFileSync('./frames/' + tokenIndex + '_frame0.png', buffer);

			let data1 = JSON.parse(JSON.stringify(data));
			canvas1 = writeImage(canvas1, catId, 1024, catIndex, design, getLaserData(design, 1, data1));
			buffer = canvas1.toBuffer('image/png');
			fs.writeFileSync('./frames/' + tokenIndex + '_frame1.png', buffer);

			let data2 = JSON.parse(JSON.stringify(data));
			canvas2 = writeImage(canvas2, catId, 1024, catIndex, design, getLaserData(design, 2, data2));
			buffer = canvas2.toBuffer('image/png');
			fs.writeFileSync('./frames/' + tokenIndex + '_frame2.png', buffer);

			Gm()
				.in('./frames/' + tokenIndex + '_frame1.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.in('./frames/' + tokenIndex + '_frame1.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.in('./frames/' + tokenIndex + '_frame2.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.in('./frames/' + tokenIndex + '_frame2.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.in('./frames/' + tokenIndex + '_frame0.png')
				.dispose('Background')
				.delay(50)
				.write('./gifs/' + pad(catIndex, 5) + '.gif', function(err) {
					if (err) throw err;
				});
		}
	} else {
		if (distorted) {
			let canvas = writeImage(getCanvas(spacebg), catId, 1024, catIndex, design, getLaserData(design, 1, data));
			spacetimeDistortion(canvas, catIndex, 'frame0');
			spacetimeGif(catIndex, ['frame0']);
		} else if (laserEyes) {
			let canvas = writeImage(getCanvas(spacebg), catId, 1024, catIndex, design, getLaserData(design, 1, data));
			const buffer = canvas.toBuffer('image/png');
			fs.writeFileSync('./lasercats/' + pad(catIndex, 5) + '.png', buffer);
		} else {
			let canvas = writeImage(getCanvas(spacebg), catId, 1024, catIndex, design, data);
			const buffer = canvas.toBuffer('image/png');
			fs.writeFileSync('./lasercats/' + pad(catIndex, 5) + '.png', buffer);
		}
	}

	metadata.attributes.push({ 'trait_type': 'Palette', 'value': line[2] });
	metadata.attributes.push({ 'trait_type': 'Pose', 'value': line[4] });
	metadata.attributes.push({ 'trait_type': 'Facing', 'value': line[5] });
	metadata.attributes.push({ 'trait_type': 'Face', 'value': line[6] });
	metadata.attributes.push({ 'trait_type': 'Fur', 'value': line[7] == 'Striped' ? 'Striped (Prev. Gen)' : line[7] });
	metadata.attributes.push({ 'display_type': 'number', 'trait_type': 'Genotype Mint #', 'value': parseInt(line[15]) });

	allLaserCats.push(metadata);
}

function getDuplicateCanvas(canvas) {
	let duplicate = new Canvas(1024, 1024);
	var ctx = duplicate.getContext('2d');
	ctx.drawImage(canvas, 0, 0);
	return duplicate;
}

function getCanvas(spacebg) {
	if (spacebg)
		return spaceBackground(new Canvas(1024, 1024));
	else
		return new Canvas(1024, 1024);
}

const colors = ['rgba(255, 255, 255, 1)', 'rgba(255, 253, 195, 1)', 'rgba(191, 246, 255, 1)'];
const shadows = ['rgba(255, 255, 255, 0.5)', 'rgba(255, 253, 195, 0.5)', 'rgba(191, 246, 255, 0.5)'];

function spaceBackground(canvas) {
	var ctx = canvas.getContext('2d');
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	for (let t = 0; t < 138; t++) {
		ctx.beginPath();
		ctx.arc(3 + (rando() * canvas.width), 3 + (rando() * canvas.height), 3 * rando(), 0, Math.PI * 2, false);
		let n = Math.floor(rando() * 3);
		let n2 = 3 + Math.floor(rando() * 5);
		ctx.fillStyle = colors[n];
		ctx.shadowColor = shadows[n];
		ctx.shadowBlur = n2;
		ctx.fill();
	}
	return canvas;
}

function spacetimeDistortion(canvas, catIndex, frame) {
	let w = canvas.width;
	let h = canvas.height;
	let ctx = canvas.getContext('2d');
	let dxn = new Distortion();
	let img = new Canvas(1024, 1024);
	img.getContext('2d').drawImage(canvas, 0, 0);
	let canvas2 = new Canvas(1024, 1024);
	canvas2.width = w; canvas2.height = h;
	let ctx2 = canvas2.getContext("2d");

	let x0 = 0, x1 = w * 0.25, x2 = w * 0.5, x3 = w * 0.75, x4 = w,
		y0 = 0, y1 = h * 0.25, y2 = h * 0.5, y3 = h * 0.75, y4 = h;

	let k0 = x1, k1 = x2 - x1, k2 = x3 - x2, k3 = x4 - x3,
		j0 = y1, j1 = y2 - y1, j2 = y3 - y2, j3 = y4 - y3;

	let index = 0, findex = 0, fmax = 150, fskip = 3;

	while (index < fmax) {
		ctx.clearRect(0, 0, w, h);

		for (let y = 0; y < h; y++) {
			let m1 = x1 + dxn.calc(y * 0.2) * 2.5,
				m2 = x2 + dxn.calc(y * 0.2) * 2,
				m3 = x3 + dxn.calc(y * 0.2) * 1.5;
			let w0 = m1, w1 = m2 - m1, w2 = m3 - m2, w3 = x4 - m3;

			ctx.drawImage(img, x0, y, k0, 1, 0, y, w0, 1);
			ctx.drawImage(img, x1, y, k1, 1, m1 - 0.5, y, w1 + 0.5, 1);
			ctx.drawImage(img, x2, y, k2, 1, m2 - 0.5, y, w2 + 0.5, 1);
			ctx.drawImage(img, x3, y, k3, 1, m3 - 0.5, y, w3 + 0.5, 1);
		}

		ctx2.clearRect(0, 0, w, h);
		ctx2.drawImage(canvas, 0, 0);
		ctx.clearRect(0, 0, w, h);

		for (let x = 0; x < w; x++) {
			let o1 = y1 + dxn.calc(x * 0.2) * 2.5, o2 = y2 + dxn.calc(x * 0.2) * 2,
				o3 = y3 + dxn.calc(x * 0.2) * 1.5;

			ctx.drawImage(canvas2, x, y0, 1, j0, x, 0, 1, o1);
			ctx.drawImage(canvas2, x, y1, 1, j1, x, o1 - 0.5, 1, o2 - o1 + 0.5);
			ctx.drawImage(canvas2, x, y2, 1, j2, x, o2 - 0.5, 1, o3 - o2 + 0.5);
			ctx.drawImage(canvas2, x, y3, 1, j3, x, o3 - 0.5, 1, y4 - o3 + 0.5);
		}

		if (index % fskip == 0) {
			buffer = canvas.toBuffer('image/png');
			fs.writeFileSync('./fx_frames/' + pad(catIndex, 5) + '_' + frame + '_' + findex + '.png', buffer);
			findex++;
		}

		index++;
	}
}

function spacetimeGif(catIndex, frames) {
	var gif = Gm();

	if (frames.length == 1) {
		for (var i = 0; i < 17; i++) {
			gif.in('./fx_frames/' + pad(catIndex, 5) + '_' + frames[0] + '_' + i + '.png');
		}
	} else {
		for (var i = 0; i < 50; i++) {
			if ((i >= 0 && i <= 4) || (i >= 10 && i <= 14))
				gif.in('./fx_frames/' + pad(catIndex, 5) + '_' + frames[1] + '_' + i + '.png');
			else if ((i >= 24 && i <= 29) || (i >= 34 && i <= 39))
				gif.in('./fx_frames/' + pad(catIndex, 5) + '_' + frames[2] + '_' + i + '.png');
			else
				gif.in('./fx_frames/' + pad(catIndex, 5) + '_' + frames[0] + '_' + i + '.png');
		}
	}

	gif.dispose('Background')
		.delay(10)
		.write('./fx_gifs/' + pad(catIndex, 5) + '.gif', function(err) {
			if (err) throw err;
		});
}

function hasValue(attribute, value) {
	return attribute.trait_type === value;
}

function binaryString(n) {
	var r = [];
	for (var i = parseInt("1".repeat(n), 2); i > 0; i--) {
		r.push(i.toString(2).padStart(n, '0'));
	}
	return r;
}

(async () => {
	var instream = fs.createReadStream('./mooncats.csv');
	var rl = readline.createInterface({ input: instream });

	rl.on('line', line => {
		lines.push(line);
	});

	await once(rl, "close");
	instream.destroy();

	console.log('Found ' + lines.length + ' MoonCats.');

	let index = randoSequence(0, lines.length - 1);
	endowed = randoSequence(100, lines.length - 1);

	archetypes = binaryString(5);

	function check(e) {
		let s = e.split('');
		s.splice(0, 1);
		let zero = 0;
		s.forEach((c) => {
			zero = c === '0' ? zero + 1 : zero;
		});
		if (zero >= 4)
			return false;
		else
			return true;
	}

	archetypes = archetypes.filter(e => check(e));

	let archetypePoses = [], archetype1Poses = [];

	archetypePoses.push(['Standing', 'Pouncing']);
	archetypePoses.push(['Sleeping', 'Stalking']);
	for (let i = 0; i < archetypes.length; i++) {
		archetypeIds[i] = [];
		archetypeIds1[i] = [];

		if (i > 1) {
			let n = 0;
			if (i < 8) {
				n = i % 2 == 0 ? i : (i - 1) * 2;
				n = Math.floor(n * 0.618);
			} else if (i < 12) {
				n = i % 2 == 0 ? (i - 1) * 2 : i;
				n = Math.floor(n * 0.618);
			} else {
				n = i % 2 == 0 ? (i - 1) * 2 : i;
				n = Math.floor(n * 0.618);
			}

			let archetype = [];
			for (let j = 0; j < n; j++) {
				archetype.push('Standing');
				archetype.push('Sleeping');
				archetype.push('Pouncing');
				archetype.push('Stalking');
			}
			archetypePoses.push(archetype);
		}

		n = 0;
		if (i < 8)
			n = i % 2 == 0 ? i + 1 : i * 2;
		else
			n = i % 2 == 0 ? i * 2 : i + 1;

		let archetype1 = [];
		for (let j = 0; j < n * 3; j++) {
			archetype1.push('Standing');
			archetype1.push('Sleeping');
			archetype1.push('Pouncing');
			archetype1.push('Stalking');
		}
		archetype1Poses.push(archetype1);
	}

	let archetypeLine = [], archetype1Line = [], archetypeIdx = [], archetype1Idx = [];

	for (let i = 0; i < lines.length; i++) {
		let line = lines[index[i]];
		line = line.split(',');
		let catId = line[1];

		if (catId.slice(0, 2) == "0x") {
			catId = catId.slice(2);
		}
		let bytes = hexToBytes(catId);
		const twoHeaded = bytes[1] % 128 <= 3;

		if (twoHeaded)
			archetypeLine.push(line);
		else
			archetype1Line.push(line);
	}

	archetypeIdx = randoSequence(0, archetypeLine.length - 1);
	archetype1Idx = randoSequence(0, archetype1Line.length - 1);

	for (let i = 0; i < archetypeIdx.length; i++) {
		let line = archetypeLine[archetypeIdx[i]];
		let catId = line[1];

		if (catId.slice(0, 2) == "0x") {
			catId = catId.slice(2);
		}

		for (let j = 0; j < archetypeIds.length; j++) {
			if (archetypePoses[j].length > 0 && archetypePoses[j].indexOf(line[4]) > -1) {
				archetypeIds[j].push(catId);
				archetypePoses[j].splice(archetypePoses[j].indexOf(line[4]), 1);
				break;
			}
		}
	}

	for (let i = 0; i < archetype1Idx.length; i++) {
		let line = archetype1Line[archetype1Idx[i]];
		let catId = line[1];

		if (catId.slice(0, 2) == "0x") {
			catId = catId.slice(2);
		}

		for (let j = 0; j < archetypeIds1.length; j++) {
			if (archetype1Poses[j].length > 0 && archetype1Poses[j].indexOf(line[4]) > -1) {
				archetypeIds1[j].push(catId);
				archetype1Poses[j].splice(archetype1Poses[j].indexOf(line[4]), 1);
				break;
			}
		}
	}

	for (let i = 0; i < archetypes.length; i++) {
		let arch = archetypes[i].split('');
		let s = '';
		if (arch[4] == '1' && arch[1] != '1') {
			archetypes.splice(i, 1);
			i--;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		generateLaserCatImage(lines[index[i]], i.toString());
	}

	var tierCounts = new Map();
	for (let value of laserCatTypes.values()) {
		let count = tierCounts.get(value);
		if (typeof count == "undefined")
			count = 1;
		else {
			count++;
		}
		tierCounts.set(value, count);
	}

	console.log(tierCounts);

	let tiers = new Map([...tierCounts.entries()].sort(([k, v], [k2, v2]) => {
		if (v > v2) {
			return 1;
		}
		if (v < v2) {
			return -1;
		}
		return 0;
	}));

	let t = 0, lastValue = 0;
	for (let [key, value] of tiers) {
		console.log(value)
		if (value != lastValue) {
			t++;
			lastValue = value;
		}

		tiers.set(key, t);
	}

	console.log(tiers);

	for (let i = 0; i < allLaserCats.length; i++) {
		let n = tiers.get(laserCatTypes.get(i.toString()));
		allLaserCats[i].attributes.push({ 'trait_type': 'Tier', 'value': n });

		allLaserCats[i].attributes = allLaserCats[i].attributes.filter(o => Object.keys(o).length);

		fs.writeFileSync('./metadata/' + pad(i, 5), JSON.stringify(allLaserCats[i]));
	}

	var map = new Map();
	for (let a = 0; a < allLaserCats[0].attributes.length - 1; a++) {
		allLaserCats.forEach(function(obj) {
			let count = map.get(obj.attributes[a].value);
			if (typeof count == "undefined")
				count = 1;
			else {
				count++;
			}
			map.set(obj.attributes[a].value, count);
		});
	}

	for (let c = 0; c < allLaserCats.length; c++) {
		let special = [];
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Spacetime Distortion'))
			special.push('ZDistorted');
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Two Headed'))
			special.push('ZTwoHeaded');
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Space Background'))
			special.push('ZSpaceBg');
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Rainbow'))
			special.push('ZRainbow');
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Laser Show'))
			special.push('ZLaserShow');
		if (allLaserCats[c].attributes.find(({ value }) => value === 'Laser Eyes'))
			special.push('ZLaserEyes');

		special.push(allLaserCats[c].attributes[allLaserCats[c].attributes.length - 1].value);

		if (special.length > 0) {
			let combo = special.join(', ');
			let count = map.get(combo);

			if (typeof count == "undefined")
				count = 1;
			else {
				count++;
			}
			map.set(combo, count);
		}
	}

	var mapAsc = new Map([...map.entries()].sort());

	console.log(mapAsc);
})();
