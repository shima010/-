const SUBJECTS_CONFIG = {
  "基礎法学": { color: "#06b6d4", icon: "📚" },
  "憲法":     { color: "#ef4444", icon: "⚖️" },
  "行政法":   { color: "#f97316", icon: "🏛️" },
  "民法":     { color: "#3b82f6", icon: "📜" },
  "商法・会社法": { color: "#8b5cf6", icon: "🏢" },
  "一般知識": { color: "#10b981", icon: "🌐" }
};

const STORAGE_KEY = 'gyosei_quiz';

const quizState = {
  subject: null,
  questions: [],
  currentIndex: 0,
  answered: false,
  sessionCorrect: 0,
  sessionTotal: 0
};

function initQuiz() {
  renderSubjectGrid();
  setupQuizEventListeners();
}

function renderSubjectGrid() {
  const grid = document.getElementById('subject-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(SUBJECTS_CONFIG).forEach(([subject, cfg]) => {
    const qs = QUESTIONS.filter(q => q.subject === subject);
    const stats = loadStats(subject);
    const rateText = stats.total > 0
      ? `正答率 ${Math.round(stats.correct / stats.total * 100)}%`
      : '未挑戦';

    const btn = document.createElement('button');
    btn.className = 'subject-card';
    btn.style.setProperty('--card-color', cfg.color);
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `${subject}（${qs.length}問）`);
    btn.innerHTML = `
      <span class="card-icon">${cfg.icon}</span>
      <span class="card-label">${subject}</span>
      <span class="card-count">${qs.length}問</span>
      <span class="card-score">${rateText}</span>
    `;
    btn.addEventListener('click', () => startQuiz(subject));
    grid.appendChild(btn);
  });

  updateOverallStats();
}

function updateOverallStats() {
  let total = 0, correct = 0;
  Object.keys(SUBJECTS_CONFIG).forEach(s => {
    const st = loadStats(s);
    total += st.total;
    correct += st.correct;
  });

  const statsEl = document.getElementById('overall-stats');
  if (!statsEl) return;

  if (total > 0) {
    statsEl.style.display = 'flex';
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-rate').textContent = Math.round(correct / total * 100) + '%';
  }
}

function setupQuizEventListeners() {
  document.getElementById('btn-all-subjects')?.addEventListener('click', () => startQuiz(null));
  document.getElementById('quiz-back-btn')?.addEventListener('click', () => {
    showScreen('quiz-subject-select');
    renderSubjectGrid();
  });
  document.getElementById('next-btn')?.addEventListener('click', nextQuestion);
  document.getElementById('retry-btn')?.addEventListener('click', () => startQuiz(quizState.subject));
  document.getElementById('result-back-btn')?.addEventListener('click', () => {
    showScreen('quiz-subject-select');
    renderSubjectGrid();
  });
}

function startQuiz(subject) {
  quizState.subject = subject;
  quizState.currentIndex = 0;
  quizState.sessionCorrect = 0;
  quizState.sessionTotal = 0;
  quizState.answered = false;

  const pool = subject
    ? QUESTIONS.filter(q => q.subject === subject)
    : [...QUESTIONS];

  quizState.questions = shuffleArray(pool).slice(0, subject ? pool.length : 20);

  if (quizState.questions.length === 0) return;

  const badge = document.getElementById('quiz-subject-badge');
  const color = subject ? SUBJECTS_CONFIG[subject]?.color : '#1a56db';
  badge.textContent = subject || '全科目';
  badge.style.setProperty('--badge-color', color);

  showScreen('quiz-screen');
  renderQuestion();
}

function renderQuestion() {
  const q = quizState.questions[quizState.currentIndex];
  if (!q) return;

  quizState.answered = false;

  const total = quizState.questions.length;
  const current = quizState.currentIndex + 1;

  document.getElementById('quiz-progress').textContent = `${current} / ${total}`;
  document.getElementById('progress-bar').style.width = `${(current / total) * 100}%`;
  document.getElementById('question-number').textContent = `問${current}`;
  document.getElementById('question-category').textContent = q.category;
  document.getElementById('question-text').textContent = q.question;

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';

  const nums = ['①', '②', '③', '④'];
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.setAttribute('data-index', i);
    btn.innerHTML = `<span class="choice-num">${nums[i]}</span><span>${choice}</span>`;
    btn.addEventListener('click', () => handleChoiceClick(i));
    choicesEl.appendChild(btn);
  });

  const feedback = document.getElementById('feedback-panel');
  feedback.classList.add('hidden');
  document.getElementById('correct-answer-note').style.display = 'none';
}

function handleChoiceClick(selectedIndex) {
  if (quizState.answered) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.currentIndex];
  const isCorrect = selectedIndex === q.answer;

  quizState.sessionTotal++;
  if (isCorrect) quizState.sessionCorrect++;

  const buttons = document.querySelectorAll('.choice-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    else if (i === selectedIndex && !isCorrect) btn.classList.add('wrong');
  });

  showFeedback(isCorrect, q, selectedIndex);
}

function showFeedback(isCorrect, q, selectedIndex) {
  const panel = document.getElementById('feedback-panel');
  const resultEl = document.getElementById('feedback-result');
  const noteEl = document.getElementById('correct-answer-note');
  const expEl = document.getElementById('explanation');

  panel.classList.remove('hidden');
  resultEl.className = 'feedback-result ' + (isCorrect ? 'correct' : 'wrong');
  resultEl.innerHTML = isCorrect ? '⭕ 正解！' : '❌ 不正解';

  if (!isCorrect) {
    const nums = ['①', '②', '③', '④'];
    noteEl.style.display = 'block';
    noteEl.textContent = `正解は ${nums[q.answer]}`;
  }

  expEl.textContent = q.explanation;
}

function nextQuestion() {
  quizState.currentIndex++;

  if (quizState.currentIndex >= quizState.questions.length) {
    showResult();
  } else {
    renderQuestion();
    document.getElementById('question-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showResult() {
  const { sessionCorrect, sessionTotal, subject } = quizState;
  const percent = sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0;

  document.getElementById('result-percent').textContent = percent + '%';
  document.getElementById('result-detail').textContent =
    `${sessionTotal}問中 ${sessionCorrect}問正解`;

  let comment;
  if (percent >= 90) comment = '🏆 素晴らしい！完璧に近い正答率です！';
  else if (percent >= 70) comment = '👍 合格圏内！もう一息です！';
  else if (percent >= 50) comment = '📖 まだ伸びしろあり。復習して再挑戦！';
  else comment = '💪 基礎を固めましょう。まとめノートも活用を！';

  document.getElementById('result-comment').textContent = comment;

  if (subject) {
    const prev = loadStats(subject);
    saveStats(subject, {
      correct: prev.correct + sessionCorrect,
      total: prev.total + sessionTotal
    });
  } else {
    // 全科目モードは科目ごとには記録しない
  }

  showScreen('quiz-result');
}

function showScreen(id) {
  document.querySelectorAll('#tab-quiz .screen').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function loadStats(subject) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${subject}`);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { correct: 0, total: 0 };
}

function saveStats(subject, stats) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${subject}`, JSON.stringify(stats));
  } catch (e) { /* ignore */ }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
