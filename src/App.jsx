import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser } from './api/auth.js';
import { getAccessibleRepositories, getActiveSessionCommits, getSessionActivity } from './api/github.js';
import OverviewDashboard from './pages/OverviewDashboard.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import SessionsPage from './pages/SessionsPage.jsx';
import SessionDetailPage from './pages/SessionDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import StartSessionPage from './pages/StartSessionPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AuthenticationPage from './pages/AuthenticationPage.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { getDailySessionActivity, getProjectsWithSessions, getSessionById, getSessionListItems, getSessions, getWeeklySummary } from './dummydata/index.js';
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
    if (commit?.sha) commitsBySha.set(commit.sha, { ...commitsBySha.get(commit.sha), ...commit });
  });
  return [...commitsBySha.values()].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
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
  const allDummySessions = useMemo(() => getSessions(), []);
  const analyticsSessions = useMemo(() => [...realSessions, ...allDummySessions], [realSessions, allDummySessions]);
  const sessionItems = getSessionListItems([...realSessions, ...allDummySessions])
    .sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt));
  const dummyProjects = getProjectsWithSessions();
  const weeklySummary = getWeeklySummary(allDummySessions);
  const activityDays = getDailySessionActivity(allDummySessions);

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

  function navigate(path) {
    if (path === window.location.pathname) return;
    window.history.pushState({}, '', path);
    setPathname(window.location.pathname);
  }

  function openSession(sessionId) {
    setCompletedSession(null);
    navigate(sessionDetailPath(sessionId));
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
    if (window.location.pathname !== routePaths['Start Session']) {
      navigate(routePaths['Start Session']);
    }
  }

  async function retrieveSessionActivity(session, updateState = true) {
    try {
      const activity = await getSessionActivity(session.repository, session.startedAt, session.endedAt);
      const commits = mergeCommits(session.commits || [], activity.commits || []);
      const updatedSession = {
        ...session,
        ...activity,
        activity: { ...activity.activity, commits: commits.length },
        commits,
        activityStatus: 'complete',
        activityError: '',
      };
      if (updateState) updateRealSession(updatedSession);
      return updatedSession;
    } catch (error) {
      const failedSession = { ...session, activity: null, commits: session.commits || [], activityStatus: 'error', activityError: error.message || 'Could not retrieve GitHub commits for this session.' };
      if (updateState) updateRealSession(failedSession);
      return failedSession;
    }
  }

  function updateRealSession(session) {
    setCompletedSession((current) => current?.id === session.id ? session : current);
    setRealSessions((current) => current.map((item) => item.id === session.id ? session : item));
  }

  function retrySessionActivity(session) {
    if (!session || session.activityStatus === 'loading') return;
    const retryingSession = { ...session, activityStatus: 'loading', activityError: '' };
    updateRealSession(retryingSession);
    void retrieveSessionActivity(retryingSession);
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
    <AppShell
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
    >
        {view === 'Overview' && (
          <OverviewDashboard
            {...identityProps}
            activeSession={activeSession}
            now={now}
            isEndingSession={isEndingSession}
            sessionEndingAt={sessionEndingAt}
            onFinishSession={finishSession}
            onNavigateToStart={() => navigate(routePaths['Start Session'])}
            onViewSessions={() => navigate(routePaths.Sessions)}
            recentSessions={sessionItems.slice(0, 4)}
            weeklySummary={weeklySummary}
            activityDays={activityDays}
            onSelectSession={openSession}
          />
        )}
        {view === 'Start Session' && (
          <StartSessionPage
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
            onViewCompletedSession={(sessionId) => navigate(sessionDetailPath(sessionId))}
            onStartAnother={() => setCompletedSession(null)}
            onRetryActivity={retrySessionActivity}
          />
        )}
        {view === 'Sessions' && (
          identityStatus === 'authenticated'
            ? <SessionsPage sessions={sessionItems} onSelectSession={openSession} onBack={() => navigate(routePaths.Overview)} activeSession={activeSession} now={now} isEndingSession={isEndingSession} sessionEndingAt={sessionEndingAt} onFinish={finishSession} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Projects' && (
          identityStatus === 'authenticated'
            ? <ProjectsPage identity={identity} repositories={repositories} loading={repositoriesLoading} error={repositoriesError} onRetry={() => identity && loadRepositories(identity.username)} dummyProjects={dummyProjects} onSelectSession={openSession} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Analytics' && <AnalyticsPage sessions={analyticsSessions} onSelectSession={openSession} />}
        {view === 'Profile' && (
          identityStatus === 'authenticated' && identity
            ? <ProfilePage identity={identity} hasSessions={Boolean(activeSession)} onStart={() => navigate(routePaths['Start Session'])} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Settings' && <SettingsPage identity={identity} onLogout={handleLogout} />}
        {view === 'Session Detail' && (
          (completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getSessionById(route.sessionId))
            ? <SessionDetailPage
                session={completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getSessionById(route.sessionId)}
                onRetryActivity={retrySessionActivity}
                onBack={() => { setCompletedSession(null); navigate(routePaths.Sessions); }}
              />
            : <section className="dashboard-section"><h2>Session not found</h2><p className="dashboard-empty-note">That session could not be found.</p><button className="subtle-action" type="button" onClick={() => navigate(routePaths.Sessions)}>Back to sessions</button></section>
        )}
        {view === 'Not Found' && <NotFoundPage onGoHome={() => navigate(routePaths.Overview)} />}
    </AppShell>
  );
}
