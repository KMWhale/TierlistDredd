/* ═══════════════════════════════════════════════════════════════
   TKK DREDD — js/auth.js
   Sistema de autenticação.

   ▸ As senhas são armazenadas como hash SHA-256 — nunca em texto puro.
   ▸ Para gerar o hash de uma nova senha, use no console do navegador:
       hashPassword('sua_senha').then(h => console.log(h))
   ▸ Roles:  "admin" = acesso total  |  "viewer" = somente leitura
   ▸ Visitante entra sem login — NÃO aparece no histórico.
═══════════════════════════════════════════════════════════════ */

// ── Usuários com hash SHA-256 das senhas ─────────────────────────
// Os hashes reais são carregados de js/auth-hashes.js (não versionado).
// Este array define apenas estrutura (labels e roles).
const USERS = [
  { user: 'sabonete', label: 'Sabonete', role: 'admin', hash: '818418a77d209a1f29ad58045159a777ada11d1e67547da19428a09021ff4c4b' },
  { user: 'salsa',    label: 'Salsa',    role: 'admin', hash: '419bd52b8097abff50bf1740d56de4afc0024ee96a915222cf26703da45a4858' },
  { user: 'ebras',    label: 'Ebras',    role: 'admin', hash: 'bb7e22724bff6a0e6d8bd6d799d3d86bbc026e670bf7ddc07b22c9ba90fdc0b0' },
  { user: 'igor',     label: 'Igor',     role: 'admin', hash: '10b7bdf2225fc4f536561531e297efd4dfe57426a6a4dce852ef974210a840b3' },
  { user: 'monteiro', label: 'Monteiro', role: 'admin', hash: '50eee22990baf9ee7eb3b6bf96a04cd5611b70cd8890237d3e41cbc54e5af6e2' },
  { user: 'apendice', label: 'Apendice', role: 'editor', hash: '9eb674113696a02f1826ddb881d0d4586f22c185fbc7a2c739e3b7d8a45f0eb6' },
];

// ── Estado global ────────────────────────────────────────────────
let CURRENT_USER = null;

// ── SHA-256 via Web Crypto API ───────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
window.hashPassword = sha256; // disponível no console para gerar hashes

// ── Aplica hashes do arquivo externo (auth-hashes.js) ───────────
function applyExternalHashes() {
  const ext = window.__TKK_HASHES;
  if (!ext) return false;
  USERS.forEach(u => { if (ext[u.user]) u.hash = ext[u.user]; });
  return true;
}

// ── Inicialização ─────────────────────────────────────────────────
(async function initAuth() {
  applyExternalHashes();

  // Restaura sessão existente
  const saved = sessionStorage.getItem('tkkdredd_user');
  if (saved) {
    try { CURRENT_USER = JSON.parse(saved); showApp(); return; }
    catch (_) { sessionStorage.removeItem('tkkdredd_user'); }
  }

  // Enter nos campos
  document.addEventListener('keydown', e => {
    const ls = document.getElementById('login-screen');
    if (e.key === 'Enter' && ls && !ls.classList.contains('hidden')) doLogin();
  });
})();

// ── Login ─────────────────────────────────────────────────────────
async function doLogin() {
  const userVal = document.getElementById('login-user').value.trim().toLowerCase();
  const passVal = document.getElementById('login-pass').value;
  const errEl   = document.getElementById('login-error');

  if (!userVal || !passVal) { errEl.textContent = 'Preencha os dois campos.'; return; }

  const found = USERS.find(u => u.user === userVal);
  // Mesmo tempo de resposta independente de encontrar ou não (anti-timing attack)
  const h = await sha256(passVal);
  await new Promise(r => setTimeout(r, 350));

  if (!found || h !== found.hash) {
    errEl.textContent = '✕ Usuário ou senha incorretos';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    return;
  }

  errEl.textContent = '';
  CURRENT_USER = { user: found.user, label: found.label, role: found.role };
  sessionStorage.setItem('tkkdredd_user', JSON.stringify(CURRENT_USER));
  logAccess(found.label, 'login');
  showApp();
}

