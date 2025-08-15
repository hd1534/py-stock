// Basic workflow UI: fetch nodes, render sidebar grouped by type, drag&drop to canvas

const TYPE_META = {
  process: { color: "bg-blue-100 text-blue-700 border-blue-300", icon: "⚙️" },
  utility: { color: "bg-gray-100 text-gray-700 border-gray-300", icon: "🧩" },
  input: { color: "bg-green-100 text-green-700 border-green-300", icon: "⬅️" },
  output: {
    color: "bg-purple-100 text-purple-700 border-purple-300",
    icon: "➡️",
  },
  data: {
    color: "bg-orange-100 text-orange-700 border-orange-300",
    icon: "🗄️",
  },
};

function groupByType(nodes) {
  return nodes.reduce((acc, n) => {
    const t = (n.type || "utility").toLowerCase();
    acc[t] = acc[t] || [];
    acc[t].push(n);
    return acc;
  }, {});
}

async function fetchNodes() {
  const res = await fetch("/api/nodes/");
  if (!res.ok) throw new Error("Failed to load nodes");
  return await res.json();
}

function makeTypeFilters(types) {
  const container = document.getElementById("type-filters");
  container.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className =
    "px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 data-[active=true]:bg-gray-200";
  allBtn.textContent = "전체";
  allBtn.dataset.type = "*";
  container.appendChild(allBtn);
  types.forEach((t) => {
    const meta = TYPE_META[t] || TYPE_META.utility;
    const btn = document.createElement("button");
    btn.className = `px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 ${meta.color}`;
    btn.textContent = t;
    btn.dataset.type = t;
    container.appendChild(btn);
  });
}

function renderSidebar(nodes) {
  const sidebar = document.getElementById("sidebar");
  // keep tools
  const tools = document.getElementById("sidebar-tools");
  sidebar.innerHTML = "";
  if (tools) sidebar.appendChild(tools);
  const groups = groupByType(nodes);
  makeTypeFilters(Object.keys(groups));

  Object.entries(groups).forEach(([type, list]) => {
    const meta = TYPE_META[type] || TYPE_META.utility;
    const section = document.createElement("div");
    section.className = "mb-6";

    const header = document.createElement("div");
    header.className = "flex items-center gap-2 mb-2";
    header.innerHTML = `<span>${meta.icon}</span><h2 class="font-semibold capitalize">${type}</h2>`;
    section.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "space-y-2";

    list.forEach((node) => {
      const li = document.createElement("li");
      li.className = `border ${meta.color} rounded p-3 cursor-move`;
      li.setAttribute("draggable", "true");
      li.dataset.node = JSON.stringify(node);

      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("application/json", JSON.stringify(node));
      });

      li.innerHTML = `
        <div class="text-sm font-medium">${node.name}</div>
        <div class="text-xs opacity-80">${node.description || ""}</div>
        <div class="mt-1 text-[10px] opacity-70">#${node.category || ""}</div>
      `;
      ul.appendChild(li);
    });

    section.appendChild(ul);
    sidebar.appendChild(section);
  });
}

function setupCanvas() {
  const canvas = document.getElementById("canvas");
  const viewport = document.getElementById("viewport");
  const reteContainer = document.getElementById("rete");

  // drag from sidebar to canvas
  viewport.addEventListener("dragover", (e) => e.preventDefault());
  viewport.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const node = JSON.parse(data);
    const rect = reteContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (window.WorkflowEditor) {
      window.WorkflowEditor.addNodeFromInfo(node, { x, y });
      saveCurrent();
    }
  });

  // panning with middle mouse or space+drag
  let isPanning = false;
  let start = { x: 0, y: 0 };
  viewport.addEventListener("mousedown", (e) => {
    if (e.button === 1 || e.target === viewport || e.code === "Space") {
      isPanning = true;
      start = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    pan.x = e.clientX - start.x;
    pan.y = e.clientY - start.y;
    applyTransform();
  });
  window.addEventListener("mouseup", () => (isPanning = false));

  // zoom with wheel
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // pinch/ctrl+wheel to zoom
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.1;
      const newScale = Math.min(2, Math.max(0.5, scale + delta));
      // zoom towards cursor
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      pan.x = cx - ((cx - pan.x) * newScale) / scale;
      pan.y = cy - ((cy - pan.y) * newScale) / scale;
      scale = newScale;
      applyTransform();
    },
    { passive: false }
  );

  // toolbar
  document.getElementById("reset-view")?.addEventListener("click", () => {
    if (window.WorkflowEditor) window.WorkflowEditor.center();
  });
}

