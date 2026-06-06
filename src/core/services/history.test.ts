import { describe, expect, it } from "vitest";
import { type HistoryEntry, pushHistory } from "./history";

const entry = (input: string, ts: number): HistoryEntry => ({
  input,
  output: input.toUpperCase(),
  ts,
});

describe("pushHistory", () => {
  it("prepends the newest entry", () => {
    const list = pushHistory([], entry("a", 1), 20);
    expect(list[0].input).toBe("a");
  });

  it("dedupes by input, keeping the newest position", () => {
    let list = pushHistory([], entry("a", 1), 20);
    list = pushHistory(list, entry("b", 2), 20);
    list = pushHistory(list, entry("a", 3), 20);
    expect(list.map((item) => item.input)).toEqual(["a", "b"]);
    expect(list[0].ts).toBe(3);
  });

  it("caps the list length", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 25; i += 1) {
      list = pushHistory(list, entry(`x${i}`, i), 20);
    }
    expect(list).toHaveLength(20);
    expect(list[0].input).toBe("x24");
  });
});
