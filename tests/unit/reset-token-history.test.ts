import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "reset-token-long-enough-for-schema-123";
const HISTORY_STATE = { key: "reset-entry" };
const TOKEN_URL = `https://edubridge.example/reset-password?token=${encodeURIComponent(TOKEN)}&next=%2Fdashboard#details`;
const CLEAN_URL = "/reset-password?next=%2Fdashboard#details";

const mocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useActionState: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useEffect: mocks.useEffect,
    useActionState: mocks.useActionState,
  };
});

vi.mock("@/app/(auth)/actions", () => ({
  resetPasswordAction: vi.fn(),
}));

import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form";
import { initialFormState } from "@/lib/actions/state";

type ElementNode = {
  type: unknown;
  props: {
    children?: unknown;
    [key: string]: unknown;
  };
};

function isElementNode(value: unknown): value is ElementNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value
  );
}

function collectElements(root: unknown): ElementNode[] {
  const elements: ElementNode[] = [];

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isElementNode(node)) return;

    elements.push(node);
    const children = node.props.children;
    if (Array.isArray(children)) {
      for (const child of children) visit(child);
    } else if (children !== undefined && children !== null) {
      visit(children);
    }
  }

  visit(root);
  return elements;
}

function stubWindow(
  href: string,
  replaceState: ReturnType<typeof vi.fn>,
): void {
  vi.stubGlobal("window", {
    location: { href },
    history: { state: HISTORY_STATE, replaceState },
  });
}

function renderForm(): { tree: unknown; effects: Array<() => void> } {
  const effects: Array<() => void> = [];
  mocks.useEffect.mockImplementation((effect: () => void) => {
    effects.push(effect);
  });
  mocks.useActionState.mockReturnValue([initialFormState, vi.fn()]);

  const tree = ResetPasswordForm({ token: TOKEN });
  return { tree, effects };
}

function expectPostFormIntact(tree: unknown): void {
  const elements = collectElements(tree);
  const form = elements.find((element) => element.type === "form");
  expect(form).toBeDefined();

  const formElements = collectElements(form);
  const tokenInput = formElements.find(
    (element) =>
      element.type === "input" &&
      element.props.type === "hidden" &&
      element.props.name === "token",
  );

  expect(tokenInput?.props.value).toBe(TOKEN);
  expect(form?.props.action).toBe(
    mocks.useActionState.mock.results[0]?.value[1],
  );
  expect(form?.props.noValidate).toBe(true);
  expect(
    formElements.some(
      (element) =>
        element.type !== "input" && element.props.name === "password",
    ),
  ).toBe(true);
  expect(
    formElements.some(
      (element) =>
        element.type !== "input" && element.props.name === "confirmPassword",
    ),
  ).toBe(true);
}

describe("reset password token history cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes the token from URL and history without breaking the POST form", () => {
    const replaceState = vi.fn();
    stubWindow(TOKEN_URL, replaceState);
    const { tree, effects } = renderForm();

    expect(effects).toHaveLength(1);
    expect(mocks.useEffect).toHaveBeenCalledWith(expect.any(Function), []);
    expect(replaceState).not.toHaveBeenCalled();

    effects[0]();

    expect(replaceState).toHaveBeenCalledWith(HISTORY_STATE, "", CLEAN_URL);
    const replacement = String(replaceState.mock.calls[0][2]);
    expect(replacement).not.toContain(TOKEN);
    expect(replacement).not.toContain("token=");

    expectPostFormIntact(tree);
  });

  it("leaves an already clean URL untouched and still renders the token field", () => {
    const replaceState = vi.fn();
    stubWindow(
      "https://edubridge.example/reset-password?next=%2Fdashboard",
      replaceState,
    );
    const { tree, effects } = renderForm();

    effects[0]();

    expect(replaceState).not.toHaveBeenCalled();
    expectPostFormIntact(tree);
  });
});
