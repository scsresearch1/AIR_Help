import './env.mjs'
import { app } from './app.mjs'
import { isKaggleConfigured } from './kaggle.mjs'

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`Citation API on http://localhost:${PORT}`)
  console.log(
    `  TLS: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? 'relaxed' : 'strict'} | Unpaywall: ${process.env.UNPAYWALL_EMAIL ?? 'none'} | Kaggle: ${isKaggleConfigured() ? 'configured' : 'not configured'}`,
  )
})
