'use client';

import { apiFetch } from '@/lib/api';

export type Role = 'ADMIN' | 'DEPARTMENT_MANAGER' | 'INSTRUCTOR' | 'INVIGILATOR' | 'STUDENT';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  departmentId?: string | null;
  mustChangePassword?: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Sistem Yöneticisi',
  DEPARTMENT_MANAGER: 'Bölüm Koordinatörü',
  INSTRUCTOR: 'Ders Sorumlusu',
  INVIGILATOR: 'Gözetmen',
  STUDENT: 'Öğrenci',
};

export function getStoredUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('examus_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: CurrentUser) {
  window.localStorage.setItem('examus_user', JSON.stringify(user));
  window.dispatchEvent(new Event('examus_user_changed'));
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('examus_token');
  window.localStorage.removeItem('examus_user');
  window.dispatchEvent(new Event('examus_user_changed'));
}

export function canAccessPath(user: CurrentUser | null, pathname: string) {
  if (pathname === '/login') return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  if (pathname === '/') return true;
  if (pathname.startsWith('/kullanicilar')) return false;
  if (pathname.startsWith('/bolumler')) return false;
  if (pathname.startsWith('/veri-yukleme')) return user.role === 'DEPARTMENT_MANAGER';
  if (pathname.startsWith('/planlama')) return ['DEPARTMENT_MANAGER'].includes(user.role);
  if (pathname.startsWith('/raporlar')) return ['DEPARTMENT_MANAGER'].includes(user.role);
  if (pathname.startsWith('/ogrenciler')) return ['DEPARTMENT_MANAGER', 'INSTRUCTOR', 'STUDENT'].includes(user.role);
  if (pathname.startsWith('/dersler') || pathname.startsWith('/sinavlar')) return ['DEPARTMENT_MANAGER', 'INSTRUCTOR', 'STUDENT'].includes(user.role);
  if (pathname.startsWith('/gozetmenler/yeni')) return user.role === 'DEPARTMENT_MANAGER';
  if (/^\/gozetmenler\/[^/]+/.test(pathname)) return ['DEPARTMENT_MANAGER', 'INVIGILATOR'].includes(user.role);
  if (pathname.startsWith('/gozetmenler')) return ['DEPARTMENT_MANAGER', 'INVIGILATOR'].includes(user.role);
  if (pathname.startsWith('/derslikler/yeni')) return false;
  if (pathname.startsWith('/derslikler') || pathname.startsWith('/donemler')) return ['DEPARTMENT_MANAGER', 'INSTRUCTOR'].includes(user.role);

  return false;
}

export function canManageResource(user: CurrentUser | null, resource: 'students' | 'courses' | 'exams' | 'invigilators' | 'periods' | 'classrooms') {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (['students', 'courses', 'exams', 'invigilators'].includes(resource)) return user.role === 'DEPARTMENT_MANAGER';
  return false;
}

export async function refreshCurrentUser() {
  const response = await apiFetch<CurrentUser>('/auth/me');
  setStoredUser(response.data);
  return response.data;
}
