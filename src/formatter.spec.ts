
import { FormatterSlack, ISlackAttachment, ISlackOriginalMessage } from "@tobi/connector"
import * as assert from "assert"
import { suite, test } from "mocha-typescript"
import { Formatter } from "./formatter"

// The following link supports to develop such things in a test first style:
// Https://api.slack.com/docs/messages/builder

@suite class FormatterTests {

    private static getExpectedValueForSlack(): { attachments: {}; text: string } {
        const message: ISlackOriginalMessage = FormatterSlack.getinitialMessage()
        const attachment: ISlackAttachment = FormatterSlack.getInitialAttachment()
        message.text = "Hello World"
        attachment.color = "good"
        attachment.text = "I offer an example project to support developers in building their own Tobi Service. \nPlease follow <https://github.wdf.sap.corp/tobi/tobi-ts-bootstrap | this link.>"
        message.attachments.push(attachment)

        return message
    }

    private static getInputForMethodUnderTest(): IHelloWorldResponse {
        const data: IHelloWorldResponse = { text: "Hello World" }

        return data
    }

    private classUnderTest: Formatter

    private inputForMethodUnderTest: IHelloWorldResponse

    private before(): void {
        this.classUnderTest = new Formatter()
        this.inputForMethodUnderTest = FormatterTests.getInputForMethodUnderTest()
    }

    @test private testFormatSlackResponse(): void {
        let actualValue: {}
        let expectedValue: {}

        expectedValue = FormatterTests.getExpectedValueForSlack()
        actualValue = this.classUnderTest.formatResponseForSlack(this.inputForMethodUnderTest)
        assert.equal(JSON.stringify(expectedValue), JSON.stringify(actualValue), "error in testFormatSlackResponse")
    }

}

export interface IHelloWorldResponse {
    text: string
}
