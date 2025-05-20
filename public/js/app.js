// public/js/app.js

// ── UTILITY & TAB SWITCHING ─────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('section').forEach(s => {
    s.style.display = s.id === `${tab}-section` ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar nav a, .bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === tab);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Drag-and-drop FAB setup (same as your old code)
  const fab = document.getElementById('fab');
  let dragging = false, ox = 0, oy = 0;
  fab.style.position = 'fixed';
  fab.style.top  = `${window.innerHeight - fab.offsetHeight - 20}px`;
  fab.style.left = `${window.innerWidth  - fab.offsetWidth  - 20}px`;
  fab.addEventListener('mousedown', e => {
    dragging = true; fab.style.cursor = 'grabbing';
    const r = fab.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let x = e.clientX - ox, y = e.clientY - oy;
    x = Math.max(0, Math.min(window.innerWidth - fab.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - fab.offsetHeight, y));
    fab.style.left = `${x}px`; fab.style.top  = `${y}px`;
  });
  document.addEventListener('mouseup', () => {
    dragging = false; fab.style.cursor = 'grab';
  });
  fab.addEventListener('click', () => {
    document.getElementById('batchModal').style.display = 'flex';
  });

  // Close modals
  document.querySelectorAll('.modal .close').forEach(x => {
    x.addEventListener('click', () => x.closest('.modal').style.display = 'none');
  });
  window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
  });

  // Initial tab
  switchTab('test-setup');
  populateBatchSelects();
});

// ── API BASE UTILITY ─────────────────────────────────────────────────────────
const API_BASE = '/api';

// Helper: fetch JSON or throw
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Error ${res.status}: ${txt}`);
  }
  return res.json();
}

// ── BATCH LOGIC ──────────────────────────────────────────────────────────────
async function populateBatchSelects() {
  // Fetch /api/batches
  try {
    const batches = await fetchJSON(`${API_BASE}/batches`);
    // Populate all batch dropdowns
    ['batchSelect','questionBatch','chapterBatch'].forEach(id => {
      const sel = document.getElementById(id);
      sel.innerHTML = '<option value="">--Select Batch--</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = b.name;
        sel.appendChild(opt);
      });
    });
  } catch (err) {
    console.error('Failed to load batches:', err);
  }
}

// Handle Add Batch form
document.getElementById('batch-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('batchName').value.trim();
  if (!name) return alert('Enter a batch name');
  try {
    await fetchJSON(`${API_BASE}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    alert('Batch added!');
    e.target.reset();
    document.getElementById('batchModal').style.display = 'none';
    populateBatchSelects();
  } catch (err) {
    console.error('Error adding batch:', err);
    alert('Could not add batch');
  }
});

