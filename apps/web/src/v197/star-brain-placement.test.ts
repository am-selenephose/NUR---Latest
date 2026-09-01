import { placeV197StarBrainHost } from "../bridge/v197StarBrain";

describe("V197 star brain placement", () => {
  beforeEach(() => {
    document.body.className = "universe-edition";
    document.body.replaceChildren();
  });

  it("does not place a brain on the dedicated Map surface", () => {
    document.body.innerHTML = `
      <main id="nur-front-v61">
        <section id="page-universe-map" class="active">
          <div class="lens-map-master"><div class="spark f4-master-star nur-star-module"></div></div>
        </section>
      </main>
    `;

    expect(placeV197StarBrainHost(document)).toBeNull();
    expect(document.querySelectorAll("#front-nur-star")).toHaveLength(0);
    expect(document.querySelector(".lens-map-master > .f4-master-star")).not.toBeNull();
  });

  it("does not synthesize external orbit halos around the exact Systems brain", () => {
    document.body.innerHTML = `
      <main id="nur-front-v61">
        <section id="page-systems" class="active">
          <div class="universe-map-panel">
            <div class="universe-master-star">
              <div class="f4-core"><div class="spark f4-master-star"></div></div>
            </div>
          </div>
        </section>
      </main>
    `;

    placeV197StarBrainHost(document);
    const host = document.querySelector<HTMLElement>(".universe-master-star");
    const halos = host?.querySelectorAll<HTMLElement>(":scope > .nur-v197-brain-orbit-halo");
    expect(host?.querySelector("#front-nur-star")?.getAttribute("data-nur-surface")).toBe("universe");
    expect(host?.querySelector("#front-nur-star")?.getAttribute("data-nur-engine"))
      .toBe("canvas2d-exact-artifact-v1");
    expect(halos).toHaveLength(0);
    expect(host?.querySelector(":scope > .f4-ring")).toBeNull();
    expect(host?.querySelector(":scope > .f4-core, :scope > .spark, :scope > .f4-master-star")).toBeNull();
  });
});
