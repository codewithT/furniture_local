import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports : [RouterOutlet, RouterModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>  
<router-outlet></router-outlet>

  `,
})
export class MainLayoutComponent {}
