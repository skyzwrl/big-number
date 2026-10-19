import { DataStoreService, Players } from "@rbxts/services";
import { BigNum, fromLeaderboardKey, toLeaderboardKey } from "@skyzwrl/big-number";

const balances = DataStoreService.GetDataStore("Cash");
const richest = DataStoreService.GetOrderedDataStore("Richest");
const cash = new Map<Player, BigNum>();

Players.PlayerAdded.Connect((player) => {
	const [ok, saved] = pcall(() => balances.GetAsync<string>(tostring(player.UserId))[0]);
	if (!ok) {
		player.Kick("couldn't load your data, rejoin in a bit");
		return;
	}
	cash.set(player, saved !== undefined ? BigNum.fromString(saved) : BigNum.ZERO);
});

Players.PlayerRemoving.Connect((player) => {
	const balance = cash.get(player);
	cash.delete(player);
	if (balance === undefined) {
		return;
	}
	// the full value goes in the regular store; the ordered store only needs something that sorts right
	pcall(() => balances.SetAsync(tostring(player.UserId), balance.serialize()));
	pcall(() => richest.SetAsync(tostring(player.UserId), toLeaderboardKey(balance)));
});

export function earn(player: Player, amount: BigNum) {
	const balance = cash.get(player);
	if (balance !== undefined) {
		cash.set(player, balance.add(amount));
	}
}

export function topBalances(count: number) {
	const page = richest.GetSortedAsync(false, count).GetCurrentPage();
	return page.map((entry) => `${entry.key}: ${fromLeaderboardKey(entry.value as number).format()}`);
}
