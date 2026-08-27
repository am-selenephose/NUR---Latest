import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  findUnextractedCopy,
  UI_SOURCE_TARGETS,
} from "../scripts/check-i18n-extraction.mjs";

test("scans every production V197 bridge runtime", () => {
  const bridgeDirectory = resolve(import.meta.dirname, "../../apps/web/src/bridge");
  const productionSources = readdirSync(bridgeDirectory)
    .filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map(name => `apps/web/src/bridge/${name}`)
    .sort();

  assert.deepEqual([...UI_SOURCE_TARGETS].sort(), productionSources);
});

test("rejects direct locale-sensitive DOM copy literals", () => {
  const violations = findUnextractedCopy(`
    function paint(node, input, button) {
      node.textContent = "Raw visible copy";
      input.placeholder = "Raw placeholder";
      button.title = "Raw title";
      button.setAttribute("aria-label", "Raw accessible name");
      setText(document, "#status", "Raw helper copy");
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["textContent", "placeholder", "title", "aria-label", "setText"],
  );
});

test("rejects raw accessible descriptions and alternative text", () => {
  const violations = findUnextractedCopy(`
    image.alt = "Raw image description";
    node.setAttribute("aria-description", "Raw accessible description");
    node.setAttribute("aria-roledescription", "Raw role description");
    node.setAttribute("aria-valuetext", "Raw value description");
    node.setAttribute("aria-placeholder", "Raw accessible placeholder");
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    [
      "Raw image description",
      "Raw accessible description",
      "Raw role description",
      "Raw value description",
      "Raw accessible placeholder",
    ],
  );
});

test("rejects raw failure copy passed to the imported Insight renderer", () => {
  const violations = findUnextractedCopy(`
    renderInsightInspection(document, null, null, null, "Raw inspection failure");
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw inspection failure"]);
});

test("rejects raw browser prompt, confirm, and alert copy", () => {
  const violations = findUnextractedCopy(`
    window.prompt("Raw prompt copy");
    view.confirm("Raw confirmation copy");
    alert("Raw alert copy");
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => [row.kind, row.value]),
    [
      ["prompt", "Raw prompt copy"],
      ["confirm", "Raw confirmation copy"],
      ["alert", "Raw alert copy"],
    ],
  );
});

test("accepts catalog-backed DOM copy expressions and structural literals", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node, input, button, copy) {
      node.textContent = copy.heading;
      input.placeholder = copy.placeholder;
      button.title = copy.title;
      button.setAttribute("aria-label", copy.accessibleName);
      setText(document, "#status", copy.status);
      node.id = "structural-id";
      node.className = "structural-class";
    }
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});

