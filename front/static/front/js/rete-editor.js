// Rete.js editor bootstrap (v1 with Vue render plugin)
// Provides a basic editor with drag from sidebar to create nodes and simple persistence hooks.

(async function () {
  const container = document.getElementById("rete");
  if (!container) return;

  const { NodeEditor } = window.Rete;
  const ConnectionPlugin =
    window.ReteConnectionPlugin.default || window.ReteConnectionPlugin;
  const VueRenderPlugin =
    window.ReteVueRenderPlugin.default || window.ReteVueRenderPlugin;
  const AreaPlugin = window.ReteAreaPlugin.default || window.ReteAreaPlugin;

  const editor = new NodeEditor("workflow@0.1.0", container);
  editor.use(ConnectionPlugin);
  editor.use(VueRenderPlugin);
  editor.use(AreaPlugin);

  // Simple component to host nodes created from sidebar get_info()
  class GenericComponent extends Rete.Component {
    constructor(key) {
      super(key);
    }
    builder(node) {
      // No inputs/outputs here yet (Rete ports can be added once schema mapping is decided)
      return node;
    }
    worker() {}
  }

  // Registry to reuse components by node type/id
  const components = new Map();
  function getComponent(key) {
    if (!components.has(key)) components.set(key, new GenericComponent(key));
    return components.get(key);
  }

  // Expose minimal API for other scripts
  window.WorkflowEditor = {
    editor,
    addNodeFromInfo(info, position) {
      const comp = getComponent(info.id || info.name || "node");
      const node = comp.createNode({ info });
      node.position = [position.x || 0, position.y || 0];
      editor.addNode(node);
      editor.view.update();
      editor.trigger("process");
      return node;
    },
    clear() {
      editor.clear();
    },
    toJSON() {
      return editor.toJSON();
    },
    async fromJSON(data) {
      await editor.fromJSON(data);
      editor.view.update();
      editor.trigger("process");
    },
    center() {
      editor.view.area.transform = { k: 1, x: 0, y: 0 };
      editor.view.resize();
      editor.trigger("process");
    },
  };
})();
