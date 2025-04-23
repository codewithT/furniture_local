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
export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  
  {
    path:'auth',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: UserLoginComponent },
      { path: 'signup', component: SignUpComponent },
    ],
  },

  
  {
    path: 'u',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],   
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'supplier', component: SupplierComponent },
      { path: 'purchase', component: PurchaseComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'addOrders', component: AddOrderComponent },
      { path: 'manageOrders', component: ManageOrderComponent },
      { path: 'order-details/:soNumber', component: OrderDetailsComponent },
     {path : 'receive', component: ReceiveProductsComponent},
     {path: 'delivery', component: ScheduleDeliveryComponent},
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

  // Handle unknown routes
  { path: '**', redirectTo: '/auth/login', pathMatch: 'full' },
];
