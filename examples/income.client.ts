import { Players, RunService } from "@rbxts/services";
import { BigNum } from "@skyzwrl/big-number";

const label = Players.LocalPlayer.WaitForChild("PlayerGui").WaitForChild("Hud").WaitForChild("Cash") as TextLabel;

// mirrors the server's income so the counter ticks smoothly between authoritative updates
const perSecond = BigNum.fromString("3.2e45");
let shown = BigNum.ZERO;

RunService.Heartbeat.Connect((deltaTime) => {
	shown = shown.add(perSecond.mul(deltaTime));
	label.Text = `$${shown.format({ decimals: 2 })}`;
});

export function correct(serverValue: string) {
	shown = BigNum.fromString(serverValue);
}
