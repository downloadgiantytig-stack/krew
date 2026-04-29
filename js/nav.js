/* ============================================================
   KREW — Shared Navbar + Toast System
   Import this on every page, call initNav() on load.
   ============================================================ */

let _toastContainer = null;

/* ========================
   TOAST SYSTEM
   ======================== */
export function showToast(message, type = 'info', duration = 4000) {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;

  _toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ========================
   NAVBAR HTML
   ======================== */
function buildNavHTML(activePage = '') {
  return `
    <nav class="nav" id="main-nav">
      <a href="/" class="nav-logo">KREW</a>

      <div class="nav-links">
        <a href="/explore" class="nav-link ${activePage === 'explore' ? 'active' : ''}">Explore</a>
        <a href="/squads" class="nav-link ${activePage === 'squads' ? 'active' : ''}">Squads</a>
        <a href="/marketplace" class="nav-link ${activePage === 'marketplace' ? 'active' : ''}">Marketplace</a>
      </div>

      <div class="nav-actions">
        <div id="nav-auth-area"></div>
        <button class="nav-hamburger" id="nav-hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>

    <div class="nav-mobile-menu hidden" id="nav-mobile-menu">
      <a href="/explore"     class="nav-link ${activePage === 'explore'     ? 'active' : ''}">Explore</a>
      <a href="/squads"      class="nav-link ${activePage === 'squads'      ? 'active' : ''}">Squads</a>
      <a href="/marketplace" class="nav-link ${activePage === 'marketplace' ? 'active' : ''}">Marketplace</a>
      <hr style="border-color:var(--border);margin:8px 0">
      <div id="nav-auth-area-mobile"></div>
    </div>
  `;
}

/* ========================
   AUTH AREA
   ======================== */
function setAuthArea(session, profile) {
  const areas = [
    document.getElementById('nav-auth-area'),
    document.getElementById('nav-auth-area-mobile'),
  ];

  areas.forEach((el, i) => {
    if (!el) return;
    const isMobile = i === 1;

    if (session && profile) {
      const initials = (profile.full_name || profile.username || '?')
        .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const colorClass = getAvatarColor(profile.username || '');

      el.innerHTML = isMobile
        ? `
          <a href="/profile?u=${profile.username}" class="nav-link">
            <span>👤 ${profile.full_name || profile.username}</span>
          </a>
          <button onclick="window.__kreSignOut()" class="nav-link" style="width:100%;text-align:left">Sign out</button>
        `
        : `
          <div style="position:relative" id="avatar-menu-wrap">
            <div class="nav-avatar ${colorClass}" id="nav-avatar-btn" title="${profile.full_name || profile.username}">
              ${profile.avatar_url
                ? `<img src="${profile.avatar_url}" alt="">`
                : initials}
            </div>
            <div class="avatar-dropdown hidden" id="avatar-dropdown">
              <a href="/profile?u=${profile.username}" class="dropdown-item">Profile</a>
              <a href="/marketplace?mine=1" class="dropdown-item">My Products</a>
              <a href="/squads?mine=1" class="dropdown-item">My Squads</a>
              <hr style="border-color:var(--border);margin:4px 0">
              <button onclick="window.__kreSignOut()" class="dropdown-item danger">Sign out</button>
            </div>
          </div>
        `;
    } else {
      el.innerHTML = isMobile
        ? `<a href="/login" class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:8px">Sign In</a>`
        : `
          <a href="/login" class="btn btn-ghost btn-sm">Sign in</a>
          <a href="/login?mode=signup" class="btn btn-primary btn-sm">Join Krew</a>
        `;
    }
  });

  // Wire avatar dropdown toggle
  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown  = document.getElementById('avatar-dropdown');
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => dropdown.classList.add('hidden'));
  }
}

function getAvatarColor(str) {
  const colors = ['avatar-purple', 'avatar-cyan', 'avatar-pink', 'avatar-green', 'avatar-orange'];
  return colors[(str.charCodeAt(0) || 0) % colors.length];
}

/* ========================
   SCROLL EFFECT
   ======================== */
function initScrollEffect() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ========================
   HAMBURGER TOGGLE
   ======================== */
function initHamburger() {
  const btn   = document.getElementById('nav-hamburger');
  const menu  = document.getElementById('nav-mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    btn.classList.toggle('open', !isOpen);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      btn.classList.remove('open');
    }
  });
}

/* ========================
   MAIN INIT
   ======================== */
export async function initNav(activePage = '') {
  // Detect active page from path
  if (!activePage) {
    const path = window.location.pathname.replace('/', '');
    activePage = path || 'home';
  }

  // Inject nav HTML before body content
  const navWrapper = document.createElement('div');
  navWrapper.innerHTML = buildNavHTML(activePage);
  document.body.prepend(navWrapper);

  // Add dropdown CSS
  addDropdownStyles();

  initScrollEffect();
  initHamburger();

  // Lazy-load auth (no blocking)
  try {
    const { initAuth, onAuthChange, signOut } = await import('./auth.js');
    window.__kreSignOut = signOut;
    await initAuth();
    onAuthChange((session, profile) => {
      setAuthArea(session, profile);
    });
  } catch (e) {
    console.warn('Auth not loaded:', e.message);
    setAuthArea(null, null);
  }
}

function addDropdownStyles() {
  if (document.getElementById('dropdown-styles')) return;
  const style = document.createElement('style');
  style.id = 'dropdown-styles';
  style.textContent = `
    .avatar-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 180px;
      background: var(--bg-2);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      padding: 6px;
      box-shadow: var(--shadow-xl);
      z-index: 200;
      animation: scaleIn 0.15s var(--ease-spring);
    }
    .dropdown-item {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border-radius: calc(var(--radius) - 4px);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      text-align: left;
      transition: background var(--trans-fast), color var(--trans-fast);
      text-decoration: none;
      border: none;
      background: none;
    }
    .dropdown-item:hover { background: var(--surface-hover); color: var(--text); }
    .dropdown-item.danger { color: #FC8181; }
    .dropdown-item.danger:hover { background: rgba(239,68,68,0.1); }
  `;
  document.head.appendChild(style);
}
