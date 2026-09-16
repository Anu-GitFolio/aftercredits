const report = document.querySelector("#report");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function until(check, message) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await pause(30);
  }
  throw new Error(message);
}
const reply = (value, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
document.querySelector("#run").onclick = async () => {
  document.querySelector("#run").disabled = true;
  const results = [];
  let frame;
  try {
    const catalogue = await (await fetch("/api/catalogue")).json();
    const title = (id) => catalogue.titles.find((t) => t.id === id);
    async function fixture(intercept = () => null) {
      frame?.remove();
      let state = {
        revision: 0,
        region: "ae",
        arc: {},
        entries: [{ titleId: "arrival", status: "watched", rating: 4 }],
      };
      window.fixtureFetch = async (path, options = {}) => {
        const url = new URL(path, location.origin),
          data = options.body ? JSON.parse(options.body) : {};
        const controlled = intercept(url, options, data, state);
        if (controlled) return controlled;
        if (url.pathname === "/api/catalogue") return reply(catalogue);
        if (url.pathname === "/api/session" || url.pathname === "/api/state")
          return reply(state);
        if (url.pathname === "/api/recommend")
          return reply({
            arc: data,
            exact: true,
            results: ["totoro", "portrait-lady", "dune"].map((id) => ({
              ...title(id),
              reasons: [title(id).note, "An editorial fit."],
            })),
            pair: {
              titles: [title("totoro"), title("portrait-lady")],
              minutes: 206,
              reason: "Two complete films.",
            },
          });
        if (url.pathname === "/api/entry") {
          state.entries = state.entries.filter(
            (e) => e.titleId !== data.titleId,
          );
          if (data.status !== "remove")
            state.entries.push({
              titleId: data.titleId,
              status: data.status,
              rating: data.rating || 0,
            });
          state.revision++;
          return reply(state);
        }
        if (url.pathname === "/api/preferences") {
          assert(
            data.revision === state.revision,
            "Preference revision did not recover",
          );
          state = {
            ...state,
            region: data.region,
            arc: data.arc,
            revision: state.revision + 1,
          };
          return reply(state);
        }
        if (url.pathname === "/api/reset") return reply({ deleted: true });
        throw new Error("Unexpected fixture request: " + url.pathname);
      };
      frame = document.createElement("iframe");
      frame.title = "Isolated app fixture";
      frame.width = "1100";
      frame.height = "700";
      frame.src = "/__qa/fixture.html";
      document.querySelector("#fixture").append(frame);
      await until(
        () => frame.contentDocument?.querySelector("header nav"),
        "Fixture did not start",
      );
      const doc = frame.contentDocument,
        win = frame.contentWindow;
      doc.querySelector('a[href="/"]').click();
      return {
        doc,
        win,
        click: (selector) => {
          const el = doc.querySelector(selector);
          assert(el, "Missing control: " + selector);
          el.click();
        },
        submit: (selector) =>
          doc
            .querySelector(selector)
            .dispatchEvent(
              new win.Event("submit", { bubbles: true, cancelable: true }),
            ),
      };
    }
    async function check(name, run) {
      await run();
      results.push({ name, passed: true });
      report.textContent = JSON.stringify(
        { status: "running", results },
        null,
        2,
      );
    }
    await check(
      "An older failed search cannot erase newer results",
      async () => {
        let rejectOld;
        const f = await fixture((url) => {
          const q = url.searchParams.get("q");
          if (q === "old-search")
            return new Promise((resolve, reject) => (rejectOld = reject));
          if (q === "new-search") return reply({ titles: [title("totoro")] });
        });
        f.click('a[href="/explore"]');
        await until(
          () => f.doc.querySelector('#catalogue-results[aria-busy="false"]'),
          "Initial results missing",
        );
        f.doc.querySelector("#catalogue-search").value = "old-search";
        f.submit("#filters");
        await until(() => rejectOld, "Old search not pending");
        f.doc.querySelector("#catalogue-search").value = "new-search";
        f.submit("#filters");
        await until(
          () =>
            f.doc
              .querySelector("#results-count")
              .textContent.startsWith("1 story"),
          "New search not complete",
        );
        rejectOld(new Error("Simulated late timeout"));
        await pause(80);
        assert(
          f.doc
            .querySelector("#catalogue-results")
            .textContent.includes("My Neighbor Totoro"),
          "Late failure erased latest result",
        );
        assert(
          !f.doc
            .querySelector("#catalogue-results")
            .textContent.includes("AN INTERMISSION"),
          "Stale failure was rendered",
        );
      },
    );
    await check(
      "Changing watched history invalidates the visible Mood Arc and double bill",
      async () => {
        const f = await fixture();
        f.click('a[href="/explore"]');
        await until(
          () =>
            f.doc.querySelector('[data-action="compare"][data-id="arrival"]'),
          "Arrival card missing",
        );
        f.click('[data-action="compare"][data-id="arrival"]');
        f.click('a[href="/mood-arc"]');
        f.doc.querySelector('[name="minutes"]').value = "300";
        f.submit("#arc-form");
        await until(
          () =>
            f.doc.querySelector('[data-action="pair-save"]') &&
            !f.doc.querySelector("#arc-form button").disabled,
          "Double bill not ready",
        );
        f.click('[data-action="compare-open"]');
        f.click('dialog [data-action="rate"][data-id="arrival"]');
        f.submit("#rating-form");
        await until(
          () => !f.doc.querySelector("dialog").open,
          "Rating dialog did not close",
        );
        assert(
          !f.doc.querySelector('[data-action="pair-save"]'),
          "An inert double bill remains",
        );
        assert(
          f.doc
            .querySelector("#arc-results")
            .textContent.includes("YOUR COLLECTION CHANGED"),
          "Fresh recommendation guidance missing",
        );
      },
    );
    await check(
      "Confirmed deletion clears local data even if reconnect fails",
      async () => {
        let deleted = false;
        const f = await fixture((url) => {
          if (url.pathname === "/api/reset") {
            deleted = true;
            return reply({ deleted: true });
          }
          if (url.pathname === "/api/session" && deleted)
            return Promise.reject(new Error("Simulated reconnect failure"));
        });
        f.click('a[href="/privacy"]');
        f.click('[data-action="reset-confirm"]');
        f.click('[data-action="reset"]');
        await until(
          () =>
            f.doc
              .querySelector("#toast")
              .textContent.includes("Your data was deleted"),
          "Deletion outcome was misreported",
        );
        f.click('a[href="/collection"]');
        assert(
          f.doc
            .querySelector("#main")
            .textContent.includes("unavailable right now"),
          "Offline status missing",
        );
        assert(
          !f.doc.querySelector("#main").textContent.includes("Arrival"),
          "Deleted entry remains visible",
        );
        assert(
          f.doc
            .querySelector('[data-action="collection-tab"][data-id="watched"]')
            .textContent.includes("0"),
          "Watched count was not cleared",
        );
      },
    );
    await check(
      "A region conflict refreshes its revision and recovers on retry",
      async () => {
        let first = true,
          refreshed = false;
        const f = await fixture((url, options, data, state) => {
          if (url.pathname === "/api/preferences" && first) {
            first = false;
            state.revision = 5;
            state.region = "us";
            return reply({ error: "conflict" }, 409);
          }
          if (url.pathname === "/api/state") {
            refreshed = true;
            return reply(state);
          }
        });
        f.click('a[href="/title/arrival"]');
        let select = f.doc.querySelector("#region");
        select.value = "in";
        select.dispatchEvent(new f.win.Event("change", { bubbles: true }));
        await until(
          () => refreshed && select.value === "us",
          "Conflict failed to refresh selected region",
        );
        assert(
          f.doc.querySelector("#watch-provider").href.includes("/us/search"),
          "Search URL did not recover",
        );
        select.value = "gb";
        select.dispatchEvent(new f.win.Event("change", { bubbles: true }));
        await until(
          () =>
            f.doc.querySelector("#watch-provider").href.includes("/gb/search"),
          "Region retry failed",
        );
      },
    );
    await check("Detail comparison text follows selection", async () => {
      const f = await fixture();
      f.click('a[href="/title/arrival"]');
      f.click('.secondary-actions [data-action="compare"]');
      assert(
        f.doc
          .querySelector('.secondary-actions [data-action="compare"]')
          .textContent.includes("On your shortlist"),
        "Selected comparison label stale",
      );
      f.click('.secondary-actions [data-action="compare"]');
      assert(
        f.doc
          .querySelector('.secondary-actions [data-action="compare"]')
          .textContent.includes("Compare this"),
        "Deselected comparison label stale",
      );
    });
    report.textContent = JSON.stringify(
      { status: "complete", passed: results.length, results },
      null,
      2,
    );
  } catch (error) {
    report.textContent = JSON.stringify(
      { status: "failed", results, error: error.message },
      null,
      2,
    );
  } finally {
    document.querySelector("#run").disabled = false;
    frame?.remove();
  }
};
