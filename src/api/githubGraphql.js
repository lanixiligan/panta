function normalizeCalendar(calendar) {
  if (!calendar || !Array.isArray(calendar.weeks)) {
    throw new Error('GitHub did not return contribution calendar data.');
  }

  return {
    totalContributions: Number(calendar.totalContributions) || 0,
    colors: Array.isArray(calendar.colors) ? calendar.colors : [],
    months: Array.isArray(calendar.months) ? calendar.months.map(({ name, year, firstDay, totalWeeks }) => ({
      name, year, firstDay, totalWeeks,
    })) : [],
    weeks: calendar.weeks.map((week) => ({
      firstDay: week.firstDay,
      days: (week.contributionDays || []).map(({ contributionCount, contributionLevel, date, weekday, color }) => ({
        date,
        contributionCount: Number(contributionCount) || 0,
        contributionLevel,
        weekday,
        color,
      })),
    })),
  };
}

export async function getContributionCalendar(username) {
  if (!username?.trim()) throw new Error('A GitHub username is required to load contributions.');

  let response;
  try {
    response = await fetch('/api/github/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    });
  } catch {
    throw new Error('Could not reach GitHub’s GraphQL API.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`GitHub GraphQL returned an unreadable response (${response.status}).`);
  }

  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map(({ message: errorMessage }) => errorMessage).filter(Boolean).join(' ');
    if (/rate limit|secondary rate|abuse/i.test(message || '')) {
      throw new Error('GitHub is limiting GraphQL requests right now. Please try again later.');
    }
    if (response.status === 401 || response.status === 403 || /authentication|authorize/i.test(message || '')) {
      throw new Error('GitHub rejected the server credential. Check that GITHUB_TOKEN is valid and has permission to read public profile data.');
    }
    if (message) throw new Error(message);
    throw new Error(`GitHub GraphQL returned an error (${response.status}).`);
  }

  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!payload.data?.user) throw new Error(`GitHub user “${username}” was not found by GraphQL.`);
  return normalizeCalendar(calendar);
}
