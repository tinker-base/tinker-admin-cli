import {
  CloudFormation,
  waitUntilStackDeleteComplete,
} from "@aws-sdk/client-cloudformation";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";
import * as jose from "jose";
import "dotenv/config";

const spinner = ora({
  text: "Deleting project...This could take a few minutes.",
  color: "cyan",
});

const tinkerPurple = chalk.rgb(99, 102, 241);

async function generateJWT(jwtSecret) {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const alg = "HS256";
    const jwt = await new jose.SignJWT({ role: "admin" })
      .setProtectedHeader({ alg })
      .sign(secret);
    return jwt;
  } catch (error) {
    console.log("Could not generate JWT.");
  }
}

const cloudFormation = new CloudFormation();
const stackName = process.argv[2]; //placeholder til we see what the tinker CL interaction looks like
const stackParams = { StackName: stackName };

async function deleteProjectFromAdminTable(stackName) {
  try {
    const token = await generateJWT(process.env.SECRET);
    await axios.delete(
      `https://admin.${process.env.DOMAIN_NAME}:3000/rpc/delete_project`,
      { name: stackName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.log("Failed to delete project from admin projects table");
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
    console.error(chalk.red("Error Deleting Project"));
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

    spinner.succeed(tinkerPurple("Project has been deleted"));
  } catch (error) {
    spinner.fail("Failed.");

    console.error(chalk.red("Project could not be deleted."), error);
    process.exit(1);
  }
};

await deleteStack(cloudFormation, stackParams, spinner);
await waitStack(cloudFormation, stackParams, spinner);