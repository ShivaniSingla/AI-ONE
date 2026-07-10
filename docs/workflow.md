# Workflow Diagram

Place your workflow diagram here as `workflow.png`.

The diagram should illustrate:
1. User types a message in the popup or sidebar
2. content.js injects page context
3. shared/api.js sends POST /chat to the backend
4. router.py classifies the task
5. workflow.py runs the multi-step agent pipeline
6. Each step calls IBM Granite via granite.py
7. judge.py merges the outputs
8. The response streams back to the UI

**Recommended tool:** [Excalidraw](https://excalidraw.com/) or [draw.io](https://app.diagrams.net/)