test("rejects literals passed through every UI-producing helper", () => {
  const violations = findUnextractedCopy(`
    function paint(document) {
      element(document, "h2", "heading", "Raw element copy");
      el(document, "p", "copy", "Raw short helper copy");
      button(document, "Raw button copy", "save");
      empty(document, "Raw empty title", "Raw empty body");
      status(document, "Raw status copy");
      field(document, "Raw field label", "Raw field value");
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["element", "el", "button", "empty", "empty", "status", "field", "field"],
  );
});

test("rejects visible HTML and template copy while preserving structural templates", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node, ownerName) {
      node.textContent = \`Saved for \${ownerName}\`;
      node.innerHTML = "<strong>Raw visible HTML</strong>";
      node.insertAdjacentHTML("beforeend", "<span>Raw inserted HTML</span>");
      node.setAttribute("aria-label", \`Open \${ownerName}'s settings\`);
      node.dataset.route = \`/systems/\${ownerName}\`;
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["textContent", "innerHTML", "insertAdjacentHTML", "aria-label"],
  );
  assert.equal(violations[0].value, "Saved for {0}");
  assert.equal(violations[3].value, "Open {0}'s settings");
});

test("ignores punctuation-only visual separators", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node) {
      node.textContent = "·";
      node.title = \`\${ownerName} →\`;
      element(document, "span", "separator", "→");
      button(document, "✦", "open");
    }
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});

test("infers UI-copy parameters through local helper call chains", () => {
  const violations = findUnextractedCopy(`
    function write(node, value) {
      node.textContent = value;
    }
    function result(document, title, detail) {
      write(document.querySelector("h2"), title);
      write(document.querySelector("p"), detail);
    }
    result(document, "Raw inferred title", \`Raw detail for \${ownerName}\`);
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => [row.kind, row.value]),
    [
      ["result", "Raw inferred title"],
      ["result", "Raw detail for {0}"],
    ],
  );
});

test("rejects conditional and default copy literals at inferred DOM sinks", () => {
  const violations = findUnextractedCopy(`
    function write(node, value = "Raw default") {
      node.textContent = value;
    }
    function render(node, active, error) {
      write(node, active ? "Raw active" : "Raw inactive");
      node.title = error instanceof Error ? error.message : "Raw error fallback";
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    ["Raw default", "Raw active", "Raw inactive", "Raw error fallback"],
  );
});

test("rejects direct text-node copy and user-visible Error messages", () => {
  const violations = findUnextractedCopy(`
    function replace(node, value) {
      node.nodeValue = value;
    }
    replace(textNode, "Raw text node copy");
    throw new Error("Raw visible error");
    throw new V197ApiError("Raw API error", 400);
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    ["Raw text node copy", "Raw visible error", "Raw API error"],
  );
});

test("rejects hardcoded English branches injected through uiFormat values", () => {
  const violations = findUnextractedCopy(`
    node.textContent = uiFormat("Review state: {0}", [approved ? "approved" : "rejected"]);
    node.title = uiFormat("Binary flag {0}", [active ? "1" : "0"]);
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["approved", "rejected"]);
});

test("rejects sentences assembled from separately translated catalog fragments", () => {
  const violations = findUnextractedCopy(`
    node.textContent = uiCopy("The first half of a sentence,") + " "
      + uiCopy("followed by a separately translated second half.");
    node.title = uiFormat("Saved {0} records.", [count]) + " "
      + uiCopy("Nothing else was changed.");
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["fragmented-ui-copy", "fragmented-ui-copy"],
  );
});

test("rejects visible literals nested in createTextNode", () => {
  const violations = findUnextractedCopy(`
    const message = document.createElement("div");
    message.append(document.createTextNode("No persisted turns yet."));
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => [row.kind, row.value]),
    [["createTextNode", "No persisted turns yet."]],
  );
});

test("traces deferred copy through local constants, arrays, and object dictionaries", () => {
  const violations = findUnextractedCopy(`
    const EMPTY_TITLE = "Raw deferred title";
    const LABELS = ["Raw first label", "Raw second label"];
    const STATES = { active: "Raw active state", idle: "Raw idle state" };
    function paint(node, index, state) {
      node.textContent = EMPTY_TITLE;
      node.title = LABELS[index];
      node.setAttribute("aria-label", STATES[state]);
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    [
      "Raw deferred title",
      "Raw first label",
      "Raw second label",
      "Raw active state",
      "Raw idle state",
    ],
  );
});

test("traces visible labels through tuple destructuring", () => {
  const violations = findUnextractedCopy(`
    for (const [label, route] of [
      ["Raw settings label", "/settings"],
      ["Raw memory label", "/memory"],
    ]) {
      const button = document.createElement("button");
      button.dataset.route = route;
      button.textContent = label;
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    ["Raw settings label", "Raw memory label"],
  );
});

test("accepts deferred catalog keys marked with uiSource", () => {
  const violations = findUnextractedCopy(`
    const EMPTY_TITLE = uiSource("Catalog title");
    const LABELS = [uiSource("Catalog first label"), uiSource("Catalog second label")];
    function paint(node, index) {
      node.textContent = uiCopy(EMPTY_TITLE);
      node.title = uiCopy(LABELS[index]);
    }
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});

test("accepts explicitly marked structural state tokens without hiding raw UI copy", () => {
  const violations = findUnextractedCopy(`
    const view = structuralValue("orbit");
    node.textContent = view;
    other.textContent = "Raw visible orbit label";
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw visible orbit label"]);
});

test("infers visible copy passed through class and instance methods", () => {
  const violations = findUnextractedCopy(`
    class Controller {
      toast(message) {
        this.status.textContent = message;
      }
      save() {
        this.toast("Raw instance toast");
      }
    }
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw instance toast"]);
});

test("infers copy forwarded through the V197 toast host", () => {
  const violations = findUnextractedCopy(`
    class Controller {
      toast(message) {
        this.window?.nurToast?.(message);
      }
      save() {
        this.toast("Raw hosted toast");
      }
    }
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw hosted toast"]);
});

test("traces visible fallback copy through formatter return values", () => {
  const violations = findUnextractedCopy(`
    function text(value, fallback) {
      return typeof value === "string" && value ? value : fallback;
    }
    function nested(value, fallback) {
      return text(value, fallback);
    }
    node.textContent = nested(persistedValue, "Raw formatter fallback");
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw formatter fallback"]);
});

test("does not mistake structural lookup parameters for returned copy", () => {
  const violations = findUnextractedCopy(`
    function inputValue(document, selector) {
      return document.querySelector(selector)?.value ?? "";
    }
    node.textContent = inputValue(document, "#owner-input");
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});

test("rejects raw copy assigned to visible notice and error state", () => {
  const violations = findUnextractedCopy(`
    state.notice = "Raw success notice";
    state.error = error instanceof Error ? error.message : "Raw error fallback";
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.value),
    ["Raw success notice", "Raw error fallback"],
  );
});

test("infers copy forwarded into visible state setters", () => {
  const violations = findUnextractedCopy(`
    function mutate(run, notice) {
      state.notice = notice;
    }
    mutate(save, "Raw mutation notice");
  `, "fixture.ts");

  assert.deepEqual(violations.map(row => row.value), ["Raw mutation notice"]);
});

test("allows only explicitly named structural record discriminators", () => {
  const violations = findUnextractedCopy(`
    function ensureInsightControls(document, claim) {
      document.body.textContent = claim.claim_text;
    }
    ensureInsightControls(document, {
      record_kind: "DEDICATED_INSIGHT",
      claim_text: persistedClaim,
    });
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});
