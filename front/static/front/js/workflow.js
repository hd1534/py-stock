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

function renderSidebar(nodes) {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";
  const groups = groupByType(nodes);

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
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const node = JSON.parse(data);
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addNodeCard(canvas, node, { x, y });
  });
}

function addNodeCard(canvas, node, pos) {
  const card = document.createElement("div");
  const meta =
    TYPE_META[(node.type || "utility").toLowerCase()] || TYPE_META.utility;
  card.className = `absolute border ${meta.color} rounded shadow p-3 w-48`;
  card.style.left = `${pos.x - 24}px`;
  card.style.top = `${pos.y - 24}px`;
  card.innerHTML = `
    <div class="text-sm font-semibold mb-1">${node.name}</div>
    <div class="text-xs opacity-80 mb-2">${node.category || ""}</div>
    <div class="text-[10px] opacity-70">Inputs: ${Object.keys(
      node.inputs?.properties || {}
    ).join(", ")}</div>
  `;
  canvas.appendChild(card);
}

async function init() {
  try {
    const nodes = await fetchNodes();
    renderSidebar(nodes);
    setupCanvas();
  } catch (e) {
    console.error(e);
    const sidebar = document.getElementById("sidebar");
    if (sidebar)
      sidebar.innerHTML =
        '<div class="text-red-600">노드 목록을 불러오지 못했습니다.</div>';
  }
}

document.addEventListener("DOMContentLoaded", init);
