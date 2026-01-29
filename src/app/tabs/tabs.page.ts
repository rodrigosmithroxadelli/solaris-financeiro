import { Component, EnvironmentInjector, inject, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet, IonFab, IonFabButton } from '@ionic/angular/standalone';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { addIcons } from 'ionicons';
import { statsChartOutline, wallet, cubeOutline, documentTextOutline, peopleOutline, barChart, settings, add } from 'ionicons/icons';
import { filter } from 'rxjs';
import { CaixaPage } from '../Caixa/caixa.page';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [IonFabButton, IonFab, 
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    RouterModule
  ],
})
export class TabsPage implements OnInit {
  @ViewChild(IonRouterOutlet) routerOutlet!: IonRouterOutlet;
  public environmentInjector = inject(EnvironmentInjector);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public activeTab = 'inicio';

  constructor() {
    addIcons({ statsChartOutline, wallet, cubeOutline, documentTextOutline, peopleOutline, barChart, settings, add });
  }

  onFabClick() {
    // A more robust way: get the component instance from the outlet
    if (this.routerOutlet && this.routerOutlet.component) {
      // Check if the active component is CaixaPage
      const component = this.routerOutlet.component;
      if (component instanceof CaixaPage) {
        component.openAddTransactionModal();
      } else if (typeof (component as any).openAddTransactionModal === 'function') {
        // Fallback for other potential pages or if instanceof fails with proxies
        (component as any).openAddTransactionModal();
      }
    }
  }

  ngOnInit() {
    // Monitor route changes to manage page visibility
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const urlSegments = event.urlAfterRedirects.split('/');
        const newTab = urlSegments[urlSegments.length - 1];
        
        if (newTab && newTab !== this.activeTab) {
          this.activeTab = newTab;
          this.cdr.detectChanges(); // Force change detection
          this.updatePageVisibility();
        }
      });
  }

  selectTab(tabName: string) {
    this.activeTab = tabName;
    this.cdr.detectChanges(); // Force change detection
    this.updatePageVisibility();
    this.router.navigate(['/tabs', tabName]);
  }

  onTabChange(event: any) {
    const tabName = event.tab;
    this.activeTab = tabName;
    this.cdr.detectChanges(); // Force change detection
    this.updatePageVisibility();
  }

  private updatePageVisibility() {
    // Force update of visible elements
    setTimeout(() => {
      // Get the current active tab from the URL
      const urlSegments = this.router.url.split('/');
      const activeTabName = urlSegments[urlSegments.length - 1];
      
      const pages = document.querySelectorAll('[class*="ion-page"]:not(ion-tab-bar)');
      
      pages.forEach((page: any) => {
        const tagName = page.tagName.toLowerCase();
        
        // Check if this page matches the active tab
        const isMatch = 
          (activeTabName === 'inicio' && tagName === 'app-home') ||
          (activeTabName === 'caixa' && tagName === 'app-caixa') ||
          (activeTabName === 'catalogo' && tagName === 'app-service-catalog') ||
          (activeTabName === 'os' && tagName === 'app-service-order') ||
          (activeTabName === 'clients' && tagName === 'app-clients') ||
          (activeTabName === 'relatorios' && tagName === 'app-relatorios') ||
          (activeTabName === 'admin' && tagName === 'app-admin');
        
        if (isMatch) {
          page.classList.remove('ion-page-hidden');
          page.style.display = 'block !important';
          page.style.visibility = 'visible !important';
          page.style.opacity = '1 !important';
          page.style.position = 'relative !important';
          page.style.zIndex = '101 !important';
          page.setAttribute('aria-hidden', 'false');
        } else {
          page.classList.add('ion-page-hidden');
          page.style.display = 'none !important';
          page.style.visibility = 'hidden !important';
          page.style.opacity = '0 !important';
          page.style.position = 'absolute !important';
          page.style.zIndex = '-9999 !important';
          page.setAttribute('aria-hidden', 'true');
        }
      });
      this.cdr.markForCheck();
    }, 100);
  }
}

