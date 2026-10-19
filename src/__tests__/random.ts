// park-miller, so specs get the same numbers every run (Random isn't available under lune)
export function seededRandom(seed: number) {
	let state = seed;
	return () => {
		state = (state * 48271) % 2147483647;
		return state / 2147483647;
	};
}
