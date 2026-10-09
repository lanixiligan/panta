const fileStatuses = { A: 'added', M: 'modified', D: 'removed', R: 'renamed' };
const author = { name: 'Lanix Iligan', login: 'lanixiligan' };

// A stable, made-up 40-character SHA so example commits have realistic-looking IDs.
export function exampleSha(seed) {
  let hash = 2166136261;
  let sha = '';
  for (let round = 0; sha.length < 40; round += 1) {
    for (const character of `${seed}:${round}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    sha += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return sha.slice(0, 40);
}

// Commits are written as [time, message, files, branches?], files as [path, status, additions, deletions].
// `time` is HH:MM on the session's `date` (+08:00), or a full ISO timestamp.
// Activity totals are derived from them so the example numbers stay consistent.
export function exampleSession({ id, date, branches, commits: commitRows, ...session }) {
  const commits = commitRows.map(([time, message, files, commitBranches = branches], index) => {
    const fileDetails = files.map(([filename, status, additions, deletions]) => ({
      filename, status: fileStatuses[status], additions, deletions, changes: additions + deletions,
    }));
    const additions = fileDetails.reduce((total, file) => total + file.additions, 0);
    const deletions = fileDetails.reduce((total, file) => total + file.deletions, 0);
    return {
      sha: exampleSha(`${id}-${index}`),
      message,
      timestamp: time.includes('T') ? time : `${date}T${time}:00+08:00`,
      author,
      committer: author,
      additions,
      deletions,
      totalChanges: additions + deletions,
      files: fileDetails,
      branches: commitBranches,
    };
  });

  return {
    id,
    source: 'placeholder',
    status: 'completed',
    ...session,
    activity: {
      commits: commits.length,
      filesChanged: new Set(commits.flatMap((commit) => commit.files.map(({ filename }) => filename))).size,
      additions: commits.reduce((total, commit) => total + commit.additions, 0),
      deletions: commits.reduce((total, commit) => total + commit.deletions, 0),
    },
    commits,
  };
}
