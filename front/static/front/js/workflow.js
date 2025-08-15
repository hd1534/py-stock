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

  // drag from sidebar to canvas
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const node = JSON.parse(data);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (window.WorkflowEditor) {
      window.WorkflowEditor.addNodeFromInfo(node, { x, y });
      saveCurrent();
    }
  });

  // toolbar
  document.getElementById("reset-view")?.addEventListener("click", () => {
    if (window.WorkflowEditor) window.WorkflowEditor.center();
  });
}

// Cards UI is replaced by Rete nodes. Keeping functions for persistence below.

function collect() {
  // Use custom editor's JSON format for persistence
  if (window.WorkflowEditor) {
    return { custom_editor: window.WorkflowEditor.toJSON() };
  }
  return { custom_editor: null };
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

    // node selection -> open panel
    const panel = document.getElementById("node-panel");
    const panelClose = document.getElementById("node-panel-close");
    const formRoot = document.getElementById("node-form");
    panelClose?.addEventListener("click", () => panel?.classList.add("hidden"));

    function renderField(key, schema, value, isOutput = false) {
      const type = (schema.type || "string").toLowerCase();
      const label = schema.title || key;
      const desc = schema.description || "";
      let inputHtml = "";

      if (isOutput) {
        // For output fields, use textarea for better editing
        if (type === "object" || type === "array") {
          const displayValue =
            typeof value === "object"
              ? JSON.stringify(value, null, 2)
              : value || "";
          inputHtml = `<textarea data-key="${key}" data-output="true" rows="4" class="w-full border rounded px-2 py-1 text-xs font-mono bg-gray-50" placeholder="Output will appear here...">${displayValue}</textarea>`;
        } else {
          inputHtml = `<input data-key="${key}" data-output="true" type="text" value="${
            value ?? ""
          }" class="w-full border rounded px-2 py-1 bg-gray-50" placeholder="Output will appear here..." />`;
        }
      } else {
        // For input fields, keep original behavior
        if (type === "integer" || type === "number") {
          inputHtml = `<input data-key="${key}" type="number" value="${
            value ?? ""
          }" class="w-full border rounded px-2 py-1" />`;
        } else if (type === "boolean") {
          const checked = value ? "checked" : "";
          inputHtml = `<input data-key="${key}" type="checkbox" ${checked} class="mr-2" />`;
        } else {
          inputHtml = `<input data-key="${key}" type="text" value="${
            value ?? ""
          }" class="w-full border rounded px-2 py-1" />`;
        }
      }

      return `
        <div class="mb-3">
          <div class="text-xs font-medium mb-1 ${
            isOutput ? "text-purple-600" : ""
          }">${label} ${isOutput ? "(Output)" : ""}</div>
          ${inputHtml}
          ${
            desc ? `<div class="text-[10px] opacity-70 mt-1">${desc}</div>` : ""
          }
        </div>
      `;
    }

    // Node execution function
    async function executeNode(nodeId, currentValues, nodeDetail) {
      const resultDiv = document.getElementById("execution-result");
      const runBtn = document.getElementById("run-node-btn");
      const historyDiv = document.getElementById("execution-history");

      if (!resultDiv || !runBtn) return;

      // Show loading state
      runBtn.disabled = true;
      runBtn.textContent = "Running...";
      resultDiv.innerHTML =
        '<div class="text-blue-500">Executing node...</div>';

      try {
        const response = await fetch(`/api/nodes/${nodeId}/execute/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentValues || {}),
        });

        const result = await response.json();
        const timestamp = new Date().toLocaleTimeString();

        if (result.success) {
          // Update output fields with new values
          updateOutputFields(result.result, nodeDetail.id);

          // Add to history
          addToExecutionHistory(timestamp, true, result.result, historyDiv);

          // Show success message
          resultDiv.innerHTML = `
            <div class="text-green-600 font-medium">✓ Success (${timestamp})</div>
            <div class="text-xs text-gray-500 mt-1">Output fields updated</div>
          `;
        } else {
          // Add error to history
          addToExecutionHistory(timestamp, false, result.error, historyDiv);

          resultDiv.innerHTML = `
            <div class="text-red-600 font-medium">✗ Error (${timestamp})</div>
            <div class="mt-1 p-2 bg-red-50 rounded text-xs">
              ${result.error || "Unknown error occurred"}
            </div>
          `;
        }
      } catch (error) {
        const timestamp = new Date().toLocaleTimeString();
        addToExecutionHistory(timestamp, false, error.message, historyDiv);

        resultDiv.innerHTML = `
          <div class="text-red-600 font-medium">✗ Network Error (${timestamp})</div>
          <div class="mt-1 p-2 bg-red-50 rounded text-xs">
            ${error.message}
          </div>
        `;
      } finally {
        // Reset button state
        runBtn.disabled = false;
        runBtn.textContent = "Run Node";
      }
    }

    // Helper function to update output fields
    function updateOutputFields(resultData, nodeId) {
      const outputFields = document.querySelectorAll('[data-output="true"]');
      const updatedOutputs = {};

      outputFields.forEach((field) => {
        const key = field.getAttribute("data-key");
        if (resultData.hasOwnProperty(key)) {
          const value = resultData[key];
          if (field.tagName === "TEXTAREA") {
            field.value =
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : value;
          } else {
            field.value = value;
          }
          updatedOutputs[key] = value;
        }
      });

      // Update node data with new outputs to propagate to connected nodes
      if (Object.keys(updatedOutputs).length > 0 && nodeId) {
        // Get current node data
        const node = window.WorkflowEditor?.getNodeById?.(nodeId);
        if (node) {
          const currentValues = node.data?.values || {};
          const newData = {
            values: currentValues,
            outputs: Object.assign(
              {},
              node.data?.outputs || {},
              updatedOutputs
            ),
          };
          window.WorkflowEditor?.updateNodeData(nodeId, newData);
        }
      }
    }

    // Helper function to add execution to history
    function addToExecutionHistory(timestamp, success, data, historyDiv) {
      if (!historyDiv) return;

      const historyItem = document.createElement("div");
      historyItem.className = `mb-2 p-2 rounded text-xs border-l-4 ${
        success ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
      }`;

      const dataDisplay = success
        ? `<pre class="whitespace-pre-wrap mt-1">${JSON.stringify(
            data,
            null,
            2
          )}</pre>`
        : `<div class="text-red-600 mt-1">${data}</div>`;

      historyItem.innerHTML = `
        <div class="font-medium ${success ? "text-green-700" : "text-red-700"}">
          ${success ? "✓" : "✗"} ${timestamp}
        </div>
        ${dataDisplay}
      `;

      // Add to top of history
      historyDiv.insertBefore(historyItem, historyDiv.firstChild);

      // Limit history to last 10 items
      while (historyDiv.children.length > 10) {
        historyDiv.removeChild(historyDiv.lastChild);
      }
    }

    // Helper function to get currently selected node ID from panel
    function getCurrentSelectedNodeId() {
      const runBtn = document.getElementById("run-node-btn");
      return runBtn?.getAttribute("data-node-id") || null;
    }

    // Helper function to refresh input fields with new values
    function refreshInputFields(newValues) {
      Object.keys(newValues).forEach((key) => {
        const inputField = document.querySelector(
          `input[data-key="${key}"]:not([data-output]), textarea[data-key="${key}"]:not([data-output])`
        );
        if (inputField) {
          if (inputField.type === "checkbox") {
            inputField.checked = newValues[key];
          } else {
            inputField.value = newValues[key];
          }
          // Trigger input event to update the node data
          inputField.dispatchEvent(new Event("input"));
        }
      });
    }

    function openPanelForNode(detail) {
      if (!detail || !detail.data?.info) {
        panel?.classList.add("hidden");
        formRoot.innerHTML = "";
        return;
      }
      const info = detail.data.info;
      const inputs = info?.inputs?.properties || {};
      const outputs = info?.outputs?.properties || {};
      const currentValues = detail.data.values || {};
      const currentOutputs = detail.data.outputs || {};

      // Render input fields
      const inputFieldsHtml = Object.keys(inputs)
        .map((k) => renderField(k, inputs[k], currentValues[k], false))
        .join("");

      // Render output fields
      const outputFieldsHtml = Object.keys(outputs)
        .map((k) => renderField(k, outputs[k], currentOutputs[k], true))
        .join("");

      // Add execution button if the node has an ID
      const nodeId = info.id;
      const runButtonHtml = nodeId
        ? `<div class="mt-4 pt-4 border-t border-gray-200">
             <button id="run-node-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded transition-colors">
               Run Node
             </button>
             <div id="execution-result" class="mt-2 text-xs"></div>
           </div>`
        : "";

      // Add execution history section
      const historyHtml = nodeId
        ? `<div class="mt-4 pt-4 border-t border-gray-200">
             <div class="text-xs font-medium mb-2 text-gray-600">Execution History</div>
             <div id="execution-history" class="max-h-48 overflow-y-auto"></div>
           </div>`
        : "";

      const sectionsHtml = `
        ${
          inputFieldsHtml
            ? `<div class="mb-4">
          <div class="text-sm font-medium mb-2 text-blue-600">Inputs</div>
          ${inputFieldsHtml}
        </div>`
            : ""
        }
        ${
          outputFieldsHtml
            ? `<div class="mb-4">
          <div class="text-sm font-medium mb-2 text-purple-600">Outputs</div>
          ${outputFieldsHtml}
        </div>`
            : ""
        }
      `;

      formRoot.innerHTML =
        (sectionsHtml ||
          '<div class="text-xs opacity-70">설정할 필드가 없습니다.</div>') +
        runButtonHtml +
        historyHtml;
      panel?.classList.remove("hidden");

      // Add run button event listener
      const runBtn = formRoot.querySelector("#run-node-btn");
      if (runBtn && nodeId) {
        runBtn.setAttribute("data-node-id", detail.id);
        runBtn.addEventListener("click", async () => {
          await executeNode(nodeId, currentValues, detail);
        });
      }

      // bind change for input fields
      formRoot
        .querySelectorAll(
          "input:not([data-output]), textarea:not([data-output])"
        )
        .forEach((el) => {
          el.addEventListener("input", (e) => {
            const key = el.getAttribute("data-key");
            const schema = inputs[key] || {};
            let val = el.type === "checkbox" ? el.checked : el.value;
            if (
              (schema.type === "integer" || schema.type === "number") &&
              el.value !== ""
            ) {
              val = Number(val);
            }
            // Update current values for execution
            currentValues[key] = val;

            const newData = {
              values: Object.assign({}, currentValues, { [key]: val }),
            };
            window.WorkflowEditor?.updateNodeData(detail.id, newData);
          });
          el.addEventListener("change", (e) =>
            el.dispatchEvent(new Event("input"))
          );
        });

      // bind change for output fields
      formRoot
        .querySelectorAll("input[data-output], textarea[data-output]")
        .forEach((el) => {
          el.addEventListener("input", (e) => {
            const key = el.getAttribute("data-key");
            let val = el.value;

            // Try to parse JSON for textarea outputs
            if (el.tagName === "TEXTAREA") {
              try {
                val = JSON.parse(el.value);
              } catch (e) {
                // Keep as string if not valid JSON
              }
            }

            // Update current outputs
            currentOutputs[key] = val;

            const newData = {
              values: currentValues,
              outputs: Object.assign({}, currentOutputs, { [key]: val }),
            };
            window.WorkflowEditor?.updateNodeData(detail.id, newData);
          });
          el.addEventListener("change", (e) =>
            el.dispatchEvent(new Event("input"))
          );
        });
    }

    window.addEventListener("workflow:nodeSelected", (e) =>
      openPanelForNode(e.detail)
    );

    // Handle node data updates (for connected input propagation)
    window.addEventListener("workflow:nodeDataUpdated", (e) => {
      const { nodeId, data } = e.detail;

      // If the currently selected node panel is open and it's for this node, refresh the inputs
      if (panel && !panel.classList.contains("hidden")) {
        const currentNodeId = getCurrentSelectedNodeId();
        if (currentNodeId === nodeId) {
          // Refresh input fields with new values
          refreshInputFields(data.values || {});
        }
      }
    });

    // Handle connection creation (propagate initial values)
    window.addEventListener("workflow:connectionCreated", (e) => {
      const connection = e.detail;

      // If the target node panel is currently open, refresh it
      if (panel && !panel.classList.contains("hidden")) {
        const currentNodeId = getCurrentSelectedNodeId();
        if (currentNodeId === connection.to.node) {
          // Find the target node and refresh the panel
          const targetNode = window.WorkflowEditor?.getNodeById?.(
            connection.to.node
          );
          if (targetNode) {
            openPanelForNode({
              id: targetNode.id,
              data: targetNode.data || {},
            });
          }
        }
      }
    });

    // Load workflow from server if URL contains ?wf=ID
    const params = new URLSearchParams(location.search);
    const wfId = params.get("wf");
    if (wfId) {
      const saved = await loadFromServer(wfId);
      if (saved?.data?.custom_editor && window.WorkflowEditor) {
        await window.WorkflowEditor.fromJSON(saved.data.custom_editor);
      } else if (saved?.data?.litegraph && window.WorkflowEditor) {
        // Backward compatibility with LiteGraph data
        console.warn(
          "Found legacy LiteGraph data, but using custom editor now"
        );
      } else if (saved?.data?.drawflow && window.WorkflowEditor) {
        // Backward compatibility with old Drawflow data
        console.warn("Found legacy Drawflow data, but using custom editor now");
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
