/* =========================================================
   NESTED TODO LIST
   No frameworks. No server. Uses localStorage.
========================================================= */

const STORAGE_KEY = "nested-todo-list-v1";
const THEME_KEY = "nested-todo-theme-v1";

let tasks = [];
let draggedTaskId = null;


/* =========================================================
   DOM
========================================================= */

const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");

const newTaskInput = document.getElementById("newTaskInput");
const addTaskButton = document.getElementById("addTaskButton");

const searchInput = document.getElementById("searchInput");

const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const taskCount = document.getElementById("taskCount");

const clearCompletedButton =
  document.getElementById("clearCompletedButton");

const expandAllButton =
  document.getElementById("expandAllButton");

const collapseAllButton =
  document.getElementById("collapseAllButton");

const themeButton =
  document.getElementById("themeButton");

const exportButton =
  document.getElementById("exportButton");

const importButton =
  document.getElementById("importButton");

const importFile =
  document.getElementById("importFile");

const resetButton =
  document.getElementById("resetButton");

const toast =
  document.getElementById("toast");


/* =========================================================
   INITIALIZATION
========================================================= */

loadTasks();
resyncCompletion(tasks);
loadTheme();
render();


/* =========================================================
   TASK DATA
========================================================= */

function createTask(title) {
  return {
    id: generateId(),
    title: title.trim(),
    completed: false,
    collapsed: false,
    children: [],
    createdAt: Date.now()
  };
}


function generateId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 9)
  );
}


function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      tasks = [];
      return;
    }

    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed)) {
      tasks = normalizeTasks(parsed);
    } else {
      tasks = [];
    }

  } catch (error) {
    console.error("Could not load tasks:", error);
    tasks = [];
  }
}


function normalizeTasks(list) {
  return list.map(task => ({
    id: task.id || generateId(),
    title: typeof task.title === "string"
      ? task.title
      : "Untitled task",
    completed: Boolean(task.completed),
    collapsed: Boolean(task.collapsed),
    createdAt: task.createdAt || Date.now(),
    children: Array.isArray(task.children)
      ? normalizeTasks(task.children)
      : []
  }));
}


function saveTasks() {

  resyncCompletion(tasks);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(tasks)
  );

  updateProgress();
}


/* =========================================================
   AUTO-COMPLETE PARENTS BASED ON SUBTASKS
========================================================= */

function resyncCompletion(list) {

  list.forEach(task => {

    resyncCompletion(task.children);

    if (task.children.length > 0) {
      task.completed =
        task.children.every(child => child.completed);
    }
  });
}


/* =========================================================
   ADD TASK
========================================================= */

function addTask(title) {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    newTaskInput.focus();
    return;
  }

  tasks.push(createTask(cleanTitle));

  saveTasks();
  render();

  newTaskInput.value = "";
  newTaskInput.focus();

  showToast("Task added");
}


function addSubtask(parentId) {
  const parent = findTask(parentId);

  if (!parent) return;

  const child = createTask("");

  parent.children.push(child);
  parent.collapsed = false;

  saveTasks();
  render();

  editTask(child.id, { isNew: true });
}


/* =========================================================
   FIND TASK
========================================================= */

function findTask(id, list = tasks) {
  for (const task of list) {

    if (task.id === id) {
      return task;
    }

    const found = findTask(id, task.children);

    if (found) {
      return found;
    }
  }

  return null;
}


/* =========================================================
   REMOVE TASK
========================================================= */

function deleteTask(id) {

  const task = findTask(id);

  if (!task) return;

  const hasChildren = task.children.length > 0;

  if (hasChildren) {
    const confirmed = confirm(
      "This task contains subtasks. Delete the task and all of its subtasks?"
    );

    if (!confirmed) return;
  }

  removeTaskFromList(tasks, id);

  saveTasks();
  render();

  showToast("Task deleted");
}


