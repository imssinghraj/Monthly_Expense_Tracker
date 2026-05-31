import { answerFinanceQuestion } from "./assistant.js";
import { readJson } from "../utils/storage.js";

const TRACKER_KEY = "exp_tracker_v3";

function getContext() {
  const tracker = readJson(TRACKER_KEY, {});
  return {
    entries: tracker.entries || {},
    categories: tracker.customCats || {}
  };
}

function createWidget() {
  const widget = document.createElement("section");
  widget.className = "ai-assistant";
  widget.innerHTML = `
    <button class="ai-assistant-toggle" type="button" aria-label="Open AI finance assistant" aria-expanded="false">AI</button>
    <div class="ai-assistant-panel" hidden>
      <div class="ai-assistant-head">
        <strong>AI Finance Assistant</strong>
        <button type="button" class="icon-btn" data-ai-close aria-label="Close">x</button>
      </div>
      <div class="ai-assistant-log" id="aiAssistantLog">
        <p>Ask for spending insights, a monthly summary, or category help.</p>
      </div>
      <form class="ai-assistant-form">
        <input type="text" placeholder="Ask about my spending..." aria-label="Ask AI assistant">
        <button type="submit">Send</button>
      </form>
    </div>`;

  const toggle = widget.querySelector(".ai-assistant-toggle");
  const panel = widget.querySelector(".ai-assistant-panel");
  const close = widget.querySelector("[data-ai-close]");
  const form = widget.querySelector("form");
  const input = widget.querySelector("input");
  const log = widget.querySelector("#aiAssistantLog");

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    const answer = answerFinanceQuestion(question, getContext());
    log.innerHTML += `<p><strong>You:</strong> ${question}</p><p><strong>AI:</strong> ${answer}</p>`;
    input.value = "";
    log.scrollTop = log.scrollHeight;
  });

  return widget;
}

window.addEventListener("DOMContentLoaded", () => {
  document.body.appendChild(createWidget());
});
