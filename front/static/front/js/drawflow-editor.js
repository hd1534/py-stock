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
    const inList = inputProps
      .map((p) => `<li class=\"text-[10px]\">${p}</li>`)
      .join("");
    const outList = outputProps
      .map((p) => `<li class=\"text-[10px]\">${p}</li>`)
      .join("");
    const html = `
      <div class=\"p-2\">
        <div class=\"text-sm font-semibold\">${info.name}</div>
        <div class=\"text-xs opacity-80\">#${info.category || ""}</div>
        <div class=\"mt-1 grid grid-cols-2 gap-2\">
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
    window.dispatchEvent(new CustomEvent("workflow:changed"));
    return id;
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

  // Emit change events for autosave hooks
  const fire = () => window.dispatchEvent(new CustomEvent("workflow:changed"));
  editor.on("nodeCreated", fire);
  editor.on("nodeRemoved", fire);
  editor.on("nodeMoved", fire);
  editor.on("connectionCreated", fire);
  editor.on("connectionRemoved", fire);

  window.WorkflowEditor = {
    editor,
    addNodeFromInfo,
    clear,
    toJSON,
    fromJSON,
    center,
  };
})();
