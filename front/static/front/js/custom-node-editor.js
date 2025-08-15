// Pure JavaScript Node Editor (no external libraries)
// Inspired by workflow-editor-example.js but with modern improvements

(function () {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  // Canvas is now the main container - no need for separate viewport
  canvas.style.cssText += `
    user-select: none;
    position: relative;
  `;

  // Node Editor State
  let nodes = [];
  let connections = [];
  let nextNodeId = 1;
  let isConnecting = false;
  let connectionStart = null;
  let selectedNodes = [];
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let canvasOffset = { x: 0, y: 0 };
  let scale = 1;

  // Type styling mapping
  const TYPE_STYLE = {
    input: { color: "#10b981", icon: "⬅️", bgColor: "#10b98120" },
    process: { color: "#3b82f6", icon: "⚙️", bgColor: "#3b82f620" },
    output: { color: "#8b5cf6", icon: "➡️", bgColor: "#8b5cf620" },
    data: { color: "#f59e0b", icon: "🗄️", bgColor: "#f59e0b20" },
    utility: { color: "#6b7280", icon: "🧩", bgColor: "#6b728020" },
  };

  function createNode(info, x = 100, y = 100) {
    const nodeId = `node-${nextNodeId++}`;
    const typeStyle =
      TYPE_STYLE[info.type?.toLowerCase()] || TYPE_STYLE.utility;

    const inputProps = Object.keys(info?.inputs?.properties || {});
    const outputProps = Object.keys(info?.outputs?.properties || {});

    const node = {
      id: nodeId,
      info,
      x,
      y,
      width: 200,
      height: Math.max(
        120,
        60 + Math.max(inputProps.length, outputProps.length) * 24
      ),
      inputs: inputProps,
      outputs: outputProps,
      data: { info, values: {} },
      selected: false,
    };

    nodes.push(node);
    renderNode(node);
    window.dispatchEvent(new CustomEvent("workflow:changed"));
    return nodeId;
  }

  function renderNode(node) {
    const typeStyle =
      TYPE_STYLE[node.info.type?.toLowerCase()] || TYPE_STYLE.utility;

    const nodeElement = document.createElement("div");
    nodeElement.id = node.id;
    nodeElement.className =
      "absolute bg-white rounded-lg shadow-lg border-2 cursor-move select-none";
    nodeElement.style.cssText = `
      left: ${node.x}px;
      top: ${node.y}px;
      width: ${node.width}px;
      min-height: ${node.height}px;
      border-color: ${typeStyle.color};
      z-index: 10;
    `;

    // Node header
    const header = document.createElement("div");
    header.className =
      "flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold rounded-t-md";
    header.style.backgroundColor = typeStyle.color;
    header.innerHTML = `
      <span>${typeStyle.icon}</span>
      <span>${node.info.name || "Node"}</span>
    `;

    // Node body
    const body = document.createElement("div");
    body.className = "p-3";

    // Category and description
    const meta = document.createElement("div");
    meta.className = "mb-2";
    meta.innerHTML = `
      <div class="text-xs text-gray-600">#${node.info.category || ""}</div>
      ${
        node.info.description
          ? `<div class="text-xs text-gray-500 mt-1">${node.info.description}</div>`
          : ""
      }
    `;

    // Inputs and outputs
    const ioContainer = document.createElement("div");
    ioContainer.className = "grid grid-cols-2 gap-2";

    // Inputs column
    const inputsColumn = document.createElement("div");
    inputsColumn.innerHTML = `
      <div class="text-xs font-semibold text-gray-700 mb-1">Inputs</div>
      ${
        node.inputs
          .map(
            (input, i) => `
        <div class="flex items-center text-xs text-gray-600 mb-1">
          <div class="input-socket w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-pointer" 
               data-node="${node.id}" data-port="${input}" data-index="${i}"
               style="background: ${typeStyle.color}; margin-right: 6px;"></div>
          ${input}
        </div>
      `
          )
          .join("") || '<div class="text-xs text-gray-400">-</div>'
      }
    `;

    // Outputs column
    const outputsColumn = document.createElement("div");
    outputsColumn.className = "text-right";
    outputsColumn.innerHTML = `
      <div class="text-xs font-semibold text-gray-700 mb-1">Outputs</div>
      ${
        node.outputs
          .map(
            (output, i) => `
        <div class="flex items-center justify-end text-xs text-gray-600 mb-1">
          ${output}
          <div class="output-socket w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-pointer" 
               data-node="${node.id}" data-port="${output}" data-index="${i}"
               style="background: ${typeStyle.color}; margin-left: 6px;"></div>
        </div>
      `
          )
          .join("") || '<div class="text-xs text-gray-400">-</div>'
      }
    `;

    ioContainer.appendChild(inputsColumn);
    ioContainer.appendChild(outputsColumn);

    body.appendChild(meta);
    body.appendChild(ioContainer);

    nodeElement.appendChild(header);
    nodeElement.appendChild(body);

    // Control buttons (show on hover)
    const controls = document.createElement("div");
    controls.className = "absolute flex gap-1 opacity-0 transition-opacity";
    controls.style.cssText = "top: -8px; right: -8px;";
    controls.innerHTML = `
      <button class="duplicate-btn w-6 h-6 bg-blue-500 text-white rounded-full text-xs shadow-md hover:bg-blue-600" title="Duplicate">⎘</button>
      <button class="delete-btn w-6 h-6 bg-red-500 text-white rounded-full text-xs shadow-md hover:bg-red-600" title="Delete">×</button>
    `;

    nodeElement.appendChild(controls);

    // Event listeners
    bindNodeEvents(nodeElement, node);

    canvas.appendChild(nodeElement);
  }

  function bindNodeEvents(element, node) {
    const header = element.querySelector("div:first-child");
    const controls = element.querySelector(".absolute.flex");

    // Node selection and dragging
    header.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectNode(node, !e.ctrlKey && !e.metaKey);
      startDragging(e, node);
    });

    // Show/hide controls on hover
    element.addEventListener("mouseenter", () => {
      if (controls) controls.style.opacity = "1";
    });
    element.addEventListener("mouseleave", () => {
      if (controls) controls.style.opacity = "0";
    });

    // Control buttons
    const duplicateBtn = element.querySelector(".duplicate-btn");
    const deleteBtn = element.querySelector(".delete-btn");

    duplicateBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      duplicateNode(node);
    });

    deleteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(node.id);
    });

    // Socket events
    element.querySelectorAll(".input-socket").forEach((socket) => {
      socket.addEventListener("mouseup", (e) => {
        e.stopPropagation();
        if (isConnecting) {
          const nodeId = socket.dataset.node;
          const port = socket.dataset.port;
          endConnection(nodeId, port, "input");
        }
      });
    });

    element.querySelectorAll(".output-socket").forEach((socket) => {
      socket.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        const nodeId = socket.dataset.node;
        const port = socket.dataset.port;
        startConnection(nodeId, port, "output", e);
      });
    });

    // Node click for selection
    element.addEventListener("click", (e) => {
      if (!isDragging) {
        selectNode(node, !e.ctrlKey && !e.metaKey);
      }
    });
  }

  function selectNode(node, clearOthers = true) {
    if (clearOthers) {
      selectedNodes.forEach((n) => {
        n.selected = false;
        updateNodeSelection(n);
      });
      selectedNodes = [];
    }

    if (!node.selected) {
      node.selected = true;
      selectedNodes.push(node);
      updateNodeSelection(node);

      // Emit selection event
      const detail = {
        id: node.id,
        data: node.data || {},
        name: node.info?.name || "Node",
      };
      window.dispatchEvent(
        new CustomEvent("workflow:nodeSelected", { detail })
      );
    }
  }

  function updateNodeSelection(node) {
    const element = document.getElementById(node.id);
    if (element) {
      if (node.selected) {
        element.style.boxShadow = "0 0 0 2px #3b82f6";
      } else {
        element.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
      }
    }
  }

  function startDragging(e, node) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left - node.x;
    dragOffset.y = e.clientY - rect.top - node.y;

    function onMouseMove(e) {
      if (!isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      selectedNodes.forEach((selectedNode) => {
        const deltaX = newX - node.x;
        const deltaY = newY - node.y;
        selectedNode.x += deltaX;
        selectedNode.y += deltaY;
        updateNodePosition(selectedNode);
      });

      updateConnections();
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.dispatchEvent(new CustomEvent("workflow:changed"));
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function updateNodePosition(node) {
    const element = document.getElementById(node.id);
    if (element) {
      element.style.left = node.x + "px";
      element.style.top = node.y + "px";
    }
  }

  function duplicateNode(node) {
    const newX = node.x + 30;
    const newY = node.y + 30;
    createNode(node.info, newX, newY);
  }

  function deleteNode(nodeId) {
    // Remove connections
    connections = connections.filter(
      (conn) => conn.from.node !== nodeId && conn.to.node !== nodeId
    );

    // Remove from selected nodes
    selectedNodes = selectedNodes.filter((n) => n.id !== nodeId);

    // Remove node
    nodes = nodes.filter((n) => n.id !== nodeId);

    // Remove DOM element
    const element = document.getElementById(nodeId);
    if (element) element.remove();

    updateConnections();
    window.dispatchEvent(new CustomEvent("workflow:changed"));

    // Clear selection if this was the only selected node
    if (selectedNodes.length === 0) {
      window.dispatchEvent(
        new CustomEvent("workflow:nodeSelected", { detail: null })
      );
    }
  }

  function startConnection(nodeId, port, type, event) {
    isConnecting = true;
    connectionStart = { node: nodeId, port: port, type: type };

    // Visual feedback
    document.body.style.cursor = "crosshair";
  }

  function endConnection(nodeId, port, type) {
    if (!isConnecting || !connectionStart) return;

    // Check if connection is valid (output to input)
    if (connectionStart.type === "output" && type === "input") {
      if (connectionStart.node !== nodeId) {
        const connection = {
          id: `conn-${Date.now()}`,
          from: { node: connectionStart.node, port: connectionStart.port },
          to: { node: nodeId, port: port },
        };

        // Check for duplicate connections
        const exists = connections.some(
          (conn) =>
            conn.from.node === connection.from.node &&
            conn.from.port === connection.from.port &&
            conn.to.node === connection.to.node &&
            conn.to.port === connection.to.port
        );

        if (!exists) {
          connections.push(connection);
          updateConnections();

          // Propagate output values to connected inputs
          propagateConnectionData(connection);

          window.dispatchEvent(new CustomEvent("workflow:changed"));
          window.dispatchEvent(
            new CustomEvent("workflow:connectionCreated", {
              detail: connection,
            })
          );
        }
      }
    }

    resetConnectionState();
  }

  function resetConnectionState() {
    isConnecting = false;
    connectionStart = null;
    document.body.style.cursor = "default";
  }

  // Propagate data from output node to input node through connection
  function propagateConnectionData(connection) {
    const fromNode = nodes.find((n) => n.id === connection.from.node);
    const toNode = nodes.find((n) => n.id === connection.to.node);

    if (!fromNode || !toNode) return;

    // Get output value from source node
    const outputValue = fromNode.data?.outputs?.[connection.from.port];

    if (outputValue !== undefined) {
      // Update input value in target node
      if (!toNode.data) toNode.data = {};
      if (!toNode.data.values) toNode.data.values = {};

      toNode.data.values[connection.to.port] = outputValue;

      // Dispatch event to update UI
      window.dispatchEvent(
        new CustomEvent("workflow:nodeDataUpdated", {
          detail: { nodeId: toNode.id, data: toNode.data },
        })
      );
    }
  }

  // Propagate data for all connections from a specific node's output
  function propagateFromNodeOutput(nodeId, outputPort, value) {
    const relatedConnections = connections.filter(
      (conn) => conn.from.node === nodeId && conn.from.port === outputPort
    );

    relatedConnections.forEach((connection) => {
      const toNode = nodes.find((n) => n.id === connection.to.node);
      if (toNode) {
        if (!toNode.data) toNode.data = {};
        if (!toNode.data.values) toNode.data.values = {};

        toNode.data.values[connection.to.port] = value;

        // Dispatch event to update UI
        window.dispatchEvent(
          new CustomEvent("workflow:nodeDataUpdated", {
            detail: { nodeId: toNode.id, data: toNode.data },
          })
        );
      }
    });
  }

  function updateConnections() {
    // Remove existing connection lines
    canvas
      .querySelectorAll(".connection-line")
      .forEach((line) => line.remove());

    // Draw all connections
    connections.forEach((conn) => drawConnection(conn));
  }

  function drawConnection(connection) {
    const fromElement = document.querySelector(
      `[data-node="${connection.from.node}"][data-port="${connection.from.port}"].output-socket`
    );
    const toElement = document.querySelector(
      `[data-node="${connection.to.node}"][data-port="${connection.to.port}"].input-socket`
    );

    if (!fromElement || !toElement) return;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const fromX = fromRect.left - canvasRect.left + fromRect.width / 2;
    const fromY = fromRect.top - canvasRect.top + fromRect.height / 2;
    const toX = toRect.left - canvasRect.left + toRect.width / 2;
    const toY = toRect.top - canvasRect.top + toRect.height / 2;

    const line = document.createElement("div");
    line.className = "connection-line absolute pointer-events-none";
    line.style.cssText = `
      left: ${Math.min(fromX, toX)}px;
      top: ${Math.min(fromY, toY)}px;
      width: ${Math.abs(toX - fromX)}px;
      height: ${Math.abs(toY - fromY)}px;
      z-index: 1;
    `;

    // Create SVG for the connection line
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText = "width: 100%; height: 100%; position: absolute;";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const startX = fromX > toX ? Math.abs(toX - fromX) : 0;
    const startY = fromY > toY ? Math.abs(toY - fromY) : 0;
    const endX = toX > fromX ? Math.abs(toX - fromX) : 0;
    const endY = toY > fromY ? Math.abs(toY - fromY) : 0;

    const controlPoint1X = startX + (endX - startX) * 0.5;
    const controlPoint2X = startX + (endX - startX) * 0.5;

    path.setAttribute(
      "d",
      `M ${startX} ${startY} C ${controlPoint1X} ${startY} ${controlPoint2X} ${endY} ${endX} ${endY}`
    );
    path.setAttribute("stroke", "#64748b");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    path.style.cursor = "pointer";

    // Click to delete connection
    path.addEventListener("click", () => {
      removeConnection(connection.id);
    });

    svg.appendChild(path);
    line.appendChild(svg);
    canvas.appendChild(line);
  }

  function removeConnection(connectionId) {
    connections = connections.filter((conn) => conn.id !== connectionId);
    updateConnections();
    window.dispatchEvent(new CustomEvent("workflow:changed"));
  }

  // Canvas events
  canvas.addEventListener("click", (e) => {
    if (e.target === canvas) {
      // Clear selection
      selectedNodes.forEach((n) => {
        n.selected = false;
        updateNodeSelection(n);
      });
      selectedNodes = [];
      window.dispatchEvent(
        new CustomEvent("workflow:nodeSelected", { detail: null })
      );
    }

    if (isConnecting) {
      resetConnectionState();
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("workflow:changed"));
    } else if (selectedNodes.length > 0 && e.key === "Delete") {
      e.preventDefault();
      selectedNodes.forEach((node) => deleteNode(node.id));
    } else if (
      selectedNodes.length > 0 &&
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === "d"
    ) {
      e.preventDefault();
      selectedNodes.forEach((node) => duplicateNode(node));
    }
  });

  // Public API
  function addNodeFromInfo(info, position) {
    return createNode(info, position.x, position.y);
  }

  function clear() {
    nodes = [];
    connections = [];
    selectedNodes = [];
    nextNodeId = 1;
    canvas.innerHTML = "";
    window.dispatchEvent(new CustomEvent("workflow:changed"));
  }

  function toJSON() {
    return {
      nodes: nodes.map((n) => ({ ...n, selected: undefined })),
      connections: connections,
    };
  }

  function fromJSON(data) {
    if (data && data.nodes) {
      clear();
      data.nodes.forEach((nodeData) => {
        const node = { ...nodeData };
        nodes.push(node);
        renderNode(node);
      });
      if (data.connections) {
        connections = [...data.connections];
        updateConnections();
      }
      window.dispatchEvent(new CustomEvent("workflow:changed"));
    }
  }

  function center() {
    if (nodes.length > 0) {
      const centerX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
      const centerY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;

      const canvasRect = canvas.getBoundingClientRect();
      const offsetX = canvasRect.width / 2 - centerX;
      const offsetY = canvasRect.height / 2 - centerY;

      // For now, just ensure all nodes are visible
      // In future, we could implement pan/zoom
    }
  }
  function getSelectedNode() {
    if (selectedNodes.length === 0) return null;
    const node = selectedNodes[0];
    return {
      id: node.id,
      node: node,
      data: node.data || {},
    };
  }

  function updateNodeData(id, newData) {
    const node = nodes.find((n) => n.id === id);
    if (node) {
      const oldOutputs = node.data?.outputs || {};
      node.data = Object.assign({}, node.data, newData);
      const newOutputs = node.data?.outputs || {};

      // Check if any output values changed and propagate to connected nodes
      Object.keys(newOutputs).forEach((outputPort) => {
        if (oldOutputs[outputPort] !== newOutputs[outputPort]) {
          propagateFromNodeOutput(id, outputPort, newOutputs[outputPort]);
        }
      });

      window.dispatchEvent(new CustomEvent("workflow:changed"));
    }
  }

  // Export API
  window.WorkflowEditor = {
    addNodeFromInfo,
    clear,
    toJSON,
    fromJSON,
    center,
    getSelectedNode,
    updateNodeData,
    getNodeById: (id) => nodes.find((n) => n.id === id),
    // Additional utilities
    nodes: () => nodes,
    connections: () => connections,
    selectedNodes: () => selectedNodes,
  };
})();
