# tobi-jenkins
tobi-jenkins is a service to help you trigger jenkins jobs remotely and receive build messages through chat clients.

## Usage via Chat Clients like Slack
The jenkins url, username and password are required in the channel configuraion page before using tobi-jenkins.
```
// to get help
@tobi help with jenkins

// to build a specific job
@tobi build jenkins job <job-name>
@tobi trigger jenkins job <job-name>

// to select one of the available jobs
@tobi build jenkins job
@tobi trigger jenkins job

// to show all available jobs
@tobi show jenkins jobs

Note: you can enter multiple parts of the job name because tobi has the ability of approximate string matching.
```

You can abort this build anytime before it is done by clicking the button tobi sends to you right after the build starts.

## Usage via API
to be done

## Configuration Options
You can configure Tobi Services via: https://tobi.mo.sap.corp/config/

## Continuous Deployment
We use Travis CI to automatically test and deploy our code - https://travis-ci.mo.sap.corp/

## Contribute
Tobi Services are developed in an Inner Source Development Style. Every Developer @SAP is invited to fork the repository at hand and contribute.

## Feedback
We are interested in your feedback and especially in any kind of improvement proposals. Feel free to open an issue in the repository at hand. And if have any questions about the tobi server, please contact the contributors to the tobi team, such as Dominik Finkbeiner(D059458).
