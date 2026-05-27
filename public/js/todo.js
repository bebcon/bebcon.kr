// /public/js/todo.js
document.addEventListener('DOMContentLoaded', () => {
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');

  // 로그인 사용자명 가져오기 (문자열/JSON 둘 다 대응)
  const getLoggedInUsername = () => {
    const raw = localStorage.getItem('loggedInUser');
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.username) return String(parsed.username);
    } catch (_) {
      // raw string 그대로 사용
    }

    const s = String(raw).trim();
    return s.replace(/^"(.*)"$/, '$1');
  };

  const username = getLoggedInUsername();

  if (!username) {
    alert('로그인이 필요한 서비스입니다.');
    window.location.href = '/login';
    return;
  }

  const toast = (msg, type) => {
    if (typeof showToast === 'function') showToast(msg, type);
    // showToast 없으면 그냥 무시 (원하면 Toastify로 바꿀 수도 있음)
  };

  // 공통 fetch 헬퍼 (에러 메시지까지 최대한 출력)
  const api = async (url, options = {}) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (res.status === 401) {
      alert('로그인이 필요합니다.');
      window.location.href = '/login';
      return null;
    }

    if (!res.ok) {
      let msg = `요청 실패 (${res.status})`;
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch (_) {}
      throw new Error(msg);
    }

    // 응답이 JSON이 아닐 수도 있으니 안전 처리
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ko-KR');
  };

  // 렌더링
  const renderTodos = (todos) => {
    todoList.innerHTML = '';

    if (!Array.isArray(todos) || todos.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    todos.forEach((todo) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.isCompleted ? 'completed' : ''}`;
      li.dataset.id = todo.id;

      // wrapper 전체 클릭 = 토글
      const wrapper = document.createElement('div');
      wrapper.className = 'todo-content-wrapper';
      wrapper.title = '클릭하면 완료/해제';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = !!todo.isCompleted;
      // CSS에서 pointer-events: none이라 클릭 이벤트는 wrapper가 받게 됨

      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.content ?? '';

      const date = document.createElement('span');
      date.className = 'todo-date';
      date.textContent = formatDate(todo.createdAt);

      wrapper.appendChild(checkbox);
      wrapper.appendChild(text);
      wrapper.appendChild(date);

      wrapper.addEventListener('click', async () => {
        try {
          await api(`/api/todos/${todo.id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ username }),
          });
          await fetchTodos();
        } catch (err) {
          console.error(err);
          toast(err.message || '상태 변경 실패', 'error');
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-todo-btn';
      delBtn.type = 'button';
      delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
      delBtn.title = '삭제';

      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // 토글 클릭 방지
        if (!confirm('삭제하시겠습니까?')) return;

        try {
          await api(`/api/todos/${todo.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ username }),
          });
          toast('삭제되었습니다.', 'info');
          await fetchTodos();
        } catch (err) {
          console.error(err);
          toast(err.message || '삭제 실패', 'error');
        }
      });

      li.appendChild(wrapper);
      li.appendChild(delBtn);
      todoList.appendChild(li);
    });
  };

  // 목록 불러오기
  async function fetchTodos() {
    try {
      const todos = await api(`/api/todos?username=${encodeURIComponent(username)}`);
      if (!todos) return; // 401 등으로 redirect 처리된 경우
      renderTodos(todos);
    } catch (err) {
      console.error('Todo fetch error:', err);
      toast(err.message || '목록 불러오기 실패', 'error');
    }
  }

  // 할 일 추가
  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = todoInput.value.trim();
    if (!content) return;

    try {
      await api('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ username, content }),
      });

      todoInput.value = '';
      toast('할 일이 추가되었습니다.', 'success');
      await fetchTodos();
    } catch (err) {
      console.error(err);
      toast(err.message || '추가 실패', 'error');
    }
  });

  fetchTodos();
});
