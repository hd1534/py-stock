// Workflow Editor using Rete.js
class WorkflowEditor {
  constructor() {
    this.editor = null;
    this.currentWorkflowId = null;
    this.nodeTemplates = {
      "stock-data": {
        name: "📊 주가 데이터",
        category: "input",
        color: "#10b981",
      },
      "news-crawler": {
        name: "📰 뉴스 크롤링",
        category: "input",
        color: "#10b981",
      },
      "financial-data": {
        name: "📋 재무제표",
        category: "input",
        color: "#10b981",
      },
      "technical-analysis": {
        name: "📈 기술적 분석",
        category: "process",
        color: "#3b82f6",
      },
      "sentiment-analysis": {
        name: "💭 감정 분석",
        category: "process",
        color: "#3b82f6",
      },
      "data-filter": {
        name: "🔍 데이터 필터",
        category: "process",
        color: "#3b82f6",
      },
      "report-generator": {
        name: "📄 리포트 생성",
        category: "output",
        color: "#8b5cf6",
      },
      "chart-visualization": {
        name: "📊 차트 시각화",
        category: "output",
        color: "#8b5cf6",
      },
    };
    this.init();
  }

  async init() {
    try {
      await this.initializeEditor();
      this.bindEvents();
      console.log("Workflow Editor initialized successfully");
    } catch (error) {
      console.error("Failed to initialize editor:", error);
      showNotification("에디터 초기화에 실패했습니다.", "error");
    }
  }

  async initializeEditor() {
    const container = document.getElementById("rete-container");
    if (!container) {
      throw new Error("Rete container not found");
    }

    // Create a simple div-based node system instead of Rete.js
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.background = "#f8fafc";

    this.createSimpleNodeSystem();
  }
  createSimpleNodeSystem() {
    const container = document.getElementById("rete-container");
    container.innerHTML = `
            <div class="h-full w-full bg-gray-50 relative overflow-hidden" id="canvas">
                <div class="absolute inset-0 bg-gray-100 opacity-20" style="
                    background-image: radial-gradient(circle, #000 1px, transparent 1px);
                    background-size: 20px 20px;
                "></div>
                <div class="absolute top-4 left-4 text-sm text-gray-500">
                    사이드바에서 노드를 드래그하여 워크플로우를 구성하세요
                </div>
            </div>
        `;

    this.nodes = [];
    this.connections = [];
    this.nextNodeId = 1;
    this.isConnecting = false;
    this.connectionStart = null;

    this.makeDraggable();
  }

  makeDraggable() {
    $(".node-template").draggable({
      helper: "clone",
      appendTo: "body",
      zIndex: 1000,
      start: function (event, ui) {
        ui.helper.addClass("dragging");
      },
    });

    $("#canvas").droppable({
      accept: ".node-template",
      drop: (event, ui) => {
        const nodeType = ui.draggable.data("type");
        const offset = $("#canvas").offset();
        const x = event.pageX - offset.left;
        const y = event.pageY - offset.top;

        this.createNode(nodeType, x, y);
      },
    });
  }

  createNode(type, x, y) {
    const template = this.nodeTemplates[type];
    if (!template) return;

    const nodeId = `node-${this.nextNodeId++}`;
    const node = {
      id: nodeId,
      type: type,
      name: template.name,
      x: x,
      y: y,
      inputs: this.getNodeInputs(type),
      outputs: this.getNodeOutputs(type),
    };

    this.nodes.push(node);
    this.renderNode(node);
    this.updateCounts();
  }

  getNodeInputs(type) {
    const inputConfigs = {
      "stock-data": [],
      "news-crawler": [],
      "financial-data": [],
      "technical-analysis": ["data"],
      "sentiment-analysis": ["news"],
      "data-filter": ["data"],
      "report-generator": ["analysis", "sentiment"],
      "chart-visualization": ["data"],
    };
    return inputConfigs[type] || [];
  }

  getNodeOutputs(type) {
    const outputConfigs = {
      "stock-data": ["price_data"],
      "news-crawler": ["news_data"],
      "financial-data": ["financial_data"],
      "technical-analysis": ["indicators"],
      "sentiment-analysis": ["sentiment_score"],
      "data-filter": ["filtered_data"],
      "report-generator": ["report"],
      "chart-visualization": ["chart"],
    };
    return outputConfigs[type] || [];
  }

