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

function twelveBitColor(h, s, l) {
	let [r, g, b] = hslaToRGBA(h / 90, s / 15, l / 30, 1);
	r = Math.round(Math.round(r * 15) * 255 / 15);
	g = Math.round(Math.round(g * 15) * 255 / 15);
	b = Math.round(Math.round(b * 15) * 255 / 15);
	return [r, g, b, 255];
}

class DitherPattern {

	/**
	 * @param {string} pattern
	 */
	static fromString(pattern, separator = '|') {
		return new DitherPattern(pattern.split(separator));
	}

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
	async createPattern(context, color, scaleX, scaleY = scaleX) {
		const width = this.width;
		const height = this.height;
		const imageData = context.createImageData(width * scaleX, height * scaleY);
		const rowLength = 4 * width * scaleX;
		const pixels = imageData.data;
		let offset = 0;
		let copyOffset;
		for (let j = 0; j < height; j++) {
			const row = this.pattern[j];
			const rowOffset = offset;
			for (let i = 0; i < width; i++) {
				if (row[i] === '1') {
					pixels.set(color, offset);
					copyOffset = offset + 4;
					for (let k = 1; k < scaleX; k++) {
						pixels.copyWithin(copyOffset, offset, offset + 4);
						copyOffset += 4;
					}
				}
				offset += 4 * scaleX;
			}
			copyOffset = rowOffset + rowLength;
			for (let k = 1; k < scaleY; k++) {
				pixels.copyWithin(copyOffset, rowOffset, rowOffset + rowLength);
				copyOffset += rowLength;
			}
			offset = copyOffset;
		}
		const bitmap = await createImageBitmap(imageData);
		return context.createPattern(bitmap, 'repeat');
	}

	static checkerboard(modX = 2, modY = 1) {

	}
}

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

let dither = DitherPattern.fromString('10|01');
let pattern = await dither.createPattern(context, [0, 0, 0, 255], 4);

function draw() {
	context.fillStyle = pattern;
	context.fillRect(0, 0, canvas.width, canvas.height);
}

draw();
