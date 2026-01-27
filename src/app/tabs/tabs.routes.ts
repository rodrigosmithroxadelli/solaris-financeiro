import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { adminGuard } from '../guards/auth.guard';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'caixa',
        loadComponent: () =>
          import('../Caixa/caixa.page').then((m) => m.CaixaPage),
      },
      {
        path: 'relatorios',
        loadComponent: () =>
          import('../Relatórios/relatorios.page').then((m) => m.RelatoriosPage),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('../Admin/admin.page').then((m) => m.AdminPage),
        canActivate: [adminGuard],
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full',
  },
];
