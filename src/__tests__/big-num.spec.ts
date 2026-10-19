/// <reference types="@rbxts/testez/globals" />

import { BigNum } from "..";
import { seededRandom } from "./random";

const MAX_DOUBLE = 1.7976931348623157e308;

export = () => {
	function expectClose(actual: number, expected: number, tolerance: number) {
		expect(actual).to.be.near(expected, tolerance);
	}

	function expectParts(value: BigNum, mantissa: number, exponent: number) {
		expect(value.mantissa).to.be.near(mantissa, 1e-12);
		expect(value.exponent).to.equal(exponent);
	}

	function expectNormalised(value: BigNum) {
		if (value.mantissa === 0) {
			expect(value.exponent).to.equal(0);
			return;
		}
		const magnitude = math.abs(value.mantissa);
		expect(magnitude >= 1 && magnitude < 10).to.equal(true);
		expect(value.exponent % 1).to.equal(0);
	}

	describe("construction", () => {
		it("normalises numbers into a mantissa from 1 to 10", () => {
			expectParts(BigNum.fromNumber(12345), 1.2345, 4);
			expectParts(BigNum.fromNumber(0.00012), 1.2, -4);
			expectParts(BigNum.fromNumber(-987), -9.87, 2);
			expectParts(BigNum.fromNumber(1000), 1, 3);
			expectParts(BigNum.fromNumber(0), 0, 0);
		});

		it("keeps exact decimal mantissas for huge and tiny doubles", () => {
			expect(BigNum.fromNumber(1.5e300).mantissa).to.equal(1.5);
			expect(BigNum.fromNumber(1.5e300).exponent).to.equal(300);
			expect(BigNum.fromNumber(2.5e-300).mantissa).to.equal(2.5);
			expect(BigNum.fromNumber(2.5e-300).exponent).to.equal(-300);
		});

		it("parses numeric strings", () => {
			expectParts(BigNum.fromString("1.5e500"), 1.5, 500);
			expectParts(BigNum.fromString("-2.25E-10"), -2.25, -10);
			expectParts(BigNum.fromString("123456"), 1.23456, 5);
			expectParts(BigNum.fromString("0.00015"), 1.5, -4);
			expectParts(BigNum.fromString("+7"), 7, 0);
			expectParts(BigNum.fromString("  42 "), 4.2, 1);
			expectParts(BigNum.fromString("1e+3"), 1, 3);
			expectParts(BigNum.fromString("000123.4500"), 1.2345, 2);
			expectParts(BigNum.fromString(".5"), 5, -1);
			expect(BigNum.fromString("-0.000").isZero()).to.equal(true);
		});

		it("parses digit strings longer than a double can hold", () => {
			const value = BigNum.fromString(`1${string.rep("0", 400)}`);
			expectParts(value, 1, 400);
			expectParts(BigNum.fromString(`0.${string.rep("0", 399)}25`), 2.5, -400);
		});

		it("rejects malformed strings", () => {
			for (const text of ["", "abc", "1e", "e5", "1.2.3", ".", "--1", "1e5.5", "1+5", "0x10"]) {
				expect(() => BigNum.fromString(text)).to.throw("is not a number");
			}
			expect(() => BigNum.fromString("1e99999999999999999999")).to.throw("exponent too large");
		});

		it("rejects values a BigNum can't hold", () => {
			expect(() => BigNum.fromNumber(0 / 0)).to.throw("can't hold");
			expect(() => BigNum.fromNumber(math.huge)).to.throw("can't hold");
			expect(() => BigNum.fromParts(1, 0.5)).to.throw("invalid BigNum parts");
		});

		it("normalises raw parts", () => {
			expectParts(BigNum.fromParts(250, 10), 2.5, 12);
			expectParts(BigNum.fromParts(-0.03, 7), -3, 5);
			expectParts(BigNum.from("2e5"), 2, 5);
		});
	});

	describe("arithmetic", () => {
		it("agrees with plain numbers in the safe range", () => {
			const random = seededRandom(7);
			for (let index = 0; index < 400; index++) {
				const a = (random() - 0.5) * 10 ** math.floor(random() * 18 - 6);
				const b = (random() - 0.5) * 10 ** math.floor(random() * 18 - 6);
				const x = BigNum.fromNumber(a);
				const scale = math.max(math.abs(a), math.abs(b));

				expectClose(x.add(b).toNumber(), a + b, scale * 1e-12);
				expectClose(x.sub(b).toNumber(), a - b, scale * 1e-12);
				expectClose(x.mul(b).toNumber(), a * b, math.abs(a * b) * 1e-12);
				expectClose(x.div(b).toNumber(), a / b, math.abs(a / b) * 1e-12);
			}
		});

		it("keeps every result normalised", () => {
			const random = seededRandom(11);
			for (let index = 0; index < 300; index++) {
				const a = BigNum.fromParts((random() - 0.5) * 20, math.floor((random() - 0.5) * 10000));
				const b = BigNum.fromParts((random() - 0.5) * 20, math.floor((random() - 0.5) * 10000));
				expectNormalised(a.add(b));
				expectNormalised(a.sub(b));
				expectNormalised(a.mul(b));
				expectNormalised(a.div(b));
				expectNormalised(a.abs().pow(random() * 6 - 3));
				expectNormalised(a.abs().sqrt());
				expectNormalised(a.floor());
				expectNormalised(a.sub(a));
			}
		});

		it("drops addends too small to change the larger value", () => {
			const big = BigNum.fromString("1e300");
			expect(big.add(1).equals(big)).to.equal(true);
			expect(big.add("1e283").equals(big)).to.equal(true);
			expect(big.add("1e285").equals(big)).to.equal(false);
			expect(BigNum.fromNumber(1).add(big).equals(big)).to.equal(true);
		});

		it("works far past the double range", () => {
			const value = BigNum.fromString("1e500");
			expect(value.mul("1e500").equals("1e1000")).to.equal(true);
			expect(value.mul("1e500").div("1e500").equals(value)).to.equal(true);
			expect(BigNum.fromString("5e1000").add("5e1000").equals("1e1001")).to.equal(true);
			expect(BigNum.fromString("1e-500").mul("1e-500").equals("1e-1000")).to.equal(true);
		});

		it("subtracts without leaving binary noise behind", () => {
			const difference = BigNum.fromNumber(1.1e5).sub(1e5);
			expect(difference.mantissa).to.equal(1);
			expect(difference.exponent).to.equal(4);
			expect(BigNum.fromNumber(0.3).sub(0.1).equals(0.2)).to.equal(true);
		});

		it("subtracts down to zero and below", () => {
			const value = BigNum.fromString("4.2e700");
			expect(value.sub(value).isZero()).to.equal(true);
			expect(value.sub(value).exponent).to.equal(0);
			expectParts(BigNum.fromNumber(5).sub(8), -3, 0);
			expectParts(BigNum.fromString("-2e400").add("1e400"), -1, 400);
			expect(BigNum.fromNumber(-3).sub(-3).isZero()).to.equal(true);
		});

		it("refuses to divide by zero", () => {
			expect(() => BigNum.fromNumber(1).div(0)).to.throw("division by zero");
		});

		it("raises to powers", () => {
			expect(BigNum.fromNumber(2).pow(10).equals(1024)).to.equal(true);
			expectClose(BigNum.fromNumber(2).pow(1000).mantissa, 1.071508607186267, 1e-12);
			expect(BigNum.fromNumber(2).pow(1000).exponent).to.equal(301);
			expectClose(BigNum.fromNumber(2).pow(10000).mantissa, 1.995063116880758, 1e-9);
			expect(BigNum.fromNumber(2).pow(10000).exponent).to.equal(3010);
			expect(BigNum.fromString("1e300").pow(5).equals("1e1500")).to.equal(true);
			expect(BigNum.fromString("1e10").pow(0.5).equals("1e5")).to.equal(true);
			expect(BigNum.fromString("1e-5").pow(-2).equals("1e10")).to.equal(true);
			expect(BigNum.fromNumber(-2).pow(3).equals(-8)).to.equal(true);
			expect(BigNum.fromNumber(-2).pow(2).equals(4)).to.equal(true);
			expect(BigNum.fromNumber(123).pow(0).equals(1)).to.equal(true);
			expect(BigNum.ZERO.pow(3).isZero()).to.equal(true);
		});

		it("rejects powers without a real result", () => {
			expect(() => BigNum.fromNumber(-8).pow(1 / 3)).to.throw("fractional power");
			expect(() => BigNum.ZERO.pow(-1)).to.throw("negative power");
		});

		it("takes square roots on either exponent parity", () => {
			expect(BigNum.fromString("4e1000").sqrt().equals("2e500")).to.equal(true);
			expectClose(BigNum.fromString("1e1001").sqrt().mantissa, 3.1622776601683795, 1e-12);
			expect(BigNum.fromString("1e1001").sqrt().exponent).to.equal(500);
			expectClose(BigNum.fromString("2e-7").sqrt().toNumber(), math.sqrt(2e-7), 1e-18);
			expect(BigNum.ZERO.sqrt().isZero()).to.equal(true);
			expect(() => BigNum.fromNumber(-1).sqrt()).to.throw("square root");
		});

		it("takes base 10 logs", () => {
			expect(BigNum.fromString("1e500").log10()).to.equal(500);
			expectClose(BigNum.fromString("2e-50").log10(), -50 + math.log10(2), 1e-12);
			expect(BigNum.ZERO.log10()).to.equal(-math.huge);
			expect(() => BigNum.fromNumber(-5).log10()).to.throw("negative");
		});

		it("rounds to whole numbers", () => {
			expect(BigNum.fromNumber(115).floor().toNumber()).to.equal(115);
			expect(BigNum.fromNumber(2.5).round().toNumber()).to.equal(3);
			expect(BigNum.fromNumber(-2.5).round().toNumber()).to.equal(-3);
			expect(BigNum.fromNumber(-0.5).floor().toNumber()).to.equal(-1);
			expect(BigNum.fromNumber(0.5).ceil().toNumber()).to.equal(1);
			expect(BigNum.fromNumber(1234.567).floor().toNumber()).to.equal(1234);
			expect(BigNum.fromString("1e-400").ceil().toNumber()).to.equal(1);
			expect(BigNum.fromString("-1e-400").floor().toNumber()).to.equal(-1);
			expect(BigNum.fromString("1e-400").floor().isZero()).to.equal(true);
			const huge = BigNum.fromString("1.5e500");
			expect(huge.floor()).to.equal(huge);
		});

		it("flips and drops signs", () => {
			expectParts(BigNum.fromNumber(-42).abs(), 4.2, 1);
			expectParts(BigNum.fromNumber(42).neg(), -4.2, 1);
			expect(BigNum.ZERO.neg().sign()).to.equal(0);
			expect(BigNum.fromNumber(-1).isNegative()).to.equal(true);
		});
	});

	describe("comparison", () => {
		it("orders values across signs and magnitudes", () => {
			const ordered = [
				"-1e9999",
				"-1e500",
				"-5",
				"-1e-10",
				"0",
				"1e-300",
				"0.5",
				"1",
				"999",
				"1e3",
				"1e308",
				"2e308",
				"1e9999",
			];
			const values = ordered.map((text) => BigNum.fromString(text));
			const random = seededRandom(3);
			for (let index = values.size() - 1; index > 0; index--) {
				const swap = math.floor(random() * (index + 1));
				const value = values[index];
				values[index] = values[swap];
				values[swap] = value;
			}
			values.sort((a, b) => a.lt(b));

			for (let index = 0; index < ordered.size(); index++) {
				expect(values[index].equals(ordered[index])).to.equal(true);
			}
		});

		it("compares against plain numbers and strings", () => {
			const value = BigNum.fromNumber(250);
			expect(value.equals(250)).to.equal(true);
			expect(value.gt(249.9)).to.equal(true);
			expect(value.gte("2.5e2")).to.equal(true);
			expect(value.lt(-1)).to.equal(false);
			expect(value.lte(250)).to.equal(true);
			expect(value.compare("1e400")).to.equal(-1);
		});

		it("picks the larger, smaller and clamped value", () => {
			const value = BigNum.fromString("5e50");
			expect(value.max("1e60").equals("1e60")).to.equal(true);
			expect(value.min("1e60")).to.equal(value);
			expect(value.clamp(0, "1e10").equals("1e10")).to.equal(true);
			expect(value.clamp("1e70", "1e80").equals("1e70")).to.equal(true);
			expect(value.clamp(0, "1e80")).to.equal(value);
		});
	});

	describe("conversion", () => {
		it("converts back to numbers exactly where a double allows", () => {
			expect(BigNum.fromNumber(115).toNumber()).to.equal(115);
			expect(BigNum.fromNumber(123456789012345).toNumber()).to.equal(123456789012345);
			expect(BigNum.fromNumber(0.1).add(0.2).toNumber()).to.equal(0.3);
			expect(BigNum.fromString("-2.5e-3").toNumber()).to.equal(-0.0025);
		});

		it("clamps to the double range", () => {
			expect(BigNum.fromString("1e500").toNumber()).to.equal(MAX_DOUBLE);
			expect(BigNum.fromString("-1e500").toNumber()).to.equal(-MAX_DOUBLE);
			expect(BigNum.fromString("1.7976931348623159e308").toNumber()).to.equal(MAX_DOUBLE);
			expect(BigNum.fromString("1e-500").toNumber()).to.equal(0);
		});

		it("serializes to a compact string", () => {
			expect(BigNum.fromNumber(1500).serialize()).to.equal("1.5e3");
			expect(BigNum.fromString("-2e-5").serialize()).to.equal("-2e-5");
			expect(BigNum.ZERO.serialize()).to.equal("0");
			expect(tostring(BigNum.fromString("7.25e1234"))).to.equal("7.25e1234");
		});

		it("round trips every bit through serialize", () => {
			const random = seededRandom(21);
			for (let index = 0; index < 300; index++) {
				const mantissa = (1 + (random() + random() / 2147483647) * 9) * (random() < 0.5 ? -1 : 1);
				const value = BigNum.fromParts(mantissa, math.floor((random() - 0.5) * 200000));
				const restored = BigNum.fromString(value.serialize());
				expect(restored.mantissa).to.equal(value.mantissa);
				expect(restored.exponent).to.equal(value.exponent);
			}
		});
	});
};
