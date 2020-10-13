import { Request, Response } from "express";
import { GMAIL_CREDENTIALS_PATH, GMAIL_TOKEN_PATH, ResponseStatus, SCOPES } from "../../utils/consts";
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
import fetch from 'node-fetch';
const htmlparser2 = require("htmlparser2");
import cheerio from 'cheerio';
// import { fetchData } from "../../utils/functions";
const path = require("path");
const gmail = require("gmail-tester");


export class ManagerController {
  
  public static userCookies;
  public static headers = {};

  public static oauthCallback = async (req: Request, res: Response) => {
    return res.status(ResponseStatus.Ok).json(req.query)
  }

  private static fetchData = async (url, op?) => {
    if (ManagerController.userCookies) {
      if (!op.headers) {
        op.headers = {}
      }
      // op.headers = ManagerController.headers
      op.headers['Cookie'] = ManagerController.userCookies
    }
    return await fetch(url, op)
  }

  public static getEmails = async (req: Request, res: Response) => {
    try {

      const emailList = await gmail.check_inbox(
        path.resolve(__dirname, '../../', GMAIL_CREDENTIALS_PATH),  // __dirname + '/../../' + GMAIL_CREDENTIALS_PATH,  // Assuming credentials.json is in the current directory.
        path.resolve(__dirname, '../../', GMAIL_TOKEN_PATH),        // __dirname + '/../../' + GMAIL_TOKEN_PATH,        // Look for gmail_token.json in the current directory (if it doesn't exists, it will be created by the script).
        {
          subject: "ACTION REQUIRED", // We are looking for 'Activate Your Account' in the subject of the message.
          from: "@noip.com", // We are looking for a sender header which is 'no-reply@domain.com'.
          to: "iofirag@gmail.com", // Which inbox to poll. credentials.json should contain the credentials to it.
          wait_time_sec: 10, // Poll interval (in seconds).
          max_wait_time_sec: 30, // Maximum poll time (in seconds), after which we'll giveup.
          include_body: true
        }
      );
      let email
      let found = false;
      if (Array.isArray(emailList)) {
        email = emailList[0]
        found = true
      } else if (email) {
        email = emailList
        found = true
      } else {
        found = false
      }
  
      if (!found) {
        throw 'Email was not found!'
      }
  
      console.log(`(${emailList.length}) email was found!`);
      // way A
      const emailTextClean = email.body.text.replace(/\r\n/g, ' ')
      const confirmHosstLinkIndex = emailTextClean.indexOf('https://www.noip.com/confirm-host?')
      if (confirmHosstLinkIndex > -1) {
        const croppedText = emailTextClean.slice(confirmHosstLinkIndex)
        const confirmHostLink = croppedText.split(' ')[0]
        
        const noipRes = await ManagerController.fetchData('http://www.noip.com')
        // console.log(noipRes.headers['set-cookie'])
        
        noipRes.headers.forEach((v,k) => {
          if (k === 'set-cookie') {
            ManagerController.userCookies = v
            ManagerController.headers['Cookie'] = v
          } else {
            ManagerController.headers[k] = v
          }
        });
  
        const op = {
          method: 'GET',
          // headers: ManagerController.headers
        }
        const noipConfirmHostnameRes = await ManagerController.fetchData(confirmHostLink, op)
        const noipConfirmHostnameTemplate = noipConfirmHostnameRes.body // (html content)
        const dom = htmlparser2.parseDOM(noipConfirmHostnameTemplate);
        const $ = cheerio.load(dom)
  
        const buttonsList = $(`.container .row p a.grey`)
        if (!buttonsList.length) throw 'Didnt found renew button on no-ip page'

        const buttonClickOp = {
          method: 'GET',
          headers: noipRes.headers
        }
        const noipConfirmHostnameButtonRes = await ManagerController.fetchData(buttonsList[0].href, buttonClickOp)
        return res.send(noipConfirmHostnameButtonRes.body)
      } else {
        throw 'Confirmation link did not found!'
      }
    } catch(error) {
      return res.status(ResponseStatus.BadRequest).json({error})
    }
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  static authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(GMAIL_TOKEN_PATH, (err, token) => {
      if (err) return ManagerController.getNewToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  static getNewToken(oAuth2Client, callback) {

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(GMAIL_TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', GMAIL_TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  }

  /**
   * Lists the labels in the user's account.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  static listLabels(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.labels.list({
      userId: 'me',
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const labels = res.data.labels;
      if (labels.length) {
        console.log('Labels:');
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log('No labels found.');
      }
    });
  }
  static listMessages(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.messages.list({
      userId: 'me',
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const labels = res.data.labels;
      if (labels.length) {
        console.log('Labels:');
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log('No labels found.');
      }
    });
  }
  static findMessages(auth) {
    var gmail = google.gmail('v1');
    gmail.users.messages.list({
    auth: auth,
    userId: 'me',
    maxResults: 10,
    q:""
  }, function(err, response) {
      console.log(response);
      console.log("++++++++++++++++++++++++++");
      console.log(response.data.messages,auth); //snippet not available
    });
  }
  
  // static printMessage(messageID,auth) {
  //   var gmail = google.gmail('v1');
  //   gmail.users.messages.get({
  //   auth: auth,
  //   userId: 'me',
  //   id:messageID[0].id
  // }, function(err, response) {
  //     console.log(response);
  //     messageID.splice(0,1);
  //     if(messageID.length>0)
  //      printMessage(messageID,auth);
  //    else {
  //      console.log("All Done");
  //    }
  // });
  // }
  // public static createRole = async (req: Request, res: Response) => {
  //   const newRole = req.body
  //   try {
  //     const doc = await GenericCRUDFunctions.create(RoleModel, newRole);
  //     return res.status(200).json(doc)
  //   } catch (err) {
  //     return Utils.handleError(err, res);
  //   }
  // }

  
  // public static updateRole = async (req: Request, res: Response) => {
  //   const { _id } = req.query;
  //   try {
  //     const doc: Document = await GenericCRUDFunctions.updateListFieldBySubDocId(RoleModel, 'roleList', <string>_id, req.body)
  //     return res.status(200).json(doc)
  //   } catch (err) {
  //     return Utils.handleError(err, res);
  //   }
  // }

  // public static deleteRole = async (req: Request, res: Response) => {
  //   const { _id } = req.query;
  //   try {
  //     const doc: Document = await GenericCRUDFunctions.deleteSubDocById(RoleModel, 'roleList', <string>_id)
  //     return res.status(200).json(doc)
  //   } catch (err) {
  //     return Utils.handleError(err, res);
  //   }
  // }
  // public static defaultGet = async (req: Request, res: Response) => {
  //   return res.status(200).json({'test': 99})
  // }
}
