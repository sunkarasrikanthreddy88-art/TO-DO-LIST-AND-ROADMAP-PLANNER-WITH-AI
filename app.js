let state = {
  tasks: [],
  settings: {
    apiKey: '',
    model: 'gemini-2.5-flash'
  },
  filter: 'all',
  searchQuery: ''
};
const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  btnSettings: document.getElementById('btn-settings'),
  modalSettings: document.getElementById('modal-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings-modal'),
  settingsApiKey: document.getElementById('settings-api-key'),
  settingsModel: document.getElementById('settings-model'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnTestKey: document.getElementById('btn-test-key'),
  settingsTestStatus: document.getElementById('settings-test-status'),
  
  statsTotal: document.getElementById('stats-total'),
  statsPending: document.getElementById('stats-pending'),
  statsCompleted: document.getElementById('stats-completed'),
  progressCircle: document.getElementById('progress-circle'),
  statsProgressPercent: document.getElementById('stats-progress-percent'),
  statsCompletionRate: document.getElementById('stats-completion-rate'),
  
  aiPrompt: document.getElementById('ai-prompt'),
  btnGenerateAI: document.getElementById('btn-generate-ai'),
  
  btnLoadRoadmap: document.getElementById('btn-load-roadmap'),
  btnClearRoadmap: document.getElementById('btn-clear-roadmap'),
  
  btnAddTaskModal: document.getElementById('btn-add-task-modal'),
  modalTask: document.getElementById('modal-task'),
  btnCloseTaskModal: document.getElementById('btn-close-task-modal'),
  btnCancelTask: document.getElementById('btn-cancel-task'),
  btnSaveTask: document.getElementById('btn-save-task'),
  
  taskEditId: document.getElementById('task-edit-id'),
  taskTitle: document.getElementById('task-title'),
  taskDesc: document.getElementById('task-desc'),
  taskCategory: document.getElementById('task-category'),
  taskPriority: document.getElementById('task-priority'),
  taskDue: document.getElementById('task-due'),
  taskGroup: document.getElementById('task-group'),
  subtasksBuilderList: document.getElementById('subtasks-builder-list'),
  btnAddSubtaskField: document.getElementById('btn-add-subtask-field'),
  modalTaskTitle: document.getElementById('modal-task-title'),
  
  taskGrid: document.getElementById('task-grid'),
  searchInput: document.getElementById('search-input'),
  filterTabs: document.querySelectorAll('.filter-tab')
};

