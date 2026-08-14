import { describe, expect, it } from "vitest";
import { roleAllows } from "./auth";

describe("studio role ranking", () => {
  it("allows editors and maintainers to edit while reserving maintenance", () => {
    expect(roleAllows("viewer", "editor")).toBe(false);
    expect(roleAllows("editor", "editor")).toBe(true);
    expect(roleAllows("maintainer", "editor")).toBe(true);
    expect(roleAllows("editor", "maintainer")).toBe(false);
    expect(roleAllows("maintainer", "maintainer")).toBe(true);
  });
});
