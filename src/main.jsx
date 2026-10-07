import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { CustomerAuthProvider } from './context/CustomerAuthContext.jsx';
import { CatalogProvider } from './context/CatalogContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <CatalogProvider>
          <ThemeProvider>
            <CartProvider>
              <AdminAuthProvider>
                <CustomerAuthProvider>
                  <App />
                </CustomerAuthProvider>
              </AdminAuthProvider>
            </CartProvider>
          </ThemeProvider>
        </CatalogProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
