const fs = require('fs');

const file = process.argv[2];
if (!file) process.exit(0);

const content = fs.readFileSync(file, 'utf8');

if (file.includes('git-rebase-todo')) {
  // Change 'pick' to 'reword'
  const newContent = content.replace(/^pick /gm, 'reword ');
  fs.writeFileSync(file, newContent);
} else if (file.includes('COMMIT_EDITMSG')) {
  let lines = content.split('\n');
  let firstLine = lines[0];

  if (firstLine.includes('feat: implement initial application routing')) {
    firstLine = 'feat: implement initial app routing and protected routes';
  } else if (firstLine.includes('feat: add ComingSoon component')) {
    firstLine = 'feat: add ComingSoon landing component with login CTA';
  } else if (firstLine.includes('feat: add new client application')) {
    // Actually the first error was max length 92 and 107.
    // Let's modify all 3 just to be safe they aren't > 72 chars and don't end in dot.
    firstLine = 'feat: add new client app with React, Vite, and core features';
  }

  // Remove trailing period if it exists
  if (firstLine.endsWith('.')) {
    firstLine = firstLine.slice(0, -1);
  }

  lines[0] = firstLine;
  fs.writeFileSync(file, lines.join('\n'));
}
