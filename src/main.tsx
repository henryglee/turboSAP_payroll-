import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/payment-method.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
