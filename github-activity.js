"use strict";

const HELP_STRING = `github-activity usage:
github-activity [username]`;
const EVENT_TYPES = {
  number: ["CommitCommentEvent", "ForkEvent", "GollumEvent", 
    "IssueCommentEvent", "IssuesEvent", "MemberEvent", "PullRequestEvent", 
    "PullRequestReviewEvent", "PullRequestReviewCommentEvent", 
    "PullRequestReviewThreadEvent", "PushEvent", "ReleaseEvent", 
    "SponsorshipEvent"],
  boolean: ["CreateEvent", "DeleteEvent", "PublicEvent", "WatchEvent"]
};

function getEndpoint(username) {
  return `https://api.github.com/users/${username}/events`;
}

// group events by event type repo and event type (commit, issue, star, create)
// {
//   repo_url: {
//     commits: number
//     issues: number
//     stars: boolean
//     create: boolean
//   }
// }
function parseEvents(events) {
  // for each event, if the repo is in the parsed list, flag star/create or increment commit/issue depending on event type
  // else, add repo to the parsed list w/appropriate event type
  return events.reduce((acc, event) => {
    if (!(event.repo.name in acc)) {
      acc[event.repo.name] = {};
    }

    if (EVENT_TYPES.number.includes(event.type)) {
      acc[event.repo.name][event.type] = 
        (event.type in acc[event.repo.name]) ? acc[event.repo.name][event.type] + 1 : 1;
    } else {
      acc[event.repo.name][event.type] = true;
    }

    return acc;
  }, {});
}

async function getEvents(username) {
  try {
    const response = await fetch(getEndpoint(username));
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const events = await response.json();
    return events;
  } catch (error) {
    console.error(`Error fetching events: ${error.message}`);
  }
}

async function printEvents(username) {
  const events = await getEvents(username);
  const parsedEvents = parseEvents(events);
  console.log("Output:");
  console.log(parsedEvents);
}

const args = process.argv.slice(2);

if (args.length == 0) {
  console.log(HELP_STRING);
} else {
  printEvents(args[0]);
}