import { NavLink } from 'react-router';
import {
  HomeIcon,
  UserIcon,
  Mail,
  Newspaper,
  Megaphone,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import type { UserRole } from '../../types/user';
import s from './NavBar.module.scss';

type NavItem = {
  id: number;
  path: string;
  name: string;
  icon: typeof HomeIcon;
};

const residentNav: NavItem[] = [
  { id: 1, path: '/', name: 'Дом', icon: HomeIcon },
  { id: 2, path: '/requests', name: 'Заявки', icon: Mail },
  { id: 3, path: '/news', name: 'Лента', icon: Newspaper },
  { id: 4, path: '/profile', name: 'Профиль', icon: UserIcon },
];

const chairmanNav: NavItem[] = [
  { id: 1, path: '/', name: 'Дом', icon: HomeIcon },
  { id: 2, path: '/requests', name: 'Заявки', icon: Mail },
  { id: 3, path: '/announcements', name: 'Объявл.', icon: Megaphone },
  { id: 4, path: '/membership', name: 'Жители', icon: UserPlus },
  { id: 5, path: '/profile', name: 'Профиль', icon: UserIcon },
];

const ukNav: NavItem[] = [
  { id: 1, path: '/', name: 'Дом', icon: HomeIcon },
  { id: 2, path: '/requests', name: 'Заявки', icon: Mail },
  { id: 3, path: '/announcements', name: 'Объявл.', icon: Megaphone },
  { id: 4, path: '/membership', name: 'Жители', icon: UserPlus },
  { id: 5, path: '/profile', name: 'Профиль', icon: UserIcon },
];

const navByRole: Record<UserRole, NavItem[]> = {
  RESIDENT: residentNav,
  CHAIRMAN: chairmanNav,
  UK_EMPLOYEE: ukNav,
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
