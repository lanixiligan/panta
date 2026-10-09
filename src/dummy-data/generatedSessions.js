import { dummyRepositories } from './repositories.js';
import { exampleSession } from './exampleSession.js';

// Generated example sessions for the larger example portfolio, so Projects, Analytics, and the
// history views can be seen with realistic volume. Everything is deterministic (seeded) and placed
// relative to today, so the 14-day strips and recent-period analytics always have data.
// None of it was retrieved from GitHub.

const HISTORY_DAYS = 120;
// Wall-clock slots a session can start in: [first start hour, latest end hour].
const SLOTS = [[8, 12], [13, 17.5], [19, 23.5]];

// Per repository: how often it gets picked (weight), which days ago it was active, and what its work looks like.
const profiles = {
  'repo-pokefolio': {
    weight: 2, active: [12, 100], branch: 'feature',
    goals: ['Card detail modal', 'Collection stats page', 'Improve image loading'],
    subjects: ['card detail modal', 'collection stats', 'image loader', 'binder grid', 'type badges', 'search box'],
    files: ['src/components/cards/CardModal.jsx', 'src/pages/Stats/StatsPage.jsx', 'src/hooks/useImageLoader.js', 'src/components/binder/BinderGrid.jsx', 'src/components/cards/TypeBadge.jsx', 'src/styles/tokens.css'],
  },
  'repo-portfolio': {
    weight: 1, active: [10, 120], branch: 'main',
    goals: ['Update about section', 'Add case study page'],
    subjects: ['about section', 'case study layout', 'contact form', 'project content', 'meta tags'],
    files: ['src/sections/About.tsx', 'src/pages/case-studies/[slug].tsx', 'src/components/ContactForm.tsx', 'src/content/projects.ts', 'src/app/layout.tsx'],
  },
  'repo-session-tracker-prototype': {
    weight: 2, active: [8, 60], branch: 'feature',
    goals: ['Session timer', 'GitHub sign-in flow', 'Commit list for a session'],
    subjects: ['session timer', 'sign-in flow', 'commit list', 'repository picker', 'session storage'],
    files: ['src/App.jsx', 'src/components/SessionTimer.jsx', 'server/auth.js', 'src/components/CommitList.jsx', 'src/storage/sessions.js'],
  },
  'repo-api-playground-prototype': {
    weight: 1, active: [8, 90], branch: 'experiment', commitRate: 0.7,
    goals: ['Try the commits endpoint', 'Explore GraphQL API'],
    subjects: ['commits script', 'GraphQL query', 'pagination helper', 'notes'],
    files: ['commits/listCommits.js', 'graphql/query.js', 'lib/pagination.js', 'notes/findings.md'],
  },
  'repo-weather-cli': {
    weight: 4, active: [0, 45], branch: 'feature',
    goals: ['Add hourly forecast sparkline', 'Cache API responses', 'Support unit flags'],
    subjects: ['forecast parser', 'sparkline renderer', 'response cache', 'unit flags', 'config loader', 'error output'],
    files: ['cmd/weather/main.go', 'internal/forecast/forecast.go', 'internal/render/sparkline.go', 'internal/cache/cache.go', 'internal/config/config.go', 'README.md'],
  },
  'repo-recipe-box': {
    weight: 4, active: [0, 70], branch: 'feature',
    goals: ['Import recipes from a URL', 'Scale ingredient quantities', 'Add tag filtering', 'Polish recipe detail page'],
    subjects: ['recipe importer', 'ingredient scaler', 'tag filter', 'recipe card', 'search index', 'detail layout'],
    files: ['src/import/parseRecipe.ts', 'src/lib/scale.ts', 'src/components/TagFilter.tsx', 'src/components/RecipeCard.tsx', 'src/pages/RecipePage.tsx', 'src/styles/recipe.css', 'src/lib/search.ts'],
  },
  'repo-budget-buddy': {
    weight: 5, active: [0, 110], branch: 'feature',
    goals: ['Parse bank CSV exports', 'Build envelope overview', 'Monthly rollover rules', 'Fix rounding in totals'],
    subjects: ['CSV parser', 'envelope list', 'rollover rules', 'transaction table', 'currency formatting', 'monthly report'],
    files: ['src/import/csv.ts', 'src/envelopes/EnvelopeList.tsx', 'src/envelopes/rollover.ts', 'src/transactions/TransactionTable.tsx', 'src/lib/money.ts', 'src/reports/Monthly.tsx', 'src/db/schema.ts'],
  },
  'repo-dotfiles': {
    weight: 1, active: [0, 120], branch: 'main', commitRate: 0.6,
    goals: ['Tidy shell config', 'Switch terminal theme', 'Set up new laptop'],
    subjects: ['zsh aliases', 'neovim plugins', 'tmux bindings', 'git config', 'install script', 'terminal theme'],
    files: ['zsh/.zshrc', 'nvim/init.lua', 'nvim/lua/plugins.lua', 'tmux/.tmux.conf', 'git/.gitconfig', 'install.sh'],
  },
  'repo-rust-raytracer': {
    weight: 3, active: [50, 115], branch: 'chapter',
    goals: ['Add diffuse materials', 'Implement BVH', 'Render the final scene'],
    subjects: ['vector math', 'ray-sphere hit', 'material scatter', 'BVH builder', 'camera', 'PPM output'],
    files: ['src/vec3.rs', 'src/ray.rs', 'src/hittable.rs', 'src/material.rs', 'src/bvh.rs', 'src/camera.rs', 'src/main.rs'],
  },
  'repo-habit-garden': {
    weight: 4, active: [5, 80], branch: 'feature',
    goals: ['Streak calculation', 'Garden growth animation', 'Daily reminder notifications'],
    subjects: ['streak calculator', 'garden view', 'reminder worker', 'habit list', 'Room schema', 'settings screen'],
    files: ['app/src/main/java/garden/StreakCalculator.kt', 'app/src/main/java/garden/GardenView.kt', 'app/src/main/java/garden/ReminderWorker.kt', 'app/src/main/java/garden/HabitListScreen.kt', 'app/src/main/java/garden/data/HabitDao.kt', 'app/src/main/res/layout/settings.xml'],
  },
  'repo-chess-engine': {
    weight: 3, active: [30, 120], branch: 'feature',
    goals: ['Move generation perft tests', 'Alpha-beta with move ordering', 'Transposition table'],
    subjects: ['move generator', 'perft tests', 'alpha-beta search', 'move ordering', 'transposition table', 'UCI loop'],
    files: ['src/movegen.cpp', 'src/movegen.h', 'src/search.cpp', 'src/tt.cpp', 'src/uci.cpp', 'tests/perft.cpp', 'CMakeLists.txt'],
  },
  'repo-blog': {
    weight: 2, active: [0, 120], branch: 'main', commitRate: 0.7,
    goals: ['Write post draft', 'Add RSS feed', 'Improve code block styling'],
    subjects: ['post draft', 'RSS feed', 'code block styles', 'post layout', 'tag pages', 'OG images'],
    files: ['src/content/posts/draft.mdx', 'src/pages/rss.xml.ts', 'src/styles/code.css', 'src/layouts/Post.astro', 'src/pages/tags/[tag].astro', 'astro.config.mjs'],
  },
  'repo-markdown-notes': {
    weight: 4, active: [0, 60], branch: 'feature',
    goals: ['Backlinks panel', 'Full-text search', 'Sync notes folder on change'],
    subjects: ['backlinks panel', 'search index', 'file watcher', 'editor toolbar', 'note list', 'wikilink parser'],
    files: ['src/lib/backlinks.ts', 'src/lib/search.ts', 'src/lib/watcher.ts', 'src/components/Toolbar.svelte', 'src/components/NoteList.svelte', 'src/lib/wikilinks.ts'],
  },
  'repo-study-bot': {
    weight: 2, active: [40, 100], branch: 'feature',
    goals: ['Pomodoro timer command', 'Study streak leaderboard', 'Move to slash commands'],
    subjects: ['timer command', 'leaderboard', 'slash commands', 'streak storage', 'room permissions', 'help text'],
    files: ['bot/commands/timer.py', 'bot/commands/leaderboard.py', 'bot/main.py', 'bot/storage.py', 'bot/rooms.py', 'requirements.txt'],
  },
  'repo-leetcode': {
    weight: 3, active: [0, 120], branch: 'main', commitRate: 1.4, small: true,
    goals: ['Daily practice', 'Dynamic programming set', 'Graph problems', 'Review sliding window'],
    subjects: ['two pointers solution', 'DP solution', 'graph BFS solution', 'sliding window solution', 'notes', 'test cases'],
    files: ['arrays/two_sum.py', 'dp/coin_change.py', 'graphs/course_schedule.py', 'sliding_window/longest_substring.py', 'NOTES.md', 'tests/test_solutions.py'],
  },
  'repo-pixel-editor': {
    weight: 3, active: [20, 90], branch: 'feature',
    goals: ['Layer support', 'Onion skinning', 'Export to PNG and GIF'],
    subjects: ['layer panel', 'onion skin', 'canvas renderer', 'palette picker', 'GIF export', 'undo history'],
    files: ['src/editor/layers.js', 'src/editor/onionSkin.js', 'src/editor/canvas.js', 'src/ui/Palette.js', 'src/export/gif.js', 'src/editor/history.js', 'src/styles/editor.css'],
  },
  'repo-trip-planner': {
    weight: 2, active: [60, 120], branch: 'feature',
    goals: ['Itinerary timeline', 'Shared trip invites', 'Map view'],
    subjects: ['itinerary timeline', 'invite flow', 'map view', 'day planner', 'place search', 'trip API'],
    files: ['app/trips/[id]/page.tsx', 'components/Timeline.tsx', 'components/MapView.tsx', 'lib/invites.ts', 'lib/places.ts', 'app/api/trips/route.ts'],
  },
  'repo-digit-classifier': {
    weight: 2, active: [70, 120], branch: 'main',
    goals: ['NumPy forward pass', 'Port to PyTorch', 'Tune learning rate'],
    subjects: ['forward pass', 'backprop', 'PyTorch model', 'training loop', 'evaluation notebook', 'data loader'],
    files: ['numpy_net/network.py', 'numpy_net/train.py', 'torch_net/model.py', 'torch_net/train.py', 'notebooks/evaluate.ipynb', 'data/loader.py'],
  },
  'repo-inventory-api': {
    weight: 3, active: [10, 75], branch: 'feature',
    goals: ['Stock alert endpoint', 'Pagination for products', 'Integration tests'],
    subjects: ['product controller', 'stock alerts', 'pagination', 'repository layer', 'integration tests', 'OpenAPI spec'],
    files: ['src/main/java/shop/ProductController.java', 'src/main/java/shop/StockAlertService.java', 'src/main/java/shop/ProductRepository.java', 'src/test/java/shop/ProductApiTest.java', 'src/main/resources/openapi.yaml', 'pom.xml'],
  },
  'repo-link-shortener': {
    weight: 3, active: [0, 50], branch: 'feature',
    goals: ['Click stats', 'Custom slugs', 'Rate limiting'],
    subjects: ['redirect handler', 'click stats', 'slug validation', 'rate limiter', 'SQLite store', 'Dockerfile'],
    files: ['main.go', 'handlers/redirect.go', 'stats/clicks.go', 'store/sqlite.go', 'middleware/ratelimit.go', 'Dockerfile'],
  },
  'repo-kanban-board': {
    weight: 3, active: [25, 95], branch: 'feature',
    goals: ['Drag and drop between columns', 'Offline sync queue', 'Keyboard shortcuts'],
    subjects: ['drag and drop', 'sync queue', 'card editor', 'column layout', 'keyboard shortcuts', 'IndexedDB store'],
    files: ['src/board/Board.jsx', 'src/board/Column.jsx', 'src/board/Card.jsx', 'src/sync/queue.js', 'src/storage/db.js', 'src/hooks/useShortcuts.js'],
  },
  'repo-music-visualizer': {
    weight: 4, active: [0, 25], branch: 'experiment',
    goals: ['Frequency bars shader', 'Beat detection'],
    subjects: ['analyser node', 'bars shader', 'beat detector', 'color palette', 'mic input'],
    files: ['src/audio.js', 'src/shaders/bars.frag', 'src/beat.js', 'src/palette.js', 'src/main.js'],
  },
  'repo-platformer': {
    weight: 2, active: [80, 120], branch: 'feature',
    goals: ['Player movement feel', 'Level two layout', 'Enemy patrol AI'],
    subjects: ['player controller', 'coyote time', 'level two', 'enemy patrol', 'camera follow', 'checkpoint system'],
    files: ['Assets/Scripts/PlayerController.cs', 'Assets/Scripts/EnemyPatrol.cs', 'Assets/Scripts/CameraFollow.cs', 'Assets/Scripts/Checkpoint.cs', 'Assets/Scenes/Level2.unity'],
  },
  'repo-home-server': {
    weight: 1, active: [0, 120], branch: 'main', commitRate: 0.5,
    goals: ['Add backup container', 'Update media stack'],
    subjects: ['compose file', 'backup job', 'reverse proxy', 'env template'],
    files: ['docker-compose.yml', 'backup/backup.sh', 'caddy/Caddyfile', '.env.example'],
  },
  'repo-thesis-scraper': {
    weight: 6, active: [0, 40], branch: 'feature',
    goals: ['Scrape route timetables', 'Clean stop names', 'Export tidy CSV'],
    subjects: ['timetable scraper', 'stop name cleaner', 'CSV export', 'retry logic', 'analysis notebook'],
    files: ['scraper/timetables.py', 'scraper/clean.py', 'scraper/export.py', 'scraper/http.py', 'notebooks/explore.ipynb'],
  },
};

