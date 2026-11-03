const TARGET = /^[A-Za-z0-9-]{1,39}(\/[A-Za-z0-9._-]{1,100})?$/;

/** A GitHub user or owner/repo. Dot segments would walk up the API's URL, so they don't count. */
export function isValidTarget(target: string): boolean {
  if (!TARGET.test(target)) return false;
  const repo = target.split("/")[1];
  return repo !== "." && repo !== "..";
}
