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

  it("should have a publish job that runs only on version tag pushes", () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs.publish).toBeDefined();

    const publishJob = workflow.jobs.publish;
    expect(publishJob["if"]).toMatch(/startsWith.*refs\/tags\/v/);
  });

  it("should have the publish job depend on test and build jobs", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;

    expect(publishJob.needs).toBeDefined();
    const needs = Array.isArray(publishJob.needs)
      ? publishJob.needs
      : [publishJob.needs];
    expect(needs).toContain("test");
    expect(needs).toContain("build");
  });

  it("should configure the publish job to publish to the npm registry", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;

    const runs = publishJob.steps
      .filter((s: any) => s.run)
      .map((s: any) => s.run);
    expect(runs.some((r: string) => r.includes("npm publish"))).toBe(true);
  });

  it("should configure the publish job with the npm registry URL", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;

    const setupNodeStep = publishJob.steps.find(
      (s: any) => s.uses && s.uses.startsWith("actions/setup-node")
    );
    expect(setupNodeStep).toBeDefined();
    expect(setupNodeStep.with["registry-url"]).toBe(
      "https://registry.npmjs.org"
    );
  });

  it("should use npm trusted publishing (OIDC) with id-token: write permission", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;

    expect(publishJob.permissions).toBeDefined();
    expect(publishJob.permissions["id-token"]).toBe("write");
    expect(publishJob.permissions.contents).toBe("read");
  });

  it("should NOT use NODE_AUTH_TOKEN or secrets.NPM_TOKEN for authentication", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;
    const workflowYaml = readFileSync(WORKFLOW_PATH, "utf-8");

    // Check that no step in the publish job uses NODE_AUTH_TOKEN
    for (const step of publishJob.steps) {
      if (step.env) {
        expect(step.env).not.toHaveProperty("NODE_AUTH_TOKEN");
      }
    }

    // Also verify secrets.NPM_TOKEN is not referenced anywhere in the publish job
    // by checking the raw YAML for the publish section
    const publishSection = workflowYaml.slice(
      workflowYaml.indexOf("publish:")
    );
    expect(publishSection).not.toContain("secrets.NPM_TOKEN");
    expect(publishSection).not.toContain("NPM_TOKEN");
  });

  it("should use --provenance flag with npm publish for trusted publishing", () => {
    const workflow = loadWorkflow();
    const publishJob = workflow.jobs.publish;

    const publishStep = publishJob.steps.find(
      (s: any) => s.run && s.run.includes("npm publish")
    );
    expect(publishStep).toBeDefined();
    expect(publishStep.run).toContain("--provenance");
  });
});
