import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = join(import.meta.dirname, "..");
const WORKFLOW_PATH = join(ROOT, ".github", "workflows", "ci.yml");

function loadWorkflow(): any {
  const content = readFileSync(WORKFLOW_PATH, "utf-8");
  return parseYaml(content);
}

describe("CI workflow", () => {
  it("should exist at .github/workflows/ci.yml", () => {
    expect(() => readFileSync(WORKFLOW_PATH, "utf-8")).not.toThrow();
  });

  it("should trigger on push and pull_request events", () => {
    const workflow = loadWorkflow();
    expect(workflow.on).toBeDefined();
    expect(workflow.on.push).toBeDefined();
    expect(workflow.on.pull_request).toBeDefined();
  });

  it("should have a test job that runs npm test", () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs.test).toBeDefined();

    const testJob = workflow.jobs.test;
    expect(testJob["runs-on"]).toBe("ubuntu-latest");

    const stepNames = testJob.steps.map(
      (s: any) => s.run || s.uses || s.name
    );
    expect(stepNames.some((s: string) => s?.includes("npm test"))).toBe(true);
  });

  it("should have a build job that runs npm run build", () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs.build).toBeDefined();

    const buildJob = workflow.jobs.build;
    expect(buildJob["runs-on"]).toBe("ubuntu-latest");

    const stepNames = buildJob.steps.map(
      (s: any) => s.run || s.uses || s.name
    );
    expect(stepNames.some((s: string) => s?.includes("npm run build"))).toBe(
      true
    );
  });

  it("should use actions/checkout and actions/setup-node in the test job", () => {
    const workflow = loadWorkflow();
    const testJob = workflow.jobs.test;

    const uses = testJob.steps
      .filter((s: any) => s.uses)
      .map((s: any) => s.uses);
    expect(uses.some((u: string) => u.startsWith("actions/checkout"))).toBe(
      true
    );
    expect(uses.some((u: string) => u.startsWith("actions/setup-node"))).toBe(
      true
    );
  });

  it("should install dependencies in the test job", () => {
    const workflow = loadWorkflow();
    const testJob = workflow.jobs.test;

    const runs = testJob.steps.filter((s: any) => s.run).map((s: any) => s.run);
    expect(
      runs.some((r: string) => r.includes("npm ci") || r.includes("npm install"))
    ).toBe(true);
  });
});