// ── Visitante (sem login, sem registro no histórico) ─────────────
function enterAsGuest() {
  CURRENT_USER = { guest: true, label: 'Visitante', role: 'viewer' };
  // Intencionalmente NÃO registrado no histórico
  showApp();
}

// ── Logout ────────────────────────────────────────────────────────
function doLogout() {
  if (CURRENT_USER && !CURRENT_USER.guest) logAccess(CURRENT_USER.label, 'logout');
  CURRENT_USER = null;
  sessionStorage.removeItem('tkkdredd_user');
  location.reload();
}

// ── Exibe a aplicação e aplica permissões ────────────────────────
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const isAdmin = CURRENT_USER.role === 'admin';
  const isEditorRole = CURRENT_USER.role === 'editor';
  const guestMode = CURRENT_USER.guest === true;

  document.getElementById('user-badge-name').textContent = CURRENT_USER.label;
  
  let roleText = 'VISITANTE';
  if (isAdmin) roleText = 'ADMINISTRADOR';
  else if (isEditorRole) roleText = 'EDITOR';
  document.getElementById('user-badge-role').textContent = roleText;

  applyPermissions(isAdmin, isEditorRole, guestMode);

  // Carrega imagens compartilhadas da pasta images/ para todos os usuários
  if (typeof loadSharedImages === 'function') loadSharedImages();
}

function _hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function _show(id) { const el = document.getElementById(id); if (el) el.style.removeProperty('display'); }

function applyPermissions(isAdmin, isEditorRole, guestMode) {
  if (isAdmin) return; // admin vê tudo

  // Editor, Viewer logado e visitante: não podem fazer upload, limpar, ou exportar histórico (log-btn ocultado depois)
  _hide('upload-section');
  _hide('clear-btn');
  _hide('axis-edit-btn');
  
  // Apenas viewers e visitantes não podem salvar JSON ou exportar PNG
  if (!isEditorRole) {
    _hide('export-png-btn');
    _hide('save-json-btn');
  }

  // Visitante anônimo: oculta também o botão de logout e mostra "sair"
  if (guestMode) {
    _hide('logout-btn');
    _show('guest-exit-btn');
    // Galeria: remove interação (sem arrastar, sem excluir)
    document.getElementById('gallery').style.pointerEvents = 'none';
  }
}

function isAdmin() { return CURRENT_USER && CURRENT_USER.role === 'admin'; }
function isEditor() { return CURRENT_USER && (CURRENT_USER.role === 'admin' || CURRENT_USER.role === 'editor'); }
function isGuest() { return CURRENT_USER && CURRENT_USER.guest === true; }

// ── Registro de acesso (localStorage) ───────────────────────────
const ACCESS_LOG_KEY = 'tkkdredd_access_log';

function logAccess(label, action) {
  try {
    const log = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || '[]');
    const now = new Date();
    log.unshift({
      user:   label,
      action,
      date:   now.toLocaleDateString('pt-BR'),
      time:   now.toLocaleTimeString('pt-BR'),
      ts:     now.toISOString(),
    });
    if (log.length > 500) log.pop();
    localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(log));
  } catch(_) {}
}

// ── Exportar histórico como CSV (só admin) ───────────────────────
function exportAccessLog() {
  if (!isAdmin()) { showNotif('Sem permissão', 'err'); return; }
  try {
    const log = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || '[]');
    if (!log.length) { showNotif('Histórico vazio', 'err'); return; }
    const csv = ['Usuário,Ação,Data,Hora']
      .concat(log.map(e => `"${e.user}","${e.action}","${e.date}","${e.time}"`))
      .join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: 'tkk-dredd-historico.csv'
    });
    a.click(); URL.revokeObjectURL(url);
    showNotif('Histórico exportado');
  } catch(_) { showNotif('Erro ao exportar histórico', 'err'); }
}