function removeTaskFromList(list, id) {

  const index = list.findIndex(
    task => task.id === id
  );

  if (index !== -1) {
    list.splice(index, 1);
    return true;
  }

  for (const task of list) {

    if (removeTaskFromList(task.children, id)) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   COMPLETE TASK
========================================================= */

function toggleTask(id) {

  const task = findTask(id);

  if (!task) return;

  if (task.children.length > 0) {
    showToast("Complete all subtasks to complete this task");
    return;
  }

  task.completed = !task.completed;

  saveTasks();
  render();
}


/* =========================================================
   COLLAPSE / EXPAND
========================================================= */

function toggleCollapse(id) {

  const task = findTask(id);

  if (!task || task.children.length === 0) {
    return;
  }

  task.collapsed = !task.collapsed;

  saveTasks();
  render();
}


function setAllCollapsed(collapsed) {

  function walk(list) {

    list.forEach(task => {

      if (task.children.length) {
        task.collapsed = collapsed;
      }

      walk(task.children);
    });
  }

  walk(tasks);

  saveTasks();
  render();
}


/* =========================================================
   EDIT TASK
========================================================= */

function finishEditing(id, value) {

  const task = findTask(id);

  if (!task) return;

  const cleanValue = value.trim();

  if (cleanValue) {
    task.title = cleanValue;
  }

  saveTasks();
  render();
}


function editTask(id, { isNew = false } = {}) {

  const task = findTask(id);

  if (!task) return;

  const row = document.querySelector(
    `.task-row[data-task-id="${CSS.escape(id)}"]`
  );

  if (!row) return;

  const title = row.querySelector(".task-title");

  if (!title) return;

  const input = document.createElement("input");

  input.type = "text";
  input.className = "task-input";
  input.value = task.title;
  input.maxLength = 500;
  input.dataset.id = id;

  if (isNew) {
    input.placeholder = "Name this subtask...";
  }

  title.replaceWith(input);

  input.focus();
  input.select();

  let saved = false;

  function discardIfEmpty() {

    if (input.value.trim()) {
      return false;
    }

    removeTaskFromList(tasks, id);

    saveTasks();
    render();

    return true;
  }

  function saveEdit() {

    if (saved) return;

    saved = true;

    if (isNew && discardIfEmpty()) {
      return;
    }

    finishEditing(id, input.value);
  }

  input.addEventListener("blur", saveEdit);

  input.addEventListener("keydown", event => {

    if (event.key === "Enter") {
      event.preventDefault();
      saveEdit();
    }

    if (event.key === "Escape") {

      saved = true;

      if (isNew) {
        removeTaskFromList(tasks, id);
        saveTasks();
        render();
      } else {
        render();
      }
    }
  });
}


/* =========================================================
   CLEAR COMPLETED
========================================================= */

function clearCompleted() {

  const before = countTasks(tasks);

  function removeCompleted(list) {

    for (let i = list.length - 1; i >= 0; i--) {

      if (list[i].completed) {
        list.splice(i, 1);
      } else {
        removeCompleted(list[i].children);
      }
    }
  }

  removeCompleted(tasks);

  const after = countTasks(tasks);

  if (before === after) {
    showToast("No completed tasks to clear");
    return;
  }

  saveTasks();
  render();

  showToast(
    `${before - after} completed ${
      before - after === 1 ? "task" : "tasks"
    } cleared`
  );
}


/* =========================================================
   COUNT TASKS
========================================================= */

function countTasks(list) {

  let total = 0;

  for (const task of list) {
    total++;

    total += countTasks(task.children);
  }

  return total;
}


function countCompleted(list) {

  let total = 0;

  for (const task of list) {

    if (task.completed) {
      total++;
    }

    total += countCompleted(task.children);
  }

  return total;
}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress() {

  const total = countTasks(tasks);
  const completed = countCompleted(tasks);

  const percentage =
    total === 0
      ? 0
      : Math.round((completed / total) * 100);

  progressBar.style.width = `${percentage}%`;

  progressLabel.textContent =
    `${percentage}% complete`;

  taskCount.textContent =
    `${total} ${total === 1 ? "task" : "tasks"}`;
}


/* =========================================================
   SEARCH
========================================================= */

function taskMatchesSearch(task, query) {

  if (!query) {
    return true;
  }

  const titleMatches =
    task.title.toLowerCase().includes(query);

  const childMatches =
    task.children.some(child =>
      taskMatchesSearch(child, query)
    );

  return titleMatches || childMatches;
}


/* =========================================================
   RENDER
========================================================= */

function render() {

  const query =
    searchInput.value.trim().toLowerCase();

  taskList.innerHTML = "";

  const visibleTasks =
    tasks.filter(task =>
      taskMatchesSearch(task, query)
    );

  if (tasks.length === 0) {

    emptyState.style.display = "block";

  } else if (visibleTasks.length === 0) {

    emptyState.style.display = "block";

    emptyState.innerHTML = `
      <div class="empty-icon">⌕</div>
      <h3>No matching tasks</h3>
      <p>Try a different search term.</p>
    `;

  } else {

    emptyState.style.display = "none";

    visibleTasks.forEach(task => {

      taskList.appendChild(
        renderTask(task, 0, query)
      );
    });
  }

  updateProgress();
}


/* =========================================================
   RENDER SINGLE TASK
========================================================= */

function renderTask(task, depth, query = "") {

  const wrapper = document.createElement("div");

  wrapper.className = "task";

  if (task.completed) {
    wrapper.classList.add("completed");
  }

  wrapper.dataset.id = task.id;

  const row = document.createElement("div");

  row.className = "task-row";
  row.dataset.taskId = task.id;

  row.draggable = true;


  /* Drag handle */

  const dragHandle = document.createElement("div");

  dragHandle.className = "drag-handle";
  dragHandle.innerHTML = "⋮⋮";
  dragHandle.title = "Drag to reorder";


  /* Collapse button */

  let collapseButton = null;

  if (task.children.length > 0) {

    collapseButton = document.createElement("button");

    collapseButton.type = "button";
    collapseButton.className = "collapse-button";

    if (task.collapsed) {
      collapseButton.classList.add("collapsed");
    }

    collapseButton.innerHTML = "▾";

    collapseButton.title =
      task.collapsed
        ? "Expand subtasks"
        : "Collapse subtasks";

    collapseButton.addEventListener("click", event => {
      event.stopPropagation();
      toggleCollapse(task.id);
    });

  } else {

    const placeholder =
      document.createElement("div");

    placeholder.className =
      "collapse-placeholder";

    row.appendChild(placeholder);
  }


  /* Checkbox */

  const checkButton =
    document.createElement("button");

  checkButton.type = "button";
  checkButton.className = "check-button";

  if (task.completed) {
    checkButton.classList.add("checked");
  }

  const hasChildren = task.children.length > 0;

  if (hasChildren) {

    checkButton.classList.add("derived");

    checkButton.title =
      "Completes automatically once all subtasks are done";

    checkButton.setAttribute(
      "aria-label",
      "This task completes automatically once all subtasks are done"
    );

  } else {

    checkButton.setAttribute(
      "aria-label",
      task.completed
        ? "Mark task incomplete"
        : "Mark task complete"
    );
  }

  checkButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleTask(task.id);
  });


  /* Content */

  const content =
    document.createElement("div");

  content.className = "task-content";

  const title =
    document.createElement("span");

  title.className = "task-title";
  title.textContent = task.title;

  title.title = "Double-click to edit";

  title.addEventListener("dblclick", event => {
    event.stopPropagation();
    editTask(task.id);
  });

  content.appendChild(title);


  /* Actions */

  const actions =
    document.createElement("div");

  actions.className = "task-actions";


  const addButton =
    createActionButton("+", "Add subtask");

  addButton.addEventListener("click", event => {
    event.stopPropagation();
    addSubtask(task.id);
  });


  const editButton =
    createActionButton("✎", "Edit task");

  editButton.addEventListener("click", event => {
    event.stopPropagation();
    editTask(task.id);
  });


  const deleteButton =
    createActionButton("×", "Delete task");

  deleteButton.classList.add("delete");

  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    deleteTask(task.id);
  });


  actions.appendChild(addButton);
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);


  /* Build row */

  row.appendChild(dragHandle);

  if (collapseButton) {
    row.appendChild(collapseButton);
  }

  row.appendChild(checkButton);
  row.appendChild(content);
  row.appendChild(actions);

  wrapper.appendChild(row);


  /* Children */

  if (
    task.children.length > 0 &&
    !task.collapsed
  ) {

    const children =
      document.createElement("div");

    children.className = "children";

    const visibleChildren =
      query
        ? task.children.filter(child =>
            taskMatchesSearch(child, query)
          )
        : task.children;

    visibleChildren.forEach(child => {

      children.appendChild(
        renderTask(
          child,
          depth + 1,
          query
        )
      );
    });

    wrapper.appendChild(children);
  }


  /* Drag events */

  setupDragEvents(wrapper, row, task);


  return wrapper;
}


