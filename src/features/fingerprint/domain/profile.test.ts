import { median, summarizeTimestamps, topLanguages } from "./profile";

describe("summarizeTimestamps", () => {
  it("counts activity per UTC hour and weekday", () => {
    const { hours, weekdays, sampled } = summarizeTimestamps([
      "2026-11-02T14:05:00Z", // Monday
      "2026-11-02T14:50:00Z",
      "2026-11-01T23:59:00Z", // Sunday
    ]);

    expect(hours).toHaveLength(24);
    expect(weekdays).toHaveLength(7);
    expect(hours[14]).toBe(2);
    expect(hours[23]).toBe(1);
    expect(weekdays[1]).toBe(2);
    expect(weekdays[0]).toBe(1);
    expect(sampled).toBe(3);
  });

  it("uses UTC even for dates with an offset", () => {
    const { hours } = summarizeTimestamps(["2026-11-02T23:30:00-03:00"]);

    expect(hours[2]).toBe(1);
  });

  it("skips invalid dates", () => {
    const { sampled, hours } = summarizeTimestamps([
      "nope",
      "",
      "2026-11-02T10:00:00Z",
    ]);

    expect(sampled).toBe(1);
    expect(hours.reduce((sum, n) => sum + n, 0)).toBe(1);
  });

  it("gives zeros for no activity", () => {
    const { hours, weekdays, sampled } = summarizeTimestamps([]);

    expect(sampled).toBe(0);
    expect(hours.every((n) => n === 0)).toBe(true);
    expect(weekdays.every((n) => n === 0)).toBe(true);
  });
});

describe("topLanguages", () => {
  it("keeps the top five and groups the rest as Other", () => {
    const shares = topLanguages({
      A: 40,
      B: 20,
      C: 15,
      D: 10,
      E: 5,
      F: 6,
      G: 4,
    });

    expect(shares.map((l) => l.name)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "F",
      "Other",
    ]);
    expect(shares.at(-1)!.share).toBeCloseTo(0.09);
    expect(shares.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1, 9);
  });

  it("adds no Other for five languages or fewer", () => {
    expect(topLanguages({ A: 3, B: 1 }).map((l) => [l.name, l.share])).toEqual([
      ["A", 0.75],
      ["B", 0.25],
    ]);
  });

  it("gives nothing when there is nothing to weigh", () => {
    expect(topLanguages({})).toEqual([]);
    expect(topLanguages({ A: 0 })).toEqual([]);
  });
});

describe("median", () => {
  it.each([
    [[3, 1, 2], 2],
    [[1, 2, 3, 4], 2.5],
    [[], 0],
  ])("of %j is %d", (values, expected) => {
    expect(median(values)).toBe(expected);
  });
});
