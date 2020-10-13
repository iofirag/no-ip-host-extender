import { Application, Request, Response } from "express";
import { ManagerController } from "../entities/email/email.controller";
import { ResponseStatus } from "../utils/consts";


// 

export const RoutesConfig = (app: Application) => {
    app
    .get('/get-mails', ManagerController.getEmails)
    .get('/', ManagerController.oauthCallback)
}