/* =========================================================
   ACTION BUTTON
========================================================= */

function createActionButton(icon, label) {

  const button =
    document.createElement("button");

  button.type = "button";
  button.className = "task-action";

  button.textContent = icon;

  button.title = label;
  button.setAttribute("aria-label", label);

  return button;
}


/* =========================================================
   DRAG & DROP
========================================================= */

const DRAG_OVER_CLASSES = [
  "drag-over-before",
  "drag-over-after",
  "drag-over-inside"
];


function clearDragOverClasses() {

  document
    .querySelectorAll(DRAG_OVER_CLASSES.map(c => `.${c}`).join(","))
    .forEach(item => {
      item.classList.remove(...DRAG_OVER_CLASSES);
    });
}


function getDropZone(event, row) {

  const rect = row.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const ratio = rect.height ? offsetY / rect.height : 0.5;

  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";

  return "inside";
}


function setupDragEvents(element, row, task) {

  element.addEventListener("dragstart", event => {

    event.stopPropagation();

    draggedTaskId = task.id;

    element.classList.add("dragging");

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData(
      "text/plain",
      task.id
    );
  });


  element.addEventListener("dragend", () => {

    draggedTaskId = null;

    element.classList.remove("dragging");

    clearDragOverClasses();
  });


  row.addEventListener("dragover", event => {

    event.preventDefault();
    event.stopPropagation();

    if (!draggedTaskId) return;

    if (draggedTaskId === task.id) {
      return;
    }

    if (isDescendant(draggedTaskId, task.id)) {
      return;
    }

    const zone = getDropZone(event, row);

    clearDragOverClasses();
    element.classList.add(`drag-over-${zone}`);

    event.dataTransfer.dropEffect = "move";
  });


  row.addEventListener("dragleave", event => {

    if (
      event.relatedTarget &&
      row.contains(event.relatedTarget)
    ) {
      return;
    }

    element.classList.remove(...DRAG_OVER_CLASSES);
  });


  row.addEventListener("drop", event => {

    event.preventDefault();
    event.stopPropagation();

    element.classList.remove(...DRAG_OVER_CLASSES);

    if (!draggedTaskId) return;

    if (draggedTaskId === task.id) {
      return;
    }

    if (isDescendant(draggedTaskId, task.id)) {
      showToast("A task cannot be moved inside its own subtask");
      return;
    }

    const zone = getDropZone(event, row);

    if (zone === "inside") {
      moveTaskAsChild(
        draggedTaskId,
        task.id
      );
    } else {
      moveTaskToSibling(
        draggedTaskId,
        task.id,
        zone
      );
    }
  });
}


