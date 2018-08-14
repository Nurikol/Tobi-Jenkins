import {
    IConfig, connectionDefaults, createRabbitConnector, IConfigSchema, InboundSlackMessage, IParsedMessage,
    ISapUser, ISlackActionResponse, ISlackOriginalMessage, ITimerMessage, TobiClientConnector, TobiService,
} from "@tobi/connector"
import * as winston from "winston"
import { Formatter } from "./formatter"
import { IHelloWorldResponse } from "./formatter.spec"
import { DataServer } from "./server"
import { User } from "./user"
import { URLLoader } from "./url-loader"

export interface IParameter {
    name: string,
    value: string
}

export interface IServiceParameters {
    parameter1: IParameter
}

export interface IConfigInstanceSchema {
    jenkins: string,
    username: string,
    password: string,
    csrf: boolean
}

export interface ITimerMessage {
    configurationIndex: number
    event: string
    timer: string
}

// global variable
let index: number = 0  // cursor of pipeline stages
let allSuccess: boolean = true // indicator of pipeline stages status

// configuration
let hosturl = ""
let username = ""
let password = ""
let csrf: boolean
let csrf_token = ""
let crumbRequestField = ""

export class Service extends TobiService<IConfigInstanceSchema> {
    public serviceId: string
    public serviceSecret: string
    public tobiClientConnector: TobiClientConnector
    public URLLoader: URLLoader = new URLLoader()
    public channelConfiguration: IConfigSchema<IConfigInstanceSchema> = { teams: {} }

    // Private config: Config
    private readonly dataServer: DataServer
    private readonly formatter: Formatter
    // object to store the configuration

    public constructor(logger: winston.LoggerInstance, config: IConfig, formatter: Formatter) {
        super(config.service_id, config.service_secret, config.verification_token, logger)
        // Switch to connectionDefaults.localhost when you're using the Tobi-Platform locally
        // For normal service development connectionDefaults.production should be used
        this.logger = logger
        // this.config = config
        this.formatter = formatter
        this.dataServer = new DataServer(logger, config, new URLLoader(), this.tobiClientConnector)
        this.dataServer.start()
        logger.info("Data Server started")
    }

    public async respondAction(teamId: string, actionMessage: ISlackActionResponse) {
        let response = ""
        if (actionMessage.actions === undefined) {
            const keys = Object.keys(actionMessage.submission)
            let msgUrl = ""
            for (const key of keys) {
                if (key === "jobName") {
                    msgUrl += `${hosturl}/job/${actionMessage.submission[key]}/buildWithParameters?`
                } else {
                    msgUrl += `${key}=${actionMessage.submission[key]}&`
                }
            }
            this.URLLoader.loadDataViaURL([{
                id: "build",
                url: `${msgUrl}`,
                user: `${username}`,
                pass: `${password}`,
                crumbRequestField: crumbRequestField,
                csrf: csrf_token,
                payload: "1"
            }]).then((paraValue: any) => {
                this.startJenkins(teamId, actionMessage.channel.id, paraValue, actionMessage.submission.jobName)
            }).catch((e) => { // cannot connect jenkins server
             })
        } else {
            if (actionMessage.actions[0].name === "paraBuild") {
                this.openDialogForPara(teamId, actionMessage.channel.id, actionMessage.trigger_id, actionMessage.actions[0].value)
                // await this.tobiClientConnector.slack.webApiCall(teamId, "chat", "update", { ts: actionMessage.message_ts, channel: actionMessage.channel.id, text: `\`${actionMessage.actions[0].value}\` is to build with parameters.`, attachments: [] }, true)
            } else if (actionMessage.actions[0].name === "stop") {
                this.processStop(teamId, actionMessage)
            } else if (actionMessage.actions[0].name === "job_menu") {
                this.logger.info("menu option is clicked.")
                this.logger.info(teamId + JSON.stringify(actionMessage))
                this.trigerBuild(teamId, actionMessage.channel.id, actionMessage.actions[0].selected_options![0].value)
                response = `Job \`${actionMessage.actions[0].selected_options![0].value}\` is selected.`
                await this.tobiClientConnector.slack.webApiCall(teamId, "chat", "update", { ts: actionMessage.message_ts, channel: actionMessage.channel.id, text: response, attachments: [] }, true)
            } else {
                this.trigerBuild(teamId, actionMessage.channel.id, actionMessage.actions[0].value)
                response = `Job \`${actionMessage.actions[0].value}\` is selected.`
                await this.tobiClientConnector.slack.webApiCall(teamId, "chat", "update", { ts: actionMessage.message_ts, channel: actionMessage.channel.id, text: response, attachments: [] }, true)
            }
        }
    }

