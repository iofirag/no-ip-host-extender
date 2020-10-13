export enum ResponseStatus {
    BadRequest = 400,
    Ok = 200,
}

export const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
export const GMAIL_CREDENTIALS_PATH = 'assets/credentials.json';
export const GMAIL_TOKEN_PATH = 'assets/token.json';