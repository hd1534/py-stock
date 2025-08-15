// Drawflow editor bootstrap (vanilla JS)
// Provides a basic editor with add/clear/export/import/center APIs under window.WorkflowEditor

(function () {
  const container = document.getElementById("rete");
  if (!container || !window.Drawflow) return;

  const editor = new Drawflow(container);
  editor.start();

  function addNodeFromInfo(info, position) {
    const data = { info };
    const inputProps = Object.keys(info?.inputs?.properties || {});
    const outputProps = Object.keys(info?.outputs?.properties || {});
    const inputsCount = inputProps.length;
    const outputsCount = outputProps.length;
    // type -> color/icon mapping inspired by example
    const TYPE_STYLE = {
      input: { color: "#10b981", icon: "⬅️" },
      process: { color: "#3b82f6", icon: "⚙️" },
      output: { color: "#8b5cf6", icon: "➡️" },
      data: { color: "#f59e0b", icon: "🗄️" },
      utility: { color: "#6b7280", icon: "🧩" },
    };
    const t = (info.type || "utility").toLowerCase();
    const style = TYPE_STYLE[t] || TYPE_STYLE.utility;
    const inList = inputProps
      .map(
        (p) => `
          <li class=\"text-[10px] text-gray-700 flex items-center\">
            <span style=\"display:inline-block;width:10px;height:10px;background:${style.color};border:2px solid white;border-radius:50%;margin-right:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2)\"></span>
            ${p}
          </li>`
      )
      .join("");
    const outList = outputProps
      .map(
        (p) => `
          <li class=\"text-[10px] text-gray-700 flex items-center justify-end\">
            ${p}
            <span style=\"display:inline-block;width:10px;height:10px;background:${style.color};border:2px solid white;border-radius:50%;margin-left:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2)\"></span>
          </li>`
      )
      .join("");
    const html = `
      <div class=\"wf-card\" style=\"position:relative;background:white;border:2px solid ${
        style.color
      };border-radius:8px;min-width:180px;box-shadow:0 2px 8px rgba(0,0,0,0.1);\">
        <div class=\"wf-title\" style=\"background:${
          style.color
        };color:white;padding:8px 12px;font-weight:600;font-size:12px;border-radius:6px 6px 0 0;display:flex;align-items:center;gap:8px;\">
          <span>${style.icon}</span>
          <span>${info.name}</span>
        </div>
        <div class=\"wf-body\" style=\"padding:12px;\">
          <div class=\"text-[10px] opacity-80\">#${info.category || ""}</div>
          ${
            info.description
              ? `<div class=\\"text-[11px] mt-1 opacity-70\\">${info.description}</div>`
              : ""
          }
          <div class=\"grid grid-cols-2 gap-2 mt-2\">
            <div>
              <div class=\"text-[10px] font-semibold opacity-70\">Inputs</div>
              <ul class=\"space-y-0.5\">${
                inList || '<li class=\\"text-[10px] opacity-50\\">-</li>'
              }</ul>
            </div>
            <div>
              <div class=\"text-[10px] font-semibold opacity-70\">Outputs</div>
              <ul class=\"space-y-0.5\">${
                outList || '<li class=\\"text-[10px] opacity-50\\">-</li>'
              }</ul>
            </div>
          </div>
        </div>
      </div>`;
    const id = editor.addNode(
      info.id || info.name || "node",
      inputsCount,
      outputsCount,
      position.x || 0,
      position.y || 0,
      info.type || "node",
      data,
      html
    );
    // decorate ports and bind controls once node DOM exists
    setTimeout(
      () => decorateNode(id, { info, style, inputProps, outputProps }),
      0
    );
    window.dispatchEvent(new CustomEvent("workflow:changed"));
    return id;
  }

  function decorateNode(id, ctx) {
    const node = editor.getNodeFromId(id);
    if (!node) return;
    const root = document.getElementById(`node-${id}`);
    if (!root) return;
    try {
      // colorize sockets only (avoid mutating port DOM structure)
      const color = ctx.style?.color || "#64748b";
      const inPorts = root.querySelectorAll(".inputs .input");
      const outPorts = root.querySelectorAll(".outputs .output");
      inPorts.forEach((p) => (p.style.background = color));
      outPorts.forEach((p) => (p.style.background = color));

      // attach node controls (delete / duplicate)
      const card = root.querySelector(".wf-card");
      if (card && !card.querySelector(".wf-controls")) {
        const controls = document.createElement("div");
        controls.className = "wf-controls";
        controls.style.position = "absolute";
        controls.style.top = "-8px";
        controls.style.right = "-8px";
        controls.style.display = "flex";
        controls.style.gap = "6px";
        // duplicate
        const dup = document.createElement("button");
        dup.textContent = "⎘";
        dup.title = "Duplicate";
        Object.assign(dup.style, {
          width: "22px",
          height: "22px",
          background: "#0ea5e9",
          color: "white",
          border: "none",
          borderRadius: "9999px",
          fontSize: "12px",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        });
        dup.addEventListener("click", (e) => {
          e.stopPropagation();
          const n = editor.getNodeFromId(id);
          if (!n) return;
          addNodeFromInfo(n.data.info || {}, {
            x: (n.pos_x || 0) + 32,
            y: (n.pos_y || 0) + 32,
          });
        });
        // delete
        const del = document.createElement("button");
        del.textContent = "×";
        del.title = "Delete";
        Object.assign(del.style, {
          width: "22px",
          height: "22px",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "9999px",
          fontSize: "14px",
          lineHeight: "22px",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        });
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          editor.removeNodeId(id);
        });
        controls.appendChild(dup);
        controls.appendChild(del);
        card.appendChild(controls);
        // show on hover
        card.addEventListener(
          "mouseenter",
          () => (controls.style.display = "flex")
        );
        card.addEventListener(
          "mouseleave",
          () => (controls.style.display = "none")
        );
        controls.style.display = "none";
      }
    } catch (_) {}
  }

  function clear() {
    editor.clearModule();
    window.dispatchEvent(new CustomEvent("workflow:changed"));
  }

  function toJSON() {
    return editor.export();
  }

  async function fromJSON(data) {
    editor.import(data);
    window.dispatchEvent(new CustomEvent("workflow:changed"));
  }

  function center() {
    // Drawflow has zoom/pan methods
    editor.zoom_reset();
    editor.translate_to(0, 0);
  }

  function getSelectedNode() {
    const id = editor.getSelectedNodes()[0];
    if (!id) return null;
    const module = editor.getModuleFromNodeId(id);
    const node = editor.getNodeFromId(id);
    return { id, module, node };
  }

  function updateNodeData(id, newData) {
    const n = editor.getNodeFromId(id);
    if (!n) return;
    const merged = Object.assign({}, n.data, newData);
    editor.updateNodeDataFromId(id, merged);
    window.dispatchEvent(new CustomEvent("workflow:changed"));
  }

  // Node selection change -> emit detailed event for panel
  editor.on("nodeSelected", (id) => {
    const node = editor.getNodeFromId(id);
    const detail = { id, data: node?.data || {}, name: node?.name };
    window.dispatchEvent(new CustomEvent("workflow:nodeSelected", { detail }));
  });
  editor.on("click", () => {
    window.dispatchEvent(
      new CustomEvent("workflow:nodeSelected", { detail: null })
    );
  });

  // Emit change events for autosave hooks
  const fire = () => window.dispatchEvent(new CustomEvent("workflow:changed"));
  editor.on("nodeCreated", fire);
  editor.on("nodeRemoved", fire);
  editor.on("nodeMoved", fire);
  editor.on("connectionCreated", fire);
  editor.on("connectionRemoved", fire);

  // Keyboard shortcuts: Delete to remove selected, Cmd/Ctrl+S to save, Cmd/Ctrl+D to duplicate
  window.addEventListener("keydown", (e) => {
    const sel = editor.getSelectedNodes?.()[0];
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("workflow:changed"));
    } else if (sel && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      editor.removeNodeId(sel);
    } else if (sel && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const n = editor.getNodeFromId(sel);
      if (n)
        addNodeFromInfo(n.data.info || {}, {
          x: (n.pos_x || 0) + 32,
          y: (n.pos_y || 0) + 32,
        });
    }
  });

  window.WorkflowEditor = {
    editor,
    addNodeFromInfo,
    clear,
    toJSON,
    fromJSON,
    center,
    getSelectedNode,
    updateNodeData,
  };
})();
