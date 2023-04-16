
function gcd(a, b) {
	while (b !== 0) {
		[a, b] = [b, a % b];
	}
	return a;
}

function lcm(a, b) {
	return (a * b) / gcd(a, b);
}

/**
 * N.B. Components of the result are in the range 0-1.
 */
function hslaToRGBA(h, s, l, alpha) {
	const a = s * Math.min(l, 1 - l);

	function f(n) {
		const k = (n + h / 30) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	}

	return [f(0), f(8), f(4), alpha];
}

/**
 * @param {number} h Hue between 0 and 89.
 * @param {number} s Saturation between 0 and 15.
 * @param {number} l Lightness between 0 and 30.
 * @param {number} a Alpha, 0 or 1
 */
function thirteenBitHSLA(h, s, l, a = 1) {
	let [r, g, b] = hslaToRGBA(h * 4, s / 15, l / 30, 1);
	r = Math.round(r * 15);
	g = Math.round(g * 15)
	b = Math.round(b * 15);
	return [r, g, b, a];
}

const TRANSPARENT = Object.freeze([0, 0, 0, 0]);

function to32BitColor(color) {
	const r = color[0] * 17;	// 255/15 = 17
	const g = color[1] * 17;
	const b = color[2] * 17;
	const a = color[3] * 255;
	return [r, g, b, a];
}

function meanColor(color1, color2) {
	let r, g, b;
	let a = 255;
	if (color1[3] === 0) {
		[r, g, b] = color2;
		a = 128;
	} else if (color2[3] === 0) {
		[r, g, b] = color1;
		a = 128;
	} else {
		r = Math.trunc(0.5 * (color1[0] + color2[0]));
		g = Math.ceil(0.5 * (color1[1] + color2[1]));
		b = Math.trunc(0.5 * (color1[2] + color2[2]));
	}
	return [r, g, b, a];
}

