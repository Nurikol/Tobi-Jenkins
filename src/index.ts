import { IConfig, createLogger, ConfigLoader } from "@tobi/connector"
import * as path from "path"
import * as winston from "winston"
import { Formatter } from "./formatter"
import { Service } from "./service"

const config = ConfigLoader.loadFromPath<IConfig>(path.join(__dirname, "../.env.json"))

const logger: winston.LoggerInstance = createLogger()
const formatter: Formatter = new Formatter()

const service: Service = new Service(logger, config, formatter)
service.start()
logger.info("Tobi ChatBot Service started")
