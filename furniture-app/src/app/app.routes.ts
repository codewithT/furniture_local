import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboards/dashboard/dashboard.component';
import { ProductsComponent } from './components/products/products.component';
import { UserLoginComponent } from './components/user-login/user-login.component';
import { AddOrderComponent } from './components/add-order/add-order.component';
import { ManageOrderComponent } from './components/manage-order/manage-order.component';
import { PurchaseComponent } from './components/purchase/purchase.component';
import { SupplierComponent } from './components/supplier/supplier.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { AuthLayoutComponent } from './layouts/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout.component';
import { SupplierLayoutComponent } from './layouts/supplier-layout.component';
import { ShowToSupplierComponent } from './components/show-to-supplier/show-to-supplier.component';
import { InvoiceComponent } from './components/invoice/invoice.component';
import { OrderDetailsComponent } from './components/order-details/order-details.component';
import { AuthGuard } from './auth.guard';  // Import the AuthGuard
 
import { environment } from '../environments/environment';
import { ReceiveProductsComponent } from './components/receive-products/receive-products.component';
import { ScheduleDeliveryComponent } from './components/schedule-delivery/schedule-delivery.component';
import { Sidebar } from 'lucide';
import { SidebarComponent } from './dashboards/sidebar/sidebar.component';
import { ViewPurchasesComponent } from './dashboards/view-purchases/view-purchases.component';
import { ViewProductsReportsComponent } from './dashboards/view-products-reports/view-products-reports.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { AdminPanelLayoutComponent } from './layouts/admin-panel-layout.component';
import { RoleGuard } from './role.guard';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  
  {
    path:'auth',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: UserLoginComponent },
      { path: 'signup', component: SignUpComponent },
       { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },
 

    ],
  },

  
  {
    path: 'u',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],   
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',
         component: DashboardComponent,
        canActivate: [RoleGuard],
       data: { roles: ['admin'] }},
      { path: 'supplier', component: SupplierComponent
        , canActivate: [RoleGuard],
        data: { roles: ['purchase', 'admin'] }
       },
      { path: 'purchase', component: PurchaseComponent,
        canActivate: [RoleGuard],
        data: { roles: ['purchase', 'admin'] }
       },
      { path: 'products', component: ProductsComponent
        , canActivate: [RoleGuard],
        data: { roles: [ 'admin','sales', 'warehouse','purchase'] }
       },
      { path: 'addOrders', component: AddOrderComponent
        , canActivate: [RoleGuard],
        data: { roles: ['sales', 'admin'] }
       },
      { path: 'manageOrders', component: ManageOrderComponent
        , canActivate: [RoleGuard],
        data: { roles: ['sales', 'admin'] }
       },
      { path: 'order-details/:soNumber', component: OrderDetailsComponent
        , canActivate: [RoleGuard],
        data: { roles: ['sales', 'admin'] }
       },
     {path : 'receive', component: ReceiveProductsComponent
      , canActivate: [RoleGuard],
        data: { roles: ['warehouse', 'admin'] }
     },
     {path: 'delivery', component: ScheduleDeliveryComponent,
      canActivate: [RoleGuard],
      data: { roles: ['warehouse', 'admin'] }
     },
     {path: 'dashboard/view-purchases', component: ViewPurchasesComponent,
      canActivate: [RoleGuard],
      data: { roles: ['purchase', 'admin'] }
     },
     {path: 'dashboard/view-products-reports', component: ViewProductsReportsComponent,
      canActivate: [RoleGuard],
      data: { roles: ['admin'] }
     },
     {path: 'dashboard/view-sales-reports', loadComponent: () => import('./dashboards/view-sales-reports/view-sales-reports.component').then(m => m.ViewSalesReportsComponent)
      , canActivate: [RoleGuard],
      data: { roles: ['sales', 'admin'] }
      },
     {path: 'dashboard/view-sales-products-reports', loadComponent: () => import('./dashboards/view-sales-and-products-reports/view-sales-and-products-reports.component').then(m => m.SalesAndProductsReportsComponent)
      , canActivate: [RoleGuard],
      data: { roles: [ 'admin'] }
      },
         { 
      path: 'change-password', 
      component: ChangePasswordComponent, 
      canActivate: [AuthGuard] 
    },
 {
    path: 'admin',
    component: AdminPanelLayoutComponent,
    canActivate: [AuthGuard, RoleGuard],
     data: { roles: ['admin'] },
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      { path: 'panel', component: AdminPanelComponent },
    ],
  },
    ],
  },

  
  {
    path: 'u/invoice',
    component: InvoiceComponent,
    canActivate: [AuthGuard],  // Protect Invoice
  },

   
  {
    path: 'confirm/:email',
    component: ShowToSupplierComponent,
  },
  {
    path: 'u/unauthorized',
    component: UnauthorizedComponent
  },
  

  // Handle unknown routes
  { path: '**', redirectTo: '/auth/login', pathMatch: 'full' },
];
