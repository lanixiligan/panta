import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser } from './api/auth.js';
import { getAccessibleRepositories, getActiveSessionCommits, getSessionActivity } from './api/github.js';
import OverviewPage from './pages/Overview/OverviewPage.jsx';
import ProjectsPage from './pages/Projects/ProjectsPage.jsx';
import ProjectDetailPage from './pages/Projects/ProjectDetailPage.jsx';
import { findProject, getExampleProjects, getProjects } from './pages/Projects/projectHistory.js';

import SessionHistoryPage from './pages/SessionHistory/SessionHistoryPage.jsx';
import SessionDetailPage from './pages/SessionHistory/SessionDetailPage.jsx';

import SettingsPage from './pages/Settings/SettingsPage.jsx';

import SessionWorkspacePage from './pages/SessionWorkspace/SessionWorkspacePage.jsx';
import AnalyticsPage from './pages/Analytics/AnalyticsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AuthenticationPage from './pages/Authentication/AuthenticationPage.jsx';
import PreviewPage from './pages/Preview/PreviewPage.jsx';
import SidebarNav from './components/navigation/SidebarNav.jsx';
import Footer from './components/layout/Footer.jsx';
import { getSessionListItems, getWeeklySummary } from './sessions/sessionHelpers.js';
import { dummyRepositories, getDummySessionById, getDummySessions } from './dummy-data/index.js';
import { resolveRoute, routePaths, sessionDetailPath } from './routing.js';
import { getGitHubMutuals, sendPresenceHeartbeat } from './api/presence.js';

function readStoredSessions(username) {
  if (!username) return [];
  try {
    const sessions = JSON.parse(window.localStorage.getItem(`panta.sessions.${encodeURIComponent(username)}`) || '[]');
    return Array.isArray(sessions)
      ? sessions.filter((session) => session && typeof session === 'object' && session.status === 'completed' && session.id && session.repository && typeof session.repository === 'object')
      : [];
  } catch {
    return [];
  }
}

