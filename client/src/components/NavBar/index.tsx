import { NavLink } from 'react-router';
import { HomeIcon, UserIcon, Mail } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import type { UserRole } from '../../types/user';
import s from './NavBar.module.scss';

const navByRole: Record<UserRole, { id: number; path: string; name: string; icon: typeof HomeIcon }[]> = {
  RESIDENT: [
    { id: 1, path: '/', name: 'Дом', icon: HomeIcon },
    { id: 2, path: '/requests', name: 'Заявки', icon: Mail },
    { id: 3, path: '/profile', name: 'Профиль', icon: UserIcon },
  ],
  UK_EMPLOYEE: [
    { id: 1, path: '/', name: 'Дом', icon: HomeIcon },
    { id: 2, path: '/requests', name: 'Очередь', icon: Mail },
    { id: 3, path: '/profile', name: 'Профиль', icon: UserIcon },
  ],
};

export default function NavBar() {
  const { user } = useAuth();
  const items = navByRole[user.role];

  return (
    <nav className={s.nav} aria-label="Основная навигация">
      <ul className={s.list}>
        {items.map(({ id, path, name, icon: Icon }) => (
          <li className={s.item} key={id}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) => (isActive ? `${s.link} ${s.active}` : s.link)}
            >
              <Icon aria-hidden />
              <span>{name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
