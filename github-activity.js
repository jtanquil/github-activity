"use strict";

const HELP_STRING = `github-activity usage:
github-activity [username]`;
const EVENT_TYPES = {
  PushEvent: "push",
  PublicEvent: "boolean",
  WatchEvent: "boolean",
  CreateEvent: "payload-ref_type",
  DeleteEvent: "payload-ref_type",
  ForkEvent: "payload-forkee",
  GollumEvent: "payload-pages_action",
  CommitCommentEvent: "payload-action",
  IssueCommentEvent: "payload-action",
  IssuesEvent: "payload-action",
  MemberEvent: "payload-action",
  PullRequestEvent: "payload-action",
  PullRequestReviewEvent: "payload-action",
  PullRequestReviewCommentEvent: "payload-action",
  PullRequestReviewThreadEvent: "payload-action",
  ReleaseEvent: "payload-action",
  SponsorshipEvent: "payload-action",
};

function getEndpoint(username) {
  return `https://api.github.com/users/${username}/events`;
}

// group events by event type repo and event type (commit, issue, star, create)
// {
//   repo_url: {
//     push: number
//     boolean: boolean
//     payload_ref_type: { ref_type: number }
//     payload_forkee: { forkee: number }
//     payload_pages_action: { [pages][action]: number }
//     payload_action: { action: number }
//   }
// }
function ref_typePluralize(value, eventType) {
  switch(eventType) {
    case "branch":
      return (value === 1) ? eventType : "branches";
    case "tag":
      return (value === 1) ? eventType : "tags";
    case "repository":
      return (value === 1) ? eventType : "repositories";
  }
}

function pluralize(value, word) {
  return (value === 1) ? word : word + "s";
}

function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}

function parsePullRequestEvent(eventType) {
  switch (eventType) {
    case "opened":
    case "edited":
    case "closed":
    case "reopened":
    case "assigned":
    case "reassigned":
    case "unassigned":
    case "labeled":
    case "unlabeled":
      return capitalize(eventType);
    case "review_requested":
      return "Requested a review on";
    case "review_request_removed":
      return "Removed a review request on";
    case "synchronize":
      return "Synchronized";
  }
}

function getEventParser(eventVerbParser, eventObject, pluralizer, eventRepoPreposition) {
  return (repo, repoEvents) => Object.keys(repoEvents).reduce((acc, eventType) => 
    acc.concat(`- ${eventVerbParser(eventType)} ${repoEvents[eventType]} ${pluralizer(repoEvents[eventType], eventObject)} ${eventRepoPreposition} ${repo}`), []); 
}

const EVENT_PARSERS = {
  PushEvent: (repo, repoEvents) => [`- Pushed ${repoEvents} commit${(repoEvents === 1) ? "" : "s"} to ${repo}`],
  PublicEvent: (repo, repoEvents) => [`- Made ${repo} public`],
  WatchEvent: (repo, repoEvents) => [`- Starred ${repo}`],
  CreateEvent: (repo, repoEvents) => Object.keys(repoEvents).reduce((acc, eventType) => 
    acc.concat(`- Created ${repoEvents[eventType]} ${ref_typePluralize(repoEvents[eventType], eventType)} at ${repo}`) , []),
  DeleteEvent: (repo, repoEvents) => Object.keys(repoEvents).reduce((acc, eventType) => 
    acc.concat(`- Deleted ${repoEvents[eventType]} ${ref_typePluralize(repoEvents[eventType], eventType)} from ${repo}`), []),
  ForkEvent: (repo, repoEvents) => Object.keys(repoEvents).reduce((acc, eventType) => 
    `- Forked ${repo} to ${eventType}`, []),
  GollumEvent: getEventParser(capitalize, "wiki page", pluralize, "on"),
  CommitCommentEvent: getEventParser(capitalize, "commit comment", pluralize, "on"),
  IssueCommentEvent: getEventParser(capitalize, "issue/pull request comment", pluralize, "on"),
  IssuesEvent: getEventParser(capitalize, "issue", pluralize, "on"),
  MemberEvent: getEventParser(capitalize, "member", pluralize, "on"),
  PullRequestEvent: getEventParser(parsePullRequestEvent, "pull request", pluralize, "on"),
  PullRequestReviewEvent: getEventParser(capitalize, "pull request review", pluralize, "on"),
  PullRequestReviewCommentEvent: getEventParser(capitalize, "pull request review comment", pluralize, "on"),
  PullRequestReviewThreadEvent: getEventParser(capitalize, "pull request review thread", pluralize, "on"),
  ReleaseEvent: getEventParser(capitalize, "release event", pluralize, "on"),
  SponsorshipEvent: getEventParser(capitalize, "sponsorship event", pluralize, "on")
};

function parseEventList(events) {
  // for each event, if the repo is in the parsed list, flag star/create or increment commit/issue depending on event type
  // else, add repo to the parsed list w/appropriate event type
  const eventList = events.reduce((acc, event) => {
    if (!(event.repo.name in acc)) {
      acc[event.repo.name] = {};
    }

    switch(EVENT_TYPES[event.type]) {
      case "push":
        acc[event.repo.name][event.type] = (event.type in acc[event.repo.name]) ? 
          acc[event.repo.name][event.type] + 1 : 1;
        break;
      case "boolean":
        acc[event.repo.name][event.type] = true;
        break;
      case "payload-ref_type":
      case "payload-forkee":
      case "payload-pages_action":
      case "payload-action":
        const keyName = EVENT_TYPES[event.type].split("-").at(-1);
        const key = (EVENT_TYPES[event.type] !== "payload-pages_action") ? 
          event.payload[keyName] : event.payload.pages[keyName];

        if (!(event.type in acc[event.repo.name])) {
          acc[event.repo.name][event.type] = { [key]: 1 };
        } else {
          acc[event.repo.name][event.type][key] = (key in acc[event.repo.name][event.type]) ?
            acc[event.repo.name][event.type][key] + 1 : 1;
        }

        break;
    }

    return acc;
  }, {});

  return Object.keys(eventList).reduce((acc, repo) => 
    acc.concat(Object.keys(eventList[repo]).reduce((acc, eventType) =>
      acc.concat(EVENT_PARSERS[eventType](repo, eventList[repo][eventType]))
    , []))
  , []).join("\n");
}

async function getEventList(username) {
  const response = await fetch(getEndpoint(username));
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  const eventList = await response.json();
  return eventList;
}

async function printEvents(username) {
  const events = await getEventList(username);
  const parsedEventList = parseEventList(events);
  console.log("Output:");
  console.log(parsedEventList);
}

const args = process.argv.slice(2);

if (args.length == 0) {
  console.log(HELP_STRING);
} else {
  printEvents(args[0]);
}