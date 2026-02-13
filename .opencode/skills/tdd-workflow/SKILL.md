---
name: tdd-workflow
description: Detailed Red-Green-Refactor TDD protocol with edge cases, anti-patterns, and test runner detection
---

# TDD Workflow Reference

## Test Runner Detection

Identify the project's test runner by examining these files:

| File                        | Likely Runner                              | Command                          |
|-----------------------------|--------------------------------------------|----------------------------------|
| `package.json`              | Jest, Vitest, Mocha, Node test runner      | `npm test` or check scripts      |
| `pyproject.toml`            | pytest                                     | `pytest` or `python -m pytest`   |
| `setup.cfg` / `pytest.ini` | pytest                                     | `pytest`                         |
| `tox.ini`                   | tox (wrapping pytest/unittest)             | `tox`                            |
| `go.mod`                    | Go testing                                 | `go test ./...`                  |
| `Cargo.toml`               | Rust test                                  | `cargo test`                     |
| `Makefile`                  | Check for `test` target                    | `make test`                      |
| `build.gradle`             | JUnit via Gradle                           | `gradle test`                    |
| `pom.xml`                  | JUnit via Maven                            | `mvn test`                       |
| `Gemfile`                  | RSpec or Minitest                          | `bundle exec rspec` / `rake test`|
| `.csproj`                  | xUnit / NUnit / MSTest                     | `dotnet test`                    |
| `mix.exs`                  | ExUnit                                     | `mix test`                       |
| `deno.json`                | Deno test                                  | `deno test`                      |
| `bun.lockb` / `bunfig.toml`| Bun test                                   | `bun test`                       |

When the runner is ambiguous (e.g., `package.json` exists but has no test script),
check for config files like `jest.config.*`, `vitest.config.*`, `.mocharc.*`,
or test directories named `__tests__`, `test`, `tests`, `spec`.

## What Makes a Good Failing Test

A good test in the RED phase should:

- **Assert exactly one behavior.** If you need "and" to describe what the test
  checks, it is probably two tests.
- **Have a descriptive name.** The name should read like a specification:
  `test_empty_stack_raises_on_pop`, `should return 404 when user not found`.
- **Test the public interface.** Do not test private/internal methods directly.
  Test them through the public API.
- **Be deterministic.** No reliance on wall-clock time, network calls, or
  random values without seeding.
- **Fail for the right reason.** The failure message should indicate that the
  expected behavior is missing (e.g., `AttributeError: 'Stack' has no attribute 'pop'`
  or `expected 404 but got undefined`), not that the test itself has a syntax error.

### Triangulation

When the simplest passing implementation would be to hardcode a return value,
write a second test with different inputs to force the general solution. This is
called triangulation.

Example:
1. Test: `add(1, 2)` should return `3` -> Implement: `return 3` (hardcoded)
2. Test: `add(3, 4)` should return `7` -> Now forced to implement: `return a + b`

## Minimal Implementation Guidelines

In the GREEN phase:

- **Satisfy the test and nothing more.** If the test only checks that a function
  exists, just define the function with a stub.
- **Hardcode first if appropriate.** It is valid to return a hardcoded value if
  only one test case exists. Triangulation will force the generalization.
- **Avoid speculative generality.** Do not add parameters, configuration, or
  abstraction layers that no test requires.
- **Do not handle edge cases** that have no corresponding test. Those will come
  in later increments.
- **Prefer the obvious implementation** when it is clear and simple. Do not
  artificially constrain yourself to hardcoding when the real implementation
  is equally simple.

## Refactoring Catalog

Common refactorings to consider in the REFACTOR phase:

- **Extract function/method** -- break large functions into named pieces
- **Rename** -- improve clarity of variables, functions, classes, files
- **Remove duplication** -- DRY up repeated patterns in both test and production code
- **Simplify conditionals** -- replace nested if/else with guard clauses, early returns, or polymorphism
- **Introduce parameter object** -- group related parameters into a single object/struct
- **Extract constant** -- replace magic numbers/strings with named constants
- **Improve test structure** -- add setup/teardown helpers, extract test fixtures, use parameterized tests for similar cases
- **Reduce coupling** -- introduce interfaces/protocols to decouple components

Always run the full test suite after refactoring. If any test fails, revert
the refactoring -- do not "fix" tests to match refactored code.

## Edge Cases and How to Handle Them

### Test already passes in RED phase

The behavior is already implemented. This means either:
- The increment is too large and includes already-implemented behavior.
  Narrow the test to assert something that is genuinely new.
- A previous increment already covered this case. Skip this increment
  and move to the next one.

### Multiple tests fail in GREEN phase

You likely changed too much. Revert to the last committed state and take a
smaller implementation step. The goal is to change the minimum code to make
exactly one test go from red to green without breaking any existing tests.

### Refactoring feels risky

This is why we commit after the GREEN phase. If refactoring goes wrong,
you can always revert to the last green commit. Consider making multiple
small refactoring commits rather than one large one.

### External dependencies (APIs, databases, file system)

- Use test doubles (mocks, stubs, fakes, spies) to isolate the unit under test.
- Test the contract, not the implementation. Assert that your code calls the
  dependency with the right arguments and handles its responses correctly.
- Consider creating a thin wrapper/adapter around external dependencies so
  the wrapper can be easily mocked and the rest of your code depends on
  your own interface.
- Write a small number of integration tests separately to verify the real
  dependency works as expected.

### Existing untested code

When modifying existing code that has no tests:
1. First write **characterization tests** that capture the current behavior
   (even if that behavior might be wrong).
2. Get those tests passing (they test current reality).
3. Commit.
4. Now begin the TDD cycle for the desired change: write a test for the
   new/corrected behavior, see it fail, implement, etc.

### Flaky tests

If a test passes sometimes and fails other times:
- This is a test quality issue, not a TDD process issue.
- Fix the flakiness before proceeding. Common causes: timing dependencies,
  shared mutable state, test ordering dependencies, uncontrolled randomness.
- Do not ignore flaky tests or retry them -- they indicate a real problem.

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Is Harmful | What to Do Instead |
|---|---|---|
| Writing implementation first, then tests | Tests become after-the-fact verification, miss edge cases, and don't drive design | Always write the test first |
| Writing multiple tests before any implementation | Loses the tight feedback loop; you don't know if each test is testing what you think | Write one test, make it pass, repeat |
| Gold-plating the implementation | Adds untested behavior, increases complexity | Write only what the current test demands |
| Skipping the REFACTOR phase | Technical debt accumulates; code becomes harder to change | Always evaluate, even if you decide no changes are needed |
| Modifying tests to match broken implementation | Hides bugs, breaks the safety net | Fix the implementation, not the test |
| Testing private/internal methods | Creates brittle tests coupled to implementation details | Test through the public API |
| Large increments | Makes failures hard to diagnose, increases risk | Break into the smallest possible steps |
| Not running the full suite | Can miss regressions in other parts of the code | Always run all tests, not just the new one |
| Skipping commits after GREEN | Loses safe revert points | Commit every passing state |

## Commit Message Conventions

Follow Conventional Commits format:

- `test: add test for <behavior>` -- when committing only test code
- `feat: implement <behavior>` -- when committing test + implementation
- `fix: correct <bug description>` -- when fixing a bug with TDD
- `refactor: <what was improved>` -- when committing refactoring changes

Each commit after the GREEN phase should represent a complete, passing state
of the code. The commit message should describe the behavior that was added,
not the implementation detail.
