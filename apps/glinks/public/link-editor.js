// Progressive-enhancement link editor for the page-draft form.
// Renders structured rows from the JSON seeded in #link-data, and keeps
// them synced into the hidden #links-json field the server already
// expects (see App\Domain\Publishing\PageEditor::save and LinkInput::
// validate). No-JS clients get the <noscript> raw-JSON textarea instead
// (browsers never add that element's content to the DOM when scripting
// is enabled, so there is no duplicate "links" field either way).
// No build step or framework, matching the rest of this app.
(function () {
  "use strict";

  const SLUG_PATTERN = "[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?";

  function init() {
    const container = document.getElementById("link-rows");
    const template = document.getElementById("link-row-template");
    const hidden = document.getElementById("links-json");
    const addButton = document.getElementById("add-link");
    const dataScript = document.getElementById("link-data");
    const form = hidden ? hidden.closest("form") : null;
    if (!container || !template || !hidden || !addButton || !dataScript || !form) {
      return;
    }

    let links;
    try {
      links = JSON.parse(dataScript.textContent);
    } catch (e) {
      links = [];
    }

    function addRow(link) {
      const fragment = template.content.cloneNode(true);
      const row = fragment.querySelector(".link-row");
      const idField = row.querySelector('[data-field="id"]');
      const titleField = row.querySelector('[data-field="title"]');
      const urlField = row.querySelector('[data-field="url"]');
      const slugField = row.querySelector('[data-field="slug"]');
      const emojiField = row.querySelector('[data-field="emoji"]');
      const enabledField = row.querySelector('[data-field="enabled"]');

      const hasId = link && link.id != null;
      idField.value = hasId ? String(link.id) : "";
      titleField.value = (link && link.title) || "";
      urlField.value = (link && link.url) || "";
      slugField.value = (link && link.slug) || "";
      emojiField.value = (link && link.emoji) || "";
      enabledField.checked = !link || link.enabled !== false;

      if (hasId) {
        // Existing link slugs cannot change (PageEditor::save enforces
        // this server-side); mark the field read-only rather than let a
        // client edit it and hit a confusing 422 on save.
        slugField.readOnly = true;
        slugField.removeAttribute("pattern");
      } else {
        slugField.readOnly = false;
        slugField.setAttribute("pattern", SLUG_PATTERN);
      }

      row.querySelector(".remove-link").addEventListener("click", () => {
        row.remove();
      });
      row.querySelector(".move-up").addEventListener("click", () => {
        const prev = row.previousElementSibling;
        if (prev) container.insertBefore(row, prev);
      });
      row.querySelector(".move-down").addEventListener("click", () => {
        const next = row.nextElementSibling;
        if (next) container.insertBefore(next, row);
      });

      container.appendChild(row);
    }

    links.forEach(addRow);

    addButton.addEventListener("click", () => addRow(null));

    form.addEventListener("submit", () => {
      const rows = Array.from(container.querySelectorAll(".link-row"));
      const payload = rows.map((row) => {
        const id = row.querySelector('[data-field="id"]').value;
        const link = {
          title: row.querySelector('[data-field="title"]').value,
          url: row.querySelector('[data-field="url"]').value,
          slug: row.querySelector('[data-field="slug"]').value,
          emoji: row.querySelector('[data-field="emoji"]').value || null,
          enabled: row.querySelector('[data-field="enabled"]').checked,
        };
        if (id !== "") {
          link.id = parseInt(id, 10);
        }
        return link;
      });
      hidden.value = JSON.stringify(payload);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