// Initialize Application
async function init() {
  setupEventListeners();
  if (elements.progressCircle) {
    elements.progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
  }
  loadThemePreference();
  await syncWithDatabase();
}
function loadThemePreference() {
  const savedTheme = localStorage.getItem('auratask_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (elements.themeToggle) {
    elements.themeToggle.checked = (savedTheme === 'light');
  }
}
async function syncWithDatabase() {
  try {
    const [tasksRes, settingsRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/settings')
    ]);
    
    if (tasksRes.ok) {
      state.tasks = await tasksRes.json();
    }
    
    if (settingsRes.ok) {
      state.settings = await settingsRes.json();
      // Apply to UI fields
      if (elements.settingsApiKey) elements.settingsApiKey.value = state.settings.apiKey;
      if (elements.settingsModel) elements.settingsModel.value = state.settings.model;
    }
    
    render();
  } catch (err) {
    console.error("Failed to connect to backend server database:", err);
    showToast("Server connection failed. Working in offline mock mode.", "danger");
  }
}
function setupEventListeners() {
  // Theme Switcher
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('auratask_theme', theme);
    });
  }

  // Settings Toggles
  if (elements.btnSettings) {
    elements.btnSettings.addEventListener('click', () => openModal(elements.modalSettings));
  }
  if (elements.btnCloseSettings) {
    elements.btnCloseSettings.addEventListener('click', () => closeModal(elements.modalSettings));
  }
  
  // Save Settings to Database
  if (elements.btnSaveSettings) {
    elements.btnSaveSettings.addEventListener('click', async () => {
      const apiKey = elements.settingsApiKey.value.trim();
      const model = elements.settingsModel.value;
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, model })
        });
        if (res.ok) {
          state.settings = { apiKey, model };
          closeModal(elements.modalSettings);
          showToast("Configuration saved to database!");
        } else {
          showToast("Failed to save settings.", "danger");
        }
      } catch (err) {
        showToast("Server connection error.", "danger");
      }
    });
  }
  if (elements.btnTestKey) {
    elements.btnTestKey.addEventListener('click', testAPIKey);
  }
  if (elements.btnAddTaskModal) {
    elements.btnAddTaskModal.addEventListener('click', () => openTaskModal());
  }
  if (elements.btnCloseTaskModal) {
    elements.btnCloseTaskModal.addEventListener('click', () => closeModal(elements.modalTask));
  }
  if (elements.btnCancelTask) {
    elements.btnCancelTask.addEventListener('click', () => closeModal(elements.modalTask));
  }
  
  // Subtasks rows builder
  if (elements.btnAddSubtaskField) {
    elements.btnAddSubtaskField.addEventListener('click', () => appendSubtaskBuilderRow(''));
  }
  
  // Save Task Form Submission
  if (elements.btnSaveTask) {
    elements.btnSaveTask.addEventListener('click', saveTaskFromModal);
  }
  
  // AI Task Generator
  if (elements.btnGenerateAI) {
    elements.btnGenerateAI.addEventListener('click', handleAIGeneration);
  }
  if (elements.btnLoadRoadmap) {
    elements.btnLoadRoadmap.addEventListener('click', async () => {
      if (state.tasks.length > 0) {
        if (confirm("Loading the template will overwrite your current active board. Do you want to proceed?")) {
          await loadSampleRoadmap();
        }
      } else {
        await loadSampleRoadmap();
      }
    });
  }
  
  if (elements.btnClearRoadmap) {
    elements.btnClearRoadmap.addEventListener('click', async () => {
      if (state.tasks.length === 0) return;
      if (confirm("Are you sure you want to delete all tasks from the database? This action cannot be undone.")) {
        try {
          const res = await fetch('/api/tasks', { method: 'DELETE' });
          if (res.ok) {
            state.tasks = [];
            render();
            showToast("Active task board cleared.");
          }
        } catch (err) {
          showToast("Failed to delete tasks.", "danger");
        }
      }
    });
  }
  
  // Search filtering
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      render();
    });
  }
  
  // Tab filtering
  elements.filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.getAttribute('data-filter');
      render();
    });
  });
  
  // Close modals when clicking outside card
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target);
    }
  });
}

// Modal Toggle Helpers
function openModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function openTaskModal(task = null) {
  elements.taskEditId.value = task ? task.id : '';
  elements.taskTitle.value = task ? task.title : '';
  elements.taskDesc.value = task ? task.description : '';
  elements.taskCategory.value = task ? task.category : 'DSA';
  elements.taskPriority.value = task ? task.priority : 'medium';
  elements.taskDue.value = task ? task.dueDate : '';
  elements.taskGroup.value = task ? (task.groupName || '') : '';
  
  elements.subtasksBuilderList.innerHTML = '';
  elements.modalTaskTitle.textContent = task ? 'Edit Task' : 'Create New Task';
  
  if (task && task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach(sub => {
      appendSubtaskBuilderRow(sub.title);
    });
  } else if (!task) {
    appendSubtaskBuilderRow('');
  }
  
  openModal(elements.modalTask);
}

function appendSubtaskBuilderRow(value = '') {
  const div = document.createElement('div');
  div.className = 'subtask-builder-item';
  div.innerHTML = `
    <input type="text" class="subtask-builder-input" placeholder="Checklist item (e.g. Implement routing boilerplate)" value="${value.replace(/"/g, '&quot;')}">
    <button class="btn-remove-subtask" title="Remove checklist item" aria-label="Remove checklist item"><i class="fa-solid fa-circle-minus"></i></button>
  `;
  
  div.querySelector('.btn-remove-subtask').addEventListener('click', () => {
    div.remove();
  });
  
  elements.subtasksBuilderList.appendChild(div);
}

