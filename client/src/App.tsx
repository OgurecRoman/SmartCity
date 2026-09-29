import { useState } from 'react';
import { Routes, Route, Outlet } from 'react-router';
import Home from './pages/Home';
import Profile from './pages/Profile';
import News from './pages/News';
import Announcements from './pages/Announcements';
import Requests from './pages/Requests';
import RequestCreate from './pages/RequestCreate';
import Membership from './pages/Membership';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import NavBar from './components/NavBar';
import HouseJoinFlow from './components/HouseJoinFlow';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast/ToastProvider';
import { PORTAL_ROOT_ID } from './lib/portalRoot';
import s from './App.module.scss';
import EditCompany from './components/EditCompany';

function AppLayout({ onAddHouse }: { onAddHouse: () => void }) {
  return (
    <>
      <Header onAddHouse={onAddHouse} />
      <main className={s.main}>
        <Outlet />
      </main>
      <NavBar />
    </>
  );
}

function AppShell() {
  const { user } = useAuth();
  const [addingHouse, setAddingHouse] = useState(false);
  const isUk = user.role === 'UK_EMPLOYEE';

  if (addingHouse) {
    return (
      <HouseJoinFlow
        mode={isUk ? 'uk-add' : 'join'}
        defaultFullName={user.verifiedFullName ?? user.name}
        eyebrow={isUk ? 'Дома УК' : 'Ещё дом'}
        title="Выберите дом"
        onCancel={() => setAddingHouse(false)}
        onSuccess={() => setAddingHouse(false)}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout onAddHouse={() => setAddingHouse(true)} />}>
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="company/edit" element={<EditCompany />} />
        <Route path="news" element={<News />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/new" element={<RequestCreate />} />
        <Route path="membership" element={<Membership />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <div className={s.app}>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
      <div id={PORTAL_ROOT_ID} />
    </div>
  );
}
