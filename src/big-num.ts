import { FormatOptions, formatParts } from "./format";
import { POW10 } from "./powers";

export type BigNumValue = BigNum | number | string;

const PRECISION = 15;
const MAX_EXPONENT_GAP = 17;
const MAX_SAFE_INTEGER = 9007199254740991;
const MAX_DOUBLE = 1.7976931348623157e308;

function isFinite(value: number) {
	return value - value === 0;
}

function shortestDecimal(value: number): string {
	for (let digits = PRECISION; digits < 17; digits++) {
		const text = string.format(`%.${digits}g`, value);
		if (tonumber(text) === value) {
			return text;
		}
	}
	return string.format("%.17g", value);
}

export class BigNum {
	public static readonly ZERO = new BigNum(0, 0);
	public static readonly ONE = new BigNum(1, 0);

	private constructor(
		public readonly mantissa: number,
		public readonly exponent: number,
	) {}

	private static create(mantissa: number, exponent: number): BigNum {
		if (mantissa === 0) {
			return BigNum.ZERO;
		}

		let m = mantissa;
		let e = exponent;
		const magnitude = math.abs(m);
		if (magnitude >= 10 || magnitude < 1) {
			const shift = math.floor(math.log10(magnitude));
			if (shift > 0 && shift <= 22) {
				m /= POW10[shift];
				e += shift;
			} else if (shift < 0 && shift >= -22) {
				m *= POW10[-shift];
				e += shift;
			} else if (shift !== 0) {
				// past 1e22 dividing by a power of ten is inexact, so read the digits straight from the double
				const [digits, power] = string.match(shortestDecimal(m), "^(.-)e%+?(%-?%d+)$");
				m = tonumber(digits)!;
				e += tonumber(power)!;
			}

			// log10 can land a hair either side of an exact power of ten
			if (math.abs(m) >= 10) {
				m /= 10;
				e += 1;
			} else if (math.abs(m) < 1) {
				m *= 10;
				e -= 1;
			}
		}

		return new BigNum(m, e);
	}

	public static from(value: BigNumValue): BigNum {
		if (typeIs(value, "number")) {
			return BigNum.fromNumber(value);
		} else if (typeIs(value, "string")) {
			return BigNum.fromString(value);
		}
		return value;
	}

	public static fromNumber(value: number): BigNum {
		if (!isFinite(value)) {
			error(`BigNum can't hold ${value}`, 2);
		}
		return BigNum.create(value, 0);
	}

	public static fromParts(mantissa: number, exponent: number): BigNum {
		if (!isFinite(mantissa) || !isFinite(exponent) || exponent % 1 !== 0) {
			error(`invalid BigNum parts ${mantissa}e${exponent}`, 2);
		}
		return BigNum.create(mantissa, exponent);
	}

	public static fromString(text: string): BigNum {
		let [sign, whole, fraction, exponentText] = string.match(text, "^%s*([+-]?)(%d*)%.?(%d*)[eE]([+-]?%d+)%s*$");
		if (sign === undefined) {
			[sign, whole, fraction] = string.match(text, "^%s*([+-]?)(%d*)%.?(%d*)%s*$");
			exponentText = "0";
		}

		const digits = `${whole ?? ""}${fraction ?? ""}`;
		const explicitExponent = tonumber(exponentText);
		if (sign === undefined || digits === "" || explicitExponent === undefined) {
			error(`"${text}" is not a number`, 2);
		}
		if (math.abs(explicitExponent) > MAX_SAFE_INTEGER) {
			error(`"${text}" has an exponent too large to store`, 2);
		}

		const [first] = string.find(digits, "[1-9]");
		if (first === undefined) {
			return BigNum.ZERO;
		}

		// 17 significant digits is the most a double can tell apart; the rest only moves the exponent
		const significant = string.sub(digits, first, first + 16);
		const mantissa = tonumber(`${string.sub(significant, 1, 1)}.${string.sub(significant, 2)}`)!;
		const exponent = (whole as string).size() - first + explicitExponent;
		return BigNum.create(sign === "-" ? -mantissa : mantissa, exponent);
	}

	public add(other: BigNumValue): BigNum {
		const value = BigNum.from(other);
		if (value.mantissa === 0) {
			return this;
		} else if (this.mantissa === 0) {
			return value;
		}
		return value.exponent > this.exponent ? BigNum.sum(value, this) : BigNum.sum(this, value);
	}

	private static sum(high: BigNum, low: BigNum): BigNum {
		const gap = high.exponent - low.exponent;
		if (gap >= MAX_EXPONENT_GAP) {
			return high;
		}

		let sum = high.mantissa + low.mantissa / POW10[gap];
		if (math.sign(high.mantissa) !== math.sign(low.mantissa)) {
			// subtraction cancels leading digits, and anything that surfaces past the operands' 15th
			// significant digit is binary noise: 1.1e5 - 1e5 would otherwise be 1.0000000000000009e4
			sum = math.round(sum * 1e14) / 1e14;
		}
		return BigNum.create(sum, high.exponent);
	}

	public sub(other: BigNumValue): BigNum {
		return this.add(BigNum.from(other).neg());
	}

	public mul(other: BigNumValue): BigNum {
		const factor = BigNum.from(other);
		return BigNum.create(this.mantissa * factor.mantissa, this.exponent + factor.exponent);
	}

