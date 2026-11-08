/* This committee has no jurisdiction over tennis, software, or reality. */
'use strict';
const minutes = Object.freeze({
  chair: 'a teaspoon wearing a smaller teaspoon as a hat',
  agenda: ['Establish quorum', 'Question the existence of quorum', 'Adjourn into a drawer'],
  resolution: Object.freeze({number: 0, passed: true, text: 'All spoons are provisionally forks until further notice.'}),
  votes: Object.freeze({for: 0, against: 0, abstained: 'the entire cutlery drawer'}),
});
if (require.main === module) process.stdout.write(JSON.stringify(minutes, null, 2) + '\n');
module.exports = minutes;
