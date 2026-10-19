import { POW10 } from "./powers";

export type Notation = "suffix" | "scientific" | "engineering";

export interface FormatOptions {
	readonly notation?: Notation;
	readonly decimals?: number;
	readonly trailingZeros?: boolean;
}

const BASE_SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

// past decillion each name is built from the latin parts of its illion number, units then tens then
// hundreds: 11 is UDc, 20 is Vg, 101 is UCe. that runs out after 999 (1e3000), so from 1e3003 suffix
// notation falls back to scientific
const UNITS = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
const TENS = ["", "Dc", "Vg", "Tg", "Qd", "Qn", "Sg", "St", "Og", "Nn"];
const HUNDREDS = ["", "Ce", "Dn", "Tc", "Qe", "Qu", "Sc", "Si", "Oe", "Ne"];

const SUFFIXES = (() => {
	const suffixes = [...BASE_SUFFIXES];
	for (let illion = BASE_SUFFIXES.size() - 1; illion <= 999; illion++) {
		suffixes.push(UNITS[illion % 10] + TENS[math.floor(illion / 10) % 10] + HUNDREDS[math.floor(illion / 100)]);
	}
	return suffixes;
})();

const MAX_DECIMALS = 10;

/** `group` is the power of a thousand: 1 is K, 2 is M. */
export function getSuffix(group: number): string | undefined {
	return SUFFIXES[group];
}

// the value is digits * 10^power; this rounds it half up to a whole number of 10^-places units
function roundToUnits(digits: number, power: number): number {
	if (power < -15) {
		return 0;
	}
	return math.floor(digits / POW10[-power] + 0.5);
}

function render(units: number, decimals: number, trailingZeros: boolean): string {
	const scale = POW10[decimals];
	const whole = math.floor(units / scale);
	let text = string.format("%d", whole);
	if (decimals > 0) {
		let fraction = string.format(`%0${decimals}d`, units - whole * scale);
		if (!trailingZeros) {
			const [trimmed] = string.match(fraction, "^(.-)0*$");
			fraction = trimmed as string;
		}
		if (fraction !== "") {
			text += `.${fraction}`;
		}
	}
	return text;
}

export function formatParts(mantissa: number, exponent: number, options?: FormatOptions): string {
	const notation = options?.notation ?? "suffix";
	const decimals = options?.decimals ?? 2;
	const trailingZeros = options?.trailingZeros ?? false;

	if (decimals < 0 || decimals > MAX_DECIMALS || decimals % 1 !== 0) {
		error(`decimals must be a whole number from 0 to ${MAX_DECIMALS}, got ${decimals}`, 3);
	}
	if (mantissa === 0) {
		return render(0, decimals, trailingZeros);
	}

	// 15 significant digits as an integer, which a double holds exactly. rounding on these instead of
	// on the binary mantissa is what makes 999.95K round up to 1M rather than down to 999.9K
	let digits = math.round(math.abs(mantissa) * 1e14);
	let power = exponent - 14;
	if (digits >= 1e15) {
		digits = 1e14;
		power += 1;
	}
	const leading = power + 14;
	const sign = mantissa < 0 ? "-" : "";

	if (notation === "scientific") {
		let shown = leading;
		let units = roundToUnits(digits, power - shown + decimals);
		if (units >= 10 * POW10[decimals]) {
			shown += 1;
			units = roundToUnits(digits, power - shown + decimals);
		}
		return `${sign}${render(units, decimals, trailingZeros)}e${string.format("%d", shown)}`;
	}

	let group = notation === "engineering" || leading >= 3 ? math.floor(leading / 3) : 0;
	let units = roundToUnits(digits, power - 3 * group + decimals);
	if (units >= 1000 * POW10[decimals]) {
		group += 1;
		units = roundToUnits(digits, power - 3 * group + decimals);
	}
	const prefix = units === 0 ? "" : sign;

	if (notation === "engineering") {
		return `${prefix}${render(units, decimals, trailingZeros)}e${string.format("%d", 3 * group)}`;
	}

	const suffix = SUFFIXES[group];
	if (suffix === undefined) {
		return formatParts(mantissa, exponent, { notation: "scientific", decimals, trailingZeros });
	}
	return `${prefix}${render(units, decimals, trailingZeros)}${suffix}`;
}
