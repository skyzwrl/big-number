/// <reference types="@rbxts/testez/globals" />

import { BigNum, FormatOptions, getSuffix } from "..";

function format(value: number | string, options?: FormatOptions) {
	return BigNum.from(value).format(options);
}

export = () => {
	describe("suffix notation", () => {
		it("names each power of a thousand", () => {
			const expected: [string, string][] = [
				["0", "0"],
				["7", "7"],
				["999", "999"],
				["1000", "1K"],
				["1500", "1.5K"],
				["1234567", "1.23M"],
				["1e9", "1B"],
				["1e12", "1T"],
				["1e15", "1Qa"],
				["1e18", "1Qi"],
				["1e21", "1Sx"],
				["1e24", "1Sp"],
				["1e27", "1Oc"],
				["1e30", "1No"],
				["1e33", "1Dc"],
				["1e36", "1UDc"],
				["4.2e40", "42DDc"],
				["1e63", "1Vg"],
				["1e66", "1UVg"],
				["1e303", "1Ce"],
				["1e306", "1UCe"],
				["1e3000", "1NoNnNe"],
				["9.99e3002", "999NoNnNe"],
			];
			for (const [value, text] of expected) {
				expect(format(value)).to.equal(text);
			}
		});

		it("carries rounding into the next suffix", () => {
			expect(format(999950, { decimals: 1 })).to.equal("1M");
			expect(format(999949, { decimals: 1 })).to.equal("999.9K");
			expect(format(999999, { decimals: 2 })).to.equal("1M");
			expect(format(999.995)).to.equal("1K");
			expect(format(999.994)).to.equal("999.99");
			expect(format("9.9995e35", { decimals: 1 })).to.equal("1UDc");
		});

		it("rounds halves up on the decimal digits, not the binary ones", () => {
			expect(format(1.005)).to.equal("1.01");
			expect(format(2.675)).to.equal("2.68");
			expect(format(1234.5, { decimals: 0 })).to.equal("1K");
			expect(format(1500, { decimals: 0 })).to.equal("2K");
		});

		it("keeps trailing zeros when asked", () => {
			expect(format(1500, { trailingZeros: true })).to.equal("1.50K");
			expect(format(1000, { trailingZeros: true })).to.equal("1.00K");
			expect(format(0, { trailingZeros: true })).to.equal("0.00");
			expect(format(1500, { decimals: 0, trailingZeros: true })).to.equal("2K");
		});

		it("handles signs and values below one", () => {
			expect(format(-1500)).to.equal("-1.5K");
			expect(format(-0.001)).to.equal("0");
			expect(format(0.05)).to.equal("0.05");
			expect(format(0.004)).to.equal("0");
			expect(format("-1e-500")).to.equal("0");
		});

		it("falls back to scientific past the last suffix", () => {
			expect(format("1e3003")).to.equal("1e3003");
			expect(format("2.5e123456")).to.equal("2.5e123456");
		});

		it("never reuses a suffix", () => {
			const seen = new Set<string>();
			for (let group = 1; group <= 1000; group++) {
				const suffix = getSuffix(group);
				expect(suffix).to.be.ok();
				expect(seen.has(suffix!)).to.equal(false);
				seen.add(suffix!);
			}
			expect(getSuffix(1001)).never.to.be.ok();
		});
	});

	describe("scientific and engineering notation", () => {
		it("formats scientific notation", () => {
			const scientific: FormatOptions = { notation: "scientific" };
			expect(format("1.5e500", scientific)).to.equal("1.5e500");
			expect(format(123456, scientific)).to.equal("1.23e5");
			expect(format(0.00025, scientific)).to.equal("2.5e-4");
			expect(format(999600, scientific)).to.equal("1e6");
			expect(format(-42, scientific)).to.equal("-4.2e1");
			expect(format(0, scientific)).to.equal("0");
		});

		it("formats engineering notation with exponents in steps of three", () => {
			const engineering: FormatOptions = { notation: "engineering" };
			expect(format(123456, engineering)).to.equal("123.46e3");
			expect(format(0.5, engineering)).to.equal("500e-3");
			expect(format(999960, { notation: "engineering", decimals: 1 })).to.equal("1e6");
			expect(format("4.2e1000", engineering)).to.equal("42e999");
		});

		it("rejects decimal counts it can't render", () => {
			expect(() => format(1, { decimals: -1 })).to.throw("decimals");
			expect(() => format(1, { decimals: 1.5 })).to.throw("decimals");
			expect(() => format(1, { decimals: 11 })).to.throw("decimals");
		});
	});
};
