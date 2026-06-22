function initNotes() {
  renderSidebar();
}

function renderSidebar() {
  const list = document.getElementById('notes-subject-list');
  if (!list) return;

  list.innerHTML = '';
  Object.entries(NOTES_DATA).forEach(([subject, data]) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="notes-subject-btn" data-subject="${subject}">
        <span class="notes-subject-dot" style="background:${data.color}"></span>
        ${subject}
      </button>
    `;
    li.querySelector('button').addEventListener('click', () => {
      document.querySelectorAll('.notes-subject-btn').forEach(b => b.classList.remove('active'));
      li.querySelector('button').classList.add('active');
      loadSubjectNotes(subject);
    });
    list.appendChild(li);
  });
}

function loadSubjectNotes(subject) {
  const data = NOTES_DATA[subject];
  if (!data) return;

  const content = document.getElementById('notes-content');
  content.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'notes-subject-header';
  header.innerHTML = `
    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${data.color};flex-shrink:0"></span>
    <h2 class="notes-subject-title">${subject}</h2>
    <span style="font-size:.8rem;color:#64748b;margin-left:auto">${data.sections.length}セクション</span>
  `;
  content.appendChild(header);

  data.sections.forEach((section, idx) => {
    const el = createAccordion(section, idx === 0);
    content.appendChild(el);
  });
}

function createAccordion(section, openByDefault) {
  const wrap = document.createElement('div');
  wrap.className = 'note-section';

  const headerBtn = document.createElement('button');
  headerBtn.className = 'note-section-header';
  headerBtn.setAttribute('aria-expanded', openByDefault ? 'true' : 'false');
  headerBtn.innerHTML = `
    <span>${section.title}</span>
    <span class="chevron">▼</span>
  `;

  const body = document.createElement('div');
  body.className = 'note-section-body' + (openByDefault ? ' open' : '');

  section.items.forEach(item => {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-item';

    const tagsHtml = (item.tags || []).map(t => {
      const labels = { law: '条文', case: '判例', term: '用語' };
      return `<span class="note-tag ${t}">${labels[t] || t}</span>`;
    }).join('');

    noteEl.innerHTML = `<div class="note-item-heading">${item.heading}${tagsHtml}</div>`;

    const ul = document.createElement('ul');
    (item.content || []).forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    noteEl.appendChild(ul);

    body.appendChild(noteEl);
  });

  headerBtn.addEventListener('click', () => {
    const isOpen = headerBtn.getAttribute('aria-expanded') === 'true';
    headerBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    body.classList.toggle('open', !isOpen);
  });

  wrap.appendChild(headerBtn);
  wrap.appendChild(body);
  return wrap;
}