// ── TEST SETUP LOGIC ─────────────────────────────────────────────────────────
document.getElementById('test-setup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const testName     = document.getElementById('testName').value.trim();
  const batch        = document.getElementById('batchSelect').value;
  const testDuration = Number(document.getElementById('testDuration').value.trim());
  const subjects     = document
    .getElementById('subjects')
    .value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const schedInput   = document.getElementById('scheduledDate').value;
  const scheduledAt  = schedInput ? new Date(schedInput) : null;

  if (!testName || !batch || !testDuration || !subjects.length || !scheduledAt) {
    return alert('All fields are required!');
  }

  try {
    await fetchJSON(`${API_BASE}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testName,
        batch,
        testDuration,
        subjects,
        scheduledAt
      })
    });
    alert('Test created!');
    e.target.reset();
  } catch (err) {
    console.error('Error creating test:', err);
    alert('Could not create test');
  }
});

// When questionBatch changes, load test series for that batch
document.getElementById('questionBatch').addEventListener('change', async e => {
  const batch = e.target.value;
  const testSeriesSel = document.getElementById('testSeries');
  testSeriesSel.innerHTML = '<option value="">--Select Series--</option>';
  if (!batch) return;

  // Fetch all tests, then filter by batch
  try {
    const allTests = await fetchJSON(`${API_BASE}/tests`);
    allTests.forEach(t => {
      if (t.batch === batch) {
        const opt = document.createElement('option');
        opt.value = t.testName;
        opt.textContent = t.testName;
        // store subjects array in data-attribute
        opt.setAttribute('data-subjects', JSON.stringify(t.subjects || []));
        testSeriesSel.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('Error loading test series:', err);
  }
});

// When testSeries changes, load its subjects for <select id="subject">
document.getElementById('testSeries').addEventListener('change', e => {
  const subjectsArray = JSON.parse(e.target.selectedOptions[0]?.getAttribute('data-subjects') || '[]');
  const subjSel = document.getElementById('subject');
  subjSel.innerHTML = '<option value="">--Select Subject--</option>';
  subjectsArray.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    subjSel.appendChild(opt);
  });
});

// Show/hide MCQ or Integer answer fields
document.getElementById('questionType').addEventListener('change', e => {
  document.getElementById('mcq-section').style.display = e.target.value === 'MCQ' ? 'block' : 'none';
  document.getElementById('integer-section').style.display = e.target.value === 'Integer' ? 'block' : 'none';
});

// Handle Add Question form submission
document.getElementById('question-form').addEventListener('submit', async e => {
  e.preventDefault();
  const batch  = document.getElementById('questionBatch').value;
  const series = document.getElementById('testSeries').value;
  const subj   = document.getElementById('subject').value;
  const question       = document.getElementById('question').value.trim();
  const questionImage  = document.getElementById('questionImageURL').value.trim();
  const questionType   = document.getElementById('questionType').value;
  const solution       = document.getElementById('solution').value.trim();
  const solutionImage  = document.getElementById('solutionImageURL').value.trim();

  if (!batch || !series || !subj || !questionType) {
    return alert('Select batch, series & subject!');
  }

  const payload = {
    series,
    batch,
    subject: subj,
    question,
    questionImage,
    questionType,
    solution,
    solutionImage
  };

  if (questionType === 'MCQ') {
    const options = [
      document.getElementById('optionA').value.trim(),
      document.getElementById('optionB').value.trim(),
      document.getElementById('optionC').value.trim(),
      document.getElementById('optionD').value.trim()
    ];
    const correctAnswer = document.getElementById('correctAnswer').value;
    if (!correctAnswer) return alert('Pick the correct answer!');
    payload.options = options;
    payload.correctAnswer = correctAnswer;
  } else {
    const answer = document.getElementById('integerAnswer').value.trim();
    if (!answer) return alert('Enter the integer answer!');
    payload.answer = answer;
  }

  try {
    await fetchJSON(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('Question added & AnswerMap updated!');
    // Clear only the question/option inputs, keep selects intact
    document.getElementById('question').value = '';
    document.getElementById('questionImageURL').value = '';
    if (questionType === 'MCQ') {
      ['optionA','optionB','optionC','optionD','correctAnswer'].forEach(id => {
        document.getElementById(id).value = '';
      });
    } else {
      document.getElementById('integerAnswer').value = '';
    }
    document.getElementById('solution').value = '';
    document.getElementById('solutionImageURL').value = '';
  } catch (err) {
    console.error('Error adding question:', err);
    alert('Failed to add question');
  }
});

// Preview Button logic (same as old code)
document.getElementById('previewBtn').addEventListener('click', () => {
  let html = '<p><strong>Question:</strong></p>';
  const q  = document.getElementById('question').value.trim();
  const qi = document.getElementById('questionImageURL').value.trim();
  html += q
    ? `<p>${q}</p>`
    : qi
      ? `<img src="${qi}" style="max-width:100%"/>`
      : '<p><em>None</em></p>';

  const tp = document.getElementById('questionType').value;
  html += `<p><strong>Type:</strong> ${tp}</p>`;
  if (tp === 'MCQ') {
    html +=
      '<ol type="A">' +
      ['optionA','optionB','optionC','optionD']
        .map(id => `<li>${document.getElementById(id).value.trim() || '<em>–</em>'}</li>`)
        .join('') +
      '</ol>';
    html += `<p><strong>Answer:</strong> ${document.getElementById('correctAnswer').value || '<em>–</em>'}</p>`;
  } else {
    html += `<p><strong>Answer:</strong> ${document.getElementById('integerAnswer').value || '<em>–</em>'}</p>`;
  }

  const sol = document.getElementById('solution').value.trim();
  const si  = document.getElementById('solutionImageURL').value.trim();
  html += `<p><strong>Solution:</strong></p>` +
          (sol
            ? `<p>${sol}</p>`
            : si
              ? `<img src="${si}" style="max-width:100%"/>`
              : '<p><em>None</em></p>');

  document.getElementById('previewContent').innerHTML = html;
  document.getElementById('previewModal').style.display = 'flex';
});

// ── TEST PREVIEW (LIST ALL TESTS) ────────────────────────────────────────────
async function loadTestPreview() {
  const cont = document.getElementById('testPreviewContainer');
  cont.innerHTML = '';
  try {
    const tests = await fetchJSON(`${API_BASE}/tests`);
    const now = Date.now();
    tests.forEach(t => {
      const card = document.createElement('div');
      card.className = 'test-card';

      const sched = t.scheduledAt ? new Date(t.scheduledAt).getTime() : null;
      let status = '', action = '';

      if (t.published) {
        status = `<p style="color:green;font-weight:600;">Published</p>`;
        action = `<button onclick="deleteTest('${t.testName}')">Delete</button>`;
      } else if (sched && now < sched) {
        status = `<p style="color:orange;font-weight:600;">Scheduled</p>`;
        action = `<button disabled>Not Live</button>`;
      } else {
        status = `<p style="color:blue;font-weight:600;">Ready</p>`;
        action = `<button onclick="sendTest('${t.testName}')">Send</button>`;
      }

      card.innerHTML = `
        <div>
          <h3>${t.testName}</h3>
          <p>Batch: ${t.batch}</p>
          <p>Dur: ${t.testDuration} min</p>
          <p>Sub: ${t.subjects.join(', ')}</p>
          ${sched?`<p>Schedule: ${new Date(sched).toLocaleString()}</p>` : ''}
          ${status}
        </div>
        <div class="btn-group">
          <button onclick="previewTest('${t.testName}')">Preview</button>
          ${action}
        </div>`;
      cont.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading test preview:', err);
  }
}

// On clicking the “Preview” button for a test:
window.previewTest = id => {
  // You could navigate to a preview page (if you have one), or show modal, etc.
  alert(`Preview ${id} not implemented (extend as needed)`);
};

// On clicking “Send” (publish) a test:
window.sendTest = async id => {
  if (!confirm('Send this test?')) return;
  try {
    await fetchJSON(`${API_BASE}/tests/${id}/publish`, {
      method: 'PUT'
    });
    alert('Test sent!');
    loadTestPreview();
  } catch (err) {
    console.error('Error sending test:', err);
    alert('Failed to send test');
  }
};

// On clicking “Delete” a test:
window.deleteTest = async id => {
  if (!confirm('Delete test?')) return;
  try {
    await fetchJSON(`${API_BASE}/tests/${id}`, { method: 'DELETE' });
    alert('Deleted!');
    loadTestPreview();
  } catch (err) {
    console.error('Error deleting test:', err);
    alert('Failed to delete test');
  }
};

// When user clicks on “Preview” tab:
document.querySelector('[data-tab="test-preview"]').addEventListener('click', () => {
  loadTestPreview();
});

// ── CHAPTERS LOGIC ───────────────────────────────────────────────────────────
// Populate chapterSeries when chapterBatch changes
document.getElementById('chapterBatch').addEventListener('change', async e => {
  const batch = e.target.value;
  const seriesSel = document.getElementById('chapterSeries');
  seriesSel.innerHTML = '<option value="">--Select Series--</option>';
  document.getElementById('chapterSubject').innerHTML = '<option value="">--Select Subject--</option>';
  if (!batch) return;

  // fetch all tests, filter by batch
  try {
    const allTests = await fetchJSON(`${API_BASE}/tests`);
    allTests.forEach(t => {
      if (t.batch === batch) {
        const opt = document.createElement('option');
        opt.value = t.testName;
        opt.textContent = t.testName;
        opt.setAttribute('data-subjects', JSON.stringify(t.subjects || []));
        seriesSel.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('Error loading series for chapters:', err);
  }
});

// Populate chapterSubject when chapterSeries changes
document.getElementById('chapterSeries').addEventListener('change', e => {
  const subjectsArray = JSON.parse(e.target.selectedOptions[0]?.getAttribute('data-subjects') || '[]');
  const subjSel = document.getElementById('chapterSubject');
  subjSel.innerHTML = '<option value="">--Select Subject--</option>';
  subjectsArray.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    subjSel.appendChild(opt);
  });
});

// Load existing chapters when chapterSubject changes
document.getElementById('chapterSubject').addEventListener('change', async () => {
  const series  = document.getElementById('chapterSeries').value;
  const subject = document.getElementById('chapterSubject').value;
  const list    = document.getElementById('chaptersList');
  list.innerHTML = '';
  if (!series || !subject) return;
  try {
    const resp = await fetchJSON(`${API_BASE}/chapters?series=${encodeURIComponent(series)}&subject=${encodeURIComponent(subject)}`);
    (resp.chapters || []).forEach(ch => {
      const li = document.createElement('li');
      li.textContent = ch;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Error loading chapters:', err);
  }
});

// Handle Add Chapter form
document.getElementById('chapter-form').addEventListener('submit', async e => {
  e.preventDefault();
  const series  = document.getElementById('chapterSeries').value;
  const subject = document.getElementById('chapterSubject').value;
  const name    = document.getElementById('chapterName').value.trim();
  if (!series || !subject || !name) return alert('All fields required');

  try {
    await fetchJSON(`${API_BASE}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series, subject, chapterName: name })
    });
    alert(`Chapter "${name}" added`);
    document.getElementById('chapterName').value = '';
    // reload the list
    const resp = await fetchJSON(`${API_BASE}/chapters?series=${encodeURIComponent(series)}&subject=${encodeURIComponent(subject)}`);
    const list = document.getElementById('chaptersList');
    list.innerHTML = '';
    resp.chapters.forEach(ch => {
      const li = document.createElement('li');
      li.textContent = ch;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Error adding chapter:', err);
    alert('Could not add chapter');
  }
});
