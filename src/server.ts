
import { IConfig, TobiClientConnector, URLDataLoader } from "@tobi/connector"
import * as crypto from "crypto"
import * as express from "express"
import { BAD_REQUEST, NOT_FOUND, OK } from "http-status-codes"
import * as request from "request"
import * as r from "request-promise-native"
import * as winston from "winston"
import { IHelloWorldResponse } from "./formatter.spec"

export interface IOptions {
    headers: { secret: string },
    method: string,
    url: string
}

export class DataServer {

    public static async loadData(tbd: string): Promise<IHelloWorldResponse> {
        const result: IHelloWorldResponse = { text: "" }
        result.text = await r.get("https://hello-world-tools.cfapps.sap.hana.ondemand.com/")

        return result
    }

    public app: express.Application
    private readonly config: IConfig
    private readonly logger: winston.LoggerInstance

    public constructor(logger: winston.LoggerInstance, config: IConfig,
        urlDataLoader: URLDataLoader, tobiConnector?: TobiClientConnector) {
        this.app = express()
        this.logger = logger
        this.config = config

        this.app.get("/api/tbd/:tbd", async (req: express.Request, res: express.Response) => {
            this.logger.info("api request received.")
            try {
                const data: IHelloWorldResponse = await DataServer.loadData(req.params.tbd)
                res.status(OK)
                    .send(data)
            } catch (error) {
                const infoMessage: string = `No  data found for ${req.params.tbd}`
                res.status(NOT_FOUND)
                    .send(infoMessage)

            }
        })

        this.app.get("/api/availibility", (req: express.Request, res: express.Response) => {

            const returning: { value: string } = {
                value: this.config.service_id,
            }

            res.status(OK)
                .send(returning)
        })

        this.app.get("/*", (req: express.Request, res: express.Response) => {
            this.increaseStats(req, "general")
            this.logger.info("api request without regular parameterization received.")
            res.status(BAD_REQUEST)
                .send("The parameterization of this service should be like: <br><ul><li>/api/tbd/tbd</li></ul>")
        })
    }

    public start(): void {
        const port: string = process.env.PORT || "4010"
        this.app.listen(port)
        this.logger.info(`app is listening on port ${port}`)
    }

    private increaseStats(req: express.Request, statsKey: string): void {

        if (req.get("usage") !== "monitoring") {
            const options: IOptions = {
                headers: {
                    secret: crypto.createHash("sha256")
                        .update(this.config.service_secret, "utf8")
                        .digest("hex")
                        .toString(),
                },
                method: "GET",
                url: `https://tobi.mo.sap.corp/monitoring/stats/increase/${this.config.service_id}/${statsKey}`,
            }

            request(options, (err: Error, result: request.RequestResponse, body: {}) => {
                if (err) {
                    this.logger.error(JSON.stringify(err))
                } else {
                    this.logger.info(`INCREASE STATS:  ${JSON.stringify(body)}`)
                }
            })
        }
    }
}
