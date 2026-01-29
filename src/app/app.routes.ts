import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';
import { TabsPage } from './tabs/tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/inicio',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    component: TabsPage,
    canActivate: [authGuard],
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'caixa',
        loadComponent: () => import('./Caixa/caixa.page').then((m) => m.CaixaPage),
      },
      {
        path: 'relatorios',
        loadComponent: () => import('./Relatórios/relatorios.page').then((m) => m.RelatoriosPage),
      },
      {
        path: 'admin',
        loadComponent: () => import('./Admin/admin.page').then((m) => m.AdminPage),
        canActivate: [adminGuard],
      },
      {
        path: 'clients',
        loadComponent: () => import('./clients/clients/clients.page').then((m) => m.ClientsPage),
      },
      {
        path: 'client-detail/:id',
        loadComponent: () => import('./clients/client-detail/client-detail.page').then((m) => m.ClientDetailPage),
      },
      {
        path: 'catalogo',
        loadComponent: () => import('./Catalog/service-catalog/service-catalog.component').then((m) => m.ServiceCatalogComponent),
      },
      {
        path: 'os',
        loadComponent: () => import('./ServiceOrder/service-order/service-order.component').then((m) => m.ServiceOrderComponent),
      },
      {
        path: '',
        redirectTo: 'inicio',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/tabs/inicio',
    pathMatch: 'full',
  },
  {
    path: 'catalog-management',
    loadComponent: () => import('./src/app/Catalog/catalog-management/catalog-management.page').then( m => m.CatalogManagementPage)
  },
];