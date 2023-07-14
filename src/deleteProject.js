import {
  CloudFormation,
  waitUntilStackDeleteComplete,
} from "@aws-sdk/client-cloudformation";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";
import "dotenv/config";
import { generateJWT } from "../utils/generateJWT.js";
import { getProjectName } from "../utils/getProjectName.js";

const spinner = ora({
  text: "Deleting project...This could take a few minutes.",
  color: "cyan",
});

const tinkerPurple = chalk.rgb(99, 102, 241);

const cloudFormation = new CloudFormation();
const stackName = await getProjectName(); //placeholder til we see what the tinker CL interaction looks like
const stackParams = { StackName: stackName };

async function deleteProjectFromAdminTable(stackName) {
  try {
    const token = await generateJWT(process.env.SECRET);
    await axios.delete(
      `https://admin.${process.env.DOMAIN_NAME}:3000/projects?name=eq.${stackName}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.error("Failed to delete project from admin projects table", error);
  }
}

async function promisifyDeleteStack(cloudFormation, stackParams) {
  return new Promise((res, rej) => {
    cloudFormation.deleteStack(stackParams, (error, data) => {
      if (error) {
        rej(error);
      }
      res(error);
    });
  });
}

async function deleteStack(cloudFormation, stackParams, spinner) {
  try {
    spinner.start();
    await promisifyDeleteStack(cloudFormation, stackParams);
  } catch (error) {
    spinner.fail("Failed!");
    console.error(chalk.red("Error Deleting Project"), error);
    process.exit(1);
  }
}

const waitStack = async (cloudFormation, stackName, spinner) => {
  const waiterParams = {
    client: cloudFormation,
    maxWaitTime: 900,
  };

  const describeStacksCommandInput = {
    StackName: stackName,
  };

  try {
    await waitUntilStackDeleteComplete(
      waiterParams,
      describeStacksCommandInput
    );
  } catch (error) {
    spinner.fail("Failed.");

    console.error(chalk.red("Project could not be deleted."), error);
    process.exit(1);
  }
};

const deleteProject = async (cloudFormation, stackParams, spinner) => {
  const stackName = stackParams.StackName;
  try {
    await deleteStack(cloudFormation, stackParams, spinner);
    await deleteProjectFromAdminTable(stackName)
    await waitStack(cloudFormation, stackParams, spinner);
    spinner.succeed(tinkerPurple("Project has been deleted"));
  } catch (e) {
    console.error(chalk.red("Project could not be deleted:"), error);
  }
};

await deleteProject(cloudFormation, stackParams, spinner);
await deleteProjectFromAdminTable(stackName);