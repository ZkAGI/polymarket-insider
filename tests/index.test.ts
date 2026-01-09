import { describe, it, expect } from "vitest";
import { APP_NAME, VERSION, greet } from "../src/index";

describe("Index Module", () => {
  it("should export APP_NAME constant", () => {
    expect(APP_NAME).toBe("Polymarket Tracker");
  });

  it("should export VERSION constant", () => {
    expect(VERSION).toBe("1.0.0");
  });

  it("should greet user with app name", () => {
    const result = greet("Alice");
    expect(result).toBe("Welcome to Polymarket Tracker, Alice!");
  });

  it("should handle empty name in greeting", () => {
    const result = greet("");
    expect(result).toBe("Welcome to Polymarket Tracker, !");
  });
});

describe("Sample Tests", () => {
  it("should pass a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle arrays correctly", () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it("should handle objects correctly", () => {
    const obj = { name: "test", value: 42 };
    expect(obj).toHaveProperty("name");
    expect(obj.value).toBe(42);
  });
});