// Save Manual Task to Database
async function saveTaskFromModal() {
  const title = elements.taskTitle.value.trim();
  const desc = elements.taskDesc.value.trim();
  const category = elements.taskCategory.value;
  const priority = elements.taskPriority.value;
  const dueDate = elements.taskDue.value;
  const groupName = elements.taskGroup.value.trim();
  const editId = elements.taskEditId.value;
  
  if (!title) {
    showToast("Task title is required!", "danger");
    elements.taskTitle.focus();
    return;
  }
  
  // Read Checklist
  const subtaskInputs = elements.subtasksBuilderList.querySelectorAll('.subtask-builder-input');
  const subtasks = [];
  subtaskInputs.forEach((input, index) => {
    const subTitle = input.value.trim();
    if (subTitle) {
      let completed = false;
      if (editId) {
        const existingTask = state.tasks.find(t => t.id === editId);
        if (existingTask && existingTask.subtasks && existingTask.subtasks[index]) {
          completed = existingTask.subtasks[index].completed;
        }
      }
      subtasks.push({
        id: `sub-${Date.now()}-${index}`,
        title: subTitle,
        completed: completed
      });
    }
  });
  
  const taskData = {
    title,
    description: desc,
    category,
    priority,
    dueDate,
    groupName: groupName || null,
    subtasks
  };
  
  try {
    if (editId) {
      // Edit DB Mode
      const res = await fetch(`/api/tasks/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        showToast("Task updated in database!");
      }
    } else {
      // Add DB Mode
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, completed: false })
      });
      if (res.ok) {
        showToast("Task saved to database!");
      }
    }
    
    closeModal(elements.modalTask);
    await syncWithDatabase();
  } catch (err) {
    showToast("Failed to save task to database.", "danger");
  }
}

// Delete Task from Database
async function deleteTask(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast("Task deleted.");
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Database synchronization error.", "danger");
  }
}

// Toggle Task Complete Status
async function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  const updatedCompleted = !task.completed;
  // Cascade checked status to subtasks
  const updatedSubtasks = task.subtasks ? task.subtasks.map(s => ({ ...s, completed: updatedCompleted })) : [];
  
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: updatedCompleted, subtasks: updatedSubtasks })
    });
    
    if (res.ok) {
      showToast(updatedCompleted ? "Task completed!" : "Task marked pending.");
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Database update error.", "danger");
  }
}

// Toggle Subtask Checked Status
async function toggleSubtask(taskId, subtaskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.subtasks) return;
  
  const sub = task.subtasks.find(s => s.id === subtaskId);
  if (!sub) return;
  
  sub.completed = !sub.completed;
  
  // Auto checklist update: if all subtasks are complete, complete parent.
  const allCompleted = task.subtasks.every(s => s.completed);
  let completedVal = task.completed;
  if (allCompleted) {
    completedVal = true;
  } else if (!sub.completed && task.completed) {
    completedVal = false;
  }
  
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: completedVal, subtasks: task.subtasks })
    });
    
    if (res.ok) {
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Database update error.", "danger");
  }
}

// Load Generic 7-Day Project Kickoff Roadmap
async function loadSampleRoadmap() {
  const baseDate = new Date();
  
  function getOffsetDateStr(offsetDays) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }
  
  const sampleRoadmap = [
    {
      title: "Project Initiation",
      description: "Define scope, goals, and initiate the workspace framework.",
      category: "Research",
      priority: "high",
      dueDate: getOffsetDateStr(0),
      groupName: "Day 1",
      completed: false,
      subtasks: [
        "Define specific project deliverables and target goals",
        "Set up development environments and version branches",
        "Identify team stakeholders and assign primary roles"
      ]
    },
    {
      title: "Market Discovery & Context",
      description: "Perform competitor analyses and document user stories.",
      category: "Research",
      priority: "medium",
      dueDate: getOffsetDateStr(1),
      groupName: "Day 2",
      completed: false,
      subtasks: [
        "Review top 3 competitive services or templates",
        "Write detailed user stories and persona matrices",
        "Draft initial system structure and data flow maps"
      ]
    },
    {
      title: "Interface Outline & Wireframing",
      description: "Design sketches and UI flow components.",
      category: "Frontend",
      priority: "medium",
      dueDate: getOffsetDateStr(2),
      groupName: "Day 3",
      completed: false,
      subtasks: [
        "Sketch 5 primary page wireframes on paper",
        "Build low-fidelity interactive layouts in design tool",
        "Align on cohesive CSS color tokens and typography sizes"
      ]
    },
    {
      title: "Backend Core & Database",
      description: "Scaffold server routes and database structures.",
      category: "Backend",
      priority: "high",
      dueDate: getOffsetDateStr(3),
      groupName: "Day 4",
      completed: false,
      subtasks: [
        "Configure folder architectures and base files",
        "Build local REST database read/write helpers",
        "Test baseline POST/GET API endpoints via console"
      ]
    },
    {
      title: "Frontend Integration",
      description: "Code dynamic interactive interface components.",
      category: "Frontend",
      priority: "high",
      dueDate: getOffsetDateStr(4),
      groupName: "Day 5",
      completed: false,
      subtasks: [
        "Create task card components and grid layouts",
        "Connect API fetch methods for data queries",
        "Build filter states and responsive viewport classes"
      ]
    },
    {
      title: "Testing & Access Validation",
      description: "Conduct security, audit, and compatibility reviews.",
      category: "Coding",
      priority: "medium",
      dueDate: getOffsetDateStr(5),
      groupName: "Day 6",
      completed: false,
      subtasks: [
        "Verify edge-case inputs and layout overflow bugs",
        "Perform dark/light theme accessibility contrast audit",
        "Review code files for console logs and unused parameters"
      ]
    },
    {
      title: "Launch preparation",
      description: "Finalize guides, deploy code files, and review.",
      category: "Work",
      priority: "low",
      dueDate: getOffsetDateStr(6),
      groupName: "Day 7",
      completed: false,
      subtasks: [
        "Write user instructions README setup guides",
        "Compress application static files for bundle package",
        "Deploy prototype to staging server for stakeholder review"
      ]
    }
  ];
  
  try {
    // Clear old tasks first
    await fetch('/api/tasks', { method: 'DELETE' });
    
    // Bulk save sample
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleRoadmap)
    });
    
    if (res.ok) {
      showToast("Sample 7-Day Roadmap loaded successfully!");
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Failed to load sample roadmap template.", "danger");
  }
}

// AI Task Generator Console
async function handleAIGeneration() {
  const prompt = elements.aiPrompt.value.trim();
  
  if (!prompt) {
    showToast("Please enter a goal or topic for AI generation!", "warning");
    elements.aiPrompt.focus();
    return;
  }
  
  // Dynamically parse number of days/steps from user prompt
  // e.g. "Learn Python in 5 days" -> '5'
  // If no day count is found, default to 'single'
  let roadmapMode = 'single';
  const dayMatch = prompt.match(/(\d+)\s*-?\s*day/i);
  if (dayMatch) {
    const parsedDays = parseInt(dayMatch[1]);
    if (parsedDays >= 1 && parsedDays <= 30) {
      roadmapMode = parsedDays.toString();
    }
  }
  
  setAILoadingState(true);
  
  try {
    if (state.settings.apiKey) {
      await generateWithLiveAI(prompt, roadmapMode);
    } else {
      await generateWithOfflineFallback(prompt, roadmapMode);
    }
  } catch (err) {
    console.error("AI Generation failed:", err);
    showToast(`Failed to generate tasks: ${err.message}`, "danger");
  } finally {
    setAILoadingState(false);
  }
}

function setAILoadingState(isLoading) {
  if (isLoading) {
    elements.btnGenerateAI.disabled = true;
    elements.btnGenerateAI.innerHTML = `<span class="spinner"></span> Generating Roadmap...`;
  } else {
    elements.btnGenerateAI.disabled = false;
    elements.btnGenerateAI.innerHTML = `<i class="fa-solid fa-bolt"></i> Generate with AI`;
  }
}

// Offline Task Generator using keyword matching
async function generateWithOfflineFallback(prompt, mode) {
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  const textLower = prompt.toLowerCase();
  const baseDate = new Date();
  
  let daysCount = 1;
  if (mode !== 'single') {
    daysCount = parseInt(mode) || 7;
  }
  
  const generatedTasks = [];
  
  const isJava = textLower.includes('java') || textLower.includes('dsa');
  const isPython = textLower.includes('python') || textLower.includes('backend') || textLower.includes('django') || textLower.includes('fastapi');
  const isReact = textLower.includes('react') || textLower.includes('frontend') || textLower.includes('js') || textLower.includes('javascript') || textLower.includes('next');
  const isTravel = textLower.includes('travel') || textLower.includes('trip') || textLower.includes('tour') || textLower.includes('vacation');
  const isFitness = textLower.includes('fitness') || textLower.includes('workout') || textLower.includes('gym') || textLower.includes('diet') || textLower.includes('health');
  
  function getOffsetDateStr(offsetDays) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }
  
  for (let i = 1; i <= daysCount; i++) {
    const groupName = daysCount > 1 ? `Day ${i}` : null;
    let title = "";
    let category = "General";
    let priority = "medium";
    let desc = "";
    let subtasks = [];
    
    if (isJava) {
      category = "DSA";
      priority = i % 2 === 0 ? "high" : "medium";
      if (mode === 'single') {
        title = `Java & DSA checklist for "${prompt}"`;
        desc = `Key steps to master Java DSA algorithms.`;
        subtasks = [
          "Study Array structures & common access methods",
          "Practice Strings & Basic Sorting (Bubble, Selection, Insertion)",
          "Solve 3 recursion/backtracking problems",
          "Revise Space and Time complexity limits"
        ];
      } else {
        title = `Java DSA: Steps & Coding - Day ${i}`;
        desc = `Focus on specific DSA topics and implementation.`;
        if (i === 1) {
          subtasks = ["Install JDK & configure IDE", "Variables, Data Types, and Operators", "Practice loops & conditionals", "Solve 5 basic logic code snippets"];
        } else if (i === 2) {
          subtasks = ["Arrays representation in memory", "Implement Binary Search algorithm", "Solve 'Two Sum' problem", "Revise sorting limits"];
        } else if (i === 3) {
          subtasks = ["Recursion basics & Call Stacks", "Compute fibonacci & factorial recursively", "Solve String Palindrome via recursion", "Review stack trace"];
        } else if (i === 4) {
          subtasks = ["Linked List representation", "Implement reverse LinkedList function", "Detect cycles in a LinkedList", "Revise pointers"];
        } else {
          subtasks = ["Binary Trees structures", "Pre/In/Post Order traversals", "Solve LeetCode #104 (Max Depth)", "Review core concepts & submit codes"];
        }
      }
    } else if (isPython) {
      category = "Backend";
      priority = "high";
      if (mode === 'single') {
        title = `Python Backend Plan for "${prompt}"`;
        desc = `Key aspects of Python backend infrastructure.`;
        subtasks = [
          "Write clean modular Python scripts using functions and classes",
          "Configure FastAPI server with routing pathways",
          "Implement SQL databases using SQLite or Postgres",
          "Verify POST/GET/PUT/DELETE API endpoints"
        ];
      } else {
        title = `Python & Backend development - Day ${i}`;
        desc = `Daily goals focusing on backend capabilities.`;
        if (i === 1) {
          subtasks = ["Set up Python Virtual Environment (venv)", "Review Python standard collections (list, dict, tuple)", "Learn context managers (with statement)", "Write simple script parsing arguments"];
        } else if (i === 2) {
          subtasks = ["Install FastAPI and Uvicorn", "Create a basic Hello World endpoint", "Set up JSON request payload validation", "Test routes using Interactive Swagger UI"];
        } else if (i === 3) {
          subtasks = ["Install SQLAlchemy ORM", "Write database models (User, Task)", "Set up local SQLite connection script", "Perform basic migrations check"];
        } else {
          subtasks = ["Build CRUD API endpoints for resources", "Add exception handlers and custom status codes", "Implement CORS policies setup", "Export database seeds for testing"];
        }
      }
    } else if (isReact) {
      category = "Frontend";
      priority = "medium";
      if (mode === 'single') {
        title = `React & Frontend steps for "${prompt}"`;
        desc = `Crucial items to build stunning web interfaces.`;
        subtasks = [
          "Understand component lifecycle and useEffect rules",
          "Integrate clean styling and custom CSS variables",
          "Perform API fetches using async/await syntax",
          "Configure responsive layouts for mobile and web screens"
        ];
      } else {
        title = `Frontend Engineering - Day ${i}`;
        desc = `Step-by-step dashboard components.`;
        if (i === 1) {
          subtasks = ["Scaffold application with Vite React", "Clean up placeholder styles and code", "Build index.css styling system", "Structure primary components folder"];
        } else if (i === 2) {
          subtasks = ["Build Task card component layout", "Integrate state management using useState hook", "Verify checklist clicking toggle triggers state", "Add smooth scaling animation keyframes"];
        } else if (i === 3) {
          subtasks = ["Configure search filters and categories filter tabs", "Add debouncing logic to search inputs", "Save state to localStorage on modification", "Validate dark mode styles"];
        } else {
          subtasks = ["Connect mock generator and fetch states", "Handle loader spinners and progress rate variables", "Audit responsiveness on multiple viewports", "Build static release zip"];
        }
      }
    } else if (isTravel) {
      category = "Personal";
      priority = "low";
      if (mode === 'single') {
        title = `Travel Schedule: ${prompt}`;
        desc = `Essential travel preparation details.`;
        subtasks = [
          "Review passport expiry and visa deadlines",
          "Book primary accommodations and flight codes",
          "Pack appropriate clothing and weather gears",
          "Draft itinerary and key spots list"
        ];
      } else {
        title = `Trip Planning Checklist - Day ${i}`;
        desc = `Detailed preparation steps for your upcoming trip.`;
        if (i === 1) {
          subtasks = ["Research top 5 places to visit", "Create a daily timeline sheet", "Check average weather forecasts", "Determine transport budgets"];
        } else if (i === 2) {
          subtasks = ["Book hotel stays or hostels", "Verify cancellation windows", "Compare train passes / car rental details", "Set up emergency contacts sheet"];
        } else {
          subtasks = ["Pack essential electronic chargers & adapters", "Download offline maps for navigation", "Exchange minimal local currency cash", "Confirm final departure timings"];
        }
      }
    } else if (isFitness) {
      category = "Personal";
      priority = "medium";
      if (mode === 'single') {
        title = `Fitness & Health Checklist: ${prompt}`;
        desc = `Daily physical goals tracker.`;
        subtasks = [
          "Achieve minimum 8,000 steps daily count",
          "Hydrate with at least 3 liters of water",
          "Complete 30 minutes strength or core training",
          "Avoid processed sugars and pre-packed foods"
        ];
      } else {
        title = `Fitness & Workout Plan - Day ${i}`;
        desc = `Daily conditioning targets.`;
        if (i === 1) {
          subtasks = ["Record start weight and body indexes", "Define core weekly workout days calendar", "Prepare grocery lists of healthy proteins", "Do baseline stretching check"];
        } else if (i === 2) {
          subtasks = ["25 minutes full-body bodyweight circuit", "Record protein and carb intake indexes", "Track heart rate averages during exercise", "Stretch major muscle groups"];
        } else {
          subtasks = ["Perform cardio workout (brisk walk/run/cycle)", "Maintain hydration logging", "Prep meals for upcoming days", "Assess muscle recovery and sleep patterns"];
        }
      }
    } else {
      category = "General";
      priority = "medium";
      if (mode === 'single') {
        title = `Task List for "${prompt}"`;
        desc = `Strategic guidelines generated for: ${prompt}`;
        subtasks = [
          "Define specific deliverables and clear milestones",
          "Execute initial setup and environment parameters",
          "Develop core functions/details step by step",
          "Perform verification tests and clean up tasks"
        ];
      } else {
        title = `AI Planned Roadmap: Step ${i}`;
        desc = `Guided checklist item for "${prompt}".`;
        if (i === 1) {
          subtasks = ["Research background information", "Outline target requirements", "Gather reference documents & resources", "Set milestones deadlines"];
        } else if (i === 2) {
          subtasks = ["Build initial structure & skeleton templates", "Solve first priority blocking obstacles", "Review work progress", "Draft user documentation rules"];
        } else if (i === 3) {
          subtasks = ["Refine UI styles or code syntax", "Test boundary conditions & edge errors", "Collect feedback from user reviews", "Deploy final deliverables"];
        } else {
          subtasks = ["Document lessons learned during task execution", "Set up automated reminders", "Back up source configurations data", "Revise next planning schedules"];
        }
      }
    }
    
    generatedTasks.push({
      title: title,
      description: desc,
      category: category,
      priority: priority,
      dueDate: getOffsetDateStr(i - 1),
      groupName: groupName,
      completed: false,
      subtasks: subtasks.map((sub, sIdx) => ({
        title: sub,
        completed: false
      }))
    });
  }
  
  try {
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generatedTasks)
    });
    
    if (res.ok) {
      showToast(`Generated ${generatedTasks.length} tasks matching "${prompt}"!`);
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Failed to save generated tasks to database.", "danger");
  }
}

// Live Gemini API Request
async function generateWithLiveAI(prompt, mode) {
  const apiKey = state.settings.apiKey;
  const model = state.settings.model;
  
  let daysText = "a single checklist";
  if (mode !== 'single') {
    daysText = `a multi-day roadmap of ${mode} days`;
  }
  
  const systemPrompt = `You are an expert project planner and AI task assistant.
Your goal is to break down the user's objective into highly structured, actionable tasks and checklist items.
The user's objective: "${prompt}".
Please organize this as ${daysText}.

Generate and return ONLY a valid JSON array of task objects matching this exact structure:
[
  {
    "title": "Task title (must be clear, concise, actionable)",
    "description": "Short explanation of details or why this is important",
    "category": "Category name (e.g. Research, Setup, Frontend, Backend, Coding, Personal, Work)",
    "priority": "low" | "medium" | "high",
    "dueDateOffset": 0, // integer representing which day this belongs to relative to today (0 for today, 1 for tomorrow, etc.)
    "groupName": "Day 1" // name of group, e.g. "Day 1", "Day 2" (omit or leave empty if a single checklist)
    "subtasks": [
      "Subtask / checklist item title 1",
      "Subtask / checklist item title 2",
      "Subtask / checklist item title 3"
    ]
  }
]

CRITICAL RULES:
1. Return ONLY the raw JSON array. DO NOT wrap it in markdown backticks (\`\`\`json ... \`\`\`).
2. Make sure the output is pure valid JSON parsing friendly. No trailing commas, no unescaped quotes.
3. Every task must have a category (keep standard labels like Research, Setup, Frontend, Backend, Work, Personal).
4. Subtasks are mandatory to provide granular milestones.
5. Translate the days to integer offsets correctly starting from 0.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: systemPrompt }]
      }]
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP error ${response.status}`;
    throw new Error(message);
  }
  
  const resData = await response.json();
  let textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("Empty response returned from Gemini API.");
  }
  
  textResponse = textResponse.trim();
  if (textResponse.startsWith('```')) {
    textResponse = textResponse.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  
  let parsedTasks = [];
  try {
    parsedTasks = JSON.parse(textResponse);
  } catch (e) {
    console.error("Failed to parse JSON directly. API Output:", textResponse);
    throw new Error("The AI returned a malformed response that could not be parsed as JSON. Please try again.");
  }
  
  if (!Array.isArray(parsedTasks)) {
    throw new Error("The AI returned data that is not a list/array of tasks.");
  }
  
  const baseDate = new Date();
  
  const formattedTasks = parsedTasks.map((t) => {
    const offset = parseInt(t.dueDateOffset) || 0;
    const taskDate = new Date(baseDate);
    taskDate.setDate(baseDate.getDate() + offset);
    const dateStr = taskDate.toISOString().split('T')[0];
    
    return {
      title: t.title || "Untitled AI Task",
      description: t.description || "",
      category: t.category || "General",
      priority: t.priority || "medium",
      dueDate: dateStr,
      groupName: t.groupName || null,
      completed: false,
      subtasks: (t.subtasks || []).map((sub) => ({
        title: sub,
        completed: false
      }))
    };
  });
  
  try {
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedTasks)
    });
    
    if (res.ok) {
      showToast(`Successfully generated ${formattedTasks.length} tasks using Gemini AI!`);
      await syncWithDatabase();
    }
  } catch (err) {
    showToast("Failed to save AI generated tasks to database.", "danger");
  }
}

