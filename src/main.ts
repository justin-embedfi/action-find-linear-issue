import { debug, setFailed, getInput, setOutput } from "@actions/core";
import { LinearClient } from "@linear/sdk";
import { context } from "@actions/github";
import getTeams from "./getTeams";
import getIssueByTeamAndNumber from "./getIssueByTeamAndNumber";

const main = async () => {
  try {
    const prTitle: string = context?.payload?.pull_request?.title;
    debug(`PR Title: ${prTitle}`);
    if (!prTitle) {
      setFailed(`Could not load PR title`);
      return;
    }

    const prBranch: string = context.payload.pull_request?.head.ref;
    debug(`PR Branch: ${prBranch}`);
    if (!prBranch) {
      setFailed(`Could not load PR branch`);
      return;
    }

    const prBody = context?.payload?.pull_request?.body;
    debug(`PR Body: ${prBody}`);
    if (prBranch === undefined) {
      setFailed(`Could not load PR body`);
      return;
    }

    const apiKey = getInput("linear-api-key", { required: true });
    const linearClient = new LinearClient({ apiKey });
    const teams = await getTeams(linearClient);
    if (teams.length === 0) {
      setFailed(`No teams found in Linear workspace`);
      return;
    }

    for (const team of teams) {
      const regexString = `${team.key}-(\\d+)`;
      const regex = new RegExp(regexString, "gim");
      const haystack = prBranch + " " + prTitle + " " + prBody;
      debug(`Checking PR for indentifier "${regexString}" in "${haystack}"`);
      const outputMultiple = getInput("output-multiple");
      const matches = haystack.match(regex);

      if (!outputMultiple && matches?.length) {
        const issueNumber = matches[0].split("-")[1];
        debug(`Found issue number: ${issueNumber}`);
        const issue = await getIssueByTeamAndNumber(
          linearClient,
          team,
          Number(issueNumber)
        );
        if (issue) {
          setOutput("linear-team-id", team.id);
          setOutput("linear-team-key", team.key);
          setOutput("linear-issue-id", issue.id);
          setOutput("linear-issue-number", issue.number);
          setOutput("linear-issue-identifier", issue.identifier);
          setOutput("linear-issue-url", issue.url);
          setOutput("linear-issue-title", issue.title);
          setOutput("linear-issue-description", issue.description);
          return;
        }
      }

      if (outputMultiple && matches?.length) {
        const issueNumbers = matches.map((match) => match.split("-")[1]);
        debug(`Found issue numbers: ${issueNumbers.toString()}`);
        const issues = await Promise.all(
          issueNumbers.map((issueNumber) =>
            getIssueByTeamAndNumber(linearClient, team, Number(issueNumber))
          )
        );

        if (issues.length) {
          setOutput("linear-team-id", team.id);
          setOutput("linear-team-key", team.key);
          setOutput("linear-issues", JSON.stringify(issues));
          return;
        }
      }
    }

    setFailed(
      `Failed to find Linear issue identifier in PR branch, title, or body.`
    );
    return;
  } catch (error) {
    setFailed(`${(error as any)?.message ?? error}`);
  }
};

main();
