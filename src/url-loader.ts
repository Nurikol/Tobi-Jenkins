/* tslint:disable */
export class URLLoader {

    public url: any

    constructor() {
        this.url = require("url")
    }

    public loadDataViaURL(listOfUrls) {
        const result = {}
        let maxStatus = 0
        const location = {}
        return new Promise((resolve, reject) => {
            if (!listOfUrls) {
                return reject(new Error("No url provided").stack)
            }

            for (let i = 0; i < listOfUrls.length; i++) {
                result[listOfUrls[i].id] = ""
                location[listOfUrls[i].id] = ""
            }
            Promise.all(listOfUrls.map((dataUrl) => this._loadUrl(dataUrl)))
                .then((loadResult: any) => {
                    for (let i = 0; i < loadResult.length; i++) {
                        result[listOfUrls[i].id] = loadResult[i].data
                        maxStatus = Math.max(maxStatus, loadResult[i].dataload.statusCode)
                        location[listOfUrls[i].id] = loadResult[i].dataload.location
                    }
                    resolve({
                        maxStatus,
                        result,
                        location
                    })
                }, (error) => reject(error))
        })
    }

    public _loadUrl(dataUrl: any) {
        const startTime = new Date().getTime()
        const options = this._createRequestOptions(dataUrl)
        return this._executeRequest(dataUrl, options, startTime)
    }

    public _createRequestOptions(dataUrl: any) {
        const requestOptions: any = {
            headers: {},
            timeout: 2000,
        }

        if (dataUrl.payload) {
            requestOptions.method = "POST"
            requestOptions.headers = dataUrl.headers ? Object.assign(dataUrl.headers, requestOptions.headers) : requestOptions.headers
        } else {
            requestOptions.method = "GET"
            requestOptions.headers = dataUrl.headers ? Object.assign(dataUrl.headers, requestOptions.headers) : requestOptions.headers
        }

        const urlp = this.url.parse(dataUrl.url)

        requestOptions.protocol = urlp.protocol
        requestOptions.hostname = urlp.hostname
        requestOptions.port = urlp.port
        requestOptions.path = urlp.path
        if (dataUrl.user && dataUrl.pass) {
            requestOptions.auth = `${dataUrl.user}:${dataUrl.pass}`
        }
        if (dataUrl.token) {
            requestOptions.headers.Authorization = `token ${dataUrl.token}`
        }
        if (dataUrl.proxy) {
            const HttpProxyAgent = urlp.protocol === "https:" ? require("https-proxy-agent") : require("http-proxy-agent")
            requestOptions.agent = new HttpProxyAgent(dataUrl.proxy)
            requestOptions.secureEndpoint = urlp.protocol === "https:"
        }
        if(dataUrl.csrf && dataUrl.crumbRequestField) {
            requestOptions.headers[dataUrl.crumbRequestField] = dataUrl.csrf
        }
        return requestOptions
    }

    public _executeRequest(dataUrl, options, startTime) {
        return new Promise((resolve, reject) => {
            const http = options.protocol === "https:" ? require("https") : require("http")
            const req = http.request(options, (res) => {
                let data = ""
                res.setEncoding("utf8")
                res.on("data", (chunk) => data += chunk)
                res.on("end", () => {
                    const endTime = new Date().getTime()
                    // add runtime information to dataLoads
                    dataUrl.startTime = startTime
                    dataUrl.endTime = endTime
                    dataUrl.loadTime = endTime - startTime
                    dataUrl.statusCode = res.statusCode
                    dataUrl.location = res.headers.location

                    if (res.statusCode >= 500) {
                        resolve({
                            data,
                            dataload: dataUrl,
                        })
                    } else {
                        if ((typeof data) === "object") {
                            resolve({
                                data,
                                dataload: dataUrl,
                            })
                        } else {
                            try {
                                resolve({
                                    data: JSON.parse(data),
                                    dataload: dataUrl,
                                })
                            } catch (e) {
                                resolve({
                                    data,
                                    dataload: dataUrl,
                                })
                            }
                        }
                    }

                })

            })
            req.on("error", (err) => {
                reject(err)
            })

            if (dataUrl.payload) {
                const body = JSON.stringify(dataUrl.payload)
                req.write(body)
            }

            req.end()
        })
    }

}
