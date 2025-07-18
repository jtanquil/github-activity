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
function ref_typePluralize(type) {
  switch(type) {
    case "branch":
      return "branches";
    case "tag":
      return "tags";
    case "repository":
      return "repositories";
  }
}

function pluralize(value, word) {
  return (value === 1) ? word : word + "s";
}

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

function parsePullRequestEvent(key) {
  switch (key) {
    case "opened":
    case "edited":
    case "closed":
    case "reopened":
    case "assigned":
    case "reassigned":
    case "unassigned":
    case "labeled":
    case "unlabeled":
      return capitalize(key);
    case "review_requested":
      return "Requested a review on";
    case "review_request_removed":
      return "Removed a review request on";
    case "synchronize":
      return "Synchronized";
  }
}

const EVENT_PARSERS = {
  PushEvent: (repo, value) => [`- Pushed ${value} commit${(value === 1) ? "" : "s"} to ${repo}`],
  PublicEvent: (repo, value) => [`- Made ${repo} public`],
  WatchEvent: (repo, value) => [`- Starred ${repo}`],
  CreateEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    acc.concat(`- Created ${value[key]} ${(value[key] === 1) ? key : ref_typePluralize(key)} at ${repo}`) , []),
  DeleteEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    acc.concat(`- Deleted ${value[key]} ${(value[key] === 1) ? key : ref_typePluralize(key)} from ${repo}`), []),
  ForkEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- Forked ${repo} to ${key}`, []),
  GollumEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${capitalize(key)} ${value[key]} wiki page${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  CommitCommentEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${capitalize(key)} ${value[key]} commit comment${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  IssueCommentEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${capitalize(key)} ${value[key]} issue/pull request comment${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  IssuesEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${capitalize(key)} ${value[key]} issue${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  MemberEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${capitalize(key)} ${value[key]} `, []),
  PullRequestEvent: (repo, value) => Object.keys(value).reduce((acc, key) => 
    `- ${parsePullRequestEvent(key)} ${value[key]} pull request${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  PullRequestReviewEvent: (repo, value) => Object.keys(value).reduce((acc, key) =>
    `- ${capitalize(key)} ${value[key]} pull request review${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  PullRequestReviewCommentEvent: (repo, value) => Object.keys(value).reduce((acc, key) =>
    `- ${capitalize(key)} ${value[key]} pull request review comment${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  PullRequestReviewThreadEvent: (repo, value) => Object.keys(value).reduce((acc, key) =>
    `- ${capitalize(key)} ${value[key]} pull request review thread${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  ReleaseEvent: (repo, value) => Object.keys(value).reduce((acc, key) =>
    `- ${capitalize(key)} ${value[key]} release event${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
  SponsorshipEvent: (repo, value) => Object.keys(value).reduce((acc, key) =>
    `- ${capitalize(key)} ${value[key]} sponsorship event${(value[key] === 1) ? "" : "s"} on ${repo}`, []),
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
  try {
    const response = await fetch(getEndpoint(username));
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const eventList = await response.json();
    return eventList;
  } catch (error) {
    console.error(`Error fetching events: ${error.message}`);
  }
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