// Cards UI is replaced by Rete nodes. Keeping functions for persistence below.

function collect() {
  // Use Rete's schema export for persistence
  if (window.WorkflowEditor) {
    return { drawflow: window.WorkflowEditor.toJSON() };
  }
  return { drawflow: null };
}

async function persistToServer(currentId) {
  const data = collect();
  if (currentId) {
    await fetch(`/api/workflows/${currentId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    return currentId;
  } else {
    const res = await fetch(`/api/workflows/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled", data }),
    });
    const json = await res.json();
    return json.id;
  }
}

async function loadFromServer(id) {
  const res = await fetch(`/api/workflows/${id}/`);
  if (!res.ok) return null;
  return await res.json();
}

async function saveCurrent() {
  const id = await persistToServer(window.__WF_ID__);
  if (!window.__WF_ID__) {
    window.__WF_ID__ = id;
    const url = new URL(location.href);
    url.searchParams.set("wf", String(id));
    history.replaceState({}, "", url);
  }
}

async function init() {
  try {
    const nodes = await fetchNodes();
    renderSidebar(nodes);
    setupCanvas();
    // sidebar interactions
    const search = document.getElementById("search");
    const sidebar = document.getElementById("sidebar");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        // simple filter by text on the fly
        const items = sidebar.querySelectorAll("li");
        items.forEach((li) => {
          const node = JSON.parse(li.dataset.node || "{}");
          const text = `${node.name} ${node.description || ""} ${
            node.category || ""
          }`.toLowerCase();
          li.style.display = text.includes(q) ? "" : "none";
        });
      });
    }
    document.getElementById("type-filters")?.addEventListener("click", (e) => {
      if (!(e.target instanceof HTMLElement)) return;
      const t = e.target.dataset.type;
      if (!t) return;
      const items = sidebar.querySelectorAll("li");
      items.forEach((li) => {
        const node = JSON.parse(li.dataset.node || "{}");
        const type = (node.type || "utility").toLowerCase();
        li.style.display = t === "*" || t === type ? "" : "none";
      });
    });
    document.getElementById("save")?.addEventListener("click", saveCurrent);
    document.getElementById("reset")?.addEventListener("click", async () => {
      if (window.WorkflowEditor) window.WorkflowEditor.clear();
      if (window.__WF_ID__) await saveCurrent();
    });

    // debounced autosave on editor change events
    let saveTimer = null;
    window.addEventListener("workflow:changed", () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveCurrent();
      }, 500);
    });

    // Load workflow from server if URL contains ?wf=ID
    const params = new URLSearchParams(location.search);
    const wfId = params.get("wf");
    if (wfId) {
      const saved = await loadFromServer(wfId);
      if (saved?.data?.drawflow && window.WorkflowEditor) {
        await window.WorkflowEditor.fromJSON(saved.data.drawflow);
      }
      window.__WF_ID__ = parseInt(wfId, 10);
    }
  } catch (e) {
    console.error(e);
    const sidebar = document.getElementById("sidebar");
    if (sidebar)
      sidebar.innerHTML =
        '<div class="text-red-600">노드 목록을 불러오지 못했습니다.</div>';
  }
}

document.addEventListener("DOMContentLoaded", init);
