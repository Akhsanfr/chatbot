// DOM Elements
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitButton = document.getElementById('send-button') || chatForm.querySelector('button[type="submit"]');

// Stores conversation history for multi-turn context
// Format: [{ role: 'user' | 'model', text: string }]
const conversationHistory = [];

/**
 * Converts basic markdown formatting into safe HTML (XSS protected)
 * Supports bold, italic, headings, lists, inline code, and code blocks.
 * @param {string} text 
 * @returns {string} Safe HTML string
 */
function formatMarkdown(text) {
  if (!text) return '';

  // 1. Sanitize HTML to prevent XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Code blocks (```code```)
  escaped = escaped.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // 3. Inline code (`code`)
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. Bold (**text** or __text__)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // 5. Italic (*text* or _text_)
  escaped = escaped.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  escaped = escaped.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');

  // 6. Headings (###, ##, #)
  escaped = escaped.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // 7. Parse lists and paragraphs
  const lines = escaped.split('\n');
  let inUl = false;
  let inOl = false;
  const processed = [];

  for (let line of lines) {
    const trimmed = line.trim();

    const ulMatch = trimmed.match(/^[\*\-]\s+(.*)/);
    const olMatch = trimmed.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) { processed.push('</ol>'); inOl = false; }
      if (!inUl) { processed.push('<ul>'); inUl = true; }
      processed.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) { processed.push('</ul>'); inUl = false; }
      if (!inOl) { processed.push('<ol>'); inOl = true; }
      processed.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) { processed.push('</ul>'); inUl = false; }
      if (inOl) { processed.push('</ol>'); inOl = false; }

      if (trimmed === '') {
        processed.push('<div class="spacer"></div>');
      } else if (!trimmed.startsWith('<h') && !trimmed.startsWith('<pre')) {
        processed.push(`<p>${trimmed}</p>`);
      } else {
        processed.push(trimmed);
      }
    }
  }

  if (inUl) processed.push('</ul>');
  if (inOl) processed.push('</ol>');

  return processed.join('');
}

/**
 * Creates an animated typing indicator
 * @returns {HTMLDivElement}
 */
function createTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  return indicator;
}

/**
 * Appends a message to the chat box
 * @param {'user' | 'bot'} sender
 * @param {string | HTMLElement} content
 * @param {boolean} isHtml
 * @returns {HTMLDivElement}
 */
function appendMessage(sender, content, isHtml = false) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);

  if (content instanceof HTMLElement) {
    msg.appendChild(content);
  } else if (isHtml) {
    msg.innerHTML = content;
  } else {
    msg.textContent = content;
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

// Add an initial welcome message from the assistant
appendMessage('bot', formatMarkdown(
  'Halo! Saya **Asisten AI** bertema *Blue Ocean* 🌊.\nAda yang bisa saya bantu hari ini?'
), true);

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  // 1. Display user message
  appendMessage('user', userMessage);

  // 2. Clear & disable inputs during processing
  userInput.value = '';
  userInput.disabled = true;
  if (submitButton) submitButton.disabled = true;

  // 3. Update conversation history
  conversationHistory.push({ role: 'user', text: userMessage });

  // 4. Show animated thinking indicator
  const botMessageElement = appendMessage('bot', createTypingIndicator());

  try {
    // 5. Send API request
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation: conversationHistory }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();

    // 6. Render formatted response (supporting bold, italic, lists, etc.)
    if (data && typeof data.result === 'string' && data.result.trim() !== '') {
      botMessageElement.innerHTML = formatMarkdown(data.result);
      conversationHistory.push({ role: 'model', text: data.result });
    } else {
      botMessageElement.innerHTML = '<p>Maaf, tidak ada respon yang diterima.</p>';
      conversationHistory.pop();
    }
  } catch (error) {
    console.error('Chat error:', error);
    botMessageElement.innerHTML = '<p>Gagal mendapatkan respon dari server.</p>';
    conversationHistory.pop();
  } finally {
    // 7. Re-enable form controls & scroll to bottom
    userInput.disabled = false;
    if (submitButton) submitButton.disabled = false;
    userInput.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
