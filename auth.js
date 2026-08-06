// APPEARICH — splash, auth flow & session handling

const SPLASH_MIN_MS = 2500; // splash screen shows for at least 2.5s

let currentUser = null; // { id, email, full_name, phone }

function $(id) { return document.getElementById(id); }

function switchAuthTab(tab) {
  $('authTabLogin').classList.toggle('active', tab === 'login');
  $('authTabRegister').classList.toggle('active', tab === 'register');
  $('loginForm').classList.toggle('active', tab === 'login');
  $('registerForm').classList.toggle('active', tab === 'register');
  $('authError').textContent = '';
}

function showAuthScreen() {
  $('authScreen').classList.add('active');
  $('appRoot').classList.remove('active');
}

function showApp() {
  $('authScreen').classList.remove('active');
  $('appRoot').classList.add('active');
}

function setAuthError(msg) {
  $('authError').textContent = msg || '';
}

function setBtnLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span>${label}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.label || label;
  }
}

// Fills in the greeting / profile UI once we know who the user is.
// Uses full_name from the `profiles` table — never the email.
async function loadUserIntoUI(user) {
  currentUser = { id: user.id, email: user.email, full_name: null, phone: null };

  // Show cached profile immediately (works offline / instantly on reopen),
  // then refresh from Supabase in the background.
  const cached = DB.getCachedProfile();
  if (cached) {
    currentUser.full_name = cached.full_name;
    currentUser.phone = cached.phone;
    applyUserToUI();
  }

  const fresh = await DB.fetchProfile(user.id);
  if (fresh) {
    currentUser.full_name = fresh.full_name;
    currentUser.phone = fresh.phone;
    applyUserToUI();
  }
}

function applyUserToUI() {
  const displayName = (currentUser.full_name && currentUser.full_name.trim())
    ? currentUser.full_name.trim().split(' ')[0]
    : 'there';
  const fullDisplayName = (currentUser.full_name && currentUser.full_name.trim())
    ? currentUser.full_name.trim()
    : 'Appearich User';

  if ($('heroGreeting')) $('heroGreeting').innerText = `Welcome, ${displayName}!`;
  if ($('profName')) $('profName').innerText = fullDisplayName;
  if ($('profAvatar')) $('profAvatar').innerText = fullDisplayName.charAt(0).toUpperCase();
  if ($('profPhone')) $('profPhone').innerText = currentUser.phone || '';
  if ($('mealPhoneNum') && !$('mealPhoneNum').value) $('mealPhoneNum').value = currentUser.phone || '';
}

async function handleLogin(e) {
  e.preventDefault();
  setAuthError('');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const btn = e.target.querySelector('.auth-submit-btn');
  setBtnLoading(btn, true, 'Logging in…');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  setBtnLoading(btn, false, 'Log In');
  if (error) {
    setAuthError(error.message);
    return;
  }
  if (data && data.user) {
    await loadUserIntoUI(data.user);
    showApp();
    if (window.App && App.onLogin) App.onLogin();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  setAuthError('');
  const full_name = $('regName').value.trim();
  const phone = $('regPhone').value.trim();
  const email = $('regEmail').value.trim();
  const password = $('regPassword').value;
  const btn = e.target.querySelector('.auth-submit-btn');
  setBtnLoading(btn, true, 'Creating…');

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone } } // read by the handle_new_user() trigger
  });

  setBtnLoading(btn, false, 'Create Account');
  if (error) {
    setAuthError(error.message);
    return;
  }

  if (data.session && data.user) {
    // Email confirmation is OFF on this project — user is signed in immediately.
    DB.cacheProfile({ id: data.user.id, full_name, phone });
    await loadUserIntoUI(data.user);
    showApp();
    if (window.App && App.onLogin) App.onLogin();
  } else {
    // Email confirmation is ON — ask them to check their inbox, then let them log in.
    setAuthError('Account created! Please check your email to confirm, then log in.');
    switchAuthTab('login');
  }
}

async function logout() {
  if (!confirm('Log out of Appearich?')) return;
  await supabaseClient.auth.signOut();
  DB.clearProfile();
  currentUser = null;
  showAuthScreen();
  switchAuthTab('login');
  $('loginForm').reset();
}

function finishSplash(startedAt) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    const splash = $('splashScreen');
    splash.classList.add('fade-out');
    setTimeout(() => { splash.style.display = 'none'; }, 400);
  }, remaining);
}

async function initAuth() {
  const startedAt = Date.now();
  $('loginForm').addEventListener('submit', handleLogin);
  $('registerForm').addEventListener('submit', handleRegister);

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    await loadUserIntoUI(session.user);
    showApp();
    if (window.App && App.onLogin) App.onLogin();
  } else {
    showAuthScreen();
  }

  finishSplash(startedAt);

  // Keep the UI in sync if the session changes in another tab, or expires.
  supabaseClient.auth.onAuthStateChange(async (event, newSession) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      showAuthScreen();
    } else if (event === 'SIGNED_IN' && newSession && newSession.user) {
      await loadUserIntoUI(newSession.user);
    }
  });
}

window.addEventListener('DOMContentLoaded', initAuth);
