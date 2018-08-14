import { ISapUser, TobiClientConnector } from "@tobi/connector"

export class User implements ISapUser {

    public static instance: User

    public static async getInstanceBySlackUserID(tobiClientConnector: TobiClientConnector, slackTeamID: string, slackUserID: string): Promise<User> {
        User.instance = new User(await tobiClientConnector.slack.getUserInfoBySlackUserId(slackTeamID, slackUserID))

        return User.instance
    }

    public readonly admin?: boolean
    public readonly building: string
    public readonly costcenter: string
    public readonly email: string
    public readonly firstname: string
    public readonly lastname: string
    public readonly managerId: string
    public readonly room: string
    public readonly text: string
    public readonly userid: string
    public readonly username: string

    private constructor(userData: ISapUser) {
        this.userid = userData.userid
        this.username = userData.username
        this.firstname = userData.firstname
        this.lastname = userData.lastname
        this.costcenter = userData.costcenter
        this.building = userData.building
        this.room = userData.room
        this.text = userData.text
        this.email = userData.email
        this.admin = userData.admin
        this.managerId = userData.managerId
    }

}
