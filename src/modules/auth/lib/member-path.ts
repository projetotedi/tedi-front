/**
 * The path of the screen of a member, which the list of members (`AccessTable`) links to. The
 * route is declared by `people` (`members/:memberId` in its `routes.tsx`), and `auth` does not
 * import it: `people` already imports `@modules/auth`, so the other way round would be a cycle that
 * the depcruise reports. The two have to say the same path, and a test of `app/` proves it by
 * opening a member from a row of `/members`.
 */
export function memberDetailPath(memberId: string): string {
  return `/members/${encodeURIComponent(memberId)}`;
}