const verbs = ['Add', 'Refine', 'Fix', 'Refactor', 'Test', 'Document', 'Simplify', 'Speed up', 'Handle edge cases in', 'Clean up'];

// Small, seeded PRNG (mulberry32) so the same day and slot always produce the same session.
function seededRandom(seed) {
  let state = 0;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 2654435761);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const between = (random, min, max) => Math.round(min + random() * (max - min));
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Weighted pick that favours repositories left untouched for a while, so every active one shows up.
function pickRepository(random, entries, lastPickedDaysAgo, daysAgo) {
  const weights = entries.map(({ repository, profile }) => {
    const idleDays = (lastPickedDaysAgo.get(repository.id) ?? profile.active[1]) - daysAgo;
    return profile.weight * (1 + idleDays / 7);
  });
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  return entries.find((_, index) => (roll -= weights[index]) < 0) || entries[entries.length - 1];
}

function buildCommits(random, profile, startedAt, endedAt, branches) {
  const durationMinutes = (endedAt - startedAt) / 60_000;
  const count = Math.max(1, Math.min(24, Math.round(durationMinutes / between(random, 9, 18) * (profile.commitRate || 1))));
  const step = (durationMinutes - 6) / count;
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(startedAt.getTime() + (3 + step * index + random() * step * 0.8) * 60_000);
    const files = [...new Set(Array.from({ length: between(random, 1, 3) }, () => pick(random, profile.files)))].map((path) => {
      const roll = random();
      if (roll < 0.04) return [path, 'D', 0, between(random, 10, 90)];
      if (roll < 0.16) return [path, 'A', between(random, 12, profile.small ? 50 : 120), 0];
      return [path, 'M', between(random, 1, profile.small ? 30 : 70), between(random, 0, profile.small ? 12 : 40)];
    });
    return [at.toISOString(), `${pick(random, verbs)} ${pick(random, profile.subjects)}`, files, branches];
  });
}