// Test Connection with Gemini API
async function testAPIKey() {
  const apiKey = elements.settingsApiKey.value.trim();
  const model = elements.settingsModel.value;
  
  if (!apiKey) {
    showTestStatus("Please enter an API Key to test.", "danger");
    return;
  }
  
  showTestStatus("Testing connection...", "warning");
  elements.btnTestKey.disabled = true;
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello, this is a test.' }] }]
      })
    });
    
    if (response.ok) {
      showTestStatus("API connection successful!", "success");
    } else {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status}`;
      showTestStatus(`API Error: ${message}`, "danger");
    }
  } catch (err) {
    showTestStatus(`Failed to connect: ${err.message}`, "danger");
  } finally {
    elements.btnTestKey.disabled = false;
  }
}

function showTestStatus(msg, type) {
  if (elements.settingsTestStatus) {
    elements.settingsTestStatus.style.display = 'block';
    elements.settingsTestStatus.textContent = msg;
    elements.settingsTestStatus.className = '';
    if (type === 'success') elements.settingsTestStatus.style.color = 'var(--success)';
    if (type === 'warning') elements.settingsTestStatus.style.color = 'var(--warning)';
    if (type === 'danger') elements.settingsTestStatus.style.color = 'var(--danger)';
  }
}

// Toast Notifications Helper
function showToast(message, type = "success") {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = 'var(--radius-md)';
  toast.style.color = 'white';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '600';
  toast.style.zIndex = '10000';
  toast.style.boxShadow = 'var(--shadow-lg)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.style.transition = 'all 0.3s ease';
  toast.style.transform = 'translateY(100px)';
  toast.style.opacity = '0';
  
  if (type === "success") {
    toast.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
  } else if (type === "warning") {
    toast.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
  } else {
    toast.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${message}`;
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    toast.style.transform = 'translateY(100px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Render Dashboard & Task Cards
function render() {
  const filteredTasks = state.tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(state.searchQuery) ||
                          task.description.toLowerCase().includes(state.searchQuery) ||
                          (task.groupName && task.groupName.toLowerCase().includes(state.searchQuery));
    
    if (!matchesSearch) return false;
    
    if (state.filter === 'completed') return task.completed;
    if (state.filter === 'high') return task.priority === 'high' && !task.completed;
    
    if (state.filter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate === today && !task.completed;
    }
    
    if (state.filter === 'upcoming') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate > today && !task.completed;
    }
    
    return true;
  });
  
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    const prioScore = { high: 3, medium: 2, low: 1 };
    const scoreDiff = prioScore[b.priority] - prioScore[a.priority];
    if (scoreDiff !== 0) return scoreDiff;
    
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return 0;
  });
  
  renderTasks(filteredTasks);
  updateStats();
}