	public div(other: BigNumValue): BigNum {
		const divisor = BigNum.from(other);
		if (divisor.mantissa === 0) {
			error("division by zero", 2);
		}
		return BigNum.create(this.mantissa / divisor.mantissa, this.exponent - divisor.exponent);
	}

	public pow(power: number): BigNum {
		if (power === 0) {
			return BigNum.ONE;
		} else if (this.mantissa === 0) {
			if (power < 0) {
				error("can't raise zero to a negative power", 2);
			}
			return BigNum.ZERO;
		}

		let sign = 1;
		if (this.mantissa < 0) {
			if (power % 1 !== 0) {
				error("can't raise a negative number to a fractional power", 2);
			}
			sign = power % 2 === 0 ? 1 : -1;
		}

		const scaledExponent = this.exponent * power;
		const whole = math.floor(scaledExponent);
		const mantissa = math.abs(this.mantissa) ** power * 10 ** (scaledExponent - whole);
		if (isFinite(mantissa) && mantissa > 0) {
			return BigNum.create(sign * mantissa, whole);
		}

		// the mantissa alone overflowed a double (2^10000), so go through logs instead
		const logarithm = (math.log10(math.abs(this.mantissa)) + this.exponent) * power;
		const exponent = math.floor(logarithm);
		return BigNum.create(sign * 10 ** (logarithm - exponent), exponent);
	}

	public sqrt(): BigNum {
		if (this.mantissa < 0) {
			error("can't take the square root of a negative number", 2);
		}
		if (this.exponent % 2 === 0) {
			return BigNum.create(math.sqrt(this.mantissa), this.exponent / 2);
		}
		return BigNum.create(math.sqrt(this.mantissa * 10), (this.exponent - 1) / 2);
	}

	public log10(): number {
		if (this.mantissa < 0) {
			error("can't take the log of a negative number", 2);
		} else if (this.mantissa === 0) {
			return -math.huge;
		}
		return this.exponent + math.log10(this.mantissa);
	}

	public floor(): BigNum {
		return this.roundWith(math.floor);
	}

	public ceil(): BigNum {
		return this.roundWith(math.ceil);
	}

	public round(): BigNum {
		return this.roundWith(math.round);
	}

	private roundWith(round: (value: number) => number): BigNum {
		if (this.exponent >= PRECISION) {
			return this;
		} else if (this.exponent < -300) {
			// too small for toNumber to keep the sign, but only the sign matters here
			return BigNum.fromNumber(round(math.sign(this.mantissa) * 1e-300));
		}
		return BigNum.fromNumber(round(this.toNumber()));
	}

	public abs(): BigNum {
		return this.mantissa < 0 ? new BigNum(-this.mantissa, this.exponent) : this;
	}

	public neg(): BigNum {
		return this.mantissa === 0 ? this : new BigNum(-this.mantissa, this.exponent);
	}

	public sign(): number {
		return math.sign(this.mantissa);
	}

	public isZero(): boolean {
		return this.mantissa === 0;
	}

	public isNegative(): boolean {
		return this.mantissa < 0;
	}

	public compare(other: BigNumValue): -1 | 0 | 1 {
		const value = BigNum.from(other);
		if (this.mantissa === value.mantissa && this.exponent === value.exponent) {
			return 0;
		}

		const sign = math.sign(this.mantissa);
		const otherSign = math.sign(value.mantissa);
		if (sign !== otherSign) {
			return sign < otherSign ? -1 : 1;
		}

		const largerMagnitude =
			this.exponent !== value.exponent
				? this.exponent > value.exponent
				: math.abs(this.mantissa) > math.abs(value.mantissa);
		// between two negatives the larger magnitude is the smaller number
		const positive = sign > 0;
		return largerMagnitude === positive ? 1 : -1;
	}

	public equals(other: BigNumValue): boolean {
		return this.compare(other) === 0;
	}

	public lt(other: BigNumValue): boolean {
		return this.compare(other) < 0;
	}

	public lte(other: BigNumValue): boolean {
		return this.compare(other) <= 0;
	}

	public gt(other: BigNumValue): boolean {
		return this.compare(other) > 0;
	}

	public gte(other: BigNumValue): boolean {
		return this.compare(other) >= 0;
	}

	public max(other: BigNumValue): BigNum {
		const value = BigNum.from(other);
		return this.compare(value) >= 0 ? this : value;
	}

	public min(other: BigNumValue): BigNum {
		const value = BigNum.from(other);
		return this.compare(value) <= 0 ? this : value;
	}

	public clamp(lower: BigNumValue, upper: BigNumValue): BigNum {
		return this.max(lower).min(upper);
	}

	public toNumber(): number {
		if (this.exponent > 308) {
			return this.mantissa > 0 ? MAX_DOUBLE : -MAX_DOUBLE;
		} else if (this.exponent < -324) {
			return 0;
		}
		// printf + tonumber is a correctly rounded decimal conversion; mantissa * 10^exponent would turn
		// 1.15e2 into 114.99999999999999
		const value = tonumber(string.format("%.14fe%d", this.mantissa, this.exponent))!;
		return math.clamp(value, -MAX_DOUBLE, MAX_DOUBLE);
	}

	public serialize(): string {
		if (this.mantissa === 0) {
			return "0";
		}
		return `${shortestDecimal(this.mantissa)}e${string.format("%d", this.exponent)}`;
	}

	public format(options?: FormatOptions): string {
		return formatParts(this.mantissa, this.exponent, options);
	}

	public toString(): string {
		return this.serialize();
	}
}
