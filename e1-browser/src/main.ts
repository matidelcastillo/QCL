import { createClient, type Session } from '@supabase/supabase-js';
import { createSessionGeneration } from '../../e1-review/session-generation';
import './style.css';

const URL = 'https://mdytuysdombxyydqnsmj.supabase.co';
const KEY = 'sb_publishable_pCfoSYyZSDDxvvnbmq_EHw_7BUhKzYm';
const STORAGE_KEY = 'qcl-e1-auth';
const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: STORAGE_KEY },
});
const delay = Math.min(30000, Math.max(0, Number(new URLSearchParams(location.search).get('delay')) || 0));
const guard = createSessionGeneration();
const root = document.querySelector<HTMLElement>('#app')!;
let current: Session | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
let record: { id: string; owner_id: string; title: string } | null = null;
let loading = false;
let error = '';
let busy = false;

async function logout() {
  busy = true;
  localStorage.removeItem(STORAGE_KEY);
  clearPrivate();
  try { await supabase.auth.signOut({ scope: 'local' }); }
  finally { busy = false; render(); }
}

function clearPrivate() {
  guard.change(null);
  controller?.abort();
  controller = undefined;
  clearTimeout(timer);
  current = null;
  record = null;
  loading = false;
  error = '';
  render();
}

function render() {
  root.replaceChildren();
  const heading = document.createElement('h1');
  heading.textContent = 'QCL · gate E1';
  root.append(heading);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = current ? `Sesión: ${current.user.id}` : 'Sesión cerrada';
  root.append(status);
  if (!current) {
    const form = document.createElement('form');
    form.innerHTML = '<label>Email <input name="email" type="email" required autocomplete="username"></label><label>Contraseña <input name="password" type="password" required autocomplete="current-password"></label><button type="submit">Ingresar</button>';
    const button = form.querySelector('button')!;
    button.disabled = busy;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      button.disabled = true;
      const data = new FormData(form);
      try {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: String(data.get('email')), password: String(data.get('password')),
        });
        if (authError) { error = 'No se pudo iniciar sesión'; render(); }
      } catch {
        error = 'No se pudo iniciar sesión';
        render();
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
    root.append(form);
  } else {
    const button = document.createElement('button');
    button.textContent = 'Salir';
    button.addEventListener('click', () => { void logout(); });
    root.append(button);
    const state = document.createElement('section');
    state.setAttribute('aria-label', 'Registro privado');
    state.textContent = loading ? 'Cargando registro…' : record ? record.title : 'Sin registro visible';
    root.append(state);
  }
  if (error) { const note = document.createElement('p'); note.setAttribute('role', 'alert'); note.textContent = error; root.append(note); }
  if (delay) { const note = document.createElement('small'); note.textContent = `Demora de prueba: ${delay} ms`; root.append(note); }
}

async function load(session: Session) {
  const accepted = guard.capture();
  const request = new AbortController();
  controller = request;
  try {
    const response = await fetch(`${URL}/rest/v1/e1_private_records?select=id,owner_id,title`, {
      headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}` },
      signal: request.signal,
      cache: 'no-store',
    });
    const rows = response.ok ? await response.json() as Array<{ id: string; owner_id: string; title: string }> : [];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (!accepted()) return;
    if (response.status === 401 || Date.now() >= session.expires_at! * 1000) {
      await logout();
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (rows.some((row) => row.owner_id !== session.user.id)) throw new Error('Respuesta de otro usuario');
    record = rows[0] ?? null;
    error = '';
  } catch (cause) {
    if (!accepted()) return;
    if ((cause as Error).name !== 'AbortError') error = 'No se pudo leer el registro';
  } finally {
    if (accepted()) { loading = false; controller = undefined; render(); }
  }
}

function activate(session: Session | null) {
  clearPrivate();
  if (!session) return;
  if (!session.expires_at || session.expires_at * 1000 <= Date.now()) {
    void logout();
    return;
  }
  current = session;
  guard.change(session.user.id);
  loading = true;
  render();
  timer = setTimeout(() => {
    void logout();
  }, Math.max(0, session.expires_at * 1000 - Date.now()));
  void load(session);
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') activate(null);
  else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') activate(session);
});
render();
