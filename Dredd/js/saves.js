/* ═══════════════════════════════════════════════════════════════
   TKK DREDD — js/saves.js
   Sistema de salvamento com nome personalizado e data.
═══════════════════════════════════════════════════════════════ */

const SAVES_KEY = 'tkkdredd_saves';

function getSavesCatalog() {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); }
  catch(_) { return []; }
}
function setSavesCatalog(arr) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(arr));
}

// ── Formata data para uso em nome de arquivo ─────────────────────
function dateStamp() {
  const now = new Date();
  const p   = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}`;
}

// ── Abre o modal de salvar com campo de nome ─────────────────────
function openSaveModal() {
  if (!isEditor()) { showNotif('🔒 Sem permissão para salvar', 'err'); return; }

  // Gera nome padrão: usuário_data
  const userSlug = CURRENT_USER.label.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const defaultName = `${userSlug}_${dateStamp()}`;
  document.getElementById('save-name-input').value = defaultName;
  document.getElementById('save-modal').classList.remove('hidden');
  document.getElementById('save-name-input').focus();
  document.getElementById('save-name-input').select();
}

function closeSaveModal() {
  document.getElementById('save-modal').classList.add('hidden');
}

// ── Confirma o salvamento ────────────────────────────────────────
function confirmSave() {
  let name = document.getElementById('save-name-input').value.trim();
  if (!name) { showNotif('Digite um nome para o arquivo', 'err'); return; }
  if (!name.endsWith('.json')) name += '.json';

  closeSaveModal();
  exportJSON(name);
}

// ── Exporta o JSON com o nome escolhido ─────────────────────────
function exportJSON(filename) {
  if (!isEditor()) { showNotif('🔒 Sem permissão', 'err'); return; }

  // Lê rótulos dos eixos do DOM
  const axisXNeg = document.getElementById('lbl-x-neg').dataset.value || '← Anti-científico';
  const axisXPos = document.getElementById('lbl-x-pos').dataset.value || 'Científico →';
  const axisYPos = document.getElementById('lbl-y-pos').dataset.value || '▲ Competente';
  const axisYNeg = document.getElementById('lbl-y-neg').dataset.value || 'Incompetente ▼';

  const data = {
    axisX:   { neg: axisXNeg, pos: axisXPos },
    axisY:   { pos: axisYPos, neg: axisYNeg },
    range:   RANGE,
    savedAt: new Date().toISOString(),
    savedBy: CURRENT_USER.label,
    items:   Object.values(S.items).map(i => ({
      name:         i.name,
      x_cientifico: i.x,
      y_competente: i.y,
      size_px:      i.size,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);

  // Registra no catálogo local
  const catalog = getSavesCatalog();
  const entry = {
    filename,
    date:   new Date().toLocaleString('pt-BR'),
    savedBy: CURRENT_USER.label,
    items:  data.items.length,
  };
  const idx = catalog.findIndex(s => s.filename === filename);
  if (idx >= 0) catalog[idx] = entry;
  else catalog.unshift(entry);
  if (catalog.length > 50) catalog.pop();
  setSavesCatalog(catalog);

  showNotif(`💾 Salvo: ${filename}`);
}

// ── Modal de carregamento ────────────────────────────────────────
function openSavesModal() {
  renderSavesList();
  document.getElementById('saves-modal').classList.remove('hidden');
}
function closeSavesModal() {
  document.getElementById('saves-modal').classList.add('hidden');
}

function renderSavesList() {
  const listEl  = document.getElementById('saves-list');
  const catalog = getSavesCatalog();

  if (!catalog.length) {
    listEl.innerHTML = `<div class="saves-empty">
      Nenhum save registrado neste navegador.<br>
      Use "Selecionar arquivo local" para carregar da pasta <code>saves/</code>.
    </div>`;
    return;
  }

  listEl.innerHTML = '';
  catalog.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'save-entry';
    div.innerHTML = `
      <span class="save-icon">📄</span>
      <div class="save-info">
        <div class="save-name">${entry.filename}</div>
        <div class="save-date">${entry.date} · por ${entry.savedBy || '?'} · ${entry.items} item(ns)</div>
      </div>
      <button class="save-load-btn">Carregar</button>
    `;
    div.querySelector('.save-load-btn').addEventListener('click', () => {
      closeSavesModal();
      showNotif(`Selecione o arquivo "${entry.filename}" na pasta saves/`);
      triggerLocalJSON();
    });
    listEl.appendChild(div);
  });
}

function triggerLocalJSON() {
  closeSavesModal();
  document.getElementById('json-file-input').click();
}

// ── Listener do input de arquivo ─────────────────────────────────
document.getElementById('json-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { importJSON(JSON.parse(ev.target.result), file.name); }
    catch(err) { showNotif('JSON inválido: ' + err.message, 'err'); }
  };
  reader.readAsText(file);
  this.value = '';
});

// Fecha ao clicar no fundo
document.getElementById('saves-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSavesModal();
});
document.getElementById('save-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSaveModal();
});
// Enter confirma save
document.addEventListener('keydown', e => {
  const sm = document.getElementById('save-modal');
  if (e.key === 'Enter' && sm && !sm.classList.contains('hidden')) confirmSave();
  if (e.key === 'Escape') { closeSaveModal(); closeSavesModal(); closeAxisModal(); }
});
