
import express, { Application } from "express";
import { RoutesConfig } from "./config/routes.config";
import http, { Server } from "http";
import { Middlewares } from "./middlewares";
require('dotenv').config()

export class ServerBoot {
  private readonly port: number = +process.env.PORT;
  private app: Application;
  public server: Server;

  constructor() {
    this.app = express();
    this.server = this.createServer();
    this.listen();
  }

  private createServer(): Server {
    return http.createServer(this.app);
  }

  private listen(): void {
    this.loadMiddlewares();
    this.configModules();
    
    this.server.listen(this.port, () => {
      console.log(`Our app server is running on http://localhost:${this.port}`);
    });
  }

  private configModules(): void {
    RoutesConfig(this.app);
  }

  private loadMiddlewares(): void {
    new Middlewares(this.app)
  }
} 


// Running the server
const serverInstance: ServerBoot = new ServerBoot();
