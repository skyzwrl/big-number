import { BigNum, BigNumValue } from "./big-num";

// keys are exponent-major: the exponent picks a block of 2^33 keys and the mantissa a slot inside
// it, so ordering keys orders values. power-of-two blocks keep the decode division exact, and 2^20
// blocks of 2^33 stay under the 2^53 an OrderedDataStore integer can hold
const MANTISSA_SLOTS = 2 ** 33;
const MIN_EXPONENT = -1000;
const MAX_EXPONENT = MIN_EXPONENT + 2 ** 20 - 2;
const MAX_KEY = (MAX_EXPONENT - MIN_EXPONENT + 1) * MANTISSA_SLOTS;

export function toLeaderboardKey(value: BigNumValue): number {
	const amount = BigNum.from(value);
	if (amount.mantissa <= 0) {
		return 0;
	} else if (amount.exponent < MIN_EXPONENT) {
		return 1;
	} else if (amount.exponent > MAX_EXPONENT) {
		return MAX_KEY;
	}
	const slot = math.floor(((amount.mantissa - 1) / 9) * MANTISSA_SLOTS);
	return (amount.exponent - MIN_EXPONENT) * MANTISSA_SLOTS + slot + 1;
}

export function fromLeaderboardKey(key: number): BigNum {
	if (key <= 0) {
		return BigNum.ZERO;
	}
	const index = key - 1;
	const block = math.floor(index / MANTISSA_SLOTS);
	const slot = index - block * MANTISSA_SLOTS;
	return BigNum.fromParts(1 + (slot / MANTISSA_SLOTS) * 9, block + MIN_EXPONENT);
}