function colorString(color) {
	const alpha = color[3] / 255;
	return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

class PatternTemplate {

	/**
	 * @param {string[]} pattern;
	 */
	constructor(pattern) {
		this.pattern = pattern;
	}

	get width() {
		return this.pattern[0].length;
	}

	get height() {
		return this.pattern.length;
	}

	/**
	 * @param {number[]} color
	 */
	async createPattern(context, horizontalOffset, verticalOffset, thirteenBitColors) {
		const numColors = thirteenBitColors.length;
		const colors = new Array(numColors);
		for (let i = 0; i < numColors; i++) {
			colors[i] = to32BitColor(thirteenBitColors[i]);
		}
		const width = this.width;
		const height = this.height;
		const imageData = context.createImageData(width, height);
		const pixels = imageData.data;
		let offset = 0;
		for (let j = 0; j < height; j++) {
			const row = this.pattern[(j + verticalOffset) % height];
			for (let i = 0; i < width; i++) {
				const value = row[(i + horizontalOffset) % width];
				pixels.set(colors[value], offset);
				offset += 4;
			}
		}
		const bitmap = await createImageBitmap(imageData);
		return context.createPattern(bitmap, 'repeat');
	}

	invert() {
		const oldRows = this.pattern;
		const numRows = oldRows.length;
		const numColumns = oldRows[0].length;
		const newRows = new Array(numRows);
		for (let j = 0; j < numRows; j++) {
			const oldRow = oldRows[j];
			const newRow = oldRow.slice();
			newRows[j] = newRow;
			for (let i = 0; i < numColumns; i++) {
				const value = oldRow[i];
				switch (value) {
				case 0:
					newRow[i] = 1;
					break;
				case 1:
					newRow[i] = 0;
					break;
				}
			}
		}
		this.pattern = newRows;
		return this;
	}

	doubleX() {
		const oldRows = this.pattern;
		const numRows = oldRows.length;
		const numColumns = oldRows[0].length;
		const newRows = new Array(numRows);
		for (let j = 0; j < numRows; j++) {
			const oldRow = oldRows[j];
			const newRow = new Array(numColumns * 2);
			newRows[j] = newRow;
			for (let i = 0; i < numColumns; i++) {
				const value = oldRow[i];
				newRow[2 * i] = value;
				newRow[2 * i + 1] = value;
			}
		}
		this.pattern = newRows;
		return this;
	}

	doubleY() {
		const oldRows = this.pattern;
		const numRows = oldRows.length;
		const newRows = new Array(numRows * 2);
		for (let j = 0; j < numRows; j++) {
			const row = oldRows[j];
			newRows[2 * j] = row;
			newRows[2 * j + 1] = row.slice();
		}
		this.pattern = newRows;
		return this;
	}

	static offsetDots(
		modX1 = 2, modX2 = modX1, offset = Math.trunc(Math.min(modX1, modX2) / 2), adornment = 0,
		yGap1 = 0, yGap2 = yGap1
	) {
		const numRows = 2 + yGap1 + yGap2;
		const rows = new Array(numRows);
		const numColumns = lcm(modX1, modX2 * (adornment === 0 ? 1 : Math.abs(adornment)));

		const firstRow = new Array(numColumns);
		firstRow.fill(0, 1);
		const repeats1 = numColumns / modX1;
		for (let i = 0; i < repeats1; i++) {
			firstRow[i * modX1] = 1;
		}
		rows[0] = firstRow;

		const emptyRow = new Array(numColumns);
		emptyRow.fill(0);
		for (let j = 1; j <= yGap1; j++) {
			rows[j] = emptyRow.slice();
		}

		const secondRow = new Array(numColumns);
		secondRow.fill(0);
		const repeats2 = numColumns / modX2;
		for (let i = 0; i < repeats2; i++) {
			secondRow[(i * modX2 + offset) % numColumns] = 1;
		}
		if (adornment < 0) {
			const deletionPeriod = -adornment;
			for (let i = (deletionPeriod - 1) * modX2; i < numColumns; i += deletionPeriod * modX2) {
				secondRow[(i + offset) % numColumns] = 2;
			}
		} else if (adornment > 0) {
			const additionPeriod = adornment;
			const halfOffset = Math.trunc(0.5 * offset);
			for (let i = (additionPeriod - 1) * modX2; i < numColumns; i += additionPeriod * modX2) {
				secondRow[(i + halfOffset) % numColumns] = 2;
			}
		}
		rows[1 + yGap1] = secondRow;

		for (let j = 2 + yGap1; j < numRows; j++) {
			rows[j] = emptyRow.slice();
		}

		return new PatternTemplate(rows);
	}

	static horizontalStripes(height = 1, gap = 1) {
		const numRows = height + gap;
		const rows = new Array(numRows);
		const onRow = [1];
		const offRow = [0];
		for (let j = 0; j < height; j++) {
			rows[j] = onRow.slice();
		}
		for (let j = height; j < numRows; j++) {
			rows[j] = offRow.slice();
		}
		return new PatternTemplate(rows);
	}

	static grid(width = 1, height = width, xGap = 1, yGap = xGap) {
		const numRows = height + yGap;
		const rows = new Array(numRows);
		let row = new Array(width + xGap);
		row.fill(1, 0, width);
		row.fill(0, width);
		for (let j = 0; j < height; j++) {
			rows[j] = row.slice();
		}
		row.fill(0);
		for (let j = height; j < numRows; j++) {
			rows[j] = row.slice();
		}
		return new PatternTemplate(rows);
	}

}

const canvas = document.getElementById('pixel-canvas');
const context = canvas.getContext('2d');

let fgColor = thirteenBitHSLA(0, 15, 8);
let bgColor = thirteenBitHSLA(23, 15, 8);
let fgColorStr = colorString(to32BitColor(fgColor));
let bgColorStr = colorString(to32BitColor(bgColor));
let meanColorStr = colorString(meanColor(to32BitColor(fgColor), to32BitColor(bgColor)));

let template = PatternTemplate.offsetDots(3);
let pattern = await template.createPattern(context, 0, 0,[TRANSPARENT, fgColor, fgColor]);

function draw() {
	const totalWidth = canvas.width;
	const totalHeight = canvas.height;
	const leftWidth = Math.ceil(0.5 * totalWidth);
	const topHeight = Math.ceil(0.5 * totalHeight);
	const rightWidth = totalWidth - leftWidth;
	const bottomHeight = totalHeight - topHeight;
	context.fillStyle = bgColorStr;
	context.fillRect(0, 0, totalWidth, topHeight);
	context.fillStyle = pattern;
	context.fillRect(0, 0, leftWidth, topHeight);
	context.fillStyle = meanColorStr;
	context.fillRect(0, topHeight, leftWidth, bottomHeight);
	context.fillStyle = fgColorStr;
	context.fillRect(leftWidth, topHeight, rightWidth, bottomHeight);
}

draw();
