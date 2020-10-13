import { Application, Request, Response } from "express";
import bodyParser from "body-parser";


export class Middlewares {
  
  constructor(app: Application) {
    app.use( bodyParser.json() );
    app.use( bodyParser.urlencoded({ extended: true }) );
    app.use( Middlewares.printRequest );
  }

  static printRequest = async (req: Request, res: Response, next) => {
    console.log('url=', req.path)
    console.log('headers=', req.headers)
    console.log('params=', req.query)
    console.log('query=', req.query)
    console.log('body=', req.body, '\n')
    next()
  }
}