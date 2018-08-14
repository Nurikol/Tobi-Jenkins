import { FormatterSlack, ISlackAttachment, ISlackOriginalMessage, ISlackAction } from "@tobi/connector"
import { IHelloWorldResponse } from "./formatter.spec"

// The following link supports to develop such things in a test first style:
// Https://api.slack.com/docs/messages/builder

interface IDialogOption {
    label: string
    value: string
}

interface IDialogElement {
    type: string
    label: string
    name: string
    placeholder?: string
    value?: string
    hint?: string
    options?: IDialogOption[]
}

interface IMenuActions {
    id: string
    name: string
    text: string
    type: string
    options: IMenuOptions[]
}
interface IMenuOptions {
    text: string
    value: string
}

export class Formatter extends FormatterSlack {
    private readonly attachments: ISlackAttachment[] = []
    private readonly slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()

    public formatResponseForSlack(data: IHelloWorldResponse): ISlackOriginalMessage {

        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()
        attachment.color = "good"
        attachment.text = "I offer an example project to support developers in building their own Tobi Service. \nPlease follow <https://github.wdf.sap.corp/tobi/tobi-ts-bootstrap | this link.>"
        this.attachments.push(attachment)

        this.slackResponse.text = data.text
        this.slackResponse.attachments = this.attachments

        return this.slackResponse
    }

    public getConfigReminder() {
        console.info("ask for config")
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()
        attachment.title = "Please click this link to enter the configurations of your jenkins."
        attachment.title_link = "https://tobi.mo.sap.corp/config/"
        slackResponse.attachments.push(attachment)

        return slackResponse
    }

    public getMaxSubstring(c1: any, c2: any) {
        let result = ""
        const n = c1.length < c2.length ? c1.length : c2.length
        for (let i = 0; i < n; i ++) {
            if (c1[i] !== c2[i]) { return result }
            result += c1[i]
        }
        return result
    }

    public getMultiJobChoice(serviceId: any, searchJob: any[]) {
        console.info("show all matched jobs")
        const res: any[] = []

        const jobName = searchJob.concat()
        let common = jobName[0]
        for (let j = 1; j < jobName.length; j++)  { common = this.getMaxSubstring(common, jobName[j]) }
        if (common !== "") {
            for (let k = 0; k < jobName.length; k++) { jobName[k] = `...${jobName[k].substring(common.length, jobName[k].length)}` }
        }

        let msg = ""
        if (common !== "") {
            msg = `Prefix \`${common}\` has been matched, please select the rest of the ${searchJob.length} similar jobs:`
        } else {
            msg = `Please select one of the ${searchJob.length} similar jobs:`
        }

        let slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        slackResponse.text = msg
        res.push(slackResponse)

        let actions: ISlackAction[] = []
        for (let i = 0; i <= searchJob.length; i ++) {
            if (i % 5 === 0 || i === searchJob.length) {
                if (i !== 0) {
                    const attachment: ISlackAttachment = {
                        id: 0,
                        text : "",
                        fallback: "failed",
                        callback_id: serviceId,
                        color: "#3AA3E3",
                        attachment_type: "default",
                        actions: actions
                    }
                    // res.push(attachment)
                    slackResponse = FormatterSlack.getinitialMessage()
                    slackResponse.attachments.push(attachment)
                    res.push(slackResponse)
                }
                actions = []
            }
            actions.push({
                id: "0",
                name: searchJob[i],
                text: jobName[i],
                type: "button",
                style: "",
                value: searchJob[i]
            })
        }
        return res
    }

    public getDialogForParaBuild(serviceId: any, jobName: string, paraKey: string[], paraValue: string[]): any {
        const element: IDialogElement[] = [{
            type: "text",
            label: "jobName",
            name: "jobName",
            value: jobName,
            hint: "Please do not change it."
        }]

        for (let i = 0; i < paraKey.length; i ++) {
            element.push({
                type: "text",
                label: paraKey[i],
                name: paraKey[i],
                value: paraValue[i]
            })
        }
        return {
            callback_id: serviceId,
            title: "Enter parameters",
            submit_label: "build",
            elements: element
        }
    }

