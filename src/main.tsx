import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/styles/app.css'

const root = document.getElementById('root')
if (!root) throw new Error('Не знайдено #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