function renderTasks(taskList) {
  elements.taskGrid.innerHTML = '';
  
  if (taskList.length === 0) {
    elements.taskGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-list-check"></i></div>
        <h3>No tasks found</h3>
        <p>${state.tasks.length === 0 ? "Get started by adding tasks manually or creating an AI roadmap!" : "Adjust your search parameters or select a different filter."}</p>
      </div>
    `;
    return;
  }
  
  taskList.forEach(task => {
    const taskCard = document.createElement('article');
    taskCard.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    taskCard.setAttribute('aria-label', `${task.title} - ${task.priority} priority`);
    
    let dueHtml = '';
    if (task.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const isOverdue = task.dueDate < today && !task.completed;
      dueHtml = `
        <div class="task-due ${isOverdue ? 'overdue' : ''}">
          <i class="fa-regular fa-calendar-days"></i>
          <span>${formatDateStr(task.dueDate)} ${isOverdue ? '(Overdue)' : ''}</span>
        </div>
      `;
    }
    
    const completedSub = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
    const totalSub = task.subtasks ? task.subtasks.length : 0;
    const hasSubtasks = totalSub > 0;
    
    let subtasksHtml = '';
    if (hasSubtasks) {
      subtasksHtml = `
        <div class="subtasks-container">
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>Subtasks Checklist</span>
            <span>${completedSub}/${totalSub} Done</span>
          </div>
          ${task.subtasks.map(sub => `
            <div class="subtask-item ${sub.completed ? 'completed' : ''}">
              <div class="subtask-checkbox ${sub.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleSubtask('${task.id}', '${sub.id}')"></div>
              <span>${sub.title}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    taskCard.innerHTML = `
      <div class="task-header">
        <div class="task-meta">
          <span class="tag tag-category">${task.category}</span>
          ${task.groupName ? `<span class="tag tag-group">${task.groupName}</span>` : ''}
        </div>
        <div class="task-actions">
          <button class="action-btn btn-edit" title="Edit task" aria-label="Edit task" onclick="event.stopPropagation(); editTask('${task.id}')">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="action-btn btn-delete" title="Delete task" aria-label="Delete task" onclick="event.stopPropagation(); deleteTask('${task.id}')">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
      
      <div class="task-title-area">
        <label class="checkbox-container" onclick="event.stopPropagation();">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
          <span class="checkmark"></span>
        </label>
        <h3 class="task-title">${task.title}</h3>
      </div>
      
      ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
      
      ${subtasksHtml}
      
      <div class="task-footer">
        ${dueHtml}
        <div style="text-transform: capitalize; font-weight: 600; color: ${task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--accent-tertiary)'}">
          ${task.priority} Priority
        </div>
      </div>
    `;
    
    taskCard.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('.checkbox-container') && !e.target.closest('.subtask-checkbox')) {
        openTaskModal(task);
      }
    });
    
    elements.taskGrid.appendChild(taskCard);
  });
}

function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    openTaskModal(task);
  }
}

// Global functions exposed so inline onclick tags can access them
window.toggleSubtask = toggleSubtask;
window.toggleTask = toggleTask;
window.editTask = editTask;
window.deleteTask = deleteTask;

function updateStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  if (elements.statsTotal) elements.statsTotal.textContent = total;
  if (elements.statsPending) elements.statsPending.textContent = pending;
  if (elements.statsCompleted) elements.statsCompleted.textContent = completed;
  if (elements.statsProgressPercent) elements.statsProgressPercent.textContent = `${percent}%`;
  if (elements.statsCompletionRate) elements.statsCompletionRate.textContent = `${percent}%`;
  
  if (elements.progressCircle) {
    const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
    elements.progressCircle.style.strokeDashoffset = offset;
  }
}

// Helper to Format dates nicely
function formatDateStr(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
