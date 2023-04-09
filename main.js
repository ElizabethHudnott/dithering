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
function twelveBitHSLA(h, s, l, a = 1) {
	let [r, g, b] = hslaToRGBA(h * 4, s / 15, l / 30, 1);
	r = Math.round(r * 15);
	g = Math.round(g * 15)
	b = Math.round(b * 15);
	return [r, g, b, a];
}

function to32BitColor(color) {
	const r = Math.round(color[0] * 255 / 15);
	const g = Math.round(color[1] * 255 / 15);
	const b = Math.round(color[2] * 255 / 15);
	const a = color[3] * 255
	return [r, g, b, a];
}

function meanColor(color1, color2) {
	const r = Math.trunc(0.5 * (color1[0] + color2[0]));
	const g = Math.trunc(0.5 * (color1[1] + color2[1]));
	const b = Math.trunc(0.5 * (color1[2] + color2[2]));
	return `rgb(${r}, ${g}, ${b})`;
}

function colorString(color) {
	const alpha = color[3] / 255;
	return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

class DitherPattern {

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
	async createPattern(context, color) {
		color = to32BitColor(color);
		const width = this.width;
		const height = this.height;
		const imageData = context.createImageData(width, height);
		const pixels = imageData.data;
		let offset = 0;
		for (let j = 0; j < height; j++) {
			const row = this.pattern[j];
			for (let i = 0; i < width; i++) {
				if (row[i] === 1) {
					pixels.set(color, offset);
				}
				offset += 4;
			}
		}
		const bitmap = await createImageBitmap(imageData);
		return context.createPattern(bitmap, 'repeat');
	}

	static checkerboard(modX = 2, emptyRows = 0, right = false) {
		const numRows = 2 + 2 * emptyRows;
		const rows = new Array(numRows);

		const firstRow = new Array(modX);
		rows[0] = firstRow;
		firstRow[0] = 1;
		firstRow.fill(0, 1);

		const emptyRow = new Array(modX);
		emptyRow.fill(0);
		for (let i = 1; i <= emptyRows; i++) {
			rows[i] = emptyRow.slice();
		}

		const rounding = right ? Math.ceil : Math.trunc;
		const index = rounding(modX / 2);
		const secondRow = firstRow.slice(-index);
		rows[1 + emptyRows] = secondRow;
		for (let i = index; i < modX; i++) {
			secondRow[i] = firstRow[i - index];
		}

		for (let i = 2 + emptyRows; i < numRows; i++) {
			rows[i] = emptyRow.slice();
		}

		return new DitherPattern(rows);
	}

	static verticalStripes(width = 1, gap = 1) {
		const row = new Array(width + gap);
		row.fill(1, 0, width);
		row.fill(0, width);
		return new DitherPattern([row]);
	}
}

const canvas = document.getElementById('pixel-canvas');
const context = canvas.getContext('2d');

let fgColor = twelveBitHSLA(30, 5, 5);
let bgColor = twelveBitHSLA(30, 15, 5);
let fgColorStr = colorString(to32BitColor(fgColor));
let bgColorStr = colorString(to32BitColor(bgColor));
let meanColorStr = meanColor(to32BitColor(fgColor), to32BitColor(bgColor));

let dither = DitherPattern.verticalStripes();
let pattern = await dither.createPattern(context, fgColor);

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