    public respondMSTeams(): void {
        this.logger.error("Method not implemented.")
    }

    public respondRelay(): void {
        this.logger.error("Method not implemented.")
    }

    public async respondSlack(
        teamId: string, inboundSlackMessage: InboundSlackMessage, parsedMessage: IParsedMessage<IServiceParameters>): Promise<void> {
        const param: string = inboundSlackMessage.text

        const whoisSlackUser: ISapUser =
            await User.getInstanceBySlackUserID(this.tobiClientConnector, teamId, inboundSlackMessage.user)
        this.logger.info(`${whoisSlackUser.firstname} sent a message`)

        try {
            const response: {} | void = await this.getResponse(param)
            this.sendMessageToSlack(teamId, inboundSlackMessage.channel, response)
        } catch (error) {
            this.logger.error(error)
        }
    }

    public respondTimer(teamId: string, channelId: string, timerMessage: ITimerMessage): void {
        this.logger.info(`${teamId} + ${channelId} + ${JSON.stringify(timerMessage)}`)
        this.logger.error("Method not implemented.")
    }

    public async onSlackMessage(teamId: string, inboundSlackMessage: InboundSlackMessage, parsedMessage: IParsedMessage<any>) {
        // const whoisSlackUser: ISapUser = await User.getInstanceBySlackUserID(this.tobiClientConnector, teamId, inboundSlackMessage.user)
        // this.logger.info(`${whoisSlackUser.firstname} sent a message`)

        // store configurations
        if (this.channelConfiguration.teams[teamId].channels[inboundSlackMessage.channel][0] !== undefined) {
            hosturl = this.channelConfiguration.teams[teamId].channels[inboundSlackMessage.channel][0].jenkins
            username = this.channelConfiguration.teams[teamId].channels[inboundSlackMessage.channel][0].username
            password = this.channelConfiguration.teams[teamId].channels[inboundSlackMessage.channel][0].password
            csrf = this.channelConfiguration.teams[teamId].channels[inboundSlackMessage.channel][0].csrf
        } else {
            this.logger.error("Configuration error")
            this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: this.formatter.getConfigReminder() })
        }
        this.logger.info(hosturl)
        this.logger.info(JSON.stringify(parsedMessage))
        if (hosturl !== "" ) { // && username !== "" && password !== ""
            if (parsedMessage.intent === "Build") {
                this.respondBuild(teamId, inboundSlackMessage, parsedMessage)
            } else if (parsedMessage.intent === "help") {
                let message = "To trigger/build a specific jenkins job, you can say \`@tobi build jenkins job <jobname>\` or \`@tobi trigger jenkins job <jobname>\`\n"
                message += "To select one of the available jobs, you can say \`@tobi build(or trigger) jenkins job\`\nTo show all available jobs, say \`@tobi show jenkins jobs\`"
                this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: {text: message}})
            } else if (parsedMessage.intent === "showAllJobs") {
                this.respondShow(teamId, inboundSlackMessage, parsedMessage)
            }
        } else { // No valid configuration
            this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: this.formatter.getConfigReminder() })
        }
    }

    public async respondBuild(teamId: string, inboundSlackMessage: InboundSlackMessage, parsedMessage: IParsedMessage<any>) {
        if (csrf === true) {
            await this.URLLoader.loadDataViaURL([{
                id: "crumb",
                url: `${hosturl}/crumbIssuer/api/json`,
                user: `${username}`,
                pass: `${password}`,
            }]).then((csrf_data: any) => {
                // console.log(csrf_data)
                csrf_token = csrf_data.result.crumb.crumb
                crumbRequestField  = csrf_data.result.crumb.crumbRequestField
            }).catch((e) => { // cannot connect jenkins server
                this.logger.error(e)
            })
        }
        let jobName: string = ""
        // find all jobs existing in jenkins
        this.URLLoader.loadDataViaURL([{
            id: "getJobs",
            url: `${hosturl}/api/json?pretty=true`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then(async (jenkinsValue: any) => {
            // traverse all enter keywords to each job
            index = 0
            allSuccess = true
            const jobs: any[] = jenkinsValue.result.getJobs.jobs
            // check if users enter a specific job name
            const input_jobName = parsedMessage.entities.jobName ? parsedMessage.entities.jobName.value : ""
            this.logger.info(input_jobName)
            this.logger.info(parsedMessage.entities)
            if (input_jobName !== "") {
                const inputs: any[] = parsedMessage.entities.jobName.value.split(" ")
                const searchJob: any[] = []
                for ( const job of jobs) {
                    // the input is exactly the job name
                    if ((inputs[0] === job.name) && (inputs.length === 1)) {
                        jobName = inputs[0]
                        break
                    }
                    // check which jobs contain all the keywords
                    for (let j = 0; j < inputs.length; j++) {
                        const searchResult: number = job.name.indexOf(inputs[j])
                        if (searchResult === -1) {
                            break
                        }
                        if (j === inputs.length - 1) {
                            searchJob.push(job.name)
                        }
                    }
                }
                // output according all situations
                if (searchJob.length === 1 || jobName) {
                    if (searchJob.length === 1) {
                        jobName = searchJob[0]
                    }
                    this.trigerBuild(teamId, inboundSlackMessage.channel, jobName)
                } else if (searchJob.length === 0) {
                    const sendMessage = `*There is no corresponding job.*`
                    this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: { text: sendMessage } })
                } else {
                    for (const res of this.formatter.getMultiJobChoice(this.serviceId, searchJob)) {
                        await this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: res })
                    }
                }
            } else {
                // console.log(parsedMessage.entities)
                // const want = parsedMessage.entities.intent.value.split(" ")[parsedMessage.entities.intent.value.split(" ").length - 1]
                // console.log(want)
                const job_menu: any[] = []
                for (const job of jobs) {
                    job_menu.push(job.name)
                }
                this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: { attachments: this.formatter.showAllJobsMenu(this.serviceId, job_menu)} })
            }
        }
        ).catch((e) => { // cannot connect jenkins server
            this.logger.error(e)
            console.error("Unable to reach jenkins server provided. Build failed.")
            this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel,
                                                            payload: this.formatter.showConnectionError()})
        })
    }

    public async respondShow(teamId: string, inboundSlackMessage: InboundSlackMessage, parsedMessage: IParsedMessage<any>) {
        if (csrf === true) {
            await this.URLLoader.loadDataViaURL([{
                id: "crumb",
                url: `${hosturl}/crumbIssuer/api/json`,
                user: `${username}`,
                pass: `${password}`,
            }]).then((csrf_data: any) => {
                // console.log(csrf_data)
                csrf_token = csrf_data.result.crumb.crumb
                crumbRequestField  = csrf_data.result.crumb.crumbRequestField
            }).catch((e) => { // cannot connect jenkins server
                this.logger.error(e)
            })
        }
        // find all jobs existing in jenkins
        this.URLLoader.loadDataViaURL([{
            id: "getJobs",
            url: `${hosturl}/api/json?pretty=true`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then(async (jenkinsValue: any) => {
            // traverse all enter keywords to each job
            index = 0
            allSuccess = true
            const jobs: any[] = jenkinsValue.result.getJobs.jobs
            let message = ""
            for (const job of jobs) {
                message = `${message} \`${job.name}\``
            }
            this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel, payload: { text: message } })
        }
        ).catch((e) => { // cannot connect jenkins server
            this.logger.error(e)
            console.error("Unable to reach jenkins server provided. Build failed.")
            this.tobiClientConnector.respondSlack(teamId, { channel: inboundSlackMessage.channel,
                                                            payload: this.formatter.showConnectionError()})
        })
    }

    public startJenkins(teamId: string, channelId: any, value: any, jobName: any) {
        this.URLLoader.loadDataViaURL([{
            id: "getqueueInfo",
            url: `${value.location.build}api/json`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then((queueInfo: any) => {
            if (queueInfo.result.getqueueInfo.blocked === false && queueInfo.result.getqueueInfo.executable) {
                const buildNumber = queueInfo.result.getqueueInfo.executable.number
                let i
                for (i = 0; i < queueInfo.result.getqueueInfo.actions.length; i++) {
                    if (queueInfo.result.getqueueInfo.actions[i]._class === "hudson.model.CauseAction" ) {
                        break
                    }
                }
                this.tobiClientConnector.respondSlack(teamId, { channel: channelId, payload: this.formatter.showStartInfo(this.serviceId, jobName, buildNumber, queueInfo.result.getqueueInfo.actions[i].causes[0].shortDescription) })
                this.pipelineJenkins(teamId, channelId, buildNumber, jobName, `${hosturl}/job/${jobName}/${buildNumber}/`)
            } else {
                // keep detecting number
                this.startJenkins(teamId, channelId, value, jobName)
            }
        }).catch((e) => { // cannot connect jenkins server
            this.logger.error(e)
            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                                            payload: this.formatter.showConnectionError()})
        })
    }

    public pipelineJenkins(teamId: string, channelId: any, buildNumber: number, jobName: string, jobPage: string) {
        this.urlDataLoader.loadDataViaURL([{
            id: "getPipelineInfo",
            url: `${jobPage}wfapi/describe`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then((pipeData: any) => {
            if (pipeData.maxStatus === 404 ) { // not a pipeline job
                this.finishedJenkins(teamId, channelId, buildNumber, jobName)
            } else {
                // still processing
                if (pipeData.result.getPipelineInfo.status === "IN_PROGRESS") {
                    // a stage finishing
                    if (pipeData.result.getPipelineInfo.stages[index] && pipeData.result.getPipelineInfo.stages[index].status !== "IN_PROGRESS") {
                        const stageName = pipeData.result.getPipelineInfo.stages[index].name
                        const stageDuration = pipeData.result.getPipelineInfo.stages[index].durationMillis
                        const stageStatus = pipeData.result.getPipelineInfo.stages[index].status
                        if (stageStatus !== "SUCCESS") {
                            allSuccess = false
                        }
                        if (stageDuration <= 0) { // duration is not calculated out.
                            this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage)
                        }
                        else {
                            index = index + 1 // move cursor to read status of next stage
                            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                                                            payload: this.formatter.showStageInfo(jobName, buildNumber, stageName, stageStatus, stageDuration) })
                            this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage) // read status of next stage
                        }
                    }
                    else { // keep reading the current stage
                        // this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage)
                        setTimeout(() => {
                            this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage)
                        }, 10000)
                    }
                } else { // this build is finished
                    if (index < pipeData.result.getPipelineInfo.stages.length) { // check if the last stage info is showed.
                        const lastName = pipeData.result.getPipelineInfo.stages[index].name
                        const lastDuration = pipeData.result.getPipelineInfo.stages[index].durationMillis
                        const lastStatus = pipeData.result.getPipelineInfo.stages[index].status
                        if (lastStatus !== "SUCCESS") {
                            allSuccess = false
                        }
                        if (lastDuration <= 0) {this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage)}
                        else {
                            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                payload:  this.formatter.showStageInfo(jobName, buildNumber, lastName, lastStatus, lastDuration) })
                            index = index + 1
                        }
                    }
                    if (allSuccess === true && pipeData.result.getPipelineInfo.status !== "SUCCESS") { // the final status conflicts with all stage.
                        this.pipelineJenkins(teamId, channelId, buildNumber, jobName, jobPage)         // sometimes gets FAILURE even all stage SUCCESS
                    }
                    else {
                        setTimeout(() => {
                            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                payload: this.formatter.showFinishInfo(jobName, buildNumber, pipeData.result.getPipelineInfo.status, pipeData.result.getPipelineInfo.durationMillis, hosturl)})
                            this.testReport(teamId, channelId, jobPage, jobName, buildNumber)
                        }, 500)
                    }
                }
            }
        }).catch((e) => {
            this.logger.error(e)
            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                                            payload: this.formatter.showConnectionError()})
        })
    }

    public finishedJenkins(teamId: string, channelId: any, buildNumber: any, jobName: any) {
        this.urlDataLoader.loadDataViaURL([{
            id: "getBuildInfo",
            url: `${hosturl}/job/${jobName}/${buildNumber}/api/json`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then((buildInfo: any) => {
            const finishResultCode = buildInfo.result.getBuildInfo.result
            const flag: boolean = buildInfo.result.getBuildInfo.duration > 0 ? true : false
            let duration = ""
            if (finishResultCode && flag) {
                duration = buildInfo.result.getBuildInfo.duration
                this.tobiClientConnector.respondSlack(teamId, { channel: channelId, payload: this.formatter.showFinishInfo(jobName, buildNumber, finishResultCode, duration, hosturl) })
                this.testReport(teamId, channelId, `${hosturl}/job/${jobName}/${buildNumber}/`, jobName, buildNumber)
            } else {
                setTimeout(() => {
                    this.finishedJenkins(teamId, channelId, buildNumber, jobName)
                }, 1000)
            }
        }).catch((e) => {
            this.logger.error(e)
            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                                            payload: this.formatter.showConnectionError()})
        })
    }

    private testReport(teamId: string, channelId: any, jobUrl: string, jobName: string, jobNumber: any)  {
        this.urlDataLoader.loadDataViaURL([{
            id: "test",
            url: `${jobUrl}testReport/api/json?pretty=true`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then((testResult: any) => {
            const sendMessage = `\`${jobName} #${testResult.result.test.childReports[0].child.number}\` Test Report: total: ${testResult.result.test.totalCount}; skipped: ${testResult.result.test.skipCount}; failed: ${testResult.result.test.failCount}`
            this.tobiClientConnector.respondSlack(teamId, { channel: channelId, payload: { text: sendMessage } })
        }).catch((e) => {
            this.logger.error("No test report.")
        })
    }

    private trigerBuild(teamId: string, channelId: any, jobName: any) {
        this.URLLoader.loadDataViaURL([{ // check if it needs parameters
            id: "checkPara",
            url: `${hosturl}/job/${jobName}/api/json?pretty=true`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then((paraResult: any) => {
            let paraProperty
            if (paraResult.result.checkPara.property !== undefined) {
                for (const prop of paraResult.result.checkPara.property) {
                    if (prop.parameterDefinitions) {
                        paraProperty = prop.parameterDefinitions
                        break
                    }
                }
            }
            if (paraProperty) {
                this.tobiClientConnector.respondSlack(teamId, { channel: channelId, payload: this.formatter.getParaBuild(this.serviceId, jobName) })
            } else {
                this.URLLoader.loadDataViaURL([{
                    id: "build",
                    url: `${hosturl}/job/${jobName}/build`,
                    user: `${username}`,
                    pass: `${password}`,
                    crumbRequestField: crumbRequestField,
                    csrf: csrf_token,
                    payload: "1"
                }]).then((value: any) => {
                    this.startJenkins(teamId, channelId, value, jobName)
                }).catch((e) => {
                    console.error(e)
                    this.logger.error("trrigerBuild1")
                })
            }
        }).catch((e) => {
            console.error(e)
            this.logger.error("trrigerBuild2")
        })
    }

    private processStop(teamId: string, actionMessage: ISlackActionResponse) {
        const jobName = actionMessage.actions[0].value.split(" ")[0]
        const jobNumber = actionMessage.actions[0].value.split(" ")[1]
        this.URLLoader.loadDataViaURL([{
            id: "getBuildInfo",
            url: `${hosturl}/job/${jobName}/${jobNumber}/api/json`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then(async (buildInfo: any) => {
            if (buildInfo.result.getBuildInfo.result === null) {
                await this.URLLoader.loadDataViaURL([{
                    id: "build",
                    url: `${hosturl}/job/${jobName}/${jobNumber}/stop`,
                    user: `${username}`,
                    pass: `${password}`,
                    crumbRequestField: crumbRequestField,
                    csrf: csrf_token,
                    payload: "1"
                }])
                await this.tobiClientConnector.slack.webApiCall(teamId, "chat", "update", { ts: actionMessage.message_ts, channel: actionMessage.channel.id, text: `Stopping \`${jobName} #${jobNumber}\``, attachments: [] }, true)
            } else {
                await this.tobiClientConnector.slack.webApiCall(teamId, "chat", "update", { ts: actionMessage.message_ts, channel: actionMessage.channel.id, text: `\`${jobName} #${jobNumber}\` is \*finished\*, cannot be stopped.`, attachments: [] }, true)
            }
        }).catch((e) => { // cannot connect jenkins server
            this.logger.error("buildInfo error")
            this.logger.error(e)
            this.tobiClientConnector.respondSlack(teamId, { channel: actionMessage.channel.id, payload: this.formatter.showConnectionError() })
        })
    }

    private openDialogForPara(teamId: string, channelId: string, triggerId: string, jobName: string) {
        this.URLLoader.loadDataViaURL([{ // check if the job need parameters
            id: "checkPara",
            url: `${hosturl}/job/${jobName}/api/json?pretty=true`,
            user: `${username}`,
            pass: `${password}`,
            crumbRequestField: crumbRequestField,
            csrf: csrf_token,
            payload: "1"
        }]).then( async (paraResult: any) => {
            let paraProperty: any
            const paraKey: string[] = []
            const paraValue: string[] = []
            for (const prop of paraResult.result.checkPara.property) {
                if (prop.parameterDefinitions) {
                    paraProperty = prop.parameterDefinitions
                    break
                }
            }
            for (const para of paraProperty) {
                paraKey.push(para.name)
                paraValue.push(para.defaultParameterValue.value)
            }
            // dialog
            try {
                const res = await this.tobiClientConnector.slack.webApiCall(teamId, "dialog", "open", { trigger_id: triggerId, dialog: this.formatter.getDialogForParaBuild(this.serviceId, jobName, paraKey, paraValue)})
                // console.log(res)
            }
            catch (error) {
                console.error(error)
            }
        }).catch((e) => {
            this.tobiClientConnector.respondSlack(teamId, { channel: channelId,
                                                            payload: this.formatter.showConnectionError()})
        })
    }
    private async getResponse(param: string): Promise<void | {}> {
        const data: IHelloWorldResponse = await DataServer.loadData(param)
        const resp: ISlackOriginalMessage = this.formatter.formatResponseForSlack(data)

        return resp
    }
}
