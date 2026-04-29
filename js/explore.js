/* ============================================================
   KREW — Explore Feed (mixed squads + products)
   ============================================================ */
import { initNav, showToast } from './nav.js';
import { getExploreFeed } from './db.js';
import { getQueryParam, timeAgo, formatPrice, getInitials, getAvatarColor, CATEGORIES } from './config.js';

await initNav('explore');

/* ========================
   STATE
   ======================== */
let allItems    = [];
let activeFilter = 'all'; // all | squads | products
let activeCategory = '';
let loading     = false;

/* ========================
   RENDER HELPERS
   ======================== */
function renderSquadCard(squad) {
  const memberCount = squad.squad_members?.[0]?.count ?? 0;
  const tags        = (squad.tags || []).slice(0, 3);
  const creator     = squad.creator || {};
  const creatorInit = getInitials(creator.full_name || creator.username || '?');
  const creatorColor= getAvatarColor(creator.username || '');
  const statusClass = { open: 'badge-open', in_progress: 'badge-progress', completed: 'badge-closed' }[squad.status] || 'badge-open';
  const statusLabel = { open: 'Open', in_progress: 'In Progress', completed: 'Completed' }[squad.status] || 'Open';

  return `
    <a href="/squad?id=${squad.id}" class="card squad-card" style="text-decoration:none;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class="badge ${statusClass}">${statusLabel}</span>
        ${squad.duration ? `<span class="category-chip">${squad.duration}</span>` : ''}
      </div>
      <div>
        <h3 class="card-title" style="font-size:1.0625rem;margin-bottom:6px">${escHtml(squad.name)}</h3>
        <p class="card-desc body-sm" style="color:var(--muted-light);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(squad.description || '')}</p>
      </div>
      ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <div style="display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:12px;border-top:1px solid var(--border)">
        <div class="avatar avatar-sm ${creatorColor}" title="${escHtml(creator.full_name || creator.username || '')}">${creator.avatar_url ? `<img src="${creator.avatar_url}" alt="">` : creatorInit}</div>
        <span style="font-size:0.8rem;color:var(--muted-light)">${escHtml(creator.username || 'anonymous')}</span>
        <span style="margin-left:auto;font-size:0.8rem;color:var(--muted)">👥 ${memberCount}/${squad.max_members || 5}</span>
        <span style="font-size:0.75rem;color:var(--muted)">${timeAgo(squad.created_at)}</span>
      </div>
    </a>
  `;
}

function renderProductCard(product) {
  const creator   = product.creator || {};
  const catDef    = CATEGORIES.find(c => c.value === product.category) || { emoji: '📦', label: 'Other' };
  const creatorInit = getInitials(creator.full_name || creator.username || '?');
  const creatorColor = getAvatarColor(creator.username || '');
  const isGumroad = product.checkout_type === 'gumroad';
  const buyLabel  = isGumroad ? 'Buy on Gumroad' : 'Buy Now';

  return `
    <div class="card product-card" style="cursor:default" onclick="window.location='/product?id=${product.id}'">
      <div class="preview" style="height:160px">
        ${product.preview_image_url
          ? `<img src="${product.preview_image_url}" alt="${escHtml(product.title)}" loading="lazy">`
          : `<div class="preview-placeholder" style="height:100%">${catDef.emoji}</div>`}
      </div>
      <div class="card-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="category-chip">${catDef.emoji} ${catDef.label}</span>
          <span style="font-size:0.75rem;color:var(--muted)">${timeAgo(product.created_at)}</span>
        </div>
        <h3 class="card-title">${escHtml(product.title)}</h3>
        ${(product.tags || []).length ? `<div class="tags" style="margin-top:6px">${(product.tags || []).slice(0,3).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <div class="avatar avatar-sm ${creatorColor}">${creator.avatar_url ? `<img src="${creator.avatar_url}" alt="">` : creatorInit}</div>
          <span style="font-size:0.8rem;color:var(--muted-light)">${escHtml(creator.username || 'anon')}</span>
        </div>
        <div class="card-footer" style="margin-top:12px">
          <span class="price" style="${!product.price_usd ? 'color:var(--green)' : ''}">${formatPrice(product.price_usd)}</span>
          <a href="${product.checkout_url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" onclick="e=>e.stopPropagation()">${buyLabel} ↗</a>
        </div>
      </div>
    </div>
  `;
}

function renderFeedItem(item) {
  if (item._type === 'squad')   return renderSquadCard(item);
  if (item._type === 'product') return renderProductCard(item);
  return '';
}

/* ========================
   FILTERING
   ======================== */
function getFilteredItems() {
  return allItems.filter(item => {
    if (activeFilter === 'squads'   && item._type !== 'squad')   return false;
    if (activeFilter === 'products' && item._type !== 'product') return false;
    if (activeCategory && item.category !== activeCategory)      return false;
    return true;
  });
}

function renderFeed() {
  const grid    = document.getElementById('feed-grid');
  const empty   = document.getElementById('feed-empty');
  const counter = document.getElementById('result-count');
  const items   = getFilteredItems();

  if (counter) counter.textContent = `${items.length} results`;

  if (!items.length) {
    grid.innerHTML  = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = items.map(renderFeedItem).join('');
}

/* ========================
   LOAD DATA
   ======================== */
async function loadFeed() {
  if (loading) return;
  loading = true;

  const skeletons = document.getElementById('feed-skeletons');
  const grid      = document.getElementById('feed-grid');
  if (skeletons) skeletons.classList.remove('hidden');
  if (grid)      grid.innerHTML = '';

  try {
    allItems = await getExploreFeed({ limit: 40 });
    renderFeed();
  } catch (err) {
    showToast('Error loading feed: ' + err.message, 'error');
    document.getElementById('feed-empty').classList.remove('hidden');
  } finally {
    loading = false;
    if (skeletons) skeletons.classList.add('hidden');
  }
}

/* ========================
   EVENT LISTENERS
   ======================== */
// Filter buttons
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderFeed();
    updateCategoryVisibility();
  });
});

function updateCategoryVisibility() {
  const catBar = document.getElementById('category-bar');
  if (!catBar) return;
  catBar.style.display = activeFilter === 'products' ? 'flex' : 'none';
}

// Category filter chips
document.querySelectorAll('[data-category]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-category]').forEach(c => c.classList.remove('active'));
    const val = chip.dataset.category;
    if (activeCategory === val) {
      activeCategory = '';
    } else {
      chip.classList.add('active');
      activeCategory = val;
    }
    renderFeed();
  });
});

// Search
const searchInput = document.getElementById('search-input');
if (searchInput) {
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = searchInput.value.toLowerCase();
      if (!q) {
        renderFeed();
        return;
      }
      const filtered = getFilteredItems().filter(item =>
        (item.name || item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
      const grid = document.getElementById('feed-grid');
      grid.innerHTML = filtered.map(renderFeedItem).join('');
    }, 250);
  });
}

/* ========================
   INIT
   ======================== */
loadFeed();

// Utility
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
