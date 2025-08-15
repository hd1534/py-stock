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
  const inner = document.getElementById("inner");
  let pan = { x: 0, y: 0 };
  let scale = 1;

  function applyTransform() {
    inner.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
  }

  // drag from sidebar to canvas
  viewport.addEventListener("dragover", (e) => e.preventDefault());
  viewport.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const node = JSON.parse(data);
    const rect = viewport.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // compensate transform
    const invX = (x - pan.x) / scale;
    const invY = (y - pan.y) / scale;

    addNodeCard(inner, node, { x: invX, y: invY });
    persist();
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
    pan = { x: 0, y: 0 };
    scale = 1;
    applyTransform();
  });

  // load saved state
  const saved = load();
  if (saved?.nodes) {
    saved.nodes.forEach((n) => addNodeCard(inner, n.node, n.pos));
  }
  applyTransform();
}

function addNodeCard(container, node, pos) {
  const card = document.createElement("div");
  const meta =
    TYPE_META[(node.type || "utility").toLowerCase()] || TYPE_META.utility;
  card.className = `absolute border ${meta.color} rounded shadow w-56 select-none`;
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card.innerHTML = `
    <div class="text-sm font-semibold mb-1 px-3 py-2 border-b bg-white/70 card-drag-handle">${
      node.name
    }</div>
    <div class="p-3 text-xs opacity-80">${node.category || ""}</div>
    <div class="px-3 pb-3 text-[10px] opacity-70">Inputs: ${Object.keys(
      node.inputs?.properties || {}
    ).join(", ")}</div>
  `;
  container.appendChild(card);

  // drag within canvas
  const handle = card.querySelector(".card-drag-handle");
  let dragging = false;
  let start = { x: 0, y: 0 };
  let origin = { x: pos.x, y: pos.y };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    start = { x: e.clientX, y: e.clientY };
    origin = { x: parseFloat(card.style.left), y: parseFloat(card.style.top) };
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    card.style.left = `${origin.x + dx}px`;
    card.style.top = `${origin.y + dy}px`;
  });
  window.addEventListener("mouseup", () => {
    if (dragging) persist();
    dragging = false;
  });

  // simple close
  card.addEventListener("dblclick", () => {
    card.remove();
    persist();
  });
}

function collect() {
  const inner = document.getElementById("inner");
  const items = Array.from(inner.children).map((el) => {
    const nameEl = el.querySelector(".card-drag-handle");
    const nodeName = nameEl?.textContent || "";
    // store minimal node info (id preferred if sidebar had set it)
    return {
      node: { name: nodeName },
      pos: {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      },
    };
  });
  return { nodes: items };
}

function persist() {
  const data = collect();
  localStorage.setItem("workflow-state", JSON.stringify(data));
}

function load() {
  try {
    const raw = localStorage.getItem("workflow-state");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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
    document.getElementById("save")?.addEventListener("click", persist);
    document.getElementById("reset")?.addEventListener("click", () => {
      localStorage.removeItem("workflow-state");
      const inner = document.getElementById("inner");
      inner.innerHTML = "";
    });
  } catch (e) {
    console.error(e);
    const sidebar = document.getElementById("sidebar");
    if (sidebar)
      sidebar.innerHTML =
        '<div class="text-red-600">노드 목록을 불러오지 못했습니다.</div>';
  }
}

document.addEventListener("DOMContentLoaded", init);
