function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === void 0 || value === false) continue;
      if (key === "class") el.className = String(value);
      else if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) el.setAttribute(key, "");
      else el.setAttribute(key, String(value));
    }
  }
  const add = (child) => {
    if (child === null || child === void 0) return;
    if (Array.isArray(child)) {
      for (const c of child) add(c);
      return;
    }
    el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  };
  for (const child of children) add(child);
  return el;
}
function fieldId(name) {
  return `field-${name}`;
}
function renderField(field, value, error, busy, onChange) {
  const id = fieldId(field.name);
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : void 0;
  const common = {
    id,
    class: "sure-form__input",
    name: field.name,
    value: field.control === "select" ? value || (field.options?.[0] ?? "") : value,
    required: field.required,
    disabled: field.readOnly === true || busy,
    readOnly: field.readOnly === true,
    autocomplete: field.control === "password" ? "new-password" : "off",
    "aria-invalid": error ? "true" : "false",
    "aria-describedby": describedBy,
    placeholder: field.hints?.placeholder ?? "",
    minlength: field.validation?.minLength ?? void 0,
    maxlength: field.control === "textarea" ? void 0 : field.validation?.maxLength ?? void 0,
    oninput: (e) => onChange(field.name, e.target.value)
  };
  let control;
  if (field.control === "select") {
    const select = h("select", common);
    if (!field.required) {
      const blank = h("option", { value: "" }, "\u2014");
      select.appendChild(blank);
    }
    for (const opt of field.options ?? []) {
      select.appendChild(h("option", { value: opt }, opt));
    }
    control = select;
  } else if (field.control === "textarea") {
    control = h("textarea", { ...common, rows: 5, spellcheck: "false" });
  } else {
    const type = field.control === "password" ? "password" : field.inputType ?? "text";
    control = h("input", { ...common, type });
  }
  const label = h("label", { class: "sure-form__label", for: id }, field.label);
  if (field.required) label.appendChild(h("span", { "aria-hidden": "true" }, " *"));
  const parts = [label, control];
  {
    const message = h("div", { class: "sure-form__message" });
    if (!error && (field.help || field.hints?.help)) {
      const helpText = [...new Set([field.help, field.hints?.help].filter(Boolean))].join(" \u2014 ");
      message.appendChild(h("div", { class: "sure-form__help", id: `${id}-help` }, helpText));
    }
    if (error) {
      message.appendChild(h("div", { class: "sure-form__error", id: `${id}-error`, role: "alert" }, error));
    }
    parts.push(message);
  }
  return h("div", { class: "sure-form__field", "data-field": field.name }, ...parts);
}
function validateForm(spec, values) {
  const errors = {};
  for (const field of spec.fields) {
    if (field.control === "hidden") continue;
    const value = values[field.name] ?? "";
    const v = field.validation ?? {};
    if (field.required && value.trim() === "") {
      errors[field.name] = field.hints?.error?.required ?? `${field.label} is required`;
      continue;
    }
    if (value === "") continue;
    if (field.json) {
      try {
        JSON.parse(value);
      } catch {
        errors[field.name] = "must be valid JSON";
        continue;
      }
    }
    if (v.regex) {
      let ok = true;
      try {
        ok = new RegExp(v.regex, "u").test(value);
      } catch {
        ok = true;
      }
      if (!ok) {
        errors[field.name] = field.hints?.error?.format ?? `${field.label} has an invalid format`;
        continue;
      }
    }
    if (v.minLength != null && value.length < v.minLength) {
      errors[field.name] = field.hints?.error?.tooShort ?? `${field.label} must be at least ${v.minLength} characters`;
      continue;
    }
    if (v.maxLength != null && field.control !== "textarea" && value.length > v.maxLength) {
      errors[field.name] = field.hints?.error?.tooLong ?? `${field.label} must be at most ${v.maxLength} characters`;
    }
  }
  return errors;
}
function sanitizeForm(spec, values) {
  const out = {};
  for (const field of spec.fields) {
    if (field.control === "hidden") {
      out[field.name] = values[field.name] ?? "";
      continue;
    }
    let value = values[field.name] ?? "";
    const max = v_max(field);
    for (const step of field.sanitize?.length ? field.sanitize : ["trim"]) {
      value = applyStep(value, step, max);
    }
    if (max && field.control !== "textarea") {
      value = value.slice(0, max);
    }
    out[field.name] = value;
  }
  return out;
}
function applyStep(value, step, maxLength) {
  const call = step.match(/^(\w+)\(([^)]*)\)$/);
  if (call) {
    const args = call[2].split(",").map((a) => a.trim()).filter(Boolean);
    switch (call[1]) {
      case "normalize":
        return value.normalize(args[0] ?? "NFKC");
      case "slice": {
        const start = Number(args[0] ?? 0);
        const rawEnd = args[1];
        const end = rawEnd === void 0 ? void 0 : rawEnd === "maxLength" ? maxLength ?? void 0 : Number(rawEnd);
        if (!Number.isFinite(start)) return value;
        if (end !== void 0 && !Number.isFinite(end)) return value;
        return value.slice(start, end);
      }
      default:
        break;
    }
  }
  switch (step) {
    case "trim":
      return value.trim();
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "htmlEscape":
      return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x2F;");
    case "stripNonDigits":
      return value.replace(/\D/g, "");
    case "collapseWhitespace":
      return value.replace(/\s+/g, " ").trim();
    case "stripControl":
      return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    case "stripDirectionOverrides":
      return value.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
    case "stripZeroWidth":
      return value.replace(/[\u200B-\u200D\uFEFF]/g, "");
    default:
      return value;
  }
}
function v_max(field) {
  const n = field.validation?.maxLength;
  return typeof n === "number" && n > 0 ? n : null;
}
function renderForm(spec, options) {
  const values = options.values ?? {};
  const errors = options.errors ?? {};
  const busy = options.busy ?? false;
  const visible = spec.fields.filter((f) => f.control !== "hidden");
  const form = h("form", {
    class: "sure-form",
    "aria-label": spec.title,
    novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      if (busy) return;
      if (options.validate === false) {
        options.onSubmit(values);
        return;
      }
      const found = validateForm(spec, values);
      if (Object.keys(found).length === 0) {
        options.onSubmit(sanitizeForm(spec, values));
        return;
      }
      if (options.onInvalid) options.onInvalid(found);
      else options.onSubmit(values);
    }
  });
  form.appendChild(h("h2", { class: "sure-form__title" }, spec.title));
  const grouped = visible.some((field) => field.group);
  if (!grouped) {
    for (const field of visible) {
      form.appendChild(renderField(field, values[field.name] ?? "", errors[field.name], busy, options.onChange));
    }
  } else {
    const order = [];
    const sections = /* @__PURE__ */ new Map();
    for (const field of visible) {
      const name = field.group ?? "";
      if (!sections.has(name)) {
        sections.set(name, []);
        order.push(name);
      }
      sections.get(name).push(field);
    }
    for (const name of order) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const section = h("section", {
        class: "sure-form__group",
        ...slug ? { "data-group": slug } : {}
      });
      if (name) section.appendChild(h("h3", { class: "sure-form__title" }, name));
      for (const field of sections.get(name) ?? []) {
        section.appendChild(renderField(field, values[field.name] ?? "", errors[field.name], busy, options.onChange));
      }
      form.appendChild(section);
    }
  }
  const actions = h("div", { class: "sure-form__actions" });
  actions.appendChild(h(
    "button",
    { class: "btn-primary", type: "submit", disabled: busy },
    options.submitLabel ?? "Save"
  ));
  if (options.onCancel) {
    actions.appendChild(h("button", {
      class: "btn-secondary",
      type: "button",
      disabled: busy,
      onclick: () => options.onCancel?.()
    }, "Cancel"));
  }
  form.appendChild(actions);
  return form;
}
const GENERATED_FIELDS = [
  {
    "name": "provider",
    "label": "LLM Provider",
    "group": null,
    "control": "select",
    "inputType": "text",
    "type": "text",
    "options": [
      "mock",
      "openai",
      "anthropic",
      "google",
      "google-vertex",
      "openrouter",
      "openai-compatible"
    ],
    "required": true,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": null,
      "minLength": null,
      "maxLength": null
    },
    "sanitize": [
      "trim",
      "collapseWhitespace",
      "normalize(NFKC)",
      "stripControl",
      "slice(0, maxLength)"
    ],
    "help": "Also set your API key in the \u{1F511} Keys dialog",
    "hints": {
      "placeholder": "Enter text...",
      "help": "Also set your API key in the \u{1F511} Keys dialog",
      "error": {
        "format": "",
        "required": "This field is required"
      }
    },
    "source": {
      "table": "chatbot_settings",
      "column": "provider"
    }
  },
  {
    "name": "model",
    "label": "Model",
    "group": null,
    "control": "text",
    "inputType": "text",
    "type": "text",
    "required": false,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": null,
      "minLength": null,
      "maxLength": null
    },
    "sanitize": [
      "trim",
      "collapseWhitespace",
      "normalize(NFKC)",
      "stripControl",
      "slice(0, maxLength)"
    ],
    "help": "Leave empty for the provider default",
    "hints": {
      "placeholder": "Enter text...",
      "help": "Leave empty for the provider default",
      "error": {
        "format": "",
        "required": "This field is required"
      }
    },
    "source": {
      "table": "chatbot_settings",
      "column": "model"
    }
  },
  {
    "name": "temperature",
    "label": "Temperature",
    "group": null,
    "control": "text",
    "inputType": "number",
    "type": "text",
    "required": true,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": null,
      "minLength": null,
      "maxLength": null
    },
    "sanitize": [
      "trim",
      "collapseWhitespace",
      "normalize(NFKC)",
      "stripControl",
      "slice(0, maxLength)"
    ],
    "help": "0 = precise, 2 = creative",
    "hints": {
      "placeholder": "Enter text...",
      "help": "0 = precise, 2 = creative",
      "error": {
        "format": "",
        "required": "This field is required"
      }
    },
    "source": {
      "table": "chatbot_settings",
      "column": "temperature"
    }
  },
  {
    "name": "base_url",
    "label": "Base URL",
    "group": null,
    "control": "text",
    "inputType": "text",
    "type": "url",
    "required": false,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": "^https?://[^\\s/$.?#].[^\\s]*$",
      "minLength": null,
      "maxLength": 2048
    },
    "sanitize": [
      "trim",
      "lowercase",
      "stripJavaScriptProtocol",
      "normalize(NFKC)",
      "slice(0, 2048)"
    ],
    "help": "API endpoint for OpenAI-compatible providers \u2014 Full URL including https://",
    "hints": {
      "placeholder": "https://example.com",
      "help": "API endpoint for OpenAI-compatible providers \u2014 Full URL including https://",
      "error": {
        "format": "Must be a valid URL starting with http:// or https://",
        "required": "URL is required"
      }
    },
    "source": {
      "table": "chatbot_settings",
      "column": "base_url"
    }
  },
  {
    "name": "key_provider",
    "label": "Provider",
    "group": null,
    "control": "select",
    "inputType": "text",
    "type": "text",
    "options": [
      "openai",
      "anthropic",
      "google",
      "google-vertex",
      "openrouter",
      "openai-compatible",
      "serpapi",
      "exa",
      "firesearch"
    ],
    "required": true,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": null,
      "minLength": null,
      "maxLength": null
    },
    "sanitize": [
      "trim",
      "collapseWhitespace",
      "normalize(NFKC)",
      "stripControl",
      "slice(0, maxLength)"
    ],
    "help": "Where this key is used",
    "hints": {
      "placeholder": "Enter text...",
      "help": "Where this key is used",
      "error": {
        "format": "",
        "required": "This field is required"
      }
    },
    "source": {
      "table": "provider_key",
      "column": "key_provider"
    }
  },
  {
    "name": "key_base_url",
    "label": "Base URL",
    "group": null,
    "control": "text",
    "inputType": "text",
    "type": "url",
    "required": false,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": "^https?://[^\\s/$.?#].[^\\s]*$",
      "minLength": null,
      "maxLength": 2048
    },
    "sanitize": [
      "trim",
      "lowercase",
      "stripJavaScriptProtocol",
      "normalize(NFKC)",
      "slice(0, 2048)"
    ],
    "help": "Instance host for Firesearch or an OpenAI-compatible endpoint \u2014 Full URL including https://",
    "hints": {
      "placeholder": "https://example.com",
      "help": "Instance host for Firesearch or an OpenAI-compatible endpoint \u2014 Full URL including https://",
      "error": {
        "format": "Must be a valid URL starting with http:// or https://",
        "required": "URL is required"
      }
    },
    "source": {
      "table": "provider_key",
      "column": "key_base_url"
    }
  },
  {
    "name": "key_password",
    "label": "API Key",
    "group": null,
    "control": "password",
    "inputType": "password",
    "type": "password",
    "required": true,
    "readOnly": false,
    "secret": false,
    "json": false,
    "validation": {
      "regex": null,
      "minLength": 8,
      "maxLength": 128
    },
    "sanitize": [
      "trim"
    ],
    "help": "Stored encrypted on the server; never sent back to the browser \u2014 At least 8 characters with uppercase, lowercase, and number",
    "hints": {
      "placeholder": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      "help": "Stored encrypted on the server; never sent back to the browser \u2014 At least 8 characters with uppercase, lowercase, and number",
      "error": {
        "format": "Must be at least 8 characters with uppercase, lowercase, and a number",
        "required": "Password is required",
        "tooShort": "Must be at least 8 characters"
      }
    },
    "source": {
      "table": "provider_key",
      "column": "key_password"
    }
  }
];
const CSS_CLASSES = {
  "form": "sure-form",
  "field": "sure-form__field",
  "input": "sure-form__input",
  "error": "sure-form__error",
  "help": "sure-form__help",
  "label": "sure-form__label",
  "title": "sure-form__title",
  "group": "sure-form__group",
  "message": "sure-form__message",
  "actions": "sure-form__actions",
  "submit": "btn-primary",
  "cancel": "btn-secondary"
};
var stdin_default = renderForm;
export {
  CSS_CLASSES,
  GENERATED_FIELDS,
  stdin_default as default,
  h,
  renderField,
  renderForm,
  sanitizeForm,
  validateForm
};
