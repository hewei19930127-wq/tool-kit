import { describe, expect, it } from "vitest";
import { type Language, type TokenType, tokenize } from "./highlight";

function typesOf(code: string, language: Language, type: TokenType): string[] {
  return tokenize(code, language)
    .filter((token) => token.type === type)
    .map((token) => token.text);
}

function roundTrips(code: string, language: Language): boolean {
  return (
    tokenize(code, language)
      .map((token) => token.text)
      .join("") === code
  );
}

describe("tokenize json", () => {
  it("distinguishes object keys from string values", () => {
    const code = '{"name": "ada"}';
    expect(typesOf(code, "json", "key")).toEqual(['"name"']);
    expect(typesOf(code, "json", "string")).toEqual(['"ada"']);
  });

  it("classifies numbers, booleans, and null", () => {
    const code = '{"a": 12.5e3, "b": true, "c": null}';
    expect(typesOf(code, "json", "number")).toEqual(["12.5e3"]);
    expect(typesOf(code, "json", "boolean")).toEqual(["true"]);
    expect(typesOf(code, "json", "null")).toEqual(["null"]);
  });

  it("handles escaped quotes inside strings", () => {
    const code = '{"q": "she said \\"hi\\""}';
    expect(typesOf(code, "json", "string")).toEqual(['"she said \\"hi\\""']);
    expect(roundTrips(code, "json")).toBe(true);
  });

  it("reproduces input exactly, including whitespace and Unicode", () => {
    const code = '{\n  "emoji": "🎉",\n  "n": -0.0\n}\n';
    expect(roundTrips(code, "json")).toBe(true);
  });

  it("never throws on empty or malformed input", () => {
    expect(roundTrips("", "json")).toBe(true);
    expect(roundTrips('{"broken": ', "json")).toBe(true);
    expect(roundTrips('"unterminated', "json")).toBe(true);
  });
});

describe("tokenize xml", () => {
  it("classifies tag names, attributes, and attribute values", () => {
    const code = '<user id="1">ada</user>';
    expect(typesOf(code, "xml", "tag")).toEqual(["user", "user"]);
    expect(typesOf(code, "xml", "attr")).toEqual(["id"]);
    expect(typesOf(code, "xml", "string")).toEqual(['"1"']);
    expect(typesOf(code, "xml", "plain")).toContain("ada");
  });

  it("treats comments, declarations, and CDATA as their own tokens", () => {
    const code = '<?xml version="1.0"?><!-- hi --><root><![CDATA[<raw>]]></root>';
    expect(typesOf(code, "xml", "comment")).toEqual(["<!-- hi -->"]);
    expect(typesOf(code, "xml", "meta")).toEqual(['<?xml version="1.0"?>', "<![CDATA[<raw>]]>"]);
  });

  it("reproduces input exactly, including malformed tags", () => {
    expect(roundTrips("", "xml")).toBe(true);
    expect(roundTrips("<root><child/></root>", "xml")).toBe(true);
    expect(roundTrips("<broken attr=", "xml")).toBe(true);
    expect(roundTrips("<!-- unterminated", "xml")).toBe(true);
    expect(roundTrips("plain text & <a>x</a>", "xml")).toBe(true);
  });
});