export function generateExampleSessions(existingSessions = [], now = Date.now()) {
  const repositories = dummyRepositories
    .filter((repository) => profiles[repository.id])
    .map(({ id, owner, name, fullName }) => ({ repository: { id, owner, name, fullName }, profile: profiles[id] }));
  const taken = existingSessions.map((session) => [new Date(session.startedAt).getTime(), new Date(session.endedAt).getTime()]);
  const overlaps = (start, end) => taken.some(([takenStart, takenEnd]) => start < takenEnd && end > takenStart);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lastPickedDaysAgo = new Map();
  const sessions = [];

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const random = seededRandom(`day-${daysAgo}`);
    const day = new Date(today);
    day.setDate(today.getDate() - daysAgo);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const roll = random();
    // Most days have one session, some have none (more often on weekends), a few have two or three.
    const sessionCount = roll < (weekend ? 0.45 : 0.22) ? 0 : roll < 0.72 ? 1 : roll < 0.94 ? 2 : 3;
    const slots = [...SLOTS].sort(() => random() - 0.5).slice(0, sessionCount);

    slots.forEach(([firstHour, lastHour], slotIndex) => {
      const eligible = repositories.filter(({ profile }) => daysAgo >= profile.active[0] && daysAgo <= profile.active[1]);
      if (!eligible.length) return;
      const { repository, profile } = pickRepository(random, eligible, lastPickedDaysAgo, daysAgo);
      const startedAt = new Date(day);
      startedAt.setMinutes(firstHour * 60 + between(random, 0, 50));
      const roomMinutes = lastHour * 60 - (startedAt.getHours() * 60 + startedAt.getMinutes());
      const endedAt = new Date(startedAt.getTime() + Math.min(roomMinutes, between(random, 25, 200)) * 60_000);
      if (endedAt.getTime() > now || overlaps(startedAt.getTime(), endedAt.getTime())) return;
      taken.push([startedAt.getTime(), endedAt.getTime()]);
      lastPickedDaysAgo.set(repository.id, daysAgo);

      const goal = pick(random, profile.goals);
      const branches = [profile.branch === 'main' ? 'main' : `${profile.branch}/${slug(goal)}`];
      const id = `example-${daysAgo}-${slotIndex}`;
      const activityRoll = random();
      const base = { id, repository, goal, date: '', startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), branches };

      if (activityRoll < 0.06) {
        // GitHub activity was never retrieved for this session: shown as unavailable, never as zero.
        sessions.push({ id, source: 'placeholder', status: 'completed', repository, goal, startedAt: base.startedAt, endedAt: base.endedAt, activity: null, commits: [] });
      } else if (activityRoll < 0.14) {
        // A session with no commits is still a valid session.
        sessions.push(exampleSession({ ...base, commits: [] }));
      } else {
        sessions.push(exampleSession({ ...base, commits: buildCommits(random, profile, startedAt, endedAt, branches) }));
      }
    });
  }

  return sessions;
}
