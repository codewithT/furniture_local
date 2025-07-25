import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-supplier-layout',
  standalone: true,
    imports : [RouterOutlet, RouterModule],
  template: `<router-outlet></router-outlet>`, // No navbar here
})
export class SupplierLayoutComponent {}
