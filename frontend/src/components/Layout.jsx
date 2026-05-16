import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => (
  <div className="app-layout">
    <Sidebar />
    <main className="main-content p-6 sm:p-8">
      <Outlet />
    </main>
  </div>
);

export default Layout;