  renderNode(node) {
    const template = this.nodeTemplates[node.type];
    const nodeHtml = `
            <div class="rete-node" id="${node.id}" style="
                position: absolute;
                left: ${node.x}px;
                top: ${node.y}px;
                background: white;
                border: 2px solid ${template.color};
                border-radius: 8px;
                min-width: 160px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                cursor: move;
            ">
                <div class="rete-node-title" style="
                    background: ${template.color};
                    color: white;
                    padding: 8px 12px;
                    font-weight: 600;
                    font-size: 12px;
                    border-radius: 6px 6px 0 0;
                ">${node.name}</div>
                <div class="node-content" style="padding: 12px;">
                    <div class="inputs">
                        ${node.inputs
                          .map(
                            (input) => `
                            <div class="input-socket" data-input="${input}" style="
                                margin: 4px 0;
                                font-size: 11px;
                                color: #666;
                            ">
                                <span class="socket input-socket-dot" data-node="${node.id}" data-port="${input}" style="
                                    display: inline-block;
                                    width: 12px;
                                    height: 12px;
                                    background: ${template.color};
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    margin-right: 6px;
                                    cursor: pointer;
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                                "></span>
                                ${input}
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                    <div class="outputs" style="text-align: right;">
                        ${node.outputs
                          .map(
                            (output) => `
                            <div class="output-socket" data-output="${output}" style="
                                margin: 4px 0;
                                font-size: 11px;
                                color: #666;
                            ">
                                ${output}
                                <span class="socket output-socket-dot" data-node="${node.id}" data-port="${output}" style="
                                    display: inline-block;
                                    width: 12px;
                                    height: 12px;
                                    background: ${template.color};
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    margin-left: 6px;
                                    cursor: pointer;
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                                "></span>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>
                <button class="delete-node" style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 20px;
                    height: 20px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    font-size: 12px;
                    cursor: pointer;
                    display: none;
                " onclick="workflowEditor.deleteNode('${
                  node.id
                }')">&times;</button>
            </div>
        `;

    $("#canvas").append(nodeHtml);

    // Make node draggable
    $(`#${node.id}`).draggable({
      containment: "#canvas",
      drag: (event, ui) => {
        node.x = ui.position.left;
        node.y = ui.position.top;
        this.updateConnections();
      },
    });

    // Show delete button on hover
    $(`#${node.id}`).hover(
      function () {
        $(this).find(".delete-node").show();
      },
      function () {
        $(this).find(".delete-node").hide();
      }
    );

    // Add connection event handlers
    this.bindConnectionEvents(node.id);
  }

  deleteNode(nodeId) {
    // Remove connections related to this node
    this.connections = this.connections.filter(
      (conn) => conn.from.node !== nodeId && conn.to.node !== nodeId
    );

    this.nodes = this.nodes.filter((node) => node.id !== nodeId);
    $(`#${nodeId}`).remove();
    this.updateCounts();
    this.updateConnections();
  }

  bindConnectionEvents(nodeId) {
    // Output socket click handler
    $(`#${nodeId} .output-socket-dot`).on("mousedown", (e) => {
      e.stopPropagation();
      const nodeId = $(e.target).data("node");
      const port = $(e.target).data("port");

      this.startConnection(nodeId, port, "output", e);
    });

    // Input socket click handler
    $(`#${nodeId} .input-socket-dot`).on("mouseup", (e) => {
      e.stopPropagation();
      if (this.isConnecting) {
        const nodeId = $(e.target).data("node");
        const port = $(e.target).data("port");

        this.endConnection(nodeId, port, "input");
      }
    });

    // Socket hover effects
    $(`#${nodeId} .socket`).hover(
      function () {
        $(this).css("transform", "scale(1.2)");
      },
      function () {
        $(this).css("transform", "scale(1)");
      }
    );
  }

  startConnection(nodeId, port, type, event) {
    this.isConnecting = true;
    this.connectionStart = { node: nodeId, port: port, type: type };

    // Visual feedback
    $("body").addClass("connecting");
    $(event.target).addClass("connecting-start");

    showNotification("입력 소켓에 연결하세요", "info");
  }

  endConnection(nodeId, port, type) {
    if (!this.isConnecting || !this.connectionStart) return;

    // Check if connection is valid (output to input)
    if (this.connectionStart.type === "output" && type === "input") {
      if (this.connectionStart.node !== nodeId) {
        const connection = {
          id: `conn-${Date.now()}`,
          from: {
            node: this.connectionStart.node,
            port: this.connectionStart.port,
          },
          to: { node: nodeId, port: port },
        };

        // Check for duplicate connections
        const exists = this.connections.some(
          (conn) =>
            conn.from.node === connection.from.node &&
            conn.from.port === connection.from.port &&
            conn.to.node === connection.to.node &&
            conn.to.port === connection.to.port
        );

        if (!exists) {
          this.connections.push(connection);
          this.updateConnections();
          showNotification("연결이 생성되었습니다", "success");
        } else {
          showNotification("이미 연결된 포트입니다", "warning");
        }
      } else {
        showNotification("같은 노드끼리는 연결할 수 없습니다", "warning");
      }
    }

    this.resetConnectionState();
  }

  resetConnectionState() {
    this.isConnecting = false;
    this.connectionStart = null;
    $("body").removeClass("connecting");
    $(".connecting-start").removeClass("connecting-start");
  }

  updateConnections() {
    // Remove existing connection lines
    $("#canvas .connection-line").remove();

    // Draw all connections
    this.connections.forEach((conn) => {
      this.drawConnection(conn);
    });
  }

  drawConnection(connection) {
    const fromSocket = $(
      `#${connection.from.node} .output-socket-dot[data-port="${connection.from.port}"]`
    );
    const toSocket = $(
      `#${connection.to.node} .input-socket-dot[data-port="${connection.to.port}"]`
    );

    if (fromSocket.length === 0 || toSocket.length === 0) return;

    const fromPos = this.getSocketPosition(fromSocket);
    const toPos = this.getSocketPosition(toSocket);

    const line = this.createConnectionLine(fromPos, toPos, connection.id);
    $("#canvas").append(line);
  }

  getSocketPosition(socket) {
    const offset = socket.offset();
    const canvasOffset = $("#canvas").offset();

    return {
      x: offset.left - canvasOffset.left + socket.width() / 2,
      y: offset.top - canvasOffset.top + socket.height() / 2,
    };
  }

  createConnectionLine(from, to, connectionId) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return $(`
      <div class="connection-line" data-connection="${connectionId}" style="
        position: absolute;
        left: ${from.x}px;
        top: ${from.y}px;
        width: ${length}px;
        height: 2px;
        background: #64748b;
        transform-origin: 0 50%;
        transform: rotate(${angle}deg);
        z-index: 1;
        cursor: pointer;
      "></div>
    `).on("click", () => this.removeConnection(connectionId));
  }

  removeConnection(connectionId) {
    this.connections = this.connections.filter(
      (conn) => conn.id !== connectionId
    );
    this.updateConnections();
    this.updateCounts();
    showNotification("연결이 제거되었습니다", "info");
  }

  updateCounts() {
    $("#node-count").text(`노드: ${this.nodes.length}개`);
    $("#connection-count").text(`연결: ${this.connections.length}개`);
  }

  updateNextNodeId() {
    // Find the highest node ID number and set nextNodeId accordingly
    let maxId = 0;
    this.nodes.forEach((node) => {
      if (node.id && node.id.startsWith("node-")) {
        const idNumber = parseInt(node.id.replace("node-", ""));
        if (!isNaN(idNumber) && idNumber > maxId) {
          maxId = idNumber;
        }
      }
    });
    this.nextNodeId = maxId + 1;
    console.log(`Updated nextNodeId to: ${this.nextNodeId}`);
  }

  bindEvents() {
    // Save button
    $("#save-btn").click(() => this.showSaveModal());

    // Execute button
    $("#execute-btn").click(() => this.executeWorkflow());

    // Clear button
    $("#clear-btn").click(() => this.clearWorkflow());

    // Save modal events
    $("#save-cancel").click(() => this.hideSaveModal());
    $("#save-confirm").click(() => this.saveWorkflow());

    // Load workflow
    $(".saved-workflow").click((e) => {
      const workflowId = $(e.currentTarget).data("id");
      this.loadWorkflow(workflowId);
    });

    // Update workflow info
    $("#workflow-name, #workflow-description").on("input", () => {
      // Auto-update current workflow info
    });

    // Canvas click to cancel connection
    $("#canvas").on("click", (e) => {
      if (this.isConnecting && $(e.target).hasClass("connection-line")) {
        return; // Allow connection line clicks
      }
      if (this.isConnecting) {
        this.resetConnectionState();
        showNotification("연결이 취소되었습니다", "info");
      }
    });

    // Window resize handler
    $(window).on("resize", () => {
      this.updateConnections();
    });
  }

  showSaveModal() {
    $("#save-name").val($("#workflow-name").val());
    $("#save-description").val($("#workflow-description").val());
    $("#save-modal").removeClass("hidden").addClass("flex");
  }

  hideSaveModal() {
    $("#save-modal").addClass("hidden").removeClass("flex");
  }

  async saveWorkflow() {
    const name = $("#save-name").val().trim();
    const description = $("#save-description").val().trim();

    if (!name) {
      showNotification("워크플로우 이름을 입력해주세요.", "warning");
      return;
    }

    const workflowData = {
      id: this.currentWorkflowId,
      name: name,
      description: description,
      workflow_data: {
        nodes: this.nodes,
        connections: this.connections,
      },
    };

    try {
      const response = await $.ajax({
        url: "/save/",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(workflowData),
      });

      if (response.success) {
        this.currentWorkflowId = response.workflow_id;
        $("#workflow-name").val(name);
        $("#workflow-description").val(description);
        showNotification("워크플로우가 저장되었습니다.", "success");
        this.hideSaveModal();

        // Refresh saved workflows list
        location.reload();
      } else {
        showNotification(response.message, "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      showNotification("저장 중 오류가 발생했습니다.", "error");
    }
  }

  async loadWorkflow(workflowId) {
    try {
      const response = await $.ajax({
        url: `/${workflowId}/`,
        method: "GET",
      });

      if (response.success) {
        const workflow = response.workflow;

        $("#workflow-name").val(workflow.name);
        $("#workflow-description").val(workflow.description);

        // Clear current workflow first
        this.clearWorkflow();

        // Then set the workflow ID
        this.currentWorkflowId = workflow.id;

        // Load nodes
        if (workflow.workflow_data.nodes) {
          workflow.workflow_data.nodes.forEach((node) => {
            this.nodes.push(node);
            this.renderNode(node);
          });

          // Update nextNodeId to prevent ID conflicts
          this.updateNextNodeId();
        }

        // Load connections
        if (workflow.workflow_data.connections) {
          this.connections = workflow.workflow_data.connections;
        }

        this.updateCounts();
        this.updateConnections();
        showNotification(
          `워크플로우 "${workflow.name}"를 불러왔습니다.`,
          "success"
        );
      }
    } catch (error) {
      console.error("Load error:", error);
      showNotification("워크플로우 로드 중 오류가 발생했습니다.", "error");
    }
  }

  async executeWorkflow() {
    if (!this.currentWorkflowId) {
      showNotification("먼저 워크플로우를 저장해주세요.", "warning");
      return;
    }

    if (this.nodes.length === 0) {
      showNotification("실행할 노드가 없습니다.", "warning");
      return;
    }

    try {
      $("#execute-btn").prop("disabled", true).text("실행 중...");

      const response = await $.ajax({
        url: `/${this.currentWorkflowId}/execute/`,
        method: "POST",
      });

      if (response.success) {
        showNotification("워크플로우가 성공적으로 실행되었습니다.", "success");

        // 결과 페이지로 이동
        if (response.execution_id) {
          setTimeout(() => {
            window.location.href = `/execution/${response.execution_id}/`;
          }, 1000);
        }
      } else {
        showNotification(response.message, "error");
      }
    } catch (error) {
      console.error("Execute error:", error);
      showNotification("실행 중 오류가 발생했습니다.", "error");
    } finally {
      $("#execute-btn").prop("disabled", false).text("▶️ 실행");
    }
  }

  clearWorkflow() {
    this.nodes = [];
    this.connections = [];
    this.currentWorkflowId = null;
    this.nextNodeId = 1; // Reset node ID counter
    $("#canvas .rete-node").remove();
    $("#canvas .connection-line").remove();
    $("#workflow-name").val("");
    $("#workflow-description").val("");
    this.updateCounts();
    this.resetConnectionState();
  }
}

// Initialize editor when page loads
let workflowEditor;
$(document).ready(function () {
  workflowEditor = new WorkflowEditor();

  // Check for load parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const loadId = urlParams.get("load");
  if (loadId) {
    // Wait a bit for editor to initialize, then load workflow
    setTimeout(() => {
      workflowEditor.loadWorkflow(loadId);
    }, 500);
  }
});
