import serverless from 'serverless-http'
import '../server/env.mjs'
import { app } from '../server/app.mjs'

export const handler = serverless(app)
