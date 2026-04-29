/* ============================================================
   KREW — Supabase Config
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values.
   Get them from: https://supabase.com/dashboard → Project Settings → API
   These are safe to expose publicly (anon key, not service key).
   ============================================================ */

export const SUPABASE_URL = 'https://bhmckjjdoxwfugtpphub.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobWNrampkb3h3ZnVndHBwaHViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzI5MDEsImV4cCI6MjA5MzA0ODkwMX0.YYQGcHn114nfmKo_TJW2NQgzzZz2V5HtFbvQlC8Csu0';

export const APP_NAME = 'Krew';
export const APP_URL = window.location.origin;

// Product categories
export const CATEGORIES = [
  { value: 'script',     label: 'Script',     emoji: '⚡' },
  { value: 'automation', label: 'Automation', emoji: '🤖' },
  { value: 'template',   label: 'Template',   emoji: '📋' },
  { value: 'api',        label: 'API / SDK',  emoji: '🔌' },
  { value: 'design',     label: 'Design',     emoji: '🎨' },
  { value: 'tool',       label: 'Tool',       emoji: '🛠️' },
];

// Squad payout models
export const PAYOUT_MODELS = [
  'Revenue Split',
  'Fixed Pay',
  'Equity',
  'Unpaid / Learning',
  'Prize Pool',
  'TBD',
];

// Squad durations
export const DURATIONS = [
  '1 week',
  '2 weeks',
  '1 month',
  '2 months',
  '3 months',
  'Ongoing',
];

// Skill suggestions
export const SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'Next.js', 'Vue', 'Svelte',
  'Node.js', 'Deno', 'Go', 'Rust', 'Java', 'Kotlin', 'Swift', 'Flutter',
  'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD',
  'UI/UX Design', 'Figma', 'Tailwind CSS', 'Three.js', 'WebGL',
  'AI/ML', 'LangChain', 'OpenAI API', 'Web Scraping', 'Automation',
  'SEO', 'Marketing', 'Copywriting', 'Video Editing',
];

// Avatar gradient colors by first letter
export const AVATAR_COLORS = [
  'avatar-purple', 'avatar-cyan', 'avatar-pink', 'avatar-green', 'avatar-orange',
];

export function getAvatarColor(str = '') {
  const code = str.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function formatPrice(price) {
  if (!price || price === 0) return 'Free';
  return `$${Number(price).toFixed(2)}`;
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