function mergeCommits(...lists) {
  const commitsBySha = new Map();
  lists.flat().forEach((commit) => {
    if (!commit?.sha) return;
    const existing = commitsBySha.get(commit.sha);
    const branches = [...new Set([...(existing?.branches || []), ...(commit.branches || [])])];
    commitsBySha.set(commit.sha, { ...existing, ...commit, ...(branches.length ? { branches } : {}) });
  });
  return [...commitsBySha.values()].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

// Totals come from the merged commits so commits kept from an earlier check
// (for example, from a branch deleted since) still count.
function summarizeCommits(commits) {
  const detailed = commits.filter((commit) => Array.isArray(commit.files));
  return {
    commits: commits.length,
    filesChanged: new Set(detailed.flatMap((commit) => commit.files.map(({ filename }) => filename))).size,
    additions: detailed.reduce((total, commit) => total + (commit.additions || 0), 0),
    deletions: detailed.reduce((total, commit) => total + (commit.deletions || 0), 0),
  };
}

const SHOW_EXAMPLES_KEY = 'panta.showExamples';
const NO_EXAMPLES = [];

// Examples are shown until the viewer turns them off; storage can be unavailable, so it only ever falls back to shown.
function readShowExamples() {
  try {
    return window.localStorage.getItem(SHOW_EXAMPLES_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const route = resolveRoute(pathname);
  const { view } = route;
  const [identity, setIdentity] = useState(null);
  const [identityStatus, setIdentityStatus] = useState('loading');
  const [identityError, setIdentityError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [sessionEndingAt, setSessionEndingAt] = useState(null);
  const [completedSession, setCompletedSession] = useState(null);
  const [realSessions, setRealSessions] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [mutuals, setMutuals] = useState([]);
  const [mutualsLoading, setMutualsLoading] = useState(true);
  const [mutualsError, setMutualsError] = useState('');
  const loadId = useRef(0);
  const endingSession = useRef(false);
  const [showExamples, setShowExamples] = useState(readShowExamples);
  const allDummySessions = useMemo(() => getDummySessions(), []);
  // The sidebar's "Show example data" setting hides every example session, project, and repository at once.
  const visibleDummySessions = showExamples ? allDummySessions : NO_EXAMPLES;
  const analyticsSessions = useMemo(() => [...realSessions, ...visibleDummySessions], [realSessions, visibleDummySessions]);
  const sessionItems = getSessionListItems(analyticsSessions)
    .sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt));
  const projects = useMemo(() => getProjects(realSessions, repositories), [realSessions, repositories]);
  // Overview offers to continue in the repository of the latest real session; examples never count.
  const lastRealSession = useMemo(() => realSessions.reduce((latest, session) => (!latest || new Date(session.startedAt) > new Date(latest.startedAt) ? session : latest), null), [realSessions]);
  const allExampleProjects = useMemo(() => getExampleProjects(), []);
  const exampleProjects = showExamples ? allExampleProjects : NO_EXAMPLES;
  // Example repositories shaped like GitHub's, so the session workspace can list them beside real ones.
  const exampleRepositories = useMemo(() => (showExamples ? dummyRepositories.map((repository) => ({
    id: repository.id,
    name: repository.name,
    full_name: repository.fullName,
    description: repository.description,
    language: repository.language,
    private: false,
    updated_at: exampleProjects.find((project) => project.key === `id:${repository.id}`)?.lastWorkedAt ?? null,
    isExample: true,
  })) : NO_EXAMPLES), [showExamples, exampleProjects]);
  // Direct links to an example project keep working while examples are hidden.
  const routeProject = view === 'Project Detail' ? findProject([...projects, ...allExampleProjects], route.owner, route.repo) : null;
  // Includes example sessions, like Recent sessions beside it; the card says when it does.
  const weeklySummary = getWeeklySummary(analyticsSessions, new Date(now));

  useEffect(() => {
    function syncPathname() {
      setPathname(window.location.pathname);
    }
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  useEffect(() => {
    if (!identity?.username) return;
    try {
      const completedSessions = realSessions.filter((session) => session.status === 'completed');
      window.localStorage.setItem(`panta.sessions.${encodeURIComponent(identity.username)}`, JSON.stringify(completedSessions));
    } catch {
      // Session history remains available in memory if browser storage is unavailable.
    }
  }, [identity?.username, realSessions]);

  function navigate(path, state = {}) {
    if (path === window.location.pathname) return;
    window.history.pushState(state, '', path);
    setPathname(window.location.pathname);
  }

  // `fromHistory` marks the entry so Back returns to Session History with its filters and scroll position.
  function openSession(sessionId, { fromHistory = false } = {}) {
    setCompletedSession(null);
    navigate(sessionDetailPath(sessionId), fromHistory ? { returnToHistory: true } : {});
  }

  async function loadRepositories() {
    const requestId = ++loadId.current;
    setRepositoriesLoading(true);
    setRepositoriesError('');
    try {
      const result = await getAccessibleRepositories();
      if (requestId === loadId.current) setRepositories(result);
    } catch (error) {
      if (requestId === loadId.current) setRepositoriesError(error.message || 'Unable to load repositories accessible to Panta.');
    } finally {
      if (requestId === loadId.current) setRepositoriesLoading(false);
    }
  }

  async function loadWorkspace() {
    const requestId = ++loadId.current;
    setIdentityStatus('loading');
    setIdentityError('');
    setRepositories([]);
    setRepositoriesError('');
    try {
      const user = await getCurrentUser();
      if (requestId !== loadId.current) return;
      if (!user) {
        setIdentity(null);
        setIdentityStatus('unauthenticated');
        setRepositoriesLoading(false);
        return;
      }

      setIdentity(user);
      setIdentityStatus('authenticated');
      const storedSessions = readStoredSessions(user.username);
      setRealSessions(storedSessions);
      storedSessions.filter((session) => session.activityStatus === 'loading').forEach((session) => {
        void retrieveSessionActivity(session);
      });
      setRepositoriesLoading(true);
      try {
        const result = await getAccessibleRepositories();
        if (requestId === loadId.current) setRepositories(result);
      } catch (error) {
        if (requestId === loadId.current) setRepositoriesError(error.message || 'Unable to load repositories accessible to Panta.');
      } finally {
        if (requestId === loadId.current) setRepositoriesLoading(false);
      }
    } catch {
      if (requestId === loadId.current) {
        setIdentity(null);
        setIdentityStatus('error');
        setIdentityError('GitHub is temporarily unavailable. Check your connection and try again.');
        setRepositoriesLoading(false);
      }
    }
  }

  useEffect(() => {
    loadWorkspace();
    return () => { loadId.current += 1; };
  }, []);

  useEffect(() => {
    if (identityStatus !== 'authenticated' || !identity?.id) return undefined;
    const sendHeartbeat = () => { void sendPresenceHeartbeat().catch(() => {}); };
    sendHeartbeat();
    const heartbeatTimer = window.setInterval(sendHeartbeat, 30_000);
    return () => window.clearInterval(heartbeatTimer);
  }, [identityStatus, identity?.id]);

  useEffect(() => {
    if (identityStatus !== 'authenticated' || !identity?.id) {
      setMutuals([]);
      setMutualsError('');
      setMutualsLoading(false);
      return undefined;
    }

    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    async function refreshPeople(showLoading = false) {
      if (cancelled || inFlight) return;
      inFlight = true;
      if (showLoading) {
        setMutualsLoading(true);
        setMutualsError('');
      }
      try {
        const people = await getGitHubMutuals(controller.signal);
        if (!cancelled) {
          setMutuals(people);
          setMutualsError('');
        }
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') setMutualsError('Unable to load your GitHub mutuals.');
      } finally {
        inFlight = false;
        if (showLoading && !cancelled) setMutualsLoading(false);
      }
    }

    void refreshPeople(true);
    const refreshTimer = window.setInterval(() => { void refreshPeople(); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      controller.abort();
    };
  }, [identityStatus, identity?.id]);

  useEffect(() => {
    if (!activeSession) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || isEndingSession || identityStatus !== 'authenticated' || !identity?.username) return undefined;
    const session = activeSession;
    const controller = new AbortController();
    let cancelled = false;
    let inFlight = false;
    let since = session.startedAt;

    async function pollActivity() {
      if (cancelled || inFlight) return;
      inFlight = true;
      const checkedAt = new Date().toISOString();
      setActiveSession((current) => current?.id === session.id
        ? { ...current, activitySyncStatus: current.commits?.length ? 'syncing' : 'loading', activityError: '' }
        : current);

      try {
        const result = await getActiveSessionCommits(session.repository, session.startedAt, since, checkedAt, controller.signal);
        if (cancelled) return;
        since = new Date(Math.max(Date.parse(session.startedAt), Date.parse(checkedAt) - 60_000)).toISOString();
        setActiveSession((current) => current?.id === session.id
          ? {
              ...current,
              commits: mergeCommits(current.commits || [], result.commits || []),
              activitySyncStatus: 'live',
              activityCheckedAt: result.checkedAt || checkedAt,
              activityError: '',
            }
          : current);
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return;
        setActiveSession((current) => current?.id === session.id
          ? { ...current, activitySyncStatus: 'error', activityError: error.message || 'Unable to refresh GitHub activity. Retrying…' }
          : current);
      } finally {
        inFlight = false;
      }
    }

    void pollActivity();
    const timer = window.setInterval(() => { void pollActivity(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [activeSession?.id, identity?.username, identityStatus, isEndingSession]);

  function startSession({ repository, goal }) {
    if (activeSession) return;
    const startedAt = new Date().toISOString();
    endingSession.current = false;
    setCompletedSession(null);
    setNow(Date.now());
    setIsEndingSession(false);
    setSessionEndingAt(null);
    setActiveSession({ id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, source: 'github', repository, goal, startedAt, status: 'active', commits: [], activitySyncStatus: 'loading', activityCheckedAt: null, activityError: '' });
  }

  function toggleExamples(value) {
    setShowExamples(value);
    try {
      window.localStorage.setItem(SHOW_EXAMPLES_KEY, value ? 'on' : 'off');
    } catch {
      // The setting still applies for this visit.
    }
  }

  function cancelSession() {
    if (!activeSession || endingSession.current) return;
    setActiveSession(null);
  }

  async function finishSession() {
    if (!activeSession || endingSession.current) return;
    endingSession.current = true;
    setIsEndingSession(true);
    const endedAt = new Date().toISOString();
    setSessionEndingAt(endedAt);
    const endingSessionData = {
      ...activeSession,
      endedAt,
      status: 'completed',
      duration: Date.parse(endedAt) - Date.parse(activeSession.startedAt),
      activityStatus: 'loading',
      activityError: '',
    };
    const session = await retrieveSessionActivity(endingSessionData, false);
    setCompletedSession(session);
    setRealSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    setActiveSession(null);
    setIsEndingSession(false);
    setSessionEndingAt(null);
    if (window.location.pathname !== routePaths['Session Workspace']) {
      navigate(routePaths['Session Workspace']);
    }
  }

  // Writes back only the activity fields, so a goal edited while GitHub is being checked survives.
  async function retrieveSessionActivity(session, updateState = true) {
    let fields;
    try {
      const activity = await getSessionActivity(session.repository, session.startedAt, session.endedAt);
      const commits = mergeCommits(session.commits || [], activity.commits || []);
      fields = {
        ...activity,
        activity: { ...activity.activity, ...summarizeCommits(commits) },
        commits,
        activityStatus: 'complete',
        activityError: '',
        activityCheckedAt: new Date().toISOString(),
      };
    } catch (error) {
      fields = { activity: session.activity ?? null, commits: session.commits || [], activityStatus: 'error', activityError: error.message || 'Could not retrieve GitHub commits for this session.' };
    }
    if (updateState) updateRealSession(session.id, fields);
    return { ...session, ...fields };
  }

  // Merges into the latest copy of the session rather than replacing it with an older one.
  function updateRealSession(sessionId, fields) {
    const merge = (session) => (session?.id === sessionId ? { ...session, ...fields } : session);
    setCompletedSession(merge);
    setRealSessions((current) => current.map(merge));
  }

  function updateSessionGoal(sessionId, goal) {
    const withGoal = (session) => session?.id === sessionId ? { ...session, goal } : session;
    setRealSessions((current) => current.map(withGoal));
    setCompletedSession(withGoal);
  }

  function updateActiveGoal(goal) {
    setActiveSession((current) => current && { ...current, goal });
  }

  // Clears every real session saved in this browser; the storage effect then writes the empty list.
  function deleteSessionHistory() {
    setRealSessions([]);
    setCompletedSession(null);
  }

  function deleteSession(sessionId) {
    setRealSessions((current) => current.filter((session) => session.id !== sessionId));
    setCompletedSession((current) => current?.id === sessionId ? null : current);
    navigate(routePaths['Session History']);
  }

  function retrySessionActivity(session) {
    if (!session || session.activityStatus === 'loading') return;
    updateRealSession(session.id, { activityStatus: 'loading', activityError: '' });
    void retrieveSessionActivity(session);
  }

  function handleLogout() {
    setIdentity(null);
    setIdentityStatus('unauthenticated');
    setRepositories([]);
    setActiveSession(null);
    setCompletedSession(null);
    setRealSessions([]);
    setMutuals([]);
    setMutualsError('');
    setIsEndingSession(false);
    setSessionEndingAt(null);
    navigate(routePaths.Overview);
  }

  const identityProps = {
    identity,
    identityStatus,
    identityError,
    repositories,
    repositoriesLoading,
    repositoriesError,
    onRetryIdentity: loadWorkspace,
    onRetryRepositories: () => identity && loadRepositories(),
  };

  // The example-session preview is public, so visitors can see a recap before signing in.
  if (view === 'Preview') return <PreviewPage onNavigate={navigate} signedIn={identityStatus === 'authenticated'} />;

  if (identityStatus !== 'authenticated') {
    return (
      <AuthenticationPage
        checking={identityStatus === 'loading'}
        identityError={identityStatus === 'error' ? identityError : ''}
        onRetryIdentity={loadWorkspace}
      />
    );
  }

  return (
    <div className="app-shell app-shell-dark workspace-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SidebarNav
        identity={identity}
        identityStatus={identityStatus}
        view={view}
        pathname={pathname}
        onNavigate={navigate}
        activeSession={activeSession}
        now={now}
        onLogout={handleLogout}
        mutuals={mutuals}
        mutualsLoading={mutualsLoading}
        mutualsError={mutualsError}
        showExamples={showExamples}
        onToggleExamples={toggleExamples}
      />
      <div className={`workspace-main${['Overview', 'Settings', 'Session Detail'].includes(view) ? ' workspace-main-fit' : ''}`}>
        <main className="app-main" id="main-content" tabIndex={-1}>
        {view === 'Overview' && (
          <OverviewPage
            {...identityProps}
            activeSession={activeSession}
            now={now}
            onNavigateToStart={() => navigate(routePaths['Session Workspace'])}
            lastSession={lastRealSession}
            onViewSessions={() => navigate(routePaths['Session History'])}
            recentSessions={sessionItems.slice(0, 5)}
            calendarSessions={analyticsSessions}
            onNavigate={navigate}
            weeklySummary={weeklySummary}
            onSelectSession={openSession}
          />
        )}
        {view === 'Session Workspace' && (
          <SessionWorkspacePage
            repositories={repositories}
            loading={repositoriesLoading}
            error={repositoriesError}
            onRetry={() => identity && loadRepositories()}
            onStart={startSession}
            activeSession={activeSession}
            completedSession={completedSession}
            now={now}
            isEndingSession={isEndingSession}
            sessionEndingAt={sessionEndingAt}
            onFinish={finishSession}
            onCancel={cancelSession}
            onUpdateGoal={updateActiveGoal}
            onViewCompletedSession={(sessionId) => navigate(sessionDetailPath(sessionId))}
            onStartAnother={() => setCompletedSession(null)}
            onRetryActivity={retrySessionActivity}
            projects={projects}
            exampleRepositories={exampleRepositories}
            exampleProjects={exampleProjects}
            onNavigate={navigate}
          />
        )}
        {view === 'Session History' && (
          identityStatus === 'authenticated'
            ? <SessionHistoryPage sessions={sessionItems} onSelectSession={(sessionId) => openSession(sessionId, { fromHistory: true })} />
            : <OverviewPage {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Projects' && (
          identityStatus === 'authenticated'
            ? <ProjectsPage projects={projects} exampleProjects={exampleProjects} onNavigate={navigate} onStartSession={() => navigate(routePaths['Session Workspace'])} />
            : <OverviewPage {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Project Detail' && (
          routeProject
            ? <ProjectDetailPage key={routeProject.key} project={routeProject} onBack={() => navigate(routePaths.Projects)} onSelectSession={openSession} />
            : <section className="dashboard-section"><h2>Repository not found</h2><p className="dashboard-empty-note">There are no Panta sessions for this repository yet.</p><button className="subtle-action" type="button" onClick={() => navigate(routePaths.Projects)}>Back to Repositories</button></section>
        )}
        {view === 'Analytics' && <AnalyticsPage sessions={analyticsSessions} onNavigate={navigate} />}
        {view === 'Settings' && <SettingsPage identity={identity} onLogout={handleLogout} hasActiveSession={Boolean(activeSession)} savedSessionCount={realSessions.length} onDeleteHistory={deleteSessionHistory} />}
        {view === 'Session Detail' && (
          (completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getDummySessionById(route.sessionId))
            ? <SessionDetailPage
                key={route.sessionId}
                session={completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getDummySessionById(route.sessionId)}
                onRetryActivity={retrySessionActivity}
                onDelete={deleteSession}
                onUpdateGoal={updateSessionGoal}
                onBack={() => {
                  setCompletedSession(null);
                  if (window.history.state?.returnToHistory) window.history.back();
                  else navigate(routePaths['Session History']);
                }}
              />
            : <section className="dashboard-section"><h2>Session not found</h2><p className="dashboard-empty-note">That session could not be found.</p><button className="subtle-action" type="button" onClick={() => navigate(routePaths['Session History'])}>Back to Session History</button></section>
        )}
        {view === 'Not Found' && <NotFoundPage onGoHome={() => navigate(routePaths.Overview)} />}
        </main>
        <Footer />
      </div>
    </div>
  );
}