/* =========================================================
   CHECK DESCENDANT
========================================================= */

function isDescendant(possibleChildId, possibleParentId) {

  const parent =
    findTask(possibleParentId);

  if (!parent) return false;

  return containsTask(
    parent.children,
    possibleChildId
  );
}


function containsTask(list, id) {

  for (const task of list) {

    if (task.id === id) {
      return true;
    }

    if (containsTask(task.children, id)) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   MOVE TASK AS CHILD
========================================================= */

function moveTaskAsChild(taskId, parentId) {

  const task =
    extractTask(tasks, taskId);

  if (!task) return;

  const parent =
    findTask(parentId);

  if (!parent) return;

  parent.children.push(task);
  parent.collapsed = false;

  saveTasks();
  render();

  showToast("Task moved");
}


function moveTaskToSibling(taskId, targetId, position) {

  const task =
    extractTask(tasks, taskId);

  if (!task) return;

  const targetInfo =
    findListAndIndex(tasks, targetId);

  if (!targetInfo) return;

  const insertIndex =
    position === "before"
      ? targetInfo.index
      : targetInfo.index + 1;

  targetInfo.list.splice(insertIndex, 0, task);

  saveTasks();
  render();

  showToast("Task moved");
}


function findListAndIndex(list, id) {

  const index =
    list.findIndex(task => task.id === id);

  if (index !== -1) {
    return { list, index };
  }

  for (const task of list) {

    const found =
      findListAndIndex(task.children, id);

    if (found) {
      return found;
    }
  }

  return null;
}


function extractTask(list, id) {

  const index =
    list.findIndex(task => task.id === id);

  if (index !== -1) {
    return list.splice(index, 1)[0];
  }

  for (const task of list) {

    const found =
      extractTask(task.children, id);

    if (found) {
      return found;
    }
  }

  return null;
}


/* =========================================================
   IMPORT / EXPORT
========================================================= */

function exportTasks() {

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: tasks
  };

  const blob =
    new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    `todo-backup-${formatDateForFilename()}.json`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  showToast("Todo list exported");
}


function importTasksFromFile(file) {

  if (!file) return;

  const reader = new FileReader();

  reader.onload = event => {

    try {

      const parsed =
        JSON.parse(event.target.result);

      let importedTasks;

      if (Array.isArray(parsed)) {
        importedTasks = parsed;
      } else if (Array.isArray(parsed.tasks)) {
        importedTasks = parsed.tasks;
      } else {
        throw new Error("Invalid format");
      }

      const normalized =
        normalizeTasks(importedTasks);

      const confirmed =
        confirm(
          "Import this file? Your current list will be replaced."
        );

      if (!confirmed) return;

      tasks = normalized;

      saveTasks();
      render();

      showToast("Todo list imported");

    } catch (error) {

      console.error(error);

      alert(
        "That file could not be imported. Make sure it is a valid todo JSON file."
      );
    }
  };

  reader.readAsText(file);
}


function formatDateForFilename() {

  const date = new Date();

  return date
    .toISOString()
    .slice(0, 10);
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

  const savedTheme =
    localStorage.getItem(THEME_KEY);

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeButton.textContent = "☀";
  } else {
    themeButton.textContent = "☾";
  }
}


