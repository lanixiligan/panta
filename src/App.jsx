import React, { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from './api/auth.js';
import { getUserRepositories } from './api/github.js';
import OverviewDashboard from './pages/OverviewDashboard.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import SessionsPage from './pages/SessionsPage.jsx';
import SessionDetailPage from './pages/SessionDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AuthenticationPage from './pages/AuthenticationPage.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { getDailySessionActivity, getProjectsWithSessions, getSessionById, getSessionListItems, getSessions, getWeeklySummary } from './dummydata/index.js';

export default function App() {
  const [view, setView] = useState('Overview');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [identityStatus, setIdentityStatus] = useState('loading');
  const [identityError, setIdentityError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const loadId = useRef(0);
  const allDummySessions = getSessions();
  const dummySessionItems = getSessionListItems(allDummySessions);
  const dummyProjects = getProjectsWithSessions();
  const weeklySummary = getWeeklySummary(allDummySessions);
  const activityDays = getDailySessionActivity(allDummySessions);

  function openSession(sessionId) {
    setSelectedSessionId(sessionId);
    setView('Session Detail');
  }

  async function loadRepositories(username) {
    const requestId = ++loadId.current;
    setRepositoriesLoading(true);
    setRepositoriesError('');
    try {
      const result = await getUserRepositories(username);
      if (requestId === loadId.current) setRepositories(result);
    } catch {
      if (requestId === loadId.current) setRepositoriesError('Couldn’t load your repositories. GitHub may be temporarily unavailable.');
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
      setRepositoriesLoading(true);
      try {
        const result = await getUserRepositories(user.username);
        if (requestId === loadId.current) setRepositories(result);
      } catch {
        if (requestId === loadId.current) setRepositoriesError('Couldn’t load your repositories. GitHub may be temporarily unavailable.');
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
    if (!activeSession) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  function startSession({ repository, goal, targetMinutes }) {
    setSessionNotice('');
    setNow(Date.now());
    setActiveSession({ repository, goal, targetMinutes, startedAt: Date.now() });
  }

  function finishSession() {
    setActiveSession(null);
    setSessionNotice('Local session preview ended. It wasn’t saved or synced.');
  }

  function handleLogout() {
    setIdentity(null);
    setIdentityStatus('unauthenticated');
    setRepositories([]);
    setActiveSession(null);
    setView('Overview');
  }

  const identityProps = {
    identity,
    identityStatus,
    identityError,
    repositories,
    repositoriesLoading,
    repositoriesError,
    onRetryIdentity: loadWorkspace,
    onRetryRepositories: () => identity && loadRepositories(identity.username),
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
      onNavigate={setView}
      activeSession={activeSession}
      now={now}
      onLogout={handleLogout}
    >
        {view === 'Overview' && (
          <OverviewDashboard
            {...identityProps}
            activeSession={activeSession}
            now={now}
            onStartSession={startSession}
            onFinishSession={finishSession}
            sessionNotice={sessionNotice}
            onViewSessions={() => setView('Sessions')}
            recentSessions={dummySessionItems.slice(0, 4)}
            weeklySummary={weeklySummary}
            activityDays={activityDays}
            onSelectSession={openSession}
          />
        )}
        {view === 'Sessions' && (
          identityStatus === 'authenticated'
            ? <SessionsPage sessions={dummySessionItems} weeklySummary={weeklySummary} onSelectSession={openSession} onStart={() => setView('Overview')} activeSession={activeSession} now={now} onFinish={finishSession} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Projects' && (
          identityStatus === 'authenticated'
            ? <ProjectsPage identity={identity} repositories={repositories} loading={repositoriesLoading} error={repositoriesError} onRetry={() => identity && loadRepositories(identity.username)} dummyProjects={dummyProjects} onSelectSession={openSession} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Profile' && (
          identityStatus === 'authenticated' && identity
            ? <ProfilePage identity={identity} hasSessions={Boolean(activeSession)} onStart={() => setView('Overview')} />
            : <OverviewDashboard {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Settings' && <SettingsPage />}
        {view === 'Session Detail' && (
          getSessionById(selectedSessionId)
            ? <SessionDetailPage session={getSessionById(selectedSessionId)} onBack={() => setView('Sessions')} />
            : <section className="dashboard-section"><h2>Session not found</h2><p className="dashboard-empty-note">That example session is no longer available.</p><button className="subtle-action" type="button" onClick={() => setView('Sessions')}>Back to sessions</button></section>
        )}
    </AppShell>
  );
}
