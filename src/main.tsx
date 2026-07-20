import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './content/runtime-content-validation'
import './index.css'
import './t031.css'
import './t033.css'
import './t037.css'
import './t037-entry.css'
import './t039.css'
import './t040.css'
import './t051.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
