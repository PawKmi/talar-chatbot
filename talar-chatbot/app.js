// ── CONSTANTS ──────────────────────────────────────────

const STORAGE_KEY = 'talar_chatbot_v1';

const WELCOME_MSG = 'Witam. To ja, Andrzej Talar grany przez Tomasza Borkowy w serialu "Dom". Tym razem to nie on mówi za mnie, ale ja mam własny glos - bo jestem wykreowany przez AI. Mogę móić nie tylko o sobie, ale i o moim aktorze. Pytaj, ja Ci odpowiem.';

// ── STATE ───────────────────────────────────────────────

let conversations = [];
let activeId = null;

// ── STORAGE ─────────────────────────────────────────────

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      conversations = data.conversations || [];
      activeId = data.activeId || null;
    }
  } catch (e) {
    conversations = [];
    activeId = null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, activeId }));
}

// ── CONVERSATION MANAGEMENT ──────────────────────────────

function generateId() {
  return 'c' + Date.now() + Math.random().toString(36).slice(2, 7);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function createConversation() {
  const id = generateId();
  const conv = {
    id,
    title: 'Nowa rozmowa',
    createdAt: new Date().toISOString(),
    messages: [],
  };
  conversations.unshift(conv);
  activeId = id;
  saveState();
  renderSidebar();
  renderMessages();

  focusInput();
}

function getActive() {
  return conversations.find(c => c.id === activeId) || null;
}

function switchConversation(id) {
  activeId = id;
  saveState();
  renderSidebar();
  renderMessages();
  closeSidebarOnMobile();
  focusInput();
}

function deleteConversation(id, event) {
  event.stopPropagation();
  conversations = conversations.filter(c => c.id !== id);
  if (activeId === id) {
    activeId = conversations.length > 0 ? conversations[0].id : null;
  }
  saveState();
  renderSidebar();
  renderMessages();
}

function updateTitle(id, text) {
  const conv = conversations.find(c => c.id === id);
  if (conv && conv.title === 'Nowa rozmowa') {
    conv.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
    saveState();
    renderSidebar();
  }
}

// ── RENDER SIDEBAR ──────────────────────────────────────

function renderSidebar() {
  const list = document.getElementById('conversations-list');

  if (conversations.length === 0) {
    list.innerHTML = `<div style="padding:24px 16px;color:#555;font-size:13px;text-align:center">
      Brak rozmów.<br>Kliknij <strong>+</strong> żeby zacząć.
    </div>`;
    return;
  }

  list.innerHTML = conversations.map(conv => `
    <div class="conv-item ${conv.id === activeId ? 'active' : ''}"
         onclick="switchConversation('${conv.id}')">
      <div class="conv-avatar">TB</div>
      <div class="conv-info">
        <div class="conv-title">${escapeHtml(conv.title)}</div>
        <div class="conv-date">${formatDate(conv.createdAt)}</div>
      </div>
      <button class="conv-delete" onclick="deleteConversation('${conv.id}', event)" title="Usuń">&#215;</button>
    </div>
  `).join('');
}

// ── RENDER MESSAGES ─────────────────────────────────────

function renderMessages() {
  const el = document.getElementById('messages');
  const conv = getActive();

  if (!conv) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-avatar">TB</div>
        <strong>Tomasz Borkowy</strong>
        <p>Kliknij <strong>+</strong> w panelu po lewej, żeby rozpocząć nową rozmowę.</p>
      </div>`;
    return;
  }

  el.innerHTML = '';

  // Welcome message always appears first
  appendWelcome();

  // Then stored messages
  if (conv.messages.length > 0) {
    renderMessageGroup(conv.messages);
  }

  scrollToBottom();
}

function renderMessageGroup(messages) {
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const samePrev = prev && prev.role === msg.role;
    const sameNext = next && next.role === msg.role;

    let pos = 'single';
    if (!samePrev && sameNext)  pos = 'first';
    if (samePrev && sameNext)   pos = 'middle';
    if (samePrev && !sameNext)  pos = 'last';

    appendBubble(msg.role, msg.content, pos);
  });
}

function appendWelcome() {
  appendBubble('bot', WELCOME_MSG, 'single');
}

function appendBubble(role, text, pos = 'single') {
  const el = document.getElementById('messages');

  const row = document.createElement('div');
  row.className = `msg-row ${role} ${pos}`;

  if (role === 'bot') {
    const av = document.createElement('div');
    av.className = 'msg-avatar' + (pos === 'last' || pos === 'single' ? '' : ' hidden');
    av.textContent = 'TB';
    row.appendChild(av);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);

  el.appendChild(row);
  return row;
}

function showTyping() {
  const el = document.getElementById('messages');
  const row = document.createElement('div');
  row.className = 'msg-row bot typing';
  row.id = 'typing-indicator';

  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = 'TB';
  row.appendChild(av);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  row.appendChild(bubble);

  el.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

// ── SEND MESSAGE ────────────────────────────────────────

async function sendMessage(text) {
  const conv = getActive();
  if (!conv) return;

  // Update title from first user message
  updateTitle(conv.id, text);

  // Add user message to state and DOM
  conv.messages.push({ role: 'user', content: text });
  saveState();

  const userIdx = conv.messages.length - 1;
  const prevMsg = conv.messages[userIdx - 1];
  const samePrev = prevMsg && prevMsg.role === 'user';
  appendBubble('user', text, samePrev ? 'last' : 'single');
  scrollToBottom();

  setDisabled(true);
  showTyping();

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conv.messages }),
    });

    const data = await response.json();
    hideTyping();

    if (!response.ok || data.error) throw new Error(data.error || 'Błąd serwera');

    conv.messages.push({ role: 'assistant', content: data.content });
    saveState();
    appendBubble('bot', data.content, 'single');
    scrollToBottom();

  } catch (err) {
    hideTyping();
    conv.messages.pop();
    saveState();
    appendBubble('bot', 'Przepraszam, coś poszło nie tak. Proszę spróbować jeszcze raz.', 'single');
    scrollToBottom();
  } finally {
    setDisabled(false);
    focusInput();
  }
}

// ── HELPERS ─────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function focusInput() {
  document.getElementById('user-input').focus();
}

function setDisabled(disabled) {
  document.getElementById('send-btn').disabled = disabled;
  document.getElementById('user-input').disabled = disabled;
}

function closeSidebarOnMobile() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── EVENT LISTENERS ─────────────────────────────────────

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text);
});

document.getElementById('new-chat-btn').addEventListener('click', () => {
  createConversation();
  closeSidebarOnMobile();
});

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
});

document.getElementById('sidebar-overlay').addEventListener('click', closeSidebarOnMobile);

// ── INIT ────────────────────────────────────────────────

loadState();

if (conversations.length === 0 || !activeId) {
  createConversation();
} else {
  renderSidebar();
  renderMessages();
  focusInput();
}
