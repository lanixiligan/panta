import React from 'react';

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export default function ContributionGraph({ calendar, loading, error }) {
  return (
    <section className="contribution-section panel" aria-labelledby="contribution-heading">
      <div className="section-heading contribution-heading">
        <div>
          <p className="eyebrow">GRAPHQL EXPERIMENT</p>
          <h2 id="contribution-heading">Contribution calendar</h2>
        </div>
        {calendar && <span className="count-badge">{calendar.totalContributions.toLocaleString()} contributions</span>}
      </div>
      {loading && <p className="contribution-status" role="status"><span className="loader" aria-hidden="true" /> Loading contribution data…</p>}
      {!loading && error && <p className="contribution-error" role="status">Unable to load contribution data. {error}</p>}
      {!loading && !error && calendar && (calendar.weeks.length === 0 ? (
        <p className="contribution-status">No contribution data is available for this user.</p>
      ) : (
        <>
          <div className="contribution-scroll" tabIndex="0" aria-label="Scrollable contribution calendar">
            <div className="contribution-months" style={{ gridTemplateColumns: `repeat(${calendar.weeks.length}, 12px)` }} aria-hidden="true">
              {calendar.months.map((month) => {
                const weekIndex = calendar.weeks.findIndex((week, index) => (
                  week.firstDay <= month.firstDay
                  && (!calendar.weeks[index + 1] || calendar.weeks[index + 1].firstDay > month.firstDay)
                ));
                return weekIndex < 0 ? null : <span key={`${month.year}-${month.name}`} style={{ gridColumn: `${weekIndex + 1} / span ${month.totalWeeks}` }}>{month.name}</span>;
              })}
            </div>
            <div className="contribution-grid" role="group" aria-label={`${calendar.totalContributions} contributions across ${calendar.weeks.length} weeks`} style={{ gridTemplateColumns: `repeat(${calendar.weeks.length}, 12px)` }}>
              {calendar.weeks.flatMap((week, weekIndex) => week.days.map((day) => {
                const label = `${day.contributionCount} ${day.contributionCount === 1 ? 'contribution' : 'contributions'} on ${formatDate(day.date)}`;
                return (
                  <span
                    key={day.date}
                    className="contribution-day"
                    role="img"
                    tabIndex="0"
                    aria-label={label}
                    title={label}
                    style={{ gridColumn: weekIndex + 1, gridRow: day.weekday + 1, backgroundColor: day.color || undefined }}
                    data-level={day.contributionLevel}
                  />
                );
              }))}
            </div>
          </div>
          <p className="contribution-note">Each column is a week; hover over or focus a square for its date and count.</p>
        </>
      ))}
    </section>
  );
}
