import axe from "axe-core";

/**
 * Runs the axe accessibility engine over a rendered container and returns a
 * readable description of anything it finds.
 *
 * Automated checks catch only a subset of accessibility problems, but the
 * subset they do catch — missing names, unlabelled controls, broken heading
 * order, insufficient contrast — is exactly the kind that regresses silently
 * as pages change.
 */
export async function findAccessibilityViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    // Colour contrast cannot be evaluated in jsdom, which does not lay out or
    // paint. It is excluded here rather than silently passing.
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map((violation) => {
    const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
    return `${violation.id}: ${violation.help} (${targets})`;
  });
}

/** Fails the calling test when the container has any accessibility violation. */
export async function expectNoAccessibilityViolations(container: HTMLElement): Promise<void> {
  const violations = await findAccessibilityViolations(container);
  if (violations.length > 0) {
    throw new Error(`accessibility violations:\n  ${violations.join("\n  ")}`);
  }
}