    public showAllJobsMenu(serviceId: any, jobs: any) {
        const menu_options: IMenuOptions[] = []
        for (const job of jobs) {
            menu_options.push({
                text: job,
                value: job
            })
        }
        const actions: IMenuActions[] = [{
            id: "0",
            name: "job_menu",
            text: "Pick one ...",
            type: "select",
            options: menu_options
        }]

        const attachment = {
            id: 0,
            text: "Please choose one of the jobs",
            fallback: "failed",
            callback_id: serviceId,
            color: "#3AA3E3",
            attachment_type: "default",
            actions: actions
        }

        // slackResponse.attachments.push(attachment)
        const slackResponse = {
            text: "",
            attachments: attachment
        }

        return slackResponse
    }

    public stopJobButton(serviceId: any, button_value: any) {
        console.info("show stop build")
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const actions: ISlackAction[] = [{
            id: "0",
            name: "stop",
            text: "stop",
            type: "button",
            style: "",
            value: button_value
        }]
        const attachment: ISlackAttachment = {
            id: 0,
            text: `Do you want to stop this build: \`${button_value}?\``,
            fallback: "failed",
            callback_id: serviceId,
            color: "#3AA3E3",
            attachment_type: "default",
            actions: actions
        }

        slackResponse.attachments.push(attachment)

        return slackResponse
    }

    public getParaBuild(serviceId: any, jobName: any) {
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const actions: ISlackAction[] = [{
            id: "0",
            name: "paraBuild",
            text: `${jobName} with parameters`,
            type: "button",
            style: "",
            value: jobName
        }]
        const attachment: ISlackAttachment = {
            id: 0,
            text: `${jobName} needs parameters, please click button to continue.`,
            fallback: "failed",
            callback_id: serviceId,
            color: "#3AA3E3",
            attachment_type: "default",
            actions: actions
        }

        slackResponse.attachments.push(attachment)

        return slackResponse
    }

    public showStageInfo(jobName: any, buildNumber: any, stageName: any, stageStatus: any, stageDuration: any) {
        console.info("show stage info")
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()

        attachment.text = `\`${jobName} #${buildNumber}\` finish stage \`${stageName}\` with status ${stageStatus} in ${this.MillisecondToDate(stageDuration)}`
        if (stageStatus !== "SUCCESS") {
            attachment.color = colors.FAILURE
        } else {
            attachment.color = colors.SUCCESS
        }
        slackResponse.attachments.push(attachment)

        return slackResponse

    }

    public showStartInfo(serviceId: string, jobName: any, buildNumber: any, shortDescription: string) {
        console.info("show start info")
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()

        attachment.text = `${jobName} - #${buildNumber} ${shortDescription}`
        attachment.color = colors.START
        const actions: ISlackAction[] = [{
            id: "0",
            name: "stop",
            text: "stop",
            type: "button",
            style: "",
            value: `${jobName} ${buildNumber}`
        }]
        attachment.actions = actions
        attachment.callback_id = serviceId
        slackResponse.attachments.push(attachment)

        return slackResponse

    }

    public showFinishInfo(jobName: string, buildNumber: number, status: string, duration: any, hosturl: any) {
        console.info("show finish info")
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()
        attachment.text = `\`${jobName} #${buildNumber}\` ${status} after ${this.MillisecondToDate(parseInt(duration))}. (<${hosturl}/job/${jobName}/${buildNumber}/console|Open>)`
        if (status !== "SUCCESS") {
            attachment.color = colors.FAILURE
        } else {
            attachment.color = colors.SUCCESS
        }
        slackResponse.attachments.push(attachment)
        return slackResponse
    }

    public showConnectionError() {
        const slackResponse: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()

        attachment.text = "Something went wrong."
        attachment.color = colors.FAILURE
        slackResponse.attachments.push(attachment)

        return slackResponse
    }

    private  MillisecondToDate(msd: number) {
        const time: number = Math.trunc(msd / 1000)
        let timeFormat: any = ""

        if (time > 60 && time < 60 * 60) {
            timeFormat = Math.trunc(time / 60) + " min " + Math.trunc(time % 60) + " sec"
        }
        else if (time >= 60 * 60 && time < 60 * 60 * 24) {
            timeFormat = Math.trunc(time / 3600) + " h " + Math.trunc((time - Math.trunc(time / 3600) * 3600) / 60) + " min " +
                Math.trunc(time - Math.trunc(time / 3600) * 3600 - Math.trunc((time - Math.trunc(time / 3600) * 3600) / 60) * 60 ) + " sec"
        }
        else if (time < 60 && time > 0) {
            timeFormat = time + " sec"
        }
        else {
            timeFormat = "less than 1s"
        }
        return timeFormat
    }

 }

const colors = {
    FAILURE: "#cb2431",
    SUCCESS: "#28a745",
    START: "#3aa7e3"
}
