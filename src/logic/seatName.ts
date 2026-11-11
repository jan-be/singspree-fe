/** A seat as a party lists it (GET /parties/:partyId) */
interface ListedSeat {
  username: string;
  connected?: boolean;
}

const key = (name: string) => name.trim().toLowerCase();

/** Whether someone is singing under `name` in the party right now */
export const onStage = (name: string, players: readonly ListedSeat[] = []): boolean =>
  players.some(p => p.connected && key(p.username) === key(name));

/**
 * The name a signed-in singer's device sits under while the account's own
 * name is taken in the party (their other device is singing under it, or it
 * is the host's on the big screen): the account name with a number, "Ann 2",
 * the first that nobody is singing under. The server seats one device per
 * name, and both seats are the account's.
 *
 * `refused`: a name the server just refused this device (PartyPage comes back
 * with it: the seat is kept for someone else's browser). The numbers up to it
 * are not tried again.
 */
export function ownSeatName(account: string, players: readonly ListedSeat[] = [], refused?: string | null): string {
  let n = Math.max(2, seatNumber(account, refused) + 1);
  while (onStage(`${account} ${n}`, players)) n++;
  return `${account} ${n}`;
}

/** Which of an account's seats `name` is: 1 for the account's own name, 2 for "Ann 2", 0 for anyone else's name */
export function seatNumber(account: string, name: string | null | undefined): number {
  if (!name) return 0;
  if (key(name) === key(account)) return 1;
  const numbered = /^(.*) (\d{1,4})$/.exec(name.trim());
  return numbered && key(numbered[1]) === key(account) && Number(numbered[2]) >= 2 ? Number(numbered[2]) : 0;
}
