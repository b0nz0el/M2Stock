/* Custom select controls shared by dashboard pages. */
(function () {
  "use strict";

  const SELECTOR =
    "select:not([multiple]):not([size]):not([data-native-select])";
  const nativeValue = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  );
  const nativeSelectedIndex = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "selectedIndex",
  );
  let openControl = null;
  let typeahead = "";
  let typeaheadTimer;

  function getLabel(select) {
    if (select.getAttribute("aria-label"))
      return select.getAttribute("aria-label");

    const labels = Array.from(select.labels || []);
    const label = labels
      .map((item) => {
        const clone = item.cloneNode(true);
        clone
          .querySelectorAll("select")
          .forEach((nestedSelect) => nestedSelect.remove());
        return clone.textContent.trim();
      })
      .filter(Boolean)
      .join(" ");
    const normalizedLabel = label
      .replace(/\s+/g, " ")
      .replace(/\s*\*\s*$/, "")
      .trim();
    if (normalizedLabel) return normalizedLabel;

    return select.id
      ? select.id
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (character) => character.toLocaleUpperCase())
      : "Pilih opsi";
  }

  function selectedOption(select) {
    return select.selectedOptions[0] || null;
  }

  function closeControl(control, restoreFocus) {
    if (!control || !control.menu) return;
    control.menu.hidden = true;
    control.trigger.setAttribute("aria-expanded", "false");
    control.trigger.removeAttribute("aria-activedescendant");
    control.wrapper.classList.remove("is-open");
    if (openControl === control) openControl = null;
    if (restoreFocus) control.trigger.focus();
  }

  function positionMenu(control) {
    const rect = control.trigger.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(
      Math.max(rect.width, 180),
      window.innerWidth - gutter * 2,
    );
    const left = Math.min(
      Math.max(gutter, rect.left),
      window.innerWidth - width - gutter,
    );
    const below = window.innerHeight - rect.bottom - gutter;
    const above = rect.top - gutter;
    const openAbove = below < 220 && above > below;
    const availableHeight = Math.max(
      120,
      Math.min(320, openAbove ? above : below),
    );

    control.menu.style.width = `${width}px`;
    control.menu.style.left = `${left}px`;
    control.menu.style.maxHeight = `${availableHeight}px`;
    control.menu.style.top = openAbove
      ? `${Math.max(gutter, rect.top - Math.min(availableHeight, control.menu.scrollHeight) - 6)}px`
      : `${rect.bottom + 6}px`;
  }

  function moveActive(control, index) {
    const options = Array.from(
      control.menu.querySelectorAll(
        '[role="option"]:not([aria-disabled="true"])',
      ),
    );
    if (!options.length) return;

    const next = Math.min(Math.max(index, 0), options.length - 1);
    options.forEach((option, optionIndex) => {
      option.classList.toggle("is-active", optionIndex === next);
    });
    control.activeIndex = next;
    options[next].scrollIntoView({ block: "nearest" });
    control.trigger.setAttribute("aria-activedescendant", options[next].id);
  }

  function selectOption(control, option) {
    if (!option || option.disabled) return;
    control.select.value = option.value;
    control.select.dispatchEvent(new Event("input", { bubbles: true }));
    control.select.dispatchEvent(new Event("change", { bubbles: true }));
    control.trigger.removeAttribute("aria-invalid");
    control.wrapper.classList.remove("has-error");
    closeControl(control, false);
    control.trigger.focus();
  }

  function syncControl(control) {
    if (!control || !control.select.isConnected) return;
    const option = selectedOption(control.select);
    control.label.textContent = option
      ? option.textContent.trim()
      : "Pilih opsi";
    control.trigger.disabled = control.select.matches(":disabled");
    control.trigger.setAttribute(
      "aria-disabled",
      String(control.select.matches(":disabled")),
    );
    control.trigger.classList.toggle(
      "is-placeholder",
      !option || option.value === "",
    );
    control.trigger.title = option ? option.textContent.trim() : "Pilih opsi";

    const wasOpen = !control.menu.hidden;
    control.menu.replaceChildren();
    let activeOptionIndex = 0;
    let enabledOptionIndex = 0;

    Array.from(control.select.children).forEach((child) => {
      if (child instanceof HTMLOptGroupElement) {
        const groupLabel = document.createElement("div");
        groupLabel.className = "ui-select-group-label";
        groupLabel.setAttribute("role", "presentation");
        groupLabel.textContent = child.label;
        control.menu.appendChild(groupLabel);
        Array.from(child.children).forEach((optionNode) => {
          const isEnabled = !optionNode.disabled && !child.disabled;
          const button = createOption(control, optionNode, child.disabled);
          if (optionNode === option && isEnabled)
            activeOptionIndex = enabledOptionIndex;
          control.menu.appendChild(button);
          if (isEnabled) enabledOptionIndex += 1;
        });
      } else if (child instanceof HTMLOptionElement) {
        const isEnabled = !child.disabled;
        const button = createOption(control, child, false);
        if (child === option && isEnabled)
          activeOptionIndex = enabledOptionIndex;
        control.menu.appendChild(button);
        if (isEnabled) enabledOptionIndex += 1;
      }
    });

    control.activeIndex = activeOptionIndex;
    if (wasOpen) {
      moveActive(control, activeOptionIndex);
      positionMenu(control);
    }
  }

  function createOption(control, option, groupDisabled) {
    const optionIndex = Array.prototype.indexOf.call(
      control.select.options,
      option,
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-select-option";
    button.id = `${control.id}-option-${optionIndex}`;
    button.dataset.optionIndex = String(optionIndex);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(option.selected));
    button.setAttribute(
      "aria-disabled",
      String(option.disabled || groupDisabled),
    );
    button.textContent = option.textContent.trim();
    button.disabled = option.disabled || groupDisabled;
    button.addEventListener("click", () => selectOption(control, option));
    return button;
  }

  function openControlMenu(control, focusOption) {
    if (!control || control.select.matches(":disabled")) return;
    if (openControl && openControl !== control)
      closeControl(openControl, false);

    syncControl(control);
    control.menu.hidden = false;
    control.trigger.setAttribute("aria-expanded", "true");
    control.wrapper.classList.add("is-open");
    openControl = control;
    positionMenu(control);

    const selectedIndex = Array.from(
      control.menu.querySelectorAll(
        '[role="option"]:not([aria-disabled="true"])',
      ),
    ).findIndex((option) => option.getAttribute("aria-selected") === "true");
    moveActive(control, selectedIndex >= 0 ? selectedIndex : 0);
    if (focusOption) control.trigger.focus();
  }

  function handleTriggerKeydown(event, control) {
    const enabledOptions = Array.from(
      control.menu.querySelectorAll(
        '[role="option"]:not([aria-disabled="true"])',
      ),
    );

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (control.menu.hidden) {
        openControlMenu(control, true);
        return;
      }
      moveActive(
        control,
        control.activeIndex + (event.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (control.menu.hidden) {
        openControlMenu(control, true);
      } else if (enabledOptions[control.activeIndex]) {
        const optionIndex = Number(
          enabledOptions[control.activeIndex].dataset.optionIndex,
        );
        selectOption(control, control.select.options[optionIndex]);
      }
      return;
    }

    if (event.key === "Escape" && !control.menu.hidden) {
      event.preventDefault();
      closeControl(control, true);
      return;
    }

    if (event.key === "Tab" && !control.menu.hidden) {
      closeControl(control, false);
      return;
    }

    if (event.key === "Home" && !control.menu.hidden) {
      event.preventDefault();
      moveActive(control, 0);
      return;
    }

    if (event.key === "End" && !control.menu.hidden) {
      event.preventDefault();
      moveActive(control, enabledOptions.length - 1);
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      typeahead += event.key.toLocaleLowerCase();
      clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => {
        typeahead = "";
      }, 700);
      const match = enabledOptions.findIndex((option) =>
        option.textContent.trim().toLocaleLowerCase().startsWith(typeahead),
      );
      if (match >= 0) {
        if (control.menu.hidden) openControlMenu(control, true);
        moveActive(control, match);
      }
    }
  }

  function enhanceSelect(select) {
    if (select.dataset.uiEnhanced || select.multiple || select.size > 0) return;

    const label = getLabel(select);
    const wrapper = document.createElement("span");
    wrapper.className = "ui-select";
    if (select.classList.contains("w-full"))
      wrapper.classList.add("ui-select-full");
    if (select.classList.contains("flex-1"))
      wrapper.classList.add("ui-select-grow");
    if (select.classList.contains("min-w-0"))
      wrapper.classList.add("ui-select-min-w-0");
    if (select.classList.contains("bg-transparent"))
      wrapper.classList.add("ui-select-embedded");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ui-select-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-label", label);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.id = `${select.id || "select"}-control`;

    const selectedLabel = document.createElement("span");
    selectedLabel.className = "ui-select-value";
    const arrow = document.createElement("span");
    arrow.className = "ui-select-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML =
      '<svg viewBox="0 0 20 20" fill="none"><path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    trigger.append(selectedLabel, arrow);

    const menu = document.createElement("div");
    menu.className = "ui-select-menu";
    menu.id = `${trigger.id}-listbox`;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", label);
    menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);

    const control = {
      id: trigger.id,
      select,
      wrapper,
      trigger,
      label: selectedLabel,
      menu,
      activeIndex: 0,
    };

    select.dataset.uiEnhanced = "true";
    select.classList.add("ui-select-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    if (select.required) {
      select.dataset.uiRequired = "true";
      select.required = false;
    }

    const labels = Array.from(select.labels || []);
    labels.forEach((associatedLabel) => {
      if (associatedLabel.htmlFor === select.id && select.id) {
        associatedLabel.htmlFor = trigger.id;
      } else if (associatedLabel.contains(select)) {
        associatedLabel.addEventListener("click", (event) => {
          event.preventDefault();
          if (!event.target.closest(".ui-select-trigger")) {
            trigger.focus();
            openControlMenu(control, false);
          }
        });
      }
    });

    select.before(wrapper);
    wrapper.append(select, trigger);
    document.body.appendChild(menu);

    trigger.addEventListener("click", () => {
      if (menu.hidden) openControlMenu(control, false);
      else closeControl(control, false);
    });
    trigger.addEventListener("keydown", (event) =>
      handleTriggerKeydown(event, control),
    );
    select.addEventListener("change", () => syncControl(control));
    select.addEventListener("input", () => syncControl(control));

    if (nativeValue && nativeSelectedIndex) {
      Object.defineProperty(select, "value", {
        configurable: true,
        get() {
          return nativeValue.get.call(this);
        },
        set(value) {
          nativeValue.set.call(this, value);
          syncControl(control);
        },
      });
      Object.defineProperty(select, "selectedIndex", {
        configurable: true,
        get() {
          return nativeSelectedIndex.get.call(this);
        },
        set(value) {
          nativeSelectedIndex.set.call(this, value);
          syncControl(control);
        },
      });
    }

    if (select.form) {
      const form = select.form;
      if (!form.dataset.uiSelectValidation) {
        form.dataset.uiSelectValidation = "true";
        form.addEventListener(
          "submit",
          (event) => {
            const invalidControl = Array.from(
              form.querySelectorAll('select[data-ui-required="true"]'),
            ).find((item) => !item.value);
            if (!invalidControl) return;
            event.preventDefault();
            const invalid = invalidControl._uiSelectControl;
            if (!invalid) return;
            invalid.trigger.setAttribute("aria-invalid", "true");
            invalid.wrapper.classList.add("has-error");
            invalid.trigger.focus();
            openControlMenu(invalid, false);
          },
          true,
        );
      }
      form.addEventListener("reset", () =>
        setTimeout(() => syncControl(control), 0),
      );
    }

    control.menu = menu;
    select._uiSelectControl = control;
    syncControl(control);
  }

  function scanSelects(root) {
    if (root.matches && root.matches(SELECTOR)) enhanceSelect(root);
    if (root.querySelectorAll)
      root.querySelectorAll(SELECTOR).forEach(enhanceSelect);
  }

  document.addEventListener("click", (event) => {
    const clickedAssociatedLabel =
      openControl &&
      Array.from(openControl.select.labels || []).some(
        (label) => label === event.target || label.contains(event.target),
      );
    if (
      openControl &&
      !clickedAssociatedLabel &&
      !openControl.wrapper.contains(event.target) &&
      !openControl.menu.contains(event.target)
    ) {
      closeControl(openControl, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openControl) closeControl(openControl, true);
  });

  window.addEventListener("resize", () => {
    if (openControl) positionMenu(openControl);
  });
  window.addEventListener(
    "scroll",
    (event) => {
      if (openControl && !openControl.menu.contains(event.target))
        closeControl(openControl, false);
    },
    true,
  );

  function init() {
    scanSelects(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const target = mutation.target;
        if (target instanceof HTMLSelectElement && target._uiSelectControl) {
          syncControl(target._uiSelectControl);
        }
        if (!(target instanceof HTMLSelectElement) && target.querySelectorAll) {
          target
            .querySelectorAll("select[data-ui-enhanced='true']")
            .forEach((select) => syncControl(select._uiSelectControl));
        }
        if (
          target instanceof HTMLOptionElement &&
          target.parentElement instanceof HTMLSelectElement
        ) {
          syncControl(target.parentElement._uiSelectControl);
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scanSelects(node);
        });
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["selected", "disabled", "label"],
    });

    window.refreshCustomSelects = (root = document) => scanSelects(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
