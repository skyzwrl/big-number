// powers of ten stay exact as doubles up to 1e22
export const POW10: ReadonlyArray<number> = (() => {
	const powers = [1];
	for (let power = 1; power <= 22; power++) {
		powers.push(powers[power - 1] * 10);
	}
	return powers;
})();