function toggleTheme() {

  document.body.classList.toggle("dark");

  const dark =
    document.body.classList.contains("dark");

  localStorage.setItem(
    THEME_KEY,
    dark ? "dark" : "light"
  );

  themeButton.textContent =
    dark ? "☀" : "☾";
}


/* =========================================================
   RESET
========================================================= */

function resetEverything() {

  const confirmed =
    confirm(
      "This will permanently delete every task stored in this browser. Continue?"
    );

  if (!confirmed) return;

  tasks = [];

  localStorage.removeItem(STORAGE_KEY);

  render();

  showToast("Everything has been reset");
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
}


/* =========================================================
   EVENTS
========================================================= */

addTaskButton.addEventListener(
  "click",
  () => addTask(newTaskInput.value)
);


newTaskInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      addTask(newTaskInput.value);
    }
  }
);


searchInput.addEventListener(
  "input",
  render
);


clearCompletedButton.addEventListener(
  "click",
  clearCompleted
);


expandAllButton.addEventListener(
  "click",
  () => setAllCollapsed(false)
);


collapseAllButton.addEventListener(
  "click",
  () => setAllCollapsed(true)
);


themeButton.addEventListener(
  "click",
  toggleTheme
);


exportButton.addEventListener(
  "click",
  exportTasks
);


importButton.addEventListener(
  "click",
  () => importFile.click()
);


importFile.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    importTasksFromFile(file);

    event.target.value = "";
  }
);


resetButton.addEventListener(
  "click",
  resetEverything
);


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /*
      "/" focuses search unless the user
      is already typing somewhere.
    */

    if (
      event.key === "/" &&
      document.activeElement.tagName !== "INPUT"
    ) {

      event.preventDefault();

      searchInput.focus();
    }

    /*
      Escape clears search.
    */

    if (
      event.key === "Escape" &&
      document.activeElement === searchInput
    ) {

      searchInput.value = "";
      render();

      searchInput.blur();
    }
  }
);
