/// <reference types="@rbxts/testez/globals" />

import { BigNum, fromLeaderboardKey, toLeaderboardKey } from "..";
import { seededRandom } from "./random";

const TWO_TO_53 = 2 ** 53;

export = () => {
	describe("leaderboard keys", () => {
		it("are positive whole numbers below 2^53", () => {
			for (const text of ["1e-1000", "1e-5", "1", "9.999999999e99", "1e308", "1e9999", "5e999797"]) {
				const key = toLeaderboardKey(text);
				expect(key > 0).to.equal(true);
				expect(key % 1).to.equal(0);
				expect(key < TWO_TO_53).to.equal(true);
			}
		});

		it("keep the order of the values they encode", () => {
			const random = seededRandom(5);
			let previousValue = BigNum.fromString("1e-1000");
			let previousKey = toLeaderboardKey(previousValue);

			for (let index = 0; index < 2000; index++) {
				const step = BigNum.fromParts(
					1 + random() * 9,
					math.floor(previousValue.exponent + random() * 600 - 100),
				);
				const value = previousValue.add(step);
				const key = toLeaderboardKey(value);

				if (value.div(previousValue).gt(1 + 1e-8)) {
					expect(key > previousKey).to.equal(true);
				} else {
					expect(key >= previousKey).to.equal(true);
				}
				previousValue = value;
				previousKey = key;
			}
			expect(previousValue.exponent > 100000).to.equal(true);
		});

		it("separates neighbours within the same power of ten", () => {
			let previous = toLeaderboardKey("1e50");
			for (let mantissa = 1.0001; mantissa < 10; mantissa += 0.0997) {
				const key = toLeaderboardKey(BigNum.fromParts(mantissa, 50));
				expect(key > previous).to.equal(true);
				previous = key;
			}
			expect(toLeaderboardKey("1e51") > previous).to.equal(true);
		});

		it("decode to within a billionth of the original", () => {
			const random = seededRandom(9);
			for (let index = 0; index < 500; index++) {
				const value = BigNum.fromParts(1 + random() * 9, math.floor(random() * 500000) - 1000);
				const decoded = fromLeaderboardKey(toLeaderboardKey(value));
				expect(decoded.exponent).to.equal(value.exponent);
				expect(decoded.mantissa).to.be.near(value.mantissa, 1e-8);
				expect(decoded.lte(value)).to.equal(true);
			}
		});

		it("give zero and negatives the bottom key", () => {
			expect(toLeaderboardKey(0)).to.equal(0);
			expect(toLeaderboardKey("-1e500")).to.equal(0);
			expect(fromLeaderboardKey(0).isZero()).to.equal(true);
		});

		it("clamp values outside the encodable range", () => {
			expect(toLeaderboardKey("1e-5000")).to.equal(toLeaderboardKey("1e-1000"));
			expect(toLeaderboardKey("1e9999999")).to.equal(toLeaderboardKey("9.9999999999e1047574"));
			expect(toLeaderboardKey("1e9999999") < TWO_TO_53).to.equal(true);
		});
	});
};
