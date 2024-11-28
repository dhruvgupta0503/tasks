const API_URL = 'https://asg-backend.techzy.workers.dev';
let token = localStorage.getItem('token');

function showLoading() {
  document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingScreen').classList.add('hidden');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `transform transition-all duration-300 ease-out translate-x-full
    ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}
    text-white px-6 py-3 rounded-lg shadow-2xl flex items-center`;
  
  toast.innerHTML = `
    <div class="flex-1">${message}</div>
    <button class="ml-4 hover:text-gray-200">×</button>
  `;
  
  document.getElementById('toastContainer').appendChild(toast);
  
  setTimeout(() => toast.classList.remove('translate-x-full'), 10);
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  toast.querySelector('button').addEventListener('click', () => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  });
}

async function loadStats() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/tasks/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        showLogin();
        return;
      }
      throw new Error('Failed to load statistics');
    }
    
    const stats = await response.json();
    
    document.getElementById('totalTasks').textContent = stats.totalTasks;
    document.getElementById('completedTasks').textContent = stats.completedTasks;
    document.getElementById('pendingTasks').textContent = stats.pendingTasks;
    document.getElementById('completionRate').textContent = `${stats.completionRate}%`;
    document.getElementById('avgCompletionTime').textContent = `${stats.averageCompletionTime}h`;
    
    const metricsContainer = document.getElementById('priorityMetrics');
    metricsContainer.innerHTML = stats.priorityTimeMetrics
      .sort((a, b) => a.priority - b.priority)
      .map(metric => `
        <div class="flex justify-between items-center">
          <span class="font-medium">Priority ${metric.priority}:</span>
          <span class="text-gray-600">${metric.avgTimeLapsed.toFixed(1)}h elapsed,
          ${metric.avgTimeLeft.toFixed(1)}h left</span>
        </div>
      `).join('');
    
    showToast('Statistics updated successfully');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function showDashboard() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadTasks();
}

function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  localStorage.removeItem('token');
  token = null;
}

async function login(email, password) {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Invalid credentials' : 'Login failed');
    }
    
    const data = await response.json();
    localStorage.setItem('token', data.token);
    token = data.token;
    showToast('Successfully logged in');
    showDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function loadTasks() {
  showLoading();
  try {
    const priority = document.getElementById('filterPriority').value;
    const status = document.getElementById('filterStatus').value;
    const sort = document.getElementById('sortBy').value;
    
    const params = new URLSearchParams();
    if (priority) params.append('priority', priority);
    if (status) params.append('status', status);
    if (sort) params.append('sort', sort);
    
    const response = await fetch(`${API_URL}/tasks?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        showLogin();
        return;
      }
      throw new Error('Failed to load tasks');
    }
    
    const tasks = await response.json();
    updateTaskList(tasks.results);
    await loadStats();
    showToast('Tasks loaded successfully');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function createTask(title, startTime, endTime, priority) {
  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        start_time: startTime,
        end_time: endTime,
        priority: parseInt(priority),
      }),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        showLogin();
        return;
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to create task');
    }
    
    showToast('Task created successfully');
    loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updateTaskList(tasks) {
  const taskList = document.getElementById('taskList');

  const els = tasks.map(task => {
    const div = document.createElement('div');
    div.className = 'bg-white p-4 rounded-lg shadow-md';
    
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">${task.title}</h3>
        <span class="px-2 py-1 rounded text-sm ${
          task.status === 'finished' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }">${task.status}</span>
      </div>
      <div class="mt-2 text-sm text-gray-600">
        <div>Priority: ${task.priority}</div>
        <div>Start: ${new Date(task.start_time).toLocaleString()}</div>
        <div>End: ${new Date(task.end_time).toLocaleString()}</div>
      </div>
      <div class="mt-4 flex justify-end space-x-2">
        ${task.status === 'pending' ? `
          <button class="update px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            Mark as Complete
          </button>
        ` : `
          <button class="update px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">
            Re Open
          </button>
        `}
        <button onclick="deleteTask('${task.id}')"
            class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
          Delete
        </button>
      </div>
    `;

    async function updateTaskStatus() {
      const id = task.id;
      const status = task.status === 'pending' ? 'finished' : 'pending';
      task.status = status;

      try {
        showLoading();
        const taskResp = await fetch(`${API_URL}/tasks/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(task),
        });
        
        if (!taskResp.ok) {
          throw new Error('Failed to update task status');
        }
        
        loadTasks();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        hideLoading();
      }
    }

    div.querySelector('button.update')?.addEventListener('click', updateTaskStatus);
    return div;
  });

  taskList.innerHTML = '';
  els.forEach(el => taskList.appendChild(el));
}

async function deleteTask(id) {
  try {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        showLogin();
        return;
      }
      throw new Error('Failed to delete task');
    }
    
    showToast('Task deleted successfully');
    loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  await login(email, password);
});

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const priority = document.getElementById('priority').value;
  
  await createTask(title, startTime, endTime, priority);
  e.target.reset();
});

document.getElementById('logoutBtn').addEventListener('click', showLogin);

['filterPriority', 'filterStatus', 'sortBy'].forEach(id => {
  document.getElementById(id).addEventListener('change', loadTasks);
});

if (token) {
  showDashboard();
}